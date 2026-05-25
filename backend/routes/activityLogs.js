const express = require('express');
const db = require('../config/db');
const logActivity = require('../config/logger');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// ─── GET ACTIVITY LOGS ────────────────────────────────────────────────────────

router.get('/', verifyToken, (req, res) => {
    let sql;
    let values = [];

    if (req.user.role === 'super_admin') {
        sql = `
            SELECT id, user_id, username, role, action, module, details, created_at
            FROM activity_logs
            ORDER BY created_at DESC
        `;
    } else if (req.user.role === 'admin') {
        sql = `
            SELECT id, user_id, username, role, action, module, details, created_at
            FROM activity_logs
            WHERE role = 'user' OR user_id = ?
            ORDER BY created_at DESC
        `;
        values = [req.user.id];
    } else if (req.user.role === 'user') {
        sql = `
            SELECT id, user_id, username, role, action, module, details, created_at
            FROM activity_logs
            WHERE user_id = ?
            ORDER BY created_at DESC
        `;
        values = [req.user.id];
    } else {
        return res.status(403).json({ message: 'Access denied.' });
    }

    db.query(sql, values, (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Failed to fetch activity logs', error: err.message });
        }

        const detailMessage =
            req.user.role === 'super_admin' ? 'Viewed all activity logs' :
                req.user.role === 'admin' ? 'Viewed user logs and own logs only' :
                    'Viewed own activity logs only';

        logActivity(req, 'VIEW_ACTIVITY_LOGS', 'System Monitoring', detailMessage);

        res.json(result);
    });
});

module.exports = router;