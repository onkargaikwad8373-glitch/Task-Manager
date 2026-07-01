import pg from 'pg';
import { Task, Habit, PomodoroSession, AppSettings } from '../../frontend/src/types';

const { Pool } = pg;

// Support either standard DATABASE_URL or individual PG credentials
let pool: pg.Pool | null = null;
export let isPgConnected = false;

export function setPgConnected(val: boolean) {
  isPgConnected = val;
}

function getPool(): pg.Pool | null {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  const hasPgCreds = !!(connectionString || process.env.PGHOST);

  if (hasPgCreds) {
    try {
      pool = new Pool(
        connectionString
          ? { connectionString, ssl: connectionString.includes('sslmode=') ? undefined : { rejectUnauthorized: false } }
          : {
              host: process.env.PGHOST,
              port: parseInt(process.env.PGPORT || '5432', 10),
              user: process.env.PGUSER,
              password: process.env.PGPASSWORD,
              database: process.env.PGDATABASE,
              ssl: { rejectUnauthorized: false },
            }
      );
    } catch (err) {
      console.error('PostgreSQL client pool creation failed:', err);
    }
  }
  return pool;
}

// Automatically create database schemas / tables on launch if connected
export async function initPostgres(): Promise<boolean> {
  const activePool = getPool();
  if (!activePool) {
    isPgConnected = false;
    return false;
  }

  try {
    const client = await activePool.connect();
    console.log('Successfully connected to PostgreSQL primary database!');
    isPgConnected = true;

    // Begin table schema creations
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        email VARCHAR(255) PRIMARY KEY,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id VARCHAR(255) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        priority VARCHAR(20) NOT NULL,
        status VARCHAR(50) NOT NULL,
        due_date VARCHAR(50),
        due_time VARCHAR(20),
        created_at VARCHAR(100) NOT NULL,
        updated_at VARCHAR(100) NOT NULL,
        completed_at VARCHAR(100),
        is_pinned BOOLEAN DEFAULT FALSE,
        is_archived BOOLEAN DEFAULT FALSE,
        is_deleted BOOLEAN DEFAULT FALSE,
        tags JSONB DEFAULT '[]'::jsonb,
        reminder_time VARCHAR(20),
        notes TEXT,
        attachments JSONB DEFAULT '[]'::jsonb,
        reminder_sent BOOLEAN DEFAULT FALSE,
        user_email VARCHAR(255) REFERENCES users(email) ON DELETE CASCADE
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS habits (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        frequency VARCHAR(50) NOT NULL,
        created_at VARCHAR(100) NOT NULL,
        updated_at VARCHAR(100) NOT NULL,
        streak INTEGER DEFAULT 0,
        best_streak INTEGER DEFAULT 0,
        history JSONB DEFAULT '[]'::jsonb,
        user_email VARCHAR(255) REFERENCES users(email) ON DELETE CASCADE
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS pomodoro (
        id VARCHAR(255) PRIMARY KEY,
        task_id VARCHAR(255),
        task_title VARCHAR(255),
        duration INTEGER NOT NULL,
        type VARCHAR(50) NOT NULL,
        created_at VARCHAR(100) NOT NULL,
        user_email VARCHAR(255) REFERENCES users(email) ON DELETE CASCADE
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        user_email VARCHAR(255) PRIMARY KEY REFERENCES users(email) ON DELETE CASCADE,
        theme VARCHAR(20) DEFAULT 'light',
        notifications_enabled BOOLEAN DEFAULT TRUE,
        daily_goal INTEGER DEFAULT 4,
        pomodoro_work_time INTEGER DEFAULT 25,
        pomodoro_break_time INTEGER DEFAULT 5,
        sync_interval INTEGER DEFAULT 30,
        auto_sync BOOLEAN DEFAULT TRUE
      );
    `);

    client.release();
    console.log('PostgreSQL database schemas successfully validated / migrated.');
    return true;
  } catch (err) {
    console.error('Failed to establish PostgreSQL connection or migrate tables:', err);
    isPgConnected = false;
    return false;
  }
}

// Helper query function
async function query(text: string, params?: any[]) {
  const activePool = getPool();
  if (!activePool) {
    throw new Error('Database pool not initialized');
  }
  return activePool.query(text, params);
}

// Unified relational queries matching types
export const pgDb = {
  async getUserByEmail(email: string) {
    const res = await query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (res.rows.length === 0) return null;
    return {
      email: res.rows[0].email,
      passwordHash: res.rows[0].password_hash,
    };
  },

  async createUser(email: string, passwordHash: string) {
    await query(
      'INSERT INTO users (email, password_hash) VALUES (LOWER($1), $2) ON CONFLICT (email) DO NOTHING',
      [email, passwordHash]
    );
    return { email: email.toLowerCase() };
  },

  async getTasks(email: string): Promise<Task[]> {
    const res = await query('SELECT * FROM tasks WHERE LOWER(user_email) = LOWER($1)', [email]);
    return res.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      priority: row.priority,
      status: row.status,
      dueDate: row.due_date,
      dueTime: row.due_time,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      isPinned: row.is_pinned,
      isArchived: row.is_archived,
      isDeleted: row.is_deleted,
      tags: Array.isArray(row.tags) ? row.tags : JSON.parse(row.tags || '[]'),
      reminderTime: row.reminder_time,
      notes: row.notes,
      attachments: Array.isArray(row.attachments) ? row.attachments : JSON.parse(row.attachments || '[]'),
      reminderSent: row.reminder_sent,
    }));
  },

  async upsertTask(task: Task & { userEmail: string }) {
    await query(
      `INSERT INTO tasks (
        id, title, description, category, priority, status, due_date, due_time, 
        created_at, updated_at, completed_at, is_pinned, is_archived, is_deleted, 
        tags, reminder_time, notes, attachments, reminder_sent, user_email
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, LOWER($20))
      ON CONFLICT (id) DO UPDATE SET
        title = CASE WHEN EXCLUDED.updated_at > tasks.updated_at THEN EXCLUDED.title ELSE tasks.title END,
        description = CASE WHEN EXCLUDED.updated_at > tasks.updated_at THEN EXCLUDED.description ELSE tasks.description END,
        category = CASE WHEN EXCLUDED.updated_at > tasks.updated_at THEN EXCLUDED.category ELSE tasks.category END,
        priority = CASE WHEN EXCLUDED.updated_at > tasks.updated_at THEN EXCLUDED.priority ELSE tasks.priority END,
        status = CASE WHEN EXCLUDED.updated_at > tasks.updated_at THEN EXCLUDED.status ELSE tasks.status END,
        due_date = CASE WHEN EXCLUDED.updated_at > tasks.updated_at THEN EXCLUDED.due_date ELSE tasks.due_date END,
        due_time = CASE WHEN EXCLUDED.updated_at > tasks.updated_at THEN EXCLUDED.due_time ELSE tasks.due_time END,
        updated_at = CASE WHEN EXCLUDED.updated_at > tasks.updated_at THEN EXCLUDED.updated_at ELSE tasks.updated_at END,
        completed_at = CASE WHEN EXCLUDED.updated_at > tasks.updated_at THEN EXCLUDED.completed_at ELSE tasks.completed_at END,
        is_pinned = CASE WHEN EXCLUDED.updated_at > tasks.updated_at THEN EXCLUDED.is_pinned ELSE tasks.is_pinned END,
        is_archived = CASE WHEN EXCLUDED.updated_at > tasks.updated_at THEN EXCLUDED.is_archived ELSE tasks.is_archived END,
        is_deleted = CASE WHEN EXCLUDED.updated_at > tasks.updated_at THEN EXCLUDED.is_deleted ELSE tasks.is_deleted END,
        tags = CASE WHEN EXCLUDED.updated_at > tasks.updated_at THEN EXCLUDED.tags ELSE tasks.tags END,
        reminder_time = CASE WHEN EXCLUDED.updated_at > tasks.updated_at THEN EXCLUDED.reminder_time ELSE tasks.reminder_time END,
        notes = CASE WHEN EXCLUDED.updated_at > tasks.updated_at THEN EXCLUDED.notes ELSE tasks.notes END,
        attachments = CASE WHEN EXCLUDED.updated_at > tasks.updated_at THEN EXCLUDED.attachments ELSE tasks.attachments END,
        reminder_sent = CASE WHEN EXCLUDED.updated_at > tasks.updated_at THEN EXCLUDED.reminder_sent ELSE tasks.reminder_sent END`,
      [
        task.id,
        task.title,
        task.description || '',
        task.category || '',
        task.priority,
        task.status,
        task.dueDate || null,
        task.dueTime || null,
        task.createdAt,
        task.updatedAt,
        task.completedAt || null,
        task.isPinned || false,
        task.isArchived || false,
        task.isDeleted || false,
        JSON.stringify(task.tags || []),
        task.reminderTime || null,
        task.notes || '',
        JSON.stringify(task.attachments || []),
        task.reminderSent || false,
        task.userEmail,
      ]
    );
  },

  async deleteTask(id: string, email: string) {
    await query('DELETE FROM tasks WHERE id = $1 AND LOWER(user_email) = LOWER($2)', [id, email]);
  },

  async getHabits(email: string): Promise<Habit[]> {
    const res = await query('SELECT * FROM habits WHERE LOWER(user_email) = LOWER($1)', [email]);
    return res.rows.map(row => ({
      id: row.id,
      name: row.name,
      frequency: row.frequency,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      streak: row.streak,
      bestStreak: row.best_streak,
      history: Array.isArray(row.history) ? row.history : JSON.parse(row.history || '[]'),
    }));
  },

  async upsertHabit(habit: Habit & { userEmail: string }) {
    await query(
      `INSERT INTO habits (id, name, frequency, created_at, updated_at, streak, best_streak, history, user_email)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, LOWER($9))
       ON CONFLICT (id) DO UPDATE SET
         name = CASE WHEN EXCLUDED.updated_at > habits.updated_at THEN EXCLUDED.name ELSE habits.name END,
         frequency = CASE WHEN EXCLUDED.updated_at > habits.updated_at THEN EXCLUDED.frequency ELSE habits.frequency END,
         updated_at = CASE WHEN EXCLUDED.updated_at > habits.updated_at THEN EXCLUDED.updated_at ELSE habits.updated_at END,
         streak = CASE WHEN EXCLUDED.updated_at > habits.updated_at THEN EXCLUDED.streak ELSE habits.streak END,
         best_streak = CASE WHEN EXCLUDED.updated_at > habits.updated_at THEN EXCLUDED.best_streak ELSE habits.best_streak END,
         history = CASE WHEN EXCLUDED.updated_at > habits.updated_at THEN EXCLUDED.history ELSE habits.history END`,
      [
        habit.id,
        habit.name,
        habit.frequency,
        habit.createdAt,
        habit.updatedAt,
        habit.streak || 0,
        habit.bestStreak || 0,
        JSON.stringify(habit.history || []),
        habit.userEmail,
      ]
    );
  },

  async deleteHabit(id: string, email: string) {
    await query('DELETE FROM habits WHERE id = $1 AND LOWER(user_email) = LOWER($2)', [id, email]);
  },

  async getPomodoro(email: string): Promise<PomodoroSession[]> {
    const res = await query('SELECT * FROM pomodoro WHERE LOWER(user_email) = LOWER($1)', [email]);
    return res.rows.map(row => ({
      id: row.id,
      taskId: row.task_id,
      taskTitle: row.task_title,
      duration: row.duration,
      type: row.type as 'work' | 'short_break' | 'long_break',
      createdAt: row.created_at,
    }));
  },

  async insertPomodoro(session: PomodoroSession & { userEmail: string }) {
    await query(
      'INSERT INTO pomodoro (id, task_id, task_title, duration, type, created_at, user_email) VALUES ($1, $2, $3, $4, $5, $6, LOWER($7)) ON CONFLICT (id) DO NOTHING',
      [
        session.id,
        session.taskId,
        session.taskTitle,
        session.duration,
        session.type,
        session.createdAt,
        session.userEmail,
      ]
    );
  },

  async getSettings(email: string): Promise<AppSettings | null> {
    const res = await query('SELECT * FROM settings WHERE LOWER(user_email) = LOWER($1)', [email]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      theme: r.theme as 'light' | 'dark' | 'system',
      notificationsEnabled: r.notifications_enabled,
      dailyGoal: r.daily_goal,
      pomodoroWorkTime: r.pomodoro_work_time,
      pomodoroBreakTime: r.pomodoro_break_time,
      syncInterval: r.sync_interval,
      autoSync: r.auto_sync,
    };
  },

  async upsertSettings(email: string, settings: AppSettings) {
    await query(
      `INSERT INTO settings (
        user_email, theme, notifications_enabled, daily_goal, pomodoro_work_time, pomodoro_break_time, sync_interval, auto_sync
      ) VALUES (LOWER($1), $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_email) DO UPDATE SET
        theme = EXCLUDED.theme,
        notifications_enabled = EXCLUDED.notifications_enabled,
        daily_goal = EXCLUDED.daily_goal,
        pomodoro_work_time = EXCLUDED.pomodoro_work_time,
        pomodoro_break_time = EXCLUDED.pomodoro_break_time,
        sync_interval = EXCLUDED.sync_interval,
        auto_sync = EXCLUDED.auto_sync`,
      [
        email,
        settings.theme,
        settings.notificationsEnabled,
        settings.dailyGoal,
        settings.pomodoroWorkTime,
        settings.pomodoroBreakTime,
        settings.syncInterval,
        settings.autoSync,
      ]
    );
  },
};
