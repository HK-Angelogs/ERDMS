const express = require('express');
const cors = require('cors');

const { verifyToken } = require('./middleware/auth');
const { enforcePasswordChange } = require('./middleware/enforcePasswordChange');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const documentRoutes = require('./routes/documents');
const activityLogRoutes = require('./routes/activityLogs');
const dashboardRoutes = require('./routes/dashboard');
const folderRoutes = require('./routes/folders');

const app = express();
const PORT = 3000;

// ─── GLOBAL MIDDLEWARE ────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());

app.disable('etag');

app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
    res.send('API server is running');
});

// ─── ROUTES ───────────────────────────────────────────────────────────────────

// Auth routes are exempt from enforcePasswordChange.
// /login, /register, /logout, and /change-password are all under this mount.
// Individual handlers within authRoutes apply verifyToken where required.
app.use('/', authRoutes);

// Protected route groups.
// verifyToken runs at mount level here; enforcePasswordChange queries DB
// to block all access when force_password_change = TRUE.
// Note: individual route handlers in these files also call verifyToken — this
// is harmless (token verified twice) and does not require a refactor.
app.use('/users', verifyToken, enforcePasswordChange, userRoutes);
app.use('/documents', verifyToken, enforcePasswordChange, documentRoutes);
app.use('/activity-logs', verifyToken, enforcePasswordChange, activityLogRoutes);
app.use('/api/dashboard', verifyToken, enforcePasswordChange, dashboardRoutes);
app.use('/folders', verifyToken, enforcePasswordChange, folderRoutes);

// ─── START ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});