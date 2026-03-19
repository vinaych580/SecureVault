// ─── Client-Side Zero-Knowledge Encryption Service ───
// Uses Web Crypto API exclusively – NO third-party crypto libraries

const PBKDF2_ITERATIONS = 100000;
const AES_KEY_LENGTH = 256;
const IV_LENGTH = 12;
const VAULT_VERIFIER_TEXT = 'securevault-verifier';

// ─── Derive a CryptoKey from password + salt ───
export async function deriveKey(password, saltHex) {
  const enc = new TextEncoder();
  const salt = hexToBytes(saltHex);
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    false, // non-extractable
    ['encrypt', 'decrypt']
  );
}

// ─── Encrypt a single field ───
export async function encryptField(vaultKey, plaintext) {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    vaultKey,
    enc.encode(plaintext)
  );
  return {
    iv: bytesToHex(iv),
    data: bytesToHex(new Uint8Array(ciphertext)),
  };
}

// ─── Decrypt a single field ───
export async function decryptField(vaultKey, encryptedObj) {
  if (!encryptedObj || !encryptedObj.iv || !encryptedObj.data) return '';
  const iv = hexToBytes(encryptedObj.iv);
  const data = hexToBytes(encryptedObj.data);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    vaultKey,
    data
  );
  return new TextDecoder().decode(decrypted);
}

// ─── Encrypt a full note object ───
export async function encryptNote(vaultKey, note) {
  const [title, content, preview] = await Promise.all([
    encryptField(vaultKey, note.title || ''),
    encryptField(vaultKey, typeof note.content === 'string' ? note.content : JSON.stringify(note.content || '')),
    encryptField(vaultKey, note.preview || ''),
  ]);

  const tags = await Promise.all(
    (note.tags || []).map((tag) => encryptField(vaultKey, tag))
  );

  const checksum = await generateChecksum(typeof note.content === 'string' ? note.content : JSON.stringify(note.content || ''));

  return { ...note, title, content, preview, tags, checksum };
}

// ─── Decrypt a full note object ───
export async function decryptNote(vaultKey, encryptedNote) {
  const [title, content, preview] = await Promise.all([
    decryptField(vaultKey, encryptedNote.title),
    decryptField(vaultKey, encryptedNote.content),
    decryptField(vaultKey, encryptedNote.preview),
  ]);

  const tags = await Promise.all(
    (encryptedNote.tags || []).map((tag) => decryptField(vaultKey, tag))
  );

  // Try parsing content as JSON (TipTap JSON)
  let parsedContent = content;
  try { parsedContent = JSON.parse(content); } catch { /* keep as string */ }

  return { ...encryptedNote, title, content: parsedContent, preview, tags };
}

// ─── SHA-256 checksum for integrity verification ───
export async function generateChecksum(text) {
  const enc = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return bytesToHex(new Uint8Array(hashBuffer));
}

// ─── Re-encrypt all notes (for password/key change) ───
export async function reEncryptAllNotes(oldKey, newKey, notes) {
  const reEncrypted = [];
  for (let i = 0; i < notes.length; i++) {
    const decrypted = await decryptNote(oldKey, notes[i]);
    const encrypted = await encryptNote(newKey, decrypted);
    reEncrypted.push(encrypted);
  }
  return reEncrypted;
}

export async function createVaultVerifier(vaultKey) {
  return encryptField(vaultKey, VAULT_VERIFIER_TEXT);
}

export async function verifyVaultVerifier(vaultKey, verifier) {
  try {
    const plaintext = await decryptField(vaultKey, verifier);
    return plaintext === VAULT_VERIFIER_TEXT;
  } catch {
    return false;
  }
}

export function generateObjectId() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return bytesToHex(bytes);
}

// ─── Hex utilities ───
function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}
