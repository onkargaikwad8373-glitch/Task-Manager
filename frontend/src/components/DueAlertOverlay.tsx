import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  Check, 
  Clock, 
  X, 
  AlertTriangle, 
  Volume2, 
  VolumeX, 
  ArrowRight,
  Flame,
  Calendar
} from 'lucide-react';
import { Task } from '../types';

interface DueAlertOverlayProps {
  alerts: Task[];
  onDismiss: (task: Task) => void;
  onComplete: (task: Task) => void;
  onSnooze: (task: Task) => void;
}

export default function DueAlertOverlay({
  alerts,
  onDismiss,
  onComplete,
  onSnooze,
}: DueAlertOverlayProps) {
  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem('alertSoundMuted') === 'true';
  });

  const toggleMute = () => {
    const nextState = !isMuted;
    setIsMuted(nextState);
    localStorage.setItem('alertSoundMuted', nextState.toString());
  };

  if (alerts.length === 0) return null;

  // Render top/current alert in focus, stack others underneath visually or list them
  const currentAlert = alerts[0];
  const remainingCount = alerts.length - 1;

  // Determine priority color palette
  const getPriorityTheme = (priority: 'LOW' | 'MEDIUM' | 'HIGH') => {
    switch (priority) {
      case 'HIGH':
        return {
          bg: 'bg-red-950/95 border-red-500/30',
          pulse: 'bg-red-500',
          ring: 'ring-red-500/20',
          text: 'text-red-400',
          buttonBg: 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20',
          accent: 'border-l-4 border-red-500',
        };
      case 'MEDIUM':
        return {
          bg: 'bg-amber-950/95 border-amber-500/30',
          pulse: 'bg-amber-500',
          ring: 'ring-amber-500/20',
          text: 'text-amber-400',
          buttonBg: 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-500/20',
          accent: 'border-l-4 border-amber-500',
        };
      default:
        return {
          bg: 'bg-blue-950/95 border-blue-500/30',
          pulse: 'bg-blue-500',
          ring: 'ring-blue-500/20',
          text: 'text-blue-400',
          buttonBg: 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20',
          accent: 'border-l-4 border-blue-500',
        };
    }
  };

  const theme = getPriorityTheme(currentAlert.priority);

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentAlert.id}
          initial={{ scale: 0.9, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.95, y: -10, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          className={`w-full max-w-lg overflow-hidden rounded-3xl border ${theme.bg} shadow-2xl shadow-slate-950/90 relative ${theme.accent}`}
        >
          {/* Header Bar */}
          <div className="p-6 pb-4 flex items-center justify-between border-b border-white/5 bg-[#0B0F19]/40">
            <div className="flex items-center gap-3">
              {/* Pulsing notification indicator */}
              <div className="relative">
                <span className={`absolute inline-flex h-3 w-3 rounded-full opacity-75 animate-ping ${theme.pulse}`} />
                <span className={`relative inline-flex rounded-full h-3 w-3 ${theme.pulse}`} />
              </div>

              <div className="flex items-center gap-2">
                <Bell className={`h-4.5 w-4.5 ${theme.text}`} />
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
                  Task Due Reminder
                </span>
              </div>
            </div>

            {/* Mute toggle */}
            <button
              onClick={toggleMute}
              className="p-1.5 hover:bg-slate-800/60 rounded-xl text-slate-400 hover:text-white transition cursor-pointer"
              title={isMuted ? 'Unmute alerts' : 'Mute alerts'}
            >
              {isMuted ? <VolumeX className="h-4.5 w-4.5 text-red-400" /> : <Volume2 className="h-4.5 w-4.5 text-slate-400" />}
            </button>
          </div>

          {/* Alert Body */}
          <div className="p-6 space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="bg-slate-900 text-slate-400 px-2 py-0.5 rounded font-mono text-[9px] font-bold uppercase border border-white/5">
                  {currentAlert.category}
                </span>
                <span className={`text-[10px] font-bold font-mono uppercase ${theme.text}`}>
                  {currentAlert.priority} Priority
                </span>
              </div>

              <h2 className="text-lg font-bold text-white tracking-tight leading-snug">
                {currentAlert.title}
              </h2>

              {currentAlert.description && (
                <p className="text-xs text-slate-300 leading-relaxed max-h-24 overflow-y-auto pr-2">
                  {currentAlert.description}
                </p>
              )}
            </div>

            {/* Timings row */}
            <div className="grid grid-cols-2 gap-3 bg-slate-950/60 border border-white/5 p-3.5 rounded-xl text-xs font-mono">
              <div className="flex items-center gap-2 text-slate-400">
                <Calendar className="h-4 w-4 text-slate-500" />
                <div>
                  <div className="text-[9px] text-slate-500 uppercase">Due Date</div>
                  <div className="text-slate-200 font-bold">{currentAlert.dueDate}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <Clock className="h-4 w-4 text-slate-500" />
                <div>
                  <div className="text-[9px] text-slate-500 uppercase">Due Time</div>
                  <div className={`font-bold ${theme.text}`}>{currentAlert.dueTime || '00:00'}</div>
                </div>
              </div>
            </div>

            {/* Secondary notes preview if available */}
            {currentAlert.tags && currentAlert.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {currentAlert.tags.map(tag => (
                  <span key={tag} className="text-[9px] font-semibold text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-white/5">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Multi Stack indicators */}
          {remainingCount > 0 && (
            <div className="px-6 py-2 bg-slate-950/40 border-t border-b border-white/5 flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span>+ {remainingCount} other task{remainingCount > 1 ? 's' : ''} awaiting action</span>
              <span className="text-[9px] bg-[#1E293B] px-1.5 py-0.5 rounded text-slate-300 font-bold">Queue Active</span>
            </div>
          )}

          {/* Actions Footer */}
          <div className="p-6 bg-[#0B0F19]/40 border-t border-white/5 flex flex-wrap items-center justify-between gap-3">
            {/* Left: Dismiss */}
            <button
              onClick={() => onDismiss(currentAlert)}
              className="flex items-center gap-1.5 px-4 py-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-bold border border-white/5 transition cursor-pointer"
              title="Acknowledge alert but leave task incomplete"
            >
              <X className="h-4 w-4" />
              <span>Dismiss</span>
            </button>

            {/* Right Group: Snooze & Complete */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onSnooze(currentAlert)}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold border border-white/5 transition cursor-pointer"
                title="Snooze this task's reminder for 5 minutes"
              >
                <Clock className="h-4 w-4 text-slate-400" />
                <span>Snooze 5m</span>
              </button>

              <button
                onClick={() => onComplete(currentAlert)}
                className={`flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${theme.buttonBg}`}
                title="Mark task as Completed now"
              >
                <Check className="h-4 w-4" />
                <span>Complete</span>
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
