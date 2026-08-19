import { Task, ExtractedTask, WhatsAppLog, Settings } from '../types/database';
import { calculateReminderDate, normalizeTimeString, normalizePhoneNumber } from '../date/calculator';

// ─── In-Memory Store (zero-config fallback) ──────────────────────────────────
let memoryTasks: Task[] = [];
let memoryLogs: WhatsAppLog[] = [];
let memorySettings: Settings = {
  id: 'default-settings',
  business_phone: '+917025219962',
  recipient_phone: '+917025219962',
  reminder_time: '18:00:00',
  timezone: 'Asia/Kolkata',
  whatsapp_template_name: 'task_reminder',
  message_template: '🔔 *Task Reminder*\n\nTomorrow ({{1}}) you have:\n📌 *{{2}}*\n\nPlease complete the task on time.',
  whatsapp_group_id: process.env.WHATSAPP_GROUP_ID || null,
  updated_at: new Date().toISOString(),
};

// ─── Lazy Supabase Client (only created when env vars are real) ───────────────
function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!url || url.includes('placeholder') || url.includes('your-project') || !url.startsWith('https://')) return false;
  if (!key || key.includes('placeholder') || key.includes('your-anon-key') || key.includes('your-service-role-key') || key.length < 20) return false;
  return true;
}

