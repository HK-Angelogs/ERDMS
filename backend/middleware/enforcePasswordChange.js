'use strict';

const db = require('../config/db');

/**
 * enforcePasswordChange — DB-backed authorization enforcement middleware.
 *
 * Must be placed AFTER verifyToken in the middleware chain so that req.user.id is guaranteed.
 *
 * Queries the current force_password_change flag directly from the database on every request.
 * This is intentional: JWT payload is stale by nature and must not be trusted for this check.
 *
 * Returns 403 with { requiresPasswordChange: true } if the flag is set.
 * This response shape is consumed by the Angular HTTP interceptor for centralized redirect.
 *
 * Applied only to protected route groups. Auth routes (/login, /logout, /change-password)
 * are exempt because they are mounted separately in server.js.
 */
function enforcePasswordChange(req, res, next) {
    if (!req.user || !req.user.id) {
        // verifyToken should have rejected this before reaching here.
        // Defensive guard only.
        return res.status(401).json({ message: 'Unauthorized' });
    }

    db.query(
        'SELECT force_password_change FROM users WHERE id = ?',
        [req.user.id],
        (err, result) => {
            if (err) {
                return res.status(500).json({
                    message: 'Internal server error',
                    error: err.message
                });
            }

            if (result.length === 0) {
                return res.status(401).json({ message: 'User not found' });
            }

            if (result[0].force_password_change) {
                return res.status(403).json({
                    message: 'Password change required before accessing this resource.',
                    requiresPasswordChange: true
                });
            }

            next();
        }
    );
}

module.exports = { enforcePasswordChange };