import React, { useState, useMemo, useEffect } from 'react';
import { EventItem, PassItem, FinancialEntry, TicketTierConfig } from '../types';
import { TicketTypesPage } from './TicketTypesPage';
import { BroadcastHistoryPage } from './BroadcastHistoryPage';
import { DemoGuidePage } from './DemoGuidePage';
import { getDispatchHistory, DISPATCH_HISTORY_UPDATED_EVENT } from '../utils/historyStorage';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Building2, 
  PlusCircle, 
  CheckCircle2, 
  Sparkles, 
  Trash2, 
  CalendarOff, 
  RefreshCw, 
  Search, 
  Layers, 
  ArrowRight, 
  Tag, 
  BarChart3, 
  Users, 
  X, 
  AlertTriangle,
  Lock,
  CheckCircle,
  Filter,
  Check,
  Ticket,
  Palette,
  DollarSign,
  Zap,
  History,
  BookOpen
} from 'lucide-react';

interface EventsPageProps {
  events: EventItem[];
  passes?: PassItem[];
  financials?: FinancialEntry[];
  selectedEventId: string;
  onSelectEvent: (eventId: string) => void;
  onAddEvent: (event: EventItem) => void;
  onUpdateEvent?: (event: EventItem) => void;
  onDeleteEvent?: (eventId: string) => void;
  onEndEvent?: (eventId: string) => void;
  onReopenEvent?: (eventId: string) => void;
  onNavigateToPasses: () => void;
  onAddPasses?: (newPasses: PassItem[]) => void;
  onAddFinancials?: (newFinancials: any[]) => void;
  onClearDemoData?: () => void;
  onNavigateToTab?: (tab: string) => void;
}

const COLOR_OPTIONS = [
  { name: 'Emerald', hex: '#059669' },
  { name: 'Teal', hex: '#0d9488' },
  { name: 'Indigo', hex: '#4f46e5' },
  { name: 'Blue', hex: '#2563eb' },
  { name: 'Sky', hex: '#0284c7' },
  { name: 'Purple', hex: '#7c3aed' },
  { name: 'Fuchsia', hex: '#c026d3' },
  { name: 'Rose', hex: '#e11d48' },
  { name: 'Orange', hex: '#ea580c' },
  { name: 'Amber', hex: '#d97706' },
  { name: 'Cyan', hex: '#0891b2' },
  { name: 'Dark Slate', hex: '#0f172a' },
];

