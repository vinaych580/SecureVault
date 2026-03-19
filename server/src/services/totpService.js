const crypto = require('crypto');

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const DEFAULT_DIGITS = 6;
const DEFAULT_PERIOD = 30;
const DEFAULT_WINDOW = 1;

const encodeBase32 = (buffer) => {
  let bits = '';
  let output = '';

  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, '0');
  }

  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0');
    output += BASE32_ALPHABET[parseInt(chunk, 2)];
  }

  return output;
};

const decodeBase32 = (value) => {
  const normalized = (value || '').toUpperCase().replace(/=+$/g, '').replace(/[^A-Z2-7]/g, '');
  let bits = '';

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error('Invalid base32 secret');
    }
    bits += index.toString(2).padStart(5, '0');
  }

  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }

  return Buffer.from(bytes);
};

const hotp = (secret, counter, digits = DEFAULT_DIGITS) => {
  const secretBuffer = decodeBase32(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', secretBuffer).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  ) % (10 ** digits);

  return String(code).padStart(digits, '0');
};

const generateSecret = (size = 20) => encodeBase32(crypto.randomBytes(size));

const verifyToken = ({ secret, token, window = DEFAULT_WINDOW, period = DEFAULT_PERIOD, digits = DEFAULT_DIGITS }) => {
  if (!secret || !token) {
    return false;
  }

  const normalizedToken = String(token).trim();
  if (!/^\d+$/.test(normalizedToken)) {
    return false;
  }

  const counter = Math.floor(Date.now() / 1000 / period);
  for (let offset = -window; offset <= window; offset += 1) {
    if (hotp(secret, counter + offset, digits) === normalizedToken) {
      return true;
    }
  }

  return false;
};

const generateURI = ({ issuer, label, secret, digits = DEFAULT_DIGITS, period = DEFAULT_PERIOD }) => {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedLabel = encodeURIComponent(label);

  return `otpauth://totp/${encodedIssuer}:${encodedLabel}?secret=${secret}&issuer=${encodedIssuer}&digits=${digits}&period=${period}`;
};

module.exports = { generateSecret, verifyToken, generateURI };
