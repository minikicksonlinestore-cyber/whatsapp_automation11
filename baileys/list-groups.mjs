/**
 * List your WhatsApp Groups
 * ──────────────────────────
 * Run after the gateway is started and connected:
 *   node baileys/list-groups.mjs
 *
 * This prints every group's name and ID so you can pick
 * the correct one to put in WHATSAPP_GROUP_ID in your .env
 */

const GATEWAY_URL = process.env.BAILEYS_GATEWAY_URL || 'http://localhost:3001';
const GATEWAY_SECRET = process.env.BAILEYS_GATEWAY_SECRET || 'baileys-local-secret';

async function listGroups() {
  console.log(`\n[List Groups] Querying gateway at ${GATEWAY_URL}/groups ...\n`);

  let res;
  try {
    res = await fetch(`${GATEWAY_URL}/groups`, {
      headers: { 'x-gateway-secret': GATEWAY_SECRET },
    });
  } catch (err) {
    console.error('[List Groups] ❌ Could not reach the gateway. Is it running?');
    console.error('   Run: node baileys/gateway.mjs\n');
    process.exit(1);
  }

  if (!res.ok) {
    const body = await res.json();
    console.error('[List Groups] ❌ Gateway error:', body.error);
    process.exit(1);
  }

  const { groups, total } = await res.json();

  if (!groups || groups.length === 0) {
    console.log('[List Groups] No groups found. Try again after a few seconds — the store may still be loading.');
    process.exit(0);
  }

  console.log(`Found ${total} groups:\n`);
  console.log('─'.repeat(70));

  groups.forEach((g, i) => {
    const num = String(i + 1).padStart(2, ' ');
    console.log(`${num}. ${g.name}`);
    console.log(`     ID: ${g.id}`);
    if (g.participants) console.log(`     Members: ${g.participants}`);
    console.log();
  });

  console.log('─'.repeat(70));
  console.log('\nCopy the ID of your desired group and add it to your .env:');
  console.log('  WHATSAPP_GROUP_ID=120363XXXXXXXXXX@g.us\n');
}

listGroups();
