export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type TaskStatus =
  | 'pending'
  | 'processing'
  | 'sent'
  | 'failed'
  | 'cancelled';

export type PdfProcessingStatus =
  | 'pending'
  | 'processing'
  | 'processed'
  | 'failed';

// ─────────────────────────────────────────────────────────────────────────────
// PDF FILE
// ─────────────────────────────────────────────────────────────────────────────

export interface PdfFile {
  id: string;
  filename: string;
  storage_path: string;
  file_size?: number | null;
  processing_status: PdfProcessingStatus;
  error_message?: string | null;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// TASK
// ─────────────────────────────────────────────────────────────────────────────

export interface Task {
  id: string;

  pdf_id?: string | null;

  // Client / Brand extracted directly from the PDF
  client_name?: string | null;

  task_name: string;

  task_date: string; // YYYY-MM-DD

  reminder_date: string; // YYYY-MM-DD

  reminder_time: string; // HH:mm:ss

  recipient_phone: string;

  status: TaskStatus;

  whatsapp_message_id?: string | null;

  sent_at?: string | null;

  error_message?: string | null;

  created_at: string;

  updated_at: string;

  pdf_file?: PdfFile | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// WHATSAPP LOG
// ─────────────────────────────────────────────────────────────────────────────

export interface WhatsAppLog {
  id: string;

  task_id?: string | null;

  recipient_phone: string;

  message_type: string;

  whatsapp_message_id?: string | null;

  status: 'success' | 'failed';

  response?: Json | null;

  error?: string | null;

  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

export interface Settings {
  id: string;

  business_phone: string;

  recipient_phone: string;

  reminder_time: string;

  timezone: string;

  whatsapp_template_name: string;

  message_template: string;

  whatsapp_group_id?: string | null;

  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTRACTED PDF TASK
// ─────────────────────────────────────────────────────────────────────────────

export interface ExtractedTask {
  id?: string;

  // Exact client / brand name extracted from the PDF
  client_name?: string;

  task_name: string;

  task_date: string; // YYYY-MM-DD

  reminder_date?: string; // YYYY-MM-DD

  reminder_time?: string; // HH:mm:ss

  recipient_phone?: string;

  month: number;

  year: number;

  approved?: boolean;
}