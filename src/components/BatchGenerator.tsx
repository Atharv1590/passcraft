import React, { useState, useMemo, useEffect } from 'react';
import { EventItem, PassItem, FinancialEntry } from '../types';
import { generate16DigitCode, format16DigitCode } from '../lib/passUtils';
import { 
  Sparkles, 
  PlusCircle, 
  Calendar, 
  Clock, 
  MapPin, 
  Building2, 
  Layers, 
  Palette, 
  CheckCircle2, 
  CheckCircle,
  QrCode,
  Loader2,
  ListPlus,
  Trash2,
  CalendarOff,
  ShieldAlert,
  Search,
  ListFilter,
  FolderX,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  X,
  Users,
  RefreshCw
} from 'lucide-react';

interface BatchGeneratorProps {
  events: EventItem[];
  passes?: PassItem[];
  financials?: FinancialEntry[];
  onAddEvent: (event: EventItem) => void;
  onDeleteEvent?: (eventId: string) => void;
  onEndEvent?: (eventId: string) => void;
  onReopenEvent?: (eventId: string) => void;
  onAddPasses: (passes: PassItem[]) => void;
  onNavigateToScanner: () => void;
  onNavigateToUnassigned: () => void;
}

interface CustomTierConfig {
  id: string;
  categoryName: string;
  price: number;
  count: number;
}

const PRESET_TIERS_WITH_PRICES = [
  { name: 'VIP Pass', defaultPrice: 1500 },
  { name: 'Platinum Pass', defaultPrice: 2500 },
  { name: 'Gold Access', defaultPrice: 1000 },
  { name: 'Silver Access', defaultPrice: 650 },
  { name: 'General Delegate', defaultPrice: 450 },
  { name: 'VVIP Guest', defaultPrice: 3500 },
  { name: 'Keynote Speaker', defaultPrice: 0 },
  { name: 'Staff & Crew', defaultPrice: 0 },
  { name: 'Press & Media', defaultPrice: 0 },
  { name: 'Exhibitor', defaultPrice: 1200 },
];

