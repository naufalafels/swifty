import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';

// NEW: Lazy-load KEY inside functions
function getKey() {
  return Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
}

/**
 * Encrypt a string.
 * @param {string} text - Plaintext to encrypt
 * @returns {string} Encrypted text (hex format)
 */
export function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted; // Store IV with encrypted data
}

/**
 * Decrypt a string.
 * @param {string} text - Encrypted text (hex format)
 * @returns {string} Decrypted plaintext
 */
export function decrypt(encryptedText) {
  const [ivHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}