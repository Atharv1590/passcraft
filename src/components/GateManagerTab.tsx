import React, { useState } from 'react';
import { EventItem, EventGateConfig } from '../types';
import { getEventGates } from '../lib/passUtils';
import { 
  ShieldCheck, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  ArrowRight, 
  Sparkles, 
  Info, 
  Lock, 
  Layers, 
  MoveRight,
  RotateCcw,
  CheckCircle2
} from 'lucide-react';

interface GateManagerTabProps {
  currentEvent: EventItem;
  events: EventItem[];
  selectedEventId: string;
  onSelectEvent: (eventId: string) => void;
  onUpdateEvent: (updatedEvent: EventItem) => void;
}

export const GateManagerTab: React.FC<GateManagerTabProps> = ({
  currentEvent,
  events,
  selectedEventId,
  onSelectEvent,
  onUpdateEvent,
}) => {
  const currentGates = getEventGates(currentEvent);
  const [gates, setGates] = useState<EventGateConfig[]>(currentGates);
  const [editingGateId, setEditingGateId] = useState<string | null>(null);
  
  // Edit Form State
  const [nameInput, setNameInput] = useState('');
  const [codeNameInput, setCodeNameInput] = useState('G1');
  const [descInput, setDescInput] = useState('');
  const [colorInput, setColorInput] = useState('#10b981');
  const [selectedCats, setSelectedCats] = useState<string[]>(['all']);
  const [isCheckpoint, setIsCheckpoint] = useState(true);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Available categories strictly for this event's defined ticket tiers
  const eventTiers = (currentEvent.ticketTiers || []).map(t => t.categoryName).filter(Boolean);
  const allCategoryOptions = eventTiers.length > 0 
    ? Array.from(new Set(eventTiers))
    : [currentEvent.category || 'General'];

  // Start Editing a gate
  const handleStartEdit = (gate: EventGateConfig) => {
    setEditingGateId(gate.id);
    setNameInput(gate.name);
    setCodeNameInput(gate.code || 'G1');
    setDescInput(gate.description || '');
    setColorInput(gate.color || '#10b981');
    setSelectedCats(gate.allowedCategories || ['all']);
    setIsCheckpoint(gate.isCheckpoint ?? true);
  };

  // Save current gate edits
  const handleSaveGateEdit = () => {
    if (!nameInput.trim()) return;

    const updatedList = gates.map(g => {
      if (g.id === editingGateId) {
        return {
          ...g,
          name: nameInput.trim(),
          code: codeNameInput.trim() || 'G1',
          description: descInput.trim(),
          color: colorInput,
          allowedCategories: selectedCats.length === 0 ? ['all'] : selectedCats,
          isCheckpoint: isCheckpoint,
        };
      }
      return g;
    });

    setGates(updatedList);
    saveGatesToEvent(updatedList);
    setEditingGateId(null);
  };

  // Add new Gate
  const handleAddNewGate = () => {
    const nextNum = gates.length + 1;
    const newGate: EventGateConfig = {
      id: `gate-${currentEvent.id}-${Date.now()}`,
      name: `Gate ${nextNum} - Inner Section`,
      code: `G${nextNum}`,
      description: `Checkpoint ${nextNum} for attendee verification`,
      allowedCategories: ['all'],
      color: nextNum === 2 ? '#f59e0b' : nextNum === 3 ? '#ec4899' : '#6366f1',
      order: nextNum,
      isCheckpoint: true,
    };

    const updatedList = [...gates, newGate];
    setGates(updatedList);
    saveGatesToEvent(updatedList);
    handleStartEdit(newGate);
  };

  // Delete a gate
  const handleDeleteGate = (gateId: string) => {
    if (gates.length <= 1) {
      alert('Event must have at least 1 entry gate.');
      return;
    }
    const updatedList = gates.filter(g => g.id !== gateId);
    setGates(updatedList);
    saveGatesToEvent(updatedList);
    if (editingGateId === gateId) {
      setEditingGateId(null);
    }
  };

  // Save gates to current event
  const saveGatesToEvent = (updatedGates: EventGateConfig[]) => {
    const updatedEvent: EventItem = {
      ...currentEvent,
      gates: updatedGates,
    };
    onUpdateEvent(updatedEvent);
    setSaveSuccessMsg('Gate configuration saved for this event!');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // Apply Preset 1: Single Gate (Standard)
  const applyPresetSingleGate = () => {
    const preset: EventGateConfig[] = [
      {
        id: `gate-${currentEvent.id}-1`,
        name: 'Gate 1 - Main Entrance (All Passes)',
        code: 'G1',
        description: 'Single universal entry point for all ticket categories',
        allowedCategories: ['all'],
        color: '#10b981',
        order: 1,
        isCheckpoint: false,
      }
    ];
    setGates(preset);
    saveGatesToEvent(preset);
  };

  // Apply Preset 2: 2-Tiered Festival Gate (Silver Outer -> Gold/VIP Barricade)
  const applyPresetTwoTier = () => {
    const preset: EventGateConfig[] = [
      {
        id: `gate-${currentEvent.id}-1`,
        name: 'Gate 1 - Outer Perimeter (All Passes)',
        code: 'G1',
        description: 'Outer perimeter turnstile. All pass holders get admitted to general festival grounds.',
        allowedCategories: ['all'],
        color: '#10b981',
        order: 1,
        isCheckpoint: true,
      },
      {
        id: `gate-${currentEvent.id}-2`,
        name: 'Gate 2 - Gold & VIP Barricade',
        code: 'G2',
        description: 'Inner arena checkpoint. Scanned again to enter Gold & VIP zones.',
        allowedCategories: ['Gold', 'VIP', 'VVIP', 'Speaker', 'Organizer'],
        color: '#f59e0b',
        order: 2,
        isCheckpoint: false,
        requiredPreviousGateId: `gate-${currentEvent.id}-1`
      }
    ];
    setGates(preset);
    saveGatesToEvent(preset);
  };

  // Apply Preset 3: 3-Tiered Progression (Silver Entry -> Gold Zone -> VIP Lounge)
  const applyPresetThreeTier = () => {
    const preset: EventGateConfig[] = [
      {
        id: `gate-${currentEvent.id}-1`,
        name: 'Gate 1 - Silver / Outer Entry',
        code: 'G1',
        description: 'Step 1: All attendees scan here to enter general perimeter.',
        allowedCategories: ['all'],
        color: '#10b981',
        order: 1,
        isCheckpoint: true,
      },
      {
        id: `gate-${currentEvent.id}-2`,
        name: 'Gate 2 - Gold Zone Barricade',
        code: 'G2',
        description: 'Step 2: Gold & VIP holders scan again here to enter Gold stage front.',
        allowedCategories: ['Gold', 'VIP', 'VVIP', 'Speaker', 'Organizer'],
        color: '#f59e0b',
        order: 2,
        isCheckpoint: true,
        requiredPreviousGateId: `gate-${currentEvent.id}-1`
      },
      {
        id: `gate-${currentEvent.id}-3`,
        name: 'Gate 3 - VIP Red Carpet & Lounge',
        code: 'G3',
        description: 'Step 3: Exclusive checkpoint for VIP / VVIP pass holders.',
        allowedCategories: ['VIP', 'VVIP', 'Speaker', 'Organizer'],
        color: '#ec4899',
        order: 3,
        isCheckpoint: false,
        requiredPreviousGateId: `gate-${currentEvent.id}-2`
      }
    ];
    setGates(preset);
    saveGatesToEvent(preset);
  };

  const toggleCategory = (cat: string) => {
    if (cat === 'all') {
      setSelectedCats(['all']);
      return;
    }
    let next = selectedCats.filter(c => c !== 'all');
    if (next.includes(cat)) {
      next = next.filter(c => c !== cat);
      if (next.length === 0) next = ['all'];
    } else {
      next.push(cat);
    }
    setSelectedCats(next);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Event Selector & Intro Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-black text-white">Event Gate Architecture &amp; Barricades</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configure multiple gates, security checkpoints, and pass tier restrictions for <span className="text-emerald-300 font-bold">{currentEvent.title}</span>.
          </p>
        </div>

        {/* Event Switcher */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Event:</label>
          <select
            value={currentEvent.id}
            onChange={(e) => onSelectEvent(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            {events.filter(e => e.status !== 'ended').map(ev => (
              <option key={ev.id} value={ev.id}>
                {ev.title} ({ev.date})
              </option>
            ))}
          </select>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="p-4 bg-emerald-950/60 border border-emerald-500/40 rounded-2xl text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {saveSuccessMsg}
        </div>
      )}

      {/* Quick 1-Click Presets */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" /> 1-Click Gate Architecture Presets:
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={applyPresetSingleGate}
            className="p-4 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-emerald-500/40 rounded-2xl text-left transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-white group-hover:text-emerald-400">1. Single Main Gate</span>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono font-bold">Default</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">1 Entry point where all ticket tiers are scanned and admitted once.</p>
          </button>

          <button
            type="button"
            onClick={applyPresetTwoTier}
            className="p-4 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/40 rounded-2xl text-left transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-white group-hover:text-amber-400">2. 2-Gate Festival</span>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-mono font-bold">Silver + Gold</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Gate 1 (Outer Perimeter) &rarr; Gate 2 (Gold/VIP Arena Barricade).</p>
          </button>

          <button
            type="button"
            onClick={applyPresetThreeTier}
            className="p-4 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-pink-500/40 rounded-2xl text-left transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-white group-hover:text-pink-400">3. 3-Gate VIP Tiering</span>
              <span className="text-[10px] bg-pink-500/20 text-pink-300 px-2 py-0.5 rounded font-mono font-bold">Full Flow</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Gate 1 (Silver Entry) &rarr; Gate 2 (Gold Zone) &rarr; Gate 3 (VIP Red Carpet).</p>
          </button>
        </div>
      </div>

      {/* Visual Gate Flow Pipeline */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Active Gate Checkpoint Pipeline ({gates.length} Gates)</h4>
          </div>
          <button
            type="button"
            onClick={handleAddNewGate}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Gate
          </button>
        </div>

        {/* Gate Visual Pipeline Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {gates.map((gate, index) => {
            const isEditing = editingGateId === gate.id;
            return (
              <div
                key={gate.id}
                className={`p-5 rounded-2xl border transition-all relative ${
                  isEditing 
                    ? 'bg-slate-850 border-emerald-500 shadow-lg shadow-emerald-500/10' 
                    : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Gate Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span 
                      className="w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black text-white shrink-0 shadow-md"
                      style={{ backgroundColor: gate.color || '#10b981' }}
                    >
                      {gate.code || `G${index + 1}`}
                    </span>
                    <div>
                      <h5 className="font-bold text-white text-sm leading-tight">{gate.name}</h5>
                      <span className="text-[10px] text-slate-400 font-mono">Order: Checkpoint #{index + 1}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(gate)}
                      className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-emerald-300 transition-colors cursor-pointer"
                      title="Edit gate settings"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    {gates.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteGate(gate.id)}
                        className="p-1.5 hover:bg-rose-950/60 rounded-lg text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Delete gate"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-400 mt-2.5 min-h-[32px]">
                  {gate.description || 'Verified attendee scanning checkpoint'}
                </p>

                {/* Allowed categories pills */}
                <div className="mt-3 pt-3 border-t border-slate-850 flex flex-wrap gap-1.5">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block w-full mb-1">
                    Allowed Tiers:
                  </span>
                  {gate.allowedCategories.includes('all') ? (
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-md">
                      ✅ All Ticket Categories
                    </span>
                  ) : (
                    gate.allowedCategories.map(cat => (
                      <span 
                        key={cat}
                        className="px-2 py-0.5 text-[10px] font-bold uppercase bg-slate-800 text-slate-200 border border-slate-700 rounded-md"
                      >
                        {cat}
                      </span>
                    ))
                  )}
                </div>

                {gate.isCheckpoint && (
                  <div className="mt-2.5 text-[10px] text-amber-400/90 font-mono flex items-center gap-1">
                    <Info className="w-3 h-3" /> Multi-Scan Checkpoint (Allows inner gate re-scan)
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Gate Form Modal / Inline Box */}
      {editingGateId && (
        <div className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 shadow-2xl space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-emerald-400" /> Edit Gate Configuration
            </h4>
            <button
              type="button"
              onClick={() => setEditingGateId(null)}
              className="text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">Gate Name</label>
              <input
                type="text"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                placeholder="e.g. Gate 2 - Gold Zone Barricade"
                className="w-full bg-slate-950 border border-slate-700 text-white text-xs px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">Gate Code / Badge Tag</label>
              <input
                type="text"
                value={codeNameInput}
                onChange={e => setCodeNameInput(e.target.value)}
                placeholder="e.g. G2 or GOLD-1"
                className="w-full bg-slate-950 border border-slate-700 text-white text-xs px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">Color Theme</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={colorInput}
                  onChange={e => setColorInput(e.target.value)}
                  className="w-10 h-9 bg-slate-950 border border-slate-700 rounded-xl cursor-pointer"
                />
                <input
                  type="text"
                  value={colorInput}
                  onChange={e => setColorInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white text-xs px-3.5 py-2.5 rounded-xl font-mono"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1">Description / Security Notice</label>
            <input
              type="text"
              value={descInput}
              onChange={e => setDescInput(e.target.value)}
              placeholder="e.g. Checkpoint for Gold & VIP section entry"
              className="w-full bg-slate-950 border border-slate-700 text-white text-xs px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Allowed Categories Toggle */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-2">
              Allowed Ticket Categories for this Gate:
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => toggleCategory('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer ${
                  selectedCats.includes('all')
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'bg-slate-950 border border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                ✅ All Ticket Categories
              </button>
              {allCategoryOptions.map(cat => {
                const isSelected = selectedCats.includes(cat) && !selectedCats.includes('all');
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                        : 'bg-slate-950 border border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Checkpoint Multi-Scan Option */}
          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isCheckpoint}
                onChange={e => setIsCheckpoint(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 bg-slate-950 border-slate-700 focus:ring-0 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-200">
                Barricade Checkpoint Mode (Allows attendee to scan at subsequent inner gates without being blocked)
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditingGateId(null)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold uppercase cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveGateEdit}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 cursor-pointer"
            >
              <Check className="w-4 h-4" /> Save Gate Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
