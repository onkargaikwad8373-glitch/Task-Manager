/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Task, Habit, PomodoroSession, AuditLog, AppSettings, SyncQueueItem, Priority, TaskStatus } from '../types';
import { toLocalDateString } from '../utils/dateUtils';

const STORAGE_KEYS = {
  TASKS: 'prod_task_manager_tasks',
  HABITS: 'prod_task_manager_habits',
  POMODORO: 'prod_task_manager_pomodoro',
  SETTINGS: 'prod_task_manager_settings',
  AUDIT_LOGS: 'prod_task_manager_audit_logs',
  SYNC_QUEUE: 'prod_task_manager_sync_queue',
  OFFLINE_MODE: 'prod_task_manager_offline_mode', // simulated offline toggle
};

const DEFAULT_CATEGORIES = [
  'Coding', 'Study', 'Interview', 'Freelancing', 'Gym',
  'Finance', 'Personal', 'Shopping', 'Health', 'Others'
];

const DEFAULT_TAGS = ['React', 'Node', 'Urgent', 'Office', 'Learning', 'Assignment'];

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  notificationsEnabled: true,
  dailyGoal: 4,
  pomodoroWorkTime: 25,
  pomodoroBreakTime: 5,
  syncInterval: 30,
  autoSync: true,
};

// Seed initial tasks - REMOVED TO START FROM CLEAN DATABASE
const SEED_TASKS: Task[] = [];

// Seed initial habits - REMOVED TO START FROM CLEAN DATABASE
const SEED_HABITS: Habit[] = [];

