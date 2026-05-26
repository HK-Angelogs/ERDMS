/**
 * Centralized password validation utility.
 * Mirrors backend rules in backend/utils/passwordValidator.js.
 * Must remain in sync with backend validation logic.
 */

export interface PasswordValidationResult {
    isValid: boolean;
    errors: string[];
}

export interface PasswordRequirement {
    label: string;
    met: boolean;
}

// Identical blacklist to backend/utils/passwordValidator.js
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
 */
function hasSequentialPattern(password: string): boolean {
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
 * Detects single-character repetition (aaaa) and repeating block patterns (ababab, abcabc).
 */
function hasRepeatedPattern(password: string): boolean {
    // Single char repeated 4+ times: aaaa, 1111
    if (/(.)\1{3,}/.test(password)) return true;

    // Repeating block pattern: abababab, abcabcabc
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
 * Validates a password against structural and pattern-based rules.
 * Returns { isValid, errors[] }.
 */
export function validatePassword(password: string): PasswordValidationResult {
    const errors: string[] = [];

    if (!password || password.length < 8) {
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
    if (password && WEAK_PASSWORDS.has(password.toLowerCase())) {
        errors.push('Password is too common. Please choose a stronger password.');
    }
    if (password && hasSequentialPattern(password)) {
        errors.push('Password must not contain sequential patterns (e.g. abcd, 1234).');
    }
    if (password && hasRepeatedPattern(password)) {
        errors.push('Password must not contain repeated patterns (e.g. aaaa, ababab).');
    }

    return { isValid: errors.length === 0, errors };
}

/**
 * Returns a structured checklist of individual password requirements for UI rendering.
 * Suitable for a live requirements checklist (✓ / ✗ per rule).
 */
export function getPasswordRequirements(password: string): PasswordRequirement[] {
    return [
        { label: 'At least 8 characters', met: password.length >= 8 },
        { label: 'One uppercase letter (A–Z)', met: /[A-Z]/.test(password) },
        { label: 'One lowercase letter (a–z)', met: /[a-z]/.test(password) },
        { label: 'One number (0–9)', met: /[0-9]/.test(password) },
        { label: 'One special character (!@#…)', met: /[^A-Za-z0-9]/.test(password) },
        {
            label: 'No sequential patterns',
            met: password.length > 0 && !hasSequentialPattern(password),
        },
        {
            label: 'No repeated patterns',
            met: password.length > 0 && !hasRepeatedPattern(password),
        },
        {
            label: 'Not a commonly used password',
            met: password.length > 0 && !WEAK_PASSWORDS.has(password.toLowerCase()),
        },
    ];
}