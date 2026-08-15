'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Plus,
  Check,
  Calendar,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { ExtractedTask } from '@/lib/types/database';
import { calculateReminderDate, formatReadableDate } from '@/lib/date/calculator';

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Settings for extraction
  const [defaultYear, setDefaultYear] = useState<number>(2026);
  const [defaultRecipientPhone, setDefaultRecipientPhone] = useState<string>('+917025219962');
  const [defaultReminderTime, setDefaultReminderTime] = useState<string>('18:00');

  // Extraction Results & Preview Table
  const [pdfId, setPdfId] = useState<string | null>(null);
  const [extractedTasks, setExtractedTasks] = useState<ExtractedTask[]>([]);
  const [detectedSummary, setDetectedSummary] = useState<{ month?: number; year?: number; count: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      selectFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      selectFile(e.target.files[0]);
    }
  };

  const selectFile = (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.pdf') && selectedFile.type !== 'application/pdf') {
      setErrorMessage('Please select a valid PDF calendar file.');
      return;
    }
    setFile(selectedFile);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleExtract = async () => {
    if (!file) {
      setErrorMessage('Please select a PDF file first.');
      return;
    }

    try {
      setIsExtracting(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('defaultYear', defaultYear.toString());
      formData.append('defaultRecipientPhone', defaultRecipientPhone);
      formData.append('defaultReminderTime', defaultReminderTime + ':00');

      const res = await fetch('/api/pdf/extract', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to extract tasks from PDF.');
      }

      setPdfId(data.pdfId || null);
      setExtractedTasks(data.tasks.map((t: ExtractedTask, index: number) => ({
        ...t,
        id: `extracted-${index}-${Date.now()}`,
        approved: true,
      })));

      setDetectedSummary({
        month: data.detectedMonth,
        year: data.detectedYear,
        count: data.tasks.length,
      });

      setSuccessMessage(`Successfully extracted ${data.tasks.length} tasks from ${file.name}.`);
    } catch (err: any) {
      console.error('Extraction error:', err);
      setErrorMessage(err.message || 'Error parsing PDF calendar.');
    } finally {
      setIsExtracting(false);
    }
  };

  // Editing Handlers
  const handleTaskNameChange = (index: number, newName: string) => {
    setExtractedTasks(prev => {
      const updated = [...prev];
      updated[index].task_name = newName;
      return updated;
    });
  };

  const handleTaskDateChange = (index: number, newDate: string) => {
    setExtractedTasks(prev => {
      const updated = [...prev];
      updated[index].task_date = newDate;
      try {
        updated[index].reminder_date = calculateReminderDate(newDate);
      } catch {
        // keep old reminder date if invalid
      }
      return updated;
    });
  };

  const handleReminderTimeChange = (index: number, newTime: string) => {
    setExtractedTasks(prev => {
      const updated = [...prev];
      updated[index].reminder_time = newTime;
      return updated;
    });
  };

  const handleToggleApprove = (index: number) => {
    setExtractedTasks(prev => {
      const updated = [...prev];
      updated[index].approved = !updated[index].approved;
      return updated;
    });
  };

  const handleDeleteRow = (index: number) => {
    setExtractedTasks(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddRow = () => {
    const defaultDate = `2026-08-20`;
    const newTask: ExtractedTask = {
      id: `manual-${Date.now()}`,
      task_name: 'New Task',
      task_date: defaultDate,
      reminder_date: calculateReminderDate(defaultDate),
      reminder_time: defaultReminderTime + ':00',
      recipient_phone: defaultRecipientPhone,
      month: 8,
      year: defaultYear,
      approved: true,
    };
    setExtractedTasks(prev => [...prev, newTask]);
  };

  const handleSelectAll = (approve: boolean) => {
    setExtractedTasks(prev => prev.map(t => ({ ...t, approved: approve })));
  };

  // Submit and Approve to Supabase
  const handleApproveAndSave = async () => {
    const approvedTasks = extractedTasks.filter(t => t.approved && t.task_name.trim().length > 0);

    if (approvedTasks.length === 0) {
      setErrorMessage('Please select and approve at least one valid task before saving.');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);

      const res = await fetch('/api/tasks/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks: approvedTasks,
          pdfId,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save approved tasks to database.');
      }

      setSuccessMessage(`Successfully saved ${data.count} approved tasks into automated schedule.`);
      setTimeout(() => {
        router.push('/tasks');
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error saving approved tasks.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Page Header */}
      <div>
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Intelligent Calendar Parser</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Upload Calendar & Extract Reminders
        </h1>
        <p className="text-slate-600 text-sm mt-1">
          Upload your PDF calendar (e.g. Motion graphics, Poster 4, Scripted, Poster 5, Poster 6). The engine recognizes calendar grids, extracts tasks, and sets reminders 1 day prior at 6:00 PM IST.
        </p>
      </div>

      {/* Error & Success Messages */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center space-x-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Grid: Upload Box + Extraction Parameters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Drag & Drop Zone */}
        <div className="lg:col-span-2">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-brand-500 bg-brand-50/50 scale-[1.01]'
                : file
                ? 'border-emerald-300 bg-emerald-50/30'
                : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="max-w-md mx-auto space-y-4">
              <div
                className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center transition-all ${
                  file ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-50 text-brand-600'
                }`}
              >
                {file ? <FileText className="w-8 h-8" /> : <UploadCloud className="w-8 h-8" />}
              </div>

              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  {file ? file.name : 'Click to select or drag and drop calendar PDF'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {file
                    ? `${(file.size / 1024).toFixed(1)} KB • Ready for extraction`
                    : 'Supports single & multi-page calendar PDFs with grid layouts'}
                </p>
              </div>

              {file && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExtract();
                    }}
                    disabled={isExtracting}
                    className="inline-flex items-center space-x-2 bg-brand-600 hover:bg-brand-500 text-white font-bold px-6 py-3 rounded-xl shadow-md transition-all hover:scale-105 disabled:opacity-50 text-sm"
                  >
                    {isExtracting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Parsing Calendar Structure...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Extract Calendar Tasks</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Calendar Extraction Settings */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center space-x-2.5">
            <Calendar className="w-5 h-5 text-brand-600" />
            <h3 className="font-bold text-slate-900 text-sm">Extraction Settings</h3>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Calendar Fallback Year
              </label>
              <input
                type="number"
                value={defaultYear}
                onChange={(e) => setDefaultYear(parseInt(e.target.value, 10) || 2026)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
              />
              <p className="text-[11px] text-slate-400 mt-0.5">Used if year is implicit in PDF (default: 2026)</p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Default Recipient Phone
              </label>
              <input
                type="text"
                value={defaultRecipientPhone}
                onChange={(e) => setDefaultRecipientPhone(e.target.value)}
                placeholder="+91 7025219962"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Default Reminder Time (IST)
              </label>
              <input
                type="time"
                value={defaultReminderTime}
                onChange={(e) => setDefaultReminderTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
              />
              <p className="text-[11px] text-slate-400 mt-0.5">Default: 18:00 (6:00 PM IST, 1 day prior)</p>
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs text-slate-600 space-y-1.5">
            <div className="flex items-center space-x-1.5 font-semibold text-slate-800">
              <ShieldCheck className="w-4 h-4 text-brand-600" />
              <span>Safe Extraction Guarantee</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Tasks are not saved to the database automatically. You will preview and verify every row below before approval.
            </p>
          </div>
        </div>
      </div>

      {/* Editable Extraction Preview Table */}
      {extractedTasks.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden space-y-4">
          <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-slate-900">
                  Extraction Preview & Review Table
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-100 text-brand-800">
                  {extractedTasks.filter(t => t.approved).length} of {extractedTasks.length} Approved
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Review dates and task titles. Reminder dates are automatically computed as (Task Date - 1 day).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleSelectAll(true)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => handleSelectAll(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all"
              >
                Deselect All
              </button>
              <button
                type="button"
                onClick={handleAddRow}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Row</span>
              </button>
              <button
                type="button"
                onClick={handleApproveAndSave}
                disabled={isSaving || extractedTasks.filter(t => t.approved).length === 0}
                className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold transition-all shadow-md flex items-center space-x-2 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving to Database...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Approve & Schedule All ({extractedTasks.filter(t => t.approved).length})</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto px-4 pb-4">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-100/80 text-slate-600 font-bold uppercase text-[11px] tracking-wider rounded-lg">
                <tr>
                  <th className="py-3 px-3 w-12 text-center">Approve</th>
                  <th className="py-3 px-4 min-w-[200px]">Task Name</th>
                  <th className="py-3 px-4 min-w-[150px]">Task Date</th>
                  <th className="py-3 px-4 min-w-[160px]">Reminder Date (-1 Day)</th>
                  <th className="py-3 px-4 min-w-[120px]">Reminder Time</th>
                  <th className="py-3 px-4 min-w-[130px]">Recipient Phone</th>
                  <th className="py-3 px-3 text-center w-12">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {extractedTasks.map((task, idx) => (
                  <tr
                    key={task.id || idx}
                    className={`transition-colors ${task.approved ? 'bg-white' : 'bg-slate-50/70 opacity-60'}`}
                  >
                    {/* Approve Checkbox */}
                    <td className="py-3 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={Boolean(task.approved)}
                        onChange={() => handleToggleApprove(idx)}
                        className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 border-slate-300 cursor-pointer"
                      />
                    </td>

                    {/* Task Name Input */}
                    <td className="py-3 px-4">
                      <input
                        type="text"
                        value={task.task_name}
                        onChange={(e) => handleTaskNameChange(idx, e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-slate-900 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500"
                        placeholder="e.g. Motion graphics, Poster 4"
                      />
                    </td>

                    {/* Task Date Input */}
                    <td className="py-3 px-4">
                      <input
                        type="date"
                        value={task.task_date}
                        onChange={(e) => handleTaskDateChange(idx, e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs sm:text-sm font-medium text-slate-800 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500"
                      />
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {formatReadableDate(task.task_date)}
                      </span>
                    </td>

                    {/* Calculated Reminder Date (Readonly display) */}
                    <td className="py-3 px-4">
                      <div className="px-2.5 py-1.5 bg-amber-50/80 border border-amber-200/70 rounded-lg text-amber-900 font-semibold text-xs">
                        {formatReadableDate(task.reminder_date || '')}
                      </div>
                      <span className="text-[10px] text-amber-600/80 block mt-0.5">
                        ISO: {task.reminder_date}
                      </span>
                    </td>

                    {/* Reminder Time Input */}
                    <td className="py-3 px-4">
                      <input
                        type="time"
                        value={task.reminder_time?.substring(0, 5) || '18:00'}
                        onChange={(e) => handleReminderTimeChange(idx, e.target.value + ':00')}
                        className="w-full px-2 py-1.5 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500"
                      />
                    </td>

                    {/* Recipient Phone */}
                    <td className="py-3 px-4">
                      <input
                        type="text"
                        value={task.recipient_phone || defaultRecipientPhone}
                        onChange={(e) => {
                          const val = e.target.value;
                          setExtractedTasks(prev => {
                            const updated = [...prev];
                            updated[idx].recipient_phone = val;
                            return updated;
                          });
                        }}
                        className="w-full px-2 py-1.5 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500"
                      />
                    </td>

                    {/* Delete Action */}
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        title="Remove row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom Action Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="text-xs text-slate-500">
              Only rows with checked boxes will be scheduled for WhatsApp delivery.
            </div>
            <button
              type="button"
              onClick={handleApproveAndSave}
              disabled={isSaving || extractedTasks.filter(t => t.approved).length === 0}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-bold shadow-md transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Approve & Save {extractedTasks.filter(t => t.approved).length} Reminders</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
