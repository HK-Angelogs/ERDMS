const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();


const PORT = 3000;
const JWT_SECRET = 'secret_key';


// Middleware: allows Express to read JSON body from Postman
app.use(cors());
app.use(express.json());

app.disable('etag');

app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

// Database connection
const db = mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'fullstack_user',
    password: 'fullstack_password123',
    database: 'fullstack_db'
});

// Connect to MariaDB
db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err.message);
        return;
    }

    console.log('Connected to MariaDB database: fullstack_db');
});

app.get('/', (req, res) => {
    res.send('API server is running');
});

// Dashboard Routes
const dashboardRoutes = require('./routes/dashboard')(db);
app.use('/api/dashboard', verifyToken, dashboardRoutes);

// ACTIVITY LOGGING FUNCTION
function logActivity(req, action, module, details) {
    const userId = req.user?.id || null;
    const username = req.user?.username || 'Unknown';
    const role = req.user?.role || null;
    const ipAddress = req.ip || req.connection.remoteAddress;

    db.query(
        `INSERT INTO activity_logs 
        (user_id, username, role, action, module, details, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            userId,
            username,
            role,
            action,
            module,
            details,
            ipAddress
        ],
        (err) => {
            if (err) {
                console.error('Failed to log activity:', err.message);
            }
        }
    );
}

// REGISTER
app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            message: 'username, and password are required'
        });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        db.query(
            'INSERT INTO users (username, password) VALUES ( ?, ?)',
            [username, hashedPassword],
            (err, result) => {
                if (err) {
                    if (err.code === 'ER_DUP_ENTRY') {
                        return res.status(400).json({
                            message: 'username already exists'
                        });
                    }

                    return res.status(500).json({
                        message: 'Failed to register user',
                        error: err.message
                    });
                }

                logActivity(
                    fakeReq,
                    'REGISTER',
                    'Authentication',
                    `New user registered: ${username}`
                );

                res.status(201).json({
                    message: 'User registered successfully',
                    userId: result.insertId
                });
            }
        );
    } catch (error) {
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
});

// LOGIN
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            message: 'username and password are required'
        });
    }

    db.query(
        'SELECT * FROM users WHERE username = ?',
        [username],
        async (err, result) => {
            if (err) {
                return res.status(500).json({
                    message: 'Login failed',
                    error: err.message
                });
            }

            if (result.length === 0) {
                return res.status(401).json({
                    message: 'Invalid username or password'
                });
            }

            const user = result[0];

            if (user.disabled) {
                return res.status(403).json({
                    message: 'Account is disabled'
                });
            }

            const isPasswordCorrect = await bcrypt.compare(password, user.password);

            if (!isPasswordCorrect) {
                return res.status(401).json({
                    message: 'Invalid username or password'
                });
            }
            const token = jwt.sign(
                {
                    id: user.id,
                    username: user.username,
                    role: user.role
                },
                JWT_SECRET,
                { expiresIn: '1h' }
            );

            const fakeReq = {
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role
                },
                ip: req.ip,
                connection: req.connection
            };

            logActivity(
                fakeReq,
                'LOGIN',
                'Authentication',
                'User logged in successfully'
            );

            res.json({
                message: 'Login successful',
                token: token,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role
                }
            });
        }
    );
});

// AUTH MIDDLEWARE
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
        return res.status(401).json({
            message: 'No token provided'
        });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({
                message: 'Invalid or expired token'
            });
        }

        req.user = decoded;
        next();
    });
}

// ROLE-BASED ACCESS CONTROL MIDDLEWARE | SUPER ADMIN
function verifySuperAdmin(req, res, next) {
    if (req.user.role !== 'super_admin') {
        return res.status(403).json({
            message: 'Only super admin can modify roles'
        });
    }

    next();
}

// ROLE-BASED ACCESS CONTROL MIDDLEWARE | ROLE CHECK 
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

        return res.status(403).json({
            message: 'Users can only modify their own account'
        });
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
                    return res.status(404).json({
                        message: 'User not found'
                    });
                }

                const targetRole = result[0].role;

                if (targetRole !== 'user') {
                    return res.status(403).json({
                        message: 'Admins can only modify users with user role'
                    });
                }

                next();
            }
        );

        return;
    }

    return res.status(403).json({
        message: 'Unauthorized role'
    });
}

// ROLE-BASED ACCESS CONTROL MIDDLEWARE | FOR ADD USER
function verifyAdminOrSuperAdmin(req, res, next) {
    if (req.user.role === 'admin' || req.user.role === 'super_admin') {
        return next();
    }

    return res.status(403).json({
        message: 'Access denied. Admin or super admin only.'
    });
}

// UPLOAD WITH MULTER
const uploadDir = path.join(__dirname, 'uploads', 'documents');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },

    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + file.originalname.replace(/\s+/g, '_');
        cb(null, uniqueName);
    }
});

const allowedFileTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/png',
    'image/jpeg'
];

const upload = multer({
    storage: storage,

    limits: {
        fileSize: 10 * 1024 * 1024
    },

    fileFilter: (req, file, cb) => {
        if (allowedFileTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, DOC, DOCX, TXT, PNG, JPG, and JPEG are allowed.'));
        }
    }
});


// USER MANAGEMENT ROUTES
// CREATE USER - SUPER ADMIN AND ADMIN ONLY
app.post('/add-user', verifyToken, verifyAdminOrSuperAdmin, async (req, res) => {
    const { username, role } = req.body;

    if (!username || username.trim() === '') {
        return res.status(400).json({
            message: 'Username is required'
        });
    }

    let finalRole = 'user';

    if (req.user.role === 'super_admin') {
        finalRole = role || 'user';

        const allowedRoles = ['user', 'admin'];

        if (!allowedRoles.includes(finalRole)) {
            return res.status(400).json({
                message: 'Invalid role. Only user and admin can be created here.'
            });
        }
    }

    if (req.user.role === 'admin') {
        finalRole = 'user';
    }

    try {
        const defaultPassword = 'default';
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);

        db.query(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            [username, hashedPassword, finalRole],
            (err, result) => {
                if (err) {
                    if (err.code === 'ER_DUP_ENTRY') {
                        return res.status(400).json({
                            message: 'Username already exists'
                        });
                    }

                    return res.status(500).json({
                        message: 'Failed to add user',
                        error: err.message
                    });
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
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
});



// UPDATE USERNAME AND PASSWORD - SUPER ADMIN | ADMIN ONLY
app.put('/update-user/:id', verifyToken, verifySelfOrAdminOverUser, async (req, res) => {
    const { id } = req.params;
    const { username, password, role } = req.body;


    if (!username || username.trim() === '') {
        return res.status(400).json({
            message: 'Username is required'
        });
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
                return res.status(500).json({
                    message: 'Failed to update user',
                    error: err.message
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    message: 'User not found'
                });
            }

            logActivity(
                req,
                'UPDATE_USER',
                'User Management',
                `Updated user ID: ${id}`
            );

            res.json({
                message: 'User updated successfully'
            });
        });
    } catch (error) {
        res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
});

// UPDATE ROLES - SUPER ADMIN ONLY
app.put('/users/:id/role', verifyToken, verifySuperAdmin, (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    const allowedRoles = ['user', 'admin'];

    if (!role) {
        return res.status(400).json({
            message: 'Role is required'
        });
    }

    if (!allowedRoles.includes(role)) {
        return res.status(400).json({
            message: 'Invalid role. Only user and admin can be assigned here.'
        });
    }

    db.query(
        'UPDATE users SET role = ? WHERE id = ? AND role != "super_admin"',
        [role, id],
        (err, result) => {
            if (err) {
                return res.status(500).json({
                    message: 'Failed to update role',
                    error: err.message
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    message: 'User not found or cannot modify super admin'
                });
            }

            logActivity(
                req,
                'CHANGE_ROLE',
                'User Management',
                `Changed role of user ID: ${id} to ${role}`
            );

            res.json({
                message: 'User role updated successfully'
            });
        }
    );
});

// USERS ROUTE 
app.get('/users', verifyToken, (req, res) => {
    if (req.user.role === 'super_admin') {
        db.query(
            'SELECT id, username, role, disabled, created_at FROM users',
            (err, result) => {
                if (err) {
                    return res.status(500).json({
                        message: 'Failed to fetch users',
                        error: err.message
                    });
                }

                return res.json(result);
            }
        );

        return;
    }

    if (req.user.role === 'admin') {
        db.query(
            'SELECT id, username, role, disabled, created_at FROM users WHERE role = "user"',
            (err, result) => {
                if (err) {
                    return res.status(500).json({
                        message: 'Failed to fetch users',
                        error: err.message
                    });
                }

                return res.json(result);
            }
        );

        return;
    }

    db.query(
        'SELECT id, username, role, disabled, created_at FROM users WHERE id = ?',
        [req.user.id],
        (err, result) => {
            if (err) {
                return res.status(500).json({
                    message: 'Failed to fetch user',
                    error: err.message
                });
            }

            res.json(result);
        }
    );
});

// READ SINGLE USER BY ID
app.get('/users/:id', (req, res) => {
    const { id } = req.params;

    db.query(
        'SELECT * FROM users WHERE id = ?',
        [id],
        (err, result) => {
            if (err) {
                return res.status(500).json({
                    message: 'Failed to fetch user',
                    error: err.message
                });
            }

            if (result.length === 0) {
                return res.status(404).json({
                    message: 'User not found'
                });
            }

            res.json(result[0]);
        }
    );
});


// DISABLE USER
app.put('/disable-user/:id', verifyToken, verifyAdminOrSuperAdmin, (req, res) => {
    const { id } = req.params;

    db.query(
        'UPDATE users SET disabled = true WHERE id = ?',
        [id],
        (err, result) => {
            if (err) {
                return res.status(500).json({
                    message: 'Failed to disable user',
                    error: err.message
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    message: 'User not found'
                });
            }

            logActivity(
                req,
                'DSIABLE_USER',
                'User Management',
                `Added new user: ${username} with role: ${finalRole}`
            );

            res.json({
                message: 'User disabled successfully'
            });
        }
    );
});

// ENABLE USER
app.put('/enable-user/:id', verifyToken, verifySelfOrAdminOverUser, (req, res) => {
    const { id } = req.params;

    db.query(
        'UPDATE users SET disabled = false WHERE id = ?',
        [id],
        (err, result) => {
            if (err) {
                return res.status(500).json({
                    message: 'Failed to enable user',
                    error: err.message
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    message: 'User not found'
                });
            }

            logActivity(
                req,
                'ENABLE_USER',
                'User Management',
                `Enabled user ID: ${id}`
            );

            res.json({
                message: 'User enabled successfully'
            });
        }
    );
});

// DOCUMENT MANAGEMENT ROUTES

// UPLOAD DOCUMENT
app.post('/documents/upload', verifyToken, upload.single('document'), (req, res) => {
    const { title, description, category } = req.body;

    if (!title || title.trim() === '') {
        return res.status(400).json({
            message: 'Document title is required'
        });
    }

    if (!category || category.trim() === '') {
        return res.status(400).json({
            message: 'Document category is required'
        });
    }

    if (!req.file) {
        return res.status(400).json({
            message: 'Document file is required'
        });
    }

    const originalFilename = req.file.originalname;
    const storedFilename = req.file.filename;
    const filePath = `uploads/documents/${storedFilename}`;
    const fileType = req.file.mimetype;
    const fileSize = req.file.size;
    const uploadedBy = req.user.id;

    db.query(
        `INSERT INTO documents 
        (title, description, category, original_filename, stored_filename, file_path, file_type, file_size, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            title,
            description || '',
            category,
            originalFilename,
            storedFilename,
            filePath,
            fileType,
            fileSize,
            uploadedBy
        ],
        (err, result) => {
            if (err) {
                return res.status(500).json({
                    message: 'Failed to save document record',
                    error: err.message
                });
            }

            logActivity(
                req,
                'UPLOAD_DOCUMENT',
                'Document Management',
                `Uploaded document: ${title}`
            );

            res.status(201).json({
                message: 'Document uploaded successfully',
                documentId: result.insertId
            });
        }
    );
});

