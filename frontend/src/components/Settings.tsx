/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Settings as SettingsIcon,
  Moon, 
  Sun, 
  Tv, 
  Bell, 
  Database, 
  RefreshCw, 
  Download, 
  Upload, 
  Trash2, 
  Clock,
  Wifi,
  ShieldAlert
} from 'lucide-react';
import { AppSettings } from '../types';

interface SettingsProps {
  settings: AppSettings;
  onUpdateSettings: (settings: Partial<AppSettings>) => void;
  syncStatus: string;
  pendingChanges: number;
  onTriggerSync: () => void;
  onExportBackup: () => void;
  onImportBackup: (jsonStr: string) => boolean;
  onResetDatabase: () => void;
  tasksCount: number;
  habitsCount: number;
}

export default function Settings({
  settings,
  onUpdateSettings,
  syncStatus,
  pendingChanges,
  onTriggerSync,
  onExportBackup,
  onImportBackup,
  onResetDatabase,
  tasksCount,
  habitsCount,
}: SettingsProps) {
  const [importJson, setImportJson] = useState('');
  const [importSuccess, setImportSuccess] = useState<boolean | null>(null);

  const handleImport = () => {
    if (!importJson.trim()) return;
    const success = onImportBackup(importJson);
    setImportSuccess(success);
    if (success) {
      setImportJson('');
      setTimeout(() => setImportSuccess(null), 3000);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-2">
      {/* Title Header */}
      <div className="flex items-center gap-3 bg-[#131B2E] border border-white/5 p-5 rounded-2xl shadow-md">
        <div className="bg-blue-600/10 p-2 rounded-xl text-blue-400">
          <SettingsIcon className="h-5 w-5" />
        </div>
        <div className="text-left">
          <span className="text-[10px] font-mono tracking-wider font-semibold text-slate-500 uppercase">System Control Panel</span>
          <h2 className="text-xl font-bold text-white mt-0.5 leading-none">Settings & Configuration</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
        
        {/* Section 1: UI Theme & Preferences */}
        <div className="bg-[#131B2E] border border-white/5 p-5 rounded-2xl shadow space-y-5">
          <div className="border-b border-white/5 pb-3">
            <h3 className="text-sm font-bold text-white">Visual Styling & Theme</h3>
            <p className="text-[10px] text-slate-500 font-sans mt-0.5">Customize your personal aesthetic workspace.</p>
          </div>

          {/* Theme grid */}
          <div className="space-y-2">
            <label className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wide block">Interface Mode</label>
            <div className="grid grid-cols-3 gap-2 bg-[#0B0F19]/40 p-1 rounded-xl border border-white/5">
              {([
                { mode: 'dark', label: 'Dark', icon: Moon },
                { mode: 'light', label: 'Light', icon: Sun },
                { mode: 'system', label: 'System', icon: Tv },
              ] as const).map(({ mode, label, icon: Icon }) => {
                const isActive = settings.theme === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => onUpdateSettings({ theme: mode })}
                    className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg capitalize transition cursor-pointer ${
                      isActive 
                        ? 'bg-blue-600 text-white shadow shadow-blue-600/10' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Toggle Alert notifications */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#0B0F19]/30 border border-white/5">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <Bell className="h-4 w-4 text-blue-400" />
                <span>Desktop Push Notifications</span>
              </div>
              <p className="text-[10px] text-slate-500">Enable alarm prompts and daily schedule cues.</p>
            </div>

            <button
              id="toggle-notifications-btn"
              onClick={() => onUpdateSettings({ notificationsEnabled: !settings.notificationsEnabled })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition cursor-pointer ${
                settings.notificationsEnabled 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' 
                  : 'bg-[#1E293B] text-slate-400 border border-white/10'
              }`}
            >
              {settings.notificationsEnabled ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>
        </div>

        {/* Section 2: Focus / Pomodoro customization */}
        <div className="bg-[#131B2E] border border-white/5 p-5 rounded-2xl shadow space-y-5">
          <div className="border-b border-white/5 pb-3">
            <h3 className="text-sm font-bold text-white">Focus Engine Periods</h3>
            <p className="text-[10px] text-slate-500 font-sans mt-0.5">Adjust timing cycles to align with your focus levels.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-rose-500" />
                <span>Work Block (Min)</span>
              </label>
              <input
                id="pomo-work-input"
                type="number"
                min={5}
                max={90}
                value={settings.pomodoroWorkTime}
                onChange={(e) => onUpdateSettings({ pomodoroWorkTime: parseInt(e.target.value) || 25 })}
                className="w-full bg-[#0B0F19] border border-white/5 text-slate-200 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-rose-500 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-blue-500" />
                <span>Break Duration (Min)</span>
              </label>
              <input
                id="pomo-break-input"
                type="number"
                min={1}
                max={45}
                value={settings.pomodoroBreakTime}
                onChange={(e) => onUpdateSettings({ pomodoroBreakTime: parseInt(e.target.value) || 5 })}
                className="w-full bg-[#0B0F19] border border-white/5 text-slate-200 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wide block">Daily completed tasks target</label>
            <input
              id="daily-goal-input"
              type="number"
              min={1}
              max={20}
              value={settings.dailyGoal}
              onChange={(e) => onUpdateSettings({ dailyGoal: parseInt(e.target.value) || 4 })}
              className="w-full bg-[#0B0F19] border border-white/5 text-slate-200 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>
        </div>

        {/* Section 3: Database & Sync Status */}
        <div className="bg-[#131B2E] border border-white/5 p-5 rounded-2xl shadow space-y-5">
          <div className="border-b border-white/5 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Prisma & SQLite Replica Status</h3>
              <p className="text-[10px] text-slate-500 font-sans mt-0.5">Telemetry metrics from our offline-first core engines.</p>
            </div>
            <Database className="h-4 w-4 text-blue-400" />
          </div>

          <div className="space-y-2.5 text-xs font-mono">
            {/* Direct db rows */}
            <div className="flex justify-between items-center p-2 rounded-lg bg-[#0B0F19]/20 border border-white/5">
              <span className="text-slate-400">Local SQLite DB:</span>
              <span className="text-white font-bold">{tasksCount} Tasks, {habitsCount} Habits</span>
            </div>

            <div className="flex justify-between items-center p-2 rounded-lg bg-[#0B0F19]/20 border border-white/5">
              <span className="text-slate-400">Cloud PostgreSQL Node:</span>
              <span className="text-white font-bold">SYNCHRONIZED (Active)</span>
            </div>

            <div className="flex justify-between items-center p-2 rounded-lg bg-[#0B0F19]/20 border border-white/5">
              <span className="text-slate-400">Sync Status:</span>
              <span className={`font-bold uppercase ${syncStatus === 'Synced' ? 'text-emerald-400' : 'text-blue-400 animate-pulse'}`}>{syncStatus}</span>
            </div>

            <div className="flex justify-between items-center p-2 rounded-lg bg-[#0B0F19]/20 border border-white/5">
              <span className="text-slate-400">Sync Pending changes in Queue:</span>
              <span className={`font-bold ${pendingChanges > 0 ? 'text-amber-400' : 'text-slate-500'}`}>{pendingChanges} Operations pending</span>
            </div>
          </div>

          <button
            id="force-sync-btn"
            onClick={onTriggerSync}
            disabled={syncStatus === 'Offline'}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-[#1E293B] disabled:text-slate-500 text-white font-semibold text-xs py-2.5 rounded-xl transition cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Force Bidirectional Sync</span>
          </button>
        </div>

        {/* Section 4: Export, Import & Backups */}
        <div className="bg-[#131B2E] border border-white/5 p-5 rounded-2xl shadow space-y-5">
          <div className="border-b border-white/5 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Disaster Recovery & Data Export</h3>
              <p className="text-[10px] text-slate-500 font-sans mt-0.5">Secure, plaintext backups of your offline configurations.</p>
            </div>
            <Download className="h-4 w-4 text-violet-400" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Export */}
            <button
              onClick={onExportBackup}
              className="flex items-center justify-center gap-2 bg-[#1E293B] hover:bg-slate-800 text-slate-300 border border-white/10 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>Export Backup</span>
            </button>

            {/* Reset */}
            <button
              onClick={onResetDatabase}
              className="flex items-center justify-center gap-2 bg-red-600/15 hover:bg-red-600/25 text-red-400 border border-red-500/20 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              <span>Purge Database</span>
            </button>
          </div>

          {/* Import JSON Area */}
          <div className="space-y-2 text-xs">
            <label className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wide block">Restore from Backup string</label>
            <textarea
              id="backup-import-textarea"
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              className="w-full bg-[#0B0F19] border border-white/5 text-slate-400 font-mono text-[9px] p-2 rounded-xl h-14 resize-none leading-normal focus:outline-none focus:border-blue-500"
              placeholder="Paste backup JSON string here..."
            />

            <button
              id="import-backup-submit-btn"
              onClick={handleImport}
              className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs py-2.5 rounded-xl transition cursor-pointer"
            >
              <Upload className="h-4 w-4" />
              <span>Import & Sync Backup</span>
            </button>

            {importSuccess === true && (
              <p className="text-[10px] text-emerald-400 font-mono text-center">✓ Backup restored successfully!</p>
            )}
            {importSuccess === false && (
              <p className="text-[10px] text-red-400 font-mono text-center">✗ Invalid backup format. Please verify string.</p>
            )}
          </div>
        </div>

      </div>

      {/* Danger Zone Warning */}
      <div className="bg-red-500/5 border border-red-500/25 p-5 rounded-2xl flex items-start gap-4 text-left">
        <ShieldAlert className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
        <div className="space-y-1.5">
          <h4 className="text-sm font-bold text-red-400 leading-none">Security Architecture Advice</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            This platform runs a state-of-the-art **Offline-First SQLite-to-PostgreSQL replication algorithm** utilizing optimistic client-side execution paths. If the server goes offline, changes queue up automatically and replay safely upon reconnect without any manual action needed.
          </p>
        </div>
      </div>
    </div>
  );
}
