# SecureVault – Project Presentation

## 1. What Is SecureVault?

SecureVault is a **zero-knowledge, end-to-end encrypted note-taking web application**. Its defining promise is simple: the server stores only ciphertext and can never read user content. Notes are encrypted and decrypted exclusively inside the browser using the Web Crypto API.

### Key Facts at a Glance

| Property | Detail |
|---|---|
| Type | Offline-first, encrypted notes SPA |
| Encryption | AES-256-GCM, client-side only |
| Key derivation | PBKDF2 (100,000 iterations, SHA-256) |
| Auth | JWT access tokens + rotating httpOnly refresh tokens |
| 2FA | TOTP (authenticator apps) |
| Storage | MongoDB (server) + IndexedDB (browser) |
| Frontend | React 19 + Vite + Zustand + TipTap |
| Backend | Express 5 + Mongoose 9 |

---

## 2. Core Feature Set

### Note Management
- **Rich-text editor** powered by TipTap (ProseMirror) with support for headings, lists, checkboxes, and more.
- **Auto-save** with a 3-second debounce; notes save silently in the background.
- **Pinning, starring, archiving, and trash/restore** — a full note lifecycle.
- **Full-text search** across decrypted titles, content, and tags — entirely client-side, so the server never sees search terms.

### Organisation
- **Folders** with optional nesting (`parentId`), colour coding, and drag-to-reorder.
- **Tags** per note, colour-coded and user-scoped.

### Versioning
- Up to 10 encrypted snapshots per note.
- Users can browse history and revert to any previous version.

### Sharing
- Generate a **share link** (token-based URL) for any note.
- Optional password protection, configurable expiry (1–7 days), and maximum view count.
- The public viewer endpoint requires no authentication.

### Offline First
- The app is fully usable without a network connection.
- All edits are queued locally in IndexedDB and automatically synced to the server when connectivity is restored.

### Security Controls
- **Account lockout** after 10 failed login attempts (30-minute cooldown).
- **Audit log** tracks every sensitive event (login, logout, password change, 2FA changes, share-link creation/revocation).
- **Multi-device session management** — view and revoke individual sessions.

---

## 3. Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                       Browser                            │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │authStore │  │notesStore│  │syncStore │  │uiStore │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘  │
│         Zustand – reactive client state                  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │                   Services                         │  │
│  │  encryptionService  offlineDB  vaultSyncService    │  │
│  │        (AES-GCM)   (IndexedDB)   (delta sync)     │  │
│  │                        api (Axios + interceptors)  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  TipTap Editor · Framer Motion · React Router · Tailwind │
└──────────────────────────┬───────────────────────────────┘
                           │ HTTPS / REST
┌──────────────────────────▼───────────────────────────────┐
│                  Express API Server                       │
│                                                          │
│  Helmet → CORS → Rate Limiter → Sanitiser → Fingerprint  │
│  → JWT Auth middleware → Route handlers                  │
│                                                          │
│  /auth  /notes  /folders  /tags  /sync  /share  /settings│
│                                                          │
│  Controllers · Email service · Token service             │
│  Server-side AES-256-GCM (sensitive fields only)         │
└──────────────────────────┬───────────────────────────────┘
                           │ Mongoose ODM
┌──────────────────────────▼───────────────────────────────┐
│                      MongoDB                             │
│                                                          │
│  users  notes  folders  tags  sharelinks  refreshtokens  │
│  auditlogs  synclogs  noteversions                       │
└──────────────────────────────────────────────────────────┘
```

---

## 4. Encryption Model

### Key Derivation (PBKDF2)

```
password + pbkdf2Salt (server-provided 32-byte hex)
         │
         ▼  PBKDF2, 100,000 iterations, SHA-256
     256-bit AES-GCM CryptoKey  (vault key)
         │
         ▼
  stored only in memory — never persisted, never sent to server
```

The `pbkdf2Salt` is generated once on registration and returned on login so the browser can re-derive the same key from the user's password.

### Per-Field Encryption

Every sensitive note field (`title`, `content`, `preview`, each tag) is independently encrypted:

```
encryptField(vaultKey, plaintext)
  → generate 12-byte random IV
  → AES-256-GCM encrypt
  → return { iv: hex, data: hex }
