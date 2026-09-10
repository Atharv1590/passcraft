import React, { useState, useMemo, useEffect } from 'react';
import { FinancialEntry, PassItem, EventItem } from '../types';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  PieChart as PieChartIcon, 
  PlusCircle, 
  Trash2, 
  Receipt, 
  Ticket, 
  Calendar, 
  Tag, 
  Wallet, 
  Download,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  FileText,
  Printer,
  Copy,
  Check,
  X,
  Clock
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell, 
  Legend, 
  BarChart, 
  Bar 
} from 'recharts';

interface FinancialsPageProps {
  financials: FinancialEntry[];
  passes: PassItem[];
  events: EventItem[];
  setFinancials?: React.Dispatch<React.SetStateAction<FinancialEntry[]>>;
  onAddFinancial?: (entry: FinancialEntry) => void;
  onDeleteFinancial?: (id: string) => void;
  selectedEventId?: string;
  onSelectEvent?: (eventId: string) => void;
}

const EXPENSE_CATEGORIES = [
  'Venue & Hall Rental',
  'Audio / Visual & Stage',
  'Catering & Refreshments',
  'Printing & Badges',
  'Marketing & Advertising',
  'Staff & Security Payroll',
  'Transportation & Logistics',
  'Permits & Licenses',
  'Miscellaneous Expense'
];

const INCOME_CATEGORIES = [
  'Ticket Sales (Automatic & Manual)',
  'Corporate Sponsorship',
  'Merchandise Sales',
  'Exhibitor Booth Fees',
  'VIP Add-On Upgrades',
  'Grants & Donations',
  'Miscellaneous Income'
];

const COLORS = ['#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#a855f7'];

const STORAGE_FLAP_SELECTED_EVENTS_KEY = 'passcraft_flap_selected_events';

