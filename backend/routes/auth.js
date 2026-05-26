const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const logActivity = require('../config/logger');
const { verifyToken } = require('../middleware/auth');
const { validatePassword, SALT_ROUNDS } = require('../utils/passwordValidator');

const router = express.Router();
const JWT_SECRET = 'secret_key';

// ─── REGISTER ─────────────────────────────────────────────────────────────────

router.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    const { isValid, errors } = validatePassword(password);

    if (!isValid) {
        return res.status(400).json({ message: 'Password does not meet requirements.', errors });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        db.query(
            'INSERT INTO users (username, password) VALUES (?, ?)',
            [username, hashedPassword],
            (err, result) => {
                if (err) {
                    if (err.code === 'ER_DUP_ENTRY') {
                        return res.status(400).json({ message: 'Username already exists' });
                    }

                    return res.status(500).json({
                        message: 'Failed to register user',
                        error: err.message
                    });
                }

                // Build a minimal req-like object since no token exists at registration time
                const fakeReq = {
                    user: { id: result.insertId, username, role: 'user' },
                    ip: req.ip,
                    connection: req.connection
                };

                logActivity(fakeReq, 'REGISTER', 'Authentication', `New user registered: ${username}`);

                res.status(201).json({
                    message: 'User registered successfully',
                    userId: result.insertId
                });
            }
        );
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// ─── LOGIN ────────────────────────────────────────────────────────────────────

router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    db.query(
        'SELECT * FROM users WHERE username = ?',
        [username],
        async (err, result) => {
            if (err) {
                return res.status(500).json({ message: 'Login failed', error: err.message });
            }

            if (result.length === 0) {
                return res.status(401).json({ message: 'Invalid username or password' });
            }

            const user = result[0];

            if (user.disabled) {
                return res.status(403).json({ message: 'Account is disabled' });
            }

            const isPasswordCorrect = await bcrypt.compare(password, user.password);

            if (!isPasswordCorrect) {
                return res.status(401).json({ message: 'Invalid username or password' });
            }

            const token = jwt.sign(
                { id: user.id, username: user.username, role: user.role },
                JWT_SECRET,
                { expiresIn: '1h' }
            );

            const fakeReq = {
                user: { id: user.id, username: user.username, role: user.role },
                ip: req.ip,
                connection: req.connection
            };

            logActivity(fakeReq, 'LOGIN', 'Authentication', 'User logged in successfully');

            res.json({
                message: 'Login successful',
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    forcePasswordChange: !!user.force_password_change
                }
            });
        }
    );
});

// ─── LOGOUT ───────────────────────────────────────────────────────────────────

router.post('/logout', verifyToken, (req, res) => {
    logActivity(req, 'LOGOUT', 'Authentication', 'User logged out');
    res.json({ message: 'Logout logged successfully' });
});

// ─── CHANGE PASSWORD ──────────────────────────────────────────────────────────

router.post('/change-password', verifyToken, async (req, res) => {
    try {
        const { newPassword } = req.body;
        const userId = req.user.id;

        if (!newPassword || newPassword.trim() === '') {
            return res.status(400).json({ message: 'New password is required' });
        }

        // 1. Strength validation — backend is authoritative regardless of frontend state
        const { isValid, errors } = validatePassword(newPassword);

        if (!isValid) {
            return res.status(400).json({ message: 'Password does not meet requirements.', errors });
        }

        // 2. Reuse prevention — fetch current hash and reject if new password matches
        const currentUser = await new Promise((resolve, reject) => {
            db.query(
                'SELECT password FROM users WHERE id = ?',
                [userId],
                (err, result) => {
                    if (err) return reject(err);
                    if (result.length === 0) return reject(new Error('USER_NOT_FOUND'));
                    resolve(result[0]);
                }
            );
        });

        const isSamePassword = await bcrypt.compare(newPassword, currentUser.password);

        if (isSamePassword) {
            return res.status(400).json({
                message: 'Password does not meet requirements.',
                errors: ['New password cannot be the same as your current password.']
            });
        }

        // 3. Hash and persist; clear force_password_change flag in the same query
        const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

        db.query(
            'UPDATE users SET password = ?, force_password_change = FALSE WHERE id = ?',
            [hashedPassword, userId],
            (err, result) => {
                if (err) {
                    return res.status(500).json({
                        message: 'Failed to update password',
                        error: err.message
                    });
                }

                if (result.affectedRows === 0) {
                    return res.status(404).json({ message: 'User not found' });
                }

                logActivity(
                    req,
                    'CHANGE_PASSWORD',
                    'Authentication',
                    `User ID: ${userId} updated their default password`
                );

                res.status(200).json({ message: 'Password updated successfully' });
            }
        );
    } catch (error) {
        if (error.message === 'USER_NOT_FOUND') {
            return res.status(404).json({ message: 'User not found' });
        }
        console.error(error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

module.exports = router;