```

Using a unique IV per field per note ensures that identical content never produces the same ciphertext (semantic security).

### Vault Verifier

On first unlock the client encrypts the constant string `"securevault-verifier"` with the vault key and stores the result. On subsequent unlocks it attempts to decrypt this blob; failure means the password is wrong. This provides fast local validation without any server round-trip.

### Server-Side Encryption (Narrow Scope)

Only specific sensitive server fields (the TOTP secret and Google OAuth tokens) are encrypted at rest using AES-256-GCM with a `SERVER_ENCRYPTION_KEY`. User notes are **never** decryptable by the server.

---

## 5. Authentication Flow

### Registration

1. User submits name, email, and password.
2. Server generates a unique `pbkdf2Salt`, hashes the password with bcrypt (cost 12), and saves the user.
3. A verification email with a 32-byte hex token (24-hour expiry) is sent.
4. The salt is returned to the client, which derives the vault key and stores it in memory.

### Login

```
User enters email + password
        │
        ▼
Server: bcrypt.compare(password, passwordHash)
  — too many failures → account locked (30 min)
        │ success
        ▼
  2FA enabled?
  ├─ yes → issue 5-min tempToken; client submits TOTP code
  └─ no  ─┐
           ▼
  Generate sessionId (16-byte hex)
  Compute fingerprint = HMAC-SHA256(User-Agent, SESSION_FINGERPRINT_SECRET)
  Issue access token  (JWT, 15-min, contains userId + sessionId + fingerprint)
  Issue refresh token (32-byte hex, httpOnly cookie, 7-day)
  Log LOGIN to AuditLog
```

### Token Refresh

1. The Axios interceptor catches any 401 with `TOKEN_EXPIRED`.
2. It sends the httpOnly refresh-token cookie to `/api/auth/refresh`.
3. The server detects token reuse (already rotated) → revokes all sessions.
4. Otherwise it rotates the refresh token, issues a new access token, and returns.
5. The interceptor retries the original request transparently.

A request queue prevents multiple concurrent refreshes.

---

## 6. Offline-First & Sync

### Local Storage (IndexedDB)

Database `securevault` (version 3) holds two object stores:

| Store | Indexes |
|---|---|
| `notes` | `userId`, `folderId`, `syncStatus`, `lastModified` |
| `folders` | `userId` |

Every note record carries a `syncStatus`:

| Value | Meaning |
|---|---|
| `synced` | Matches server |
| `pending_create` | Local note not yet pushed |
| `pending_update` | Local edit waiting to sync |
| `pending_delete` | Marked for deletion |

### Vault Hydration (Initial Load)

On login or page reload the client fetches all remote notes and folders (paginated, 200 per page) and merges them with IndexedDB:

- Pending local changes are **not overwritten** by server data.
- Notes present locally but deleted remotely are removed.
- New server notes are inserted locally.

### Delta Sync

`POST /api/sync/delta` exchanges only changed notes:

```
Client sends:
  modifications: [{ id, version, title, content, tags, …, checksum }]

Server checks:
  existing.version > delta.version  →  conflict
  otherwise                         →  save and respond with { status: 'synced' }

Response:
  { successes: […], conflicts: [{noteId, serverData, localVersion, serverVersion}] }
