/**
 * Baileys WhatsApp Gateway
 * ─────────────────────────
 * Run as a persistent long-lived process:
 *   node baileys/gateway.mjs
 *
 * Connects to WhatsApp using a normal account (NOT Business API).
 * Session saved to ./baileys/session/ — scan QR only once.
 *
 * HTTP endpoints (port 3001 by default):
 *   GET  /status          → { connected, phone, hasQR }
 *   GET  /groups          → { groups: [{id,name,participants}], total }
 *   POST /send-group      → { groupId, message } → { success, messageId }
 *   POST /send-individual → { phone, message }   → { success, messageId }
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import { fileURLToPath } from 'url';
import path from 'path';
import http from 'http';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Baileys (CommonJS) ────────────────────────────────────────────────────────
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  isJidGroup,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');

// ── Config ────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.BAILEYS_PORT || '3001', 10);
const SESSION_DIR = path.join(__dirname, 'session');
const GATEWAY_SECRET = process.env.BAILEYS_GATEWAY_SECRET || 'baileys-local-secret';

if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

// ── State ─────────────────────────────────────────────────────────────────────
let sock = null;
let isConnected = false;
let currentPhone = null;
let latestQR = null;

// ── Start / reconnect ─────────────────────────────────────────────────────────
async function startBaileys() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  console.log(`[Baileys] Using WhatsApp v${version.join('.')}`);

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    browser: ['WhatsApp Reminder Bot', 'Chrome', '1.0.0'],
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 10000,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      latestQR = qr;
      console.log('\n[Baileys] ─────────────────────────────────────────────────');
      console.log('[Baileys] Scan the QR code above with WhatsApp:');
      console.log('[Baileys] Settings → Linked Devices → Link a Device');
      console.log('[Baileys] ─────────────────────────────────────────────────\n');
    }

    if (connection === 'open') {
      isConnected = true;
      latestQR = null;
      currentPhone = sock.user?.id?.split(':')[0] || 'Unknown';
      console.log(`\n[Baileys] ✅ Connected as ${currentPhone}`);
    }

    if (connection === 'close') {
      isConnected = false;
      const code = (lastDisconnect?.error instanceof Boom)
        ? lastDisconnect.error.output?.statusCode
        : null;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      console.log(`[Baileys] Connection closed (code=${code}). Reconnect: ${shouldReconnect}`);
      if (shouldReconnect) setTimeout(startBaileys, 5000);
      else console.log('[Baileys] Logged out. Delete ./baileys/session/ and restart.');
    }
  });
}

// ── Group listing ─────────────────────────────────────────────────────────────
async function getGroups() {
  if (!sock) throw new Error('Socket not initialized');
  // groupFetchAllParticipating works on v6+ and v7-rc
  const all = await sock.groupFetchAllParticipating();
  return Object.values(all).map(g => ({
    id: g.id,
    name: g.subject || g.id,
    participants: g.participants?.length || 0,
  })).sort((a, b) => a.name.localeCompare(b.name));
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { reject(e); }
    });
  });
}

function json(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function checkAuth(req, res) {
  if (req.headers['x-gateway-secret'] !== GATEWAY_SECRET) {
    json(res, 401, { error: 'Unauthorized' });
    return false;
  }
  return true;
}

// ── HTTP Server ───────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // GET /status
  if (req.method === 'GET' && url.pathname === '/status') {
    return json(res, 200, { connected: isConnected, phone: currentPhone, hasQR: !!latestQR });
  }

  // GET /qr
  if (req.method === 'GET' && url.pathname === '/qr') {
    if (!checkAuth(req, res)) return;
    return json(res, 200, { qr: latestQR || null });
  }

  // GET /groups
  if (req.method === 'GET' && url.pathname === '/groups') {
    if (!checkAuth(req, res)) return;
    if (!isConnected) return json(res, 503, { error: 'Not connected to WhatsApp yet.' });
    try {
      const groups = await getGroups();
      return json(res, 200, { groups, total: groups.length });
    } catch (err) {
      console.error('[Baileys] /groups error:', err.message);
      return json(res, 500, { error: err.message });
    }
  }

  // POST /send-group
  if (req.method === 'POST' && url.pathname === '/send-group') {
    if (!checkAuth(req, res)) return;
    if (!isConnected) return json(res, 503, { error: 'Not connected to WhatsApp yet.' });
    try {
      const body = await parseBody(req);
      const { groupId, message } = body;

      if (!groupId || !message) {
        return json(res, 400, { error: '"groupId" and "message" are required.' });
      }
      if (!groupId.endsWith('@g.us')) {
        return json(res, 400, { error: `Invalid groupId "${groupId}" — must end with @g.us` });
      }

      console.log(`[Baileys] → Sending to group ${groupId}:\n${message}\n`);
      const sent = await sock.sendMessage(groupId, { text: message });
      const messageId = sent?.key?.id;
      if (!messageId) throw new Error('No message ID returned from WhatsApp');

      console.log(`[Baileys] ✅ Group message sent: ${messageId}`);
      return json(res, 200, { success: true, messageId });
    } catch (err) {
      console.error('[Baileys] /send-group error:', err.message);
      return json(res, 500, { error: err.message });
    }
  }

  // POST /send-individual
  if (req.method === 'POST' && url.pathname === '/send-individual') {
    if (!checkAuth(req, res)) return;
    if (!isConnected) return json(res, 503, { error: 'Not connected to WhatsApp yet.' });
    try {
      const body = await parseBody(req);
      let { phone, message } = body;

      if (!phone || !message) return json(res, 400, { error: '"phone" and "message" are required.' });

      phone = phone.replace(/\D/g, '');
      const jid = `${phone}@s.whatsapp.net`;

      console.log(`[Baileys] → Sending individual to ${jid}`);
      const sent = await sock.sendMessage(jid, { text: message });
      const messageId = sent?.key?.id;
      console.log(`[Baileys] ✅ Individual message sent: ${messageId}`);
      return json(res, 200, { success: true, messageId });
    } catch (err) {
      console.error('[Baileys] /send-individual error:', err.message);
      return json(res, 500, { error: err.message });
    }
  }

  json(res, 404, { error: `Unknown route: ${req.method} ${url.pathname}` });
});

server.listen(PORT, () => {
  console.log(`\n[Baileys Gateway] HTTP server ready → http://localhost:${PORT}`);
  console.log(`[Baileys Gateway] Secret header: x-gateway-secret: ${GATEWAY_SECRET}\n`);
});

startBaileys().catch(err => {
  console.error('[Baileys] Fatal startup error:', err);
  process.exit(1);
});
