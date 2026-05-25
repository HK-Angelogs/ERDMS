const express = require('express');
const db = require('../config/db');
const logActivity = require('../config/logger');
const { verifyToken, verifyAdminOrSuperAdmin } = require('../middleware/auth');

const router = express.Router();

const MAX_DEPTH = 10;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Assembles a flat folder array into a nested tree structure.
 * Folders are sorted alphabetically (A-Z) at every level.
 * O(n) using a map — avoids recursive SQL queries.
 *
 * @param {Array} rows - Flat array of folder rows from DB
 * @returns {Array} - Nested tree array
 */
function buildTree(rows) {
    const map = {};
    const roots = [];

    // Index all nodes
    for (const row of rows) {
        map[row.id] = { ...row, children: [] };
    }

    // Wire parent-child relationships
    for (const row of rows) {
        if (row.parent_folder_id === null) {
            roots.push(map[row.id]);
        } else if (map[row.parent_folder_id]) {
            map[row.parent_folder_id].children.push(map[row.id]);
        }
    }

    // Sort children alphabetically at every level
    function sortChildren(nodes) {
        nodes.sort((a, b) => a.name.localeCompare(b.name));
        for (const node of nodes) {
            if (node.children.length > 0) {
                sortChildren(node.children);
            }
        }
    }

    sortChildren(roots);
    roots.sort((a, b) => a.name.localeCompare(b.name));

    return roots;
}

/**
 * Returns the depth of a folder by walking up its ancestor chain.
 * Used to enforce MAX_DEPTH before insert.
 * Resolves via callback with (err, depth).
 *
 * @param {number} parentFolderId - Parent folder id to start from (depth = 1 means direct child of root)
 * @param {Function} callback
 */
function getFolderDepth(parentFolderId, callback) {
    if (parentFolderId === null || parentFolderId === undefined) {
        return callback(null, 1); // root-level folder is depth 1
    }

    let depth = 1;
    let currentId = parentFolderId;

    function step() {
        db.query(
            'SELECT parent_folder_id FROM folders WHERE id = ?',
            [currentId],
            (err, result) => {
                if (err) return callback(err);
                if (result.length === 0) return callback(new Error('Parent folder not found'));

                depth++;
                const parent = result[0].parent_folder_id;

                if (depth > MAX_DEPTH) {
                    return callback(new Error(`Maximum folder depth of ${MAX_DEPTH} exceeded`));
                }

                if (parent === null) {
                    // Reached root; the new folder will be at depth + 1
                    return callback(null, depth + 1);
                }

                currentId = parent;
                step();
            }
        );
    }

    step();
}

/**
 * Collects all descendant folder ids (including the folder itself).
 * Used to prevent moving a folder into one of its own descendants.
 * Resolves via callback with (err, Set<number>).
 *
 * @param {number} folderId
 * @param {Function} callback
 */
function getAllDescendantIds(folderId, callback) {
    const ids = new Set([folderId]);

    // Use a proper BFS with a queue to avoid async race on pending counter
    const queue = [folderId];

    function processQueue() {
        if (queue.length === 0) {
            return callback(null, ids);
        }

        const currentId = queue.shift();

        db.query(
            'SELECT id FROM folders WHERE parent_folder_id = ?',
            [currentId],
            (err, rows) => {
                if (err) return callback(err);

                for (const row of rows) {
                    ids.add(row.id);
                    queue.push(row.id);
                }

                processQueue();
            }
        );
    }

    processQueue();
}

/**
 * Shared helper: fetches all documents in a folder and responds with JSON.
 * Called from GET /:id/files after permission check passes.
 */
function fetchFolderDocuments(folderId, folder, req, res) {
    db.query(
        `SELECT
            d.id,
            d.title,
            d.description,
            d.category,
            d.folder_id,
            d.original_filename,
            d.stored_filename,
            d.file_path,
            d.file_type,
            d.file_size,
            d.uploaded_by,
            d.created_at,
            u.username AS uploaded_by_username
        FROM documents d
        LEFT JOIN users u ON u.id = d.uploaded_by
        WHERE d.folder_id = ?
        ORDER BY d.created_at DESC`,
        [folderId],
        (err, result) => {
            if (err) {
                return res.status(500).json({ message: 'Failed to fetch folder documents', error: err.message });
            }

            logActivity(
                req,
                'VIEW_FOLDER_FILES',
                'Document Management',
                `Viewed files in folder ID: ${folderId}, name: "${folder.name}"`
            );

            res.json(result);
        }
    );
}