class LocalDb {
  private get<T>(key: string, defaultValue: T): T {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  private set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('LocalDb: Failed to write to localStorage', e);
    }
  }

  // --- INITIALIZE ---
  public initialize(): void {
    if (!localStorage.getItem(STORAGE_KEYS.TASKS)) {
      this.set(STORAGE_KEYS.TASKS, SEED_TASKS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.HABITS)) {
      this.set(STORAGE_KEYS.HABITS, SEED_HABITS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
      this.set(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS)) {
      const seedLogs: AuditLog[] = [
        {
          id: 'log-1',
          action: 'DB_INIT',
          details: 'Initialized Local SQLite-Replica client database.',
          timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
        },
        {
          id: 'log-2',
          action: 'CREATE_TASK',
          details: 'Seeded initial core task: Architect premium offline-first synchronization engine.',
          timestamp: new Date(Date.now() - 3600000 * 3.8).toISOString(),
        }
      ];
      this.set(STORAGE_KEYS.AUDIT_LOGS, seedLogs);
    }
    if (!localStorage.getItem(STORAGE_KEYS.SYNC_QUEUE)) {
      this.set(STORAGE_KEYS.SYNC_QUEUE, []);
    }
  }

  // --- SIMULATED OFFLINE MODE ---
  public isSimulatedOffline(): boolean {
    return this.get<boolean>(STORAGE_KEYS.OFFLINE_MODE, false);
  }

  public setSimulatedOffline(value: boolean): void {
    this.set(STORAGE_KEYS.OFFLINE_MODE, value);
    this.addAuditLog('NETWORK_MODE', `Switched simulated connection to: ${value ? 'OFFLINE' : 'ONLINE'}`);
  }

  // --- SYNC QUEUE ---
  public getSyncQueue(): SyncQueueItem[] {
    return this.get<SyncQueueItem[]>(STORAGE_KEYS.SYNC_QUEUE, []);
  }

  public clearSyncQueue(idsToRemove: string[]): void {
    const queue = this.getSyncQueue();
    const updated = queue.filter(item => !idsToRemove.includes(item.id));
    this.set(STORAGE_KEYS.SYNC_QUEUE, updated);
  }

  private addToSyncQueue(table: SyncQueueItem['table'], action: SyncQueueItem['action'], payload: any): void {
    const queue = this.getSyncQueue();
    // Optimize: if we are updating or deleting a task that was just inserted and is still pending in the queue,
    // we can merge operations to prevent redundant requests. But simple append is fine and safer for order.
    const newItem: SyncQueueItem = {
      id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      table,
      action,
      payload,
      timestamp: new Date().toISOString(),
    };
    queue.push(newItem);
    this.set(STORAGE_KEYS.SYNC_QUEUE, queue);
  }

  // --- TASKS CRUD ---
  public getTasks(): Task[] {
    const rawTasks = this.get<Task[]>(STORAGE_KEYS.TASKS, []);
    const tasks = rawTasks.filter(t => !t.id.includes('seed-task') && !t.id.includes('task-seed'));
    if (tasks.length !== rawTasks.length) {
      this.set(STORAGE_KEYS.TASKS, tasks);
    }

    // Auto calculate "Overdue" status if due date has passed and task is still pending
    const todayStr = toLocalDateString();
    let changed = false;
    const processedTasks = tasks.map(task => {
      if (task.status === 'Pending' && task.dueDate < todayStr) {
        task.status = 'Overdue';
        task.updatedAt = new Date().toISOString();
        changed = true;
      } else if (task.status === 'Overdue' && task.dueDate >= todayStr) {
        task.status = 'Pending';
        task.updatedAt = new Date().toISOString();
        changed = true;
      }
      return task;
    });

    if (changed) {
      this.set(STORAGE_KEYS.TASKS, processedTasks);
    }
    return processedTasks;
  }

  public getTaskById(id: string): Task | undefined {
    return this.getTasks().find(t => t.id === id);
  }

  public createTask(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'completedAt' | 'isPinned' | 'isArchived' | 'isDeleted'> & { id?: string }): Task {
    const tasks = this.getTasks();
    const nowStr = new Date().toISOString();
    const newTask: Task = {
      ...taskData,
      id: taskData.id || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: nowStr,
      updatedAt: nowStr,
      completedAt: null,
      isPinned: false,
      isArchived: false,
      isDeleted: false,
    };

    tasks.push(newTask);
    this.set(STORAGE_KEYS.TASKS, tasks);
    this.addToSyncQueue('tasks', 'INSERT', newTask);
    this.addAuditLog('CREATE_TASK', `Created task: "${newTask.title}"`);
    return newTask;
  }

  public updateTask(id: string, updates: Partial<Task>): Task {
    const tasks = this.getTasks();
    const index = tasks.findIndex(t => t.id === id);
    if (index === -1) {
      throw new Error(`Task with id ${id} not found`);
    }

    const currentTask = tasks[index];
    const nowStr = new Date().toISOString();

    // Handle completedAt automatic transition
    let completedAt = currentTask.completedAt;
    if (updates.status === 'Completed' && currentTask.status !== 'Completed') {
      completedAt = nowStr;
    } else if (updates.status && updates.status !== 'Completed' && currentTask.status === 'Completed') {
      completedAt = null;
    }

    const updatedTask: Task = {
      ...currentTask,
      ...updates,
      completedAt,
      updatedAt: nowStr,
    };

    tasks[index] = updatedTask;
    this.set(STORAGE_KEYS.TASKS, tasks);
    this.addToSyncQueue('tasks', 'UPDATE', updatedTask);
    
    // Audit logs
    if (updates.status === 'Completed' && currentTask.status !== 'Completed') {
      this.addAuditLog('COMPLETE_TASK', `Completed task: "${updatedTask.title}"`);
    } else if (updates.status === 'Pending' && currentTask.status === 'Completed') {
      this.addAuditLog('UNDO_COMPLETE', `Restored task to pending: "${updatedTask.title}"`);
    } else {
      this.addAuditLog('UPDATE_TASK', `Updated task: "${updatedTask.title}"`);
    }

    return updatedTask;
  }

  public togglePinTask(id: string): Task {
    const task = this.getTaskById(id);
    if (!task) throw new Error(`Task with id ${id} not found`);
    const updated = this.updateTask(id, { isPinned: !task.isPinned });
    this.addAuditLog('TOGGLE_PIN', `${updated.isPinned ? 'Pinned' : 'Unpinned'} task: "${updated.title}"`);
    return updated;
  }

  public toggleArchiveTask(id: string): Task {
    const task = this.getTaskById(id);
    if (!task) throw new Error(`Task with id ${id} not found`);
    const updated = this.updateTask(id, { isArchived: !task.isArchived });
    this.addAuditLog('TOGGLE_ARCHIVE', `${updated.isArchived ? 'Archived' : 'Restored from Archive'} task: "${updated.title}"`);
    return updated;
  }

  public softDeleteTask(id: string): Task {
    const task = this.getTaskById(id);
    if (!task) throw new Error(`Task with id ${id} not found`);
    const updated = this.updateTask(id, { isDeleted: true });
    this.addAuditLog('DELETE_TASK', `Soft deleted task: "${updated.title}"`);
    return updated;
  }

  public restoreDeletedTask(id: string): Task {
    const task = this.getTaskById(id);
    if (!task) throw new Error(`Task with id ${id} not found`);
    const updated = this.updateTask(id, { isDeleted: false });
    this.addAuditLog('RESTORE_TASK', `Restored soft-deleted task: "${updated.title}"`);
    return updated;
  }

  public duplicateTask(id: string): Task {
    const task = this.getTaskById(id);
    if (!task) throw new Error(`Task with id ${id} not found`);
    const duplicated = this.createTask({
      title: `${task.title} (Copy)`,
      description: task.description,
      category: task.category,
      priority: task.priority,
      status: 'Pending',
      dueDate: task.dueDate,
      dueTime: task.dueTime,
      tags: [...task.tags],
      reminderTime: task.reminderTime,
      notes: task.notes,
      attachments: [...task.attachments],
    });
    this.addAuditLog('DUPLICATE_TASK', `Duplicated task: "${task.title}"`);
    return duplicated;
  }

  public bulkComplete(ids: string[]): void {
    const tasks = this.getTasks();
    const nowStr = new Date().toISOString();
    let updatedCount = 0;

    const updatedTasks = tasks.map(task => {
      if (ids.includes(task.id) && task.status !== 'Completed') {
        updatedCount++;
        const updatedTask: Task = {
          ...task,
          status: 'Completed',
          completedAt: nowStr,
          updatedAt: nowStr,
        };
        this.addToSyncQueue('tasks', 'UPDATE', updatedTask);
        return updatedTask;
      }
      return task;
    });

    this.set(STORAGE_KEYS.TASKS, updatedTasks);
    this.addAuditLog('BULK_COMPLETE', `Bulk completed ${updatedCount} tasks`);
  }

  public bulkArchive(ids: string[]): void {
    const tasks = this.getTasks();
    const nowStr = new Date().toISOString();
    let updatedCount = 0;

    const updatedTasks = tasks.map(task => {
      if (ids.includes(task.id) && !task.isArchived) {
        updatedCount++;
        const updatedTask: Task = {
          ...task,
          isArchived: true,
          updatedAt: nowStr,
        };
        this.addToSyncQueue('tasks', 'UPDATE', updatedTask);
        return updatedTask;
      }
      return task;
    });

    this.set(STORAGE_KEYS.TASKS, updatedTasks);
    this.addAuditLog('BULK_ARCHIVE', `Bulk archived ${updatedCount} tasks`);
  }

  public bulkDelete(ids: string[]): void {
    const tasks = this.getTasks();
    const nowStr = new Date().toISOString();
    let updatedCount = 0;

    const updatedTasks = tasks.map(task => {
      if (ids.includes(task.id) && !task.isDeleted) {
        updatedCount++;
        const updatedTask: Task = {
          ...task,
          isDeleted: true,
          updatedAt: nowStr,
        };
        this.addToSyncQueue('tasks', 'UPDATE', updatedTask);
        return updatedTask;
      }
      return task;
    });

    this.set(STORAGE_KEYS.TASKS, updatedTasks);
    this.addAuditLog('BULK_DELETE', `Bulk soft-deleted ${updatedCount} tasks`);
  }

  // Hard delete permanently (e.g. empty trash)
  public permanentlyDeleteTask(id: string): void {
    const tasks = this.getTasks();
    const filtered = tasks.filter(t => t.id !== id);
    this.set(STORAGE_KEYS.TASKS, filtered);
    this.addToSyncQueue('tasks', 'DELETE', { id });
    this.addAuditLog('HARD_DELETE', `Permanently deleted task: ID ${id}`);
  }

  // --- HABITS CRUD ---
  public getHabits(): Habit[] {
    const rawHabits = this.get<Habit[]>(STORAGE_KEYS.HABITS, []);
    const habits = rawHabits.filter(h => h.id !== 'habit-1' && h.id !== 'habit-2' && h.id !== 'habit-3' && !h.id.includes('habit-seed'));
    if (habits.length !== rawHabits.length) {
      this.set(STORAGE_KEYS.HABITS, habits);
    }
    return habits;
  }

  public createHabit(name: string, frequency: 'daily' | 'weekly'): Habit {
    const habits = this.getHabits();
    const nowStr = new Date().toISOString();
    const newHabit: Habit = {
      id: `habit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      frequency,
      createdAt: nowStr,
      updatedAt: nowStr,
      streak: 0,
      bestStreak: 0,
      history: [],
    };

    habits.push(newHabit);
    this.set(STORAGE_KEYS.HABITS, habits);
    this.addToSyncQueue('habits', 'INSERT', newHabit);
    this.addAuditLog('CREATE_HABIT', `Created habit: "${name}"`);
    return newHabit;
  }

  public toggleHabitCompletion(id: string, dateStr: string): Habit {
    const habits = this.getHabits();
    const index = habits.findIndex(h => h.id === id);
    if (index === -1) throw new Error(`Habit ${id} not found`);

    const habit = habits[index];
    const history = [...habit.history];
    const dateIdx = history.indexOf(dateStr);
    const nowStr = new Date().toISOString();

    if (dateIdx !== -1) {
      // Toggle off / Uncomplete
      history.splice(dateIdx, 1);
      this.addAuditLog('UNCOMPLETE_HABIT', `Marked habit "${habit.name}" as incomplete for ${dateStr}`);
    } else {
      // Complete
      history.push(dateStr);
      history.sort(); // Keep sorted chronological
      this.addAuditLog('COMPLETE_HABIT', `Completed habit "${habit.name}" on ${dateStr}`);
    }

    // Recalculate streak
    const streakData = this.calculateStreak(history, habit.frequency);
    const updatedHabit: Habit = {
      ...habit,
      history,
      streak: streakData.current,
      bestStreak: Math.max(habit.bestStreak, streakData.current),
      updatedAt: nowStr,
    };

    habits[index] = updatedHabit;
    this.set(STORAGE_KEYS.HABITS, habits);
    this.addToSyncQueue('habits', 'UPDATE', updatedHabit);
    return updatedHabit;
  }

  public deleteHabit(id: string): void {
    const habits = this.getHabits();
    const h = habits.find(habit => habit.id === id);
    const filtered = habits.filter(habit => habit.id !== id);
    this.set(STORAGE_KEYS.HABITS, filtered);
    this.addToSyncQueue('habits', 'DELETE', { id });
    this.addAuditLog('DELETE_HABIT', `Deleted habit: "${h?.name || id}"`);
  }

  private calculateStreak(history: string[], frequency: 'daily' | 'weekly'): { current: number; best: number } {
    if (history.length === 0) return { current: 0, best: 0 };
    
    const uniqueDates = Array.from(new Set(history)).sort();
    
    if (frequency === 'weekly') {
      // Simplified weekly completion count as streak
      return { current: uniqueDates.length, best: uniqueDates.length };
    }

    // Daily streak calculation
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayStr = toLocalDateString(today);
    const yesterdayStr = toLocalDateString(yesterday);

    // Check if completed today or yesterday, else streak is broken
    const lastCompleted = uniqueDates[uniqueDates.length - 1];
    if (lastCompleted !== todayStr && lastCompleted !== yesterdayStr) {
      return { current: 0, best: 0 };
    }

    // Count backwards
    let checkDate = new Date(lastCompleted);
    let idx = uniqueDates.length - 1;
    
    while (idx >= 0) {
      const expectedStr = toLocalDateString(checkDate);
      if (uniqueDates[idx] === expectedStr) {
        currentStreak++;
        idx--;
        // Move back 1 day
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break; // Streak broken
      }
    }

    return { current: currentStreak, best: currentStreak };
  }

  // --- POMODORO LOGS ---
  public getPomodoroSessions(): PomodoroSession[] {
    return this.get<PomodoroSession[]>(STORAGE_KEYS.POMODORO, []);
  }

  public logPomodoroSession(type: PomodoroSession['type'], durationSeconds: number, taskId: string | null = null): PomodoroSession {
    const sessions = this.getPomodoroSessions();
    let taskTitle: string | null = null;
    if (taskId) {
      const task = this.getTaskById(taskId);
      taskTitle = task ? task.title : null;
    }

    const newSession: PomodoroSession = {
      id: `pomo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      taskId,
      taskTitle,
      duration: durationSeconds,
      type,
      createdAt: new Date().toISOString(),
    };

    sessions.push(newSession);
    this.set(STORAGE_KEYS.POMODORO, sessions);
    this.addToSyncQueue('pomodoro', 'INSERT', newSession);
    this.addAuditLog('POMODORO_SESSION', `Completed ${durationSeconds / 60}m Pomodoro ${type} session ${taskTitle ? `for task: "${taskTitle}"` : ''}`);
    return newSession;
  }

  // --- SETTINGS CRUD ---
  public getSettings(): AppSettings {
    return this.get<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  }

  public updateSettings(updates: Partial<AppSettings>): AppSettings {
    const current = this.getSettings();
    const updated = { ...current, ...updates };
    this.set(STORAGE_KEYS.SETTINGS, updated);
    this.addToSyncQueue('settings', 'UPDATE', updated);
    this.addAuditLog('UPDATE_SETTINGS', `Updated settings variables.`);
    return updated;
  }

  // --- AUDIT LOGS ---
  public getAuditLogs(): AuditLog[] {
    return this.get<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, []).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  public addAuditLog(action: string, details: string): void {
    const logs = this.get<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, []);
    const newLog: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      action,
      details,
      timestamp: new Date().toISOString(),
    };
    logs.push(newLog);
    // Keep last 300 logs
    const trimmed = logs.slice(-300);
    this.set(STORAGE_KEYS.AUDIT_LOGS, trimmed);
  }

  public clearLogs(): void {
    this.set(STORAGE_KEYS.AUDIT_LOGS, []);
  }

  // --- CONFLICT RESOLUTION AND SERVER MERGE ---
  public applyServerPull(remoteTasks: Task[], remoteHabits: Habit[], remoteSessions: PomodoroSession[], remoteSettings?: AppSettings): void {
    const localTasks = this.getTasks();
    const localHabits = this.getHabits();
    const localSessions = this.getPomodoroSessions();
    const syncQueue = this.getSyncQueue();

    // Check which local items need to be pushed to the server
    const remoteTaskIds = new Set(remoteTasks.map(rt => rt.id));
    const remoteHabitIds = new Set(remoteHabits.map(rh => rh.id));
    const remoteSessionIds = new Set(remoteSessions.map(rs => rs.id));

    // Get current IDs in sync queue to avoid duplicate queueing
    const queuedIds = new Set(syncQueue.map(q => q.payload.id));

    localTasks.forEach(lt => {
      if (!remoteTaskIds.has(lt.id) && !queuedIds.has(lt.id)) {
        this.addToSyncQueue('tasks', 'INSERT', lt);
      }
    });

    localHabits.forEach(lh => {
      if (!remoteHabitIds.has(lh.id) && !queuedIds.has(lh.id)) {
        this.addToSyncQueue('habits', 'INSERT', lh);
      }
    });

    localSessions.forEach(ls => {
      if (!remoteSessionIds.has(ls.id) && !queuedIds.has(ls.id)) {
        this.addToSyncQueue('pomodoro', 'INSERT', ls);
      }
    });

    // Merge tasks (Last-Write-Wins based on updatedAt)
    const taskMap = new Map<string, Task>();
    localTasks.forEach(t => taskMap.set(t.id, t));
    remoteTasks.forEach(rt => {
      const lt = taskMap.get(rt.id);
      if (!lt || rt.updatedAt > lt.updatedAt) {
        taskMap.set(rt.id, rt);
      }
    });
    this.set(STORAGE_KEYS.TASKS, Array.from(taskMap.values()));

    // Merge habits
    const habitMap = new Map<string, Habit>();
    localHabits.forEach(h => habitMap.set(h.id, h));
    remoteHabits.forEach(rh => {
      const lh = habitMap.get(rh.id);
      if (!lh || rh.updatedAt > lh.updatedAt) {
        habitMap.set(rh.id, rh);
      }
    });
    this.set(STORAGE_KEYS.HABITS, Array.from(habitMap.values()));

    // Merge sessions
    const sessionMap = new Map<string, PomodoroSession>();
    localSessions.forEach(s => sessionMap.set(s.id, s));
    remoteSessions.forEach(rs => sessionMap.set(rs.id, rs));
    this.set(STORAGE_KEYS.POMODORO, Array.from(sessionMap.values()));

    if (remoteSettings) {
      const currentSettings = this.getSettings();
      this.set(STORAGE_KEYS.SETTINGS, { ...currentSettings, ...remoteSettings });
    }

    this.addAuditLog('DATABASE_PULL', `Pulled updates from server. Merged unsynced local changes.`);
  }

  // --- EXPORT & IMPORT ---
  public exportBackup(): string {
    const data = {
      tasks: this.getTasks(),
      habits: this.getHabits(),
      pomodoro: this.getPomodoroSessions(),
      settings: this.getSettings(),
      auditLogs: this.getAuditLogs(),
    };
    return JSON.stringify(data, null, 2);
  }

  public importBackup(backupStr: string): boolean {
    try {
      const data = JSON.parse(backupStr);
      if (data.tasks) this.set(STORAGE_KEYS.TASKS, data.tasks);
      if (data.habits) this.set(STORAGE_KEYS.HABITS, data.habits);
      if (data.pomodoro) this.set(STORAGE_KEYS.POMODORO, data.pomodoro);
      if (data.settings) this.set(STORAGE_KEYS.SETTINGS, data.settings);
      if (data.auditLogs) this.set(STORAGE_KEYS.AUDIT_LOGS, data.auditLogs);
      
      this.addAuditLog('IMPORT_BACKUP', 'Successfully imported database backup file.');
      return true;
    } catch (e) {
      console.error('Failed to import backup', e);
      return false;
    }
  }

  public getCategories(): string[] {
    return DEFAULT_CATEGORIES;
  }

  public getTags(): string[] {
    return DEFAULT_TAGS;
  }
}

export const db = new LocalDb();
// Auto initialize on import
db.initialize();
