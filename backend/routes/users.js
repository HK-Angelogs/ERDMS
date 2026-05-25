const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const logActivity = require('../config/logger');
const {
    verifyToken,
    verifySuperAdmin,
    verifyAdminOrSuperAdmin,
    verifySelfOrAdminOverUser
} = require('../middleware/auth');

const router = express.Router();

// ─── GET ALL USERS ────────────────────────────────────────────────────────────

router.get('/', verifyToken, (req, res) => {
    let sql;
    let values = [];

    if (req.user.role === 'super_admin') {
        sql = 'SELECT id, username, role, disabled, created_at FROM users';
    } else if (req.user.role === 'admin') {
        sql = 'SELECT id, username, role, disabled, created_at FROM users WHERE role = "user"';
    } else {
        sql = 'SELECT id, username, role, disabled, created_at FROM users WHERE id = ?';
        values = [req.user.id];
    }

    db.query(sql, values, (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Failed to fetch users', error: err.message });
        }

        res.json(result);
    });
});

// ─── GET SINGLE USER BY ID ────────────────────────────────────────────────────

router.get('/:id', (req, res) => {
    const { id } = req.params;

    db.query(
        'SELECT * FROM users WHERE id = ?',
        [id],
        (err, result) => {
            if (err) {
                return res.status(500).json({ message: 'Failed to fetch user', error: err.message });
            }

            if (result.length === 0) {
                return res.status(404).json({ message: 'User not found' });
            }

            res.json(result[0]);
        }
    );
});

// ─── ADD USER ─────────────────────────────────────────────────────────────────

router.post('/add-user', verifyToken, verifyAdminOrSuperAdmin, async (req, res) => {
    const { username, role } = req.body;

    if (!username || username.trim() === '') {
        return res.status(400).json({ message: 'Username is required' });
    }

    let finalRole = 'user';

    if (req.user.role === 'super_admin') {
        finalRole = role || 'user';

        const allowedRoles = ['user', 'admin'];

        if (!allowedRoles.includes(finalRole)) {
            return res.status(400).json({ message: 'Invalid role. Only user and admin can be created here.' });
        }
    }

    try {
        const hashedPassword = await bcrypt.hash('default', 10);

        db.query(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            [username, hashedPassword, finalRole],
            (err, result) => {
                if (err) {
                    if (err.code === 'ER_DUP_ENTRY') {
                        return res.status(400).json({ message: 'Username already exists' });
                    }

                    return res.status(500).json({ message: 'Failed to add user', error: err.message });
                }

                logActivity(
                    req,
                    'ADD_USER',
                    'User Management',
                    `Added new user: ${username} with role: ${finalRole}`
                );

                res.status(201).json({
                    message: 'User added successfully',
                    userId: result.insertId,
                    defaultPassword: 'default'
                });
            }
        );
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// ─── UPDATE USER ──────────────────────────────────────────────────────────────

router.put('/update-user/:id', verifyToken, verifySelfOrAdminOverUser, async (req, res) => {
    const { id } = req.params;
    const { username, password } = req.body;

    if (!username || username.trim() === '') {
        return res.status(400).json({ message: 'Username is required' });
    }

    try {
        let sql;
        let values;

        if (password && password.trim() !== '') {
            const hashedPassword = await bcrypt.hash(password, 10);
            sql = 'UPDATE users SET username = ?, password = ? WHERE id = ?';
            values = [username, hashedPassword, id];
        } else {
            sql = 'UPDATE users SET username = ? WHERE id = ?';
            values = [username, id];
        }

        db.query(sql, values, (err, result) => {
            if (err) {
                return res.status(500).json({ message: 'Failed to update user', error: err.message });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'User not found' });
            }

            logActivity(req, 'UPDATE_USER', 'User Management', `Updated user ID: ${id}`);

            res.json({ message: 'User updated successfully' });
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// ─── UPDATE ROLE ──────────────────────────────────────────────────────────────

router.put('/:id/role', verifyToken, verifySuperAdmin, (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    const allowedRoles = ['user', 'admin'];

    if (!role) {
        return res.status(400).json({ message: 'Role is required' });
    }

    if (!allowedRoles.includes(role)) {
        return res.status(400).json({ message: 'Invalid role. Only user and admin can be assigned here.' });
    }

    db.query(
        'UPDATE users SET role = ? WHERE id = ? AND role != "super_admin"',
        [role, id],
        (err, result) => {
            if (err) {
                return res.status(500).json({ message: 'Failed to update role', error: err.message });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'User not found or cannot modify super admin' });
            }

            logActivity(req, 'CHANGE_ROLE', 'User Management', `Changed role of user ID: ${id} to ${role}`);

            res.json({ message: 'User role updated successfully' });
        }
    );
});

// ─── DISABLE USER ─────────────────────────────────────────────────────────────

router.put('/disable-user/:id', verifyToken, verifyAdminOrSuperAdmin, (req, res) => {
    const { id } = req.params;

    db.query(
        'UPDATE users SET disabled = true WHERE id = ?',
        [id],
        (err, result) => {
            if (err) {
                return res.status(500).json({ message: 'Failed to disable user', error: err.message });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'User not found' });
            }

            logActivity(req, 'DISABLE_USER', 'User Management', `Disabled user ID: ${id}`);

            res.json({ message: 'User disabled successfully' });
        }
    );
});

// ─── ENABLE USER ──────────────────────────────────────────────────────────────

router.put('/enable-user/:id', verifyToken, verifySelfOrAdminOverUser, (req, res) => {
    const { id } = req.params;

    db.query(
        'UPDATE users SET disabled = false WHERE id = ?',
        [id],
        (err, result) => {
            if (err) {
                return res.status(500).json({ message: 'Failed to enable user', error: err.message });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'User not found' });
            }

            logActivity(req, 'ENABLE_USER', 'User Management', `Enabled user ID: ${id}`);

            res.json({ message: 'User enabled successfully' });
        }
    );
});

module.exports = router;