// ─── GET ALL CATEGORIES ───────────────────────────────────────────────────────

router.get('/categories', verifyToken, (req, res) => {
    db.query(
        'SELECT id, name FROM categories ORDER BY name ASC',
        (err, result) => {
            if (err) {
                return res.status(500).json({ message: 'Failed to fetch categories', error: err.message });
            }

            res.json(result);
        }
    );
});

// ─── GET FOLDER TREE ──────────────────────────────────────────────────────────

router.get('/tree', verifyToken, (req, res) => {
    db.query(
        `SELECT
            f.id,
            f.name,
            f.category_id,
            f.parent_folder_id,
            f.created_by,
            f.created_at,
            f.updated_at,
            c.name AS category_name,
            u.username AS created_by_username
        FROM folders f
        INNER JOIN categories c ON c.id = f.category_id
        LEFT JOIN users u ON u.id = f.created_by
        ORDER BY f.category_id ASC, f.name ASC`,
        (err, rows) => {
            if (err) {
                return res.status(500).json({ message: 'Failed to fetch folder tree', error: err.message });
            }

            const categoryMap = {};

            for (const row of rows) {
                if (!categoryMap[row.category_id]) {
                    categoryMap[row.category_id] = {
                        id: row.category_id,
                        name: row.category_name,
                        folders: []
                    };
                }
                categoryMap[row.category_id].folders.push(row);
            }

            const result = Object.values(categoryMap).map(cat => ({
                id: cat.id,
                name: cat.name,
                tree: buildTree(cat.folders)
            }));

            result.sort((a, b) => a.name.localeCompare(b.name));

            res.json(result);
        }
    );
});

// ─── GET FOLDERS BY CATEGORY ──────────────────────────────────────────────────

router.get('/by-category/:categoryId', verifyToken, (req, res) => {
    const { categoryId } = req.params;

    db.query(
        `SELECT
            f.id,
            f.name,
            f.category_id,
            f.parent_folder_id,
            f.created_by,
            f.created_at,
            f.updated_at,
            u.username AS created_by_username
        FROM folders f
        LEFT JOIN users u ON u.id = f.created_by
        WHERE f.category_id = ?
        ORDER BY f.name ASC`,
        [categoryId],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ message: 'Failed to fetch folders', error: err.message });
            }

            res.json(buildTree(rows));
        }
    );
});

// ─── GET FOLDER FILES ─────────────────────────────────────────────────────────
// Returns all documents assigned to a specific folder.
// admin/super_admin bypass permission checks.
// user role must have a matching can_view = 1 row in folder_permissions.

router.get('/:id/files', verifyToken, (req, res) => {
    const { id } = req.params;

    db.query(
        'SELECT id, name, category_id FROM folders WHERE id = ?',
        [id],
        (err, folderResult) => {
            if (err) {
                return res.status(500).json({ message: 'Failed to fetch folder', error: err.message });
            }

            if (folderResult.length === 0) {
                return res.status(404).json({ message: 'Folder not found' });
            }

            const folder = folderResult[0];
            const userRole = req.user.role;

            // admin and super_admin see all folder contents unconditionally
            if (userRole === 'admin' || userRole === 'super_admin') {
                return fetchFolderDocuments(id, folder, req, res);
            }

            // user role: verify at least one permitting row exists
            db.query(
                `SELECT can_view
                 FROM folder_permissions
                 WHERE folder_id = ?
                   AND can_view = 1
                   AND (
                     (permission_type = 'user' AND user_id = ?)
                     OR (permission_type = 'role' AND role = 'user')
                   )
                 LIMIT 1`,
                [id, req.user.id],
                (err, permResult) => {
                    if (err) {
                        return res.status(500).json({ message: 'Failed to check folder permissions', error: err.message });
                    }

                    if (permResult.length === 0) {
                        return res.status(403).json({ message: 'You do not have permission to view this folder' });
                    }

                    fetchFolderDocuments(id, folder, req, res);
                }
            );
        }
    );
});

// ─── GET FOLDER PERMISSIONS ───────────────────────────────────────────────────
// Returns current permission configuration for a folder.
// admin/super_admin only.

