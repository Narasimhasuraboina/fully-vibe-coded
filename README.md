# Chatforge

Chatforge is a self-hosted real-time messaging application with an Express + Socket.IO relay. It does not require an external homeserver or a third-party messaging service; the project uses standard npm dependencies.

## Features

- **Instant In-App Registration & Auth**: Create accounts directly in the app in seconds. Passwords are protected using salted `scrypt` key derivation with SHA-256 fallback for legacy accounts. New passwords must be at least 10 characters.
- **Standalone Socket.IO Relay**: Real-time bidirectional messaging, delivery receipts, read receipts, emoji reactions, and live typing indicators.
- **Offline Store-and-Forward Mailbox**: Messages sent to offline peers are queued on the relay server and removed from the mailbox only after the client acknowledges receipt.
- **Operator Codename Directory**: Instant lookup and direct chat creation by `@username` without directory leakage.
- **12 Cyberpunk Themes**: Matrix Rain, Cyberpunk 2077, Synthwave Neon, Dark Ops, Blade Runner, Hacker Terminal, Solar Flare, Void Purple, and more.
- **Media & Attachment Support**: Full support for images, code snippets with syntax highlighting, voice notes, and file payloads.
- **Disappearing / Shredded Messages**: Ephemeral self-destructing payloads with countdown animations.
- **Mass Broadcast & Scheduled Dispatcher**: Broadcast messages across multiple nodes or queue scheduled transmissions.
- **Audio Synthesizer & FX**: Custom synthesized notification chimes, read ticks, alarm glitch sounds, and mute controls.

## Requirements

- Node.js 22.12 or newer
- npm

## Quick Start (Development)

Clone the repository and install dependencies:

```sh
npm install
npm run dev
```

- **Frontend (Vite)**: `http://localhost:5173`
- **Backend Relay (Express + Socket.IO)**: `http://localhost:3001`
- Dev server uses `node --watch` to automatically restart whenever server files change.

## Production Build & Run

Build the optimized client bundle and start the production server:

```sh
npm run build
npm start
```

In production mode, the Express server serves both the Socket.IO relay and the optimized SPA from the `dist/` directory on a single port (default `3001` or `process.env.PORT`).

## Verification & Checks

Run the linter and production build:

```sh
npm run lint    # Runs oxlint across all source files
npm run build   # Produces optimized static assets (<350 kB total)
```

## REST Health & Info Endpoints

- `GET /healthz` - Returns `OK` for load balancer and uptime monitoring.
- `GET /api/info` - Returns live relay status, active online node count, total registered accounts, and relay port.

## Storage Architecture

- **Server-Side Data**: Accounts and offline mailboxes are stored under `DATA_DIR` (default `data/`), using SQLite with JSON mirrors/fallbacks. Keep this directory private and backed up.
- **Client-Side Data**: Conversations and local preferences are isolated per account using IndexedDB with LocalStorage fallback.
- **Cross-origin setup**: Add the exact browser origin to `ALLOWED_ORIGINS` when hosting the frontend separately. Same-origin production hosting needs no additional origin entry.

Runtime account and mailbox files are local data and are excluded from version control. Existing credentials exposed in earlier repository history should be rotated.