// GET ALL DOCUMENTS
app.get('/documents', verifyToken, (req, res) => {
    db.query(
        `SELECT 
            documents.id,
            documents.title,
            documents.description,
            documents.category,
            documents.original_filename,
            documents.stored_filename,
            documents.file_path,
            documents.file_type,
            documents.file_size,
            documents.uploaded_by,
            documents.created_at,
            users.username AS uploaded_by_username
        FROM documents
        LEFT JOIN users ON documents.uploaded_by = users.id
        ORDER BY documents.created_at DESC`,
        (err, result) => {
            if (err) {
                return res.status(500).json({
                    message: 'Failed to fetch documents',
                    error: err.message
                });
            }

            res.json(result);
        }
    );
});

// VIEW DOCUMENT
app.get('/documents/:id/view', verifyToken, (req, res) => {
    const { id } = req.params;

    db.query(
        'SELECT * FROM documents WHERE id = ?',
        [id],
        (err, result) => {
            if (err) {
                return res.status(500).json({
                    message: 'Failed to fetch document',
                    error: err.message
                });
            }

            if (result.length === 0) {
                return res.status(404).json({
                    message: 'Document not found'
                });
            }

            const document = result[0];
            const absolutePath = path.join(__dirname, document.file_path);

            if (!fs.existsSync(absolutePath)) {
                return res.status(404).json({
                    message: 'File not found on server'
                });
            }

            logActivity(
                req,
                'VIEW_DOCUMENT',
                'Document Management',
                `Viewed document ID: ${id}, filename: ${document.original_filename}`
            );

            res.sendFile(absolutePath);
        }
    );
});