router.get('/:id/permissions', verifyToken, verifyAdminOrSuperAdmin, (req, res) => {
    const { id } = req.params;

    db.query(
        'SELECT id FROM folders WHERE id = ?',
        [id],
        (err, folderResult) => {
            if (err) {
                return res.status(500).json({ message: 'Failed to fetch folder', error: err.message });
            }

            if (folderResult.length === 0) {
                return res.status(404).json({ message: 'Folder not found' });
            }

            db.query(
                'SELECT permission_type, role, user_id, can_view FROM folder_permissions WHERE folder_id = ?',
                [id],
                (err, permRows) => {
                    if (err) {
                        return res.status(500).json({ message: 'Failed to fetch permissions', error: err.message });
                    }

                    // Only expose user-role accounts in the UI (admin/super_admin bypass is backend-enforced)
                    db.query(
                        `SELECT id, username, role FROM users WHERE role = 'user' ORDER BY username ASC`,
                        (err, userRows) => {
                            if (err) {
                                return res.status(500).json({ message: 'Failed to fetch users', error: err.message });
                            }

                            const role_permissions = permRows
                                .filter(p => p.permission_type === 'role')
                                .map(p => ({ role: p.role, can_view: p.can_view }));

                            const user_permissions = permRows
                                .filter(p => p.permission_type === 'user')
                                .map(p => ({ user_id: p.user_id, can_view: p.can_view }));

                            res.json({
                                role_permissions,
                                user_permissions,
                                all_users: userRows
                            });
                        }
                    );
                }
            );
        }
    );
});

// ─── UPDATE FOLDER PERMISSIONS ────────────────────────────────────────────────
// Full replace strategy: delete all existing permissions, insert submitted set.
// admin/super_admin only.

router.put('/:id/permissions', verifyToken, verifyAdminOrSuperAdmin, (req, res) => {
    const { id } = req.params;
    const { role_permissions, user_permissions } = req.body;

    if (!Array.isArray(role_permissions) || !Array.isArray(user_permissions)) {
        return res.status(400).json({ message: 'role_permissions and user_permissions must be arrays' });
    }

    db.query(
        'SELECT id FROM folders WHERE id = ?',
        [id],
        (err, folderResult) => {
            if (err) {
                return res.status(500).json({ message: 'Failed to verify folder', error: err.message });
            }

            if (folderResult.length === 0) {
                return res.status(404).json({ message: 'Folder not found' });
            }

            // Full replace: clear existing, then insert new set
            db.query(
                'DELETE FROM folder_permissions WHERE folder_id = ?',
                [id],
                (err) => {
                    if (err) {
                        return res.status(500).json({ message: 'Failed to clear existing permissions', error: err.message });
                    }

                    // Build batch insert rows
                    const insertRows = [];

                    for (const rp of role_permissions) {
                        if (rp.role && typeof rp.can_view === 'number') {
                            insertRows.push([id, 'role', rp.role, null, rp.can_view]);
                        }
                    }

                    for (const up of user_permissions) {
                        if (up.user_id && typeof up.can_view === 'number') {
                            insertRows.push([id, 'user', null, up.user_id, up.can_view]);
                        }
                    }

                    if (insertRows.length === 0) {
                        logActivity(
                            req,
                            'UPDATE_FOLDER_PERMISSIONS',
                            'Document Management',
                            `Cleared all permissions for folder ID: ${id}`
                        );
                        return res.json({ message: 'Permissions updated successfully' });
                    }

                    db.query(
                        'INSERT INTO folder_permissions (folder_id, permission_type, role, user_id, can_view) VALUES ?',
                        [insertRows],
                        (err) => {
                            if (err) {
                                return res.status(500).json({ message: 'Failed to save permissions', error: err.message });
                            }

                            logActivity(
                                req,
                                'UPDATE_FOLDER_PERMISSIONS',
                                'Document Management',
                                `Updated permissions for folder ID: ${id}`
                            );

                            res.json({ message: 'Permissions updated successfully' });
                        }
                    );
                }
            );
        }
    );
});

// ─── CREATE FOLDER ────────────────────────────────────────────────────────────

