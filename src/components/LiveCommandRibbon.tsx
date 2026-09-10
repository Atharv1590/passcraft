import React, { useState, useEffect } from 'react';
import { EventItem, ActiveTab } from '../types';
import { 
  Sparkles, 
  ScanLine, 
  Users, 
  Send, 
  ShieldCheck, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  Radio, 
  QrCode, 
  Zap,
  TrendingUp,
  Activity
} from 'lucide-react';

interface LiveCommandRibbonProps {
  currentSelectedEvent?: EventItem;
  activeEvents: EventItem[];
  selectedEventId: string;
  onSelectEvent: (eventId: string) => void;
  assignedCount: number;
  unassignedCount: number;
  checkedInCount: number;
  totalPasses: number;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  currentUserEmail: string | null;
  isGateOperator: boolean;
  isClientViewer: boolean;
  activeDevicesCount: number;
  onOpenGmailModal: () => void;
}

export const LiveCommandRibbon: React.FC<LiveCommandRibbonProps> = ({
  currentSelectedEvent,
  activeEvents,
  selectedEventId,
  onSelectEvent,
  assignedCount,
  unassignedCount,
  checkedInCount,
  totalPasses,
  activeTab,
  setActiveTab,
  currentUserEmail,
  isGateOperator,
  isClientViewer,
  activeDevicesCount,
  onOpenGmailModal
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const checkInRate = assignedCount > 0 ? Math.round((checkedInCount / assignedCount) * 100) : 0;
  const isAllEvents = selectedEventId === 'all' || !currentSelectedEvent;

  return (
    <section 
      id="live-command-ribbon"
      aria-label="Live Event Command Hub"
      className="mb-6 relative z-10"
    >
      {/* Outer ambient glow wrapper */}
      <div className="rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-cyan-500/10 p-[1px] shadow-2xl">
        <div className="rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-white/10 overflow-hidden">
          
          {/* Top Live Status Ribbon Bar (Times of India / Apple style) */}
          <div className="px-4 py-2.5 bg-slate-950/70 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-3 text-xs">
            
            {/* Live Telemetry Beacon & Headline */}
            <div className="flex items-center gap-2.5">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <div className="flex items-center gap-2 font-mono text-[11px] font-semibold text-slate-300">
                <span className="text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <Radio className="w-3 h-3 animate-pulse text-emerald-400" />
                  LIVE COMMAND
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400">{currentTime}</span>
                <span className="text-slate-600 hidden sm:inline">•</span>
                <span className="text-indigo-300 font-sans hidden sm:inline">
                  {isAllEvents 
                    ? `Consolidated Feed (${activeEvents.length} Active Events)` 
                    : `Active Focus: ${currentSelectedEvent.title}`}
                </span>
              </div>
            </div>

            {/* Quick Metrics & Toggle Expand */}
            <div className="flex items-center gap-3 ml-auto">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden md:inline">Turnstile Rate:</span>
                <span className="font-mono font-bold text-white bg-slate-800/80 px-2 py-0.5 rounded-full border border-white/10">
                  {checkInRate}% Checked-in
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title={isExpanded ? 'Collapse Ribbon' : 'Expand Ribbon'}
                aria-label="Toggle ribbon details"
              >
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Expanded Interactive Card Hub (Samsung One UI / Apple Widget grid) */}
          {isExpanded && (
            <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
              
              {/* Event Spotlight (Columns 1-5) */}
              <div className="lg:col-span-5 flex flex-col justify-center space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-black tracking-widest px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {isAllEvents ? 'All Operations' : currentSelectedEvent.category || 'Event Spotlight'}
                  </span>
                  {currentSelectedEvent?.status === 'ended' && (
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      Concluded
                    </span>
                  )}
                  {currentUserEmail && (
                    <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 ml-auto">
                      <ShieldCheck className="w-3 h-3" />
                      Cloud Live
                    </span>
                  )}
                </div>

                <h2 className="text-lg sm:text-xl font-black tracking-tight text-white line-clamp-1">
                  {isAllEvents ? 'Multi-Event Command Dashboard' : currentSelectedEvent.title}
                </h2>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-medium">
                  {currentSelectedEvent?.location && !isAllEvents && (
                    <span className="flex items-center gap-1 line-clamp-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      {currentSelectedEvent.location}
                    </span>
                  )}
                  {currentSelectedEvent?.date && !isAllEvents && (
                    <span className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      {currentSelectedEvent.date} {currentSelectedEvent.time ? `• ${currentSelectedEvent.time}` : ''}
                    </span>
                  )}
                  {isAllEvents && (
                    <span className="text-slate-400 text-xs">
                      Instant coordination across all ticket pools, turnstiles, and attendee broadcasts.
                    </span>
                  )}
                </div>
              </div>

              {/* Progress & Live KPIs (Columns 6-9) */}
              <div className="lg:col-span-4 bg-slate-950/50 rounded-xl p-3 border border-white/5 flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Check-In Velocity</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {checkedInCount} / {assignedCount} Admitted
                  </span>
                </div>

                {/* Animated Gradient Progress Track */}
                <div className="w-full bg-slate-800/80 rounded-full h-2.5 overflow-hidden p-0.5 border border-white/5">
                  <div 
                    className="bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 h-full rounded-full transition-all duration-500 shadow-sm"
                    style={{ width: `${Math.max(5, Math.min(100, checkInRate))}%` }}
                  ></div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono">
                  <div className="bg-slate-900/60 rounded-lg py-1 border border-white/5">
                    <div className="text-[10px] text-slate-400 font-sans">Total Pool</div>
                    <div className="text-xs font-bold text-white">{totalPasses}</div>
                  </div>
                  <div className="bg-slate-900/60 rounded-lg py-1 border border-white/5">
                    <div className="text-[10px] text-slate-400 font-sans">Assigned</div>
                    <div className="text-xs font-bold text-indigo-300">{assignedCount}</div>
                  </div>
                  <div className="bg-slate-900/60 rounded-lg py-1 border border-white/5">
                    <div className="text-[10px] text-slate-400 font-sans">Queue</div>
                    <div className="text-xs font-bold text-amber-400">{unassignedCount}</div>
                  </div>
                </div>
              </div>

              {/* Quick Action Dock (Columns 10-12, Amazon / Apple Quick Action style) */}
              <div className="lg:col-span-3 flex flex-row lg:flex-col gap-2">
                <button
                  id="ribbon-btn-gate-scanner"
                  type="button"
                  onClick={() => setActiveTab('gate_scanner')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-sm ${
                    activeTab === 'gate_scanner'
                      ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                      : 'bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50 border border-emerald-500/30'
                  }`}
                >
                  <ScanLine className="w-3.5 h-3.5" />
                  <span>Turnstile Gate</span>
                </button>

                <button
                  id="ribbon-btn-scan-assign"
                  type="button"
                  onClick={() => setActiveTab('scanner')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-sm ${
                    activeTab === 'scanner'
                      ? 'bg-indigo-600 text-white shadow-indigo-500/20'
                      : 'bg-slate-800/80 text-slate-200 hover:bg-slate-700/80 border border-white/10'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Scan &amp; Assign</span>
                </button>

                {!isGateOperator && (
                  <button
                    id="ribbon-btn-pass-bomber"
                    type="button"
                    onClick={() => setActiveTab('email_tickets')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-sm ${
                      activeTab === 'email_tickets'
                        ? 'bg-indigo-600 text-white shadow-indigo-500/20'
                        : 'bg-slate-800/80 text-slate-200 hover:bg-slate-700/80 border border-white/10'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Pass Bomber</span>
                  </button>
                )}
              </div>

            </div>
          )}

        </div>
      </div>
    </section>
  );
};
