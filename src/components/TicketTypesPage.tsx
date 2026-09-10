import React, { useState, useMemo } from 'react';
import { 
  Ticket, 
  PlusCircle, 
  Trash2, 
  Edit3, 
  Check, 
  Calendar, 
  DollarSign, 
  Layers, 
  CheckCircle2, 
  Users, 
  Palette,
  Zap,
  X
} from 'lucide-react';
import { EventItem, PassItem, TicketTierConfig } from '../types';
import { generate16DigitNumericCode, format16DigitCode } from '../lib/passUtils';

interface TicketTypesPageProps {
  events: EventItem[];
  passes: PassItem[];
  selectedEventId: string;
  onSelectEvent: (eventId: string) => void;
  onUpdateEvent: (event: EventItem) => void;
  onAddPasses?: (newPasses: PassItem[]) => void;
  onNavigateToPasses: () => void;
}

const PRESET_COLORS = [
  { name: 'Gold / VIP', hex: '#eab308' },
  { name: 'Emerald Green', hex: '#10b981' },
  { name: 'Rose / Ruby', hex: '#f43f5e' },
  { name: 'Electric Purple', hex: '#8b5cf6' },
  { name: 'Cyan / Teal', hex: '#06b6d4' },
  { name: 'Electric Blue', hex: '#3b82f6' },
  { name: 'Neon Orange', hex: '#f59e0b' },
  { name: 'Hot Magenta', hex: '#ec4899' },
  { name: 'Obsidian Slate', hex: '#475569' },
];

const PRICE_QUICK_BUTTONS = [
  { label: 'Free (₹0)', value: 0 },
  { label: '₹299', value: 299 },
  { label: '₹499', value: 499 },
  { label: '₹999', value: 999 },
  { label: '₹1,499', value: 1499 },
  { label: '₹2,499', value: 2499 },
  { label: '₹4,999', value: 4999 },
];