// DOWNLOAD DOCUMENT
app.get('/documents/:id/download', verifyToken, (req, res) => {
    const { id } = req.params;

    db.query(
        'SELECT * FROM documents WHERE id = ?',
        [id],
        (err, result) => {
            if (err) {
                return res.status(500).json({
                    message: 'Failed to fetch document',
                    error: err.message
                });
            }

            if (result.length === 0) {
                return res.status(404).json({
                    message: 'Document not found'
                });
            }

            const document = result[0];
            const absolutePath = path.join(__dirname, document.file_path);

            if (!fs.existsSync(absolutePath)) {
                return res.status(404).json({
                    message: 'File not found on server'
                });
            }

            logActivity(
                req,
                'DOWNLOAD_DOCUMENT',
                'Document Management',
                `Downloaded document ID: ${id}, filename: ${document.original_filename}`
            );

            res.download(absolutePath, document.original_filename);
        }
    );
});

// DELETE DOCUMENT - ADMIN AND SUPER ADMIN ONLY
app.delete('/documents/:id', verifyToken, verifyAdminOrSuperAdmin, (req, res) => {
    const { id } = req.params;

    db.query(
        'SELECT * FROM documents WHERE id = ?',
        [id],
        (err, result) => {
            if (err) {
                return res.status(500).json({
                    message: 'Failed to fetch document',
                    error: err.message
                });
            }

            if (result.length === 0) {
                return res.status(404).json({
                    message: 'Document not found'
                });
            }

            const document = result[0];
            const absolutePath = path.join(__dirname, document.file_path);

            db.query(
                'DELETE FROM documents WHERE id = ?',
                [id],
                (deleteErr) => {
                    if (deleteErr) {
                        return res.status(500).json({
                            message: 'Failed to delete document record',
                            error: deleteErr.message
                        });
                    }

                    if (fs.existsSync(absolutePath)) {
                        fs.unlinkSync(absolutePath);
                    }

                    logActivity(
                        req,
                        'DELETE_DOCUMENT',
                        'Document Management',
                        `Deleted document ID: ${id}, filename: ${document.original_filename}`
                    );

                    res.json({
                        message: 'Document deleted successfully'
                    });
                }
            );
        }
    );
});

