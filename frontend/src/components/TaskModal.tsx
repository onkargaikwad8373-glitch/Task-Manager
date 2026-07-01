/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Calendar as CalendarIcon, 
  Clock, 
  AlertTriangle, 
  CheckSquare, 
  Pin, 
  Copy, 
  Trash2,
  Bookmark
} from 'lucide-react';
import { Task, Priority, TaskStatus } from '../types';
import { toLocalDateString } from '../utils/dateUtils';

interface TaskModalProps {
  task: Task | null; // null if creating a new task
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskData: any) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
}

export default function TaskModal({
  task,
  isOpen,
  onClose,
  onSave,
  onDelete,
  onDuplicate,
}: TaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [status, setStatus] = useState<TaskStatus>('Pending');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [reminderTime, setReminderTime] = useState<string | null>(null);

  // Hydrate form on opening or task changing
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setPriority(task.priority);
      setStatus(task.status);
      setDueDate(task.dueDate);
      setDueTime(task.dueTime);
      setIsPinned(task.isPinned);
      setReminderTime(task.reminderTime);
    } else {
      // Create defaults
      setTitle('');
      setDescription('');
      setPriority('MEDIUM');
      setStatus('Pending');
      setDueDate(toLocalDateString());
      setDueTime('12:00');
      setIsPinned(false);
      setReminderTime(null);
    }
  }, [task, isOpen]);

  if (!isOpen) return null;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSave({
      id: task?.id,
      title: title.trim(),
      description: description.trim(),
      category: '', // Handled manually, set to default empty string
      priority,
      status,
      dueDate,
      dueTime,
      tags: [],
      isPinned,
      reminderTime,
      notes: '',
      attachments: [],
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div 
        id="task-config-modal"
        className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-2xl shadow-2xl p-6 relative flex flex-col gap-6 my-8"
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-500 hover:text-slate-300 transition cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Title */}
        <div className="text-left flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-bold text-white">
              {task ? 'Edit Task' : 'Create New Task'}
            </h2>
          </div>

          <div className="flex items-center gap-2 mr-6">
            {/* Pin Toggle */}
            <button
              type="button"
              onClick={() => setIsPinned(!isPinned)}
              className={`p-1.5 rounded-lg border transition cursor-pointer ${
                isPinned 
                  ? 'bg-blue-600/20 text-blue-400 border-blue-500/30' 
                  : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-slate-300'
              }`}
              title="Pin Task to Top"
            >
              <Pin className="h-4 w-4" />
            </button>

            {/* Quick Actions if editing */}
            {task && onDuplicate && (
              <button
                type="button"
                onClick={() => {
                  onDuplicate(task.id);
                  onClose();
                }}
                className="p-1.5 bg-slate-800 text-slate-400 border border-slate-700 rounded-lg hover:text-slate-200 hover:border-slate-600 transition cursor-pointer"
                title="Duplicate Task"
              >
                <Copy className="h-4 w-4" />
              </button>
            )}

            {task && onDelete && (
              <button
                type="button"
                onClick={() => {
                  onDelete(task.id);
                  onClose();
                }}
                className="p-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition cursor-pointer"
                title="Delete Task"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Task Form */}
        <form onSubmit={handleFormSubmit} className="space-y-5 text-left">
          
          {/* Main Title Field */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wide block">Task Title</label>
            <input
              id="task-title-input"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-blue-500 font-sans"
              placeholder="What needs to be done?"
            />
          </div>

          {/* Description field */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wide block">Description</label>
            <textarea
              id="task-desc-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-blue-500 resize-none h-24 leading-relaxed font-sans"
              placeholder="Enter task details..."
            />
          </div>

          {/* Core Selectors Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Priority Select */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-slate-500" />
                <span>Priority</span>
              </label>
              <select
                id="task-priority-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-blue-500 font-sans cursor-pointer"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
              </select>
            </div>

            {/* Status Select */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                <Bookmark className="h-3.5 w-3.5 text-slate-500" />
                <span>Status</span>
              </label>
              <select
                id="task-status-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-blue-500 font-sans cursor-pointer"
              >
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
                <option value="Overdue">Overdue</option>
              </select>
            </div>

          </div>

          {/* Due dates row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Due Date picker */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5 text-slate-500" />
                <span>Due Date</span>
              </label>
              <input
                id="task-duedate-input"
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            {/* Due Time picker */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-slate-500" />
                <span>Due Time & Reminder</span>
              </label>
              <div className="flex gap-2">
                <input
                  id="task-duetime-input"
                  type="time"
                  required
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-blue-500 font-mono"
                />
                
                {/* Reminder Dropdown */}
                <select
                  id="task-reminder-select"
                  value={reminderTime || ''}
                  onChange={(e) => setReminderTime(e.target.value || null)}
                  className="bg-slate-950 border border-slate-800 text-slate-400 text-[10px] rounded-xl px-2 py-1.5 focus:outline-none focus:border-blue-500 font-sans shrink-0 max-w-[120px] cursor-pointer"
                >
                  <option value="">No Reminder</option>
                  <option value="09:00">09:00 AM</option>
                  <option value="12:00">12:00 PM</option>
                  <option value="15:00">03:00 PM</option>
                  <option value="18:00">06:00 PM</option>
                </select>
              </div>
            </div>

          </div>

          {/* Submission Row */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="save-task-btn"
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-lg shadow-blue-500/10 hover:shadow-blue-500/25"
            >
              {task ? 'Save Changes' : 'Create Task'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
