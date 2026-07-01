/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import TaskModal from './components/TaskModal';
import DueAlertOverlay from './components/DueAlertOverlay';
import AuthScreen from './components/AuthScreen';

import { db } from './db/localDb';
import { Task, AppSettings } from './types';
import { toLocalDateString } from './utils/dateUtils';

export default function App() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<{ email: string } | null>(() => {
    const saved = localStorage.getItem('serene_user');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [authToken, setAuthToken] = useState<string | null>(() => {
    return localStorage.getItem('serene_token');
  });

  // Core Data State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [settings, setSettings] = useState<AppSettings>(db.getSettings());

  // Connection & Sync State
  const [offlineMode, setOfflineMode] = useState<boolean>(db.isSimulatedOffline());
  const [syncStatus, setSyncStatus] = useState<'Online' | 'Offline' | 'Syncing' | 'Synced'>('Synced');
  const [pendingChanges, setPendingChanges] = useState<number>(0);

  // Modals Open State
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedTaskForEdit, setSelectedTaskForEdit] = useState<Task | null>(null);
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);

  // Toast Notification Overlay State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'info' | 'warning' | 'error'>('success');

  // Due task notifications and active alerts queue
  const [activeAlerts, setActiveAlerts] = useState<Task[]>([]);

  // Request browser notification permissions on mount if alerts are enabled
  useEffect(() => {
    if (settings.notificationsEnabled && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      try {
        Notification.requestPermission();
      } catch (err) {
        console.warn('Notification permission request not allowed in this environment:', err);
      }
    }
  }, [settings.notificationsEnabled]);

  // Dynamic interval checker for due and overdue tasks
  useEffect(() => {
    if (!settings.notificationsEnabled) return;

    const playChime = (priority: 'LOW' | 'MEDIUM' | 'HIGH') => {
      const isMuted = localStorage.getItem('alertSoundMuted') === 'true';
      if (isMuted) return;

      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();
        const now = ctx.currentTime;
        
        if (priority === 'HIGH') {
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gainNode = ctx.createGain();
          
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(587.33, now); // D5
          osc1.frequency.setValueAtTime(880.00, now + 0.15); // A5
          
          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(293.66, now); // D4
          osc2.frequency.setValueAtTime(440.00, now + 0.15); // A4
          
          gainNode.gain.setValueAtTime(0.18, now);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
          
          osc1.connect(gainNode);
          osc2.connect(gainNode);
          gainNode.connect(ctx.destination);
          
          osc1.start(now);
          osc1.stop(now + 0.6);
          osc2.start(now);
          osc2.stop(now + 0.6);
        } else if (priority === 'MEDIUM') {
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(523.25, now); // C5
          osc.frequency.setValueAtTime(659.25, now + 0.12); // E5
          
          gainNode.gain.setValueAtTime(0.15, now);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
          
          osc.connect(gainNode);
          gainNode.connect(ctx.destination);
          
          osc.start(now);
          osc.stop(now + 0.45);
        } else {
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440.00, now); // A4
          
          gainNode.gain.setValueAtTime(0.12, now);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          
          osc.connect(gainNode);
          gainNode.connect(ctx.destination);
          
          osc.start(now);
          osc.stop(now + 0.35);
        }
      } catch (err) {
        console.warn('AudioContext alert chime failed:', err);
      }
    };

    const triggerPush = (task: Task) => {
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification(`TaskHub: "${task.title}" is Due!`, {
            body: `Priority: ${task.priority}\n${task.description || 'Action required now.'}`,
            tag: task.id
          });
        }
      } catch (err) {
        console.warn('Native notification failed:', err);
      }
    };

    const checkDue = () => {
      const now = new Date();
      
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const currentDateStr = `${year}-${month}-${day}`;
      
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${hours}:${minutes}`;

      const currentMs = now.getTime();

      // Retrieve dismissed tasks IDs to avoid re-triggering
      const dismissedStr = localStorage.getItem('dismissedAlertTaskIds');
      const dismissedIds: string[] = dismissedStr ? JSON.parse(dismissedStr) : [];

      const triggeredTasks: Task[] = [];
      let dbUpdated = false;

      tasks.forEach(t => {
        if (t.status === 'Completed' || t.isDeleted || t.isArchived) return;
        if (dismissedIds.includes(t.id)) return;

        let shouldAlert = false;

        // 1. Due date & Due time comparison
        if (t.dueDate) {
          const dueTimeStr = t.dueTime || '00:00';
          const [tHours, tMins] = dueTimeStr.split(':').map(Number);
          const [tYear, tMonth, tDay] = t.dueDate.split('-').map(Number);
          
          const taskDueDateObj = new Date(tYear, tMonth - 1, tDay, tHours, tMins);
          const taskDueMs = taskDueDateObj.getTime();

          // If due date/time has been reached/passed, and alert wasn't sent
          if (currentMs >= taskDueMs && !t.reminderSent) {
            shouldAlert = true;
          }
        }

        // 2. Specific reminderTime if specified
        if (t.reminderTime && t.dueDate === currentDateStr && currentTimeStr === t.reminderTime && !t.reminderSent) {
          shouldAlert = true;
        }

        if (shouldAlert) {
          triggeredTasks.push(t);
          db.updateTask(t.id, { reminderSent: true });
          dbUpdated = true;

          // Sound trigger
          playChime(t.priority);
          // Native browser alert
          triggerPush(t);
        }
      });

      if (dbUpdated) {
        reloadDataFromStorage();
      }

      if (triggeredTasks.length > 0) {
        setActiveAlerts(prev => {
          const prevIds = prev.map(p => p.id);
          const filtered = triggeredTasks.filter(t => !prevIds.includes(t.id));
          return [...prev, ...filtered];
        });
      }
    };

    // Run first check
    checkDue();

    const checkInterval = setInterval(checkDue, 8000); // Check every 8 seconds
    return () => clearInterval(checkInterval);
  }, [tasks, settings.notificationsEnabled]);

  const handleAlertSnooze = (task: Task) => {
    setActiveAlerts(prev => prev.filter(t => t.id !== task.id));

    // Calculate snooze time (+5 mins)
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const snoozeDate = `${year}-${month}-${day}`;

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const snoozeTime = `${hours}:${minutes}`;

    db.updateTask(task.id, { 
      dueDate: snoozeDate, 
      dueTime: snoozeTime, 
      reminderSent: false 
    });

    db.addAuditLog('TASK_SNOOZE', `Snoozed task "${task.title}" for 5 minutes.`);
    showToast(`Task "${task.title}" snoozed for 5 minutes.`, 'info');
    
    reloadDataFromStorage();
    triggerSynchronization();
  };

  const handleAlertComplete = (task: Task) => {
    setActiveAlerts(prev => prev.filter(t => t.id !== task.id));

    db.updateTask(task.id, { status: 'Completed', completedAt: new Date().toISOString() });
    db.addAuditLog('TASK_COMPLETE', `Completed task "${task.title}" from alert overlay.`);
    showToast('Task completed successfully!', 'success');

    reloadDataFromStorage();
    triggerSynchronization();
  };

  const handleAlertDismiss = (task: Task) => {
    setActiveAlerts(prev => prev.filter(t => t.id !== task.id));

    const dismissedStr = localStorage.getItem('dismissedAlertTaskIds');
    const dismissedIds: string[] = dismissedStr ? JSON.parse(dismissedStr) : [];
    if (!dismissedIds.includes(task.id)) {
      dismissedIds.push(task.id);
      localStorage.setItem('dismissedAlertTaskIds', JSON.stringify(dismissedIds));
    }

    db.addAuditLog('ALERT_DISMISS', `Dismissed alert reminder for "${task.title}".`);
    showToast(`Alert for "${task.title}" dismissed.`, 'info');
    
    reloadDataFromStorage();
  };

  // Trigger custom toast alert
  const showToast = (message: string, type: typeof toastType = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Sync Timer Reference
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);

  // --- HYDRATE AND CORE SYNC ENGINE ---
  const reloadDataFromStorage = () => {
    setTasks(db.getTasks());
    setSettings(db.getSettings());
    setPendingChanges(db.getSyncQueue().length);
  };

  const handleAuthSuccess = async (user: { email: string }, token: string) => {
    localStorage.setItem('serene_user', JSON.stringify(user));
    localStorage.setItem('serene_token', token);
    setCurrentUser(user);
    setAuthToken(token);

    // After login, pull the user's data from the cloud database
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          queue: [],
          clientTimestamp: new Date().toISOString(),
        })
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.removeItem('dismissedAlertTaskIds');
        db.applyServerPull(data.tasks, data.habits, data.pomodoro, data.settings || undefined);
        showToast(`Welcome back, ${user.email}! Workspace loaded.`, 'success');
      }
    } catch (e) {
      console.error('Failed to sync on login', e);
    }
    reloadDataFromStorage();
  };

  const handleLogout = () => {
    localStorage.removeItem('serene_user');
    localStorage.removeItem('serene_token');
    localStorage.removeItem('dismissedAlertTaskIds');
    
    // Clear all user-specific local storage states
    localStorage.removeItem('prod_task_manager_tasks');
    localStorage.removeItem('prod_task_manager_sync_queue');

    // Re-initialize local database with empty/fresh seed
    db.initialize();

    setCurrentUser(null);
    setAuthToken(null);
    showToast('Signed out of TaskHub workspace.', 'info');
    reloadDataFromStorage();
  };

  useEffect(() => {
    if (authToken && currentUser) {
      reloadDataFromStorage();
    }
  }, [authToken, currentUser]);

  // Sync protocol trigger function
  const triggerSynchronization = async () => {
    if (offlineMode) {
      setSyncStatus('Offline');
      return;
    }
    if (!authToken) {
      return;
    }

    const queue = db.getSyncQueue();
    setSyncStatus('Syncing');

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      };

      const response = await fetch('/api/sync', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          queue,
          clientTimestamp: new Date().toISOString(),
        }),
      });

      if (response.status === 401) {
        handleLogout();
        showToast('Your session has expired. Please sign in again.', 'error');
        return;
      }

      if (!response.ok) {
        throw new Error(`Sync failure: Server responded with status ${response.status}`);
      }

      const data = await response.json();
      
      // Clear processed sync item IDs
      if (queue.length > 0) {
        db.clearSyncQueue(queue.map(q => q.id));
        db.addAuditLog('SYNC_PUSH', `Successfully uploaded ${queue.length} transactions to PostgreSQL database.`);
      }

      // Apply server pull response (LWW merge resolution)
      db.applyServerPull(data.tasks, data.habits, data.pomodoro, data.settings);
      
      // Update local state views
      reloadDataFromStorage();
      setSyncStatus('Synced');
    } catch (e) {
      console.warn('SyncEngine: Connection failed or server offline fallback activated.', e);
      setSyncStatus('Offline');
      db.addAuditLog('SYNC_FALLBACK', 'PostgreSQL database connection offline.');
    }
  };

  // Background Synchronizer loop
  useEffect(() => {
    if (syncTimerRef.current) clearInterval(syncTimerRef.current);

    if (!offlineMode) {
      triggerSynchronization();
      // Auto sync based on settings interval (default 30 seconds)
      syncTimerRef.current = setInterval(() => {
        triggerSynchronization();
      }, settings.syncInterval * 1000);
    } else {
      setSyncStatus('Offline');
    }

    return () => {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    };
  }, [offlineMode, settings.syncInterval]);

  // Toggle simulated offline mode
  const handleToggleOffline = () => {
    const nextState = !offlineMode;
    setOfflineMode(nextState);
    db.setSimulatedOffline(nextState);
    showToast(
      nextState 
        ? 'Offline Mode Activated. Operations are queued locally.' 
        : 'Online Connection Restored. Syncing...',
      nextState ? 'warning' : 'success'
    );
    triggerSynchronization();
  };

  // --- TASK ACTIONS ---
  const handleSaveTask = (taskData: any) => {
    if (taskData.id) {
      // Edit
      db.updateTask(taskData.id, taskData);
      showToast('Task updated successfully.');
    } else {
      // Create
      db.createTask(taskData);
      showToast('Task created successfully.');
    }
    reloadDataFromStorage();
    triggerSynchronization(); // trigger sync instantly
  };

  const handleToggleTaskStatus = (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'Completed' ? 'Pending' : 'Completed';
    db.updateTask(id, { status: nextStatus });
    showToast(nextStatus === 'Completed' ? 'Task finished!' : 'Task restored to pending.');
    reloadDataFromStorage();
    triggerSynchronization();
  };

  const handleToggleTaskPin = (id: string) => {
    db.togglePinTask(id);
    reloadDataFromStorage();
    triggerSynchronization();
  };

  const handleSoftDeleteTask = (id: string) => {
    db.softDeleteTask(id);
    showToast('Task moved to trash.', 'info');
    reloadDataFromStorage();
    triggerSynchronization();
  };

  const handleResetDatabase = () => {
    if (confirm('CRITICAL: Are you sure you want to purge all local and remote task databases? This cannot be undone.')) {
      localStorage.clear();
      db.initialize();
      db.clearLogs();
      db.addAuditLog('HARD_PURGE', 'Purged all local cache.');
      
      // Reset server side demo as well
      fetch('/api/admin/reset', { method: 'POST' })
        .then(() => {
          showToast('Database purged and reset successfully.', 'error');
          reloadDataFromStorage();
          triggerSynchronization();
        });
    }
  };

  // RENDER APP VIEW
  if (!authToken || !currentUser) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} showToast={showToast} />;
  }

  return (
    <div className="flex h-screen bg-[#0B0F19] text-slate-100 font-sans overflow-hidden relative">
      
      {/* Sidebar container */}
      <div className={`fixed inset-y-0 left-0 z-50 transform ${
        isSidebarOpenMobile ? 'translate-x-0' : '-translate-x-full'
      } transition-transform duration-200 ease-in-out md:relative md:translate-x-0 shrink-0`}>
        <Sidebar 
          offlineMode={offlineMode}
          toggleOfflineMode={handleToggleOffline}
          syncStatus={syncStatus}
          pendingChanges={pendingChanges}
          currentUser={currentUser}
          onLogout={handleLogout}
          onResetDatabase={handleResetDatabase}
          onCloseMobile={() => setIsSidebarOpenMobile(false)}
        />
      </div>

      {/* Backdrop for mobile */}
      {isSidebarOpenMobile && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden"
          onClick={() => setIsSidebarOpenMobile(false)}
        />
      )}

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-950/45">
        {/* Mobile Header Bar */}
        <header className="flex items-center justify-between px-6 py-4 bg-[#0F172A]/80 backdrop-blur-md border-b border-white/5 md:hidden shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSidebarOpenMobile(true)}
              className="p-2 hover:bg-white/5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="font-semibold text-sm tracking-tight text-white leading-tight">TaskHub</span>
          </div>
          
          {currentUser && (
            <span className="text-[10px] text-slate-500 font-mono tracking-wider">
              {currentUser.email.split('@')[0]}
            </span>
          )}
        </header>

        <div className="flex-1 py-6 px-4 md:py-8 md:px-10">
          <Dashboard 
            tasks={tasks}
            onAddTask={handleSaveTask}
            onEditTask={(task) => {
              setSelectedTaskForEdit(task);
              setIsTaskModalOpen(true);
            }}
            onToggleTaskStatus={handleToggleTaskStatus}
            onSoftDeleteTask={handleSoftDeleteTask}
            onToggleTaskPin={handleToggleTaskPin}
          />
        </div>
      </main>

      {/* Simplified Task Modal */}
      <TaskModal 
        task={selectedTaskForEdit}
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setSelectedTaskForEdit(null);
        }}
        onSave={handleSaveTask}
        onDelete={handleSoftDeleteTask}
      />

      {/* Toast popup notifications */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div className={`px-4 py-3 rounded-xl border text-xs font-semibold shadow-lg ${
            toastType === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' :
            toastType === 'info' ? 'bg-blue-500/10 text-blue-400 border-blue-500/25' :
            toastType === 'warning' ? 'bg-amber-500/10 text-amber-400 border-amber-500/25' :
            'bg-rose-500/10 text-rose-400 border-rose-500/25'
          }`}>
            {toastMessage}
          </div>
        </div>
      )}

      {/* Due Task Reminders alarm overlay */}
      <DueAlertOverlay 
        alerts={activeAlerts}
        onDismiss={handleAlertDismiss}
        onComplete={handleAlertComplete}
        onSnooze={handleAlertSnooze}
      />

    </div>
  );
}
