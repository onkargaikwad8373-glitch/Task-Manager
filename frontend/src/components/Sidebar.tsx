/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Wifi, 
  WifiOff, 
  Zap, 
  LogOut,
  Trash2,
  X
} from 'lucide-react';

interface SidebarProps {
  offlineMode: boolean;
  toggleOfflineMode: () => void;
  syncStatus: 'Online' | 'Offline' | 'Syncing' | 'Synced';
  pendingChanges: number;
  currentUser: { email: string } | null;
  onLogout: () => void;
  onResetDatabase: () => void;
  onCloseMobile?: () => void;
}

export default function Sidebar({
  offlineMode,
  toggleOfflineMode,
  syncStatus,
  pendingChanges,
  currentUser,
  onLogout,
  onResetDatabase,
  onCloseMobile,
}: SidebarProps) {
  return (
    <aside 
      id="app-sidebar"
      className="bg-[#0F172A] w-64 flex flex-col h-screen text-slate-100 select-none shrink-0 border-r border-white/5 text-left"
    >
      {/* Brand Header */}
      <div className="p-6 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-500/20">
            <Zap className="h-5 w-5 fill-current" />
          </div>
          <div>
            <h1 className="font-semibold text-sm tracking-tight text-white leading-tight">Serene</h1>
            <span className="text-[10px] text-slate-400 font-mono tracking-wider">PRODUCTIVITY</span>
          </div>
        </div>

        {/* Close Button on Mobile Drawer */}
        {onCloseMobile && (
          <button 
            onClick={onCloseMobile}
            className="md:hidden p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
            title="Close Drawer"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        )}
      </div>

      {/* Network & Sync Badge Panel */}
      <div className="px-6 py-4 border-b border-white/5 bg-[#0B0F19]/40">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            {offlineMode ? (
              <WifiOff className="h-3.5 w-3.5 text-amber-500" />
            ) : (
              <Wifi className="h-3.5 w-3.5 text-emerald-500" />
            )}
            <span className="text-xs font-medium">
              {offlineMode ? 'Simulated Offline' : 'Online'}
            </span>
          </div>
          
          <button
            id="toggle-offline-btn"
            onClick={toggleOfflineMode}
            className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold transition cursor-pointer ${
              offlineMode 
                ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20' 
                : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20'
            }`}
          >
            {offlineMode ? 'Go Online' : 'Go Offline'}
          </button>
        </div>

        {/* Sync Status Progress */}
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
          <div className="flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${
              syncStatus === 'Synced' ? 'bg-emerald-500' :
              syncStatus === 'Syncing' ? 'bg-blue-500 animate-pulse' :
              syncStatus === 'Offline' ? 'bg-amber-500' : 'bg-red-500'
            }`} />
            <span>{syncStatus}</span>
          </div>
          {pendingChanges > 0 && (
            <span className="text-amber-400 font-semibold bg-amber-400/10 px-1.5 py-0.2 rounded">
              {pendingChanges} queued
            </span>
          )}
        </div>
      </div>

      {/* Navigation Space */}
      <div className="flex-1 px-4 py-6 space-y-6">
        <div className="space-y-4">
          <span className="text-[10px] font-mono font-semibold text-[#64748B] tracking-wider uppercase px-3 block">Workspace</span>
          <div className="px-3 py-2 bg-white/5 rounded-lg border border-white/5 text-xs text-[#94A3B8]">
            Task Board mode active. Manage all upcoming items and previous operations.
          </div>
        </div>

        <button
          onClick={onResetDatabase}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition duration-150 cursor-pointer"
        >
          <Trash2 className="h-4.5 w-4.5 text-red-400" />
          <span>Purge Database</span>
        </button>
      </div>

      {/* User Section */}
      {currentUser && (
        <div className="p-4 border-t border-white/5 bg-[#0B0F19]/30 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-7 w-7 rounded-full bg-indigo-600/20 text-indigo-400 border border-indigo-500/10 flex items-center justify-center font-bold text-xs shrink-0 font-mono">
                {currentUser.email[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-mono leading-none">Session Active</div>
                <div className="text-xs text-[#94A3B8] font-medium truncate leading-normal" title={currentUser.email}>
                  {currentUser.email}
                </div>
              </div>
            </div>
            
            <button
              onClick={onLogout}
              className="p-1.5 hover:bg-white/5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
              title="Logout Session"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
