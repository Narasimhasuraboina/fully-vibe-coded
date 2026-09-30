# Chatforge

Chatforge is a browser-based Matrix client with a custom chat interface. It uses the maintained Matrix JavaScript SDK and Rust/WebAssembly crypto implementation for encrypted direct rooms, encrypted file attachments, device crypto storage, and password-derived server-side key backup. The Express process serves the static app and health endpoint; it does not receive chat messages or account passwords.

## Requirements

- Node.js 22.12 or newer and npm
- A Matrix homeserver that permits account registration, directory lookup, encrypted rooms, and media upload

## Local development

```sh
npm ci
npm run dev
```

Vite serves the client at `http://localhost:5173`; Express serves the production build and health endpoint at `http://localhost:3001`. The default homeserver is `https://matrix.org`. Build and lint with:

```sh
npm run build
npm run lint
```

## Matrix account and encryption behavior

- Chatforge account registration and sign-in use the selected Matrix homeserver. On the public Matrix homeserver, registration may require human verification or may be unavailable; use an existing Matrix account if so.
- New direct rooms are created with Matrix Megolm encryption. The Matrix SDK stores device crypto state in browser IndexedDB and encrypts attachments before uploading them.
- Secret storage and room-key backup use the Matrix SDK. Chatforge derives the backup key from the account password using the homeserver-provided salt and iteration parameters; the homeserver stores encrypted backup material, never the derived secret-storage key.
- Account access tokens are stored in browser local storage to keep the user signed in. A device compromise or malicious browser code can access a signed-in session and decrypted messages.
- Message and room metadata (accounts, room membership, timing, IP address, and encrypted media size) remain visible to the homeserver. Verify the other person's Matrix device before relying on their identity; the UI does not yet provide a guided device-verification flow.
- Existing Chatforge relay accounts and histories are not automatically migrated to Matrix. Their old local histories remain in that browser's IndexedDB. The obsolete plaintext relay protocol has been removed from the server code.

## Production deployment

Build and serve the client:

```sh
npm ci
npm run build
npm start
```

Set `NODE_ENV=production`, serve Chatforge over HTTPS, and set `PORT` if the hosting provider requires it. For a non-default Matrix homeserver, set both `MATRIX_HOMESERVER_URL` (server CSP) and `VITE_MATRIX_HOMESERVER_URL` (client build) to its HTTPS base URL. These values must match. Rebuild after changing the `VITE_` value.

The free `matrix.org` option avoids operating your own homeserver but places encrypted messages, key-backup blobs, and account metadata on a third-party service. Self-hosting Synapse is free software, but requires an always-on host with persistent storage and a domain or stable HTTPS endpoint. Public Matrix registration and directory policies are controlled by that homeserver and can change.

## Health

- `GET /healthz` returns `OK` for platform health checks.
- The production Content Security Policy allows connections only to the configured homeserver, plus the app's own origin.
