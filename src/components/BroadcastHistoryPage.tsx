import React, { useState, useEffect, useMemo } from 'react';
import { 
  History, 
  Mail, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Download, 
  Trash2, 
  Ticket, 
  ShieldCheck, 
  HeartHandshake, 
  User, 
  Copy, 
  Check, 
  Clock, 
  QrCode,
  X,
  ExternalLink,
  Eye
} from 'lucide-react';
import { EventItem, EmailDispatchHistoryItem, DispatchChannelType } from '../types';
import { 
  getDispatchHistory, 
  deleteDispatchHistoryItem, 
  deleteRecipientLog,
  clearAllDispatchHistory, 
  exportDispatchHistoryToCsv, 
  DISPATCH_HISTORY_UPDATED_EVENT 
} from '../utils/historyStorage';

interface BroadcastHistoryPageProps {
  events: EventItem[];
  selectedEventId?: string;
  onNavigateToTab?: (tab: string) => void;
}

export interface DispatchedEmailRow {
  rowId: string;
  batchId: string;
  type: DispatchChannelType;
  categoryTag: 'PASS' | 'RULES' | 'RECAP';
  categoryLabel: string;
  timestamp: string;
  formattedDate: string;
  formattedTime: string;
  attendeeName: string;
  email: string;
  status: 'sent' | 'failed';
  error?: string;
  code16?: string;
  formattedCode?: string;
  ticketCategory?: string;
  eventName: string;
  eventId?: string;
  subject: string;
  senderEmail: string;
  senderName: string;
}

