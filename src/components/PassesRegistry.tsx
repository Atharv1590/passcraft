import React, { useState } from 'react';
import { PassItem, EventItem } from '../types';
import { AssignedPasses } from './AssignedPasses';
import { UnassignedQueue } from './UnassignedQueue';
import { GoogleSheetsSync } from './GoogleSheetsSync';
import { Users, ListCheck, Ticket, Sparkles, FileSpreadsheet } from 'lucide-react';

interface PassesRegistryProps {
  passes: PassItem[];
  events: EventItem[];
  defaultSubTab?: 'assigned' | 'unassigned' | 'sheets_sync';
  selectedEventId?: string;
  onToggleCheckIn: (pass: PassItem) => void;
  onNavigateToDocsHub: () => void;
  onAssignClick: (pass: PassItem) => void;
  onNavigateToGenerator: () => void;
  onNavigateToScanner: () => void;
  onDeletePass?: (passId: string) => void;
  onDeleteAllUnassignedPasses?: () => void;
}

export const PassesRegistry: React.FC<PassesRegistryProps> = ({
  passes,
  events,
  defaultSubTab = 'assigned',
  selectedEventId = 'all',
  onToggleCheckIn,
  onNavigateToDocsHub,
  onAssignClick,
  onNavigateToGenerator,
  onNavigateToScanner,
  onDeletePass,
  onDeleteAllUnassignedPasses,
}) => {
  const [subTab, setSubTab] = useState<'assigned' | 'unassigned' | 'sheets_sync'>(defaultSubTab);

  const assignedPasses = passes.filter(p => p.status === 'assigned' || p.status === 'checked_in');
  const unassignedPasses = passes.filter(p => p.status === 'unassigned');

  return (
    <div className="max-w-7xl mx-auto space-y-6 py-8 px-4 animate-fadeIn">
      {/* Top Combined Passes Navigation Header */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold uppercase tracking-wider rounded-full flex items-center gap-1.5">
              <Ticket className="w-3.5 h-3.5" /> Unified Pass Registry
            </span>
            <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider rounded-full flex items-center gap-1">
              <FileSpreadsheet className="w-3 h-3" /> Sheets AI Connected
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            All Passes <span className="text-indigo-400">Database</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Switch between Assigned Passes, Unassigned Inventory, or Connect to your Google Sheet with AI sync. Total: {passes.length} Passes.
          </p>
        </div>

        {/* Sub-Tab Switcher Toggle */}
        <div className="bg-slate-950 p-1.5 border border-slate-800 rounded-xl flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => setSubTab('assigned')}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              subTab === 'assigned'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            Assigned ({assignedPasses.length})
          </button>

          <button
            onClick={() => setSubTab('unassigned')}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              subTab === 'unassigned'
                ? 'bg-slate-800 text-white border border-slate-700'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <ListCheck className="w-4 h-4" />
            Queue ({unassignedPasses.length})
          </button>

          <button
            onClick={() => setSubTab('sheets_sync')}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
              subTab === 'sheets_sync'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-emerald-400 hover:text-white hover:bg-slate-900 border border-emerald-500/20'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Google Sheet (AI)</span>
          </button>
        </div>
      </div>

      {/* Render Active View */}
      {subTab === 'assigned' ? (
        <AssignedPasses
          passes={passes}
          events={events}
          onToggleCheckIn={onToggleCheckIn}
          onNavigateToDocsHub={onNavigateToDocsHub}
        />
      ) : subTab === 'unassigned' ? (
        <UnassignedQueue
          passes={passes}
          onAssignClick={onAssignClick}
          onNavigateToGenerator={onNavigateToGenerator}
          onNavigateToScanner={onNavigateToScanner}
          onDeletePass={onDeletePass}
          onDeleteAllUnassignedPasses={onDeleteAllUnassignedPasses}
        />
      ) : (
        <GoogleSheetsSync
          passes={passes}
          events={events}
          selectedEventId={selectedEventId}
        />
      )}
    </div>
  );
};
