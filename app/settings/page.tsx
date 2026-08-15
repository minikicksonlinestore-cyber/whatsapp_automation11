'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Phone,
  Clock,
  Globe,
  FileText,
  Send,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  Key,
  Database,
  Lock,
} from 'lucide-react';
import { Settings } from '@/lib/types/database';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    id: '',
    business_phone: '+91 9061082040',
    recipient_phone: '+91 7025219962',
    reminder_time: '18:00:00',
    timezone: 'Asia/Kolkata',
    whatsapp_template_name: 'task_reminder',
    message_template: `🔔 Task Reminder

Tomorrow ({{date}}) you have:
📌 {{task}}

Please complete the task on time.`,
    updated_at: '',
  });

  const [envConfig, setEnvConfig] = useState<{
    isTokenConfigured: boolean;
    isPhoneIdConfigured: boolean;
    apiVersion: string;
    isCronSecretConfigured: boolean;
  }>({
    isTokenConfigured: false,
    isPhoneIdConfigured: false,
    apiVersion: 'v20.0',
    isCronSecretConfigured: false,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingWhatsApp, setTestingWhatsApp] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testResult, setTestResult] = useState<any | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.settings) {
        setSettings(data.settings);
      }
      if (data.envConfig) {
        setEnvConfig(data.envConfig);
      }
    } catch (err: any) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setToastMessage(null);

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setToastMessage({ type: 'success', text: 'Settings saved successfully.' });
      } else {
        setToastMessage({ type: 'error', text: data.error || 'Failed to update settings.' });
      }
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestMessage = async () => {
    try {
      setTestingWhatsApp(true);
      setTestResult(null);
      setToastMessage(null);

      const res = await fetch('/api/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_phone: settings.recipient_phone,
          template_name: settings.whatsapp_template_name,
        }),
      });

      const data = await res.json();
      setTestResult(data);

      if (res.ok && data.success) {
        setToastMessage({
          type: 'success',
          text: `Test message dispatched successfully to ${settings.recipient_phone}! (Meta ID: ${data.messageId})`,
        });
      } else {
        setToastMessage({
          type: 'error',
          text: data.error || 'Failed to dispatch test WhatsApp message.',
        });
      }
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err.message });
    } finally {
      setTestingWhatsApp(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between shadow-sm transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center space-x-3">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            )}
            <p className="text-sm font-medium">{toastMessage.text}</p>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-xs font-semibold hover:underline opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          System Settings & WhatsApp Meta API
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Configure default recipient numbers, reminder timeframes, timezone, and verify live Meta Cloud API connectivity.
        </p>
      </div>

      {/* Environment Diagnostics Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-2">
          <Key className="w-4 h-4 text-brand-600" />
          <span>Meta WhatsApp Cloud API Configuration Status</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 block">WhatsApp Access Token</span>
            <div className="flex items-center space-x-1.5 mt-1 font-bold text-xs">
              {envConfig.isTokenConfigured ? (
                <span className="text-emerald-700 flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Configured in Env</span>
                </span>
              ) : (
                <span className="text-amber-600 flex items-center space-x-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Not Set in .env</span>
                </span>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 block">Phone Number ID</span>
            <div className="flex items-center space-x-1.5 mt-1 font-bold text-xs">
              {envConfig.isPhoneIdConfigured ? (
                <span className="text-emerald-700 flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Configured in Env</span>
                </span>
              ) : (
                <span className="text-amber-600 flex items-center space-x-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Not Set in .env</span>
                </span>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 block">Meta API Version</span>
            <div className="mt-1 font-bold text-xs text-slate-800 font-mono">
              {envConfig.apiVersion}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 block">Vercel Cron Secret</span>
            <div className="flex items-center space-x-1.5 mt-1 font-bold text-xs">
              {envConfig.isCronSecretConfigured ? (
                <span className="text-emerald-700 flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Active & Protected</span>
                </span>
              ) : (
                <span className="text-slate-500 flex items-center space-x-1">
                  <span>Open / Dev Mode</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <h2 className="text-lg font-bold text-slate-900 border-b pb-3">
            Automation & Template Settings
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sender Business Number (Readonly per brief) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Meta Business Sender Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={settings.business_phone}
                  readOnly
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-mono text-sm font-semibold cursor-not-allowed"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Configured business sender: +91 9061082040
              </p>
            </div>

            {/* Default Recipient */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Default Target Recipient Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-brand-600 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={settings.recipient_phone}
                  onChange={(e) => setSettings({ ...settings, recipient_phone: e.target.value })}
                  placeholder="+91 7025219962"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono text-sm font-semibold"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Default recipient for WhatsApp reminders (+91 7025219962)
              </p>
            </div>

            {/* Reminder Time */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Automated Daily Reminder Time
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="time"
                  required
                  value={settings.reminder_time.substring(0, 5)}
                  onChange={(e) => setSettings({ ...settings, reminder_time: e.target.value + ':00' })}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm font-semibold font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Dispatches at this time on the day prior (Default: 18:00 / 6:00 PM)
              </p>
            </div>

            {/* Timezone */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Scheduler Timezone
              </label>
              <div className="relative">
                <Globe className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <select
                  value={settings.timezone}
                  onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm font-semibold bg-white"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST - UTC+05:30)</option>
                  <option value="UTC">UTC (Coordinated Universal Time)</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                </select>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Evaluation timezone for cron execution
              </p>
            </div>
          </div>

          {/* Template Configuration */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Meta WhatsApp Template Name
              </label>
              <input
                type="text"
                required
                value={settings.whatsapp_template_name}
                onChange={(e) => setSettings({ ...settings, whatsapp_template_name: e.target.value })}
                placeholder="task_reminder"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono text-sm font-semibold"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Name of the approved template in your Meta WhatsApp Business Manager.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Template Preview & Structure
              </label>
              <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 font-mono text-xs text-slate-800 whitespace-pre-wrap">
                {settings.message_template}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Parameters: {'{{1}}'} = Tomorrow&apos;s Task Date (e.g. 20 August 2026), {'{{2}}'} = Task Name (e.g. Motion graphics)
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-bold shadow-md transition-all flex items-center space-x-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving Settings...</span>
                </>
              ) : (
                <span>Save Configuration</span>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Live Test WhatsApp Message Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Live Meta WhatsApp Cloud API Test
            </h2>
            <p className="text-xs text-slate-500">
              Send a verified test reminder to <span className="font-semibold text-slate-800">{settings.recipient_phone}</span> via Meta Cloud API.
            </p>
          </div>

          <button
            onClick={handleSendTestMessage}
            disabled={testingWhatsApp}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow transition-all disabled:opacity-50"
          >
            {testingWhatsApp ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Contacting Meta Cloud API...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Send Live WhatsApp Test</span>
              </>
            )}
          </button>
        </div>

        {/* Live response log output */}
        {testResult && (
          <div className="mt-4 p-4 rounded-xl bg-slate-900 text-slate-200 font-mono text-xs space-y-2 overflow-x-auto">
            <div className="flex justify-between items-center text-[11px] text-slate-400 border-b border-slate-800 pb-1">
              <span>Meta Graph API Response Details:</span>
              <span className={testResult.success ? 'text-emerald-400' : 'text-rose-400'}>
                {testResult.success ? 'Status: 200 OK' : 'Status: API Error'}
              </span>
            </div>
            <pre>{JSON.stringify(testResult, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
