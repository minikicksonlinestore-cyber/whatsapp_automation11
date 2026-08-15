'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Clock4,
  ArrowRight,
  Upload,
  Send,
  RefreshCw,
  Sparkles,
  PhoneCall,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { Task } from '@/lib/types/database';
import { formatReadableDate } from '@/lib/date/calculator';

interface DashboardStats {
  todayRemindersCount: number;
  tomorrowTasksCount: number;
  pendingCount: number;
  sentCount: number;
  failedCount: number;
  totalCount: number;
}

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    todayRemindersCount: 0,
    tomorrowTasksCount: 0,
    pendingCount: 0,
    sentCount: 0,
    failedCount: 0,
    totalCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/tasks?limit=200');
      const data = await res.json();
      const allTasks: Task[] = data.tasks || [];
      setTasks(allTasks);

      // Get today and tomorrow in YYYY-MM-DD
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const tomorrowObj = new Date(now.getTime() + 86400000);
      const tomorrowStr = tomorrowObj.toISOString().split('T')[0];

      const todayReminders = allTasks.filter(t => t.reminder_date === todayStr);
      const tomorrowTasks = allTasks.filter(t => t.task_date === tomorrowStr);
      const pending = allTasks.filter(t => t.status === 'pending');
      const sent = allTasks.filter(t => t.status === 'sent');
      const failed = allTasks.filter(t => t.status === 'failed');

      setStats({
        todayRemindersCount: todayReminders.length,
        tomorrowTasksCount: tomorrowTasks.length,
        pendingCount: pending.length,
        sentCount: sent.length,
        failedCount: failed.length,
        totalCount: allTasks.length,
      });
    } catch (err: any) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleSendNow = async (taskId: string) => {
    try {
      setActionLoading(taskId);
      const res = await fetch(`/api/tasks/${taskId}/send-now`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setToastMessage({ type: 'success', text: 'WhatsApp reminder sent successfully via Meta Cloud API!' });
        fetchDashboardData();
      } else {
        setToastMessage({ type: 'error', text: data.error || 'Failed to send WhatsApp message' });
      }
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRetryAllFailed = async () => {
    try {
      setActionLoading('retry-all');
      const res = await fetch('/api/tasks/retry', { method: 'POST', body: JSON.stringify({}) });
      const data = await res.json();
      if (res.ok) {
        setToastMessage({
          type: 'success',
          text: `Retried ${data.totalRetried} tasks (${data.successCount} sent, ${data.failedCount} failed)`,
        });
        fetchDashboardData();
      } else {
        setToastMessage({ type: 'error', text: data.error || 'Retry request failed' });
      }
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Toast notification banner */}
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

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-brand-950 to-brand-900 p-6 sm:p-8 rounded-2xl text-white shadow-xl">
        <div className="space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/20 text-brand-300 text-xs font-semibold border border-brand-500/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Automated WhatsApp Dispatching Active</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            WhatsApp PDF Reminder Hub
          </h1>
          <p className="text-slate-300 text-sm max-w-2xl">
            Automatically extracts calendar tasks and dispatches WhatsApp reminders 1 day prior at 6:00 PM IST via official Meta WhatsApp Cloud API.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/upload"
            className="flex items-center space-x-2 bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-lg transition-all hover:scale-105"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Calendar PDF</span>
          </Link>
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 text-white font-medium px-4 py-2.5 rounded-xl border border-white/20 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {/* Today's Reminders */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today&apos;s Reminders</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <BellRingIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-900">{stats.todayRemindersCount}</span>
            <p className="text-[11px] text-slate-500 mt-0.5">Due for send today</p>
          </div>
        </div>

        {/* Tomorrow's Tasks */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tomorrow&apos;s Tasks</span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-900">{stats.tomorrowTasksCount}</span>
            <p className="text-[11px] text-slate-500 mt-0.5">Scheduled for tomorrow</p>
          </div>
        </div>

        {/* Pending */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending</span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <Clock4 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-indigo-600">{stats.pendingCount}</span>
            <p className="text-[11px] text-slate-500 mt-0.5">Awaiting reminder date</p>
          </div>
        </div>

        {/* Sent */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Delivered</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-emerald-600">{stats.sentCount}</span>
            <p className="text-[11px] text-slate-500 mt-0.5">Confirmed via Meta API</p>
          </div>
        </div>

        {/* Failed */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Failed</span>
            <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-rose-600">{stats.failedCount}</span>
            <p className="text-[11px] text-slate-500 mt-0.5">Delivery errors</p>
          </div>
        </div>

        {/* Total Tasks */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Tasks</span>
            <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-slate-900">{stats.totalCount}</span>
            <p className="text-[11px] text-slate-500 mt-0.5">All tracked calendar tasks</p>
          </div>
        </div>
      </div>

      {/* Action Banners & Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: WhatsApp Configuration Info */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-brand-50 text-brand-600">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">WhatsApp Routing</h3>
              <p className="text-xs text-slate-500">Official Cloud API Gateway</p>
            </div>
          </div>
          <div className="text-xs space-y-2 text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-100 font-mono">
            <div className="flex justify-between">
              <span className="text-slate-500">Sender Business:</span>
              <span className="font-semibold text-slate-800">+91 9061082040</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Default Recipient:</span>
              <span className="font-semibold text-slate-800">+91 7025219962</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Timezone:</span>
              <span className="font-semibold text-slate-800">Asia/Kolkata (IST)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Scheduled Time:</span>
              <span className="font-semibold text-slate-800">18:00 (6:00 PM)</span>
            </div>
          </div>
          <Link
            href="/settings"
            className="flex items-center justify-between text-xs font-semibold text-brand-700 hover:text-brand-800 pt-1"
          >
            <span>Configure Settings & Test API</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Card 2: Upcoming Reminders Action */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Next Upcoming</h3>
              <p className="text-xs text-slate-500">Nearest scheduled reminder</p>
            </div>
          </div>
          {tasks.filter(t => t.status === 'pending').length > 0 ? (
            (() => {
              const nextTask = tasks.filter(t => t.status === 'pending')[0];
              return (
                <div className="bg-amber-50/60 border border-amber-100 p-3.5 rounded-xl text-xs space-y-1.5">
                  <div className="font-bold text-amber-900 text-sm truncate">{nextTask.task_name}</div>
                  <div className="text-amber-800">
                    Task Date: <span className="font-semibold">{formatReadableDate(nextTask.task_date)}</span>
                  </div>
                  <div className="text-amber-700">
                    Reminder: <span className="font-semibold">{formatReadableDate(nextTask.reminder_date)} at {nextTask.reminder_time}</span>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="bg-slate-50 p-4 rounded-xl text-xs text-slate-500 text-center">
              No pending reminders. Upload a PDF calendar to get started.
            </div>
          )}
          <Link
            href="/tasks"
            className="flex items-center justify-between text-xs font-semibold text-amber-700 hover:text-amber-800 pt-1"
          >
            <span>View All Tasks & Schedule</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Card 3: Failed Retry Banner */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Failed Message Queue</h3>
              <p className="text-xs text-slate-500">{stats.failedCount} failed delivery attempts</p>
            </div>
          </div>
          <p className="text-xs text-slate-600">
            Messages that encountered Meta API errors or network timeouts can be retried immediately in batch.
          </p>
          <div className="pt-2">
            <button
              onClick={handleRetryAllFailed}
              disabled={stats.failedCount === 0 || actionLoading === 'retry-all'}
              className="w-full flex items-center justify-center space-x-2 bg-rose-50 hover:bg-rose-100 text-rose-700 disabled:opacity-50 font-semibold px-4 py-2.5 rounded-xl border border-rose-200 text-xs transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${actionLoading === 'retry-all' ? 'animate-spin' : ''}`} />
              <span>Retry All Failed ({stats.failedCount})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Task Summary Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Active Tasks & Automated Reminders</h2>
            <p className="text-xs text-slate-500 mt-0.5">Showing newest scheduled calendar entries</p>
          </div>
          <div className="flex items-center space-x-3">
            <Link
              href="/calendar"
              className="text-xs font-semibold px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all flex items-center space-x-1.5"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>View Calendar</span>
            </Link>
            <Link
              href="/tasks"
              className="text-xs font-semibold px-3 py-2 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 transition-all flex items-center space-x-1.5"
            >
              <span>Manage All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Task Name</th>
                <th className="py-3 px-4">Task Date</th>
                <th className="py-3 px-4">Reminder Date (1 Day Prior)</th>
                <th className="py-3 px-4">Reminder Time</th>
                <th className="py-3 px-4">Recipient</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-brand-600 mb-2" />
                    Loading tasks and schedules...
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <div className="max-w-xs mx-auto space-y-3">
                      <FileText className="w-10 h-10 mx-auto text-slate-300" />
                      <p className="text-sm font-medium text-slate-700">No tasks found</p>
                      <p className="text-xs text-slate-400">Upload your PDF calendar to automatically extract tasks and schedule WhatsApp reminders.</p>
                      <Link
                        href="/upload"
                        className="inline-flex items-center space-x-2 bg-brand-600 text-white font-semibold px-4 py-2 rounded-lg text-xs hover:bg-brand-700 transition-all"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Calendar PDF</span>
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                tasks.slice(0, 10).map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {task.task_name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-medium">
                      {formatReadableDate(task.task_date)}
                    </td>
                    <td className="py-3.5 px-4 text-amber-700 font-medium">
                      {formatReadableDate(task.reminder_date)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono text-xs">
                      {task.reminder_time}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono text-xs">
                      {task.recipient_phone}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                          task.status === 'sent'
                            ? 'bg-emerald-100 text-emerald-800'
                            : task.status === 'pending'
                            ? 'bg-blue-100 text-blue-800'
                            : task.status === 'processing'
                            ? 'bg-amber-100 text-amber-800 animate-pulse'
                            : task.status === 'failed'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {task.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {task.status !== 'sent' && (
                        <button
                          onClick={() => handleSendNow(task.id)}
                          disabled={actionLoading === task.id}
                          className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 font-semibold text-xs transition-all disabled:opacity-50"
                          title="Trigger WhatsApp reminder immediately via Meta Cloud API"
                        >
                          <Send className={`w-3 h-3 ${actionLoading === task.id ? 'animate-spin' : ''}`} />
                          <span>Send Now</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function BellRingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}
