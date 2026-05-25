const express = require('express');
const db = require('../config/db');

const router = express.Router();

// ─── GET DASHBOARD STATS ──────────────────────────────────────────────────────

router.get('/stats', (req, res) => {
    db.query('SELECT COUNT(*) AS total FROM users', (err, userResult) => {
        if (err) {
            return res.status(500).json({ message: 'Failed to fetch user count', error: err.message });
        }

        db.query('SELECT COUNT(*) AS total FROM documents', (err, docResult) => {
            if (err) {
                return res.status(500).json({ message: 'Failed to fetch document count', error: err.message });
            }

            db.query(
                `SELECT id, username, role, action, module, details, created_at
                 FROM activity_logs
                 ORDER BY created_at DESC
                 LIMIT 10`,
                (err, activityResult) => {
                    if (err) {
                        return res.status(500).json({
                            message: 'Failed to fetch activity logs',
                            error: err.message
                        });
                    }

                    res.json({
                        totalUsers: userResult[0].total,
                        totalDocuments: docResult[0].total,
                        recentActivities: activityResult
                    });
                }
            );
        });
    });
});

module.exports = router;