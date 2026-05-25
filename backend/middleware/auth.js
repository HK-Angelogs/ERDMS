const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = 'secret_key';

// ─── JWT verification ────────────────────────────────────────────────────────

function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];

    let token = null;

    if (authHeader) {
        token = authHeader.split(' ')[1];
    }

    if (!token && req.query.token) {
        token = req.query.token;
    }

    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid or expired token' });
        }

        req.user = decoded;
        next();
    });
}

// ─── Role: super_admin only ───────────────────────────────────────────────────

function verifySuperAdmin(req, res, next) {
    if (req.user.role !== 'super_admin') {
        return res.status(403).json({ message: 'Only super admin can modify roles' });
    }

    next();
}

// ─── Role: admin or super_admin ───────────────────────────────────────────────

function verifyAdminOrSuperAdmin(req, res, next) {
    if (req.user.role === 'admin' || req.user.role === 'super_admin') {
        return next();
    }

    return res.status(403).json({ message: 'Access denied. Admin or super admin only.' });
}

// ─── Role: self-edit or admin-over-user ──────────────────────────────────────

function verifySelfOrAdminOverUser(req, res, next) {
    const targetUserId = Number(req.params.id);
    const loggedInUserId = Number(req.user.id);

    if (req.user.role === 'super_admin') {
        return next();
    }

    if (req.user.role === 'user') {
        if (loggedInUserId === targetUserId) {
            return next();
        }

        return res.status(403).json({ message: 'Users can only modify their own account' });
    }

    if (req.user.role === 'admin') {
        db.query(
            'SELECT role FROM users WHERE id = ?',
            [targetUserId],
            (err, result) => {
                if (err) {
                    return res.status(500).json({
                        message: 'Failed to verify target user',
                        error: err.message
                    });
                }

                if (result.length === 0) {
                    return res.status(404).json({ message: 'User not found' });
                }

                if (result[0].role !== 'user') {
                    return res.status(403).json({ message: 'Admins can only modify users with user role' });
                }

                next();
            }
        );

        return;
    }

    return res.status(403).json({ message: 'Unauthorized role' });
}

module.exports = {
    verifyToken,
    verifySuperAdmin,
    verifyAdminOrSuperAdmin,
    verifySelfOrAdminOverUser
};