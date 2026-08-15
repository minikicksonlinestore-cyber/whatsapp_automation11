'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  Trash2,
  Edit2,
  XCircle,
  RefreshCw,
  Calendar,
  Phone,
  Plus,
  X,
  Check,
  Download,
} from 'lucide-react';
import { Task, TaskStatus } from '@/lib/types/database';
import { formatReadableDate, calculateReminderDate } from '@/lib/date/calculator';

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Notifications
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit Modal State
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editForm, setEditForm] = useState<{
    task_name: string;
    task_date: string;
    reminder_time: string;
    recipient_phone: string;
  }>({
    task_name: '',
    task_date: '',
    reminder_time: '18:00:00',
    recipient_phone: '+917025219962',
  });

  // Create Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newForm, setNewForm] = useState({
    task_name: '',
    task_date: new Date().toISOString().split('T')[0],
    reminder_time: '18:00',
    recipient_phone: '+917025219962',
  });

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      params.append('limit', '100');

      const res = await fetch(`/api/tasks?${params.toString()}`);
      const data = await res.json();
      setTasks(data.tasks || []);
      setTotalCount(data.total || 0);
    } catch (err: any) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery, fromDate, toDate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTasks();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchTasks]);

  // Send single task now
  const handleSendNow = async (task: Task) => {
    try {
      setActionLoading(task.id);
      const res = await fetch(`/api/tasks/${task.id}/send-now`, { method: 'POST' });
      const data = await res.json();

      if (res.ok && data.success) {
        setToastMessage({
          type: 'success',
          text: `WhatsApp reminder for "${task.task_name}" sent successfully (ID: ${data.messageId})!`,
        });
        fetchTasks();
      } else {
        setToastMessage({
          type: 'error',
          text: data.error || 'Failed to dispatch WhatsApp message.',
        });
      }
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  // Cancel task reminder
  const handleCancelTask = async (task: Task) => {
    try {
      setActionLoading(task.id);
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      const data = await res.json();

      if (res.ok) {
        setToastMessage({ type: 'success', text: `Task "${task.task_name}" reminder cancelled.` });
        fetchTasks();
      } else {
        setToastMessage({ type: 'error', text: data.error });
      }
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  // Delete task
  const handleDeleteTask = async (task: Task) => {
    if (!confirm(`Are you sure you want to delete "${task.task_name}"?`)) return;

    try {
      setActionLoading(task.id);
      const res = await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
      const data = await res.json();

      if (res.ok) {
        setToastMessage({ type: 'success', text: `Deleted "${task.task_name}".` });
        fetchTasks();
      } else {
        setToastMessage({ type: 'error', text: data.error });
      }
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  // Edit task submission
  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setEditForm({
      task_name: task.task_name,
      task_date: task.task_date,
      reminder_time: task.reminder_time,
      recipient_phone: task.recipient_phone,
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;

    try {
      setActionLoading('edit-save');
      const res = await fetch(`/api/tasks/${editingTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      const data = await res.json();
      if (res.ok) {
        setToastMessage({ type: 'success', text: 'Task updated successfully.' });
        setEditingTask(null);
        fetchTasks();
      } else {
        setToastMessage({ type: 'error', text: data.error });
      }
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  // Create manual task submission
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading('create-save');
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_name: newForm.task_name,
          task_date: newForm.task_date,
          reminder_time: newForm.reminder_time + ':00',
          recipient_phone: newForm.recipient_phone,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setToastMessage({ type: 'success', text: 'Task added successfully.' });
        setCreateModalOpen(false);
        setNewForm({
          task_name: '',
          task_date: new Date().toISOString().split('T')[0],
          reminder_time: '18:00',
          recipient_phone: '+917025219962',
        });
        fetchTasks();
      } else {
        setToastMessage({ type: 'error', text: data.error });
      }
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  // Retry all failed
  const handleRetryFailed = async () => {
    try {
      setActionLoading('retry');
      const res = await fetch('/api/tasks/retry', { method: 'POST', body: JSON.stringify({}) });
      const data = await res.json();
      if (res.ok) {
        setToastMessage({
          type: 'success',
          text: `Retried ${data.totalRetried} tasks (${data.successCount} sent, ${data.failedCount} failed)`,
        });
        fetchTasks();
      } else {
        setToastMessage({ type: 'error', text: data.error });
      }
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast notification */}
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

      {/* Page Title & Top Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Tasks & Reminders
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Manage scheduled WhatsApp reminders, filter by status, edit dates, and monitor delivery confirmations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleRetryFailed}
            disabled={actionLoading === 'retry'}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${actionLoading === 'retry' ? 'animate-spin' : ''}`} />
            <span>Retry Failed</span>
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search task name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full py-2 px-3 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing (Locked)</option>
              <option value="sent">Delivered / Sent</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Date From */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-400">From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full py-1.5 px-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
            />
          </div>

          {/* Date To */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-400">To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full py-1.5 px-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
            />
          </div>
        </div>
      </div>

      {/* Task List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200 uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Task Name</th>
                <th className="py-3.5 px-4">Task Date</th>
                <th className="py-3.5 px-4">Reminder Date (-1 Day)</th>
                <th className="py-3.5 px-4">Time & Recipient</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Meta Message ID</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-brand-600 mb-2" />
                    Loading tasks...
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No tasks matching filters.
                  </td>
                </tr>
              ) : (
                tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Task Name */}
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <div>{task.task_name}</div>
                      {task.error_message && (
                        <div className="text-[11px] text-rose-600 mt-0.5 flex items-center space-x-1">
                          <AlertCircle className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate max-w-xs">{task.error_message}</span>
                        </div>
                      )}
                    </td>

                    {/* Task Date */}
                    <td className="py-3.5 px-4 text-slate-700 font-medium whitespace-nowrap">
                      {formatReadableDate(task.task_date)}
                    </td>

                    {/* Reminder Date */}
                    <td className="py-3.5 px-4 text-amber-700 font-medium whitespace-nowrap">
                      {formatReadableDate(task.reminder_date)}
                    </td>

                    {/* Time & Recipient */}
                    <td className="py-3.5 px-4 text-slate-600 text-xs font-mono whitespace-nowrap">
                      <div>{task.reminder_time}</div>
                      <div className="text-slate-400">{task.recipient_phone}</div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
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

                    {/* Meta Message ID */}
                    <td className="py-3.5 px-4 text-slate-500 text-xs font-mono whitespace-nowrap">
                      {task.whatsapp_message_id ? (
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] truncate max-w-[120px] inline-block" title={task.whatsapp_message_id}>
                          {task.whatsapp_message_id}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center space-x-1.5">
                        {/* Send Now Button */}
                        {task.status !== 'sent' && (
                          <button
                            onClick={() => handleSendNow(task)}
                            disabled={actionLoading === task.id}
                            className="p-1.5 text-brand-700 hover:text-brand-800 hover:bg-brand-50 rounded-lg transition-colors"
                            title="Send WhatsApp Reminder Now"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        )}

                        {/* Edit Button */}
                        <button
                          onClick={() => openEditModal(task)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit Task"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Cancel Reminder Button */}
                        {task.status === 'pending' && (
                          <button
                            onClick={() => handleCancelTask(task)}
                            className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Cancel Reminder"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDeleteTask(task)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Task"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Task Modal */}
      {editingTask && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-900 text-lg">Edit Task Details</h3>
              <button
                onClick={() => setEditingTask(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Task Name</label>
                <input
                  type="text"
                  required
                  value={editForm.task_name}
                  onChange={(e) => setEditForm({ ...editForm, task_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-brand-500 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Task Date</label>
                <input
                  type="date"
                  required
                  value={editForm.task_date}
                  onChange={(e) => setEditForm({ ...editForm, task_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-brand-500 font-medium"
                />
                <p className="text-[11px] text-amber-700 mt-1">
                  Reminder Date will be: {calculateReminderDate(editForm.task_date || '2026-08-20')} (1 day prior)
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reminder Time</label>
                <input
                  type="time"
                  required
                  value={editForm.reminder_time.substring(0, 5)}
                  onChange={(e) => setEditForm({ ...editForm, reminder_time: e.target.value + ':00' })}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-brand-500 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Recipient Phone</label>
                <input
                  type="text"
                  required
                  value={editForm.recipient_phone}
                  onChange={(e) => setEditForm({ ...editForm, recipient_phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-brand-500 font-medium"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'edit-save'}
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold shadow transition-all"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Task Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-900 text-lg">Create New Task</h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Task Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Motion graphics review"
                  value={newForm.task_name}
                  onChange={(e) => setNewForm({ ...newForm, task_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-brand-500 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Task Date</label>
                <input
                  type="date"
                  required
                  value={newForm.task_date}
                  onChange={(e) => setNewForm({ ...newForm, task_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-brand-500 font-medium"
                />
                <p className="text-[11px] text-amber-700 mt-1">
                  Reminder Date: {calculateReminderDate(newForm.task_date || '2026-08-20')} (1 day prior)
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reminder Time</label>
                <input
                  type="time"
                  required
                  value={newForm.reminder_time}
                  onChange={(e) => setNewForm({ ...newForm, reminder_time: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-brand-500 font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Recipient Phone</label>
                <input
                  type="text"
                  required
                  value={newForm.recipient_phone}
                  onChange={(e) => setNewForm({ ...newForm, recipient_phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-brand-500 font-medium"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'create-save'}
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold shadow transition-all"
                >
                  Create & Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
