/**
 * End-to-end test:
 * Uses the task ID returned directly from /api/tasks/approve
 * and immediately calls send-now with that same ID.
 * 
 * This is the correct flow — the frontend also does exactly this.
 * The approve response gives the canonical task ID; that same ID
 * is used for all subsequent operations.
 */

const BASE = 'http://localhost:3002';

async function run() {
  console.log('=== End-to-End Test: Task ID → Send Now ===\n');

  // ── Step 1: Save a task ────────────────────────────────────────────────────
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  console.log('Step 1: Saving task via POST /api/tasks/approve...');
  const approveRes = await fetch(`${BASE}/api/tasks/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tasks: [{
        task_name: 'Carzo – E2E Test Task',
        task_date: tomorrow,
        month: new Date(tomorrow).getMonth() + 1,
        year: new Date(tomorrow).getFullYear(),
      }]
    }),
  });

  const approveData = await approveRes.json();
  if (!approveRes.ok || !approveData.success) {
    console.error('❌ Approve failed:', approveData);
    process.exit(1);
  }

  const savedTask = approveData.tasks?.[0];
  console.log(`✅ Task saved:`);
  console.log(`   id="${savedTask?.id}"`);
  console.log(`   task_name="${savedTask?.task_name}"`);
  console.log(`   task_date="${savedTask?.task_date}"`);

  if (!savedTask?.id) {
    console.error('❌ No task ID returned from approve!');
    process.exit(1);
  }

  // ── Step 2: Call Send Now with the ID from approve ─────────────────────────
  // Note: In memory-only mode, the ID must be used on the same Next.js process instance.
  // On Vercel with Supabase, the task is persisted and any instance can find it.
  console.log(`\nStep 2: Calling POST /api/tasks/${savedTask.id}/send-now...`);

  const sendRes = await fetch(`${BASE}/api/tasks/${savedTask.id}/send-now`, {
    method: 'POST',
  });
  const sendData = await sendRes.json();

  console.log('\nSend Now response:');
  console.log(JSON.stringify(sendData, null, 2));

  if (sendRes.ok && sendData.success) {
    console.log('\n✅ SUCCESS!');
    console.log(`   Task ID: ${savedTask.id}`);
    console.log(`   Message ID: ${sendData.messageId}`);
    console.log(`   Group: ${sendData.groupId}`);
    console.log('\n✅ Check your WhatsApp group for the message!');
  } else {
    console.error(`\n❌ Send Now failed: ${sendData.error}`);
    
    if (sendData.error?.includes('Task not found')) {
      console.log('\n⚠️  This is the memory-isolation issue:');
      console.log('   Next.js dev server ran approve and send-now in different processes.');
      console.log('   Solution: Configure real Supabase credentials so tasks persist between requests.');
      console.log('   On Vercel with Supabase, this will work correctly.');
    }
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
