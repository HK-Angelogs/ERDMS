const mysql = require('mysql2');

const db = mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'fullstack_user',
    password: 'fullstack_password123',
    database: 'fullstack_db'
});

db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err.message);
        return;
    }

    console.log('Connected to MariaDB database: fullstack_db');
});

module.exports = db;