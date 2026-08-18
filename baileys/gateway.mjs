/**
 * Baileys WhatsApp Gateway
 * ─────────────────────────
 * Run this as a long-lived process:
 *   node baileys/gateway.mjs
 *
 * It:
 *  1. Connects to WhatsApp (normal account — NOT Business API)
 *  2. Shows a QR code in terminal on first run; session is saved to
 *     ./baileys/session/ so you only scan once.
 *  3. Exposes a tiny HTTP server on port 3001 (configurable via PORT env var)
 *     so Next.js API routes can send commands to it.
 *
 * Endpoints:
 *   GET  /status          → { connected: true|false, phone: "..." }
 *   GET  /groups          → [ { id, name, participants }, ... ]
 *   POST /send-group      → body: { groupId, message } → { success, messageId }
 *   POST /send-individual → body: { phone, message }  → { success, messageId }
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import { fileURLToPath } from 'url';
import path from 'path';
import http from 'http';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Dynamic imports for Baileys (CommonJS package) ────────────────────────────
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');

// ── Config ────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.BAILEYS_PORT || '3001', 10);
const SESSION_DIR = path.join(__dirname, 'session');
const GATEWAY_SECRET = process.env.BAILEYS_GATEWAY_SECRET || 'baileys-local-secret';

if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

// ── In-memory store (keeps chats / messages in RAM) ──────────────────────────
const store = makeInMemoryStore({ logger: pino({ level: 'silent' }) });

// ── Global state ──────────────────────────────────────────────────────────────
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
    logger: pino({ level: 'silent' }),   // set 'debug' for verbose logs
    printQRInTerminal: true,              // also prints in terminal for easy scanning
    browser: ['WhatsApp Reminder Bot', 'Chrome', '1.0.0'],
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 10000,
  });

  store.bind(sock.ev);

  // Save credentials whenever they update
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      latestQR = qr;
      console.log('\n[Baileys] ──────────────────────────────────────────');
      console.log('[Baileys] Scan the QR code above with your WhatsApp.');
      console.log('[Baileys] (Settings → Linked Devices → Link a Device)');
      console.log('[Baileys] ──────────────────────────────────────────\n');
    }

    if (connection === 'open') {
      isConnected = true;
      latestQR = null;
      currentPhone = sock.user?.id?.split(':')[0] || 'Unknown';
      console.log(`[Baileys] ✅ Connected as ${currentPhone}`);
    }

    if (connection === 'close') {
      isConnected = false;
      const code = (lastDisconnect?.error instanceof Boom)
        ? lastDisconnect.error.output?.statusCode
        : null;
      const shouldReconnect = code !== DisconnectReason.loggedOut;

      console.log(`[Baileys] Connection closed (code=${code}). Reconnect: ${shouldReconnect}`);
      if (shouldReconnect) {
        setTimeout(startBaileys, 5000);
      } else {
        console.log('[Baileys] Logged out. Delete ./baileys/session/ and restart to re-link.');
      }
    }
  });
}

// ── HTTP Gateway Server ───────────────────────────────────────────────────────
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
  const auth = req.headers['x-gateway-secret'];
  if (auth !== GATEWAY_SECRET) {
    json(res, 401, { error: 'Unauthorized: invalid x-gateway-secret header' });
    return false;
  }
  return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // ─ GET /status ─────────────────────────────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/status') {
    return json(res, 200, {
      connected: isConnected,
      phone: currentPhone,
      hasQR: !!latestQR,
    });
  }

  // ─ GET /qr ─────────────────────────────────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/qr') {
    if (!checkAuth(req, res)) return;
    if (!latestQR) return json(res, 200, { qr: null, message: 'No QR pending — already connected or not yet generated.' });
    return json(res, 200, { qr: latestQR });
  }

  // ─ GET /groups ──────────────────────────────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/groups') {
    if (!checkAuth(req, res)) return;
    if (!isConnected) return json(res, 503, { error: 'Not connected to WhatsApp yet.' });

    try {
      const allChats = await store.chats.all();
      // Filter for group chats (IDs end in @g.us)
      const groups = allChats
        .filter(c => c.id?.endsWith('@g.us'))
        .map(c => ({
          id: c.id,
          name: c.name || c.id,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      // If store is empty (first run), fetch from WhatsApp directly
      if (groups.length === 0) {
        console.log('[Baileys] Store empty — fetching groups via groupFetchAllParticipating...');
        const wGroups = await sock.groupFetchAllParticipating();
        const fetched = Object.values(wGroups).map(g => ({
          id: g.id,
          name: g.subject || g.id,
          participants: g.participants?.length || 0,
        })).sort((a, b) => a.name.localeCompare(b.name));
        return json(res, 200, { groups: fetched, total: fetched.length });
      }

      return json(res, 200, { groups, total: groups.length });
    } catch (err) {
      console.error('[Baileys] /groups error:', err);
      return json(res, 500, { error: err.message });
    }
  }

  // ─ POST /send-group ─────────────────────────────────────────────────────────
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
        return json(res, 400, { error: 'Invalid groupId — must end with @g.us' });
      }

      console.log(`[Baileys] Sending to group ${groupId}:\n${message}`);

      const sent = await sock.sendMessage(groupId, { text: message });
      const messageId = sent?.key?.id;

      if (!messageId) {
        throw new Error('Message sent but no message ID returned');
      }

      console.log(`[Baileys] ✅ Group message sent: ${messageId}`);
      return json(res, 200, { success: true, messageId });
    } catch (err) {
      console.error('[Baileys] /send-group error:', err.message);
      return json(res, 500, { error: err.message || 'Failed to send group message' });
    }
  }

  // ─ POST /send-individual ────────────────────────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/send-individual') {
    if (!checkAuth(req, res)) return;
    if (!isConnected) return json(res, 503, { error: 'Not connected to WhatsApp yet.' });

    try {
      const body = await parseBody(req);
      let { phone, message } = body;

      if (!phone || !message) {
        return json(res, 400, { error: '"phone" and "message" are required.' });
      }

      // Normalise phone: strip non-digits, ensure no leading +
      phone = phone.replace(/\D/g, '');
      const jid = `${phone}@s.whatsapp.net`;

      console.log(`[Baileys] Sending individual to ${jid}`);

      const sent = await sock.sendMessage(jid, { text: message });
      const messageId = sent?.key?.id;

      console.log(`[Baileys] ✅ Individual message sent: ${messageId}`);
      return json(res, 200, { success: true, messageId });
    } catch (err) {
      console.error('[Baileys] /send-individual error:', err.message);
      return json(res, 500, { error: err.message || 'Failed to send message' });
    }
  }

  // ─ 404 ─────────────────────────────────────────────────────────────────────
  json(res, 404, { error: `Unknown route: ${req.method} ${url.pathname}` });
});

server.listen(PORT, () => {
  console.log(`[Baileys Gateway] HTTP server listening on http://localhost:${PORT}`);
  console.log(`[Baileys Gateway] Secret: ${GATEWAY_SECRET}`);
});

startBaileys().catch(err => {
  console.error('[Baileys] Fatal error during startup:', err);
  process.exit(1);
});
