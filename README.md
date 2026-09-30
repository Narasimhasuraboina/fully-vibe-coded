# Chatforge

Chatforge is a high-speed, self-contained real-time messaging application and private relay network. It is 100% standalone: it runs on a single Express + Socket.IO server with zero external homeservers, zero third-party dependencies, and zero registration friction.

## Features

- **Instant In-App Registration & Auth**: Create accounts directly in the app in seconds. Passwords are protected using salted `scrypt` key derivation with SHA-256 fallback.
- **Standalone Socket.IO Relay**: Real-time bidirectional messaging, delivery receipts, read receipts, emoji reactions, and live typing indicators.
- **Offline Store-and-Forward Mailbox**: Messages sent to offline peers are automatically queued on the relay server and flushed instantly upon reconnect.
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

- **Server-Side Data**: Account credentials and offline mailboxes are persisted locally in `server/users_db.json` and `server/offline_mailbox.json`.
- **Client-Side Data**: Conversations and local preferences are safely isolated per user account using IndexedDB with fallback to LocalStorage.
