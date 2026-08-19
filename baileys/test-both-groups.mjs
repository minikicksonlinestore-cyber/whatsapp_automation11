/**
 * Test script: sends a real reminder to BOTH groups and reports messageIds.
 * Run: node baileys/test-both-groups.mjs
 */

const GATEWAY_URL = 'http://localhost:3001';
const GATEWAY_SECRET = 'baileys-local-secret';

const tomorrow = new Date(Date.now() + 86400000);
const day = tomorrow.getDate();
const month = tomorrow.toLocaleString('en-GB', { month: 'short' });
const dateLabel = `${day} ${month} (Tomorrow)`;

const groups = [
  { id: '120363403007632805@g.us', name: '{ TRENDHIVE }' },
  { id: '120363427233548997@g.us', name: 'Made in 20s - work' },
];

async function sendToGroup(group) {
  const message = `${dateLabel}\n\nCarzo – Scripted 2\nDisxeno – Reel 4`;
  console.log(`\n→ Sending to "${group.name}" (${group.id})`);
  console.log(`  Message:\n${message.split('\n').map(l => '  ' + l).join('\n')}`);

  const res = await fetch(`${GATEWAY_URL}/send-group`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-gateway-secret': GATEWAY_SECRET,
    },
    body: JSON.stringify({ groupId: group.id, message }),
  });

  const data = await res.json();

  if (res.ok && data.success) {
    console.log(`  ✅ Delivered! messageId: ${data.messageId}`);
    return { group: group.name, success: true, messageId: data.messageId };
  } else {
    console.error(`  ❌ Failed: ${data.error}`);
    return { group: group.name, success: false, error: data.error };
  }
}

async function main() {
  console.log('=== Dual Group Test ===');
  console.log(`Date label: ${dateLabel}\n`);

  const results = [];
  for (const group of groups) {
    const result = await sendToGroup(group);
    results.push(result);
    // Small delay between sends
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('\n=== Results ===');
  results.forEach(r => {
    if (r.success) {
      console.log(`✅ ${r.group}: messageId=${r.messageId}`);
    } else {
      console.log(`❌ ${r.group}: ${r.error}`);
    }
  });

  const allSuccess = results.every(r => r.success);
  console.log(`\n${allSuccess ? '✅ All messages delivered!' : '❌ Some messages failed.'}`);
  process.exit(allSuccess ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
