/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Terminal, 
  Clock, 
  Wifi, 
  WifiOff, 
  BookOpen, 
  Settings as SettingsIcon,
  BarChart3,
  X,
  Play
} from 'lucide-react';
import { Task } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  onNavigate: (tab: string) => void;
  onToggleOffline: () => void;
  offlineMode: boolean;
  onStartPomodoro: () => void;
}

export default function CommandPalette({
  isOpen,
  onClose,
  tasks,
  onSelectTask,
  onNavigate,
  onToggleOffline,
  offlineMode,
  onStartPomodoro,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement | null>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Filter tasks based on query
  const filteredTasks = tasks.filter(t => 
    !t.isDeleted &&
    (t.title.toLowerCase().includes(query.toLowerCase()) ||
    t.description.toLowerCase().includes(query.toLowerCase()) ||
    t.category.toLowerCase().includes(query.toLowerCase()) ||
    t.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase())) ||
    t.priority.toLowerCase().includes(query.toLowerCase()) ||
    t.status.toLowerCase().includes(query.toLowerCase()))
  ).slice(0, 5); // Limit to top 5 results

  // Commands list
  const commands = [
    { id: 'pomo', label: 'Launch Pomodoro Timer', icon: Clock, action: () => { onStartPomodoro(); onClose(); } },
    { id: 'offline', label: offlineMode ? 'Go Online (Enable Sync)' : 'Go Offline (Simulate Offline Queue)', icon: offlineMode ? Wifi : WifiOff, action: () => { onToggleOffline(); onClose(); } },
    { id: 'nav-stats', label: 'Navigate to Statistics', icon: BarChart3, action: () => { onNavigate('statistics'); onClose(); } },
    { id: 'nav-notes', label: 'Navigate to Markdown Notes', icon: BookOpen, action: () => { onNavigate('notes'); onClose(); } },
    { id: 'nav-settings', label: 'Navigate to Settings', icon: SettingsIcon, action: () => { onNavigate('settings'); onClose(); } },
  ].filter(cmd => cmd.label.toLowerCase().includes(query.toLowerCase()));

  const totalResultsCount = filteredTasks.length + commands.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(totalResultsCount, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + totalResultsCount) % Math.max(totalResultsCount, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex < filteredTasks.length) {
        // Task selection
        onSelectTask(filteredTasks[selectedIndex]);
        onClose();
      } else {
        // Command execution
        const cmdIndex = selectedIndex - filteredTasks.length;
        if (commands[cmdIndex]) {
          commands[cmdIndex].action();
        }
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-[#0B0F19]/80 backdrop-blur-sm flex items-start justify-center p-4 z-50 pt-[15vh]"
      onClick={onClose}
    >
      <div 
        id="cmd-palette-modal"
        className="bg-[#131B2E] border border-white/5 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search header bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/5 bg-[#0B0F19]/20">
          <Search className="h-5 w-5 text-slate-500" />
          <input
            id="cmd-palette-search-input"
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-0 w-full"
            placeholder="Type a task name, category, priority, tag or system action macro..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
          <span className="text-[10px] bg-[#1E293B] text-slate-500 border border-white/10 px-1.5 py-0.5 rounded font-mono select-none">ESC</span>
        </div>

        {/* Results layout */}
        <div className="flex-1 max-h-80 overflow-y-auto p-2 space-y-3">
          
          {/* Section 1: Tasks results */}
          {filteredTasks.length > 0 && (
            <div className="space-y-1 text-left">
              <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider px-3 select-none">Action items</span>
              <div className="space-y-0.5">
                {filteredTasks.map((task, idx) => {
                  const isHighlighted = idx === selectedIndex;
                  return (
                    <div
                      key={task.id}
                      onClick={() => {
                        onSelectTask(task);
                        onClose();
                      }}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition duration-150 ${
                        isHighlighted 
                          ? 'bg-blue-600 text-white font-medium' 
                          : 'hover:bg-[#1E293B]/40 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${
                          isHighlighted 
                            ? 'bg-white/20 text-white' 
                            : 'bg-[#1E293B] text-slate-400'
                        }`}>
                          {task.category}
                        </span>
                        <span className="text-xs truncate">{task.title}</span>
                      </div>

                      <span className={`text-[10px] font-mono ${isHighlighted ? 'text-blue-200' : 'text-slate-500'}`}>
                        {task.priority}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 2: Macro system commands */}
          {commands.length > 0 && (
            <div className="space-y-1 text-left">
              <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider px-3 select-none">System operations</span>
              <div className="space-y-0.5">
                {commands.map((cmd, idx) => {
                  const realIdx = idx + filteredTasks.length;
                  const isHighlighted = realIdx === selectedIndex;
                  const Icon = cmd.icon;
                  return (
                    <div
                      key={cmd.id}
                      onClick={cmd.action}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition duration-150 ${
                        isHighlighted 
                          ? 'bg-blue-600 text-white font-medium' 
                          : 'hover:bg-[#1E293B]/40 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`h-4.5 w-4.5 ${isHighlighted ? 'text-white' : 'text-slate-500'}`} />
                        <span className="text-xs">{cmd.label}</span>
                      </div>
                      
                      <span className={`text-[10px] font-mono uppercase font-bold ${isHighlighted ? 'text-blue-200' : 'text-slate-500'}`}>
                        MACRO
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {totalResultsCount === 0 && (
            <div className="py-8 text-center text-slate-500 text-xs italic select-none">
              No index items match your query.
            </div>
          )}
        </div>

        {/* Footer info line */}
        <div className="bg-[#0B0F19]/30 px-4 py-2 border-t border-white/5 flex justify-between text-[10px] text-slate-500 font-mono select-none">
          <div className="flex gap-2">
            <span>↑↓ Navigation</span>
            <span>•</span>
            <span>ENTER trigger</span>
          </div>
          <span>Active Registry</span>
        </div>
      </div>
    </div>
  );
}
