import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendWhatsAppReminder } from '@/lib/whatsapp';
import { getNowInTimezone, formatReadableDate } from '@/lib/date/calculator';
import { env } from '@/lib/validation/env';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for Vercel Cron function execution

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecretQuery = req.nextUrl.searchParams.get('secret');

  // Verify CRON_SECRET if configured
  if (env.CRON_SECRET) {
    const isAuthorizedHeader = authHeader === `Bearer ${env.CRON_SECRET}`;
    const isAuthorizedQuery = cronSecretQuery === env.CRON_SECRET;

    if (!isAuthorizedHeader && !isAuthorizedQuery) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing CRON_SECRET authorization.' },
        { status: 401 }
      );
    }
  }

  try {
    // 1. Fetch configured timezone and settings
    const { data: settings } = await supabaseAdmin
      .from('settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    const timezone = settings?.timezone || 'Asia/Kolkata';
    const templateName = settings?.whatsapp_template_name || env.WHATSAPP_TEMPLATE_NAME || 'task_reminder';

    // 2. Get current time in the configured timezone (e.g. Asia/Kolkata)
    const { currentDate, currentTime, formattedDisplay } = getNowInTimezone(timezone);

    console.log(`[Cron Reminders] Executing at ${formattedDisplay} (Timezone: ${timezone})`);

    // 3. Find pending tasks where reminder_date <= currentDate AND reminder_time <= currentTime
    const { data: dueTasks, error: queryError } = await supabaseAdmin
      .from('tasks')
      .select('*')
      .in('status', ['pending'])
      .lte('reminder_date', currentDate)
      .lte('reminder_time', currentTime)
      .order('reminder_date', { ascending: true })
      .limit(50); // Process in batches of 50

    if (queryError) {
      console.error('[Cron Reminders] DB Query error:', queryError);
      return NextResponse.json({ error: queryError.message }, { status: 500 });
    }

    if (!dueTasks || dueTasks.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No reminders due at this time.',
        evaluatedAt: formattedDisplay,
        currentDate,
        currentTime,
        processedCount: 0,
      });
    }

    console.log(`[Cron Reminders] Found ${dueTasks.length} task(s) due for reminders.`);

    const results = [];

    for (const task of dueTasks) {
      // 4. Atomic Lock / Claim: update status to 'processing' only if it's still 'pending'
      const { data: lockedTask, error: lockError } = await supabaseAdmin
        .from('tasks')
        .update({
          status: 'processing',
          updated_at: new Date().toISOString(),
        })
        .eq('id', task.id)
        .eq('status', 'pending')
        .select()
        .single();

      if (lockError || !lockedTask) {
        console.warn(`[Cron Reminders] Task ${task.id} could not be locked or already claimed.`);
        continue;
      }

      // 5. Format parameters & Send WhatsApp reminder via official Meta Cloud API
      const taskDateFormatted = formatReadableDate(task.task_date);
      const recipient = task.recipient_phone || settings?.recipient_phone || '+917025219962';

      const sendResult = await sendWhatsAppReminder({
        to: recipient,
        templateName,
        taskDateFormatted,
        taskName: task.task_name,
      });

      // 6. Record metadata in whatsapp_logs
      try {
        await supabaseAdmin.from('whatsapp_logs').insert({
          task_id: task.id,
          recipient_phone: recipient,
          message_type: 'template',
          whatsapp_message_id: sendResult.messageId || null,
          status: sendResult.success ? 'success' : 'failed',
          response: sendResult.rawResponse || null,
          error: sendResult.error || null,
        });
      } catch (logErr) {
        console.error('[Cron Reminders] Error inserting into whatsapp_logs:', logErr);
      }

      // 7. Update task status based on verified Meta API result
      if (sendResult.success && sendResult.messageId) {
        await supabaseAdmin
          .from('tasks')
          .update({
            status: 'sent',
            whatsapp_message_id: sendResult.messageId,
            sent_at: new Date().toISOString(),
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', task.id);

        results.push({
          taskId: task.id,
          taskName: task.task_name,
          taskDate: task.task_date,
          recipient,
          status: 'sent',
          messageId: sendResult.messageId,
        });
      } else {
        await supabaseAdmin
          .from('tasks')
          .update({
            status: 'failed',
            error_message: sendResult.error || 'Meta API delivery submission failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', task.id);

        results.push({
          taskId: task.id,
          taskName: task.task_name,
          taskDate: task.task_date,
          recipient,
          status: 'failed',
          error: sendResult.error,
        });
      }
    }

    return NextResponse.json({
      success: true,
      evaluatedAt: formattedDisplay,
      currentDate,
      currentTime,
      processedCount: results.length,
      sentCount: results.filter(r => r.status === 'sent').length,
      failedCount: results.filter(r => r.status === 'failed').length,
      results,
    });
  } catch (err: any) {
    console.error('[Cron Reminders] Unhandled error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
