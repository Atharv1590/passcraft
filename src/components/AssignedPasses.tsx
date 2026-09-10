import React, { useState } from 'react';
import { PassItem, EventItem } from '../types';
import { generateCanvaCSV } from '../lib/passUtils';
import { PassBadgeCard } from './PassBadgeCard';
import { 
  Users, 
  Search, 
  Palette, 
  Printer, 
  CheckCircle, 
  Download, 
  Filter, 
  LayoutGrid, 
  List, 
  Sparkles,
  ArrowRight,
  UserX,
  FileSpreadsheet
} from 'lucide-react';

interface AssignedPassesProps {
  passes: PassItem[];
  events: EventItem[];
  onToggleCheckIn: (pass: PassItem) => void;
  onNavigateToDocsHub: () => void;
}

export const AssignedPasses: React.FC<AssignedPassesProps> = ({
  passes,
  events,
  onToggleCheckIn,
  onNavigateToDocsHub,
}) => {
  // Sort assigned passes so the most recently assigned person appears FIRST (index 0 / 1st position)
  const assignedPasses = passes
    .filter(p => p.status === 'assigned' || p.status === 'checked_in')
    .sort((a, b) => {
      const timeA = a.assignedTo?.assignedAt ? new Date(a.assignedTo.assignedAt).getTime() : 0;
      const timeB = b.assignedTo?.assignedAt ? new Date(b.assignedTo.assignedAt).getTime() : 0;
      if (timeA !== timeB) return timeB - timeA;
      return b.id.localeCompare(a.id);
    });

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEventFilter, setSelectedEventFilter] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Multi-Selection State
  const [selectedPassIds, setSelectedPassIds] = useState<Set<string>>(new Set());

  // Filtered Passes
  const filteredPasses = assignedPasses.filter(pass => {
    const matchesSearch = 
      !searchTerm ||
      pass.assignedTo?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pass.formattedCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pass.code16.includes(searchTerm) ||
      (pass.assignedTo?.email && pass.assignedTo.email.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesEvent = selectedEventFilter === 'all' || pass.eventId === selectedEventFilter;
    const matchesCategory = selectedCategoryFilter === 'all' || pass.category === selectedCategoryFilter;

    return matchesSearch && matchesEvent && matchesCategory;
  });

  // Toggle selection
  const togglePassSelection = (id: string) => {
    const next = new Set(selectedPassIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedPassIds(next);
  };

  const selectAll = () => {
    if (selectedPassIds.size === filteredPasses.length) {
      setSelectedPassIds(new Set());
    } else {
      setSelectedPassIds(new Set(filteredPasses.map(p => p.id)));
    }
  };

  // Export Selected to Canva CSV
  const handleExportSelectedToCanva = () => {
    const targetPasses = selectedPassIds.size > 0 
      ? assignedPasses.filter(p => selectedPassIds.has(p.id))
      : filteredPasses;

    const csvContent = generateCanvaCSV(targetPasses);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Canva_Bulk_Create_Passes_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    onNavigateToDocsHub();
  };

  // Print Batch Layout
  const handlePrintSelected = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 py-6 px-4">
      
      {/* Sleek Compact Header Banner */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block mb-1">
            Delegate Directory ({assignedPasses.length} Active Passes)
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Assigned <span className="text-indigo-400">Passes</span>
          </h2>
        </div>

        <div className="bg-indigo-500/10 border border-indigo-500/20 px-3.5 py-1.5 rounded-xl text-indigo-300 text-xs font-semibold uppercase">
          {assignedPasses.length} Registered Delegates
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3 shadow-lg">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Search Box */}
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search attendee name, code..."
              className="w-full bg-slate-950 border border-slate-700/80 pl-10 pr-4 py-2.5 rounded-xl font-medium text-xs text-white focus:border-indigo-500 outline-none transition-colors"
            />
          </div>

          {/* Event & Tier Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              <Filter className="w-3.5 h-3.5 text-indigo-400" />
              Filter:
            </div>

            <select
              value={selectedEventFilter}
              onChange={e => setSelectedEventFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700/80 px-3 py-2 rounded-xl text-xs text-white outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">All Events ({events.length})</option>
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>{ev.title}</option>
              ))}
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-950 border border-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30' : 'text-slate-400 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'list' ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30' : 'text-slate-400 hover:text-white'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Main Assigned Passes Listing */}
      {filteredPasses.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 p-12 text-center space-y-4 rounded-3xl shadow-xl">
          <div className="w-16 h-16 bg-slate-950 text-indigo-400 flex items-center justify-center mx-auto rounded-2xl border border-slate-800">
            <UserX className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white">No Assigned Passes Found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            {assignedPasses.length === 0
              ? 'You have not assigned names to any passes yet. Go to the Scan & Assign Pass console to bind names to blank 16-digit passes!'
              : 'No assigned passes match your current search or filter criteria.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPasses.map(pass => (
            <div key={pass.id}>
              <PassBadgeCard
                pass={pass}
                onToggleCheckIn={onToggleCheckIn}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPasses.map(pass => (
            <div key={pass.id}>
              <PassBadgeCard
                pass={pass}
                onToggleCheckIn={onToggleCheckIn}
                compact={true}
              />
            </div>
          ))}
        </div>
      )}

    </div>
  );
};