export const BroadcastHistoryPage: React.FC<BroadcastHistoryPageProps> = ({
  events,
  selectedEventId
}) => {
  const [historyItems, setHistoryItems] = useState<EmailDispatchHistoryItem[]>(() => getDispatchHistory());
  const [searchTerm, setSearchTerm] = useState('');
  
  // Status / Category Filter: 'all' | 'pass_bomber' | 'rules_bomber' | 'thank_you'
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'pass_bomber' | 'rules_bomber' | 'thank_you'>('all');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'failed'>('all');
  
  // Inspection modal state
  const [inspectedBatch, setInspectedBatch] = useState<EmailDispatchHistoryItem | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'info'; text: string } | null>(null);

  // Sync with storage updates
  useEffect(() => {
    const handleUpdate = () => {
      setHistoryItems(getDispatchHistory());
    };

    window.addEventListener(DISPATCH_HISTORY_UPDATED_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener(DISPATCH_HISTORY_UPDATED_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Active Event IDs & Names (Only non-ended & active events)
  const activeEventsMap = useMemo(() => {
    const active = events.filter(e => e.status !== 'ended');
    const ids = new Set(active.map(e => e.id));
    const titles = new Set(active.map(e => e.title.toLowerCase().trim()));
    return { ids, titles, list: active };
  }, [events]);

  // Flatten all recipient entries into individual email log rows, sorted purely newest to oldest
  // If an event has ended or was deleted, its records are excluded from display
  const allEmailRows = useMemo<DispatchedEmailRow[]>(() => {
    const rows: DispatchedEmailRow[] = [];

    historyItems.forEach(batch => {
      // Check if event still exists and is active (not ended or deleted)
      const hasEventId = Boolean(batch.eventId);
      const isIdActive = hasEventId && activeEventsMap.ids.has(batch.eventId!);
      const isNameActive = batch.eventName && activeEventsMap.titles.has(batch.eventName.toLowerCase().trim());
      
      // Filter out emails for events that have ended or been deleted
      if (!isIdActive && !isNameActive && (hasEventId || events.length > 0)) {
        return;
      }

      const dateObj = new Date(batch.timestamp);
      const formattedDate = dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      const formattedTime = dateObj.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      let tag: 'PASS' | 'RULES' | 'RECAP' = 'PASS';
      let label = 'Pass';
      if (batch.type === 'rules_bomber') {
        tag = 'RULES';
        label = 'Rules';
      } else if (batch.type === 'thank_you') {
        tag = 'RECAP';
        label = 'Recap';
      }

      batch.recipients.forEach((rec, idx) => {
        rows.push({
          rowId: `${batch.id}-${rec.email}-${idx}`,
          batchId: batch.id,
          type: batch.type,
          categoryTag: tag,
          categoryLabel: label,
          timestamp: batch.timestamp,
          formattedDate,
          formattedTime,
          attendeeName: rec.attendeeName || 'Guest Attendee',
          email: rec.email,
          status: rec.status,
          error: rec.error,
          code16: rec.code16,
          formattedCode: rec.formattedCode,
          ticketCategory: rec.category,
          eventName: batch.eventName || 'Official Event',
          eventId: batch.eventId,
          subject: batch.subject,
          senderEmail: batch.senderEmail,
          senderName: batch.senderName
        });
      });
    });

    // Time-wise sort: latest sent email always occupies 1st position
    return rows.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [historyItems, activeEventsMap, events.length]);

  // Counts for each category
  const categoryCounts = useMemo(() => {
    let passCount = 0;
    let rulesCount = 0;
    let recapCount = 0;

    allEmailRows.forEach(row => {
      if (row.type === 'pass_bomber') passCount++;
      if (row.type === 'rules_bomber') rulesCount++;
      if (row.type === 'thank_you') recapCount++;
    });

    return {
      all: allEmailRows.length,
      pass: passCount,
      rules: rulesCount,
      recap: recapCount
    };
  }, [allEmailRows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return allEmailRows.filter(row => {
      // Category Filter (Pass, Rules, Recap, or All)
      if (categoryFilter !== 'all' && row.type !== categoryFilter) return false;

      // Event Filter
      if (eventFilter !== 'all') {
        const matchesId = row.eventId === eventFilter;
        const matchedEvt = events.find(e => e.id === eventFilter);
        const matchesName = matchedEvt && row.eventName.toLowerCase().includes(matchedEvt.title.toLowerCase());
        if (!matchesId && !matchesName) return false;
      }

      // Status Filter
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;

      // Search (Attendee Name, Gmail/Email, Subject, Event)
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = row.attendeeName.toLowerCase().includes(q);
        const matchesEmail = row.email.toLowerCase().includes(q);
        const matchesEvent = row.eventName.toLowerCase().includes(q);
        const matchesSubject = row.subject.toLowerCase().includes(q);
        const matchesCode = row.formattedCode && row.formattedCode.toLowerCase().includes(q);

        if (!matchesName && !matchesEmail && !matchesEvent && !matchesSubject && !matchesCode) {
          return false;
        }
      }

      return true;
    });
  }, [allEmailRows, categoryFilter, eventFilter, statusFilter, searchTerm, events]);

  const handleDeleteRow = (batchId: string, email: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Delete log record for ${email}?`)) {
      const updated = deleteRecipientLog(batchId, email);
      setHistoryItems(updated);
      setToastMessage({ type: 'info', text: `Removed log for ${email}` });
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all email broadcast history logs?')) {
      clearAllDispatchHistory();
      setHistoryItems([]);
      setToastMessage({ type: 'info', text: 'All broadcast history records cleared.' });
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleExportCsv = () => {
    const csvContent = exportDispatchHistoryToCsv(historyItems);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `passcraft_mail_history_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToastMessage({ type: 'success', text: `Exported ${allEmailRows.length} email records to CSV.` });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCopyGmail = (email: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setToastMessage({ type: 'success', text: `Copied ${email} to clipboard!` });
    setTimeout(() => {
      setCopiedEmail(null);
      setToastMessage(null);
    }, 2500);
  };

  const getCategoryBadgeStyle = (tag: 'PASS' | 'RULES' | 'RECAP') => {
    switch (tag) {
      case 'PASS':
        return {
          icon: <Ticket className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
          classes: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-950',
          label: 'Pass'
        };
      case 'RULES':
        return {
          icon: <ShieldCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />,
          classes: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40 shadow-sm shadow-indigo-950',
          label: 'Rules'
        };
      case 'RECAP':
        return {
          icon: <HeartHandshake className="w-3.5 h-3.5 text-rose-400 shrink-0" />,
          classes: 'bg-rose-500/15 text-rose-300 border-rose-500/40 shadow-sm shadow-rose-950',
          label: 'Recap'
        };
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* 1. TOP HEADER & EXPORT / CLEAR CONTROLS */}
      <div className="bg-neutral-900 border border-white/10 rounded-3xl p-6 md:p-7 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-xl">
                <History className="w-4 h-4" />
              </span>
              <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400">
                AUDIT & BROADCAST LOGS
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight mt-1 flex items-center gap-2">
              EMAIL DISPATCH <span className="text-emerald-400">HISTORY</span>
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Live chronological log of all emails sent across Pass Bomber, Rules Bomber, and Recap pages.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={allEmailRows.length === 0}
              className="px-3.5 py-2 bg-neutral-950 hover:bg-neutral-800 border border-white/15 text-neutral-200 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              Export CSV
            </button>
            {allEmailRows.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="px-3.5 py-2 bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. CATEGORY STATUS OPTION TABS (Pass, Rules, Recap, All)                  */}
        {/* ========================================================================= */}
        <div className="pt-6 border-t border-white/10 mt-5">
          <div className="text-[10px] font-black uppercase tracking-wider text-neutral-400 mb-2.5 flex items-center gap-1.5">
            <span>Filter by Category:</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            
            {/* All Option */}
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                categoryFilter === 'all'
                  ? 'bg-white text-black border-white shadow-lg shadow-white/10 font-black'
                  : 'bg-neutral-950/90 text-neutral-400 hover:text-white border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-2">
                <Mail className={`w-4 h-4 ${categoryFilter === 'all' ? 'text-black' : 'text-emerald-400'}`} />
                <span className="text-xs uppercase font-bold">All Emails</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${
                categoryFilter === 'all' ? 'bg-black text-white font-bold' : 'bg-white/10 text-neutral-300'
              }`}>
                {categoryCounts.all}
              </span>
            </button>

            {/* Pass Option */}
            <button
              type="button"
              onClick={() => setCategoryFilter('pass_bomber')}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                categoryFilter === 'pass_bomber'
                  ? 'bg-emerald-400 text-black border-emerald-400 shadow-lg shadow-emerald-400/20 font-black'
                  : 'bg-neutral-950/90 text-neutral-400 hover:text-white border-white/10 hover:border-emerald-500/40'
              }`}
            >
              <div className="flex items-center gap-2">
                <Ticket className={`w-4 h-4 ${categoryFilter === 'pass_bomber' ? 'text-black' : 'text-emerald-400'}`} />
                <span className="text-xs uppercase font-bold">Pass</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${
                categoryFilter === 'pass_bomber' ? 'bg-black text-emerald-400 font-bold' : 'bg-emerald-500/20 text-emerald-300'
              }`}>
                {categoryCounts.pass}
              </span>
            </button>

            {/* Rules Option */}
            <button
              type="button"
              onClick={() => setCategoryFilter('rules_bomber')}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                categoryFilter === 'rules_bomber'
                  ? 'bg-indigo-400 text-black border-indigo-400 shadow-lg shadow-indigo-400/20 font-black'
                  : 'bg-neutral-950/90 text-neutral-400 hover:text-white border-white/10 hover:border-indigo-500/40'
              }`}
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className={`w-4 h-4 ${categoryFilter === 'rules_bomber' ? 'text-black' : 'text-indigo-400'}`} />
                <span className="text-xs uppercase font-bold">Rules</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${
                categoryFilter === 'rules_bomber' ? 'bg-black text-indigo-400 font-bold' : 'bg-indigo-500/20 text-indigo-300'
              }`}>
                {categoryCounts.rules}
              </span>
            </button>

            {/* Recap Option */}
            <button
              type="button"
              onClick={() => setCategoryFilter('thank_you')}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                categoryFilter === 'thank_you'
                  ? 'bg-rose-400 text-black border-rose-400 shadow-lg shadow-rose-400/20 font-black'
                  : 'bg-neutral-950/90 text-neutral-400 hover:text-white border-white/10 hover:border-rose-500/40'
              }`}
            >
              <div className="flex items-center gap-2">
                <HeartHandshake className={`w-4 h-4 ${categoryFilter === 'thank_you' ? 'text-black' : 'text-rose-400'}`} />
                <span className="text-xs uppercase font-bold">Recap</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${
                categoryFilter === 'thank_you' ? 'bg-black text-rose-400 font-bold' : 'bg-rose-500/20 text-rose-300'
              }`}>
                {categoryCounts.recap}
              </span>
            </button>

          </div>
        </div>

      </div>

      {/* Toast Alert */}
      {toastMessage && (
        <div className={`p-3.5 rounded-2xl flex items-center justify-between border text-xs font-bold animate-fadeIn ${
          toastMessage.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300' : 'bg-neutral-950 border-white/20 text-neutral-200'
        }`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage.text}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-neutral-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 3. SEARCH & EVENT FILTER BAR */}
      <div className="bg-neutral-900 border border-white/10 p-4 rounded-2xl flex flex-col sm:flex-row gap-3 items-center justify-between shadow-xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by name, gmail, event..."
            className="w-full bg-neutral-950 border border-white/15 focus:border-emerald-400 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder:text-neutral-500 outline-none transition-colors"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-2.5 text-neutral-400 hover:text-white">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <select
            value={eventFilter}
            onChange={e => setEventFilter(e.target.value)}
            className="bg-neutral-950 border border-white/15 focus:border-emerald-400 rounded-xl px-3 py-2 text-xs text-white outline-none font-bold cursor-pointer"
          >
            <option value="all">🏢 All Events</option>
            {events.map(ev => (
              <option key={ev.id} value={ev.id}>
                {ev.title}
              </option>
            ))}
          </select>

          <div className="text-[11px] text-neutral-400 font-mono shrink-0">
            Showing <strong className="text-emerald-400">{filteredRows.length}</strong> record(s)
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. DISPATCHED LIST: CATEGORY | TIME & DATE | NAME | GMAIL                */}
      {/* ========================================================================= */}
      {filteredRows.length === 0 ? (
        <div className="p-8 text-center bg-neutral-900/40 border border-white/5 rounded-2xl">
          <p className="text-xs text-neutral-500 font-mono">
            No dispatched email records found matching current filter.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredRows.map(row => {
            const badge = getCategoryBadgeStyle(row.categoryTag);

            return (
              <div
                key={row.rowId}
                className="bg-neutral-900 hover:bg-neutral-900/90 border border-white/10 hover:border-emerald-500/40 rounded-2xl p-4 transition-all shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-3 group"
              >
                {/* Left Section: Category + Time/Date + Name + Gmail */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 md:gap-5 min-w-0 flex-1">
                  
                  {/* Category Pill + Time & Date Beside It */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className={`px-2.5 py-1 rounded-lg border text-[11px] font-black uppercase flex items-center gap-1.5 ${badge.classes}`}>
                      {badge.icon}
                      <span>{badge.label}</span>
                    </span>

                    <span className="text-[11px] font-mono text-neutral-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-neutral-500" />
                      <span>{row.formattedDate}</span>
                      <span className="text-neutral-600">•</span>
                      <span className="text-neutral-300">{row.formattedTime}</span>
                    </span>
                  </div>

                  {/* Name */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <User className="w-3.5 h-3.5 text-neutral-500" />
                    <span className="text-xs font-black text-white tracking-wide">
                      {row.attendeeName}
                    </span>
                    {row.ticketCategory && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-neutral-300">
                        {row.ticketCategory}
                      </span>
                    )}
                  </div>

                  {/* Gmail Address */}
                  <div className="flex items-center gap-1.5 text-neutral-300 text-xs font-mono truncate">
                    <Mail className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate text-emerald-300 font-bold">{row.email}</span>
                  </div>

                </div>

                {/* Right Section: Event Name, Status & Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-2.5 pt-2 lg:pt-0 border-t lg:border-t-0 border-white/5 shrink-0">
                  
                  <span className="text-[11px] text-neutral-400 font-mono truncate max-w-[180px] hidden xl:inline" title={row.eventName}>
                    🏢 {row.eventName}
                  </span>

                  {/* Delivery Status */}
                  <div className="flex items-center gap-1">
                    {row.status === 'sent' ? (
                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 rounded-md text-[10px] font-bold font-mono flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> SENT
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/25 rounded-md text-[10px] font-bold font-mono flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> FAILED
                      </span>
                    )}
                  </div>

                  {/* Copy Gmail */}
                  <button
                    type="button"
                    onClick={(e) => handleCopyGmail(row.email, e)}
                    title="Copy Gmail Address"
                    className="p-1.5 bg-white/5 hover:bg-white/15 border border-white/10 text-neutral-300 hover:text-white rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    {copiedEmail === row.email ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>

                  {/* View Details / Batch Inspector */}
                  <button
                    type="button"
                    onClick={() => {
                      const matched = historyItems.find(h => h.id === row.batchId);
                      if (matched) setInspectedBatch(matched);
                    }}
                    title="View Batch Details"
                    className="p-1.5 bg-white/5 hover:bg-white/15 border border-white/10 text-neutral-300 hover:text-white rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete Record */}
                  <button
                    type="button"
                    onClick={(e) => handleDeleteRow(row.batchId, row.email, e)}
                    title="Delete log record"
                    className="p-1.5 hover:bg-red-950/50 text-neutral-500 hover:text-red-400 rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MODAL: DETAILED BATCH INSPECTION & AUDIT                               */}
      {/* ========================================================================= */}
      {inspectedBatch && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-neutral-900 border border-white/20 rounded-3xl max-w-2xl w-full p-6 md:p-7 shadow-2xl space-y-5 relative my-8">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-white/10">
              <div>
                <span className={`px-2.5 py-0.5 rounded-lg border text-[10px] font-black uppercase ${
                  inspectedBatch.type === 'pass_bomber'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : inspectedBatch.type === 'rules_bomber'
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                }`}>
                  {inspectedBatch.sourceLabel}
                </span>
                <h3 className="text-lg font-black text-white uppercase mt-1">
                  {inspectedBatch.subject}
                </h3>
                <div className="text-xs text-neutral-400 mt-1 flex items-center gap-2">
                  <span>🏢 {inspectedBatch.eventName}</span>
                  <span>•</span>
                  <span>📅 {new Date(inspectedBatch.timestamp).toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={() => setInspectedBatch(null)}
                className="w-8 h-8 rounded-full bg-neutral-950 border border-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sender & Stats Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-neutral-950 p-4 rounded-2xl border border-white/10">
              <div>
                <div className="text-[10px] uppercase text-neutral-500 font-mono">Dispatched By</div>
                <div className="font-bold text-white">{inspectedBatch.senderName}</div>
                <div className="text-[11px] text-neutral-400 font-mono">{inspectedBatch.senderEmail}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-neutral-500 font-mono">Delivery Outcome</div>
                <div className="font-bold text-emerald-400 font-mono text-sm">
                  {inspectedBatch.sentCount} / {inspectedBatch.totalRecipients} Delivered
                </div>
                <div className="text-[10px] text-neutral-400">
                  {inspectedBatch.failedCount === 0 ? '100% Successful Delivery' : `${inspectedBatch.failedCount} Failed`}
                </div>
              </div>
            </div>

            {/* Recipients in Batch */}
            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase text-neutral-300">
                Recipients Dispatched ({inspectedBatch.recipients.length})
              </h4>
              <div className="max-h-56 overflow-y-auto border border-white/10 rounded-2xl bg-neutral-950 divide-y divide-white/5">
                {inspectedBatch.recipients.map((rec, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>{rec.attendeeName}</span>
                        {rec.category && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-neutral-300">
                            {rec.category}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-emerald-400 font-mono">{rec.email}</div>
                      {rec.formattedCode && (
                        <div className="text-[10px] text-neutral-400 font-mono flex items-center gap-1">
                          <QrCode className="w-3 h-3 text-emerald-400" /> Pass: {rec.formattedCode}
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded text-[10px] font-bold">
                        SENT
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setInspectedBatch(null)}
                className="px-4 py-2 bg-white text-black font-black text-xs uppercase rounded-xl hover:bg-neutral-200 transition-colors cursor-pointer"
              >
                Close Details
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
