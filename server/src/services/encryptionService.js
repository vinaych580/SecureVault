const crypto = require('crypto');
const { SERVER_ENCRYPTION_KEY } = require('../config/env');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

// Derive a 32-byte key from the SERVER_ENCRYPTION_KEY string
const getKeyBuffer = () => {
  return crypto.createHash('sha256').update(SERVER_ENCRYPTION_KEY).digest();
};

const encrypt = (plaintext) => {
  const key = getKeyBuffer();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return { iv: iv.toString('hex'), data: encrypted, tag: authTag };
};

const decrypt = (encryptedObj) => {
  const key = getKeyBuffer();
  const iv = Buffer.from(encryptedObj.iv, 'hex');
  const authTag = Buffer.from(encryptedObj.tag, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedObj.data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

// For double-encrypting client blobs before storing in MongoDB
const encryptBlob = (clientEncryptedObj) => {
  const serialized = JSON.stringify(clientEncryptedObj);
  return encrypt(serialized);
};

const decryptBlob = (serverEncryptedObj) => {
  const serialized = decrypt(serverEncryptedObj);
  return JSON.parse(serialized);
};

module.exports = { encrypt, decrypt, encryptBlob, decryptBlob };