// Lazy singleton — only instantiated if Supabase is properly configured
let _supabaseClient: any = null;
function getSupabase() {
  if (_supabaseClient) return _supabaseClient;
  if (!isSupabaseConfigured()) return null;

  const { createClient } = require('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  _supabaseClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _supabaseClient;
}

// ─── Tasks ────────────────────────────────────────────────────────────────────
export async function getTasksFromStore(filters: {
  status?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ tasks: Task[]; total: number }> {
  const db = getSupabase();
  if (db) {
    try {
      let query = db
        .from('tasks')
        .select('*, pdf_file:pdf_files(filename)', { count: 'exact' })
        .order('task_date', { ascending: true });

      if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
      if (filters.search) query = query.ilike('task_name', `%${filters.search}%`);
      if (filters.fromDate) query = query.gte('task_date', filters.fromDate);
      if (filters.toDate) query = query.lte('task_date', filters.toDate);

      const offset = filters.offset || 0;
      const limit = filters.limit || 100;
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;
      if (!error && data) return { tasks: data as Task[], total: count || data.length };
      if (error) console.error('[Store] Supabase getTasks error:', error.message, error.details);
    } catch (e) {
      console.warn('[Store] Supabase query notice:', e);
    }
  }

  // Memory fallback
  let result = [...memoryTasks];
  if (filters.status && filters.status !== 'all') result = result.filter(t => t.status === filters.status);
  if (filters.search) {
    const s = filters.search.toLowerCase();
    result = result.filter(t => t.task_name.toLowerCase().includes(s));
  }
  if (filters.fromDate) result = result.filter(t => t.task_date >= filters.fromDate!);
  if (filters.toDate) result = result.filter(t => t.task_date <= filters.toDate!);

  result.sort((a, b) => a.task_date.localeCompare(b.task_date));
  const total = result.length;
  const offset = filters.offset || 0;
  const limit = filters.limit || 100;
  return { tasks: result.slice(offset, offset + limit), total };
}

export async function saveApprovedTasks(tasks: ExtractedTask[], pdfId?: string): Promise<{ count: number; tasks: Task[] }> {
  const preparedTasks: Task[] = tasks.map((t, idx) => {
    const taskDate = t.task_date;
    const reminderDate = t.reminder_date || calculateReminderDate(taskDate);
    const reminderTime = normalizeTimeString(t.reminder_time || '18:00:00');
    const recipientPhone = normalizePhoneNumber(t.recipient_phone || '+917025219962');

    return {
      id: t.id || `task-${Date.now()}-${idx}`,
      pdf_id: pdfId || null,
      task_name: t.task_name.trim(),
      task_date: taskDate,
      reminder_date: reminderDate,
      reminder_time: reminderTime,
      recipient_phone: recipientPhone,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  const db = getSupabase();
  if (db) {
    try {
      const { data, error } = await db
        .from('tasks')
        .upsert(
          preparedTasks.map(({ pdf_file, ...rest }: any) => rest),
          { onConflict: 'recipient_phone,task_date,task_name', ignoreDuplicates: false }
        )
        .select();

      if (!error && data) return { count: data.length, tasks: data as Task[] };
      if (error) console.error('[Store] Supabase saveTasks error:', error.message, error.details);
    } catch (e) {
      console.warn('[Store] Supabase save notice:', e);
    }
  }

  // Memory upsert
  for (const newTask of preparedTasks) {
    const existingIndex = memoryTasks.findIndex(
      t => t.recipient_phone === newTask.recipient_phone && t.task_date === newTask.task_date && t.task_name === newTask.task_name
    );
    if (existingIndex >= 0) {
      memoryTasks[existingIndex] = { ...memoryTasks[existingIndex], ...newTask };
    } else {
      memoryTasks.push(newTask);
    }
  }

  return { count: preparedTasks.length, tasks: preparedTasks };
}

export async function updateTaskInStore(taskId: string, updates: Partial<Task>): Promise<Task | null> {
  const db = getSupabase();
  if (db) {
    try {
      const { data, error } = await db
        .from('tasks')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', taskId)
        .select()
        .maybeSingle();
      if (data) return data as Task;
      if (error) console.error('[Store] Supabase updateTask error:', error.message, error.details);
    } catch (e) {
      console.warn('[Store] Supabase update notice:', e);
    }
  }

  const taskIndex = memoryTasks.findIndex(t => t.id === taskId);
  if (taskIndex >= 0) {
    memoryTasks[taskIndex] = { ...memoryTasks[taskIndex], ...updates, updated_at: new Date().toISOString() };
    return memoryTasks[taskIndex];
  }
  return null;
}

export async function deleteTaskFromStore(taskId: string): Promise<boolean> {
  const db = getSupabase();
  if (db) {
    try {
      const { error } = await db.from('tasks').delete().eq('id', taskId);
      if (error) console.error('[Store] Supabase deleteTask error:', error.message, error.details);
    } catch (e) {
      console.warn('[Store] Supabase delete notice:', e);
    }
  }

  const initialLen = memoryTasks.length;
  memoryTasks = memoryTasks.filter(t => t.id !== taskId);
  return memoryTasks.length < initialLen;
}

export async function updateTaskStatus(
  taskId: string,
  status: Task['status'],
  extra: { whatsapp_message_id?: string; error_message?: string; sent_at?: string } = {}
): Promise<boolean> {
  const updated = await updateTaskInStore(taskId, { status, ...extra });
  return Boolean(updated);
}

export async function logWhatsAppMessage(log: Omit<WhatsAppLog, 'id' | 'created_at'>): Promise<void> {
  const fullLog: WhatsAppLog = {
    id: `log-${Date.now()}`,
    ...log,
    created_at: new Date().toISOString(),
  };

  const db = getSupabase();
  if (db) {
    try {
      const { error } = await db.from('whatsapp_logs').insert([fullLog]);
      if (error) console.error('[Store] Supabase logMessage error:', error.message, error.details);
    } catch (e) {
      console.warn('[Store] Supabase log notice:', e);
    }
  }

  memoryLogs.unshift(fullLog);
  if (memoryLogs.length > 200) memoryLogs.pop();
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export async function getSettingsStore(): Promise<Settings> {
  const db = getSupabase();
  if (db) {
    try {
      const { data, error } = await db
        .from('settings')
        .select()
        .eq('id', 'default-settings')
        .maybeSingle();
      if (data) return data as Settings;
      if (error) console.error('[Store] Supabase getSettings error:', error.message, error.details);
    } catch (e) {
      console.warn('[Store] Supabase settings notice:', e);
    }
  }
  return memorySettings;
}

export async function updateSettingsStore(newSettings: Partial<Settings>): Promise<Settings> {
  memorySettings = { ...memorySettings, ...newSettings, updated_at: new Date().toISOString() };
  const db = getSupabase();
  if (db) {
    try {
      const { error } = await db.from('settings').upsert(memorySettings);
      if (error) console.error('[Store] Supabase updateSettings error:', error.message, error.details);
    } catch (e) {
      console.warn('[Store] Supabase update settings notice:', e);
    }
  }
  return memorySettings;
}