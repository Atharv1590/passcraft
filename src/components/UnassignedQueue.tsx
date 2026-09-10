import React, { useState } from 'react';
import { PassItem } from '../types';
import { PassBadgeCard } from './PassBadgeCard';
import { 
  ListCheck, 
  PlusCircle, 
  ScanLine, 
  Search, 
  UserCheck, 
  Trash2, 
  AlertTriangle,
  QrCode,
  Copy,
  Check
} from 'lucide-react';

interface UnassignedQueueProps {
  passes: PassItem[];
  onAssignClick: (pass: PassItem) => void;
  onNavigateToGenerator: () => void;
  onNavigateToScanner: () => void;
  onDeletePass?: (passId: string) => void;
  onDeleteAllUnassignedPasses?: () => void;
}

export const UnassignedQueue: React.FC<UnassignedQueueProps> = ({
  passes,
  onAssignClick,
  onNavigateToGenerator,
  onNavigateToScanner,
  onDeletePass,
  onDeleteAllUnassignedPasses,
}) => {
  const unassignedPasses = passes.filter(p => p.status === 'unassigned');
  const [searchTerm, setSearchTerm] = useState('');
  const [isPurgeConfirmOpen, setIsPurgeConfirmOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = unassignedPasses.filter(p => 
    !searchTerm || 
    p.formattedCode.includes(searchTerm) || 
    p.code16.includes(searchTerm) ||
    p.eventName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.category && p.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePurgeAll = () => {
    if (onDeleteAllUnassignedPasses) {
      onDeleteAllUnassignedPasses();
    }
    setIsPurgeConfirmOpen(false);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 py-6 px-4">
      
      {/* Banner */}
      <div className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-3xl text-white flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1 block">
            Unassigned Pass Inventory ({unassignedPasses.length} Ready)
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Unassigned <span className="text-amber-400">Passes</span>
          </h2>
          <p className="text-xs text-slate-400 max-w-xl mt-1">
            Pre-generated 16-digit QR passes waiting for attendee assignment. Scan QR code or search code to bind guest identity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0 w-full md:w-auto">
          {unassignedPasses.length > 0 && onDeleteAllUnassignedPasses && (
            <button
              onClick={() => setIsPurgeConfirmOpen(true)}
              className="px-4 py-3 bg-rose-500/10 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/20 font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              title="Delete all unassigned passes from system"
            >
              <Trash2 className="w-4 h-4" />
              Delete All ({unassignedPasses.length})
            </button>
          )}

          <button
            onClick={onNavigateToScanner}
            className="flex-1 md:flex-none px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-600/30"
          >
            <ScanLine className="w-4 h-4" />
            Scan QR to Assign
          </button>

          <button
            onClick={onNavigateToGenerator}
            className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider rounded-xl border border-slate-700 flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            Batch Generate
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Purging All Unassigned Passes */}
      {isPurgeConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 max-w-md w-full p-6 space-y-6 text-white shadow-2xl rounded-3xl animate-fadeIn">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-8 h-8 shrink-0" />
              <div>
                <h3 className="text-lg font-bold">Purge Unassigned Queue?</h3>
                <p className="text-[10px] font-mono text-slate-400">Permanent Action</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This will permanently delete all <span className="text-rose-400 font-mono font-bold">{unassignedPasses.length} unassigned passes</span>. Assigned passes will NOT be affected.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsPurgeConfirmOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handlePurgeAll}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors cursor-pointer shadow-md shadow-rose-600/30"
              >
                Delete All Passes Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search Bar & Toolbar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search 16-digit code, ticket tier, or event..."
            className="w-full bg-slate-950 border border-slate-700/80 pl-11 pr-4 py-2.5 rounded-xl font-medium text-xs text-white focus:border-indigo-500 outline-none transition-colors"
          />
        </div>
        <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-3 py-2 border border-indigo-500/20 rounded-xl">
          Showing {filtered.length} of {unassignedPasses.length} Unassigned Passes
        </div>
      </div>

      {/* Grid displaying Unassigned Passes */}
      {filtered.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 p-12 text-center space-y-4 rounded-3xl shadow-xl">
          <div className="w-16 h-16 bg-slate-950 text-amber-400 flex items-center justify-center mx-auto rounded-2xl border border-slate-800">
            <ListCheck className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white">No Unassigned Passes Found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            All passes have been assigned or no unassigned passes match your search query!
          </p>
          <button
            onClick={onNavigateToGenerator}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer shadow-md shadow-indigo-600/30"
          >
            Generate Pass Batch
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(pass => (
            <div key={pass.id} className="relative group">
              {/* Card wrapper with PassBadgeCard */}
              <PassBadgeCard
                pass={pass}
                onAssignClick={onAssignClick}
              />
              
              {/* Quick Delete Single Ticket Button overlay */}
              {onDeletePass && (
                <button
                  onClick={() => onDeletePass(pass.id)}
                  title="Delete this unassigned pass ticket"
                  className="absolute top-3 right-3 z-20 p-2 bg-slate-950/90 hover:bg-rose-600 text-slate-400 hover:text-white border border-slate-800 hover:border-rose-500 rounded-xl transition-all shadow-xl cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  );
};
