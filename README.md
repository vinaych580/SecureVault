# SecureVault

SecureVault is an offline-first encrypted notes app with a React client and an Express/MongoDB API.

## What is in the repo

- `client/`: React + Vite frontend, local encrypted storage, offline unlock, background sync.
- `server/`: Express API for auth, notes, folders, tags, sync, sharing, and settings.

## Current behavior

- Notes are encrypted client-side before they are written to IndexedDB or sent to the API.
- The client works offline with a locally derived vault key.
- When the API and database are available, the client hydrates notes and folders from the server and syncs pending local changes in the background.
- If MongoDB is down, non-health API routes return `503` instead of hanging on buffered Mongoose queries.

## Quick start

### Server

```bash
cd server
npm install
copy .env.example .env
npm run dev
```

### Client

```bash
cd client
npm install
npm run dev
```

## Checks

### Server

```bash
cd server
npm test
npm run lint
```

### Client

```bash
cd client
npm run lint
npm run build
```

## Important environment variables

- `PORT`: API port. Default `5000`.
- `MONGO_URI`: MongoDB connection string.
- `CLIENT_URL`: Allowed frontend origin for CORS and email links.
- `JWT_ACCESS_SECRET`: Access-token signing secret.
- `SERVER_ENCRYPTION_KEY`: Server-side encryption key for protected fields.
- `SESSION_FINGERPRINT_SECRET`: Secret used for request fingerprinting.

## Health endpoint

- `GET /api/health` -> `{ status: "ok", uptime, timestamp, dbState }`

## Notes

- The repo was cleaned to remove older prototype files that were no longer used by the active app.
- Client production build verification is part of the current check set.
