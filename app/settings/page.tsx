'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Phone,
  Clock,
  Globe,
  Send,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  MessageSquare,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Settings } from '@/lib/types/database';

interface WhatsAppGroup {
  id: string;
  name: string;
}

interface EnvConfig {
  isBaileysConfigured: boolean;
  isCronSecretConfigured: boolean;
  isTokenConfigured: boolean;
  isPhoneIdConfigured: boolean;
  apiVersion: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    id: '',
    business_phone: '+91 9061082040',
    recipient_phone: '+91 7025219962',
    reminder_time: '18:00:00',
    timezone: 'Asia/Kolkata',
    whatsapp_template_name: 'task_reminder',
    message_template: '',
    whatsapp_group_id: '',
    updated_at: '',
  });

  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');

  const [envConfig, setEnvConfig] = useState<EnvConfig>({
    isBaileysConfigured: false,
    isCronSecretConfigured: false,
    isTokenConfigured: false,
    isPhoneIdConfigured: false,
    apiVersion: 'v20.0',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingWhatsApp, setTestingWhatsApp] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testResult, setTestResult] = useState<any | null>(null);

  // Auto-dismiss toast after 6s
  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 6000);
    return () => clearTimeout(t);
  }, [toastMessage]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.settings) {
        setSettings(data.settings);
        setSelectedGroupId(data.settings.whatsapp_group_id || '');
      }
      if (data.groups) setGroups(data.groups);
      if (data.envConfig) setEnvConfig(data.envConfig);
    } catch (err: any) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setToastMessage(null);

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          whatsapp_group_id: selectedGroupId || null,
        }),
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
        body: JSON.stringify({ group_id: selectedGroupId }),
      });

      const data = await res.json();
      setTestResult(data);

      if (res.ok && data.success) {
        setToastMessage({
          type: 'success',
          text: `✅ Test message sent to "${data.groupName}"! Message ID: ${data.messageId}`,
        });
      } else {
        setToastMessage({
          type: 'error',
          text: data.error || 'Failed to send test message.',
        });
      }
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err.message });
    } finally {
      setTestingWhatsApp(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
        <span className="ml-2 text-slate-500">Loading settings...</span>
      </div>
    );
  }

  const selectedGroup = groups.find(g => g.id === selectedGroupId);

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
            className="text-xs font-semibold hover:underline opacity-80 ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          System Settings
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Configure WhatsApp group, reminder schedule, and verify connectivity.
        </p>
      </div>

      {/* Connection Status Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-2">
          <Wifi className="w-4 h-4" />
          <span>Connection Status</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-500 block">Baileys Gateway</span>
            <div className="flex items-center space-x-1.5 mt-1 font-bold text-xs">
              {envConfig.isBaileysConfigured ? (
                <span className="text-emerald-700 flex items-center space-x-1">
                  <Wifi className="w-3.5 h-3.5" />
                  <span>Configured</span>
                </span>
              ) : (
                <span className="text-amber-600 flex items-center space-x-1">
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>BAILEYS_GATEWAY_URL not set</span>
                </span>
              )}
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

      {/* WhatsApp Group Selector */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
          <MessageSquare className="w-5 h-5 text-emerald-600" />
          <span>WhatsApp Reminder Group</span>
        </h2>
        <p className="text-xs text-slate-500">
          Select the WhatsApp group where reminders will be sent. Your selection is saved to the database.
        </p>

        <div className="space-y-3">
          {groups.map(group => (
            <label
              key={group.id}
              className={`flex items-center space-x-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                selectedGroupId === group.id
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="whatsapp_group"
                value={group.id}
                checked={selectedGroupId === group.id}
                onChange={() => setSelectedGroupId(group.id)}
                className="accent-emerald-600"
              />
              <div>
                <div className="font-semibold text-sm text-slate-900">{group.name}</div>
                <div className="text-[11px] text-slate-400 font-mono">{group.id}</div>
              </div>
              {selectedGroupId === group.id && (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 ml-auto flex-shrink-0" />
              )}
            </label>
          ))}

          {groups.length === 0 && (
            <div className="text-sm text-slate-400 italic p-4 bg-slate-50 rounded-xl">
              No groups configured. Contact your administrator.
            </div>
          )}
        </div>

        {selectedGroup && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <div className="text-xs text-slate-500">
              Selected: <span className="font-semibold text-slate-800">{selectedGroup.name}</span>
            </div>
            <button
              onClick={async () => {
                setSaving(true);
                try {
                  const res = await fetch('/api/settings', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ whatsapp_group_id: selectedGroupId }),
                  });
                  const data = await res.json();
                  if (data.success) {
                    setToastMessage({ type: 'success', text: `Group "${selectedGroup.name}" saved.` });
                  } else {
                    setToastMessage({ type: 'error', text: data.error || 'Failed to save group.' });
                  }
                } catch (err: any) {
                  setToastMessage({ type: 'error', text: err.message });
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Group'}
            </button>
          </div>
        )}
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <h2 className="text-lg font-bold text-slate-900 border-b pb-3">
            Automation Settings
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Reminder Time */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Daily Reminder Time
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
                Sends the day before the task date (Default: 18:00)
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
            </div>

            {/* Default Recipient (kept for fallback) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Fallback Recipient Phone
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={settings.recipient_phone}
                  onChange={(e) => setSettings({ ...settings, recipient_phone: e.target.value })}
                  placeholder="+917025219962"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono text-sm"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Used as fallback if group send fails
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
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Configuration</span>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Send Test Message */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Send Test Message</h2>
            <p className="text-xs text-slate-500">
              Sends a real test reminder to{' '}
              <span className="font-semibold text-slate-800">
                {selectedGroup?.name || 'the configured group'}
              </span>{' '}
              via Baileys gateway.
            </p>
          </div>

          <button
            onClick={handleSendTestMessage}
            disabled={testingWhatsApp || !selectedGroupId}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow transition-all disabled:opacity-50"
          >
            {testingWhatsApp ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Sending via Gateway...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Send Test to Group</span>
              </>
            )}
          </button>
        </div>

        {/* Live response log */}
        {testResult && (
          <div className="mt-4 p-4 rounded-xl bg-slate-900 text-slate-200 font-mono text-xs space-y-2 overflow-x-auto">
            <div className="flex justify-between items-center text-[11px] text-slate-400 border-b border-slate-800 pb-1">
              <span>Baileys Gateway Response:</span>
              <span className={testResult.success ? 'text-emerald-400' : 'text-rose-400'}>
                {testResult.success
                  ? `✅ Delivered — messageId: ${testResult.messageId}`
                  : `❌ Failed`}
              </span>
            </div>
            <pre>{JSON.stringify(testResult, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
