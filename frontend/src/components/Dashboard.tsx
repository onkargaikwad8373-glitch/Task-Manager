/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Calendar as CalendarIcon, 
  Clock, 
  AlertTriangle, 
  Trash2, 
  Plus, 
  Edit3, 
  Undo,
  Pin,
  Sparkles
} from 'lucide-react';
import { Task, Priority } from '../types';
import { toLocalDateString } from '../utils/dateUtils';

interface DashboardProps {
  tasks: Task[];
  onAddTask: (taskData: any) => void;
  onEditTask: (task: Task) => void;
  onToggleTaskStatus: (id: string, currentStatus: string) => void;
  onSoftDeleteTask: (id: string) => void;
  onToggleTaskPin: (id: string) => void;
}

export default function Dashboard({
  tasks,
  onAddTask,
  onEditTask,
  onToggleTaskStatus,
  onSoftDeleteTask,
  onToggleTaskPin,
}: DashboardProps) {
  // Compute dates locally
  const today = new Date();
  const todayStr = toLocalDateString(today);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toLocalDateString(yesterday);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = toLocalDateString(tomorrow);

  // Calendar View Filter states
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [viewMode, setViewMode] = useState<'date' | 'all'>('date');

  // Quick-Add State
  const [quickTitle, setQuickTitle] = useState('');
  const [quickDueDate, setQuickDueDate] = useState(todayStr);
  const [quickPriority, setQuickPriority] = useState<Priority>('MEDIUM');

  // Synchronize Quick-Add Date to selected filter date
  useEffect(() => {
    if (viewMode === 'date') {
      setQuickDueDate(selectedDate);
    }
  }, [selectedDate, viewMode]);

  // Filter tasks
  const activeTasks = tasks.filter(t => !t.isDeleted && !t.isArchived);
  
  // Sorted upcoming tasks: Pending or Overdue
  const upcomingTasks = activeTasks.filter(t => t.status !== 'Completed')
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return a.dueDate.localeCompare(b.dueDate);
    });

  // Sorted completed tasks
  const completedTasks = activeTasks.filter(t => t.status === 'Completed')
    .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));

  // Apply Date Filters
  const filteredUpcoming = upcomingTasks.filter(t => {
    if (viewMode === 'date') {
      return t.dueDate === selectedDate;
    }
    return true; // 'all'
  });

  const filteredCompleted = completedTasks.filter(t => {
    if (viewMode === 'date') {
      const taskCompletedDate = t.completedAt ? t.completedAt.split('T')[0] : '';
      return t.dueDate === selectedDate || taskCompletedDate === selectedDate;
    }
    return true; // 'all'
  });

  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;

    onAddTask({
      title: quickTitle.trim(),
      description: '',
      category: '',
      priority: quickPriority,
      status: 'Pending',
      dueDate: quickDueDate,
      dueTime: '12:00',
      tags: [],
      isPinned: false,
      reminderTime: null,
      notes: '',
      attachments: [],
    });

    setQuickTitle('');
    // Retain selectedDate if in date mode, otherwise today
    setQuickDueDate(viewMode === 'date' ? selectedDate : todayStr);
    setQuickPriority('MEDIUM');
  };

  const getPriorityColor = (p: Priority) => {
    switch (p) {
      case 'HIGH': return 'bg-rose-500/10 text-rose-400 border border-rose-500/25';
      case 'MEDIUM': return 'bg-amber-500/10 text-amber-400 border border-amber-500/25';
      case 'LOW': return 'bg-blue-500/10 text-blue-400 border border-blue-500/25';
    }
  };

  // Human readable title for lists
  const getDateLabel = () => {
    if (viewMode === 'all') return 'All Tasks';
    if (selectedDate === todayStr) return 'Today\'s Tasks';
    if (selectedDate === yesterdayStr) return 'Yesterday\'s Tasks';
    if (selectedDate === tomorrowStr) return 'Tomorrow\'s Tasks';
    return `Tasks for ${new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, { dateStyle: 'medium' })}`;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 text-left">
      
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#131B2E] border border-white/5 p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-blue-400 font-medium text-xs tracking-wider uppercase font-mono mb-1">
            <Sparkles className="h-4 w-4" />
            <span>Workspace</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Task Dashboard</h2>
          <p className="text-slate-400 text-xs mt-1">
            Manage your daily tasks and operations with ease.
          </p>
        </div>
        
        {/* Simple Task Counter Summary */}
        <div className="flex items-center gap-3 shrink-0 text-xs font-mono">
          <div className="bg-[#0b0f19] px-3.5 py-2 rounded-xl border border-white/5">
            <span className="text-slate-500 uppercase">Upcoming:</span>{' '}
            <span className="text-blue-400 font-bold">{upcomingTasks.length}</span>
          </div>
          <div className="bg-[#0b0f19] px-3.5 py-2 rounded-xl border border-white/5">
            <span className="text-slate-500 uppercase">Completed:</span>{' '}
            <span className="text-emerald-400 font-bold">{completedTasks.length}</span>
          </div>
        </div>
      </div>

      {/* Flexible Calendar & Date Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-[#131B2E] border border-white/5 p-2 rounded-2xl shadow-md">
        
        {/* Yesterday Shortcut */}
        <button
          type="button"
          onClick={() => {
            setSelectedDate(yesterdayStr);
            setViewMode('date');
          }}
          className={`px-4 py-2 text-xs font-bold rounded-xl capitalize transition cursor-pointer ${
            viewMode === 'date' && selectedDate === yesterdayStr
              ? 'bg-blue-600 text-white shadow shadow-blue-600/15' 
              : 'text-slate-400 hover:text-slate-250'
          }`}
        >
          Yesterday
        </button>

        {/* Today Shortcut */}
        <button
          type="button"
          onClick={() => {
            setSelectedDate(todayStr);
            setViewMode('date');
          }}
          className={`px-4 py-2 text-xs font-bold rounded-xl capitalize transition cursor-pointer ${
            viewMode === 'date' && selectedDate === todayStr
              ? 'bg-blue-600 text-white shadow shadow-blue-600/15' 
              : 'text-slate-400 hover:text-slate-250'
          }`}
        >
          Today
        </button>

        {/* Tomorrow Shortcut */}
        <button
          type="button"
          onClick={() => {
            setSelectedDate(tomorrowStr);
            setViewMode('date');
          }}
          className={`px-4 py-2 text-xs font-bold rounded-xl capitalize transition cursor-pointer ${
            viewMode === 'date' && selectedDate === tomorrowStr
              ? 'bg-blue-600 text-white shadow shadow-blue-600/15' 
              : 'text-slate-400 hover:text-slate-250'
          }`}
        >
          Tomorrow
        </button>

        {/* Arbitrary Custom Date Picker */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition ${
          viewMode === 'date' && selectedDate !== yesterdayStr && selectedDate !== todayStr && selectedDate !== tomorrowStr
            ? 'bg-blue-600/10 border-blue-500/30 text-blue-400' 
            : 'border-white/5 text-slate-450 bg-[#0B0F19]'
        }`}>
          <CalendarIcon className="h-3.5 w-3.5 text-blue-500 shrink-0" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              if (e.target.value) {
                setSelectedDate(e.target.value);
                setViewMode('date');
              }
            }}
            className="bg-transparent border-none text-xs font-mono focus:outline-none cursor-pointer text-slate-200"
          />
        </div>

        {/* All Tasks toggle */}
        <button
          type="button"
          onClick={() => setViewMode('all')}
          className={`px-4 py-2 text-xs font-bold rounded-xl capitalize transition cursor-pointer ${
            viewMode === 'all'
              ? 'bg-blue-600 text-white shadow shadow-blue-600/15' 
              : 'text-slate-400 hover:text-slate-250'
          }`}
        >
          All Tasks
        </button>
      </div>

      {/* Quick Add Bar */}
      <div className="bg-[#131B2E] border border-white/5 p-5 rounded-2xl shadow-md">
        <form onSubmit={handleQuickAddSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wide">Add New Task</label>
            <input
              type="text"
              required
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              className="w-full bg-[#0B0F19] border border-white/5 text-slate-200 text-xs rounded-xl px-3.5 py-3 focus:outline-none focus:border-blue-500 font-sans"
              placeholder="What task are you working on next?"
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wide">Due Date</label>
            <input
              type="date"
              required
              value={quickDueDate}
              onChange={(e) => setQuickDueDate(e.target.value)}
              className="w-full bg-[#0B0F19] border border-white/5 text-slate-200 text-xs rounded-xl px-3.5 py-3 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wide">Priority</label>
            <div className="flex gap-2">
              <select
                value={quickPriority}
                onChange={(e) => setQuickPriority(e.target.value as Priority)}
                className="flex-1 bg-[#0B0F19] border border-white/5 text-slate-200 text-xs rounded-xl px-3.5 py-3 focus:outline-none focus:border-blue-500 font-sans cursor-pointer"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
              </select>

              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs p-3 rounded-xl transition cursor-pointer flex items-center justify-center shadow-lg shadow-blue-500/10 shrink-0 h-10 w-10"
                title="Create Task"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Dynamic Date Label Indicator */}
      <div className="text-xs font-mono font-bold text-slate-400 bg-[#0B0F19]/45 border border-white/5 rounded-xl px-4 py-2.5 w-fit">
        Active Filter: <span className="text-blue-400">{getDateLabel()}</span>
      </div>

      {/* Main Task Split lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Upcoming Tasks */}
        <div className="space-y-4">
          <div className="border-b border-white/5 pb-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Upcoming Tasks</h3>
          </div>

          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {filteredUpcoming.map((task) => (
              <div 
                key={task.id}
                className="p-4 rounded-xl bg-[#131B2E] border border-white/5 hover:border-slate-700/50 transition duration-150 flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  {/* Complete checkbox trigger */}
                  <button
                    onClick={() => onToggleTaskStatus(task.id, task.status)}
                    className="mt-0.5 text-slate-500 hover:text-emerald-500 transition cursor-pointer shrink-0"
                  >
                    <Circle className="h-5 w-5 text-slate-600 hover:text-slate-500" />
                  </button>
                  
                  {/* Task details */}
                  <div className="space-y-1 min-w-0 text-left">
                    <p className="text-xs font-bold text-slate-100 leading-snug break-words">
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {task.description}
                      </p>
                    )}
                    
                    {/* Telemetry info */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[9px]">
                      <span className={`px-2 py-0.2 rounded uppercase ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                      
                      <span className={`flex items-center gap-1 px-1.5 py-0.2 bg-[#0B0F19]/40 border border-white/5 text-slate-400 rounded ${
                        task.status === 'Overdue' ? 'text-rose-400 border-rose-500/10' : ''
                      }`}>
                        <CalendarIcon className="h-3 w-3 shrink-0" />
                        <span>{task.dueDate}</span>
                      </span>
                      
                      {task.dueTime && (
                        <span className="flex items-center gap-1 px-1.5 py-0.2 bg-[#0B0F19]/40 border border-white/5 text-slate-400 rounded">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span>{task.dueTime}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Operations buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onToggleTaskPin(task.id)}
                    className={`p-1.5 rounded hover:bg-white/5 transition cursor-pointer ${
                      task.isPinned ? 'text-blue-400' : 'text-slate-500'
                    }`}
                    title={task.isPinned ? 'Unpin Task' : 'Pin Task'}
                  >
                    <Pin className="h-3.5 w-3.5" />
                  </button>
                  
                  <button
                    onClick={() => onEditTask(task)}
                    className="p-1.5 hover:bg-white/5 text-slate-400 hover:text-white rounded transition cursor-pointer"
                    title="Edit Task"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>

                  <button
                    onClick={() => onSoftDeleteTask(task.id)}
                    className="p-1.5 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded transition cursor-pointer"
                    title="Delete Task"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {filteredUpcoming.length === 0 && (
              <p className="text-xs text-slate-500 italic py-6 text-center">
                {viewMode === 'date' 
                  ? `No upcoming tasks scheduled for ${new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, { dateStyle: 'short' })}.`
                  : 'All caught up! No upcoming tasks scheduled.'}
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Previous Tasks (History) */}
        <div className="space-y-4">
          <div className="border-b border-white/5 pb-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Previous Tasks</h3>
          </div>

          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {filteredCompleted.map((task) => (
              <div 
                key={task.id}
                className="p-4 rounded-xl bg-[#131B2E]/60 border border-white/5 hover:border-slate-800/80 transition duration-150 flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0 opacity-60 hover:opacity-100 transition duration-150">
                  {/* Restore checkmark toggle */}
                  <button
                    onClick={() => onToggleTaskStatus(task.id, task.status)}
                    className="mt-0.5 text-emerald-500 hover:text-slate-500 transition cursor-pointer shrink-0"
                  >
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 fill-emerald-500/10" />
                  </button>
                  
                  {/* Task details */}
                  <div className="space-y-1 min-w-0 text-left">
                    <p className="text-xs font-bold text-slate-400 line-through leading-snug break-words">
                      {task.title}
                    </p>
                    
                    {/* Timestamp completed */}
                    {task.completedAt && (
                      <div className="flex items-center gap-1 font-mono text-[9px] text-slate-500">
                        <Undo className="h-3 w-3 shrink-0" />
                        <span>Completed at {new Date(task.completedAt).toLocaleDateString()} {new Date(task.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Operations buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onSoftDeleteTask(task.id)}
                    className="p-1.5 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded transition cursor-pointer"
                    title="Permanently Delete Task"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {filteredCompleted.length === 0 && (
              <p className="text-xs text-slate-500 italic py-6 text-center">
                {viewMode === 'date'
                  ? `No completed tasks found for ${new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, { dateStyle: 'short' })}.`
                  : 'No completed history recorded yet.'}
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