```

Conflicts are surfaced in the UI with a choice to keep the local version, use the server version, or merge manually.

Sync triggers: app start, `online` event, every ~15 seconds if there are pending changes, and manual button press.

---

## 7. Data Models

| Model | Purpose | Notable Fields |
|---|---|---|
| `User` | Account & settings | `pbkdf2Salt`, `passwordHash`, `twoFASecret` (encrypted), login lockout fields, `settings` sub-document |
| `Note` | Encrypted content | `title`, `content`, `preview` (all `{iv, data}`), `checksum`, `version`, `syncStatus` |
| `Folder` | Organisation | `name` (encrypted), `parentId`, `color`, `order` |
| `Tag` | Labels | `name` (encrypted), `color` |
| `ShareLink` | Public sharing | `tokenHash`, `encryptedContent`, optional `passwordHash`, `expiresAt` (TTL), `viewCount` |
| `NoteVersion` | History snapshots | `version`, `title` + `content` (encrypted); capped at 10 per note |
| `RefreshToken` | Session tokens | `tokenHash`, `sessionId`, `isRotated`, `expiresAt` (TTL) |
| `AuditLog` | Security events | `event`, `ipAddress`, `userAgent`, `metadata`; pruned to last 100 per user |
| `SyncLog` | Sync telemetry | `operation`, `status`, `notesAffected`, `conflictsFound`, `duration` |

---

## 8. Security Layers

| Layer | Mechanism |
|---|---|
| Transport | HTTPS enforced; HSTS via Helmet |
| Headers | CSP, X-Frame-Options, X-Content-Type-Options (Helmet) |
| Input | Manual `$`/`.` stripping (NoSQL injection); 1 MB body limit |
| Rate limiting | Per-endpoint (5 registrations/hr, 10 logins/15 min, etc.) + 500 req/15 min global |
| Authentication | JWT (15 min) + rotating httpOnly refresh tokens (7 days) |
| Session binding | HMAC fingerprint of User-Agent; mismatch = 401 |
| Token reuse | Rotation strategy; reuse detected = all sessions revoked |
| CSRF | `SameSite=Strict` on cookie |
| XSS | CSP; refresh token in httpOnly cookie (unreachable by JS) |
| 2FA | TOTP (RFC 6238) + bcrypt-hashed backup codes |
| Password storage | bcrypt (cost 12) |
| Key derivation | PBKDF2 (100,000 iterations) |
| Data encryption | AES-256-GCM, per-field random IVs; zero-knowledge |
| Account lockout | 10 failures → 30-minute freeze |
| Audit trail | All sensitive events logged with IP and User-Agent |

---

## 9. Tech Stack Summary

### Frontend

| Library | Role |
|---|---|
| React 19 | UI component framework |
| Vite 8 | Build tool & dev server |
| Zustand 5 | Lightweight global state |
| TipTap 3 (ProseMirror) | Rich-text editor |
| Axios 1 | HTTP client with interceptors |
| idb 8 | Promisified IndexedDB wrapper |
| Framer Motion 12 | Animations |
| React Router DOM 7 | Client-side routing |
| Tailwind CSS 3 | Utility-first CSS |
| Zod 4 | Schema & form validation |
| date-fns 4 | Date formatting |
| diff-match-patch | Text diff/merge for conflicts |
| Lucide React | Icon set |

### Backend

| Library | Role |
|---|---|
| Express 5 | HTTP framework |
| Mongoose 9 / MongoDB | Database & ODM |
| jsonwebtoken 9 | JWT signing & verification |
| bcrypt 6 | Password & backup-code hashing |
| Helmet 8 | Security headers |
| express-rate-limit 8 | Rate limiting |
| cookie-parser | httpOnly cookie support |
| Nodemailer 8 | Transactional email |
| otplib 13 | TOTP 2FA |
| qrcode | QR code generation for 2FA setup |
| express-validator 7 | Request validation |
| Morgan | HTTP request logging |
| Node.js `crypto` | Server-side AES-256-GCM |

### Tooling

| Tool | Role |
|---|---|
| ESLint 9/10 | Linting (client & server) |
| Jest 30 + Supertest | Backend tests |
| Vitest 4 | Frontend tests |
| Nodemon | Dev auto-reload |

---

## 10. Running the Project

### Prerequisites

- Node.js 20+
- MongoDB (local or Atlas)

### Server

```bash
cd server
npm install
cp .env.example .env   # fill in secrets
npm run dev
```

### Client

```bash
cd client
npm install
npm run dev
```

### Health check

```
GET /api/health
→ { status: "ok", uptime, timestamp, dbState }
```

### Key environment variables

| Variable | Purpose |
|---|---|
| `PORT` | API port (default `5000`) |
| `MONGO_URI` | MongoDB connection string |
| `CLIENT_URL` | Frontend origin for CORS and email links |
| `JWT_ACCESS_SECRET` | Access-token signing secret |
| `SERVER_ENCRYPTION_KEY` | Server-side AES-256-GCM key |
| `SESSION_FINGERPRINT_SECRET` | HMAC key for session binding |

---

## 11. Presentation Talking Points

1. **Privacy guarantee** — The server is architecturally incapable of reading user notes. Encryption happens in the browser using the Web Crypto API; the server only ever sees ciphertext.

2. **Offline resilience** — The app works with no internet. Notes are written to IndexedDB, and changes sync transparently when the device comes back online.

3. **Defence in depth** — Security is layered: AES-256-GCM client encryption + bcrypt passwords + JWT with rotation + session fingerprinting + rate limiting + audit logs + 2FA.

4. **Modern, maintainable stack** — React 19, Vite, Zustand, Tailwind on the front; Express 5 and Mongoose on the back. No legacy or deprecated libraries.

5. **Zero-knowledge sharing** — Share links expose only the encrypted payload; recipients viewing a password-protected link must supply the correct key. The server cannot access the content.

6. **Conflict resolution** — The delta sync protocol detects version conflicts and lets users choose how to resolve them, preventing silent data loss.

7. **Extensibility** — Folder hierarchy, tagging, versioning, Google Drive integration hooks, and settings are all already modelled; the architecture supports adding new features without breaking the security model.
