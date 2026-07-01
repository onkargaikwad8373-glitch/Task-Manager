import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { Task, Habit, PomodoroSession, AppSettings, SyncQueueItem } from '../frontend/src/types';
import { initPostgres, isPgConnected, pgDb, setPgConnected } from './db/postgresDb';

const JWT_SECRET = process.env.JWT_SECRET || 'serene-secure-signature-key-2026';

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash.includes(':')) {
    // Support legacy plain-text passwords
    return storedHash === password;
  }
  const [salt, hash] = storedHash.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

function generateToken(email: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + 24 * 60 * 60 * 1000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

// Server-side simulated PostgreSQL database file
const DB_FILE = path.join(process.cwd(), 'postgres_replica.json');

interface ServerDb {
  tasks: Task[];
  habits: Habit[];
  pomodoro: PomodoroSession[];
  settings: AppSettings | null;
  users: Record<string, { email: string; passwordHash: string }>;
}

const DEFAULT_SERVER_DB: ServerDb = {
  tasks: [],
  habits: [],
  pomodoro: [],
  settings: null,
  users: {
    'demo@example.com': { email: 'demo@example.com', passwordHash: 'demo123' } // simple legacy string for demo compat
  }
};

// Helper to read database
function readServerDb(): ServerDb {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to read server DB file, using fallback.', e);
  }
  return { ...DEFAULT_SERVER_DB };
}

// Helper to write database
function writeServerDb(db: ServerDb): void {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to write server DB file', e);
  }
}

