const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Parse .env manually
const envText = fs.readFileSync('.env', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  if (!url || !key) {
    console.error('Supabase credentials missing in env.');
    return;
  }
  console.log('Connecting to Supabase:', url);
  const supabase = createClient(url, key);
  try {
    const { data: tasks, error } = await supabase.from('tasks').select('*').limit(20);
    if (error) {
      console.error('Error fetching tasks:', error);
      return;
    }
    console.log('Tasks in DB (Count:', tasks.length, '):');
    tasks.forEach(t => {
      console.log(`- ID: ${t.id}, Date: ${t.task_date}, Name: "${t.task_name}", Status: ${t.status}`);
    });
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