const COLOR_OPTIONS = [
  { name: 'Indigo', hex: '#4f46e5' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Amber', hex: '#d97706' },
  { name: 'Pink Rose', hex: '#e11d48' },
  { name: 'Cyan', hex: '#0891b2' },
  { name: 'Slate Dark', hex: '#0f172a' },
  { name: 'Purple', hex: '#7c3aed' },
];

const STORAGE_BATCH_DRAFT_KEY = 'passcraft_batch_generator_draft_v1';

interface BatchDraftSavedState {
  activeSection?: 'both' | 'generator' | 'events';
  selectedEventId?: string;
  title?: string;
  date?: string;
  commencementTime?: string;
  endTime?: string;
  location?: string;
  organizer?: string;
  customCategoryName?: string;
  ticketPrice?: number;
  tagline?: string;
  themeColor?: string;
  quantity?: number;
  tierList?: CustomTierConfig[];
}

const loadSavedBatchDraft = (): BatchDraftSavedState | null => {
  try {
    const saved = localStorage.getItem(STORAGE_BATCH_DRAFT_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return null;
};

export const BatchGenerator: React.FC<BatchGeneratorProps> = ({
  events,
  passes = [],
  financials = [],
  onAddEvent,
  onDeleteEvent,
  onEndEvent,
  onReopenEvent,
  onAddPasses,
  onNavigateToScanner,
  onNavigateToUnassigned,
}) => {
  const savedDraft = useMemo(() => loadSavedBatchDraft(), []);

  // Single-page Section toggle: 'both' (default stacked), 'generator', 'events'
  const [activeSection, setActiveSection] = useState<'both' | 'generator' | 'events'>(() => savedDraft?.activeSection ?? 'both');

  // Mode: Select existing event OR Create new
  const [selectedEventId, setSelectedEventId] = useState<string>(() => savedDraft?.selectedEventId ?? (events[0]?.id || 'new'));
  
  // New Event Form State
  const [title, setTitle] = useState(() => savedDraft?.title ?? '');
  const [date, setDate] = useState(() => savedDraft?.date ?? '2026-08-20');
  const [commencementTime, setCommencementTime] = useState(() => savedDraft?.commencementTime ?? '10:00 AM');
  const [endTime, setEndTime] = useState(() => savedDraft?.endTime ?? '06:00 PM');
  const [location, setLocation] = useState(() => savedDraft?.location ?? 'Global Convention Center, Main Hall');
  const [organizer, setOrganizer] = useState(() => savedDraft?.organizer ?? 'Event Master Corp');
  const [customCategoryName, setCustomCategoryName] = useState(() => savedDraft?.customCategoryName ?? 'VIP Pass');
  const [ticketPrice, setTicketPrice] = useState<number>(() => savedDraft?.ticketPrice ?? 750);
  const [tagline, setTagline] = useState(() => savedDraft?.tagline ?? 'Exclusive Access & Networking');
  const [themeColor, setThemeColor] = useState(() => savedDraft?.themeColor ?? '#4f46e5');
  const [quantity, setQuantity] = useState<number>(() => savedDraft?.quantity ?? 10);

  // Multi-tier Batch Queue
  const [tierList, setTierList] = useState<CustomTierConfig[]>(() => savedDraft?.tierList ?? []);

  // Auto-persist draft
  useEffect(() => {
    const draftToSave: BatchDraftSavedState = {
      activeSection,
      selectedEventId,
      title,
      date,
      commencementTime,
      endTime,
      location,
      organizer,
      customCategoryName,
      ticketPrice,
      tagline,
      themeColor,
      quantity,
      tierList,
    };
    try {
      localStorage.setItem(STORAGE_BATCH_DRAFT_KEY, JSON.stringify(draftToSave));
    } catch (e) {}
  }, [
    activeSection,
    selectedEventId,
    title,
    date,
    commencementTime,
    endTime,
    location,
    organizer,
    customCategoryName,
    ticketPrice,
    tagline,
    themeColor,
    quantity,
    tierList,
  ]);

  // AI Prompt State
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Success Feedback
  const [lastGeneratedCount, setLastGeneratedCount] = useState<number | null>(null);

  // Event Manager Search & Filter State
  const [eventSearchTerm, setEventSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [insightEvent, setInsightEvent] = useState<EventItem | null>(null);
  const [modalAction, setModalAction] = useState<{
    type: 'end' | 'delete' | 'purge_all' | null;
    event?: EventItem;
  }>({ type: null });

  // Get unique categories for active events
  const categories = useMemo(() => {
    const cats = new Set<string>();
    events.forEach(e => {
      if (e.category) cats.add(e.category);
    });
    return Array.from(cats);
  }, [events]);

  // Filtered events list
  const filteredEvents = useMemo(() => {
    return events.filter(ev => {
      const matchesSearch = 
        ev.title.toLowerCase().includes(eventSearchTerm.toLowerCase()) ||
        ev.location.toLowerCase().includes(eventSearchTerm.toLowerCase()) ||
        ev.organizer.toLowerCase().includes(eventSearchTerm.toLowerCase());
      
      const matchesCat = selectedCategory === 'all' || ev.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [events, eventSearchTerm, selectedCategory]);

  const activeEvents = useMemo(() => filteredEvents.filter(ev => ev.status !== 'ended'), [filteredEvents]);
  const endedEvents = useMemo(() => filteredEvents.filter(ev => ev.status === 'ended'), [filteredEvents]);

  // Pass statistics per event
  const getEventPassStats = (event: EventItem) => {
    const titleLower = event.title.toLowerCase().trim();
    const eventPasses = passes.filter(p => 
      p.eventId === event.id || (p.eventName && p.eventName.toLowerCase().trim() === titleLower)
    );

    const total = eventPasses.length;
    const assigned = eventPasses.filter(p => p.status === 'assigned' || p.status === 'checked_in').length;
    const unassigned = eventPasses.filter(p => p.status === 'unassigned').length;
    const checkedIn = eventPasses.filter(p => p.status === 'checked_in').length;

    // Revenue calculation
    const assignedWithPrice = eventPasses.filter(p => (p.status === 'assigned' || p.status === 'checked_in') && p.ticketPrice);
    const totalRevenue = assignedWithPrice.reduce((sum, p) => sum + (p.ticketPrice || 0), 0);

    return { total, assigned, unassigned, checkedIn, totalRevenue, passesList: eventPasses };
  };

  const handleConfirmAction = () => {
    if (modalAction.type === 'end' && modalAction.event && onEndEvent) {
      onEndEvent(modalAction.event.id);
    } else if (modalAction.type === 'delete' && modalAction.event && onDeleteEvent) {
      onDeleteEvent(modalAction.event.id);
    } else if (modalAction.type === 'purge_all' && onDeleteEvent) {
      events.forEach(ev => onDeleteEvent(ev.id));
    }
    setModalAction({ type: null });
  };

  // Add a Tier to the multi-tier list
  const handleAddTierToList = () => {
    const name = customCategoryName.trim() || 'Custom Pass';
    const count = Math.max(1, quantity);
    const price = Math.max(0, ticketPrice || 0);

    setTierList(prev => {
      const existingIdx = prev.findIndex(t => t.categoryName.toLowerCase() === name.toLowerCase());
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx].count += count;
        updated[existingIdx].price = price;
        return updated;
      } else {
        return [...prev, { id: `tier-${Date.now()}-${Math.random()}`, categoryName: name, price, count }];
      }
    });
  };

  const handleUpdateTierCount = (id: string, delta: number) => {
    setTierList(prev => 
      prev
        .map(t => t.id === id ? { ...t, count: Math.max(1, t.count + delta) } : t)
        .filter(t => t.count > 0)
    );
  };

  const handleRemoveTier = (id: string) => {
    setTierList(prev => prev.filter(t => t.id !== id));
  };

  // Handle AI Event Generation using Gemini
  const handleAiGenerate = async () => {
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
        if (json.data.suggestedCategories?.[0]) setCustomCategoryName(json.data.suggestedCategories[0]);
        setSelectedEventId('new');
      } else {
        setAiError(json.error || 'Could not generate event details.');
      }
    } catch (err: any) {
      setAiError(err.message || 'AI request failed.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let targetEvent: EventItem;

    if (selectedEventId === 'new') {
      if (!title.trim()) return;
      targetEvent = {
        id: `evt-${Date.now()}`,
        title,
        date,
        time: commencementTime,
        commencementTime,
        endTime,
        location,
        organizer: organizer || 'Organizer',
        description: tagline,
        tagline,
        category: customCategoryName || 'VIP Pass',
        themeColor,
        createdAt: new Date().toISOString(),
      };
      onAddEvent(targetEvent);
    } else {
      const found = events.find(ev => ev.id === selectedEventId);
      if (!found) return;
      targetEvent = found;
    }

    // Determine batch categories to generate
    const batchesToGenerate: { category: string; count: number; price: number }[] = [];

    if (tierList.length > 0) {
      batchesToGenerate.push(...tierList.map(t => ({ category: t.categoryName, count: t.count, price: t.price })));
    } else {
      batchesToGenerate.push({
        category: customCategoryName.trim() || targetEvent.category || 'VIP Pass',
        count: Math.max(1, Math.min(250, quantity)),
        price: Math.max(0, ticketPrice || 0),
      });
    }

    const newPasses: PassItem[] = [];
    let totalGenerated = 0;

    for (const batch of batchesToGenerate) {
      for (let i = 0; i < batch.count; i++) {
        const rawCode = generate16DigitCode();
        const formatted = format16DigitCode(rawCode);
        newPasses.push({
          id: `pass-${rawCode}`,
          code16: rawCode,
          formattedCode: formatted,
          eventId: targetEvent.id,
          eventName: targetEvent.title,
          eventDate: targetEvent.date,
          eventTime: targetEvent.commencementTime || targetEvent.time,
          commencementTime: targetEvent.commencementTime || targetEvent.time,
          endTime: targetEvent.endTime,
          eventLocation: targetEvent.location,
          category: batch.category,
          ticketPrice: batch.price,
          status: 'unassigned',
          themeColor: targetEvent.themeColor,
          createdAt: new Date().toISOString(),
        });
        totalGenerated++;
      }
    }

    onAddPasses(newPasses);
    setLastGeneratedCount(totalGenerated);
    setTierList([]);
  };

  const handleGenerateBatchNow = (evtId: string, category: string, price: number, count: number) => {
    const targetEvent = events.find(ev => ev.id === evtId);
    if (!targetEvent) return;

    const newPasses: PassItem[] = [];
    for (let i = 0; i < count; i++) {
      const rawCode = generate16DigitCode();
      const formatted = format16DigitCode(rawCode);
      newPasses.push({
        id: `pass-${rawCode}`,
        code16: rawCode,
        formattedCode: formatted,
        eventId: targetEvent.id,
        eventName: targetEvent.title,
        eventDate: targetEvent.date,
        eventTime: targetEvent.commencementTime || targetEvent.time,
        commencementTime: targetEvent.commencementTime || targetEvent.time,
        endTime: targetEvent.endTime,
        eventLocation: targetEvent.location,
        category,
        ticketPrice: price,
        status: 'unassigned',
        themeColor: targetEvent.themeColor,
        createdAt: new Date().toISOString(),
      });
    }
    onAddPasses(newPasses);
    setLastGeneratedCount(count);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-8 px-4">
      
      {/* Unified Single-Page Navigation Sub-Header */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSection('both')}
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 ${
              activeSection === 'both'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            Full Single Page View
          </button>
          
          <button
            type="button"
            onClick={() => setActiveSection('generator')}
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 ${
              activeSection === 'generator'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            Create & Generate Passes
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('events')}
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 ${
              activeSection === 'events'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20'
            }`}
          >
            <CalendarOff className="w-4 h-4" />
            Manage & End Events ({events.length})
          </button>
        </div>

        <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest hidden md:block">
          UNIFIED EVENT & PASS MANAGEMENT HUB
        </div>
      </div>

      {/* SECTION 1: PASS GENERATOR */}
      {(activeSection === 'both' || activeSection === 'generator') && (
        <div className="space-y-8 animate-fadeIn">
          {/* Hero Header */}
          <div className="bg-slate-900 border border-slate-800 p-6 sm:p-10 rounded-3xl text-white relative overflow-hidden shadow-xl">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 mb-2 block">
                  Batch Generation Engine
                </span>
                <h2 className="text-3xl sm:text-4xl font-black tracking-tight uppercase leading-none">
                  Create <br className="hidden sm:inline" />
                  New <span className="text-indigo-400">Entry</span>
                </h2>
              </div>
              <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                Generate unassigned 16-digit QR security passes in batch mode. Ready for instant attendee assignment or Canva Bulk Create export.
              </p>
            </div>
          </div>

      {/* AI Assistant Generator Box */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 text-white font-bold rounded-xl flex items-center justify-center shadow-sm shadow-indigo-600/30">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">AI Event Generator</h3>
            <p className="text-xs text-slate-400">Auto-fill event title, venue & tier details</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={aiPrompt}
            onChange={e => setAiPrompt(e.target.value)}
            placeholder="e.g. Neon Midnight Festival, Tokyo Tech Summit..."
            className="flex-1 bg-slate-950 border border-slate-800 p-3 font-medium text-sm text-white focus:border-indigo-500 rounded-xl outline-none"
          />
          <button
            type="button"
            onClick={handleAiGenerate}
            disabled={isAiLoading || !aiPrompt.trim()}
            className="px-6 py-3 bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-indigo-500 transition-colors disabled:opacity-50 shrink-0 shadow-md shadow-indigo-600/30 cursor-pointer"
          >
            {isAiLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Generating...
              </span>
            ) : (
              'Generate Fields'
            )}
          </button>
        </div>
        {aiError && <p className="text-xs font-mono text-rose-400">{aiError}</p>}
      </div>

      {/* Success Notification Banner */}
      {lastGeneratedCount !== null && (
        <div className="bg-slate-900 border border-emerald-500/40 p-6 rounded-3xl text-white flex flex-col sm:flex-row items-center justify-between gap-4 animate-fadeIn shadow-xl">
          <div className="flex items-center gap-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
            <div>
              <h4 className="font-bold text-base text-emerald-400">
                Batch Generated: {lastGeneratedCount} Passes Ready
              </h4>
              <p className="text-xs text-slate-400">
                Each pass carries a 16-digit security key and QR payload.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <button
              onClick={onNavigateToScanner}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-600/30"
            >
              Scan to Assign
            </button>
            <button
              onClick={onNavigateToUnassigned}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-slate-800 text-slate-200 border border-slate-700 font-semibold text-xs uppercase tracking-wider rounded-xl hover:bg-slate-700 transition-colors"
            >
              View Queue
            </button>
          </div>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 p-6 sm:p-10 rounded-3xl space-y-8 shadow-xl">
        
        {/* Step 1: Event Selection */}
        <div className="space-y-4">
          <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400">
            01 // Select or Designate Event
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setSelectedEventId('new')}
              className={`p-5 text-left border rounded-2xl transition-all ${
                selectedEventId === 'new'
                  ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300 shadow-sm'
                  : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-white'
              }`}
            >
              <span className="font-bold text-base text-white block">+ Create New Event</span>
              <span className="text-xs text-slate-400 block mt-0.5">Custom date, venue & quota</span>
            </button>

            {events.map(ev => (
              <div
                key={ev.id}
                onClick={() => setSelectedEventId(ev.id)}
                className={`p-5 text-left border rounded-2xl transition-all cursor-pointer flex justify-between items-start gap-3 ${
                  selectedEventId === ev.id
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300 shadow-sm'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-white'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-base text-white block truncate">{ev.title}</span>
                  <span className="text-xs text-slate-400 block mt-1">
                    📅 {ev.date} • ⏰ Start: {ev.commencementTime || ev.time} {ev.endTime ? `| End: ${ev.endTime}` : ''}
                  </span>
                  <span className="text-xs text-slate-500 block truncate mt-0.5">
                    📍 {ev.location}
                  </span>
                </div>

                {onDeleteEvent && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Are you sure you want to delete event "${ev.title}"? All passes associated with this event will also be deleted.`)) {
                        onDeleteEvent(ev.id);
                        if (selectedEventId === ev.id) {
                          setSelectedEventId('new');
                        }
                      }
                    }}
                    title="Delete Event"
                    className="p-2 text-rose-400 hover:text-white hover:bg-rose-600 border border-rose-500/30 rounded-xl transition-all shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form Details */}
        {selectedEventId === 'new' && (
          <div className="space-y-6 pt-6 border-t border-slate-800">
            <div>
              <label className="block text-[10px] uppercase tracking-wider mb-2 font-bold text-slate-400">
                Event Designation Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Neon Midnight Festival"
                className="w-full bg-slate-950 border border-slate-800 p-3.5 font-bold text-lg text-white focus:border-indigo-500 rounded-xl outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <label className="block text-[10px] uppercase tracking-wider mb-2 font-bold text-slate-400">
                  Event Date *
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 p-3 font-medium text-sm text-white focus:border-indigo-500 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider mb-2 font-bold text-slate-400">
                  Commencement Time (Entry Start) *
                </label>
                <input
                  type="text"
                  required
                  value={commencementTime}
                  onChange={e => setCommencementTime(e.target.value)}
                  placeholder="10:00 AM"
                  className="w-full bg-slate-950 border border-slate-800 p-3 font-medium text-sm text-white focus:border-indigo-500 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider mb-2 font-bold text-slate-400">
                  End Time *
                </label>
                <input
                  type="text"
                  required
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  placeholder="06:00 PM"
                  className="w-full bg-slate-950 border border-slate-800 p-3 font-medium text-sm text-white focus:border-indigo-500 rounded-xl outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider mb-2 font-bold text-slate-400">
                Venue Location *
              </label>
              <input
                type="text"
                required
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="Convention Center, Hall A"
                className="w-full bg-slate-950 border border-slate-800 p-3 font-medium text-sm text-white focus:border-indigo-500 rounded-xl outline-none"
              />
            </div>
          </div>
        )}

        {/* Step 2: Custom Pass Tier & Quantity Controls */}
        <div className="space-y-6 pt-6 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400">
              02 // Pass Tier Name & Quota Controls
            </label>
            <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider bg-indigo-500/10 px-2.5 py-1 border border-indigo-500/20 rounded-lg">
              Custom Name & Add/Subtract Enabled
            </span>
          </div>

          {/* Custom Name Input & Ticket Price */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                  Custom Pass Tier Name *
                </label>
                <input
                  type="text"
                  required
                  value={customCategoryName}
                  onChange={e => setCustomCategoryName(e.target.value)}
                  placeholder="e.g. Platinum VIP Access, Backstage Crew..."
                  className="w-full bg-slate-950 border border-slate-800 p-3.5 font-bold text-base text-white focus:border-indigo-500 outline-none rounded-xl"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                  Ticket Price (₹ INR) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm font-bold">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={ticketPrice}
                    onChange={e => setTicketPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="750"
                    className="w-full bg-slate-950 border border-slate-800 pl-8 pr-3 py-3.5 font-mono font-bold text-base text-white focus:border-indigo-500 outline-none rounded-xl"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Quantity Controls: Add & Subtract */}
          <div className="bg-slate-950 border border-slate-800 p-5 space-y-4 rounded-2xl">
            <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400">
              Pass Quantity for "{customCategoryName.toUpperCase() || 'CUSTOM PASS'}"
            </label>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Subtract Controls */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <span className="text-[10px] font-bold uppercase text-slate-500 mr-1 hidden sm:inline">Subtract:</span>
                {[10, 5, 1].map(sub => (
                  <button
                    key={`sub-${sub}`}
                    type="button"
                    onClick={() => setQuantity(prev => Math.max(1, prev - sub))}
                    className="flex-1 sm:flex-none px-3 py-2 bg-rose-500/10 hover:bg-rose-600 hover:text-white text-rose-400 font-mono font-bold text-xs border border-rose-500/30 rounded-lg transition-colors cursor-pointer"
                    title={`Subtract ${sub} passes`}
                  >
                    -{sub}
                  </button>
                ))}
              </div>

              {/* Number Field */}
              <div className="w-full sm:w-36 shrink-0">
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={quantity}
                  onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-slate-900 border-2 border-indigo-500 p-2.5 text-center font-bold text-2xl text-indigo-300 font-mono outline-none rounded-xl"
                />
              </div>

              {/* Add Controls */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <span className="text-[10px] font-bold uppercase text-slate-500 mr-1 hidden sm:inline">Add:</span>
                {[1, 5, 10, 25, 50].map(add => (
                  <button
                    key={`add-${add}`}
                    type="button"
                    onClick={() => setQuantity(prev => Math.min(500, prev + add))}
                    className="flex-1 sm:flex-none px-3 py-2 bg-indigo-500/10 hover:bg-indigo-600 hover:text-white text-indigo-400 font-mono font-bold text-xs border border-indigo-500/30 rounded-lg transition-colors cursor-pointer"
                    title={`Add ${add} passes`}
                  >
                    +{add}
                  </button>
                ))}
              </div>

              {/* Add Tier to Batch Queue */}
              <button
                type="button"
                onClick={handleAddTierToList}
                className="w-full sm:w-auto ml-auto px-4 py-2.5 bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-200 font-bold text-xs uppercase tracking-wider border border-slate-700 rounded-xl transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                <ListPlus className="w-4 h-4" />
                Add Tier to Batch Queue
              </button>
            </div>
          </div>

          {/* Multi-Tier Batch Queue Display */}
          {tierList.length > 0 && (
            <div className="bg-slate-950 border border-indigo-500/30 p-5 rounded-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold uppercase text-indigo-400 tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Multi-Tier Batch Queue ({tierList.reduce((acc, t) => acc + t.count, 0)} Total Passes)
                </span>
                <button
                  type="button"
                  onClick={() => setTierList([])}
                  className="text-[10px] font-bold text-rose-400 hover:underline uppercase cursor-pointer"
                >
                  Clear Queue
                </button>
              </div>

              <div className="space-y-2">
                {tierList.map(tier => (
                  <div 
                    key={tier.id}
                    className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono"
                  >
                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold uppercase tracking-wider font-sans rounded-lg">
                        {tier.categoryName}
                      </span>
                      <span className="text-indigo-400 font-bold font-mono">
                        ₹{tier.price || 0} / pass
                      </span>
                      <span className="text-white font-bold font-mono text-sm">
                        {tier.count} Passes (₹{(tier.count * (tier.price || 0)).toLocaleString('en-IN')})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpdateTierCount(tier.id, -5)}
                        className="px-2 py-1 bg-slate-800 hover:bg-rose-600 text-rose-300 border border-slate-700 rounded-lg font-bold cursor-pointer"
                      >
                        -5
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateTierCount(tier.id, -1)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-rose-600 text-rose-300 border border-slate-700 rounded-lg font-bold cursor-pointer"
                      >
                        -1
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateTierCount(tier.id, 1)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-indigo-600 text-indigo-300 border border-slate-700 rounded-lg font-bold cursor-pointer"
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateTierCount(tier.id, 5)}
                        className="px-2 py-1 bg-slate-800 hover:bg-indigo-600 text-indigo-300 border border-slate-700 rounded-lg font-bold cursor-pointer"
                      >
                        +5
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveTier(tier.id)}
                        className="p-1.5 text-rose-400 hover:text-white hover:bg-rose-600 rounded-lg transition-colors ml-2 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full bg-indigo-600 text-white font-bold py-4 text-base uppercase tracking-wider rounded-2xl hover:bg-indigo-500 transition-colors flex items-center justify-center gap-3 shadow-lg shadow-indigo-600/30 cursor-pointer"
        >
          <PlusCircle className="w-5 h-5" />
          Generate {tierList.length > 0 ? tierList.reduce((acc, t) => acc + t.count, 0) : quantity} Pass Batch
          {tierList.length > 0 ? ` (${tierList.length} Tiers)` : ` (${customCategoryName.toUpperCase() || 'VIP PASS'})`}
        </button>

      </form>
      </div>
      )}

      {/* SECTION 2: MANAGE & END ACTIVE EVENTS */}
      {(activeSection === 'both' || activeSection === 'events') && (
        <div className="space-y-8 pt-6 border-t border-slate-800 animate-fadeIn">
          {/* Header Banner */}
          <div className="bg-slate-900 border border-slate-800 p-6 md:p-8 rounded-3xl relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2.5 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono text-[10px] font-bold uppercase tracking-wider rounded-lg flex items-center gap-1.5">
                    <ShieldAlert className="w-3 h-3" /> Event Lifecycle & Cascade Purge
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Single-Page Event Manager
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
                  Manage & End Active Events ({events.length})
                </h2>
                <p className="text-xs text-slate-400 max-w-2xl mt-1 leading-relaxed">
                  When an event is ended or deleted, all associated data — including generated 16-digit QR passes, attendee assignment records, and check-in history — is automatically purged.
                </p>
              </div>

              {/* Global Actions */}
              {events.length > 0 && onDeleteEvent && (
                <button
                  onClick={() => setModalAction({ type: 'purge_all' })}
                  className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-600 hover:text-white border border-rose-500/30 text-rose-400 font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 shrink-0 shadow-md shadow-rose-900/20 cursor-pointer"
                >
                  <FolderX className="w-4 h-4" />
                  End & Purge All ({events.length}) Events
                </button>
              )}
            </div>
          </div>

          {/* Controls Bar: Search & Category Filter */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-xl">
            {/* Search */}
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search events by title or location..."
                value={eventSearchTerm}
                onChange={e => setEventSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Category Dropdown */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <ListFilter className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400 hidden sm:inline">Category:</span>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold uppercase text-white focus:outline-none focus:border-indigo-500 transition-colors w-full sm:w-auto"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* SECTION: ACTIVE EVENTS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400 font-mono flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
                Active Events ({activeEvents.length})
              </h3>
            </div>

            {activeEvents.length === 0 ? (
              <div className="bg-slate-900 border border-dashed border-slate-800 rounded-2xl p-8 text-center">
                <CalendarOff className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <h4 className="text-xs font-bold uppercase text-slate-400">No Active Events</h4>
                <p className="text-xs text-slate-500 mt-0.5">All created events have been completed or deleted.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {activeEvents.map(event => {
                  const stats = getEventPassStats(event);

                  return (
                    <div 
                      key={event.id}
                      className="bg-slate-900 border border-slate-800 rounded-3xl p-6 hover:border-indigo-500/40 transition-all space-y-5 flex flex-col justify-between shadow-xl relative overflow-hidden group"
                    >
                      <div className="space-y-3">
                        {/* Top Category & Status */}
                        <div className="flex items-center justify-between gap-2">
                          <span 
                            className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg border"
                            style={{
                              backgroundColor: `${event.themeColor || '#4f46e5'}20`,
                              borderColor: `${event.themeColor || '#4f46e5'}50`,
                              color: event.themeColor || '#4f46e5',
                            }}
                          >
                            {event.category || 'VIP EVENT'}
                          </span>

                          <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 font-bold">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            ACTIVE
                          </span>
                        </div>

                        {/* Title & Tagline */}
                        <div>
                          <h3 className="text-xl font-bold uppercase tracking-tight text-white group-hover:text-indigo-400 transition-colors">
                            {event.title}
                          </h3>
                          {event.tagline && (
                            <p className="text-xs text-slate-400 font-medium italic mt-0.5">
                              "{event.tagline}"
                            </p>
                          )}
                        </div>

                        {/* Event Details */}
                        <div className="grid grid-cols-2 gap-2 pt-2 text-xs text-slate-300 font-mono">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>{event.date}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>{event.commencementTime || event.time || '10:00 AM'}</span>
                          </div>
                          <div className="flex items-center gap-2 col-span-2">
                            <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span className="truncate">{event.location}</span>
                          </div>
                        </div>

                        {/* Pass Breakdown Stats Pill */}
                        <div className="grid grid-cols-3 gap-2 p-3 bg-slate-950 border border-slate-800 rounded-2xl text-center font-mono">
                          <div>
                            <div className="text-[9px] text-slate-500 uppercase">Total</div>
                            <div className="text-base font-bold text-white">{stats.total}</div>
                          </div>
                          <div>
                            <div className="text-[9px] text-slate-500 uppercase">Assigned</div>
                            <div className="text-base font-bold text-indigo-400">{stats.assigned}</div>
                          </div>
                          <div>
                            <div className="text-[9px] text-slate-500 uppercase">Unassigned</div>
                            <div className="text-base font-bold text-amber-400">{stats.unassigned}</div>
                          </div>
                        </div>

                        {/* Saved Event Quick Tiers & Direct Pass Generator Widget */}
                        {(() => {
                          const tierMap = new Map<string, number>();
                          stats.passesList.forEach(p => {
                            const cat = p.category || 'General';
                            if (!tierMap.has(cat)) {
                              tierMap.set(cat, p.ticketPrice || 0);
                            }
                          });
                          const savedTiers = Array.from(tierMap.entries());

                          return (
                            <div className="pt-3 border-t border-slate-800 space-y-2.5">
                              {savedTiers.length > 0 && (
                                <div className="space-y-1">
                                  <span className="text-[9px] font-mono font-bold uppercase text-indigo-400 block tracking-wider">
                                    ⚡ Saved Ticket Presets:
                                  </span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {savedTiers.map(([tierName, price]) => (
                                      <button
                                        key={tierName}
                                        type="button"
                                        onClick={() => {
                                          setSelectedEventId(event.id);
                                          setCustomCategoryName(tierName);
                                          setTicketPrice(price);
                                        }}
                                        className="px-2.5 py-1 bg-indigo-500/10 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/20 text-[10px] font-mono font-bold uppercase rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                                        title="Click to load this saved tier into generator"
                                      >
                                        <span>{tierName}</span>
                                        <span className="opacity-75">(₹{price})</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Quick Pass Creator Box on Event Card */}
                              <div className="bg-slate-950 border border-slate-800 p-3 rounded-2xl space-y-2">
                                <span className="text-[9px] font-bold uppercase text-slate-300 font-mono block">
                                  ➕ Select Pass Type & Quantity for this Event:
                                </span>
                                <div className="flex flex-wrap items-center gap-2">
                                  <select
                                    className="flex-1 bg-slate-900 border border-slate-800 text-white font-mono text-xs p-2 rounded-xl outline-none focus:border-indigo-500 uppercase font-bold"
                                    onChange={e => {
                                      const val = e.target.value;
                                      if (val) {
                                        setSelectedEventId(event.id);
                                        setCustomCategoryName(val);
                                        const foundPrice = tierMap.get(val);
                                        if (foundPrice !== undefined) setTicketPrice(foundPrice);
                                      }
                                    }}
                                  >
                                    <option value="">Select pass type...</option>
                                    {savedTiers.map(([tName, price]) => (
                                      <option key={tName} value={tName}>{tName.toUpperCase()} (₹{price})</option>
                                    ))}
                                    <option value="PLATINUM VIP">PLATINUM VIP (₹1500)</option>
                                    <option value="GOLD ACCESS">GOLD ACCESS (₹1000)</option>
                                    <option value="GENERAL PASS">GENERAL PASS (₹500)</option>
                                    <option value="BACKSTAGE CREW">BACKSTAGE CREW (₹0)</option>
                                  </select>

                                  <select
                                    className="w-24 bg-slate-900 border border-slate-800 text-indigo-400 font-mono text-xs p-2 rounded-xl outline-none font-bold focus:border-indigo-500"
                                    value={quantity}
                                    onChange={e => setQuantity(parseInt(e.target.value) || 1)}
                                  >
                                    <option value={1}>1 Pass</option>
                                    <option value={5}>5 Passes</option>
                                    <option value={10}>10 Passes</option>
                                    <option value={20}>20 Passes</option>
                                    <option value={50}>50 Passes</option>
                                    <option value={100}>100 Passes</option>
                                  </select>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedEventId(event.id);
                                      const nameToUse = customCategoryName || 'GENERAL PASS';
                                      handleGenerateBatchNow(event.id, nameToUse, ticketPrice, quantity);
                                    }}
                                    className="px-3.5 py-2 bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider hover:bg-indigo-500 rounded-xl transition-colors shrink-0 shadow-sm cursor-pointer"
                                  >
                                    Generate
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Action Controls: End Event & Delete Event */}
                      <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                        <button
                          onClick={() => setInsightEvent(event)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs uppercase rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <BarChart3 className="w-3.5 h-3.5 text-indigo-400" /> Insights
                        </button>

                        <div className="flex items-center gap-2">
                          {onEndEvent && (
                            <button
                              onClick={() => setModalAction({ type: 'end', event })}
                              className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-600 hover:text-white border border-amber-500/30 text-amber-300 font-semibold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                              title="Mark event as completed / ended"
                            >
                              <CheckCircle className="w-3.5 h-3.5" /> End Event
                            </button>
                          )}

                          {onDeleteEvent && (
                            <button
                              onClick={() => setModalAction({ type: 'delete', event })}
                              className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-600 hover:text-white border border-rose-500/30 text-rose-400 font-semibold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                              title="Permanently purge event and passes"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION: ENDED / COMPLETED EVENTS */}
          {endedEvents.length > 0 && (
            <div className="space-y-4 pt-6 border-t border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-purple-400 font-mono flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-purple-400" />
                  Ended / Completed Events ({endedEvents.length})
                </h3>
                <span className="text-[10px] text-slate-400 font-mono uppercase">
                  Click any ended event to inspect full insights & performance
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {endedEvents.map(event => {
                  const stats = getEventPassStats(event);

                  return (
                    <div 
                      key={event.id}
                      onClick={() => setInsightEvent(event)}
                      className="bg-slate-950 border border-purple-500/30 rounded-3xl p-6 hover:border-purple-400 transition-all space-y-4 flex flex-col justify-between shadow-xl cursor-pointer group relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 bg-purple-500/20 text-purple-300 font-mono text-[9px] font-bold px-3 py-1 rounded-bl-xl border-l border-b border-purple-500/30 uppercase flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-purple-400" /> Ended / Completed
                      </div>

                      <div className="space-y-3 pt-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-300">
                            {event.category || 'EVENT'}
                          </span>
                        </div>

                        <div>
                          <h3 className="text-xl font-bold uppercase tracking-tight text-slate-200 group-hover:text-purple-300 transition-colors">
                            {event.title}
                          </h3>
                          <p className="text-xs text-slate-500 font-mono mt-0.5">
                            Ended: {event.endedAt ? new Date(event.endedAt).toLocaleDateString() : event.date}
                          </p>
                        </div>

                        <div className="grid grid-cols-3 gap-2 p-3 bg-slate-900 border border-slate-800 rounded-2xl text-center font-mono">
                          <div>
                            <div className="text-[9px] text-slate-500 uppercase">Assigned</div>
                            <div className="text-sm font-bold text-purple-300">{stats.assigned}</div>
                          </div>
                          <div>
                            <div className="text-[9px] text-slate-500 uppercase">Checked In</div>
                            <div className="text-sm font-bold text-emerald-400">{stats.checkedIn}</div>
                          </div>
                          <div>
                            <div className="text-[9px] text-slate-500 uppercase">Revenue</div>
                            <div className="text-sm font-bold text-emerald-400">₹{stats.totalRevenue.toLocaleString('en-IN')}</div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono text-purple-400 font-bold uppercase flex items-center gap-1">
                          <BarChart3 className="w-3.5 h-3.5" /> Click to view full event insights
                        </span>

                        {onDeleteEvent && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setModalAction({ type: 'delete', event });
                            }}
                            className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-600 hover:text-white border border-rose-500/20 text-rose-400 font-bold text-[10px] uppercase rounded-lg transition-all"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {modalAction.type && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-3xl max-w-md w-full space-y-6 shadow-2xl relative animate-scaleUp">
            <div className="flex items-center gap-3 text-amber-400 border-b border-slate-800 pb-4">
              <div className="p-3 bg-amber-500/10 rounded-2xl">
                {modalAction.type === 'end' ? <CheckCircle className="w-6 h-6 text-amber-400" /> : <AlertTriangle className="w-6 h-6 text-rose-400" />}
              </div>
              <div>
                <h3 className="font-bold text-lg uppercase tracking-tight text-white">
                  {modalAction.type === 'end' ? 'Complete & End Event' : 'Confirm Cascade Deletion'}
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  {modalAction.type === 'end' ? 'Lifecycle Status Update' : 'Irreversible Action'}
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
              {modalAction.type === 'end' ? (
                <p>
                  Are you sure you want to <strong className="text-amber-400 uppercase">End Event "{modalAction.event?.title}"</strong>? The event will move down to the <span className="text-purple-400 font-bold">Ended / Completed Events</span> section. All passes, guest assignments, check-ins, and financial history will be preserved.
                </p>
              ) : modalAction.type === 'purge_all' ? (
                <p>
                  Are you sure you want to <strong className="text-rose-400 uppercase">Purge All ({events.length}) Events</strong> and delete all associated passes, attendee assignments, and check-in logs from system memory?
                </p>
              ) : (
                <p>
                  Are you sure you want to delete <strong className="text-white uppercase font-bold">"{modalAction.event?.title}"</strong>? All linked 16-digit QR passes, attendee records, and check-in logs will be permanently deleted.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setModalAction({ type: null })}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                className={`px-5 py-2 font-bold text-xs uppercase tracking-wider rounded-xl transition-colors shadow-lg cursor-pointer ${
                  modalAction.type === 'end'
                    ? 'bg-amber-500 text-black hover:bg-amber-400'
                    : 'bg-rose-600 text-white hover:bg-rose-500 shadow-rose-900/30'
                }`}
              >
                {modalAction.type === 'end' ? 'Yes, Complete Event' : 'Yes, Delete & Purge Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EVENT INSIGHTS MODAL */}
      {insightEvent && (() => {
        const stats = getEventPassStats(insightEvent);
        const checkInPercent = stats.assigned > 0 ? Math.round((stats.checkedIn / stats.assigned) * 100) : 0;

        // Calculate specific event expenses and profit
        const eventTitleLower = insightEvent.title.toLowerCase().trim();
        const eventExpenses = (financials || []).filter(f => 
          f.type === 'expense' && (f.eventId === insightEvent.id || (f.notes && f.notes.toLowerCase().includes(eventTitleLower)))
        );
        const totalExpenses = eventExpenses.reduce((sum, e) => sum + e.amount, 0);
        const netProfit = stats.totalRevenue - totalExpenses;

        return (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
            <div className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-3xl max-w-2xl w-full space-y-6 shadow-2xl relative my-8">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[10px] font-mono font-bold uppercase rounded-lg">
                      📊 Event Analytics & Financial Overview
                    </span>
                    <span className={`text-[10px] font-mono font-bold uppercase ${insightEvent.status === 'ended' ? 'text-purple-400' : 'text-emerald-400'}`}>
                      {insightEvent.status === 'ended' ? '• Completed' : '• Live Active'}
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold text-white uppercase tracking-tight">
                    {insightEvent.title}
                  </h2>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    {insightEvent.date} | {insightEvent.location} | Organizer: {insightEvent.organizer}
                  </p>
                </div>

                <button
                  onClick={() => setInsightEvent(null)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tagline / Description */}
              {insightEvent.description && (
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-300 italic font-mono leading-relaxed">
                  "{insightEvent.description}"
                </div>
              )}

              {/* Key Attendance Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl text-center space-y-1">
                  <span className="text-[9px] text-slate-500 uppercase font-bold block">Total Passes</span>
                  <span className="text-xl font-bold text-white">{stats.total}</span>
                </div>
                <div className="bg-slate-950 border border-indigo-500/30 p-3.5 rounded-2xl text-center space-y-1">
                  <span className="text-[9px] text-indigo-400 uppercase font-bold block">Assigned / Sold</span>
                  <span className="text-xl font-bold text-indigo-400">{stats.assigned}</span>
                </div>
                <div className="bg-slate-950 border border-blue-500/30 p-3.5 rounded-2xl text-center space-y-1">
                  <span className="text-[9px] text-blue-400 uppercase font-bold block">Checked-In</span>
                  <span className="text-xl font-bold text-blue-400">{stats.checkedIn} ({checkInPercent}%)</span>
                </div>
                <div className="bg-slate-950 border border-amber-400/30 p-3.5 rounded-2xl text-center space-y-1">
                  <span className="text-[9px] text-amber-400 uppercase font-bold block">Unassigned</span>
                  <span className="text-xl font-bold text-amber-400">{stats.unassigned}</span>
                </div>
              </div>

              {/* FINANCIALS BREAKDOWN FOR THIS EVENT */}
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-3 font-mono">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-indigo-400" />
                    Event Financial Performance (P&L)
                  </span>
                  <span className="text-[10px] text-slate-400">Currency: INR (₹)</span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <span className="text-[9px] text-emerald-400 font-bold uppercase block">Ticket Revenue</span>
                    <span className="text-lg font-bold text-emerald-400">+₹{stats.totalRevenue.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                    <span className="text-[9px] text-rose-400 font-bold uppercase block">Logged Expenses</span>
                    <span className="text-lg font-bold text-rose-400">-₹{totalExpenses.toLocaleString('en-IN')}</span>
                  </div>

                  <div className={`p-2.5 border rounded-xl ${netProfit >= 0 ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300' : 'bg-rose-500/20 border-rose-500/40 text-rose-400'}`}>
                    <span className="text-[9px] font-bold uppercase block">Net Profit / Loss</span>
                    <span className="text-lg font-bold">₹{netProfit.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {eventExpenses.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-800">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Expenses Ledger ({eventExpenses.length} entries):</span>
                    <div className="max-h-28 overflow-y-auto space-y-1 pr-1 custom-scrollbar text-[11px]">
                      {eventExpenses.map(exp => (
                        <div key={exp.id} className="flex items-center justify-between p-2 bg-slate-900 rounded-lg border border-slate-800">
                          <span className="text-slate-300 truncate">{exp.title} ({exp.category})</span>
                          <span className="text-rose-400 font-bold shrink-0 ml-2">-₹{exp.amount.toLocaleString('en-IN')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Attendee Directory Preview */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase text-slate-300 tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-400" />
                  Assigned Attendees ({stats.assigned})
                </h3>

                {stats.assigned === 0 ? (
                  <p className="text-xs text-slate-500 font-mono italic">No attendees assigned to this event yet.</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {stats.passesList
                      .filter(p => p.status === 'assigned' || p.status === 'checked_in')
                      .map(p => (
                        <div key={p.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs font-mono">
                          <div>
                            <span className="font-bold text-white block">{p.assignedTo?.name || 'Guest'}</span>
                            <span className="text-[10px] text-slate-500">Tier: {p.category} | Price: ₹{p.ticketPrice || 0} | Code: {p.formattedCode}</span>
                          </div>
                          <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-lg ${p.status === 'checked_in' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'}`}>
                            {p.status === 'checked_in' ? '✓ Checked In' : 'Assigned'}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
                {insightEvent.status === 'ended' && onReopenEvent ? (
                  <button
                    onClick={() => {
                      onReopenEvent(insightEvent.id);
                      setInsightEvent(null);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 shadow-md shadow-indigo-600/30 cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" /> Re-Open Event
                  </button>
                ) : (
                  <span className="text-[10px] text-slate-500 font-mono">Event ID: {insightEvent.id}</span>
                )}

                <button
                  type="button"
                  onClick={() => setInsightEvent(null)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
                >
                  Close Insights
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};
