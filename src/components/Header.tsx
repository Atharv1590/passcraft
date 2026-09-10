import React from 'react';
import { ActiveTab, EventItem, CurrentUserSession } from '../types';
import { 
  QrCode, 
  PlusCircle, 
  ScanLine, 
  Users, 
  ListCheck, 
  Palette,
  Sparkles,
  Printer,
  Mail,
  Send,
  ShieldCheck,
  ShieldAlert,
  Filter,
  HeartHandshake,
  DollarSign,
  Calendar,
  Lock,
  Eye,
  Key,
  FileText,
  ClipboardList
} from 'lucide-react';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  assignedCount: number;
  unassignedCount: number;
  eventsCount: number;
  events: EventItem[];
  selectedEventId: string;
  onSelectEvent: (eventId: string) => void;
  currentUserEmail: string | null;
  currentSession: CurrentUserSession | null;
  onOpenGmailModal: () => void;
  activeDevicesCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  assignedCount,
  unassignedCount,
  eventsCount,
  events,
  selectedEventId,
  onSelectEvent,
  currentUserEmail,
  currentSession,
  onOpenGmailModal,
  activeDevicesCount = 1,
}) => {
  const isGateOperator = currentSession?.role === 'gate_operator';
  const isClientViewer = currentSession?.role === 'client_viewer';
  const isOwner = !currentSession || currentSession.isOwner || currentSession.role === 'owner';
  const isScopedEvent = Boolean(currentSession?.allowedEventId && currentSession.allowedEventId !== 'all');

  // Filter active events respecting allowedEventId if scoped
  const activeEvents = events.filter(e => {
    if (e.status === 'ended') return false;
    if (isScopedEvent) {
      const idMatch = currentSession?.allowedEventId && e.id === currentSession.allowedEventId;
      const titleMatch = currentSession?.allowedEventTitle && e.title.toLowerCase().trim() === currentSession.allowedEventTitle.toLowerCase().trim();
      return idMatch || titleMatch;
    }
    return true;
  });

  const currentSelectedEvent = events.find(e => e.id === selectedEventId) || activeEvents[0];

  return (
    <header className="bg-slate-950 border-b border-slate-800 text-white sticky top-0 z-40 shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-3.5 gap-4">
          
          {/* Brand Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-indigo-600 text-white font-black flex items-center justify-center text-xl tracking-tighter rounded-xl shadow-lg shadow-indigo-600/30">
              <QrCode className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tighter leading-none text-white">
                  PASS<span className="text-indigo-400 font-light italic">CRAFT</span>
                </h1>
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 rounded-full">
                  PRO
                </span>
                {isGateOperator && (
                  <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-full font-mono flex items-center gap-1">
                    <ScanLine className="w-3 h-3" />
                    Gate Security
                  </span>
                )}
                {isClientViewer && (
                  <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full font-mono flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    Client Live View
                  </span>
                )}
              </div>
              <p className="text-[11px] font-medium tracking-wide text-slate-400 mt-0.5">
                Easy event management
              </p>
            </div>
          </div>

          {/* Global Event Selector & Key Metrics Pills & Gmail Auth Button */}
          <div className="flex items-center flex-wrap gap-2.5 text-xs">
            
            {/* Global Event Selector Dropdown (Respects event scoping) */}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/80 px-3 py-1.5 rounded-xl shadow-sm">
              <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap hidden sm:inline">
                Event:
              </span>
              {isScopedEvent ? (
                <div className="text-xs font-bold text-white max-w-[180px] sm:max-w-[240px] truncate flex items-center gap-1.5 font-mono">
                  <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>{activeEvents[0]?.title || currentSession?.allowedEventTitle || 'Assigned Event'}</span>
                </div>
              ) : (
                <select
                  value={selectedEventId}
                  onChange={e => onSelectEvent(e.target.value)}
                  className="bg-slate-950 text-white font-semibold text-xs border border-slate-700 rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500 max-w-[180px] sm:max-w-[240px] truncate cursor-pointer"
                >
                  <option value="all">⚡ All Events ({activeEvents.length})</option>
                  {activeEvents.map(ev => (
                    <option key={ev.id} value={ev.id}>
                      📅 {ev.title}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Gmail Auth & Multi-Device Sync Status Pill */}
            <button
              onClick={onOpenGmailModal}
              className={`px-3 py-1.5 border rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                currentUserEmail
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60 shadow-sm'
                  : 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-indigo-600 hover:text-white hover:border-indigo-500'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              {currentUserEmail ? (
                <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold">
                  <span className="max-w-[120px] truncate">{currentUserEmail}</span>
                  <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 rounded text-[9px] uppercase font-sans flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    {activeDevicesCount > 1 ? `${activeDevicesCount} Devices` : '1 Device'}
                  </span>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                </div>
              ) : (
                <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <Key className="w-3.5 h-3.5 text-indigo-400" />
                  LOGIN / QUICK CODE
                </span>
              )}
            </button>

            <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned:</span>
              <span className="font-mono font-bold text-emerald-400">{assignedCount}</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400"></span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Queue:</span>
              <span className="font-mono font-bold text-amber-400">{unassignedCount}</span>
            </div>
          </div>
        </div>

        {/* Selected Event Indicator Banner if specific event chosen */}
        {selectedEventId !== 'all' && currentSelectedEvent && (
          <div className="bg-indigo-950/40 border border-indigo-500/30 px-4 py-2 rounded-xl mb-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-400">
                FILTERING BY EVENT:
              </span>
              <span className="font-bold text-white">{currentSelectedEvent.title}</span>
              <span className="text-[10px] text-slate-400 font-mono">({currentSelectedEvent.date})</span>
            </div>
            {!isScopedEvent && (
              <button
                onClick={() => onSelectEvent('all')}
                className="text-[10px] font-semibold text-indigo-300 hover:text-indigo-200 hover:underline uppercase cursor-pointer"
              >
                Show All Events
              </button>
            )}
          </div>
        )}

        {/* Navigation Tabs (Restricted when logged in as Gate Operator) */}
        <nav className="flex overflow-x-auto no-scrollbar gap-1.5 border-t border-slate-800/80 pt-2 pb-2 text-xs font-bold tracking-normal">
          
          {/* Gate Scanner Tab: Visible for Everyone */}
          <button
            id="tab-gate-scanner"
            onClick={() => setActiveTab('gate_scanner')}
            className={`flex items-center gap-2 px-3.5 py-2 transition-all whitespace-nowrap rounded-xl cursor-pointer ${
              activeTab === 'gate_scanner'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <ScanLine className="h-4 w-4 text-emerald-400" />
            Gate Scanner
          </button>

          {/* Scan & Assign Tab: Visible for Everyone */}
          <button
            id="tab-scanner"
            onClick={() => setActiveTab('scanner')}
            className={`flex items-center gap-2 px-3.5 py-2 transition-all whitespace-nowrap rounded-xl cursor-pointer ${
              activeTab === 'scanner'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <ScanLine className="h-4 w-4" />
            Scan & Assign
            {unassignedCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-amber-500 text-black rounded-md">
                {unassignedCount}
              </span>
            )}
          </button>

          {/* Passes Tab: Visible for Everyone */}
          <button
            id="tab-passes"
            onClick={() => setActiveTab('passes')}
            className={`flex items-center gap-2 px-3.5 py-2 transition-all whitespace-nowrap rounded-xl cursor-pointer ${
              activeTab === 'passes' || activeTab === 'assigned' || activeTab === 'unassigned'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Users className="h-4 w-4" />
            Passes
            {(assignedCount + unassignedCount) > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-md ${
                activeTab === 'passes' ? 'bg-indigo-800 text-white' : 'bg-slate-800 text-slate-300'
              }`}>
                {assignedCount + unassignedCount}
              </span>
            )}
          </button>

          {/* Non-Gate Operator Tabs (Events, Bomber, Print Lab, FLAP Desk, Designer) */}
          {!isGateOperator && (
            <>
              <button
                id="tab-events"
                onClick={() => setActiveTab('events')}
                className={`flex items-center gap-2 px-3.5 py-2 transition-all whitespace-nowrap rounded-xl cursor-pointer ${
                  activeTab === 'events' || activeTab === 'generator'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Calendar className="h-4 w-4" />
                Events &amp; Creation
                <span className={`ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-md ${
                  activeTab === 'events' || activeTab === 'generator' ? 'bg-indigo-800 text-white' : 'bg-slate-800 text-slate-300'
                }`}>
                  {events.length}
                </span>
              </button>

              <button
                id="tab-email-tickets"
                onClick={() => setActiveTab('email_tickets')}
                className={`flex items-center gap-2 px-3.5 py-2 transition-all whitespace-nowrap rounded-xl cursor-pointer ${
                  activeTab === 'email_tickets'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Send className="h-4 w-4" />
                Pass Bomber
              </button>

              <button
                id="tab-rules-bomber"
                onClick={() => setActiveTab('rules_bomber')}
                className={`flex items-center gap-2 px-3.5 py-2 transition-all whitespace-nowrap rounded-xl cursor-pointer ${
                  activeTab === 'rules_bomber'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <ShieldAlert className="h-4 w-4" />
                Recap &amp; Rules
              </button>

              <button
                id="tab-docs"
                onClick={() => setActiveTab('docs')}
                className={`flex items-center gap-2 px-3.5 py-2 transition-all whitespace-nowrap rounded-xl cursor-pointer ${
                  activeTab === 'docs'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Printer className="h-4 w-4" />
                QR Print Lab
              </button>

              {/* FLAP Desk (Financials): Hidden for Gate Operator */}
              <button
                id="tab-financials"
                onClick={() => setActiveTab('financials')}
                className={`flex items-center gap-2 px-3.5 py-2 transition-all whitespace-nowrap rounded-xl cursor-pointer ${
                  activeTab === 'financials'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <DollarSign className="h-4 w-4" />
                FLAP Desk
              </button>

              <button
                id="tab-designer"
                onClick={() => setActiveTab('designer')}
                className={`flex items-center gap-2 px-3.5 py-2 transition-all whitespace-nowrap rounded-xl cursor-pointer ${
                  activeTab === 'designer' || activeTab === 'google_docs' || activeTab === 'google_forms'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Palette className="h-4 w-4" />
                Pass Studio &amp; Export
                <Sparkles className="h-3 w-3 text-amber-300 animate-pulse" />
              </button>
            </>
          )}

        </nav>
      </div>
    </header>
  );
};
