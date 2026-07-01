/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
export type TaskStatus = 'Pending' | 'Completed' | 'Overdue';

export interface Attachment {
  name: string;
  url: string;
  size: string;
  type: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: Priority;
  status: TaskStatus;
  dueDate: string; // YYYY-MM-DD
  dueTime: string; // HH:MM
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  isPinned: boolean;
  isArchived: boolean;
  isDeleted: boolean; // Soft delete
  tags: string[];
  reminderTime: string | null; // HH:MM
  reminderSent?: boolean;
  notes: string; // Markdown notes
  attachments: Attachment[];
}

export interface Habit {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly';
  createdAt: string;
  updatedAt: string;
  streak: number;
  bestStreak: number;
  history: string[]; // array of dates (YYYY-MM-DD) when habit was completed
}

export interface PomodoroSession {
  id: string;
  taskId: string | null;
  taskTitle: string | null;
  duration: number; // in seconds
  type: 'work' | 'short_break' | 'long_break';
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  notificationsEnabled: boolean;
  dailyGoal: number; // number of tasks to complete
  pomodoroWorkTime: number; // in minutes
  pomodoroBreakTime: number; // in minutes
  syncInterval: number; // in seconds
  autoSync: boolean;
}

export interface SyncQueueItem {
  id: string;
  table: 'tasks' | 'habits' | 'pomodoro' | 'settings' | 'audit_logs';
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: any;
  timestamp: string;
}

export interface DailyProgress {
  date: string; // YYYY-MM-DD
  completedCount: number;
  totalCount: number;
}
