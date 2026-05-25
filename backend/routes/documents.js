const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const logActivity = require('../config/logger');
const upload = require('../config/upload');
const { verifyToken, verifyAdminOrSuperAdmin } = require('../middleware/auth');

const router = express.Router();

// ─── UPLOAD DOCUMENT ──────────────────────────────────────────────────────────

router.post('/upload', verifyToken, upload.single('document'), (req, res) => {
    const { title, description, category } = req.body;

    if (!title || title.trim() === '') {
        return res.status(400).json({ message: 'Document title is required' });
    }

    if (!category || category.trim() === '') {
        return res.status(400).json({ message: 'Document category is required' });
    }

    if (!req.file) {
        return res.status(400).json({ message: 'Document file is required' });
    }

    const { originalname, filename, mimetype, size } = req.file;
    const filePath = `uploads/documents/${filename}`;

    db.query(
        `INSERT INTO documents 
        (title, description, category, original_filename, stored_filename, file_path, file_type, file_size, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [title, description || '', category, originalname, filename, filePath, mimetype, size, req.user.id],
        (err, result) => {
            if (err) {
                return res.status(500).json({ message: 'Failed to save document record', error: err.message });
            }

            logActivity(req, 'UPLOAD_DOCUMENT', 'Document Management', `Uploaded document: ${title}`);

            res.status(201).json({
                message: 'Document uploaded successfully',
                documentId: result.insertId
            });
        }
    );
});

// ─── GET ALL DOCUMENTS ────────────────────────────────────────────────────────

router.get('/', verifyToken, (req, res) => {
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
                return res.status(500).json({ message: 'Failed to fetch documents', error: err.message });
            }

            res.json(result);
        }
    );
});

// ─── SEARCH DOCUMENTS ─────────────────────────────────────────────────────────
// NOTE: must be registered before /:id routes to avoid Express capturing
// the literal string "search" as the :id parameter.

router.get('/search', verifyToken, (req, res) => {
    const q = req.query.q ? req.query.q.trim() : '';

    if (!q) {
        return res.status(400).json({ message: 'Search query is required' });
    }

    const pattern = `%${q}%`;

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
        WHERE documents.title LIKE ?
           OR documents.description LIKE ?
           OR documents.category LIKE ?
           OR documents.original_filename LIKE ?
           OR users.username LIKE ?
        ORDER BY documents.created_at DESC`,
        [pattern, pattern, pattern, pattern, pattern],
        (err, result) => {
            if (err) {
                return res.status(500).json({ message: 'Failed to search documents', error: err.message });
            }

            logActivity(
                req,
                'SEARCH_DOCUMENTS',
                'Document Management',
                `Searched documents with query: "${q}"`
            );

            res.json(result);
        }
    );
});

// ─── VIEW DOCUMENT ────────────────────────────────────────────────────────────

router.get('/:id/view', verifyToken, (req, res) => {
    const { id } = req.params;

    db.query(
        'SELECT * FROM documents WHERE id = ?',
        [id],
        (err, result) => {
            if (err) {
                return res.status(500).json({ message: 'Failed to fetch document', error: err.message });
            }

            if (result.length === 0) {
                return res.status(404).json({ message: 'Document not found' });
            }

            const document = result[0];
            const absolutePath = path.join(__dirname, '..', document.file_path);

            if (!fs.existsSync(absolutePath)) {
                return res.status(404).json({ message: 'File not found on server' });
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

// ─── DOWNLOAD DOCUMENT ────────────────────────────────────────────────────────

router.get('/:id/download', verifyToken, (req, res) => {
    const { id } = req.params;

    db.query(
        'SELECT * FROM documents WHERE id = ?',
        [id],
        (err, result) => {
            if (err) {
                return res.status(500).json({ message: 'Failed to fetch document', error: err.message });
            }

            if (result.length === 0) {
                return res.status(404).json({ message: 'Document not found' });
            }

            const document = result[0];
            const absolutePath = path.join(__dirname, '..', document.file_path);

            if (!fs.existsSync(absolutePath)) {
                return res.status(404).json({ message: 'File not found on server' });
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

// ─── DELETE DOCUMENT ──────────────────────────────────────────────────────────

router.delete('/:id', verifyToken, verifyAdminOrSuperAdmin, (req, res) => {
    const { id } = req.params;

    db.query(
        'SELECT * FROM documents WHERE id = ?',
        [id],
        (err, result) => {
            if (err) {
                return res.status(500).json({ message: 'Failed to fetch document', error: err.message });
            }

            if (result.length === 0) {
                return res.status(404).json({ message: 'Document not found' });
            }

            const document = result[0];
            const absolutePath = path.join(__dirname, '..', document.file_path);

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

                    res.json({ message: 'Document deleted successfully' });
                }
            );
        }
    );
});

module.exports = router;