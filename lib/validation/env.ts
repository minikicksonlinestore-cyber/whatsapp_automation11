import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional().default('https://your-project.supabase.co'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional().default('your-anon-key'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default('your-service-role-key'),
  WHATSAPP_ACCESS_TOKEN: z.string().optional().default(''),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().default(''),
  WHATSAPP_API_VERSION: z.string().optional().default('v20.0'),
  WHATSAPP_TEMPLATE_NAME: z.string().optional().default('task_reminder'),
  CRON_SECRET: z.string().optional().default(''),
});

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-service-role-key',
  WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN || '',
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  WHATSAPP_API_VERSION: process.env.WHATSAPP_API_VERSION || 'v20.0',
  WHATSAPP_TEMPLATE_NAME: process.env.WHATSAPP_TEMPLATE_NAME || 'task_reminder',
  CRON_SECRET: process.env.CRON_SECRET || '',
};

export function validateWhatsAppConfig(): { isValid: boolean; error?: string } {
  if (!env.WHATSAPP_ACCESS_TOKEN) {
    return { isValid: false, error: 'WHATSAPP_ACCESS_TOKEN is not configured in environment variables.' };
  }
  if (!env.WHATSAPP_PHONE_NUMBER_ID) {
    return { isValid: false, error: 'WHATSAPP_PHONE_NUMBER_ID is not configured in environment variables.' };
  }
  return { isValid: true };
}
