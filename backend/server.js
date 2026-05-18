const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
const PORT = 3000;

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

// CREATE USER
app.post('/add-user', (req, res) => {
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

// READ ALL USERS
app.get('/users', (req, res) => {
    db.query('SELECT * FROM users', (err, result) => {
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
app.put('/update-user/:id', (req, res) => {
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
app.delete('/delete-user/:id', (req, res) => {
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
app.put('/disable-user/:id', (req, res) => {
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
app.put('/enable-user/:id', (req, res) => {
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

