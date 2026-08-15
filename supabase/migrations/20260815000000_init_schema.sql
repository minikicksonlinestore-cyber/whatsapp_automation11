-- Supabase Schema Migration: WhatsApp PDF Reminder Automation
-- Database: PostgreSQL

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create table: pdf_files
CREATE TABLE IF NOT EXISTS public.pdf_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    file_size BIGINT,
    processing_status TEXT NOT NULL DEFAULT 'processed' CHECK (processing_status IN ('pending', 'processing', 'processed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create table: tasks
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pdf_id UUID REFERENCES public.pdf_files(id) ON DELETE SET NULL,
    task_name TEXT NOT NULL,
    task_date DATE NOT NULL,
    reminder_date DATE NOT NULL,
    reminder_time TIME NOT NULL DEFAULT '18:00:00',
    recipient_phone TEXT NOT NULL DEFAULT '+917025219962',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
    whatsapp_message_id TEXT,
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique idempotency constraint to avoid duplicate reminders for the same task, date, and recipient
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_idempotency 
ON public.tasks(recipient_phone, task_date, task_name) 
WHERE status != 'cancelled';

-- Performance & Query Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_reminder_date ON public.tasks(reminder_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_task_date ON public.tasks(task_date);
CREATE INDEX IF NOT EXISTS idx_tasks_cron_lookup ON public.tasks(reminder_date, status, reminder_time);

-- 3. Create table: whatsapp_logs
CREATE TABLE IF NOT EXISTS public.whatsapp_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    recipient_phone TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'template',
    whatsapp_message_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
    response JSONB,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_task_id ON public.whatsapp_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_created_at ON public.whatsapp_logs(created_at DESC);

-- 4. Create table: settings
CREATE TABLE IF NOT EXISTS public.settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_phone TEXT NOT NULL DEFAULT '+919061082040',
    recipient_phone TEXT NOT NULL DEFAULT '+917025219962',
    reminder_time TIME NOT NULL DEFAULT '18:00:00',
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    whatsapp_template_name TEXT NOT NULL DEFAULT 'task_reminder',
    message_template TEXT NOT NULL DEFAULT '🔔 Task Reminder

Tomorrow ({{date}}) you have:
📌 {{task}}

Please complete the task on time.',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default settings if empty
INSERT INTO public.settings (business_phone, recipient_phone, reminder_time, timezone, whatsapp_template_name)
SELECT '+919061082040', '+917025219962', '18:00:00', 'Asia/Kolkata', 'task_reminder'
WHERE NOT EXISTS (SELECT 1 FROM public.settings);

-- Row Level Security (RLS) policies
ALTER TABLE public.pdf_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Allow public / anon read & write for this automation system (or authenticated if auth enabled)
CREATE POLICY "Allow public read-write for pdf_files" ON public.pdf_files FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for tasks" ON public.tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for whatsapp_logs" ON public.whatsapp_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read-write for settings" ON public.settings FOR ALL USING (true) WITH CHECK (true);

-- Storage bucket setup statement (for documentation / Supabase SQL editor)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('pdf_calendars', 'pdf_calendars', true) ON CONFLICT DO NOTHING;