router.post('/', verifyToken, (req, res) => {
    const { name, category_id, parent_folder_id } = req.body;

    if (!name || name.trim() === '') {
        return res.status(400).json({ message: 'Folder name is required' });
    }

    if (!category_id) {
        return res.status(400).json({ message: 'Category is required' });
    }

    const trimmedName = name.trim();
    const parentId = parent_folder_id || null;

    db.query(
        'SELECT id FROM categories WHERE id = ?',
        [category_id],
        (err, catResult) => {
            if (err) {
                return res.status(500).json({ message: 'Failed to verify category', error: err.message });
            }

            if (catResult.length === 0) {
                return res.status(400).json({ message: 'Invalid category' });
            }

            if (parentId !== null) {
                db.query(
                    'SELECT id, category_id FROM folders WHERE id = ?',
                    [parentId],
                    (err, parentResult) => {
                        if (err) {
                            return res.status(500).json({ message: 'Failed to verify parent folder', error: err.message });
                        }

                        if (parentResult.length === 0) {
                            return res.status(400).json({ message: 'Parent folder not found' });
                        }

                        if (parentResult[0].category_id !== Number(category_id)) {
                            return res.status(400).json({ message: 'Parent folder must belong to the same category' });
                        }

                        getFolderDepth(parentId, (err, depth) => {
                            if (err) {
                                if (err.message.includes('Maximum folder depth')) {
                                    return res.status(400).json({ message: err.message });
                                }
                                return res.status(500).json({ message: 'Failed to calculate folder depth', error: err.message });
                            }

                            if (depth > MAX_DEPTH) {
                                return res.status(400).json({
                                    message: `Maximum folder nesting depth of ${MAX_DEPTH} exceeded`
                                });
                            }

                            insertFolder(trimmedName, category_id, parentId, req, res);
                        });
                    }
                );
            } else {
                insertFolder(trimmedName, category_id, parentId, req, res);
            }
        }
    );
});

function insertFolder(name, category_id, parent_folder_id, req, res) {
    db.query(
        `INSERT INTO folders (name, category_id, parent_folder_id, created_by)
         VALUES (?, ?, ?, ?)`,
        [name, category_id, parent_folder_id, req.user.id],
        (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({
                        message: 'A folder with this name already exists in this location'
                    });
                }
                return res.status(500).json({ message: 'Failed to create folder', error: err.message });
            }

            logActivity(
                req,
                'CREATE_FOLDER',
                'Document Management',
                `Created folder: "${name}" in category ID: ${category_id}`
            );

            res.status(201).json({
                message: 'Folder created successfully',
                folderId: result.insertId
            });
        }
    );
}

// ─── RENAME FOLDER ────────────────────────────────────────────────────────────

router.put('/:id', verifyToken, (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || name.trim() === '') {
        return res.status(400).json({ message: 'Folder name is required' });
    }

    const trimmedName = name.trim();

    db.query(
        'SELECT id, category_id, parent_folder_id FROM folders WHERE id = ?',
        [id],
        (err, result) => {
            if (err) {
                return res.status(500).json({ message: 'Failed to fetch folder', error: err.message });
            }

            if (result.length === 0) {
                return res.status(404).json({ message: 'Folder not found' });
            }

            db.query(
                `UPDATE folders SET name = ? WHERE id = ?`,
                [trimmedName, id],
                (err, updateResult) => {
                    if (err) {
                        if (err.code === 'ER_DUP_ENTRY') {
                            return res.status(409).json({
                                message: 'A folder with this name already exists in this location'
                            });
                        }
                        return res.status(500).json({ message: 'Failed to rename folder', error: err.message });
                    }

                    if (updateResult.affectedRows === 0) {
                        return res.status(404).json({ message: 'Folder not found' });
                    }

                    logActivity(
                        req,
                        'RENAME_FOLDER',
                        'Document Management',
                        `Renamed folder ID: ${id} to "${trimmedName}"`
                    );

                    res.json({ message: 'Folder renamed successfully' });
                }
            );
        }
    );
});

// ─── MOVE FOLDER ──────────────────────────────────────────────────────────────