export const FinancialsPage: React.FC<FinancialsPageProps> = ({
  financials,
  passes,
  events,
  setFinancials,
  onAddFinancial,
  onDeleteFinancial,
  selectedEventId: propSelectedEventId = 'all',
  onSelectEvent: propOnSelectEvent
}) => {
  const activeEvents = useMemo(() => events.filter(e => e.status !== 'ended'), [events]);
  const activeEventIds = useMemo(() => new Set(activeEvents.map(e => e.id)), [activeEvents]);

  // Event Filter State (Supports multi-event selection or 'all') - Persisted across navigation
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_FLAP_SELECTED_EVENTS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (parsed.includes('all')) return ['all'];
          const validIds = parsed.filter(id => events.some(e => e.id === id && e.status !== 'ended'));
          if (validIds.length > 0) return validIds;
        }
      }
    } catch (e) {}
    return [propSelectedEventId || 'all'];
  });

  // Keep internal filter state synchronized if propSelectedEventId changes externally (e.g. from top header)
  useEffect(() => {
    if (propSelectedEventId) {
      if (propSelectedEventId === 'all') {
        setSelectedEventIds(['all']);
      } else if (events.some(e => e.id === propSelectedEventId)) {
        setSelectedEventIds([propSelectedEventId]);
      }
    }
  }, [propSelectedEventId, events]);

  const toggleEventSelection = (evtId: string) => {
    if (evtId === 'all') {
      const next = ['all'];
      setSelectedEventIds(next);
      try {
        localStorage.setItem(STORAGE_FLAP_SELECTED_EVENTS_KEY, JSON.stringify(next));
      } catch (e) {}
      return;
    }

    setSelectedEventIds(prev => {
      const filtered = prev.filter(id => id !== 'all');
      let next: string[];
      if (filtered.includes(evtId)) {
        next = filtered.filter(id => id !== evtId);
      } else {
        next = [...filtered, evtId];
      }
      if (next.length === 0) next = ['all'];
      try {
        localStorage.setItem(STORAGE_FLAP_SELECTED_EVENTS_KEY, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const isAllSelected = selectedEventIds.includes('all') || selectedEventIds.length === 0;

  // Selected event title label for reports
  const selectedEventsLabel = useMemo(() => {
    if (isAllSelected) return `All Live Events (${activeEvents.length})`;
    const matched = activeEvents.filter(e => selectedEventIds.includes(e.id));
    if (matched.length === 0) return 'All Live Events';
    if (matched.length === 1) return matched[0].title;
    return `${matched.length} Selected Events (${matched.map(e => e.title).join(', ')})`;
  }, [isAllSelected, activeEvents, selectedEventIds]);

  // Deleted Ticket Sales IDs local override state
  const [deletedTicketSaleIds, setDeletedTicketSaleIds] = useState<Set<string>>(() => new Set());

  // Form State
  const [entryType, setEntryType] = useState<'income' | 'expense'>('expense');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [vendorName, setVendorName] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  
  // Date and Time State
  const getCurrentDateTime = () => {
    const now = new Date();
    const d = now.toISOString().split('T')[0];
    const t = now.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
    return { date: d, time: t };
  };

  const [date, setDate] = useState(() => getCurrentDateTime().date);
  const [time, setTime] = useState(() => getCurrentDateTime().time);
  const [notes, setNotes] = useState('');

  // Filter State for Expenses list below
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExpenseCat, setSelectedExpenseCat] = useState('all');

  // Google Doc Report Modal State
  const [showDocModal, setShowDocModal] = useState(false);
  const [copiedDoc, setCopiedDoc] = useState(false);

  // Helper for adding financial entry
  const handleAdd = (entry: FinancialEntry) => {
    if (onAddFinancial) {
      onAddFinancial(entry);
    } else if (setFinancials) {
      setFinancials(prev => [entry, ...prev]);
    }
  };

  // Helper for deleting financial entry
  const handleDelete = (id: string) => {
    if (id.startsWith('ticket-sale-')) {
      setDeletedTicketSaleIds(prev => new Set(prev).add(id));
      return;
    }

    if (onDeleteFinancial) {
      onDeleteFinancial(id);
    } else if (setFinancials) {
      setFinancials(prev => prev.filter(item => item.id !== id));
    }
  };

  // Format Date and Time for table display
  const formatDateTimeDisplay = (rawDate: string, rawTime?: string) => {
    if (!rawDate) return '—';
    if (rawDate.includes('T')) {
      const dObj = new Date(rawDate);
      return dObj.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    }
    const timeStr = rawTime ? ` ${rawTime}` : '';
    return `${rawDate}${timeStr}`;
  };

  // Extract high-precision timestamp for sorting (most recently added appears 1st)
  const getEntryTimestamp = (entry: FinancialEntry): number => {
    if (entry.createdAt) {
      const t = new Date(entry.createdAt).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    const match = entry.id.match(/\b(?:fin|inc|exp|sale|ticket)-(\d{10,13})/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > 0) return num;
    }
    if (entry.date) {
      const combined = entry.time ? `${entry.date} ${entry.time}` : entry.date;
      const t = new Date(combined).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    return 0;
  };

  // Compute Ticket Sales Revenue from Assigned / Checked-In Passes (Only for Live Events when All is chosen)
  const ticketSalesEntries = useMemo<FinancialEntry[]>(() => {
    const assignedPasses = passes.filter(p => {
      const isAssigned = p.status === 'assigned' || p.status === 'checked_in';
      const hasPrice = p.ticketPrice && p.ticketPrice > 0;
      if (!isAssigned || !hasPrice) return false;

      if (!isAllSelected) {
        return p.eventId && selectedEventIds.includes(p.eventId);
      }
      // When ALL is selected, show only passes belonging to active/live events
      return !p.eventId || activeEventIds.has(p.eventId);
    });

    return assignedPasses
      .map(p => {
        const id = `ticket-sale-${p.id}`;
        const rawAssignedAt = p.assignedTo?.assignedAt || p.createdAt;
        const datePart = rawAssignedAt ? rawAssignedAt.split('T')[0] : new Date().toISOString().split('T')[0];
        const timePart = rawAssignedAt && rawAssignedAt.includes('T') ? rawAssignedAt.split('T')[1].substring(0, 5) : '12:00';

        return {
          id,
          type: 'income' as const,
          title: `Ticket Sale: ${p.assignedTo?.name || 'Assigned Guest'} (${p.category})`,
          amount: p.ticketPrice || 0,
          category: 'Ticket Sales',
          date: `${datePart} ${timePart}`,
          time: timePart,
          createdAt: rawAssignedAt || new Date().toISOString(),
          isAutomaticTicketSale: true,
          passId: p.id,
          eventId: p.eventId,
          notes: `Event: ${p.eventName} | Code: ${p.formattedCode}`
        };
      })
      .filter(entry => !deletedTicketSaleIds.has(entry.id));
  }, [passes, isAllSelected, selectedEventIds, activeEventIds, deletedTicketSaleIds]);

  // Combined Incomes & Expenses (Strict reverse-chronological order: newly added is 1st on top)
  const allIncomes = useMemo(() => {
    const selectedEventObjects = activeEvents.filter(e => selectedEventIds.includes(e.id));
    const selectedEventTitlesLower = selectedEventObjects.map(e => e.title.toLowerCase().trim());

    const manualIncomes = financials.filter(f => {
      if (f.type !== 'income') return false;
      // Filter out any legacy auto-credited entries so they never duplicate with live dynamic ticketSalesEntries
      if (f.notes && typeof f.notes === 'string' && f.notes.includes('Auto-credited upon pass assignment')) {
        return false;
      }
      if (!isAllSelected) {
        const matchesEventId = f.eventId && selectedEventIds.includes(f.eventId);
        const matchesTitleInNotes = f.notes && selectedEventTitlesLower.some(t => f.notes.toLowerCase().includes(t));
        const matchesTitleInTitle = f.title && selectedEventTitlesLower.some(t => f.title.toLowerCase().includes(t));
        return matchesEventId || matchesTitleInNotes || matchesTitleInTitle;
      }
      return !f.eventId || activeEventIds.has(f.eventId);
    });
    
    return [...ticketSalesEntries, ...manualIncomes].sort((a, b) => {
      const diff = getEntryTimestamp(b) - getEntryTimestamp(a);
      if (diff !== 0) return diff;
      return b.id.localeCompare(a.id);
    });
  }, [financials, ticketSalesEntries, isAllSelected, selectedEventIds, activeEvents, activeEventIds]);

  const allExpenses = useMemo(() => {
    const selectedEventObjects = activeEvents.filter(e => selectedEventIds.includes(e.id));
    const selectedEventTitlesLower = selectedEventObjects.map(e => e.title.toLowerCase().trim());

    return financials.filter(f => {
      if (f.type !== 'expense') return false;
      if (!isAllSelected) {
        const matchesEventId = f.eventId && selectedEventIds.includes(f.eventId);
        const matchesTitleInNotes = f.notes && selectedEventTitlesLower.some(t => f.notes.toLowerCase().includes(t));
        const matchesTitleInTitle = f.title && selectedEventTitlesLower.some(t => f.title.toLowerCase().includes(t));
        return matchesEventId || matchesTitleInNotes || matchesTitleInTitle;
      }
      return !f.eventId || activeEventIds.has(f.eventId);
    }).sort((a, b) => {
      const diff = getEntryTimestamp(b) - getEntryTimestamp(a);
      if (diff !== 0) return diff;
      return b.id.localeCompare(a.id);
    });
  }, [financials, isAllSelected, selectedEventIds, activeEvents, activeEventIds]);

  // Filtered Expenses for the list below
  const filteredExpenses = useMemo(() => {
    return allExpenses.filter(e => {
      const matchesSearch = 
        e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.notes && e.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
        e.category.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCat = selectedExpenseCat === 'all' || e.category === selectedExpenseCat;
      return matchesSearch && matchesCat;
    });
  }, [allExpenses, searchTerm, selectedExpenseCat]);

  // Totals
  const totalIncomeAmount = useMemo(() => {
    return allIncomes.reduce((sum, item) => sum + item.amount, 0);
  }, [allIncomes]);

  const totalExpenseAmount = useMemo(() => {
    return allExpenses.reduce((sum, item) => sum + item.amount, 0);
  }, [allExpenses]);

  const totalTicketRevenue = useMemo(() => {
    return ticketSalesEntries.reduce((sum, item) => sum + item.amount, 0);
  }, [ticketSalesEntries]);

  const netProfit = totalIncomeAmount - totalExpenseAmount;
  const profitMargin = totalIncomeAmount > 0 ? ((netProfit / totalIncomeAmount) * 100).toFixed(1) : '0';

  // Dynamic Chunking for Multi-Page PDF Reports
  const incomeChunks = useMemo(() => {
    const chunkSize = 15;
    const chunks: FinancialEntry[][] = [];
    if (allIncomes.length === 0) {
      chunks.push([]);
    } else {
      for (let i = 0; i < allIncomes.length; i += chunkSize) {
        chunks.push(allIncomes.slice(i, i + chunkSize));
      }
    }
    return chunks;
  }, [allIncomes]);

  const expenseChunks = useMemo(() => {
    const chunkSize = 15;
    const chunks: FinancialEntry[][] = [];
    if (allExpenses.length === 0) {
      chunks.push([]);
    } else {
      for (let i = 0; i < allExpenses.length; i += chunkSize) {
        chunks.push(allExpenses.slice(i, i + chunkSize));
      }
    }
    return chunks;
  }, [allExpenses]);

  const totalPdfPages = 1 + incomeChunks.length + expenseChunks.length;

  // Chart Data Preparation: Expenses Category Breakdown
  const expenseChartData = useMemo(() => {
    const catMap: Record<string, number> = {};
    allExpenses.forEach(e => {
      catMap[e.category] = (catMap[e.category] || 0) + e.amount;
    });
    return Object.entries(catMap).map(([name, value]) => ({ name, value }));
  }, [allExpenses]);

  // Income vs Expense Comparison Bar Data
  const financialSummaryChartData = useMemo(() => {
    return [
      { name: 'Total Revenue', amount: totalIncomeAmount, fill: '#6366f1' },
      { name: 'Ticket Sales', amount: totalTicketRevenue, fill: '#38bdf8' },
      { name: 'Expenses', amount: totalExpenseAmount, fill: '#f43f5e' },
      { name: 'Net Profit', amount: Math.max(0, netProfit), fill: '#10b981' }
    ];
  }, [totalIncomeAmount, totalTicketRevenue, totalExpenseAmount, netProfit]);

  // Handle Form Submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!title.trim() || isNaN(parsedAmount) || parsedAmount <= 0) return;

    const fullFormattedDate = time ? `${date} ${time}` : date;

    const newEntry: FinancialEntry = {
      id: `fin-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type: entryType,
      title: title.trim(),
      amount: parsedAmount,
      category,
      date: fullFormattedDate,
      time: time || '12:00',
      createdAt: new Date().toISOString(),
      notes: notes.trim(),
      vendorName: entryType === 'expense' ? vendorName.trim() || undefined : undefined,
      vendorPhone: entryType === 'expense' ? vendorPhone.trim() || undefined : undefined,
      eventId: !isAllSelected && selectedEventIds.length === 1 ? selectedEventIds[0] : undefined,
    };

    handleAdd(newEntry);

    // Reset Form
    setTitle('');
    setAmount('');
    setNotes('');
    setVendorName('');
    setVendorPhone('');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 py-8 px-4 animate-fadeIn">
      
      {/* Top Banner & Overview Metrics */}
      <div className="bg-slate-900 border border-slate-800 p-6 md:p-8 rounded-3xl relative overflow-hidden shadow-2xl">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        {/* EVENT FILTER BAR (MULTI-EVENT SELECTOR) */}
        <div className="mb-6 pb-6 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="text-xs font-bold uppercase text-white tracking-wider">SELECT EVENT(S) FOR FINANCIAL REPORTING:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => toggleEventSelection('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
                isAllSelected
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {isAllSelected && <Check className="w-3.5 h-3.5" />}
              ALL LIVE EVENTS ({activeEvents.length})
            </button>

            {activeEvents.map(evt => {
              const isSelected = !isAllSelected && selectedEventIds.includes(evt.id);
              return (
                <button
                  key={evt.id}
                  type="button"
                  onClick={() => toggleEventSelection(evt.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5" />}
                  {evt.title}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-mono uppercase tracking-widest rounded-full flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5" /> FLAP DESK • FINANCIALS, LEDGER & PROFIT ENGINE
              </span>
              <span className="px-3 py-1 bg-slate-950 text-slate-300 border border-slate-800 text-[10px] font-mono uppercase rounded-full">
                Filter: {selectedEventsLabel}
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tight">
              FLAP <span className="text-indigo-400">DESK</span>
            </h1>
            <p className="text-xs text-slate-400 max-w-xl mt-2 leading-relaxed">
              Financials, Ledger, Accounts & Profit Engine: Real-time ticket revenue calculation, vendor expense tracking, profit margin analysis, and multi-event reports.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={() => setShowDocModal(true)}
              className="px-5 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <FileText className="w-4 h-4" />
              EXPORT GOOGLE DOC REPORT
            </button>

            <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl text-right">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block">
                Net Profit
              </span>
              <span className={`text-2xl font-black font-mono ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                ₹{netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                Margin: {profitMargin}%
              </span>
            </div>
          </div>
        </div>

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-800">
          <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-1">
            <div className="flex items-center justify-between text-indigo-400">
              <span className="text-[10px] font-mono uppercase font-bold tracking-wider">Total Income</span>
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="text-xl font-black font-mono text-white">
              ₹{totalIncomeAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
              <span className="text-indigo-400 font-bold">₹{totalTicketRevenue.toLocaleString('en-IN')}</span> from ticket sales
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-1">
            <div className="flex items-center justify-between text-rose-400">
              <span className="text-[10px] font-mono uppercase font-bold tracking-wider">Total Expenses</span>
              <TrendingDown className="w-4 h-4" />
            </div>
            <div className="text-xl font-black font-mono text-white">
              ₹{totalExpenseAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              {allExpenses.length} expense records
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-1">
            <div className="flex items-center justify-between text-sky-400">
              <span className="text-[10px] font-mono uppercase font-bold tracking-wider">Ticket Sales Income</span>
              <Ticket className="w-4 h-4" />
            </div>
            <div className="text-xl font-black font-mono text-white">
              ₹{totalTicketRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Auto-added on pass assignment
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-1">
            <div className="flex items-center justify-between text-purple-400">
              <span className="text-[10px] font-mono uppercase font-bold tracking-wider">Live Events</span>
              <Calendar className="w-4 h-4" />
            </div>
            <div className="text-xl font-black font-mono text-white">
              {isAllSelected ? `${activeEvents.length} Live Events` : `${selectedEventIds.length} Selected`}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              {passes.filter(p => (p.status === 'assigned' || p.status === 'checked_in') && (!p.eventId || (isAllSelected ? activeEventIds.has(p.eventId) : selectedEventIds.includes(p.eventId)))).length} active passes
            </div>
          </div>
        </div>
      </div>

      {/* Split Grid: Left = Add Form, Right = Financial Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Form: Add Income or Expense (5 Columns) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 p-6 sm:p-7 rounded-3xl space-y-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-indigo-400" />
              RECORD FINANCIAL ENTRY
            </h2>
            
            {/* Type Toggle */}
            <div className="flex items-center bg-slate-950 p-1 border border-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setEntryType('expense');
                  setCategory(EXPENSE_CATEGORIES[0]);
                }}
                className={`px-3 py-1.5 text-xs font-bold uppercase rounded-lg transition-all cursor-pointer ${
                  entryType === 'expense'
                    ? 'bg-rose-500 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Expense
              </button>
              <button
                type="button"
                onClick={() => {
                  setEntryType('income');
                  setCategory(INCOME_CATEGORIES[0]);
                }}
                className={`px-3 py-1.5 text-xs font-bold uppercase rounded-lg transition-all cursor-pointer ${
                  entryType === 'income'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Income
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                {entryType === 'expense' ? 'Expense Title / Vendor Name' : 'Income Title / Source'}
              </label>
              <input
                type="text"
                required
                placeholder={entryType === 'expense' ? 'e.g. Stage Sound Rig Rental' : 'e.g. Apex Global Sponsorship'}
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 p-2.5 font-bold text-xs text-white placeholder-slate-600 focus:border-indigo-500 outline-none rounded-xl"
              />
            </div>

            {/* Amount & Date/Time Grid */}
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Amount (₹ INR) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs font-bold">₹</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    placeholder="e.g. 5000"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 pl-7 pr-3 py-2.5 font-mono font-bold text-sm text-indigo-300 placeholder-slate-600 focus:border-indigo-500 outline-none rounded-xl"
                  />
                </div>
              </div>

              {/* Date AND Time Inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-indigo-400" /> Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 font-mono text-xs text-white focus:border-indigo-500 outline-none rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-indigo-400" /> Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={time}
                    onChange={e => setTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 font-mono text-xs text-white focus:border-indigo-500 outline-none rounded-xl"
                  />
                </div>
              </div>
            </div>

            {/* Category — Custom Typing Allowed */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-bold uppercase text-slate-400">
                  Category (Type in or choose suggestion) *
                </label>
                <span className="text-[9px] font-mono text-indigo-400 font-bold uppercase">
                  Custom Typing Enabled
                </span>
              </div>
              <input
                type="text"
                required
                list="category-suggestions-list"
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="Type category name by hand..."
                className="w-full bg-slate-950 border border-slate-800 p-2.5 font-bold text-xs text-white focus:border-indigo-500 outline-none rounded-xl placeholder-slate-600 uppercase"
              />
              <datalist id="category-suggestions-list">
                {(entryType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map(cat => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>

              {/* Quick suggestion pills */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[9px] font-bold uppercase text-slate-500 self-center">SUGGESTIONS:</span>
                {(entryType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-2.5 py-1 text-[9px] font-bold uppercase rounded-lg border transition-colors cursor-pointer ${
                      category.toLowerCase() === cat.toLowerCase()
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Vendor Details (For Expenses) */}
            {entryType === 'expense' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-950 border border-rose-500/20 rounded-2xl">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-rose-400 mb-1">
                    Vendor / Agency Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Apex Stage Crafts"
                    value={vendorName}
                    onChange={e => setVendorName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 p-2 font-bold text-xs text-white placeholder-slate-600 focus:border-rose-400 outline-none rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-rose-400 mb-1">
                    Vendor Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. +91 98765 43210"
                    value={vendorPhone}
                    onChange={e => setVendorPhone(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 p-2 font-mono text-xs text-white placeholder-slate-600 focus:border-rose-400 outline-none rounded-xl"
                  />
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Notes / Invoice Number (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Add receipt details or notes..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 p-2.5 text-xs text-white placeholder-slate-600 focus:border-indigo-500 outline-none rounded-xl resize-none"
              />
            </div>

            <button
              type="submit"
              className={`w-full py-3.5 font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
                entryType === 'expense'
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              Add {entryType === 'expense' ? 'Expense Record' : 'Income Record'}
            </button>
          </form>
        </div>

        {/* Right End Column: Charts & Visual Analytics (7 Columns) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 p-6 sm:p-7 rounded-3xl space-y-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              FINANCIAL CHARTS & DISTRIBUTION
            </h2>
            <span className="text-[10px] font-mono text-indigo-300 uppercase tracking-widest bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
              Live Recharts Data
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Chart 1: Financial Comparison Bar Chart */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-indigo-400" />
                Revenue vs Expenses
              </h3>
              <div className="h-56 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={financialSummaryChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                      formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Amount']}
                    />
                    <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                      {financialSummaryChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Expense Category Pie Distribution */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <PieChartIcon className="w-3.5 h-3.5 text-rose-400" />
                Expense Breakdown
              </h3>
              <div className="h-56 w-full pt-2">
                {expenseChartData.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
                    No expense data yet
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {expenseChartData.map((entry, index) => (
                          <Cell key={`pie-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '11px' }}
                        formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Spent']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Quick Legend for Expense Categories */}
          {expenseChartData.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {expenseChartData.map((item, idx) => (
                <div key={item.name} className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800 text-[10px] font-mono">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                  <span className="text-slate-300">{item.name}:</span>
                  <span className="text-indigo-400 font-bold">₹{item.value.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Bottom Section: Expenses Listed Below & Incomes Breakdown */}
      <div className="space-y-6 pt-6 border-t border-slate-800">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800">
          <div>
            <h2 className="text-lg font-bold uppercase text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-rose-400" />
              EXPENSES LIST & RECORD LOG ({filteredExpenses.length})
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Detailed ledger of event expenditures and costs.
            </p>
          </div>

          {/* Search & Category Filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search expenses..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <select
              value={selectedExpenseCat}
              onChange={e => setSelectedExpenseCat(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold uppercase text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Expense Categories</option>
              {EXPENSE_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Expenses Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          {filteredExpenses.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-2">
              <Receipt className="w-10 h-10 mx-auto opacity-30" />
              <p className="text-xs font-mono uppercase font-bold">No expense records found matching filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-[10px] font-mono uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-4">Date & Time</th>
                    <th className="p-4">Expense Title</th>
                    <th className="p-4">Vendor & Phone</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Notes</th>
                    <th className="p-4 text-right">Amount (₹)</th>
                    <th className="p-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {filteredExpenses.map(exp => (
                    <tr key={exp.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="p-4 whitespace-nowrap text-slate-400 text-[11px]">
                        {formatDateTimeDisplay(exp.date, exp.time)}
                      </td>
                      <td className="p-4 font-bold text-white font-sans text-sm">
                        {exp.title}
                      </td>
                      <td className="p-4 text-slate-300 text-xs">
                        {exp.vendorName ? (
                          <div>
                            <span className="font-bold text-white block">{exp.vendorName}</span>
                            {exp.vendorPhone && <span className="text-[10px] text-indigo-400 font-mono">📞 {exp.vendorPhone}</span>}
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[10px] font-bold uppercase rounded-lg">
                          {exp.category}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400 text-[11px] max-w-xs truncate">
                        {exp.notes || '—'}
                      </td>
                      <td className="p-4 text-right font-bold text-rose-400 text-sm whitespace-nowrap">
                        -₹{exp.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleDelete(exp.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Delete Expense Record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Income & Ticket Sales Ledger */}
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold uppercase text-white flex items-center gap-2">
              <Ticket className="w-5 h-5 text-indigo-400" />
              INCOME & TICKET SALES LEDGER ({allIncomes.length})
            </h3>
            <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20 font-bold uppercase">
              Auto Accumulating Ticket Sales Enabled
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-[10px] font-mono uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-4">Date & Time</th>
                    <th className="p-4">Income Title / Source</th>
                    <th className="p-4">Source Type</th>
                    <th className="p-4">Category</th>
                    <th className="p-4 text-right">Revenue (₹)</th>
                    <th className="p-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {allIncomes.map(inc => (
                    <tr key={inc.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="p-4 whitespace-nowrap text-slate-400 text-[11px]">
                        {formatDateTimeDisplay(inc.date, inc.time)}
                      </td>
                      <td className="p-4 font-bold text-white font-sans text-sm">
                        {inc.title}
                        {inc.notes && (
                          <div className="text-[10px] font-mono text-slate-400 font-normal">
                            {inc.notes}
                          </div>
                        )}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        {inc.isAutomaticTicketSale ? (
                          <span className="px-2.5 py-1 bg-sky-500/10 text-sky-400 border border-sky-500/30 text-[10px] font-bold uppercase rounded-lg flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-3 h-3" /> Auto Ticket Sale
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 text-[10px] font-bold uppercase rounded-lg w-fit block">
                            Manual Income
                          </span>
                        )}
                      </td>
                      <td className="p-4 whitespace-nowrap text-[11px] text-slate-300">
                        {inc.category}
                      </td>
                      <td className="p-4 text-right font-bold text-emerald-400 text-sm whitespace-nowrap">
                        +₹{inc.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleDelete(inc.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer flex items-center gap-1 mx-auto"
                          title="Delete Income / Ticket Record"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="text-[10px]">Delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}

                  {allIncomes.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500 font-mono text-xs">
                        No income or ticket sale records registered yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

      {/* 3-PAGE GOOGLE DOC / P&L REPORT EXPORT MODAL */}
      {showDocModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col my-8 max-h-[90vh]">
            
            {/* Modal Header Toolbar */}
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-4 rounded-t-3xl">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="font-bold text-sm uppercase text-white tracking-wide">
                    3-PAGE P&L FINANCIAL REPORT (GOOGLE DOCS READY)
                  </h3>
                  <p className="text-[10px] font-mono text-slate-400">
                    Formatted for direct copy-paste into Google Docs or 3-page PDF printing.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const docElement = document.getElementById('google-doc-printable-area');
                    if (docElement) {
                      const htmlContent = docElement.innerHTML;
                      const blobText = new Blob([docElement.innerText], { type: 'text/plain' });
                      const blobHtml = new Blob([`<html><body>${htmlContent}</body></html>`], { type: 'text/html' });
                      
                      if (navigator.clipboard && window.ClipboardItem) {
                        const data = [new ClipboardItem({ 'text/plain': blobText, 'text/html': blobHtml })];
                        navigator.clipboard.write(data).then(() => {
                          setCopiedDoc(true);
                          setTimeout(() => setCopiedDoc(false), 3000);
                        }).catch(err => {
                          console.error('Clipboard write failed:', err);
                          navigator.clipboard.writeText(docElement.innerText);
                          setCopiedDoc(true);
                          setTimeout(() => setCopiedDoc(false), 3000);
                        });
                      } else {
                        navigator.clipboard.writeText(docElement.innerText);
                        setCopiedDoc(true);
                        setTimeout(() => setCopiedDoc(false), 3000);
                      }
                    }
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase rounded-xl transition-all flex items-center gap-1.5 shadow-md shadow-indigo-600/30 cursor-pointer"
                >
                  {copiedDoc ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  {copiedDoc ? 'COPIED TO CLIPBOARD!' : 'COPY FOR GOOGLE DOCS'}
                </button>

                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-slate-950 hover:bg-slate-800 text-slate-200 hover:text-white font-bold text-xs uppercase rounded-xl border border-slate-800 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-indigo-400" />
                  PRINT / SAVE PDF
                </button>

                <button
                  onClick={() => setShowDocModal(false)}
                  className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Container (Styled like Google Docs Page layout) */}
            <div className="p-6 overflow-y-auto space-y-8 bg-slate-950 font-sans text-slate-900">
              <div id="google-doc-printable-area" className="max-w-4xl mx-auto space-y-12">
                
                {/* PAGE 1: EXECUTIVE SUMMARY & DASHBOARD */}
                <div className="bg-white p-8 sm:p-12 shadow-2xl rounded-sm border border-slate-300 min-h-[1050px] flex flex-col justify-between page-break-after">
                  <div>
                    {/* Header */}
                    <div className="border-b-4 border-indigo-600 pb-4 mb-6 flex items-start justify-between">
                      <div>
                        <span className="text-xs font-bold uppercase text-indigo-700 tracking-widest block mb-1">
                          PASSCRAFT OFFICIAL FINANCIAL STATEMENT
                        </span>
                        <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">
                          P&L EXECUTIVE SUMMARY
                        </h1>
                        <p className="text-xs text-slate-600 font-medium mt-1">
                          Event: <strong className="text-slate-900 uppercase">{selectedEventsLabel}</strong> • Generated: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-800 text-xs font-bold uppercase rounded border border-indigo-300">
                          PAGE 1 OF {totalPdfPages}
                        </span>
                      </div>
                    </div>

                    {/* Executive Stats Cards */}
                    <div className="grid grid-cols-2 gap-4 mb-8">
                      <div className="p-4 bg-indigo-50 border-2 border-indigo-500 rounded-lg">
                        <div className="text-xs font-bold text-indigo-800 uppercase tracking-wider">TOTAL REVENUE (INCOME)</div>
                        <div className="text-2xl font-black text-indigo-900 font-mono mt-1">
                          ₹{totalIncomeAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[11px] text-indigo-700 mt-1">
                          Includes ₹{totalTicketRevenue.toLocaleString('en-IN')} ticket sales revenue
                        </div>
                      </div>

                      <div className="p-4 bg-rose-50 border-2 border-rose-500 rounded-lg">
                        <div className="text-xs font-bold text-rose-800 uppercase tracking-wider">TOTAL EXPENSES</div>
                        <div className="text-2xl font-black text-rose-900 font-mono mt-1">
                          ₹{totalExpenseAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[11px] text-rose-700 mt-1">
                          Across {allExpenses.length} categorised expense entries
                        </div>
                      </div>

                      <div className="p-4 bg-slate-100 border-2 border-slate-400 rounded-lg col-span-2 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">NET PROFIT / LOSS</div>
                          <div className={`text-3xl font-black font-mono mt-1 ${netProfit >= 0 ? 'text-indigo-700' : 'text-rose-700'}`}>
                            ₹{netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold text-slate-500 uppercase">PROFIT MARGIN</div>
                          <div className="text-2xl font-black text-slate-800 font-mono">{profitMargin}%</div>
                        </div>
                      </div>
                    </div>

                    {/* Visual Breakdown Bars */}
                    <div className="space-y-4 mb-8">
                      <h3 className="text-sm font-black text-slate-800 uppercase border-b border-slate-200 pb-2">
                        FINANCIAL ALLOCATION & REVENUE RATIO
                      </h3>
                      
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                            <span>Total Revenue Share</span>
                            <span>100% (₹{totalIncomeAmount.toLocaleString('en-IN')})</span>
                          </div>
                          <div className="w-full bg-slate-200 h-4 rounded-full overflow-hidden flex">
                            <div className="bg-indigo-600 h-full" style={{ width: `${totalIncomeAmount > 0 ? (totalTicketRevenue / totalIncomeAmount) * 100 : 0}%` }} title="Ticket Sales" />
                            <div className="bg-sky-500 h-full" style={{ width: `${totalIncomeAmount > 0 ? ((totalIncomeAmount - totalTicketRevenue) / totalIncomeAmount) * 100 : 0}%` }} title="Manual Incomes" />
                          </div>
                          <div className="flex items-center gap-4 text-[11px] text-slate-600 mt-1 font-medium">
                            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-indigo-600 rounded-full inline-block" /> Ticket Sales ({totalIncomeAmount > 0 ? Math.round((totalTicketRevenue / totalIncomeAmount) * 100) : 0}%)</span>
                            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-sky-500 rounded-full inline-block" /> Other Revenue ({totalIncomeAmount > 0 ? Math.round(((totalIncomeAmount - totalTicketRevenue) / totalIncomeAmount) * 100) : 0}%)</span>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                            <span>Expense to Revenue Ratio</span>
                            <span>{totalIncomeAmount > 0 ? Math.min(100, Math.round((totalExpenseAmount / totalIncomeAmount) * 100)) : 0}%</span>
                          </div>
                          <div className="w-full bg-slate-200 h-4 rounded-full overflow-hidden">
                            <div className="bg-rose-500 h-full" style={{ width: `${totalIncomeAmount > 0 ? Math.min(100, (totalExpenseAmount / totalIncomeAmount) * 100) : 100}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
                    Confidential PassCraft Financial Audit • End of Page 1 (Overview)
                  </div>
                </div>

                {/* DYNAMIC ITEMIZED INCOME PAGES */}
                {incomeChunks.map((chunk, idx) => {
                  const pageNum = 2 + idx;
                  const isLastIncomePage = idx === incomeChunks.length - 1;

                  return (
                    <div key={`pdf-inc-page-${idx}`} className="bg-white p-8 sm:p-12 shadow-2xl rounded-sm border border-slate-300 min-h-[1050px] flex flex-col justify-between page-break-after">
                      <div>
                        {/* Header */}
                        <div className="border-b-4 border-indigo-600 pb-4 mb-6 flex items-start justify-between">
                          <div>
                            <span className="text-xs font-bold uppercase text-indigo-700 tracking-widest block mb-1">
                              PASSCRAFT OFFICIAL FINANCIAL STATEMENT
                            </span>
                            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                              PAGE {pageNum} // ITEMIZED REVENUE & INCOMES {incomeChunks.length > 1 ? `(PART ${idx + 1} OF ${incomeChunks.length})` : ''}
                            </h1>
                            <p className="text-xs text-slate-600 font-medium mt-1">
                              {selectedEventsLabel} • Detailed ledger of ticket sales and revenue streams.
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-800 text-xs font-bold uppercase rounded border border-indigo-300">
                              PAGE {pageNum} OF {totalPdfPages}
                            </span>
                          </div>
                        </div>

                        {/* Incomes Table */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-100 border-b-2 border-slate-300 text-slate-800 font-bold uppercase">
                                <th className="p-2.5">Date & Time</th>
                                <th className="p-2.5">Title / Source</th>
                                <th className="p-2.5">Category</th>
                                <th className="p-2.5 text-right">Amount (₹)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 text-slate-700">
                              {chunk.map((inc, cIdx) => (
                                <tr key={inc.id || cIdx} className="hover:bg-slate-50">
                                  <td className="p-2.5 font-mono text-[11px] whitespace-nowrap">{formatDateTimeDisplay(inc.date, inc.time)}</td>
                                  <td className="p-2.5 font-medium">{inc.title}</td>
                                  <td className="p-2.5 text-[11px] uppercase font-semibold text-slate-500">{inc.category}</td>
                                  <td className="p-2.5 text-right font-mono font-bold text-emerald-700">+₹{inc.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                </tr>
                              ))}
                              {chunk.length === 0 && (
                                <tr>
                                  <td colSpan={4} className="p-4 text-center text-slate-400 italic">No income entries logged for selected event(s).</td>
                                </tr>
                              )}
                            </tbody>
                            {isLastIncomePage && (
                              <tfoot>
                                <tr className="bg-indigo-50 border-t-2 border-indigo-500 font-bold text-slate-900">
                                  <td colSpan={3} className="p-3 uppercase">TOTAL REVENUE SUBCATEGORY SUM:</td>
                                  <td className="p-3 text-right font-mono text-indigo-900 text-sm">₹{totalIncomeAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                </tr>
                              </tfoot>
                            )}
                          </table>
                        </div>
                      </div>

                      <div className="border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
                        Confidential PassCraft Financial Audit • End of Page {pageNum} (Incomes)
                      </div>
                    </div>
                  );
                })}

                {/* DYNAMIC ITEMIZED EXPENSE PAGES */}
                {expenseChunks.map((chunk, eIdx) => {
                  const pageNum = 1 + incomeChunks.length + 1 + eIdx;
                  const isLastExpensePage = eIdx === expenseChunks.length - 1;

                  return (
                    <div key={`pdf-exp-page-${eIdx}`} className="bg-white p-8 sm:p-12 shadow-2xl rounded-sm border border-slate-300 min-h-[1050px] flex flex-col justify-between">
                      <div>
                        {/* Header */}
                        <div className="border-b-4 border-rose-600 pb-4 mb-6 flex items-start justify-between">
                          <div>
                            <span className="text-xs font-bold uppercase text-rose-700 tracking-widest block mb-1">
                              PASSCRAFT OFFICIAL FINANCIAL STATEMENT
                            </span>
                            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                              PAGE {pageNum} // ITEMIZED EXPENSES & COSTS {expenseChunks.length > 1 ? `(PART ${eIdx + 1} OF ${expenseChunks.length})` : ''}
                            </h1>
                            <p className="text-xs text-slate-600 font-medium mt-1">
                              {selectedEventsLabel} • Audit ledger of venue, vendors, audio/visual, and logistics costs.
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="inline-block px-3 py-1 bg-rose-100 text-rose-800 text-xs font-bold uppercase rounded border border-rose-300">
                              PAGE {pageNum} OF {totalPdfPages}
                            </span>
                          </div>
                        </div>

                        {/* Expenses Table */}
                        <div className="overflow-x-auto mb-8">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-100 border-b-2 border-slate-300 text-slate-800 font-bold uppercase">
                                <th className="p-2.5">Date & Time</th>
                                <th className="p-2.5">Expense Title</th>
                                <th className="p-2.5">Vendor & Contact</th>
                                <th className="p-2.5">Category</th>
                                <th className="p-2.5 text-right">Amount (₹)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 text-slate-700">
                              {chunk.map((exp, cIdx) => (
                                <tr key={exp.id || cIdx} className="hover:bg-slate-50">
                                  <td className="p-2.5 font-mono text-[11px] whitespace-nowrap">{formatDateTimeDisplay(exp.date, exp.time)}</td>
                                  <td className="p-2.5 font-medium">{exp.title}</td>
                                  <td className="p-2.5 text-[11px]">
                                    {exp.vendorName ? (
                                      <span>
                                        <strong className="text-slate-900">{exp.vendorName}</strong>
                                        {exp.vendorPhone && <span className="text-slate-500 block">📞 {exp.vendorPhone}</span>}
                                      </span>
                                    ) : '—'}
                                  </td>
                                  <td className="p-2.5 text-[11px] uppercase font-semibold text-slate-500">{exp.category}</td>
                                  <td className="p-2.5 text-right font-mono font-bold text-rose-700">-₹{exp.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                </tr>
                              ))}
                              {chunk.length === 0 && (
                                <tr>
                                  <td colSpan={5} className="p-4 text-center text-slate-400 italic">No expense records logged for selected event(s).</td>
                                </tr>
                              )}
                            </tbody>
                            {isLastExpensePage && (
                              <tfoot>
                                <tr className="bg-rose-50 border-t-2 border-rose-500 font-bold text-slate-900">
                                  <td colSpan={4} className="p-3 uppercase">TOTAL EXPENSES SUM:</td>
                                  <td className="p-3 text-right font-mono text-rose-900 text-sm">-₹{totalExpenseAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                </tr>
                              </tfoot>
                            )}
                          </table>
                        </div>
                      </div>

                      <div className="border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
                        Confidential PassCraft Financial Audit • End of Page {pageNum} (Expenses)
                      </div>
                    </div>
                  );
                })}

              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
