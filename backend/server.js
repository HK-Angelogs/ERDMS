const express = require('express');
const cors = require('cors');

const { verifyToken } = require('./middleware/auth');

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

app.use('/', authRoutes);
app.use('/users', userRoutes);
app.use('/documents', documentRoutes);
app.use('/activity-logs', activityLogRoutes);
app.use('/api/dashboard', verifyToken, dashboardRoutes);
app.use('/folders', folderRoutes);

// ─── START ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});