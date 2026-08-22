import { Task, ExtractedTask, WhatsAppLog, Settings } from '../types/database';
import {
  calculateReminderDate,
  normalizeTimeString,
  normalizePhoneNumber,
} from '../date/calculator';

// ─────────────────────────────────────────────────────────────────────────────
// In-Memory Fallback
// ─────────────────────────────────────────────────────────────────────────────

let memoryTasks: Task[] = [];
let memoryLogs: WhatsAppLog[] = [];

let memorySettings: Settings = {
  id: 'default-settings',
  business_phone: '+917025219962',
  recipient_phone: '+917025219962',
  reminder_time: '18:00:00',
  timezone: 'Asia/Kolkata',
  whatsapp_template_name: 'task_reminder',
  message_template:
    '🔔 *Task Reminder*\n\nTomorrow ({{1}}) you have:\n📌 *{{2}}*\n\nPlease complete the task on time.',
  whatsapp_group_id: process.env.WHATSAPP_GROUP_ID || null,
  updated_at: new Date().toISOString(),
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isValidUUID(value?: string | null): boolean {
  if (!value) return false;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function generateUUID(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }
}

function safeUUID(value?: string | null): string {
  return isValidUUID(value) ? value! : generateUUID();
}

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';

  if (
    !url ||
    !url.startsWith('https://') ||
    url.includes('placeholder') ||
    url.includes('your-project')
  ) {
    return false;
  }

  if (
    !key ||
    key.length < 20 ||
    key.includes('placeholder') ||
    key.includes('your-anon-key') ||
    key.includes('your-service-role-key')
  ) {
    return false;
  }

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Supabase Client
// ─────────────────────────────────────────────────────────────────────────────

let _supabaseClient: any = null;

function getSupabase() {
  if (_supabaseClient) {
    return _supabaseClient;
  }

  if (!isSupabaseConfigured()) {
    console.warn('[Supabase] Environment variables are not configured.');
    return null;
  }

  try {
    const { createClient } = require('@supabase/supabase-js');

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;

    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    _supabaseClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    console.log('[Supabase] Client initialized.');

    return _supabaseClient;
  } catch (error) {
    console.error(
      '[Supabase] Client initialization failed:',
      error
    );

    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TASKS - GET
// ─────────────────────────────────────────────────────────────────────────────

export async function getTasksFromStore(
  filters: {
    status?: string;
    search?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ tasks: Task[]; total: number }> {
  const db = getSupabase();

  if (db) {
    try {
      let query = db
        .from('tasks')
        .select('*', { count: 'exact' })
        .order('task_date', { ascending: true });

      if (
        filters.status &&
        filters.status !== 'all'
      ) {
        query = query.eq(
          'status',
          filters.status
        );
      }

      if (filters.search) {
        query = query.ilike(
          'task_name',
          `%${filters.search}%`
        );
      }

      if (filters.fromDate) {
        query = query.gte(
          'task_date',
          filters.fromDate
        );
      }

      if (filters.toDate) {
        query = query.lte(
          'task_date',
          filters.toDate
        );
      }

      const offset =
        filters.offset || 0;

      const limit =
        filters.limit || 100;

      query = query.range(
        offset,
        offset + limit - 1
      );

      const {
        data,
        error,
        count,
      } = await query;

      if (!error && data) {
        console.log(
          `[Supabase] Loaded ${data.length} tasks.`
        );

        return {
          tasks: data as Task[],
          total:
            count || data.length,
        };
      }

      if (error) {
        console.error(
          '[Supabase] getTasks error:',
          error.message,
          error.details,
          error.hint,
          error.code
        );
      }
    } catch (error) {
      console.error(
        '[Supabase] getTasks exception:',
        error
      );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Memory fallback
  // ───────────────────────────────────────────────────────────────────────────

  let result = [...memoryTasks];

  if (
    filters.status &&
    filters.status !== 'all'
  ) {
    result = result.filter(
      task =>
        task.status ===
        filters.status
    );
  }

  if (filters.search) {
    const search =
      filters.search.toLowerCase();

    result = result.filter(
      task =>
        task.task_name
          .toLowerCase()
          .includes(search)
    );
  }

  if (filters.fromDate) {
    result = result.filter(
      task =>
        task.task_date >=
        filters.fromDate!
    );
  }

  if (filters.toDate) {
    result = result.filter(
      task =>
        task.task_date <=
        filters.toDate!
    );
  }

  result.sort(
    (a, b) =>
      a.task_date.localeCompare(
        b.task_date
      )
  );

  const total =
    result.length;

  const offset =
    filters.offset || 0;

  const limit =
    filters.limit || 100;

  return {
    tasks: result.slice(
      offset,
      offset + limit
    ),
    total,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TASKS - SAVE APPROVED TASKS
// ─────────────────────────────────────────────────────────────────────────────

export async function saveApprovedTasks(
  tasks: ExtractedTask[],
  pdfId?: string
): Promise<{
  count: number;
  tasks: Task[];
}> {
  console.log(
    '[APPROVE] PDF ID:',
    pdfId
  );

  console.log(
    '[APPROVE] Received tasks:',
    JSON.stringify(
      tasks,
      null,
      2
    )
  );

  if (
    !Array.isArray(tasks) ||
    tasks.length === 0
  ) {
    console.warn(
      '[APPROVE] No tasks received.'
    );

    return {
      count: 0,
      tasks: [],
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Prepare tasks
  // ───────────────────────────────────────────────────────────────────────────

  const preparedTasks: Task[] =
    tasks
      .filter(task => {
        if (
          !task.task_name ||
          !task.task_date
        ) {
          console.warn(
            '[APPROVE] Invalid task skipped:',
            task
          );

          return false;
        }

        return true;
      })
      .map((task, index) => {
        const now =
          new Date().toISOString();

        /*
         * IMPORTANT:
         *
         * Extracted PDF IDs can look like:
         *
         * extracted-2-1787139159728
         *
         * Supabase UUID column cannot accept that.
         *
         * Therefore:
         * - valid UUID -> keep it
         * - invalid/non-UUID -> generate new UUID
         */

        const databaseTaskId =
          safeUUID(
            task.id
          );

        /*
         * pdf_id is also normally UUID.
         * Invalid PDF IDs are converted to null.
         */

        const databasePdfId =
          isValidUUID(pdfId)
            ? pdfId!
            : null;

        const taskDate =
          task.task_date;

        const reminderDate =
          task.reminder_date ||
          calculateReminderDate(
            taskDate
          );

        const reminderTime =
          normalizeTimeString(
            task.reminder_time ||
            '18:00:00'
          );

        const recipientPhone =
          normalizePhoneNumber(
            task.recipient_phone ||
            '+917025219962'
          );

        const preparedTask: Task =
          {
            id:
              databaseTaskId,

            pdf_id:
              databasePdfId,

            // NEW: Save client name
            client_name:
              task.client_name || null,

            task_name:
              String(
                task.task_name
              ).trim(),

            task_date:
              taskDate,

            reminder_date:
              reminderDate,

            reminder_time:
              reminderTime,

            recipient_phone:
              recipientPhone,

            status:
              'pending',

            whatsapp_message_id:
              null,

            sent_at:
              null,

            error_message:
              null,

            created_at:
              now,

            updated_at:
              now,
          };

        console.log(
          '[APPROVE] Prepared task:',
          JSON.stringify(
            preparedTask,
            null,
            2
          )
        );

        return preparedTask;
      });

  if (
    preparedTasks.length === 0
  ) {
    return {
      count: 0,
      tasks: [],
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Save to Supabase
  // ───────────────────────────────────────────────────────────────────────────

  const db =
    getSupabase();

  if (db) {
    try {
      const rows =
        preparedTasks.map(
          task => ({
            id:
              task.id,

            pdf_id:
              task.pdf_id,

            // NEW: Save client name to Supabase
            client_name:
              task.client_name || null,

            task_name:
              task.task_name,

            task_date:
              task.task_date,

            reminder_date:
              task.reminder_date,

            reminder_time:
              task.reminder_time,

            recipient_phone:
              task.recipient_phone,

            status:
              task.status,

            whatsapp_message_id:
              null,

            sent_at:
              null,

            error_message:
              null,

            created_at:
              task.created_at,

            updated_at:
              task.updated_at,
          })
        );

      console.log(
        '[SUPABASE] Inserting:',
        JSON.stringify(
          rows,
          null,
          2
        )
      );

      /*
       * INSERT only.
       *
       * No ON CONFLICT is used.
       * This avoids the previous:
       *
       * "there is no unique or exclusion constraint
       * matching the ON CONFLICT specification"
       */

      const {
        data,
        error,
      } = await db
        .from('tasks')
        .insert(rows)
        .select('*');

      if (
        !error &&
        data
      ) {
        console.log(
          `[SUPABASE] Successfully saved ${data.length} tasks.`
        );

        return {
          count:
            data.length,

          tasks:
            data as Task[],
        };
      }

      if (error) {
        console.error(
          '[SUPABASE] SAVE ERROR:',
          error.message
        );

        console.error(
          '[SUPABASE] Details:',
          error.details
        );

        console.error(
          '[SUPABASE] Hint:',
          error.hint
        );

        console.error(
          '[SUPABASE] Code:',
          error.code
        );
      }
    } catch (error) {
      console.error(
        '[SUPABASE] Save exception:',
        error
      );
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Memory fallback
  // ───────────────────────────────────────────────────────────────────────────

  console.log(
    '[MEMORY] Using memory fallback.'
  );

  for (
    const newTask of preparedTasks
  ) {
    const existingIndex =
      memoryTasks.findIndex(
        task =>
          task.recipient_phone ===
            newTask.recipient_phone &&
          task.task_date ===
            newTask.task_date &&
          task.task_name ===
            newTask.task_name
      );

    if (
      existingIndex >= 0
    ) {
      memoryTasks[
        existingIndex
      ] = {
        ...memoryTasks[
          existingIndex
        ],

        ...newTask,

        updated_at:
          new Date().toISOString(),
      };
    } else {
      memoryTasks.push(
        newTask
      );
    }
  }

  return {
    count:
      preparedTasks.length,

    tasks:
      preparedTasks,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TASKS - UPDATE
// ─────────────────────────────────────────────────────────────────────────────

export async function updateTaskInStore(
  taskId: string,
  updates: Partial<Task>
): Promise<Task | null> {
  const db =
    getSupabase();

  if (db) {
    try {
      const {
        data,
        error,
      } = await db
        .from('tasks')
        .update({
          ...updates,
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          'id',
          taskId
        )
        .select('*')
        .maybeSingle();

      if (data) {
        return data as Task;
      }

      if (error) {
        console.error(
          '[SUPABASE] updateTask error:',
          error.message,
          error.details,
          error.hint
        );
      }
    } catch (error) {
      console.error(
        '[SUPABASE] updateTask exception:',
        error
      );
    }
  }

  // Memory fallback

  const taskIndex =
    memoryTasks.findIndex(
      task =>
        task.id === taskId
    );

  if (
    taskIndex >= 0
  ) {
    memoryTasks[
      taskIndex
    ] = {
      ...memoryTasks[
        taskIndex
      ],

      ...updates,

      updated_at:
        new Date().toISOString(),
    };

    return memoryTasks[
      taskIndex
    ];
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// TASKS - DELETE
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteTaskFromStore(
  taskId: string
): Promise<boolean> {
  const db =
    getSupabase();

  let deletedFromDatabase =
    false;

  if (db) {
    try {
      const {
        error,
        count,
      } = await db
        .from('tasks')
        .delete({
          count: 'exact',
        })
        .eq(
          'id',
          taskId
        );

      if (error) {
        console.error(
          '[SUPABASE] deleteTask error:',
          error.message,
          error.details
        );
      } else {
        deletedFromDatabase =
          (count || 0) > 0;

        console.log(
          '[SUPABASE] Delete result:',
          deletedFromDatabase
        );
      }
    } catch (error) {
      console.error(
        '[SUPABASE] deleteTask exception:',
        error
      );
    }
  }

  const initialLength =
    memoryTasks.length;

  memoryTasks =
    memoryTasks.filter(
      task =>
        task.id !== taskId
    );

  const deletedFromMemory =
    memoryTasks.length <
    initialLength;

  return (
    deletedFromDatabase ||
    deletedFromMemory
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TASKS - UPDATE STATUS
// ─────────────────────────────────────────────────────────────────────────────

export async function updateTaskStatus(
  taskId: string,
  status: Task['status'],
  extra: {
    whatsapp_message_id?: string;
    error_message?: string;
    sent_at?: string;
  } = {}
): Promise<boolean> {
  const updated =
    await updateTaskInStore(
      taskId,
      {
        status,
        ...extra,
      }
    );

  return Boolean(updated);
}

// ─────────────────────────────────────────────────────────────────────────────
// WHATSAPP LOGS
// ─────────────────────────────────────────────────────────────────────────────

export async function logWhatsAppMessage(
  log: Omit<
    WhatsAppLog,
    'id' | 'created_at'
  >
): Promise<void> {
  const fullLog: WhatsAppLog = {
    id:
      `log-${Date.now()}`,

    ...log,

    created_at:
      new Date().toISOString(),
  };

  const db =
    getSupabase();

  if (db) {
    try {
      const {
        error,
      } = await db
        .from('whatsapp_logs')
        .insert([
          fullLog,
        ]);

      if (error) {
        console.error(
          '[SUPABASE] logMessage error:',
          error.message,
          error.details
        );
      }
    } catch (error) {
      console.error(
        '[SUPABASE] logMessage exception:',
        error
      );
    }
  }

  memoryLogs.unshift(
    fullLog
  );

  if (
    memoryLogs.length > 200
  ) {
    memoryLogs.pop();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS - GET
// ─────────────────────────────────────────────────────────────────────────────

export async function getSettingsStore(): Promise<Settings> {
  const db =
    getSupabase();

  if (db) {
    try {
      const {
        data,
        error,
      } = await db
        .from('settings')
        .select('*')
        .eq(
          'id',
          'default-settings'
        )
        .maybeSingle();

      if (data) {
        return data as Settings;
      }

      if (error) {
        console.error(
          '[SUPABASE] getSettings error:',
          error.message,
          error.details
        );
      }
    } catch (error) {
      console.error(
        '[SUPABASE] getSettings exception:',
        error
      );
    }
  }

  return memorySettings;
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS - UPDATE
// ─────────────────────────────────────────────────────────────────────────────

export async function updateSettingsStore(
  newSettings: Partial<Settings>
): Promise<Settings> {
  memorySettings = {
    ...memorySettings,
    ...newSettings,
    updated_at:
      new Date().toISOString(),
  };

  const db =
    getSupabase();

  if (db) {
    try {
      const {
        error,
      } = await db
        .from('settings')
        .upsert(
          memorySettings,
          {
            onConflict:
              'id',
          }
        );

      if (error) {
        console.error(
          '[SUPABASE] updateSettings error:',
          error.message,
          error.details
        );
      }
    } catch (error) {
      console.error(
        '[SUPABASE] updateSettings exception:',
        error
      );
    }
  }

  return memorySettings;
}