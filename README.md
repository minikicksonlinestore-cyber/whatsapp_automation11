# WhatsApp PDF Calendar Reminder Automation System

A production-ready full-stack application built with **Next.js 14**, **TypeScript**, **Tailwind CSS**, **Supabase (PostgreSQL + Storage)**, **Official Meta WhatsApp Cloud API**, and **Vercel Cron**.

The system ingests PDF calendar schedules (including visual grid and table layouts), accurately extracts tasks and dates (e.g. *Motion graphics*, *Poster 4*, *Scripted*, *Poster 5*, *Poster 6*), automatically computes reminder dates as **exactly 1 day prior to the task date**, and dispatches automated WhatsApp reminders at **6:00 PM IST (Asia/Kolkata)** using the official Meta WhatsApp Cloud API without any manual intervention.

---

## 📋 System Architecture

```
[ Upload PDF Calendar ]
         │
         ▼
[ PDF Calendar Extraction Engine ] ──► Extracts Month, Year, Dates & Tasks
         │
         ▼
[ Interactive Preview Table ] ───────► User Review, Edit Dates/Names & Approve
         │
         ▼
[ Supabase PostgreSQL DB ] ──────────► Saves tasks with (reminder_date = task_date - 1 day)
         │
         ▼
[ Vercel Cron Scheduler ] ───────────► Evaluates /api/cron/reminders every 15 mins (Asia/Kolkata)
         │
         ▼
[ Atomic Row Lock Claim ] ───────────► Sets status = 'processing' to prevent duplicate sends
         │
         ▼
[ Official Meta WhatsApp API ] ──────► POST /v20.0/{phone_number_id}/messages (Template)
         │
         ▼
[ Confirmation & Logging ] ──────────► Records Meta Message ID, sent_at & whatsapp_logs
```

---

## 🛠️ Complete Setup Guide (17 Steps)

### 1. Install Dependencies
Clone the repository and install all Node.js packages:
```bash
git clone <repository-url>
cd "whatsapp automation"
npm install
```

