import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { io as createSocket } from 'socket.io-client';
import test from 'node:test';

async function getFreePort() {
  const probe = net.createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const { port } = probe.address();
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return port;
}

function emitAck(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket.timeout(4000).emit(event, payload, (error, response) => {
      if (error) reject(error);
      else resolve(response);
    });
  });
}

async function connectSocket(url) {
  const socket = createSocket(url, { transports: ['websocket'], reconnection: false, timeout: 4000 });
  await once(socket, 'connect');
  return socket;
}

test('relay enforces authentication, session tokens, and message participant boundaries', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'chatforge-audit-'));
  const port = await getFreePort();
  const child = spawn(process.execPath, ['server/server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const sockets = [];
  let output = '';
  child.stdout.setEncoding('utf8').on('data', (chunk) => { output += chunk; });
  child.stderr.setEncoding('utf8').on('data', (chunk) => { output += chunk; });

  const closeSocket = (socket) => {
    if (socket?.connected) socket.disconnect();
  };

  try {
    const baseUrl = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      if (child.exitCode !== null) throw new Error(`Server exited early:\n${output}`);
      try {
        const response = await fetch(`${baseUrl}/healthz`);
        if (response.ok) { ready = true; break; }
      } catch { /* server is still starting */ }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(ready, true, `Server failed to start:\n${output}`);
    const infoResponse = await fetch(`${baseUrl}/api/info`);
    assert.equal(infoResponse.status, 200);
    assert.equal((await infoResponse.json()).status, 'online');
    const contentSecurityPolicy = infoResponse.headers.get('content-security-policy');
    assert.match(contentSecurityPolicy, /script-src 'self'/);
    assert.doesNotMatch(contentSecurityPolicy, /script-src[^;]*(unsafe-eval|unsafe-inline)/);
    const allowedOriginResponse = await fetch(`${baseUrl}/api/info`, {
      headers: { origin: 'http://localhost:5173' },
    });
    assert.equal(allowedOriginResponse.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    const untrustedOriginResponse = await fetch(`${baseUrl}/api/info`, {
      headers: { origin: 'https://untrusted.example' },
    });
    assert.equal(untrustedOriginResponse.headers.get('access-control-allow-origin'), null);

    const unauthenticated = await connectSocket(baseUrl);
    sockets.push(unauthenticated);
    unauthenticated.emit('typing', null);
    unauthenticated.emit('message_read', null);
    unauthenticated.emit('message_delivered', null);
    unauthenticated.emit('message_reaction', null);
    unauthenticated.emit('delete_message', null);
    unauthenticated.emit('message_shredded', null);
    unauthenticated.emit('set_disappearing_timer', null);
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal((await fetch(`${baseUrl}/healthz`)).status, 200);
    const unauthorizedSearch = await emitAck(unauthenticated, 'search_users', 'alice');
    assert.equal(unauthorizedSearch.success, false);
    assert.equal(unauthorizedSearch.error, 'Authentication required.');
    const unauthorizedSend = await emitAck(unauthenticated, 'send_message', {
      recipientTag: '@bob', message: { id: 'spoofed', text: 'spoofed' },
    });
    assert.equal(unauthorizedSend.success, false);
    const weakRegistration = await emitAck(unauthenticated, 'authenticate_user', {
      username: 'weakpass', password: 'short', isRegisterMode: true,
    });
    assert.equal(weakRegistration.success, false);
    assert.equal((await emitAck(unauthenticated, 'resume_session', { tag: '@alice' })).success, false);

    const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    const aliceTag = `alice${suffix}`;
    const bobTag = `bob${suffix}`;
    const alice = await connectSocket(baseUrl);
    const bob = await connectSocket(baseUrl);
    sockets.push(alice, bob);
    const aliceAuth = await emitAck(alice, 'authenticate_user', {
      username: aliceTag, password: 'correct horse battery staple', isRegisterMode: true,
    });
    const bobAuth = await emitAck(bob, 'authenticate_user', {
      username: bobTag, password: 'correct battery staple', isRegisterMode: true,
    });
    assert.equal(aliceAuth.success, true, JSON.stringify(aliceAuth));
    assert.equal(bobAuth.success, true);

    const received = new Promise((resolve) => bob.once('receive_message', (data, acknowledge) => { acknowledge?.({ received: true }); resolve(data); }));
    const deliveryConfirmed = new Promise((resolve) => {
      const onStatus = (data) => {
        if (data.status === 'delivered') { alice.off('message_status_update', onStatus); resolve(data); }
      };
      alice.on('message_status_update', onStatus);
    });
    const sent = await emitAck(alice, 'send_message', {
      recipientTag: `@${bobTag}`, message: { id: `msg_audit_${suffix}`, text: 'hello', senderTag: '@mallory' },
    });
    assert.equal(sent.status, 'queued');
    const delivery = await received;
    assert.equal(delivery.senderTag, `@${aliceTag}`);
    assert.equal(delivery.message.senderTag, `@${aliceTag}`);
    assert.equal((await deliveryConfirmed).status, 'delivered');

    const statusUpdate = new Promise((resolve) => alice.once('message_status_update', resolve));
    bob.emit('message_read', { messageId: `msg_audit_${suffix}`, recipientTag: `@${aliceTag}` });
    assert.equal((await statusUpdate).status, 'read');

    let unauthorizedMutationReceived = false;
    alice.once('message_deleted', () => { unauthorizedMutationReceived = true; });
    bob.emit('delete_message', { messageId: `msg_audit_${suffix}`, recipientTag: `@${aliceTag}` });
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(unauthorizedMutationReceived, false);

    bob.disconnect();
    const offlineMessageId = `msg_offline_${suffix}`;
    const offlineSent = await emitAck(alice, 'send_message', {
      recipientTag: `@${bobTag}`, message: { id: offlineMessageId, text: 'delivered after reconnect' },
    });
    assert.equal(offlineSent.status, 'queued');
    const bobReconnect = await connectSocket(baseUrl);
    sockets.push(bobReconnect);
    const flushedMessage = new Promise((resolve) => bobReconnect.once('receive_message', (data, acknowledge) => {
      acknowledge?.({ received: true });
      resolve(data);
    }));
    const resumed = await emitAck(bobReconnect, 'resume_session', {
      tag: `@${bobTag}`, sessionToken: bobAuth.sessionToken,
    });
    assert.equal(resumed.success, true);
    assert.equal((await flushedMessage).message.id, offlineMessageId);

    const resumedWithoutToken = await connectSocket(baseUrl);
    sockets.push(resumedWithoutToken);
    const resumeResult = await emitAck(resumedWithoutToken, 'resume_session', { tag: `@${aliceTag}` });
    assert.equal(resumeResult.success, false);
  } finally {
    sockets.forEach(closeSocket);
    child.kill('SIGTERM');
    await Promise.race([once(child, 'exit'), new Promise((resolve) => setTimeout(resolve, 2500))]);
    if (child.exitCode === null) child.kill('SIGKILL');
    await rm(dataDir, { recursive: true, force: true });
  }
});