export const TicketTypesPage: React.FC<TicketTypesPageProps> = ({
  events,
  passes,
  selectedEventId,
  onSelectEvent,
  onUpdateEvent,
  onAddPasses,
  onNavigateToPasses,
}) => {
  // Active events list
  const activeEvents = useMemo(() => events.filter(e => e.status !== 'ended'), [events]);

  // Determine current active target event
  const currentTargetEvent = useMemo(() => {
    if (selectedEventId && selectedEventId !== 'all') {
      const found = events.find(e => e.id === selectedEventId);
      if (found) return found;
    }
    return activeEvents[0] || events[0] || null;
  }, [events, activeEvents, selectedEventId]);

  // Form State for Ticket Tier
  const [tierName, setTierName] = useState('');
  const [tierPrice, setTierPrice] = useState<string>('499');
  const [tierColor, setTierColor] = useState('#10b981');
  const [editingTierId, setEditingTierId] = useState<string | null>(null);

  // Success Feedback Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Quick Batch Pass Generator Modal State
  const [quickGenTier, setQuickGenTier] = useState<TicketTierConfig | null>(null);
  const [quickGenQuantity, setQuickGenQuantity] = useState(10);
  const [isGenerating, setIsGenerating] = useState(false);

  // Current tiers for target event
  const currentTiers = useMemo<TicketTierConfig[]>(() => {
    if (!currentTargetEvent) return [];
    return currentTargetEvent.ticketTiers || [];
  }, [currentTargetEvent]);

  // Statistics for the tiers of the selected event
  const tierStats = useMemo(() => {
    if (!currentTargetEvent) return { totalTiers: 0, totalRevenue: 0, totalPasses: 0 };
    
    const eventPasses = passes.filter(p => p.eventId === currentTargetEvent.id);
    const assignedPasses = eventPasses.filter(p => p.status === 'assigned' || p.status === 'checked_in');
    const totalRevenue = assignedPasses.reduce((acc, p) => acc + (p.ticketPrice || 0), 0);

    return {
      totalTiers: currentTiers.length,
      totalRevenue,
      totalPasses: eventPasses.length,
    };
  }, [currentTargetEvent, currentTiers, passes]);

  // Helper to show notification
  const notify = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Reset form
  const resetForm = () => {
    setTierName('');
    setTierPrice('499');
    setTierColor('#10b981');
    setEditingTierId(null);
  };

  // Pre-fill form for editing
  const handleStartEdit = (tier: TicketTierConfig) => {
    setEditingTierId(tier.id || tier.categoryName);
    setTierName(tier.categoryName);
    setTierPrice(tier.price.toString());
    setTierColor(tier.color || '#10b981');
    
    // Scroll to form smoothly
    const formElem = document.getElementById('ticket-tier-form-card');
    if (formElem) {
      formElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Handle Save (Add or Update) Ticket Tier
  const handleSaveTier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTargetEvent) return;

    const trimmedName = tierName.trim();
    if (!trimmedName) return;

    const parsedPrice = Math.max(0, parseFloat(tierPrice) || 0);

    let updatedTiers: TicketTierConfig[];

    if (editingTierId) {
      // Update existing tier
      updatedTiers = currentTiers.map(t => {
        const matches = (t.id && t.id === editingTierId) || t.categoryName === editingTierId;
        if (matches) {
          return {
            ...t,
            categoryName: trimmedName,
            price: parsedPrice,
            color: tierColor,
          };
        }
        return t;
      });
      notify(`Updated ticket type "${trimmedName}" (₹${parsedPrice.toLocaleString('en-IN')})`);
    } else {
      // Add new tier
      const newTier: TicketTierConfig = {
        id: `tier-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        categoryName: trimmedName,
        price: parsedPrice,
        color: tierColor,
      };
      updatedTiers = [...currentTiers, newTier];
      notify(`Added new ticket type "${trimmedName}" at ₹${parsedPrice.toLocaleString('en-IN')}`);
    }

    // Save to Event
    const updatedEvent: EventItem = {
      ...currentTargetEvent,
      ticketTiers: updatedTiers,
    };
    onUpdateEvent(updatedEvent);
    resetForm();
  };

  // Handle Delete Ticket Tier
  const handleDeleteTier = (tierToDelete: TicketTierConfig) => {
    if (!currentTargetEvent) return;

    const updatedTiers = currentTiers.filter(t => {
      if (tierToDelete.id && t.id) return t.id !== tierToDelete.id;
      return t.categoryName !== tierToDelete.categoryName;
    });

    const updatedEvent: EventItem = {
      ...currentTargetEvent,
      ticketTiers: updatedTiers,
    };
    onUpdateEvent(updatedEvent);
    notify(`Removed ticket type "${tierToDelete.categoryName}"`);
  };

  // Quick Generate Passes directly for this Tier
  const handleExecuteQuickGen = () => {
    if (!currentTargetEvent || !quickGenTier || !onAddPasses) return;

    setIsGenerating(true);
    const newPasses: PassItem[] = [];

    for (let i = 0; i < quickGenQuantity; i++) {
      const code16 = generate16DigitNumericCode();
      newPasses.push({
        id: `pass-${code16}`,
        code16,
        formattedCode: format16DigitCode(code16),
        eventId: currentTargetEvent.id,
        eventName: currentTargetEvent.title,
        eventDate: currentTargetEvent.date,
        eventTime: currentTargetEvent.commencementTime || currentTargetEvent.time || '10:00 AM',
        commencementTime: currentTargetEvent.commencementTime || currentTargetEvent.time,
        endTime: currentTargetEvent.endTime,
        eventLocation: currentTargetEvent.location,
        category: quickGenTier.categoryName,
        ticketPrice: quickGenTier.price,
        status: 'unassigned',
        themeColor: quickGenTier.color || currentTargetEvent.themeColor || '#10b981',
        createdAt: new Date().toISOString(),
      });
    }

    onAddPasses(newPasses);
    setIsGenerating(false);
    setQuickGenTier(null);
    notify(`Successfully generated ${quickGenQuantity} unassigned passes for "${quickGenTier.categoryName}"!`);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 py-4 px-4 animate-fadeIn">
      
      {/* Header Banner */}
      <div className="bg-neutral-900 border border-white/10 p-6 rounded-2xl relative overflow-hidden shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 bg-emerald-400/10 text-emerald-400 border border-emerald-400/30 text-[10px] font-black uppercase tracking-wider rounded-full flex items-center gap-1">
                <Ticket className="w-3 h-3" /> TICKET TYPES & PRICING
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">
              TICKET TYPES & <span className="text-emerald-400">PRICING</span>
            </h1>
            <p className="text-xs text-neutral-400 max-w-2xl mt-1">
              Add ticket types with custom prices (₹) and badge colors. Simple, instant, and straightforward.
            </p>
          </div>

          {/* Metrics */}
          {currentTargetEvent && (
            <div className="flex items-center gap-3 shrink-0 flex-wrap">
              <div className="bg-neutral-950/90 border border-white/10 px-4 py-2.5 rounded-xl">
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Ticket Types</div>
                <div className="text-xl font-black text-white font-mono">{tierStats.totalTiers}</div>
              </div>
              <div className="bg-emerald-950/60 border border-emerald-400/30 px-4 py-2.5 rounded-xl">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Ticket Revenue</div>
                <div className="text-xl font-black text-emerald-400 font-mono">
                  ₹{tierStats.totalRevenue.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="bg-neutral-950/90 border border-white/10 px-4 py-2.5 rounded-xl">
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Total Passes</div>
                <div className="text-xl font-black text-neutral-300 font-mono">{tierStats.totalPasses}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="bg-emerald-500/10 border border-emerald-400/50 px-4 py-3 rounded-xl flex items-center justify-between text-xs text-emerald-300 font-bold shadow-lg animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-emerald-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* EVENT SELECTOR BAR */}
      <div className="bg-neutral-900 border border-white/10 p-4 rounded-2xl shadow flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-black uppercase text-white tracking-wider">Select Event:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {events.length === 0 ? (
            <span className="text-xs font-mono text-neutral-500">No events found. Please create an event first.</span>
          ) : (
            events.map(evt => {
              const isSelected = currentTargetEvent?.id === evt.id;
              const tierCount = evt.ticketTiers?.length || 0;
              return (
                <button
                  key={evt.id}
                  type="button"
                  onClick={() => onSelectEvent(evt.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer flex items-center gap-2 ${
                    isSelected
                      ? 'bg-emerald-400 text-black shadow-md font-black'
                      : 'bg-neutral-950 text-neutral-400 hover:text-white border border-white/10'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-black' : 'bg-emerald-400'}`}></span>
                  <span>{evt.title}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                    isSelected ? 'bg-black/20 text-black font-bold' : 'bg-white/10 text-neutral-300'
                  }`}>
                    {tierCount} {tierCount === 1 ? 'Tier' : 'Tiers'}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {currentTargetEvent ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: ADD / EDIT TICKET TYPE FORM (5 Columns) */}
          <div id="ticket-tier-form-card" className="lg:col-span-5 bg-neutral-900 border border-white/10 p-5 md:p-6 rounded-2xl space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-400" />
                <h2 className="text-base font-black uppercase text-white tracking-tight">
                  {editingTierId ? 'Edit Ticket Type' : 'Add Ticket Type'}
                </h2>
              </div>
              {editingTierId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10px] font-bold uppercase transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>

            <form onSubmit={handleSaveTier} className="space-y-4">
              
              {/* Field 1: Ticket Type Name */}
              <div>
                <label className="block text-xs font-black uppercase text-neutral-300 tracking-wider mb-1.5">
                  Ticket Type Name <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. VIP Pass, General Admission, Early Bird"
                  value={tierName}
                  onChange={e => setTierName(e.target.value)}
                  className="w-full bg-neutral-950 border border-white/20 px-3.5 py-2.5 font-bold text-sm text-white placeholder-neutral-600 focus:border-emerald-400 outline-none rounded-xl"
                />
              </div>

              {/* Field 2: Ticket Price (₹ INR) */}
              <div>
                <label className="block text-xs font-black uppercase text-neutral-300 tracking-wider mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Ticket Price (₹ INR) <span className="text-emerald-400">*</span>
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400">₹0 = Free</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 font-mono text-base font-black">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    placeholder="e.g. 499"
                    value={tierPrice}
                    onChange={e => setTierPrice(e.target.value)}
                    className="w-full bg-neutral-950 border border-white/20 pl-8 pr-4 py-2.5 font-mono font-black text-base text-emerald-400 placeholder-neutral-600 focus:border-emerald-400 outline-none rounded-xl"
                  />
                </div>

                {/* Quick Price Buttons */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {PRICE_QUICK_BUTTONS.map(btn => (
                    <button
                      key={btn.label}
                      type="button"
                      onClick={() => setTierPrice(btn.value.toString())}
                      className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                        parseFloat(tierPrice) === btn.value
                          ? 'bg-emerald-400 text-black shadow font-black'
                          : 'bg-white/5 text-neutral-400 hover:text-white border border-white/10'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Field 3: Ticket Color Selection */}
              <div>
                <label className="block text-xs font-black uppercase text-neutral-300 tracking-wider mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-emerald-400" /> Ticket Color <span className="text-emerald-400">*</span>
                  </span>
                  <span className="font-mono text-[10px] text-neutral-400 uppercase">{tierColor}</span>
                </label>

                {/* Color Swatches Grid */}
                <div className="grid grid-cols-5 gap-2 mb-2.5">
                  {PRESET_COLORS.map(c => {
                    const isSelected = tierColor.toLowerCase() === c.hex.toLowerCase();
                    return (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setTierColor(c.hex)}
                        className={`h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
                          isSelected 
                            ? 'border-white shadow-lg ring-2 ring-emerald-400 scale-105' 
                            : 'border-white/10 hover:scale-105 opacity-85 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={c.name}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Color Input */}
                <div className="flex items-center gap-2 bg-neutral-950 p-1.5 border border-white/15 rounded-xl">
                  <input
                    type="color"
                    value={tierColor}
                    onChange={e => setTierColor(e.target.value)}
                    className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    value={tierColor}
                    onChange={e => setTierColor(e.target.value)}
                    placeholder="#10b981"
                    className="bg-transparent text-white font-mono text-xs uppercase px-2 py-1 outline-none w-full font-bold"
                  />
                  <span className="text-[10px] font-mono text-neutral-500 shrink-0 pr-2">Custom</span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full py-3 bg-emerald-400 hover:bg-emerald-300 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {editingTierId ? (
                  <>
                    <Check className="w-4 h-4" /> Save Changes
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4" /> Add Ticket Type
                  </>
                )}
              </button>
            </form>
          </div>

          {/* RIGHT COLUMN: CONFIGURED TICKET TIERS DIRECTORY (7 Columns) */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* Event Summary Card */}
            <div className="bg-neutral-900 border border-white/10 p-4 rounded-2xl shadow flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: currentTargetEvent.themeColor || '#10b981' }}></span>
                  <h3 className="font-black text-white text-sm uppercase">{currentTargetEvent.title}</h3>
                </div>
                <div className="text-xs font-mono text-neutral-400 mt-1 flex flex-wrap items-center gap-3">
                  <span>📅 {currentTargetEvent.date}</span>
                  <span>📍 {currentTargetEvent.location}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={onNavigateToPasses}
                className="px-3 py-2 bg-neutral-950 hover:bg-neutral-800 border border-white/15 text-emerald-400 hover:text-emerald-300 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Users className="w-4 h-4" /> View Passes
              </button>
            </div>

            {/* Configured Tiers List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  Configured Ticket Types ({currentTiers.length})
                </h3>
              </div>

              {currentTiers.length === 0 ? (
                <div className="bg-neutral-900 border border-dashed border-white/15 p-8 rounded-2xl text-center space-y-2">
                  <Ticket className="w-8 h-8 mx-auto text-neutral-600" />
                  <h4 className="text-sm font-bold text-white">No ticket types added yet</h4>
                  <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                    Use the form on the left to add ticket types like VIP, General, or Early Bird with pricing.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {currentTiers.map((tier, idx) => {
                    const tierPasses = passes.filter(
                      p => p.eventId === currentTargetEvent.id && p.category?.toLowerCase() === tier.categoryName.toLowerCase()
                    );
                    const assignedCount = tierPasses.filter(p => p.status === 'assigned' || p.status === 'checked_in').length;
                    const tierColorSafe = tier.color || '#10b981';

                    return (
                      <div
                        key={tier.id || `${tier.categoryName}-${idx}`}
                        className="bg-neutral-900 border border-white/10 hover:border-white/20 p-4 rounded-2xl shadow transition-all relative overflow-hidden group"
                      >
                        {/* Left Color Indicator Bar */}
                        <div
                          className="absolute top-0 bottom-0 left-0 w-1.5"
                          style={{ backgroundColor: tierColorSafe }}
                        ></div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pl-2">
                          
                          {/* Left: Tier Details */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span
                                className="px-2.5 py-0.5 rounded-lg text-xs font-black uppercase tracking-wider text-black shadow"
                                style={{ backgroundColor: tierColorSafe }}
                              >
                                {tier.categoryName}
                              </span>

                              <span className="text-base font-black font-mono text-emerald-400">
                                {tier.price === 0 ? 'FREE' : `₹${tier.price.toLocaleString('en-IN')}`}
                              </span>
                            </div>

                            {/* Live Stats for this Tier */}
                            <div className="flex flex-wrap items-center gap-3 pt-0.5 text-xs text-neutral-400">
                              <span>Total Passes: <b className="text-white">{tierPasses.length}</b></span>
                              <span>•</span>
                              <span>Issued: <b className="text-emerald-400">{assignedCount}</b></span>
                            </div>
                          </div>

                          {/* Right: Actions */}
                          <div className="flex items-center gap-2 shrink-0">
                            {/* Quick Generate Passes Button */}
                            {onAddPasses && (
                              <button
                                type="button"
                                onClick={() => {
                                  setQuickGenTier(tier);
                                  setQuickGenQuantity(10);
                                }}
                                className="px-3 py-1.5 bg-emerald-400 hover:bg-emerald-300 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow flex items-center gap-1.5 cursor-pointer"
                                title="Generate batch passes for this tier"
                              >
                                <Zap className="w-3.5 h-3.5" />
                                <span>Generate Passes</span>
                              </button>
                            )}

                            {/* Edit Button */}
                            <button
                              type="button"
                              onClick={() => handleStartEdit(tier)}
                              className="p-2 bg-neutral-950 hover:bg-neutral-800 border border-white/10 text-neutral-300 hover:text-white rounded-xl transition-colors cursor-pointer"
                              title="Edit ticket tier"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => handleDeleteTier(tier)}
                              className="p-2 bg-neutral-950 hover:bg-rose-950/50 border border-white/10 hover:border-rose-500/40 text-neutral-400 hover:text-rose-400 rounded-xl transition-colors cursor-pointer"
                              title="Delete ticket tier"
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
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-neutral-900 border border-white/10 p-8 rounded-2xl text-center space-y-2">
          <Calendar className="w-8 h-8 mx-auto text-neutral-600" />
          <h3 className="text-sm font-black text-white uppercase">No Events Available</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            Please create an event first in the Event Creation directory.
          </p>
        </div>
      )}

      {/* MODAL: QUICK BATCH PASS GENERATOR FOR TIER */}
      {quickGenTier && currentTargetEvent && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-white/20 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-5 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-black uppercase text-white">Generate Passes</h3>
              </div>
              <button
                onClick={() => setQuickGenTier(null)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-neutral-950 border border-white/10 p-3.5 rounded-xl space-y-1.5">
              <div className="text-[10px] font-mono uppercase text-neutral-400">Target Event & Tier</div>
              <div className="font-bold text-white text-sm">{currentTargetEvent.title}</div>
              <div className="flex items-center gap-2">
                <span
                  className="px-2.5 py-0.5 rounded text-xs font-black uppercase text-black"
                  style={{ backgroundColor: quickGenTier.color || '#10b981' }}
                >
                  {quickGenTier.categoryName}
                </span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  {quickGenTier.price === 0 ? 'FREE' : `₹${quickGenTier.price.toLocaleString('en-IN')}`}
                </span>
              </div>
            </div>

            {/* Quantity Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase text-neutral-300 tracking-wider">
                Quantity to Generate
              </label>
              <div className="flex items-center gap-2">
                {[5, 10, 25, 50, 100].map(qty => (
                  <button
                    key={qty}
                    type="button"
                    onClick={() => setQuickGenQuantity(qty)}
                    className={`flex-1 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                      quickGenQuantity === qty
                        ? 'bg-emerald-400 text-black shadow'
                        : 'bg-neutral-950 text-neutral-400 hover:text-white border border-white/10'
                    }`}
                  >
                    {qty}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="1"
                max="500"
                value={quickGenQuantity}
                onChange={e => setQuickGenQuantity(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-neutral-950 border border-white/20 p-2 font-mono text-center text-sm font-black text-emerald-400 outline-none rounded-xl"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setQuickGenTier(null)}
                className="flex-1 py-2.5 bg-neutral-950 hover:bg-neutral-800 text-neutral-300 font-bold text-xs uppercase tracking-wider rounded-xl border border-white/10 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteQuickGen}
                disabled={isGenerating || quickGenQuantity < 1}
                className="flex-1 py-2.5 bg-emerald-400 hover:bg-emerald-300 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Zap className="w-4 h-4" />
                <span>Create {quickGenQuantity} Passes</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