### 2. Create Supabase Project
1. Go to [https://supabase.com](https://supabase.com) and create a new project.
2. Note your **Project URL**, **Anon API Key**, and **Service Role Secret Key** from `Project Settings > API`.

### 3. Run Database Migrations
1. In the Supabase Dashboard, navigate to the **SQL Editor**.
2. Open the file [`supabase/migrations/20260815000000_init_schema.sql`](supabase/migrations/20260815000000_init_schema.sql).
3. Paste the contents into the SQL Editor and click **Run**.
4. This will create:
   - `pdf_files` table
   - `tasks` table with indexes on `reminder_date`, `status`, `task_date` and unique idempotency constraint on `(recipient_phone, task_date, task_name)`
   - `whatsapp_logs` table for delivery audit trails
   - `settings` table seeded with default recipient `+91 7025219962`, business sender `+91 9061082040`, and timezone `Asia/Kolkata`.

### 4. Configure Supabase Storage
1. In Supabase Dashboard, go to **Storage**.
2. Create a new bucket named `pdf_calendars`.
3. Set the bucket to **Public** (or private with RLS policies if restricted).

### 5. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in the values:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Official Meta WhatsApp Cloud API Configuration
WHATSAPP_ACCESS_TOKEN=EAAG...
WHATSAPP_PHONE_NUMBER_ID=109283746592019
WHATSAPP_API_VERSION=v20.0
WHATSAPP_TEMPLATE_NAME=task_reminder

# Vercel Cron Secret (protects /api/cron/reminders)
CRON_SECRET=your_secure_cron_secret_string_here
```

### 6. Create Meta Developer App
1. Go to [Meta for Developers](https://developers.facebook.com/).
2. Log in and click **My Apps > Create App**.
3. Select **Other** as the use case and choose **Business** as the app type.
4. Enter an App Name (e.g. `AutoRemind-WhatsApp`) and link your Meta Business Account.

### 7. Configure WhatsApp Business Platform
1. On the App Dashboard, scroll to **WhatsApp** and click **Set up**.
2. Select your WhatsApp Business Account (WABA).
3. Navigate to **WhatsApp > API Setup** in the left sidebar.

### 8. Obtain Phone Number ID
1. On the **API Setup** page, locate the **Phone number ID** for your business sender `+91 9061082040`.
2. Copy this ID into `WHATSAPP_PHONE_NUMBER_ID` in `.env.local`.

### 9. Obtain Access Token
1. For development, copy the **Temporary access token** from the API Setup page.
2. For production, create a **System User** with the `whatsapp_business_messaging` permission in **Meta Business Manager > Users > System Users**, generate a **Permanent Access Token**, and paste it into `WHATSAPP_ACCESS_TOKEN`.

### 10. Create and Get the WhatsApp Template Approved
1. In Meta WhatsApp Manager, navigate to **Message Templates**.
2. Click **Create Template**:
   - **Category**: Utility
   - **Name**: `task_reminder`
   - **Language**: English (`en` or `en_US`)
3. Body text format:
```
🔔 Task Reminder

Tomorrow ({{1}}) you have:
📌 {{2}}

Please complete the task on time.
```
4. Provide sample values:
   - `{{1}}`: `20 August 2026`
   - `{{2}}`: `Motion graphics`
5. Submit for review (Approval is usually automatic within minutes for Utility templates).

### 11. Configure Webhook (Optional for Inbound Statuses)
1. Go to **WhatsApp > Configuration > Edit Webhook**.
2. Set Callback URL to `https://your-vercel-domain.vercel.app/api/whatsapp/webhook`.
3. Subscribe to the `messages` field to receive delivery status receipts.

### 12. Configure Vercel Project
1. Push your code to GitHub / GitLab.
2. Go to [Vercel Dashboard](https://vercel.com) and click **Add New > Project**.
3. Import the repository.
4. Add all environment variables from step 5 to your Vercel Project Settings.

### 13. Configure Vercel Cron
1. The repository includes [`vercel.json`](vercel.json):
```json
{
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "*/15 * * * *"
    }
  ]
}
```
2. Vercel Cron automatically triggers `GET /api/cron/reminders` every 15 minutes.
3. It passes `Authorization: Bearer <CRON_SECRET>` securely.

### 14. Deploy
1. Click **Deploy** in Vercel.
2. Verify that the build succeeds with 0 TypeScript errors.

### 15. Test WhatsApp Sending
1. Open the application in your browser and visit `/settings`.
2. Click **Send Live WhatsApp Test**.
3. Verify that the recipient phone `+91 7025219962` receives the reminder message and that the Meta Message ID is displayed in the live response box.

### 16. Test PDF Extraction
1. Navigate to `/upload`.
2. Drag and drop your calendar PDF (or sample calendar).
3. Click **Extract Calendar Tasks**.
4. Verify the detected tasks:
   - *Motion graphics* on 20 August 2026 ➔ Reminder date: 19 August 2026
   - *Poster 5* on 25 August 2026 ➔ Reminder date: 24 August 2026
   - *Scripted*, *Poster 4*, *Poster 6*, etc.
5. Click **Approve & Save All** to schedule the automated reminders.

### 17. Troubleshooting Guide

| Problem | Cause | Solution |
|---|---|---|
| `Meta API Error [190]: Invalid OAuth access token` | Expired or invalid token | Generate a Permanent Access Token in Meta Business Manager and update `WHATSAPP_ACCESS_TOKEN`. |
| `Meta API Error [132000]: Template does not exist` | Template name mismatch or not approved | Ensure `WHATSAPP_TEMPLATE_NAME` matches the exact name approved in Meta WhatsApp Manager. |
| `Meta API Error [100]: Invalid parameter` | Recipient number format issue | Ensure recipient phone includes country code (e.g. `+91 7025219962` or `917025219962`). |
| `Cron returns 401 Unauthorized` | Missing or incorrect `CRON_SECRET` | Ensure `CRON_SECRET` matches in Vercel Project Settings and Vercel Cron header. |
| `Reminder not sending at 6:00 PM IST` | Timezone mismatch | Ensure `settings.timezone` is set to `Asia/Kolkata` (default). |

---

## 🔒 Security & Reliability Guarantees
- **Official Meta Cloud API Only**: Zero reliance on Puppeteer, Web automation, or unofficial reverse-engineered protocols.
- **Server-Side Isolation**: All Meta WhatsApp credentials and tokens are strictly kept on the server and never sent to browser components.
- **Atomic Locking**: Uses `status = 'processing'` with row-level locks so concurrent cron invocations cannot double-send reminders.
- **Strict Verification**: Tasks are only marked `sent` after the Meta Graph API returns HTTP 200 and a valid `messages[0].id`.