async function startServer() {
  // Primary PostgreSQL Database Connection & Schemas Migrations Auto-Run
  const usingPg = await initPostgres();
  if (usingPg) {
    console.log('[DATABASE] Primary connection to actual PostgreSQL verified and successfully migrated.');
  } else {
    console.log('[DATABASE] Fallback simulation active. Connecting to simulated PostgreSQL replica datastore.');
  }

  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Initialize DB file
  if (!fs.existsSync(DB_FILE)) {
    writeServerDb(DEFAULT_SERVER_DB);
  }

  // --- HEALTH CHECK ---
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: isPgConnected ? 'PostgreSQL Primary (Connected & Live)' : 'PostgreSQL Simulated (Replica JSON Fallback)',
    });
  });

  // Helper to authenticate token and return email
  function getEmailFromHeader(authHeader?: string): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.substring(7);
    
    // Check for cryptographic JWT
    const parts = token.split('.');
    if (parts.length === 3) {
      const [header, payload, signature] = parts;
      try {
        const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
        if (signature === expectedSignature) {
          const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
          if (decodedPayload.exp > Date.now()) {
            return decodedPayload.email;
          }
        }
      } catch {
        // fall through
      }
    }

    // Fallback to legacy mock-jwt for compatibility
    if (token.startsWith('mock-jwt-')) {
      try {
        const base64 = token.substring(9);
        return Buffer.from(base64, 'base64').toString('utf-8');
      } catch {
        return null;
      }
    }

    return null;
  }

  // --- AUTH ENDPOINTS ---
  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password are required' });
      return;
    }
    const normalizedEmail = email.toLowerCase();

    let user: { email: string; passwordHash: string } | null = null;
    if (isPgConnected) {
      try {
        user = await pgDb.getUserByEmail(normalizedEmail);
      } catch (err) {
        console.error('[AUTH] Postgres getUserByEmail error, trying replica file fallback...', err);
      }
    }

    if (!user) {
      const db = readServerDb();
      user = db.users[normalizedEmail];
    }

    if (user && verifyPassword(password, user.passwordHash)) {
      res.json({
        success: true,
        token: generateToken(normalizedEmail),
        user: { email: normalizedEmail }
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  });

  app.post('/api/auth/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password are required' });
      return;
    }
    const normalizedEmail = email.toLowerCase();

    let exists = false;
    if (isPgConnected) {
      try {
        const u = await pgDb.getUserByEmail(normalizedEmail);
        exists = !!u;
      } catch (err) {
        console.error('[AUTH] Postgres registration existence check failed, falling back...', err);
      }
    } else {
      const db = readServerDb();
      exists = !!db.users[normalizedEmail];
    }

    if (exists) {
      res.status(400).json({ success: false, message: 'User already exists' });
      return;
    }

    const hashedPassword = hashPassword(password);

    if (isPgConnected) {
      try {
        await pgDb.createUser(normalizedEmail, hashedPassword);
      } catch (err) {
        console.error('[AUTH] Postgres createUser error, writing to simulated replica...', err);
        const db = readServerDb();
        db.users[normalizedEmail] = { email: normalizedEmail, passwordHash: hashedPassword };
        writeServerDb(db);
      }
    } else {
      const db = readServerDb();
      db.users[normalizedEmail] = { email: normalizedEmail, passwordHash: hashedPassword };
      writeServerDb(db);
    }

    res.json({
      success: true,
      token: generateToken(normalizedEmail),
      user: { email: normalizedEmail }
    });
  });

  // --- SYNCHRONIZATION ENGINE ---
  app.post('/api/sync', async (req, res) => {
    const email = getEmailFromHeader(req.headers.authorization);
    if (!email) {
      res.status(401).json({ success: false, message: 'Unauthorized session. Please login.' });
      return;
    }

    const { queue, clientTimestamp } = req.body as { queue: SyncQueueItem[]; clientTimestamp: string };
    
    console.log(`[SYNC] [${email}] Received sync request with ${queue?.length || 0} queue actions.`);

    const serverLogs: string[] = [];

    let userTasks: Task[] = [];
    let userHabits: Habit[] = [];
    let userPomodoro: PomodoroSession[] = [];
    let userSettings: AppSettings | null = null;

    if (isPgConnected) {
      // --- ACTUAL POSTGRES PRIMARY DATABASE WORKFLOW ---
      try {
        // Ensure user exists in PostgreSQL to satisfy foreign key constraints
        const pgUser = await pgDb.getUserByEmail(email);
        if (!pgUser) {
          const dbReplica = readServerDb();
          const localUser = dbReplica.users[email];
          const pwdHash = localUser ? localUser.passwordHash : hashPassword('serene-default-pass-2026');
          await pgDb.createUser(email, pwdHash);
          console.log(`[PG] Dynamically provisioned user account "${email}" in PostgreSQL.`);
        }

        // Seeding primary if empty
        const initialTasks = await pgDb.getTasks(email);
        if (initialTasks.length === 0) {
          const nowStr = new Date().toISOString();
          const seed1 = {
            id: `task-seed-1-${email}`,
            title: 'Explore your personal Serene workspace',
            description: 'Welcome to Serene! This is your individual, secured task board. Try creating tasks, logging habits, or initiating a Pomodoro session.',
            category: 'Personal',
            priority: 'HIGH' as any,
            status: 'Pending' as any,
            dueDate: new Date().toISOString().split('T')[0],
            dueTime: '12:00',
            createdAt: nowStr,
            updatedAt: nowStr,
            completedAt: null,
            isPinned: true,
            isArchived: false,
            isDeleted: false,
            tags: ['React', 'Learning'],
            reminderTime: '11:45',
            notes: '### Getting Started\n- Check out **Today\'s Tasks**\n- Open **Habit Tracker**\n- Start a **Pomodoro session**',
            attachments: [],
            userEmail: email
          };
          const seed2 = {
            id: `task-seed-2-${email}`,
            title: 'Build a solid habit loop',
            description: 'A habit tracker built-in to your workflow. Mark daily coding or documentation goals as checked.',
            category: 'Coding',
            priority: 'MEDIUM' as any,
            status: 'Pending' as any,
            dueDate: new Date().toISOString().split('T')[0],
            dueTime: '18:00',
            createdAt: nowStr,
            updatedAt: nowStr,
            completedAt: null,
            isPinned: false,
            isArchived: false,
            isDeleted: false,
            tags: ['Learning'],
            reminderTime: null,
            notes: '',
            attachments: [],
            userEmail: email
          };
          await pgDb.upsertTask(seed1);
          await pgDb.upsertTask(seed2);

          const habit1 = {
            id: `habit-seed-1-${email}`,
            name: 'Leethub Practice',
            frequency: 'daily' as any,
            createdAt: nowStr,
            updatedAt: nowStr,
            streak: 0,
            bestStreak: 0,
            history: [],
            userEmail: email
          };
          const habit2 = {
            id: `habit-seed-2-${email}`,
            name: 'Tech Blogs Reading',
            frequency: 'daily' as any,
            createdAt: nowStr,
            updatedAt: nowStr,
            streak: 0,
            bestStreak: 0,
            history: [],
            userEmail: email
          };
          await pgDb.upsertHabit(habit1);
          await pgDb.upsertHabit(habit2);

          serverLogs.push('Seeded fresh user environment in PostgreSQL.');
        }

        // Process queue mutations directly in PG
        if (queue && queue.length > 0) {
          for (const item of queue) {
            const { table, action, payload } = item;
            try {
              if (table === 'tasks') {
                const taskPayload = { ...(payload as Task), userEmail: email };
                if (action === 'DELETE') {
                  await pgDb.deleteTask(taskPayload.id, email);
                  serverLogs.push(`[PG] Deleted task: "${taskPayload.id}"`);
                } else {
                  await pgDb.upsertTask(taskPayload);
                  serverLogs.push(`[PG] Upserted task: "${taskPayload.title}"`);
                }
              } else if (table === 'habits') {
                const habitPayload = { ...(payload as Habit), userEmail: email };
                if (action === 'DELETE') {
                  await pgDb.deleteHabit(habitPayload.id, email);
                  serverLogs.push(`[PG] Deleted habit: "${habitPayload.id}"`);
                } else {
                  await pgDb.upsertHabit(habitPayload);
                  serverLogs.push(`[PG] Upserted habit: "${habitPayload.name}"`);
                }
              } else if (table === 'pomodoro') {
                const promoPayload = { ...(payload as PomodoroSession), userEmail: email };
                await pgDb.insertPomodoro(promoPayload);
                serverLogs.push(`[PG] Logged Pomodoro session: ${promoPayload.type}`);
              } else if (table === 'settings') {
                await pgDb.upsertSettings(email, payload as AppSettings);
                serverLogs.push('[PG] Synchronized user settings.');
              }
            } catch (err) {
              console.error(`PostgreSQL action error (${table}.${action}):`, err);
              serverLogs.push(`[PG ERROR] ${table}.${action}: ${(err as Error).message}`);
            }
          }
        }

        // Load authoritative data from Postgres
        userTasks = await pgDb.getTasks(email);
        userHabits = await pgDb.getHabits(email);
        userPomodoro = await pgDb.getPomodoro(email);
        userSettings = await pgDb.getSettings(email);

      } catch (err) {
        console.error('PostgreSQL primary database operation error. Syncing with replica file fallback...', err);
        setPgConnected(false); // flag disconnect to let it recover via file sync
      }
    }

    // Fallback if Postgres not connected or failed
    if (!isPgConnected) {
      // --- SIMULATED FILE REPLICA BACKEND WORKFLOW ---
      const db = readServerDb();
      if (!db.settings) {
        db.settings = {} as any;
      }
      const settingsMap = db.settings as unknown as Record<string, AppSettings>;

      // Ensure users have seeded tasks if they have none
      const localTasks = db.tasks.filter((t: any) => t.userEmail === email);
      if (localTasks.length === 0) {
        const nowStr = new Date().toISOString();
        const userSeedTasks = [
          {
            id: `task-seed-1-${email}`,
            title: 'Explore your personal Serene workspace',
            description: 'Welcome to Serene! This is your individual, secured task board. Try creating tasks, logging habits, or initiating a Pomodoro session.',
            category: 'Personal',
            priority: 'HIGH',
            status: 'Pending',
            dueDate: new Date().toISOString().split('T')[0],
            dueTime: '12:00',
            createdAt: nowStr,
            updatedAt: nowStr,
            completedAt: null,
            isPinned: true,
            isArchived: false,
            isDeleted: false,
            tags: ['React', 'Learning'],
            reminderTime: '11:45',
            notes: '### Getting Started\n- Check out **Today\'s Tasks**\n- Open **Habit Tracker**\n- Start a **Pomodoro session**',
            attachments: []
          },
          {
            id: `task-seed-2-${email}`,
            title: 'Build a solid habit loop',
            description: 'A habit tracker built-in to your workflow. Mark daily coding or documentation goals as checked.',
            category: 'Coding',
            priority: 'MEDIUM',
            status: 'Pending',
            dueDate: new Date().toISOString().split('T')[0],
            dueTime: '18:00',
            createdAt: nowStr,
            updatedAt: nowStr,
            completedAt: null,
            isPinned: false,
            isArchived: false,
            isDeleted: false,
            tags: ['Learning'],
            reminderTime: null,
            notes: '',
            attachments: []
          }
        ].map(t => ({ ...t, userEmail: email }));

        db.tasks.push(...(userSeedTasks as any[]));

        const userSeedHabits = [
          {
            id: `habit-seed-1-${email}`,
            name: 'Leethub Practice',
            frequency: 'daily',
            createdAt: nowStr,
            updatedAt: nowStr,
            streak: 0,
            bestStreak: 0,
            history: [],
            userEmail: email
          },
          {
            id: `habit-seed-2-${email}`,
            name: 'Tech Blogs Reading',
            frequency: 'daily',
            createdAt: nowStr,
            updatedAt: nowStr,
            streak: 0,
            bestStreak: 0,
            history: [],
            userEmail: email
          }
        ];
        db.habits.push(...(userSeedHabits as any[]));
        writeServerDb(db);
      }

      // Process mutations from queue
      if (queue && queue.length > 0) {
        queue.forEach(item => {
          const { table, action, payload } = item;

          if (table === 'tasks') {
            const taskPayload = { ...(payload as Task), userEmail: email };
            const idx = db.tasks.findIndex(t => t.id === taskPayload.id);

            if (action === 'INSERT') {
              if (idx === -1) {
                db.tasks.push(taskPayload as any);
                serverLogs.push(`Inserted task: "${taskPayload.title}"`);
              } else {
                const existingTask = db.tasks[idx] as any;
                if (existingTask.userEmail === email && taskPayload.updatedAt > existingTask.updatedAt) {
                  db.tasks[idx] = taskPayload as any;
                  serverLogs.push(`Updated task on insert conflict: "${taskPayload.title}"`);
                }
              }
            } else if (action === 'UPDATE') {
              if (idx !== -1) {
                const existingTask = db.tasks[idx] as any;
                if (existingTask.userEmail === email) {
                  if (taskPayload.updatedAt > existingTask.updatedAt) {
                    db.tasks[idx] = taskPayload as any;
                    serverLogs.push(`Updated task: "${taskPayload.title}"`);
                  } else {
                    serverLogs.push(`Ignored stale task update: "${taskPayload.title}"`);
                  }
                }
              } else {
                db.tasks.push(taskPayload as any);
                serverLogs.push(`Recovered missing task: "${taskPayload.title}"`);
              }
            } else if (action === 'DELETE') {
              if (idx !== -1) {
                const existingTask = db.tasks[idx] as any;
                if (existingTask.userEmail === email) {
                  const title = existingTask.title;
                  db.tasks.splice(idx, 1);
                  serverLogs.push(`Permanently deleted task: "${title}"`);
                }
              }
            }
          } else if (table === 'habits') {
            const habitPayload = { ...(payload as Habit), userEmail: email };
            const idx = db.habits.findIndex(h => h.id === habitPayload.id);

            if (action === 'INSERT') {
              if (idx === -1) {
                db.habits.push(habitPayload as any);
                serverLogs.push(`Inserted habit: "${habitPayload.name}"`);
              } else {
                const existingHabit = db.habits[idx] as any;
                if (existingHabit.userEmail === email && habitPayload.updatedAt > existingHabit.updatedAt) {
                  db.habits[idx] = habitPayload as any;
                  serverLogs.push(`Updated habit on insert conflict: "${habitPayload.name}"`);
                }
              }
            } else if (action === 'UPDATE') {
              if (idx !== -1) {
                const existingHabit = db.habits[idx] as any;
                if (existingHabit.userEmail === email) {
                  if (habitPayload.updatedAt > existingHabit.updatedAt) {
                    db.habits[idx] = habitPayload as any;
                    serverLogs.push(`Updated habit: "${habitPayload.name}"`);
                  }
                }
              } else {
                db.habits.push(habitPayload as any);
                serverLogs.push(`Recovered missing habit: "${habitPayload.name}"`);
              }
            } else if (action === 'DELETE') {
              if (idx !== -1) {
                const existingHabit = db.habits[idx] as any;
                if (existingHabit.userEmail === email) {
                  const name = existingHabit.name;
                  db.habits.splice(idx, 1);
                  serverLogs.push(`Deleted habit: "${name}"`);
                }
              }
            }
          } else if (table === 'pomodoro') {
            const promoPayload = { ...(payload as PomodoroSession), userEmail: email };
            const exists = db.pomodoro.some(s => s.id === promoPayload.id && (s as any).userEmail === email);
            if (!exists) {
              db.pomodoro.push(promoPayload as any);
              serverLogs.push(`Logged Pomodoro: ${promoPayload.type} (${promoPayload.duration / 60}m)`);
            }
          } else if (table === 'settings') {
            settingsMap[email] = payload as AppSettings;
            serverLogs.push('Synchronized settings.');
          }
        });

        writeServerDb(db);
      }

      userTasks = db.tasks.filter((t: any) => t.userEmail === email);
      userHabits = db.habits.filter((h: any) => h.userEmail === email);
      userPomodoro = db.pomodoro.filter((s: any) => s.userEmail === email);
      userSettings = settingsMap[email] || null;
    }

    res.json({
      success: true,
      tasks: userTasks,
      habits: userHabits,
      pomodoro: userPomodoro,
      settings: userSettings,
      serverTimestamp: new Date().toISOString(),
      logs: serverLogs,
    });
  });

  // --- REST ENDPOINTS (Backup & Direct Admin) ---
  app.get('/api/admin/data', (req, res) => {
    res.json(readServerDb());
  });

  app.post('/api/admin/reset', (req, res) => {
    writeServerDb(DEFAULT_SERVER_DB);
    res.json({ success: true, message: 'Database reset to default template state.' });
  });

  // Vite middleware for development or fallback static folder in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
      root: path.join(process.cwd(), 'frontend'),
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