export const EventsPage: React.FC<EventsPageProps> = ({
  events,
  passes = [],
  financials = [],
  selectedEventId,
  onSelectEvent,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
  onEndEvent,
  onReopenEvent,
  onNavigateToPasses,
  onAddPasses,
  onAddFinancials,
  onClearDemoData,
  onNavigateToTab
}) => {

  // New Event Form State
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() + 7);
    return today.toISOString().split('T')[0];
  });
  const [commencementTime, setCommencementTime] = useState('10:00 AM');
  const [endTime, setEndTime] = useState('06:00 PM');
  const [location, setLocation] = useState('');
  const [organizer, setOrganizer] = useState('PassCraft Official');
  const [tagline, setTagline] = useState('Official Access & Verification');
  const [themeColor, setThemeColor] = useState('#059669');
  const [category, setCategory] = useState('Conference / Summit');
  const [dressCode, setDressCode] = useState('Smart Casual');

  // Sub-Navigation Tabs: 'creation' = Event Creation & Directory, 'ticket_types' = Ticket Types, Pricing & Colors, 'history' = Broadcast & Email History, 'demo' = Demo Sandbox & Walkthrough Guide
  const [activeSubTab, setActiveSubTab] = useState<'creation' | 'ticket_types' | 'history' | 'demo'>('creation');
  const [historyCount, setHistoryCount] = useState<number>(() => getDispatchHistory().length);

  // Sync history count
  useEffect(() => {
    const handleHistoryUpdate = () => {
      setHistoryCount(getDispatchHistory().length);
    };
    window.addEventListener(DISPATCH_HISTORY_UPDATED_EVENT, handleHistoryUpdate);
    window.addEventListener('storage', handleHistoryUpdate);
    return () => {
      window.removeEventListener(DISPATCH_HISTORY_UPDATED_EVENT, handleHistoryUpdate);
      window.removeEventListener('storage', handleHistoryUpdate);
    };
  }, []);

  // Form Ticket Tiers (for creating an event with initial custom tiers)
  const [formTicketTiers, setFormTicketTiers] = useState<TicketTierConfig[]>([
    { id: 'tier-init-1', categoryName: 'VIP Pass', price: 1500, color: '#eab308', description: 'Front-row access & VIP hospitality', capacity: 50 },
    { id: 'tier-init-2', categoryName: 'General Admission', price: 499, color: '#10b981', description: 'Standard summit hall access', capacity: 200 },
  ]);
  const [inlineTierName, setInlineTierName] = useState('');
  const [inlineTierPrice, setInlineTierPrice] = useState('299');
  const [inlineTierColor, setInlineTierColor] = useState('#06b6d4');

  // Total count of configured tiers across all events
  const totalTiersCount = useMemo(() => {
    return events.reduce((acc, ev) => acc + (ev.ticketTiers?.length || 0), 0);
  }, [events]);

  // AI Assistant State
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Success Notification
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Search and Filter State for Events List
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'ended'>('all');

  // Modals
  const [insightEvent, setInsightEvent] = useState<EventItem | null>(null);
  const [actionConfirmModal, setActionConfirmModal] = useState<{
    type: 'end' | 'delete' | 'reopen' | null;
    event?: EventItem;
  }>({ type: null });

  // Separate Active vs Ended Events
  const activeEvents = useMemo(() => events.filter(e => e.status !== 'ended'), [events]);
  const endedEvents = useMemo(() => events.filter(e => e.status === 'ended'), [events]);

  // Filtered Events
  const displayedEvents = useMemo(() => {
    return events.filter(ev => {
      const matchesSearch = 
        ev.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ev.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ev.organizer.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === 'active') return ev.status !== 'ended';
      if (statusFilter === 'ended') return ev.status === 'ended';
      return true;
    });
  }, [events, searchTerm, statusFilter]);

  // Statistics per event
  const getEventStats = (event: EventItem) => {
    const titleLower = event.title.toLowerCase().trim();
    const eventPasses = passes.filter(p => 
      p.eventId === event.id || (p.eventName && p.eventName.toLowerCase().trim() === titleLower)
    );

    const total = eventPasses.length;
    const assigned = eventPasses.filter(p => p.status === 'assigned' || p.status === 'checked_in').length;
    const unassigned = eventPasses.filter(p => p.status === 'unassigned').length;
    const checkedIn = eventPasses.filter(p => p.status === 'checked_in').length;

    const assignedWithPrice = eventPasses.filter(p => (p.status === 'assigned' || p.status === 'checked_in') && p.ticketPrice);
    const ticketRevenue = assignedWithPrice.reduce((sum, p) => sum + (p.ticketPrice || 0), 0);

    const eventExpenses = financials.filter(f => f.type === 'expense' && (f.eventId === event.id || f.notes?.includes(event.title)));
    const totalExpenses = eventExpenses.reduce((sum, f) => sum + f.amount, 0);

    return { total, assigned, unassigned, checkedIn, ticketRevenue, totalExpenses, netProfit: ticketRevenue - totalExpenses };
  };

  // AI Generation Handler
  const handleAiAutoFill = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiLoading(true);
    setAiError(null);

    try {
      const res = await fetch('/api/gemini/generate-event-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt }),
      });
      const json = await res.json();

      if (json.success && json.data) {
        if (json.data.title) setTitle(json.data.title);
        if (json.data.tagline) setTagline(json.data.tagline);
        if (json.data.themeColor) setThemeColor(json.data.themeColor);
        if (json.data.dressCode) setDressCode(json.data.dressCode);
        if (json.data.suggestedCategories?.[0]) setCategory(json.data.suggestedCategories[0]);
        setFeedbackMessage(`✨ AI Auto-Filled event details for "${json.data.title || 'Event'}"!`);
        setTimeout(() => setFeedbackMessage(null), 4000);
      } else {
        setAiError(json.error || 'Could not generate event details.');
      }
    } catch (err: any) {
      setAiError(err.message || 'AI request failed.');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Create Event Form Submit
  const handleCreateEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('Please enter an event name.');
      return;
    }
    if (!date) {
      alert('Please select an event date.');
      return;
    }
    if (!location.trim()) {
      alert('Please enter a venue location.');
      return;
    }

    const newEvent: EventItem = {
      id: `evt-${Date.now()}`,
      title: title.trim(),
      date,
      time: commencementTime,
      commencementTime: commencementTime.trim() || '10:00 AM',
      endTime: endTime.trim() || '06:00 PM',
      location: location.trim(),
      organizer: organizer.trim() || 'PassCraft Organizer',
      description: tagline.trim(),
      tagline: tagline.trim(),
      category: category.trim() || 'Standard Access',
      createdAt: new Date().toISOString(),
      themeColor: themeColor || '#059669',
      status: 'active',
      dressCode: dressCode.trim() || 'Smart Casual',
      ticketTiers: formTicketTiers.length > 0 ? formTicketTiers : [
        { id: 'tier-1', categoryName: 'VIP Pass', price: 1500, color: '#eab308', description: 'Front-row access & VIP hospitality', capacity: 50 },
        { id: 'tier-2', categoryName: 'General Admission', price: 499, color: '#10b981', description: 'Standard summit hall access', capacity: 200 }
      ]
    };

    onAddEvent(newEvent);
    onSelectEvent(newEvent.id);

    // Reset Form
    setTitle('');
    setLocation('');
    setAiPrompt('');
    setFeedbackMessage(`🎉 Successfully created "${newEvent.title}"! It is now active across all scanner, pass, and email pages.`);
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  // Action Confirmation Handlers
  const executeModalAction = () => {
    const { type, event } = actionConfirmModal;
    if (!event) return;

    if (type === 'end' && onEndEvent) {
      onEndEvent(event.id);
      setFeedbackMessage(`🏁 Marked "${event.title}" as Completed. It will no longer appear as an option in other pages.`);
    } else if (type === 'reopen' && onReopenEvent) {
      onReopenEvent(event.id);
      setFeedbackMessage(`🟢 Reopened "${event.title}". It is now active across all pages.`);
    } else if (type === 'delete' && onDeleteEvent) {
      onDeleteEvent(event.id);
      setFeedbackMessage(`🗑️ Deleted "${event.title}" and its associated passes.`);
    }

    setActionConfirmModal({ type: null });
    setTimeout(() => setFeedbackMessage(null), 4500);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10 py-8 px-4 sm:px-6 lg:px-8 animate-fadeIn">
      
      {/* Top Banner Header */}
      <div className="bg-slate-900 border border-slate-800 p-6 md:p-8 rounded-3xl relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold uppercase tracking-wider rounded-full flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Event Lifecycle Management
              </span>
            </div>
            <h1 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight">
              Create & Manage <span className="text-indigo-400">Events</span>
            </h1>
            <p className="text-xs text-slate-400 max-w-2xl mt-1.5 leading-relaxed">
              Configure event schedules, venue locations, and custom pass tiers. Active events automatically synchronize across all scanning, pass, and email dispatcher pages.
            </p>
          </div>

          {/* Quick Metrics Counter */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className="bg-slate-950/80 border border-slate-800 px-4 py-3 rounded-2xl">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Events</div>
              <div className="text-2xl font-bold text-white font-mono">{events.length}</div>
            </div>
            <div className="bg-indigo-950/40 border border-indigo-500/30 px-4 py-3 rounded-2xl">
              <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span> Active Events
              </div>
              <div className="text-2xl font-bold text-indigo-300 font-mono">{activeEvents.length}</div>
            </div>
            <div className="bg-slate-950/80 border border-slate-800 px-4 py-3 rounded-2xl">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Completed</div>
              <div className="text-2xl font-bold text-slate-400 font-mono">{endedEvents.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Notification / Toast Message */}
      {feedbackMessage && (
        <div className="bg-indigo-950/60 border border-indigo-500/40 px-5 py-3.5 rounded-2xl flex items-center justify-between text-xs text-indigo-200 font-semibold shadow-lg animate-fadeIn">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
          <button onClick={() => setFeedbackMessage(null)} className="text-indigo-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SUB-NAVIGATION TABS */}
      <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3.5 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSubTab('creation')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeSubTab === 'creation'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>1. Event Creation & Directory</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
            activeSubTab === 'creation' ? 'bg-indigo-800 text-white' : 'bg-slate-800 text-slate-300'
          }`}>
            {events.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('ticket_types')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeSubTab === 'ticket_types'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Ticket className="w-4 h-4" />
          <span>2. Ticket Types, Pricing & Colors</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
            activeSubTab === 'ticket_types' ? 'bg-indigo-800 text-white' : 'bg-slate-800 text-slate-300'
          }`}>
            {totalTiersCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('history')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeSubTab === 'history'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          <span>3. Broadcast & Email History</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
            activeSubTab === 'history' ? 'bg-indigo-800 text-white' : 'bg-slate-800 text-slate-300'
          }`}>
            {historyCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('demo')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeSubTab === 'demo'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4 text-indigo-400" />
          <span>4. App Demo & Walkthrough</span>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            200 Students Demo
          </span>
        </button>
      </div>

      {activeSubTab === 'demo' ? (
        <DemoGuidePage
          events={events}
          onAddEvent={onAddEvent}
          onAddPasses={onAddPasses}
          onAddFinancials={onAddFinancials}
          onClearDemoData={onClearDemoData}
          onSelectEvent={onSelectEvent}
          onNavigateToTab={onNavigateToTab}
        />
      ) : activeSubTab === 'history' ? (
        <BroadcastHistoryPage
          events={events}
          selectedEventId={selectedEventId}
          onNavigateToTab={onNavigateToTab}
        />
      ) : activeSubTab === 'ticket_types' ? (
        <TicketTypesPage
          events={events}
          passes={passes}
          selectedEventId={selectedEventId}
          onSelectEvent={onSelectEvent}
          onUpdateEvent={onUpdateEvent || (() => {})}
          onAddPasses={onAddPasses}
          onNavigateToPasses={onNavigateToPasses}
        />
      ) : (
        <>
      {/* SECTION 1: CREATE NEW EVENT FORM */}
      <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-indigo-400" />
              <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                1. Create New Event
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Fill in the event name, date, start time, end time, and venue location.
            </p>
          </div>

          {/* AI Auto Fill Quick Input */}
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 p-1.5 rounded-2xl max-w-md w-full">
            <Sparkles className="w-4 h-4 text-indigo-400 ml-2 shrink-0 animate-pulse" />
            <input
              type="text"
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              placeholder="e.g. AI Leadership Summit 2026 at Grand Hall..."
              className="bg-transparent text-white text-xs px-2 py-1 outline-none w-full placeholder:text-slate-500"
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAiAutoFill())}
            />
            <button
              type="button"
              onClick={handleAiAutoFill}
              disabled={isAiLoading || !aiPrompt.trim()}
              className="px-3 py-1.5 bg-indigo-600 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl hover:bg-indigo-500 disabled:opacity-40 transition-colors shrink-0 flex items-center gap-1 cursor-pointer shadow-sm shadow-indigo-600/30"
            >
              {isAiLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'AI Auto-Fill'}
            </button>
          </div>
        </div>

        {aiError && (
          <div className="mb-6 p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{aiError}</span>
          </div>
        )}

        <form onSubmit={handleCreateEventSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Field 1: Event Name */}
            <div className="lg:col-span-2">
              <label className="block text-[11px] font-bold uppercase text-slate-300 tracking-wider mb-2 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-400" /> Event Name <span className="text-indigo-400">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Global Tech Leaders Summit 2026"
                className="w-full bg-slate-950 border border-slate-700/80 focus:border-indigo-500 rounded-xl px-4 py-3 text-white text-sm font-semibold outline-none transition-colors shadow-inner"
              />
            </div>

            {/* Field 2: Event Date */}
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-300 tracking-wider mb-2 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" /> Event Date <span className="text-indigo-400">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 focus:border-indigo-500 rounded-xl px-4 py-3 text-white text-sm font-semibold outline-none transition-colors"
              />
            </div>

            {/* Field 3: Start Time / Commencement Time */}
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-300 tracking-wider mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400" /> Start Time / Entry Time <span className="text-indigo-400">*</span>
              </label>
              <input
                type="text"
                required
                value={commencementTime}
                onChange={e => setCommencementTime(e.target.value)}
                placeholder="e.g. 10:00 AM (Doors Open)"
                className="w-full bg-slate-950 border border-slate-700/80 focus:border-indigo-500 rounded-xl px-4 py-3 text-white text-sm font-semibold outline-none transition-colors"
              />
            </div>

            {/* Field 4: End Time */}
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-300 tracking-wider mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" /> End Time <span className="text-indigo-400">*</span>
              </label>
              <input
                type="text"
                required
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                placeholder="e.g. 06:00 PM"
                className="w-full bg-slate-950 border border-slate-700/80 focus:border-indigo-500 rounded-xl px-4 py-3 text-white text-sm font-semibold outline-none transition-colors"
              />
            </div>

            {/* Field 5: Venue Location */}
            <div className="lg:col-span-3">
              <label className="block text-[11px] font-bold uppercase text-slate-300 tracking-wider mb-2 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-indigo-400" /> Venue Location & Address <span className="text-indigo-400">*</span>
              </label>
              <input
                type="text"
                required
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="e.g. Main Auditorium, Grand Convention Center"
                className="w-full bg-slate-950 border border-slate-700/80 focus:border-indigo-500 rounded-xl px-4 py-3 text-white text-sm font-semibold outline-none transition-colors"
              />
            </div>

            {/* Field 6: Organizer / Organization */}
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-400 tracking-wider mb-2 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" /> Organizer
              </label>
              <input
                type="text"
                value={organizer}
                onChange={e => setOrganizer(e.target.value)}
                placeholder="e.g. PassCraft Events"
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white text-xs font-semibold outline-none"
              />
            </div>

            {/* Field 7: Tagline / Pass Subtitle */}
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-400 tracking-wider mb-2">
                Tagline / Subtitle
              </label>
              <input
                type="text"
                value={tagline}
                onChange={e => setTagline(e.target.value)}
                placeholder="e.g. Official Delegate Access Pass"
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white text-xs font-semibold outline-none"
              />
            </div>

            {/* Field 8: Theme Color */}
            <div className="lg:col-span-3">
              <label className="block text-[11px] font-bold uppercase text-slate-400 tracking-wider mb-2">
                Event Accent Color (Choose Preset or Pick Custom)
              </label>
              <div className="flex items-center gap-3 bg-slate-950 p-2.5 rounded-2xl border border-slate-800 flex-wrap">
                <div className="flex items-center gap-2 pr-3 border-r border-slate-800">
                  <input
                    type="color"
                    value={themeColor}
                    onChange={e => setThemeColor(e.target.value)}
                    className="w-9 h-9 rounded-xl bg-transparent border border-slate-700 cursor-pointer p-0.5"
                    title="Custom color picker"
                  />
                  <span className="text-xs font-mono font-bold text-slate-300 uppercase">{themeColor}</span>
                </div>
                <div className="flex gap-2 flex-wrap items-center">
                  {COLOR_OPTIONS.map(c => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setThemeColor(c.hex)}
                      style={{ backgroundColor: c.hex }}
                      className={`w-7 h-7 rounded-xl transition-all ${themeColor.toLowerCase() === c.hex.toLowerCase() ? 'scale-125 ring-2 ring-white shadow-lg' : 'opacity-75 hover:opacity-100 hover:scale-110'}`}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Form Submit & Direct Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
            <div className="text-xs text-slate-400 font-medium">
              ⚡ Default pass tiers can be further customized anytime in the <span className="text-indigo-400 font-bold">Ticket Types</span> tab.
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="submit"
                className="w-full sm:w-auto px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" /> Create & Activate Event
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* SECTION 2: ALL EVENTS SHOWCASE */}
      <section className="space-y-6">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                2. Events Directory ({events.length})
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Active events synchronize across all application modules. Completed events are archived.
            </p>
          </div>

          {/* Search & Status Filter Tabs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search events, venues..."
                className="bg-slate-900 border border-slate-800 text-white text-xs pl-9 pr-3 py-2 rounded-xl outline-none focus:border-indigo-500 w-full sm:w-56"
              />
            </div>

            {/* Filter Toggle */}
            <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs font-bold uppercase tracking-wider">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${statusFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                All ({events.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${statusFilter === 'active' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span> Active ({activeEvents.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('ended')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${statusFilter === 'ended' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Completed ({endedEvents.length})
              </button>
            </div>
          </div>
        </div>

        {/* Events Cards Grid */}
        {displayedEvents.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-12 text-center">
            <CalendarOff className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white">
              {events.length === 0 ? 'No Events Yet — Clean Workspace' : 'No Events Found'}
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              {events.length === 0
                ? 'Get started by creating your first event above, or open the App Demo & Walkthrough tab to test features with sample data.'
                : searchTerm
                ? 'No events matching your search criteria.'
                : 'Create your first event using the form above to start generating passes!'}
            </p>
            {events.length === 0 && (
              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('demo')}
                  className="px-4 py-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <BookOpen className="w-4 h-4 text-indigo-400" /> Open Demo &amp; Walkthrough Tab
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {displayedEvents.map(event => {
              const stats = getEventStats(event);
              const isEnded = event.status === 'ended';
              const isCurrentlySelected = selectedEventId === event.id;

              return (
                <div
                  key={event.id}
                  className={`bg-slate-900 border rounded-3xl p-6 relative overflow-hidden transition-all shadow-xl flex flex-col justify-between ${
                    isEnded 
                      ? 'border-slate-800 opacity-75 bg-slate-900/60' 
                      : isCurrentlySelected
                        ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-slate-900'
                        : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Top Status & Event Header */}
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isEnded ? (
                          <span className="px-3 py-1 bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold uppercase tracking-wider rounded-full flex items-center gap-1.5">
                            <Lock className="w-3 h-3" /> Archived
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold uppercase tracking-wider rounded-full flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span> Active Event
                          </span>
                        )}

                        <span className="px-2.5 py-0.5 bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-mono font-bold rounded-full">
                          📅 Single Entry Pass
                        </span>

                        {isCurrentlySelected && (
                          <span className="px-2.5 py-0.5 bg-indigo-600 text-white text-[9px] font-bold uppercase tracking-widest rounded-full">
                            Current Filter
                          </span>
                        )}
                      </div>

                      {/* Event Accent Dot */}
                      <div 
                        className="w-4 h-4 rounded-full border border-white/20 shrink-0 shadow-sm" 
                        style={{ backgroundColor: event.themeColor || '#6366f1' }} 
                        title={`Theme: ${event.themeColor}`}
                      />
                    </div>

                    <h3 className="text-xl font-bold text-white tracking-tight mb-2">
                      {event.title}
                    </h3>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300 font-mono mb-4 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span>{event.date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>{event.commencementTime || event.time || '10:00 AM'} — {event.endTime || '06:00 PM'}</span>
                      </div>
                      <div className="flex items-center gap-2 sm:col-span-2">
                        <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </div>
                    </div>

                    {/* Stats Metrics Bar */}
                    <div className="grid grid-cols-4 gap-2 mb-6 text-center">
                      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Total Passes</div>
                        <div className="text-base font-bold text-white font-mono">{stats.total}</div>
                      </div>
                      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-indigo-400">Assigned</div>
                        <div className="text-base font-bold text-indigo-400 font-mono">{stats.assigned}</div>
                      </div>
                      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-amber-400">Checked In</div>
                        <div className="text-base font-bold text-amber-400 font-mono">{stats.checkedIn}</div>
                      </div>
                      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-sky-400">Revenue</div>
                        <div className="text-base font-bold text-sky-400 font-mono">₹{stats.ticketRevenue}</div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {/* Select / Filter Button */}
                      {!isEnded && (
                        <button
                          type="button"
                          onClick={() => onSelectEvent(event.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer ${
                            isCurrentlySelected
                              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                              : 'bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-200'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          {isCurrentlySelected ? 'Selected' : 'Select Event'}
                        </button>
                      )}

                      {/* View Event Passes Button */}
                      <button
                        type="button"
                        onClick={() => {
                          onSelectEvent(event.id);
                          onNavigateToPasses();
                        }}
                        className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-indigo-400 hover:text-indigo-300 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1 cursor-pointer"
                        title="View Passes for this Event"
                      >
                        <Users className="w-3.5 h-3.5" /> Passes
                      </button>

                      {/* Manage Ticket Types & Prices Button */}
                      <button
                        type="button"
                        onClick={() => {
                          onSelectEvent(event.id);
                          setActiveSubTab('ticket_types');
                        }}
                        className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/40 text-slate-200 hover:text-indigo-300 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer"
                        title="Manage Ticket Types, Prices & Colors"
                      >
                        <Tag className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Ticket Types ({event.ticketTiers?.length || 0})</span>
                      </button>

                      {/* Event Insights Modal Button */}
                      <button
                        type="button"
                        onClick={() => setInsightEvent(event)}
                        className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl transition-colors cursor-pointer"
                        title="View Financial & Attendance Insights"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Completion / Reopen & Delete Controls */}
                    <div className="flex items-center gap-1.5">
                      {isEnded ? (
                        <button
                          type="button"
                          onClick={() => setActionConfirmModal({ type: 'reopen', event })}
                          className="px-2.5 py-1.5 bg-indigo-950/60 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-600 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Reopen
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActionConfirmModal({ type: 'end', event })}
                          className="px-2.5 py-1.5 bg-slate-950 hover:bg-amber-950/50 border border-slate-800 hover:border-amber-400/40 text-amber-400 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1 cursor-pointer"
                          title="Mark Event as Completed & Archive"
                        >
                          <Lock className="w-3.5 h-3.5" /> End Event
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setActionConfirmModal({ type: 'delete', event })}
                        className="p-2 bg-slate-950 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-500/40 text-rose-400 rounded-xl transition-colors cursor-pointer"
                        title="Delete Event Permanently"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      </>
      )}

      {/* MODAL: EVENT INSIGHTS AUDIT MODAL */}
      {insightEvent && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 md:p-8 shadow-2xl space-y-6">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                  Event Insights & Financial Summary
                </span>
                <h3 className="text-2xl font-bold text-white mt-1">{insightEvent.title}</h3>
                <p className="text-xs text-slate-400 mt-1">
                  📅 {insightEvent.date} • 📍 {insightEvent.location}
                </p>
              </div>
              <button 
                onClick={() => setInsightEvent(null)}
                className="p-2 bg-slate-950 border border-slate-800 text-slate-400 hover:text-white rounded-xl cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(() => {
              const stats = getEventStats(insightEvent);
              const attendanceRate = stats.assigned > 0 ? ((stats.checkedIn / stats.assigned) * 100).toFixed(1) : '0';

              return (
                <div className="space-y-6">
                  {/* Financials Summary */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                      <div className="text-[10px] font-bold uppercase text-indigo-400">Gross Ticket Sales</div>
                      <div className="text-xl font-bold text-indigo-400 font-mono mt-1">₹{stats.ticketRevenue}</div>
                    </div>
                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                      <div className="text-[10px] font-bold uppercase text-rose-400">Itemized Expenses</div>
                      <div className="text-xl font-bold text-rose-400 font-mono mt-1">₹{stats.totalExpenses}</div>
                    </div>
                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                      <div className="text-[10px] font-bold uppercase text-amber-400">Net Profit / P&L</div>
                      <div className={`text-xl font-bold font-mono mt-1 ${stats.netProfit >= 0 ? 'text-sky-400' : 'text-rose-400'}`}>
                        ₹{stats.netProfit}
                      </div>
                    </div>
                  </div>

                  {/* Attendance Breakdown */}
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                    <div className="flex justify-between items-center text-xs font-semibold">
                      <span className="text-slate-400 uppercase">Check-In Attendance Rate</span>
                      <span className="text-indigo-400 font-mono">{attendanceRate}%</span>
                    </div>
                    <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-indigo-600 h-full transition-all duration-500 rounded-full" 
                        style={{ width: `${Math.min(100, parseFloat(attendanceRate))}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] font-mono text-slate-400">
                      <span>Assigned: {stats.assigned}</span>
                      <span>Checked-In at Gate: {stats.checkedIn}</span>
                      <span>Unassigned Remaining: {stats.unassigned}</span>
                    </div>
                  </div>

                  {/* Tiers in Catalog */}
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                    <div className="text-[10px] font-bold uppercase text-slate-400 mb-2">Configured Pass Tiers</div>
                    <div className="flex flex-wrap gap-2">
                      {insightEvent.ticketTiers?.map(tier => (
                        <span 
                          key={tier.categoryName}
                          className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold flex items-center gap-2"
                        >
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tier.color || '#6366f1' }} />
                          {tier.categoryName}: <span className="text-indigo-400 font-mono">₹{tier.price}</span>
                        </span>
                      )) || <span className="text-xs text-slate-500">No custom tiers configured.</span>}
                    </div>
                  </div>

                  {/* Completed Event Attendees Roster & Export */}
                  {(() => {
                    const eventPasses = passes.filter(
                      p => (p.eventId && p.eventId === insightEvent.id) ||
                           (p.eventName && p.eventName.toLowerCase().trim() === insightEvent.title.toLowerCase().trim())
                    );
                    const assignedList = eventPasses.filter(p => p.status === 'assigned' || p.status === 'checked_in');

                    const handleExportCSV = () => {
                      if (assignedList.length === 0) {
                        alert('No assigned attendees found for this event.');
                        return;
                      }
                      const headers = ['Attendee Name', 'Email', 'Phone', 'Pass Category', '16-Digit Code', 'Check-In Status', 'Check-In Timestamp'];
                      const rows = assignedList.map(p => [
                        `"${p.assignedTo?.name || ''}"`,
                        `"${p.assignedTo?.email || ''}"`,
                        `"${p.assignedTo?.phone || ''}"`,
                        `"${p.category || ''}"`,
                        `"${p.formattedCode || p.code16 || ''}"`,
                        `"${p.status === 'checked_in' ? 'Checked In' : 'Assigned'}"`,
                        `"${p.checkedInAt || ''}"`,
                      ]);
                      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                      const encodedUri = encodeURI(csvContent);
                      const link = document.createElement('a');
                      link.setAttribute('href', encodedUri);
                      link.setAttribute('download', `${insightEvent.title.replace(/\s+/g, '_')}_Attendees_Report.csv`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    };

                    return (
                      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-[10px] font-bold uppercase text-slate-400">
                            Archived Attendees Roster ({assignedList.length} Attendees)
                          </div>
                          {assignedList.length > 0 && (
                            <button
                              type="button"
                              onClick={handleExportCSV}
                              className="px-3 py-1 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 text-[10px] font-mono font-bold rounded-lg transition-colors cursor-pointer"
                            >
                              📥 Export CSV Report
                            </button>
                          )}
                        </div>

                        {assignedList.length === 0 ? (
                          <div className="text-xs text-slate-500 italic py-2">
                            No attendees registered or assigned for this event.
                          </div>
                        ) : (
                          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 font-mono text-xs">
                            {assignedList.map(p => (
                              <div
                                key={p.id}
                                className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                              >
                                <div>
                                  <div className="font-bold text-white">{p.assignedTo?.name}</div>
                                  <div className="text-[10px] text-slate-400">{p.assignedTo?.email || 'No email'} • {p.category}</div>
                                </div>
                                <div className="text-right">
                                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                    p.status === 'checked_in'
                                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                      : 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                                  }`}>
                                    {p.status === 'checked_in' ? 'Checked In' : 'Assigned'}
                                  </span>
                                  <div className="text-[9px] text-slate-500 mt-0.5">{p.formattedCode}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div className="flex justify-between items-center pt-2">
                    <div className="text-[10px] text-slate-500">
                      {insightEvent.status === 'ended' 
                        ? '🔒 Event Completed: Data preserved in this archive only.'
                        : '⚡ Event Active: Available across all app views.'}
                    </div>

                    <div className="flex gap-2">
                      {insightEvent.status !== 'ended' && (
                        <button
                          type="button"
                          onClick={() => {
                            setInsightEvent(null);
                            onSelectEvent(insightEvent.id);
                            onNavigateToPasses();
                          }}
                          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm shadow-indigo-600/30"
                        >
                          <Users className="w-4 h-4" /> View Event Passes
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* MODAL: CONFIRM END / REOPEN / DELETE EVENT */}
      {actionConfirmModal.type && actionConfirmModal.event && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h4 className="text-lg font-bold text-white">
                {actionConfirmModal.type === 'end' && 'End / Complete Event?'}
                {actionConfirmModal.type === 'reopen' && 'Reopen Event?'}
                {actionConfirmModal.type === 'delete' && 'Delete Event Permanently?'}
              </h4>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {actionConfirmModal.type === 'end' && (
                <>
                  Are you sure you want to mark <strong className="text-white">"{actionConfirmModal.event.title}"</strong> as Completed?
                  <br /><br />
                  <span className="text-indigo-400 font-semibold">Note:</span> Once completed, this event will no longer appear as an active option in other pages (Scan & Assign, Email Tickets, Passes, etc.). It will be preserved in the Completed archive.
                </>
              )}
              {actionConfirmModal.type === 'reopen' && (
                <>
                  Are you sure you want to reopen <strong className="text-white">"{actionConfirmModal.event.title}"</strong>?
                  <br /><br />
                  It will immediately become active again and available in dropdown options across all pages.
                </>
              )}
              {actionConfirmModal.type === 'delete' && (
                <>
                  Are you sure you want to permanently delete <strong className="text-white">"{actionConfirmModal.event.title}"</strong>?
                  <br /><br />
                  <span className="text-rose-400 font-semibold">Warning:</span> All associated passes ({getEventStats(actionConfirmModal.event).total} passes) will also be deleted. This cannot be undone.
                </>
              )}
            </p>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setActionConfirmModal({ type: null })}
                className="px-4 py-2 bg-slate-950 border border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeModalAction}
                className={`px-4 py-2 font-bold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer ${
                  actionConfirmModal.type === 'delete'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-600/30'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/30'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