router.put('/:id/move', verifyToken, (req, res) => {
    const { id } = req.params;
    const { parent_folder_id } = req.body;

    const newParentId = parent_folder_id === undefined ? null : parent_folder_id;

    if (newParentId !== null && Number(newParentId) === Number(id)) {
        return res.status(400).json({ message: 'A folder cannot be moved into itself' });
    }

    db.query(
        'SELECT id, category_id, parent_folder_id FROM folders WHERE id = ?',
        [id],
        (err, result) => {
            if (err) {
                return res.status(500).json({ message: 'Failed to fetch folder', error: err.message });
            }

            if (result.length === 0) {
                return res.status(404).json({ message: 'Folder not found' });
            }

            const folder = result[0];

            if (newParentId === null) {
                executeMove(id, folder.category_id, newParentId, req, res);
                return;
            }

            db.query(
                'SELECT id, category_id FROM folders WHERE id = ?',
                [newParentId],
                (err, parentResult) => {
                    if (err) {
                        return res.status(500).json({ message: 'Failed to verify target folder', error: err.message });
                    }

                    if (parentResult.length === 0) {
                        return res.status(404).json({ message: 'Target parent folder not found' });
                    }

                    if (parentResult[0].category_id !== folder.category_id) {
                        return res.status(400).json({ message: 'Cannot move folder to a different category' });
                    }

                    getAllDescendantIds(Number(id), (err, descendantIds) => {
                        if (err) {
                            return res.status(500).json({ message: 'Failed to validate folder hierarchy', error: err.message });
                        }

                        if (descendantIds.has(Number(newParentId))) {
                            return res.status(400).json({
                                message: 'Cannot move a folder into one of its own subfolders'
                            });
                        }

                        getFolderDepth(newParentId, (err, depth) => {
                            if (err) {
                                return res.status(500).json({ message: 'Failed to calculate depth', error: err.message });
                            }

                            if (depth >= MAX_DEPTH) {
                                return res.status(400).json({
                                    message: `Maximum folder nesting depth of ${MAX_DEPTH} exceeded`
                                });
                            }

                            executeMove(id, folder.category_id, newParentId, req, res);
                        });
                    });
                }
            );
        }
    );
});

function executeMove(id, categoryId, newParentId, req, res) {
    db.query(
        'UPDATE folders SET parent_folder_id = ? WHERE id = ?',
        [newParentId, id],
        (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({
                        message: 'A folder with this name already exists in the target location'
                    });
                }
                return res.status(500).json({ message: 'Failed to move folder', error: err.message });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({ message: 'Folder not found' });
            }

            logActivity(
                req,
                'MOVE_FOLDER',
                'Document Management',
                `Moved folder ID: ${id} to parent: ${newParentId ?? 'root'}`
            );

            res.json({ message: 'Folder moved successfully' });
        }
    );
}

// ─── DELETE FOLDER ────────────────────────────────────────────────────────────

router.delete('/:id', verifyToken, (req, res) => {
    const { id } = req.params;

    db.query(
        'SELECT id, name FROM folders WHERE id = ?',
        [id],
        (err, result) => {
            if (err) {
                return res.status(500).json({ message: 'Failed to fetch folder', error: err.message });
            }

            if (result.length === 0) {
                return res.status(404).json({ message: 'Folder not found' });
            }

            const folder = result[0];

            db.query(
                'SELECT COUNT(*) AS count FROM folders WHERE parent_folder_id = ?',
                [id],
                (err, childResult) => {
                    if (err) {
                        return res.status(500).json({ message: 'Failed to check child folders', error: err.message });
                    }

                    if (childResult[0].count > 0) {
                        return res.status(409).json({
                            message: 'Cannot delete folder: it contains subfolders. Please remove them first.'
                        });
                    }

                    db.query(
                        'SELECT COUNT(*) AS count FROM documents WHERE folder_id = ?',
                        [id],
                        (err, docResult) => {
                            if (err) {
                                return res.status(500).json({ message: 'Failed to check folder documents', error: err.message });
                            }

                            if (docResult[0].count > 0) {
                                return res.status(409).json({
                                    message: 'Cannot delete folder: it contains documents. Please remove or reassign them first.'
                                });
                            }

                            db.query(
                                'DELETE FROM folders WHERE id = ?',
                                [id],
                                (err) => {
                                    if (err) {
                                        return res.status(500).json({ message: 'Failed to delete folder', error: err.message });
                                    }

                                    logActivity(
                                        req,
                                        'DELETE_FOLDER',
                                        'Document Management',
                                        `Deleted folder ID: ${id}, name: "${folder.name}"`
                                    );

                                    res.json({ message: 'Folder deleted successfully' });
                                }
                            );
                        }
                    );
                }
            );
        }
    );
});

module.exports = router;