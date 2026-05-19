const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'secret_key';

// Middleware: allows Express to read JSON body from Postman
app.use(cors());
app.use(express.json());

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

// REGISTER
app.post('/register', async (req, res) => {
    const { name, username, password } = req.body;

    if (!name || !username || !password) {
        return res.status(400).json({
            message: 'Name, username, and password are required'
        });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        db.query(
            'INSERT INTO users (name, username, password) VALUES (?, ?, ?)',
            [name, username, hashedPassword],
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

            res.json({
                message: 'Login successful',
                token: token,
                user: {
                    id: user.id,
                    name: user.name,
                    username: user.username,
                    role: user.role
                }
            });
        }
    );
});



// CREATE USER
app.post('/add-user', verifyToken, (req, res) => {
    const { name } = req.body;

    if (!name) {
        return res.status(400).json({
            message: 'Name is required'
        });
    }

    db.query(
        'INSERT INTO users (name) VALUES (?)',
        [name],
        (err, result) => {
            if (err) {
                return res.status(500).json({
                    message: 'Failed to add user',
                    error: err.message
                });
            }

            res.status(201).json({
                message: 'User added successfully',
                userId: result.insertId
            });
        }
    );
});

// AUTH MIDDLEWARE
function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        return res.status(401).json({
            message: 'No token provided'
        });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            message: 'Invalid token format'
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

// ROLE-BASED ACCESS CONTROL MIDDLEWARE
function verifySuperAdmin(req, res, next) {
    if (req.user.role !== 'super_admin') {
        return res.status(403).json({
            message: 'Only super admin can modify roles'
        });
    }

    next();
}

// UPDATE USER ROLE - SUPER ADMIN ONLY
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

            res.json({
                message: 'User role updated successfully'
            });
        }
    );
});

// USERS ROUTE 
app.get('/users', verifyToken, (req, res) => {
    db.query(
        'SELECT id, name, username, role, disabled, created_at FROM users',
        (err, result) => {
            if (err) {
                return res.status(500).json({
                    message: 'Failed to fetch users',
                    error: err.message
                });
            }

            res.json(result);
        });
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

// UPDATE USER
app.put('/update-user/:id', verifyToken, (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
        return res.status(400).json({
            message: 'Name is required'
        });
    }

    db.query(
        'UPDATE users SET name = ? WHERE id = ?',
        [name, id],
        (err, result) => {
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

            res.json({
                message: 'User updated successfully'
            });
        }
    );
});

// DELETE USER
app.delete('/delete-user/:id', verifyToken, (req, res) => {
    const { id } = req.params;

    db.query(
        'DELETE FROM users WHERE id = ?',
        [id],
        (err, result) => {
            if (err) {
                return res.status(500).json({
                    message: 'Failed to delete user',
                    error: err.message
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    message: 'User not found'
                });
            }

            res.json({
                message: 'User deleted successfully'
            });
        }
    );
});

// DISABLE USER
app.put('/disable-user/:id', verifyToken, (req, res) => {
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

            res.json({
                message: 'User disabled successfully'
            });
        }
    );
});

// ENABLE USER
app.put('/enable-user/:id', verifyToken, (req, res) => {
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

            res.json({
                message: 'User enabled successfully'
            });
        }
    );
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

