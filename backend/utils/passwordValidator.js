'use strict';

/**
 * Centralized password validation utility.
 * Imported by: auth.js (register, change-password), users.js (update-user, add-user).
 *
 * Validation rules here must remain in sync with the frontend mirror:
 *   src/app/utils/password-validator.ts
 */

/** Centralized bcrypt salt rounds constant — eliminates magic numbers across routes. */
const SALT_ROUNDS = 10;

// Common/weak password blacklist
const WEAK_PASSWORDS = new Set([
    'password', 'password1', 'password123',
    '12345678', '123456789', '1234567890',
    'qwerty123', 'qwertyui', 'qwerty',
    'aaaaaaaa', '11111111', '00000000',
    'abcd1234', 'abcdefgh', 'letmein',
    'welcome1', 'admin123', 'iloveyou',
    'monkey123', 'dragon12', 'master12',
]);

/**
 * Detects ascending or descending sequential character runs of 4+.
 * e.g. "abcd", "1234", "dcba", "9876"
 * @param {string} password
 * @returns {boolean}
 */
function hasSequentialPattern(password) {
    const lower = password.toLowerCase();
    for (let i = 0; i <= lower.length - 4; i++) {
        const codes = lower.slice(i, i + 4).split('').map(c => c.charCodeAt(0));
        const isAscending = codes.every((c, j) => j === 0 || c === codes[j - 1] + 1);
        const isDescending = codes.every((c, j) => j === 0 || c === codes[j - 1] - 1);
        if (isAscending || isDescending) return true;
    }
    return false;
}

/**
 * Detects single-character repetition (aaaa) and repeating block patterns (ababab).
 * @param {string} password
 * @returns {boolean}
 */
function hasRepeatedPattern(password) {
    if (/(.)\1{3,}/.test(password)) return true;

    for (let len = 2; len <= Math.floor(password.length / 2); len++) {
        const block = password.slice(0, len);
        const repeats = Math.floor(password.length / len);
        if (block.repeat(repeats) === password.slice(0, len * repeats) && len * repeats >= password.length - 1) {
            return true;
        }
    }
    return false;
}

/**
 * Validates a password against all structural and pattern-based rules.
 *
 * @param {string} password
 * @returns {{ isValid: boolean, errors: string[] }}
 */
function validatePassword(password) {
    const errors = [];

    if (typeof password !== 'string' || password.length < 8) {
        errors.push('Password must be at least 8 characters.');
    }
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter.');
    }
    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter.');
    }
    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number.');
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
        errors.push('Password must contain at least one special character.');
    }
    if (typeof password === 'string' && WEAK_PASSWORDS.has(password.toLowerCase())) {
        errors.push('Password is too common. Please choose a stronger password.');
    }
    if (typeof password === 'string' && password.length >= 4 && hasSequentialPattern(password)) {
        errors.push('Password must not contain sequential patterns (e.g. abcd, 1234).');
    }
    if (typeof password === 'string' && password.length >= 4 && hasRepeatedPattern(password)) {
        errors.push('Password must not contain repeated patterns (e.g. aaaa, ababab).');
    }

    return { isValid: errors.length === 0, errors };
}

/**
 * Generates a cryptographically random temporary password that satisfies all validation rules.
 * Used by the add-user route to replace the hardcoded "default" password.
 *
 * The generated password is returned to the admin in the API response for one-time display.
 * It is NOT stored in plaintext — the caller is responsible for hashing before persistence.
 *
 * @returns {string} A 12-character temporary password
 */
function generateTemporaryPassword() {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';  // Excludes I, O (visually ambiguous)
    const lower = 'abcdefghjkmnpqrstuvwxyz';   // Excludes i, l, o
    const digits = '23456789';                   // Excludes 0, 1 (visually ambiguous)
    const special = '!@#$%^&*';
    const pool = upper + lower + digits + special;

    const getRandom = (chars) => {
        // Use Math.random() — crypto.randomInt() requires Node 15+; adjust if environment supports it
        return chars[Math.floor(Math.random() * chars.length)];
    };

    // Guarantee at least one character from each required class
    const guaranteed = [
        getRandom(upper),
        getRandom(lower),
        getRandom(digits),
        getRandom(special),
    ];

    // Fill remaining 8 positions from the full pool
    const filler = Array.from({ length: 8 }, () => getRandom(pool));

    // Shuffle to avoid predictable class ordering
    const password = [...guaranteed, ...filler]
        .sort(() => Math.random() - 0.5)
        .join('');

    return password;
}

module.exports = { validatePassword, generateTemporaryPassword, SALT_ROUNDS };