// LOGOUT TRACKING
app.post('/logout', verifyToken, (req, res) => {
    logActivity(
        req,
        'LOGOUT',
        'Authentication',
        'User logged out'
    );

    res.json({
        message: 'Logout logged successfully'
    });
});

// GET ALL ACTIVITY LOGS - ADMIN AND SUPER ADMIN ONLY
app.get('/activity-logs', verifyToken, (req, res) => {
    let sql;
    let values = [];

    if (req.user.role === 'super_admin') {
        // Super admin can see all logs
        sql = `
            SELECT 
                id,
                user_id,
                username,
                role,
                action,
                module,
                details,
                created_at
            FROM activity_logs
            ORDER BY created_at DESC
        `;
    } else if (req.user.role === 'admin') {
        // Admin can see normal user logs AND their own logs
        sql = `
            SELECT 
                id,
                user_id,
                username,
                role,
                action,
                module,
                details,
                created_at
            FROM activity_logs
            WHERE role = 'user' OR user_id = ?
            ORDER BY created_at DESC
        `;

        values = [req.user.id];
    } else if (req.user.role === 'user') {
        // User can only see their own logs
        sql = `
            SELECT 
                id,
                user_id,
                username,
                role,
                action,
                module,
                details,
                created_at
            FROM activity_logs
            WHERE user_id = ?
            ORDER BY created_at DESC
        `;

        values = [req.user.id];
    } else {
        return res.status(403).json({
            message: 'Access denied.'
        });
    }

    db.query(sql, values, (err, result) => {
        if (err) {
            return res.status(500).json({
                message: 'Failed to fetch activity logs',
                error: err.message
            });
        }

        logActivity(
            req,
            'VIEW_ACTIVITY_LOGS',
            'System Monitoring',
            req.user.role === 'super_admin'
                ? 'Viewed all activity logs'
                : req.user.role === 'admin'
                    ? 'Viewed user logs and own logs only'
                    : 'Viewed own activity logs only'
        );

        res.json(result);
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

