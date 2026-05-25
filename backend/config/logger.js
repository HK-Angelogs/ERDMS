const db = require('../config/db');

function logActivity(req, action, module, details) {
    const userId = req.user?.id || null;
    const username = req.user?.username || 'Unknown';
    const role = req.user?.role || null;
    const ipAddress = req.ip || req.connection?.remoteAddress || null;

    db.query(
        `INSERT INTO activity_logs 
        (user_id, username, role, action, module, details, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, username, role, action, module, details, ipAddress],
        (err) => {
            if (err) {
                console.error('Failed to log activity:', err.message);
            }
        }
    );
}

module.exports = logActivity;