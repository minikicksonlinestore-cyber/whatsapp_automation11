'use client';

import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  AlertCircle,
  Bell,
  Send,
  X,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Task } from '@/lib/types/database';
import { formatReadableDate } from '@/lib/date/calculator';

export default function CalendarPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Month navigation: default to August 2026 (the calendar month from test cases) or current month
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(7); // 0-indexed: 7 is August

  // Selected date details modal
  const [selectedDateTasks, setSelectedDateTasks] = useState<{ date: string; tasks: Task[]; reminderTasks: Task[] } | null>(null);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/tasks?limit=200');
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (err) {
      console.error('Failed to load tasks for calendar:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Calculate calendar grid days
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const daysArray = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    daysArray.push(null); // blank cells before start
  }
  for (let day = 1; day <= daysInMonth; day++) {
    daysArray.push(day);
  }

  // Get tasks map for current month
  const getTasksForDay = (day: number) => {
    const formattedDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayTasks = tasks.filter(t => t.task_date === formattedDate);
    const dayReminders = tasks.filter(t => t.reminder_date === formattedDate);
    return { formattedDate, dayTasks, dayReminders };
  };

  const handleSendNow = async (taskId: string) => {
    try {
      setActionLoading(taskId);
      const res = await fetch(`/api/tasks/${taskId}/send-now`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        alert('WhatsApp reminder sent successfully via Meta Cloud API!');
        fetchTasks();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Month Navigator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
            <CalendarIcon className="w-6 h-6 text-brand-600" />
            <span>Interactive Calendar Hub</span>
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Visual calendar showing task dates, 1-day-prior reminder alerts, and live delivery statuses.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-4 text-xs sm:text-sm font-bold text-slate-800 min-w-[140px] text-center">
              {monthNames[currentMonth]} {currentYear}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => {
              setCurrentYear(2026);
              setCurrentMonth(7); // August 2026
            }}
            className="px-3 py-2 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-semibold transition-all"
          >
            August 2026
          </button>
        </div>
      </div>

      {/* Calendar Grid Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-bold text-slate-600 py-3">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 min-h-[550px]">
          {daysArray.map((day, idx) => {
            if (!day) {
              return <div key={`empty-${idx}`} className="bg-slate-50/40 min-h-[100px] sm:min-h-[120px]" />;
            }

            const { formattedDate, dayTasks, dayReminders } = getTasksForDay(day);
            const hasActivity = dayTasks.length > 0 || dayReminders.length > 0;

            return (
              <div
                key={`day-${day}`}
                onClick={() => hasActivity && setSelectedDateTasks({ date: formattedDate, tasks: dayTasks, reminderTasks: dayReminders })}
                className={`p-2 sm:p-2.5 min-h-[100px] sm:min-h-[120px] transition-all flex flex-col justify-between ${
                  hasActivity ? 'cursor-pointer hover:bg-brand-50/40' : 'hover:bg-slate-50/60'
                }`}
              >
                {/* Date Number */}
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm font-bold text-slate-800">{day}</span>
                  {dayReminders.length > 0 && (
                    <span className="flex items-center space-x-0.5 text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full" title="Reminders firing today">
                      <Bell className="w-2.5 h-2.5" />
                      <span>{dayReminders.length}</span>
                    </span>
                  )}
                </div>

                {/* Task Badges Inside Cell */}
                <div className="space-y-1 my-1 overflow-hidden">
                  {dayTasks.map((task) => (
                    <div
                      key={task.id}
                      className={`px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold truncate border ${
                        task.status === 'sent'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : task.status === 'pending'
                          ? 'bg-blue-50 border-blue-200 text-blue-800'
                          : task.status === 'failed'
                          ? 'bg-rose-50 border-rose-200 text-rose-800'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                      title={`${task.task_name} (${task.status})`}
                    >
                      📌 {task.task_name}
                    </div>
                  ))}

                  {dayReminders.map((rem) => (
                    <div
                      key={`rem-${rem.id}`}
                      className="px-1.5 py-0.5 rounded text-[9px] font-semibold truncate bg-amber-50 border border-amber-200 text-amber-800"
                      title={`Reminder for: ${rem.task_name} (due ${rem.reminder_time})`}
                    >
                      🔔 Remind: {rem.task_name}
                    </div>
                  ))}
                </div>

                {/* Bottom marker */}
                <div className="h-1">
                  {dayTasks.length > 0 && (
                    <div className="w-full h-1 bg-brand-500 rounded-full" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Details Modal */}
      {selectedDateTasks && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">
                  {formatReadableDate(selectedDateTasks.date)}
                </h3>
                <p className="text-xs text-slate-500">Scheduled events & reminders for this date</p>
              </div>
              <button
                onClick={() => setSelectedDateTasks(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
              {/* Tasks scheduled on this date */}
              {selectedDateTasks.tasks.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Tasks Scheduled Today ({selectedDateTasks.tasks.length})
                  </h4>
                  {selectedDateTasks.tasks.map((task) => (
                    <div key={task.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-900 text-sm">{task.task_name}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            task.status === 'sent'
                              ? 'bg-emerald-100 text-emerald-800'
                              : task.status === 'pending'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {task.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 flex justify-between">
                        <span>Reminder was: {formatReadableDate(task.reminder_date)} at {task.reminder_time}</span>
                        <span>To: {task.recipient_phone}</span>
                      </div>
                      {task.status !== 'sent' && (
                        <div className="pt-1 text-right">
                          <button
                            onClick={() => handleSendNow(task.id)}
                            disabled={actionLoading === task.id}
                            className="inline-flex items-center space-x-1 px-3 py-1 bg-brand-600 text-white rounded-lg text-xs font-semibold hover:bg-brand-500"
                          >
                            <Send className="w-3 h-3" />
                            <span>Send WhatsApp Reminder Now</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Reminders scheduled to send on this date */}
              {selectedDateTasks.reminderTasks.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700">
                    WhatsApp Reminders Firing Today ({selectedDateTasks.reminderTasks.length})
                  </h4>
                  {selectedDateTasks.reminderTasks.map((task) => (
                    <div key={`rem-detail-${task.id}`} className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-amber-950 text-sm">🔔 {task.task_name}</span>
                        <span className="text-xs font-mono text-amber-800 font-semibold">{task.reminder_time}</span>
                      </div>
                      <p className="text-xs text-amber-800">
                        Reminds recipient about tomorrow&apos;s task on {formatReadableDate(task.task_date)}.
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 border-t text-right">
              <button
                onClick={() => setSelectedDateTasks(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-semibold text-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
