import React, { useState, useEffect } from 'react';
import { PassItem, EventItem } from '../types';
import { safeFetchJson } from '../lib/apiHelper';
import { 
  getPassGatesUsed,
  ALL_SHEET_COLUMNS,
  DEFAULT_PEOPLE_COLUMN_KEYS,
  DEFAULT_CHECKIN_COLUMN_KEYS,
  formatPassColumnValue,
  SheetColumnDef
} from '../lib/passUtils';
import { 
  extractSpreadsheetId, 
  connectGoogleSheetsAuth, 
  syncPassesToGoogleSheetApi, 
  fetchSpreadsheetMetadata,
  getGoogleAccessToken,
  setGoogleAccessToken 
} from '../lib/googleSheetsService';
import { 
  FileSpreadsheet, 
  Sparkles, 
  RefreshCw, 
  ExternalLink, 
  Copy, 
  Check, 
  Table, 
  CheckCircle2, 
  AlertCircle, 
  Sliders, 
  Download, 
  Zap, 
  Info, 
  TrendingUp, 
  Link2, 
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Layers,
  Palette,
  Plus,
  Users,
  ShieldCheck,
  CheckSquare,
  Square,
  SlidersHorizontal,
  Eye,
  Settings2,
  X,
  ListFilter
} from 'lucide-react';

interface GoogleSheetsSyncProps {
  passes: PassItem[];
  events: EventItem[];
  selectedEventId: string;
}

interface ColumnDef {
  key: string;
  header: string;
  type: string;
  formulaTemplate?: string | null;
  width?: number;
}

interface SheetTabOption {
  sheetId: number;
  title: string;
  index: number;
}

interface AIAnalysisResult {
  columnSchema: ColumnDef[];
  formulas: {
    totalRegistered: string;
    totalCheckedIn: string;
    attendanceRate: string;
    totalRevenue: string;
    vipAttendance: string;
  };
  executiveSummary: string;
  dataInsights: string[];
  suggestedTabNames: string[];
}

export const GoogleSheetsSync: React.FC<GoogleSheetsSyncProps> = ({
  passes,
  events,
  selectedEventId,
}) => {
  // Connection state stored in localStorage
  const [sheetUrl, setSheetUrl] = useState(() => localStorage.getItem('passcraft_gsheet_url') || '');
  
  // Two distinct tabs: 1. People Info Roster, 2. Check-in & Gate Activity
  const [peopleTabName, setPeopleTabName] = useState(() => localStorage.getItem('passcraft_gsheet_tab_people') || localStorage.getItem('passcraft_gsheet_tab') || 'PassCraft Roster');
  const [checkinTabName, setCheckinTabName] = useState(() => localStorage.getItem('passcraft_gsheet_tab_checkin') || 'Check-in & Gate Activity');
  
  // Customizable columns for Sheet 1 & Sheet 2
  const [peopleColKeys, setPeopleColKeys] = useState<string[]>(() => {
    const saved = localStorage.getItem('passcraft_gsheet_cols_people');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return DEFAULT_PEOPLE_COLUMN_KEYS;
  });

  const [checkinColKeys, setCheckinColKeys] = useState<string[]>(() => {
    const saved = localStorage.getItem('passcraft_gsheet_cols_checkin');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return DEFAULT_CHECKIN_COLUMN_KEYS;
  });

  // Open customizer panel: 'people' | 'checkin' | null
  const [openCustomizer, setOpenCustomizer] = useState<'people' | 'checkin' | null>(null);

  // Currently active sheet view in the UI
  const [activeSheetView, setActiveSheetView] = useState<'people' | 'checkin'>('people');

  const [autoSyncEnabled, setAutoSyncEnabled] = useState(() => localStorage.getItem('passcraft_gsheet_autosync') === 'true');
  const [isConnected, setIsConnected] = useState(() => localStorage.getItem('passcraft_gsheet_connected') === 'true');
  const [connectedSpreadsheetTitle, setConnectedSpreadsheetTitle] = useState(() => localStorage.getItem('passcraft_gsheet_title') || '');

  // Available tabs fetched directly from user's Google Spreadsheet
  const [availableTabs, setAvailableTabs] = useState<SheetTabOption[]>([]);
  const [isLoadingTabs, setIsLoadingTabs] = useState(false);
  const [connectedUserEmail, setConnectedUserEmail] = useState<string | null>(() => {
    try {
      return localStorage.getItem('passcraft_gsheet_user_email') || null;
    } catch (e) {
      return null;
    }
  });

  // Auth & Sync state
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() => localStorage.getItem('passcraft_gsheet_last_sync') || null);

  // AI & Filter states
  const [filterScope, setFilterScope] = useState<'all' | 'assigned_only' | 'checked_in_only' | 'unassigned_only'>('assigned_only');
  const [customAiPrompt, setCustomAiPrompt] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiData, setAiData] = useState<AIAnalysisResult | null>(null);

  // Active event resolution
  const selectedEvent = events.find(e => e.id === selectedEventId);
  const eventTitle = selectedEvent ? selectedEvent.title : 'All Events';

  // Filter passes based on event selection and status
  const eventPasses = passes.filter(p => {
    if (selectedEventId === 'all') return true;
    if (p.eventId && p.eventId === selectedEventId) return true;
    if (selectedEvent && p.eventName && p.eventName.toLowerCase().trim() === selectedEvent.title.toLowerCase().trim()) return true;
    return false;
  });

  const filteredPasses = eventPasses.filter(p => {
    if (filterScope === 'assigned_only') return p.status === 'assigned' || p.status === 'checked_in';
    if (filterScope === 'checked_in_only') return p.status === 'checked_in';
    if (filterScope === 'unassigned_only') return p.status === 'unassigned';
    return true;
  });

  // Schema 1: Dynamic People & Pass Info
  const peopleSchema: ColumnDef[] = peopleColKeys
    .map(k => ALL_SHEET_COLUMNS.find(c => c.key === k))
    .filter((c): c is SheetColumnDef => Boolean(c))
    .map(c => ({
      key: c.key,
      header: c.header,
      type: c.type,
      width: c.width
    }));

  // Schema 2: Dynamic Check-in Timestamps & Gate Used
  const checkinSchema: ColumnDef[] = checkinColKeys
    .map(k => ALL_SHEET_COLUMNS.find(c => c.key === k))
    .filter((c): c is SheetColumnDef => Boolean(c))
    .map(c => ({
      key: c.key,
      header: c.header,
      type: c.type,
      width: c.width
    }));

  // Active columns based on selected view
  const currentColumns = activeSheetView === 'people' ? peopleSchema : checkinSchema;
  const currentTabName = activeSheetView === 'people' ? peopleTabName : checkinTabName;

  // Toggle single column
  const toggleColumn = (target: 'people' | 'checkin', colKey: string) => {
    if (target === 'people') {
      setPeopleColKeys(prev => {
        let next: string[];
        if (prev.includes(colKey)) {
          if (prev.length <= 1) return prev; // keep at least 1
          next = prev.filter(k => k !== colKey);
        } else {
          next = [...prev, colKey];
        }
        localStorage.setItem('passcraft_gsheet_cols_people', JSON.stringify(next));
        return next;
      });
    } else {
      setCheckinColKeys(prev => {
        let next: string[];
        if (prev.includes(colKey)) {
          if (prev.length <= 1) return prev;
          next = prev.filter(k => k !== colKey);
        } else {
          next = [...prev, colKey];
        }
        localStorage.setItem('passcraft_gsheet_cols_checkin', JSON.stringify(next));
        return next;
      });
    }
  };

  // Apply preset
  const applyPreset = (target: 'people' | 'checkin', preset: 'default' | 'all' | 'compact' | 'contact' | 'turnstile') => {
    let keys: string[] = [];
    if (preset === 'default') {
      keys = target === 'people' ? DEFAULT_PEOPLE_COLUMN_KEYS : DEFAULT_CHECKIN_COLUMN_KEYS;
    } else if (preset === 'all') {
      keys = ALL_SHEET_COLUMNS.map(c => c.key);
    } else if (preset === 'compact') {
      keys = ['code16', 'attendeeName', 'category', 'status'];
    } else if (preset === 'contact') {
      keys = ['attendeeName', 'email', 'phone', 'eventName', 'category', 'status'];
    } else if (preset === 'turnstile') {
      keys = ['code16', 'attendeeName', 'checkedInAt', 'gateName', 'totalEntries', 'status'];
    }
    if (target === 'people') {
      setPeopleColKeys(keys);
      localStorage.setItem('passcraft_gsheet_cols_people', JSON.stringify(keys));
    } else {
      setCheckinColKeys(keys);
      localStorage.setItem('passcraft_gsheet_cols_checkin', JSON.stringify(keys));
    }
  };

  // Format row values for Google Sheets
  const formatCellValue = (pass: PassItem, key: string, rowIndex: number): string => {
    return formatPassColumnValue(pass, key, rowIndex, eventTitle);
  };

  // Fetch available sheet tabs from connected spreadsheet
  const fetchAvailableTabsFromSheet = async (targetUrl?: string) => {
    const sId = extractSpreadsheetId(targetUrl || sheetUrl);
    if (!sId) return;

    setIsLoadingTabs(true);
    try {
      let token = await getGoogleAccessToken();
      if (!token) return;
      
      const meta = await fetchSpreadsheetMetadata(sId, token);
      if (meta.properties?.title) {
        setConnectedSpreadsheetTitle(meta.properties.title);
        localStorage.setItem('passcraft_gsheet_title', meta.properties.title);
      }
      if (meta.sheets && Array.isArray(meta.sheets)) {
        const tabs: SheetTabOption[] = meta.sheets.map((s: any) => ({
          sheetId: s.properties?.sheetId ?? 0,
          title: s.properties?.title || 'Sheet1',
          index: s.properties?.index ?? 0,
        }));
        setAvailableTabs(tabs);
      }
    } catch (err: any) {
      console.warn('Could not auto-fetch tabs:', err);
    } finally {
      setIsLoadingTabs(false);
    }
  };

  useEffect(() => {
    if (isConnected && sheetUrl) {
      fetchAvailableTabsFromSheet();
    }
  }, [isConnected]);

  // Sync a single schema tab helper
  const syncSingleTab = async (
    spreadsheetId: string, 
    tabTitle: string, 
    schema: ColumnDef[], 
    passesToSync: PassItem[], 
    token: string,
    options?: { customColumnWidths?: number[]; headerBgColor?: { red: number; green: number; blue: number } }
  ) => {
    const headers = schema.map(c => c.header);
    const rows = passesToSync.map((p, idx) => {
      return schema.map(c => formatCellValue(p, c.key, idx + 2));
    });
    return await syncPassesToGoogleSheetApi(
      spreadsheetId, 
      tabTitle, 
      headers, 
      rows, 
      token, 
      'replace_all',
      {
        customColumnWidths: options?.customColumnWidths || schema.map(c => c.width || 150),
        headerBgColor: options?.headerBgColor,
      }
    );
  };

  // Explicitly Switch or Re-authenticate Google Account
  const handleSwitchGoogleAccount = async () => {
    try {
      setIsConnecting(true);
      const authResult = await connectGoogleSheetsAuth(true);
      if (authResult.user?.email) {
        setConnectedUserEmail(authResult.user.email);
      }
      setSyncStatusMsg({
        type: 'success',
        text: `Google account switched to ${authResult.user?.email || 'authenticated user'}.`,
      });
      fetchAvailableTabsFromSheet();
    } catch (err: any) {
      if (err?.isCancelled || err?.isUserCancellation) {
        setSyncStatusMsg({
          type: 'idle',
          text: 'Google sign-in was cancelled.',
        });
      } else {
        setSyncStatusMsg({
          type: 'error',
          text: `Authentication error: ${err.message || 'Could not connect Google account.'}`,
        });
      }
    } finally {
      setIsConnecting(false);
    }
  };

  // Connect Google Sheet & Sync Both Sheets
  const handleConnectSheet = async () => {
    const sheetId = extractSpreadsheetId(sheetUrl);
    if (!sheetId) {
      setSyncStatusMsg({
        type: 'error',
        text: 'Please enter a valid Google Sheet URL (e.g. https://docs.google.com/spreadsheets/d/1BxiMVs.../edit)',
      });
      return;
    }

    setIsConnecting(true);
    setSyncStatusMsg(null);

    try {
      // 1. Authenticate with Google OAuth only if no valid cached token exists
      let token = await getGoogleAccessToken();
      if (!token) {
        const authResult = await connectGoogleSheetsAuth(false);
        token = authResult.accessToken;
        if (authResult.user?.email) {
          setConnectedUserEmail(authResult.user.email);
        }
      }

      // 2. Fetch Spreadsheet Metadata
      const meta = await fetchSpreadsheetMetadata(sheetId, token);
      if (meta.properties?.title) {
        setConnectedSpreadsheetTitle(meta.properties.title);
        localStorage.setItem('passcraft_gsheet_title', meta.properties.title);
      }

      if (meta.sheets && Array.isArray(meta.sheets)) {
        const tabs: SheetTabOption[] = meta.sheets.map((s: any) => ({
          sheetId: s.properties?.sheetId ?? 0,
          title: s.properties?.title || 'Sheet1',
          index: s.properties?.index ?? 0,
        }));
        setAvailableTabs(tabs);
      }

      const pTab = peopleTabName.trim() || 'PassCraft Roster';
      const cTab = checkinTabName.trim() || 'Check-in & Gate Activity';

      // 3. Write Sheet 1: People & Pass Info (Navy Theme)
      await syncSingleTab(sheetId, pTab, peopleSchema, filteredPasses, token, {
        headerBgColor: { red: 0.0588, green: 0.0902, blue: 0.1647 } // #0F172A Slate Navy
      });

      // 4. Write Sheet 2: Check-in Timestamp & Gate Used (Emerald Theme)
      await syncSingleTab(sheetId, cTab, checkinSchema, filteredPasses, token, {
        headerBgColor: { red: 0.035, green: 0.18, blue: 0.14 } // Emerald Navy
      });

      // Save connection state in localStorage
      localStorage.setItem('passcraft_gsheet_url', sheetUrl.trim());
      localStorage.setItem('passcraft_gsheet_tab_people', pTab);
      localStorage.setItem('passcraft_gsheet_tab_checkin', cTab);
      localStorage.setItem('passcraft_gsheet_connected', 'true');
      localStorage.setItem('passcraft_gsheet_autosync', 'true');
      const nowStr = new Date().toLocaleTimeString();
      localStorage.setItem('passcraft_gsheet_last_sync', nowStr);

      setIsConnected(true);
      setAutoSyncEnabled(true);
      setLastSyncedAt(nowStr);

      setSyncStatusMsg({
        type: 'success',
        text: `Connected! Created 2 distinct sheets in your spreadsheet: Sheet 1 "${pTab}" (People Info) and Sheet 2 "${cTab}" (Check-in Timestamps & Gate Logs)!`,
      });
    } catch (err: any) {
      console.error('Google Sheets connect error:', err);
      if (err.message && (err.message.includes('401') || err.message.includes('UNAUTHENTICATED') || err.message.includes('Invalid Credentials'))) {
        setGoogleAccessToken(null);
      }
      setSyncStatusMsg({
        type: 'error',
        text: `Connection error: ${err.message || 'Could not connect to Google Sheet. Please ensure you granted permissions.'}`,
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // Sync Both Sheets (People Info + Check-in & Gate Logs)
  const handleSyncBothSheets = async () => {
    const sheetId = extractSpreadsheetId(sheetUrl);
    if (!sheetId) {
      setSyncStatusMsg({
        type: 'error',
        text: 'Please enter a valid Google Sheet URL first.',
      });
      return;
    }

    setIsPushing(true);
    setSyncStatusMsg(null);

    try {
      let token = await getGoogleAccessToken();
      if (!token) {
        const authResult = await connectGoogleSheetsAuth(false);
        token = authResult.accessToken;
        if (authResult.user?.email) {
          setConnectedUserEmail(authResult.user.email);
        }
      }

      const pTab = peopleTabName.trim() || 'PassCraft Roster';
      const cTab = checkinTabName.trim() || 'Check-in & Gate Activity';

      // 1. Sync People Info Sheet Tab
      await syncSingleTab(sheetId, pTab, peopleSchema, filteredPasses, token, {
        headerBgColor: { red: 0.0588, green: 0.0902, blue: 0.1647 }
      });

      // 2. Sync Check-in & Gate Activity Sheet Tab
      await syncSingleTab(sheetId, cTab, checkinSchema, filteredPasses, token, {
        headerBgColor: { red: 0.035, green: 0.18, blue: 0.14 }
      });

      const now = new Date().toLocaleTimeString();
      setLastSyncedAt(now);
      localStorage.setItem('passcraft_gsheet_last_sync', now);
      setIsConnected(true);

      setSyncStatusMsg({
        type: 'success',
        text: `Successfully synced both tabs! Tab 1 "${pTab}" has ${filteredPasses.length} People records, and Tab 2 "${cTab}" has Check-in Timestamps & Gates Used!`,
      });
    } catch (err: any) {
      console.error('Google Sheets dual sync error:', err);
      if (err.message && (err.message.includes('401') || err.message.includes('UNAUTHENTICATED') || err.message.includes('Invalid Credentials'))) {
        setGoogleAccessToken(null);
      }
      setSyncStatusMsg({
        type: 'error',
        text: `Sync error: ${err.message || 'Could not sync to Google Sheet.'}`,
      });
    } finally {
      setIsPushing(false);
    }
  };

  // Sync Only Current Active Tab
  const handleSyncCurrentTab = async () => {
    const sheetId = extractSpreadsheetId(sheetUrl);
    if (!sheetId) {
      setSyncStatusMsg({
        type: 'error',
        text: 'Please enter a valid Google Sheet URL first.',
      });
      return;
    }

    setIsPushing(true);
    setSyncStatusMsg(null);

    try {
      let token = await getGoogleAccessToken();
      if (!token) {
        const authResult = await connectGoogleSheetsAuth(false);
        token = authResult.accessToken;
        if (authResult.user?.email) {
          setConnectedUserEmail(authResult.user.email);
        }
      }

      const activeSchema = activeSheetView === 'people' ? peopleSchema : checkinSchema;
      const targetTab = currentTabName.trim() || (activeSheetView === 'people' ? 'PassCraft Roster' : 'Check-in & Gate Activity');
      const headerBg = activeSheetView === 'people' 
        ? { red: 0.0588, green: 0.0902, blue: 0.1647 }
        : { red: 0.035, green: 0.18, blue: 0.14 };

      await syncSingleTab(sheetId, targetTab, activeSchema, filteredPasses, token, { headerBgColor: headerBg });

      const now = new Date().toLocaleTimeString();
      setLastSyncedAt(now);
      localStorage.setItem('passcraft_gsheet_last_sync', now);
      setIsConnected(true);

      setSyncStatusMsg({
        type: 'success',
        text: `Updated sheet tab "${targetTab}" with ${filteredPasses.length} rows!`,
      });
    } catch (err: any) {
      console.error('Google Sheets sync error:', err);
      if (err.message && (err.message.includes('401') || err.message.includes('UNAUTHENTICATED') || err.message.includes('Invalid Credentials'))) {
        setGoogleAccessToken(null);
      }
      setSyncStatusMsg({
        type: 'error',
        text: `Sync error: ${err.message || 'Could not sync to Google Sheet.'}`,
      });
    } finally {
      setIsPushing(false);
    }
  };

  // Disconnect Sheet
  const handleDisconnect = () => {
    localStorage.removeItem('passcraft_gsheet_connected');
    localStorage.setItem('passcraft_gsheet_autosync', 'false');
    setIsConnected(false);
    setAutoSyncEnabled(false);
    setGoogleAccessToken(null);
    setAvailableTabs([]);
    setSyncStatusMsg({ type: 'info', text: 'Google Sheet disconnected from auto-sync.' });
    setTimeout(() => setSyncStatusMsg(null), 3000);
  };

  // Copy TSV for current view
  const handleCopyTsv = (schema: ColumnDef[], label: string) => {
    const headerLine = schema.map(c => c.header).join('\t');
    const dataLines = filteredPasses.map((p, idx) => {
      return schema.map(c => formatCellValue(p, c.key, idx + 2)).join('\t');
    });
    const tsv = [headerLine, ...dataLines].join('\n');
    navigator.clipboard.writeText(tsv);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2500);
  };

  // Download CSV helper
  const handleDownloadCsv = (schema: ColumnDef[], filenameSuffix: string) => {
    const escapeCsv = (val: string) => `"${val.replace(/"/g, '""')}"`;
    const headerLine = schema.map(c => escapeCsv(c.header)).join(',');
    const dataLines = filteredPasses.map((p, idx) => {
      return schema.map(c => escapeCsv(formatCellValue(p, c.key, idx + 2))).join(',');
    });
    const csvContent = [headerLine, ...dataLines].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `PassCraft_${eventTitle.replace(/[^a-z0-9]/gi, '_')}_${filenameSuffix}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Run AI Sheet Mapping & Formula Analysis
  const handleRunAiAnalysis = async () => {
    setIsAnalyzing(true);
    setSyncStatusMsg(null);
    try {
      const res = await safeFetchJson<{ success: boolean; data: AIAnalysisResult }>('/api/gemini/sheets-smart-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passes: filteredPasses,
          eventTitle: eventTitle,
          customGoal: customAiPrompt.trim() || undefined,
        }),
      });

      if (res.ok && res.data?.data) {
        setAiData(res.data.data);
        setSyncStatusMsg({
          type: 'success',
          text: `AI schema analysis complete! Structured for dual-sheet People Info & Turnstile Gate tracking.`,
        });
      } else {
        throw new Error('AI analysis returned empty response');
      }
    } catch (err: any) {
      console.warn('AI Sheets Analysis note:', err);
      setAiData({
        columnSchema: peopleSchema,
        formulas: {
          totalRegistered: '=COUNTA(C2:C)',
          totalCheckedIn: '=COUNTIF(\'Check-in & Gate Activity\'!J2:J, "checked_in")',
          attendanceRate: '=IFERROR(TEXT(COUNTIF(\'Check-in & Gate Activity\'!J2:J, "checked_in")/MAX(1, COUNTA(\'PassCraft Roster\'!C2:C)), "0.0%"), "0.0%")',
          totalRevenue: '=SUM(\'PassCraft Roster\'!H2:H)',
          vipAttendance: '=COUNTIFS(\'PassCraft Roster\'!G2:G, "*VIP*", \'Check-in & Gate Activity\'!J2:J, "checked_in")',
        },
        executiveSummary: `Dual-Sheet Architecture: Sheet 1 (People Info) maintains clean attendee directory and ticket pricing. Sheet 2 (Check-in & Gate Activity) logs exact scan timestamps and gate turnstiles separately.`,
        dataInsights: [
          `Sheet 1: ${filteredPasses.length} Attendee profiles with 16-digit pass codes & live QR formulas`,
          `Sheet 2: Check-in timestamps and Gate Used columns separated into dedicated audit tab`,
          `Multi-gate support: Turnstile history preserves all gate checkpoints and entry counts`
        ],
        suggestedTabNames: ["PassCraft Roster", "Check-in & Gate Activity", "VIP Checkpoints"]
      });
      setSyncStatusMsg({ type: 'info', text: 'Dual-sheet formulas and layout configured.' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div id="google_sheets_sync_root" className="space-y-6 animate-fadeIn">
      {/* Top Banner / Integration Header */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase tracking-wider rounded-full flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5" /> Official Google Sheets Integration
              </span>
              <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold uppercase rounded-full flex items-center gap-1">
                <Layers className="w-3 h-3 text-indigo-400" /> Dual-Sheet Architecture
              </span>
              {isConnected ? (
                <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase rounded-full flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-emerald-400" /> Auto-Sync Active
                </span>
              ) : null}
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Google Sheets <span className="text-emerald-400">Dual-Tab Table Sync</span>
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Separates your data into two organized sheets: <strong>Sheet 1 for Normal People &amp; Pass Info</strong> (attendee profile, ticket tier, price) and <strong>Sheet 2 for Check-in Timestamps &amp; Gates Used</strong> (turnstile scan logs, gate names, total admissions).
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              id="btn_copy_tsv"
              onClick={() => handleCopyTsv(currentColumns, 'tsv')}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-2 transition-all cursor-pointer shadow-sm"
              title="Copy formatted table for the active view"
            >
              {copiedText === 'tsv' ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300">Copied Table!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-indigo-400" />
                  <span>Copy {activeSheetView === 'people' ? 'People' : 'Gate'} Table</span>
                </>
              )}
            </button>

            {/* Download CSV Dropdown / Options */}
            <div className="flex items-center gap-1.5">
              <button
                id="btn_download_people_csv"
                onClick={() => handleDownloadCsv(peopleSchema, 'People_Info_Roster')}
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                title="Download People & Pass Directory CSV (Clean, without check-in timestamps)"
              >
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                <span>People CSV</span>
              </button>

              <button
                id="btn_download_checkin_csv"
                onClick={() => handleDownloadCsv(checkinSchema, 'Checkin_And_Gate_Logs')}
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                title="Download Check-in Timestamps and Gate Used CSV"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Gate Logs CSV</span>
              </button>
            </div>

            {isConnected && (
              <button
                id="btn_manual_push_both"
                onClick={handleSyncBothSheets}
                disabled={isPushing}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isPushing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Syncing Both Sheets...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Sync Both Sheets Now</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Status notification banner */}
        {syncStatusMsg && (
          <div className={`mt-4 p-3 rounded-xl text-xs font-medium flex items-center gap-2.5 ${
            syncStatusMsg.type === 'success' ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-200' :
            syncStatusMsg.type === 'error' ? 'bg-rose-950/60 border border-rose-500/40 text-rose-200' :
            'bg-indigo-950/60 border border-indigo-500/40 text-indigo-200'
          }`}>
            {syncStatusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> :
             syncStatusMsg.type === 'error' ? <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" /> :
             <Info className="w-4 h-4 text-indigo-400 shrink-0" />}
            <span>{syncStatusMsg.text}</span>
          </div>
        )}
      </div>

      {/* Main Grid: Connection Setup & AI Assistant */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (2/3): Connection Config & Data Filters */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card 1: Google Sheet Connection Coordinates & Dual Tab Setup */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Spreadsheet &amp; 2-Sheet Destination</h3>
              </div>
              {lastSyncedAt && (
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Last synced: {lastSyncedAt}
                </span>
              )}
            </div>

            <div className="space-y-4">
              {/* Google Sheet Link Input */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    1. Google Sheet Link / URL <span className="text-emerald-400">*</span>
                  </label>
                  {connectedSpreadsheetTitle && (
                    <span className="text-[11px] font-bold text-emerald-400 truncate max-w-[280px]">
                      📄 {connectedSpreadsheetTitle}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="input_gsheet_url"
                    type="text"
                    value={sheetUrl}
                    onChange={e => {
                      setSheetUrl(e.target.value);
                      localStorage.setItem('passcraft_gsheet_url', e.target.value.trim());
                    }}
                    placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-4 pr-10 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono shadow-inner"
                  />
                  {sheetUrl && (
                    <a
                      href={sheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute right-3 top-3 text-slate-400 hover:text-emerald-400"
                      title="Open Google Sheet in new tab"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Paste the URL from your browser address bar when viewing your Google Spreadsheet.
                </p>
              </div>

              {/* 2 Destination Sheet Tabs Config & Column Selectors */}
              <div className="space-y-4 pt-1">
                
                {/* Tab 1: People & Pass Info */}
                <div className="bg-slate-950/90 border border-indigo-500/30 p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Sheet 1: People &amp; Pass Info Destination</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded font-mono font-bold border border-indigo-500/30">
                        {peopleColKeys.length} Columns Selected
                      </span>
                    </div>
                  </div>

                  {/* Tab Name Input & Sheet Selector Dropdown */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-1 font-medium">Sheet Tab Name:</span>
                      <input
                        id="input_people_tab"
                        type="text"
                        value={peopleTabName}
                        onChange={e => {
                          setPeopleTabName(e.target.value);
                          localStorage.setItem('passcraft_gsheet_tab_people', e.target.value);
                        }}
                        placeholder="e.g. PassCraft Roster"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500 shadow-inner"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-slate-400 font-medium">Select from Spreadsheet:</span>
                        <button
                          type="button"
                          onClick={() => fetchAvailableTabsFromSheet()}
                          disabled={isLoadingTabs}
                          className="text-[9px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw className={`w-2.5 h-2.5 ${isLoadingTabs ? 'animate-spin' : ''}`} />
                          <span>Detect Tabs</span>
                        </button>
                      </div>
                      <select
                        id="select_people_sheet_tab"
                        value={availableTabs.some(t => t.title === peopleTabName) ? peopleTabName : ''}
                        onChange={e => {
                          if (e.target.value) {
                            setPeopleTabName(e.target.value);
                            localStorage.setItem('passcraft_gsheet_tab_people', e.target.value);
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        <option value="">{availableTabs.length > 0 ? '-- Pick Existing Tab --' : '-- Type name or connect sheet --'}</option>
                        {availableTabs.map((tab) => (
                          <option key={tab.sheetId} value={tab.title}>
                            📄 {tab.title} (Tab #{tab.index + 1})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Quick Sheet Name Chips */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[10px] text-slate-500 font-mono">Suggestions:</span>
                    {['PassCraft Roster', 'Sheet1', 'Attendees', 'VIP Directory'].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => {
                          setPeopleTabName(chip);
                          localStorage.setItem('passcraft_gsheet_tab_people', chip);
                        }}
                        className={`text-[10px] px-2 py-0.5 rounded border transition-all cursor-pointer ${
                          peopleTabName === chip 
                            ? 'bg-indigo-600 text-white border-indigo-500 font-bold' 
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>

                  {/* Column Customizer Collapsible Toggle */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setOpenCustomizer(openCustomizer === 'people' ? null : 'people')}
                      className="w-full px-3 py-2 bg-slate-900 hover:bg-slate-850 border border-indigo-500/20 hover:border-indigo-500/40 rounded-lg flex items-center justify-between text-xs text-indigo-200 font-bold transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Choose What Comes in Sheet 1 ({peopleColKeys.length} of {ALL_SHEET_COLUMNS.length} fields)</span>
                      </div>
                      {openCustomizer === 'people' ? (
                        <ChevronUp className="w-4 h-4 text-indigo-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-indigo-400" />
                      )}
                    </button>

                    {/* Column Picker Panel for Sheet 1 */}
                    {openCustomizer === 'people' && (
                      <div className="mt-2.5 p-3.5 bg-slate-900/95 border border-indigo-500/30 rounded-xl space-y-3">
                        {/* Preset Buttons */}
                        <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-slate-800">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mr-1">Presets:</span>
                          <button
                            type="button"
                            onClick={() => applyPreset('people', 'default')}
                            className="px-2.5 py-1 rounded bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 text-[10px] font-bold cursor-pointer transition-all"
                          >
                            ✨ Standard Roster
                          </button>
                          <button
                            type="button"
                            onClick={() => applyPreset('people', 'contact')}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[10px] font-bold cursor-pointer transition-all"
                          >
                            👤 Contact Only
                          </button>
                          <button
                            type="button"
                            onClick={() => applyPreset('people', 'compact')}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[10px] font-bold cursor-pointer transition-all"
                          >
                            ⚡ Compact
                          </button>
                          <button
                            type="button"
                            onClick={() => applyPreset('people', 'all')}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[10px] font-bold cursor-pointer transition-all"
                          >
                            📋 All 15 Fields
                          </button>
                        </div>

                        {/* Column Checkboxes Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                          {ALL_SHEET_COLUMNS.map((col) => {
                            const isSelected = peopleColKeys.includes(col.key);
                            return (
                              <label
                                key={col.key}
                                onClick={() => toggleColumn('people', col.key)}
                                className={`flex items-start gap-2 p-2 rounded-lg border text-left cursor-pointer transition-all ${
                                  isSelected
                                    ? 'bg-indigo-950/60 border-indigo-500/50 text-white'
                                    : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}}
                                  className="mt-0.5 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] font-bold truncate block">{col.header}</span>
                                    <span className={`text-[8px] px-1 py-0.2 rounded font-mono uppercase font-bold ${
                                      col.type === 'formula' ? 'bg-purple-500/20 text-purple-300' :
                                      col.type === 'number' ? 'bg-amber-500/20 text-amber-300' :
                                      col.type === 'date' ? 'bg-cyan-500/20 text-cyan-300' :
                                      col.type === 'status' ? 'bg-emerald-500/20 text-emerald-300' :
                                      'bg-slate-700/40 text-slate-400'
                                    }`}>
                                      {col.type}
                                    </span>
                                  </div>
                                  <span className="text-[9px] text-slate-500 block truncate">{col.description}</span>
                                </div>
                              </label>
                            );
                          })}
                        </div>

                        {/* Selected Pills Display */}
                        <div className="flex items-center gap-1 flex-wrap pt-1 text-[10px] text-slate-400 font-mono">
                          <span className="text-slate-500 font-bold">Included Columns:</span>
                          {peopleSchema.map((c, i) => (
                            <span key={c.key} className="bg-indigo-950 text-indigo-300 border border-indigo-800/60 px-1.5 py-0.5 rounded text-[9px]">
                              {i + 1}. {c.header}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tab 2: Check-in Timestamp & Gate Used */}
                <div className="bg-slate-950/90 border border-emerald-500/30 p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Sheet 2: Check-in &amp; Gates Destination</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono font-bold border border-emerald-500/30">
                        {checkinColKeys.length} Columns Selected
                      </span>
                    </div>
                  </div>

                  {/* Tab Name Input & Sheet Selector Dropdown */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-1 font-medium">Sheet Tab Name:</span>
                      <input
                        id="input_checkin_tab"
                        type="text"
                        value={checkinTabName}
                        onChange={e => {
                          setCheckinTabName(e.target.value);
                          localStorage.setItem('passcraft_gsheet_tab_checkin', e.target.value);
                        }}
                        placeholder="e.g. Check-in & Gate Activity"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500 shadow-inner"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-slate-400 font-medium">Select from Spreadsheet:</span>
                        <button
                          type="button"
                          onClick={() => fetchAvailableTabsFromSheet()}
                          disabled={isLoadingTabs}
                          className="text-[9px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw className={`w-2.5 h-2.5 ${isLoadingTabs ? 'animate-spin' : ''}`} />
                          <span>Detect Tabs</span>
                        </button>
                      </div>
                      <select
                        id="select_checkin_sheet_tab"
                        value={availableTabs.some(t => t.title === checkinTabName) ? checkinTabName : ''}
                        onChange={e => {
                          if (e.target.value) {
                            setCheckinTabName(e.target.value);
                            localStorage.setItem('passcraft_gsheet_tab_checkin', e.target.value);
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        <option value="">{availableTabs.length > 0 ? '-- Pick Existing Tab --' : '-- Type name or connect sheet --'}</option>
                        {availableTabs.map((tab) => (
                          <option key={tab.sheetId} value={tab.title}>
                            📄 {tab.title} (Tab #{tab.index + 1})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Quick Sheet Name Chips */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[10px] text-slate-500 font-mono">Suggestions:</span>
                    {['Check-in & Gate Activity', 'Sheet2', 'Gate Logs', 'Turnstile Audit'].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => {
                          setCheckinTabName(chip);
                          localStorage.setItem('passcraft_gsheet_tab_checkin', chip);
                        }}
                        className={`text-[10px] px-2 py-0.5 rounded border transition-all cursor-pointer ${
                          checkinTabName === chip 
                            ? 'bg-emerald-600 text-white border-emerald-500 font-bold' 
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>

                  {/* Column Customizer Collapsible Toggle */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setOpenCustomizer(openCustomizer === 'checkin' ? null : 'checkin')}
                      className="w-full px-3 py-2 bg-slate-900 hover:bg-slate-850 border border-emerald-500/20 hover:border-emerald-500/40 rounded-lg flex items-center justify-between text-xs text-emerald-200 font-bold transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Choose What Comes in Sheet 2 ({checkinColKeys.length} of {ALL_SHEET_COLUMNS.length} fields)</span>
                      </div>
                      {openCustomizer === 'checkin' ? (
                        <ChevronUp className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-emerald-400" />
                      )}
                    </button>

                    {/* Column Picker Panel for Sheet 2 */}
                    {openCustomizer === 'checkin' && (
                      <div className="mt-2.5 p-3.5 bg-slate-900/95 border border-emerald-500/30 rounded-xl space-y-3">
                        {/* Preset Buttons */}
                        <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-slate-800">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mr-1">Presets:</span>
                          <button
                            type="button"
                            onClick={() => applyPreset('checkin', 'default')}
                            className="px-2.5 py-1 rounded bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/40 text-[10px] font-bold cursor-pointer transition-all"
                          >
                            ✨ Standard Gate &amp; Time
                          </button>
                          <button
                            type="button"
                            onClick={() => applyPreset('checkin', 'turnstile')}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[10px] font-bold cursor-pointer transition-all"
                          >
                            🛡️ Turnstiles Only
                          </button>
                          <button
                            type="button"
                            onClick={() => applyPreset('checkin', 'compact')}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[10px] font-bold cursor-pointer transition-all"
                          >
                            ⚡ Compact
                          </button>
                          <button
                            type="button"
                            onClick={() => applyPreset('checkin', 'all')}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[10px] font-bold cursor-pointer transition-all"
                          >
                            📋 All 15 Fields
                          </button>
                        </div>

                        {/* Column Checkboxes Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                          {ALL_SHEET_COLUMNS.map((col) => {
                            const isSelected = checkinColKeys.includes(col.key);
                            return (
                              <label
                                key={col.key}
                                onClick={() => toggleColumn('checkin', col.key)}
                                className={`flex items-start gap-2 p-2 rounded-lg border text-left cursor-pointer transition-all ${
                                  isSelected
                                    ? 'bg-emerald-950/60 border-emerald-500/50 text-white'
                                    : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}}
                                  className="mt-0.5 rounded bg-slate-900 border-slate-700 text-emerald-600 focus:ring-0 cursor-pointer"
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] font-bold truncate block">{col.header}</span>
                                    <span className={`text-[8px] px-1 py-0.2 rounded font-mono uppercase font-bold ${
                                      col.type === 'formula' ? 'bg-purple-500/20 text-purple-300' :
                                      col.type === 'number' ? 'bg-amber-500/20 text-amber-300' :
                                      col.type === 'date' ? 'bg-cyan-500/20 text-cyan-300' :
                                      col.type === 'status' ? 'bg-emerald-500/20 text-emerald-300' :
                                      'bg-slate-700/40 text-slate-400'
                                    }`}>
                                      {col.type}
                                    </span>
                                  </div>
                                  <span className="text-[9px] text-slate-500 block truncate">{col.description}</span>
                                </div>
                              </label>
                            );
                          })}
                        </div>

                        {/* Selected Pills Display */}
                        <div className="flex items-center gap-1 flex-wrap pt-1 text-[10px] text-slate-400 font-mono">
                          <span className="text-slate-500 font-bold">Included Columns:</span>
                          {checkinSchema.map((c, i) => (
                            <span key={c.key} className="bg-emerald-950 text-emerald-300 border border-emerald-800/60 px-1.5 py-0.5 rounded text-[9px]">
                              {i + 1}. {c.header}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Real-time sync checkbox */}
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-200 block">Automatic Real-Time Sync</span>
                  <span className="text-[10px] text-slate-400">Updates both sheets immediately when someone is assigned or scanned at a gate</span>
                </div>
                <input
                  id="checkbox_autosync"
                  type="checkbox"
                  checked={autoSyncEnabled}
                  onChange={e => {
                    setAutoSyncEnabled(e.target.checked);
                    localStorage.setItem('passcraft_gsheet_autosync', String(e.target.checked));
                  }}
                  className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-emerald-500 focus:ring-emerald-500/20 cursor-pointer"
                />
              </div>

              {/* Connected Google Account Indicator */}
              {connectedUserEmail && (
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span>Google Permission Active: <strong className="text-white font-mono">{connectedUserEmail}</strong></span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSwitchGoogleAccount}
                    className="text-[11px] text-slate-400 hover:text-white underline underline-offset-2 transition-colors cursor-pointer"
                  >
                    Switch Account
                  </button>
                </div>
              )}

              {/* Big Connect / Re-sync Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                <button
                  id="btn_connect_gsheet"
                  type="button"
                  onClick={handleConnectSheet}
                  disabled={isConnecting || !sheetUrl.trim()}
                  className={`w-full sm:w-auto px-8 py-3.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xl ${
                    isConnected
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                      : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/30'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isConnecting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Connecting &amp; Formatting Dual Sheets...</span>
                    </>
                  ) : isConnected ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Connected (Sync Both Tabs)</span>
                    </>
                  ) : (
                    <>
                      <Link2 className="w-4 h-4" />
                      <span>Connect &amp; Create Both Sheets</span>
                    </>
                  )}
                </button>

                {isConnected && (
                  <button
                    id="btn_disconnect_gsheet"
                    type="button"
                    onClick={handleDisconnect}
                    className="px-4 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl border border-slate-700 transition-all cursor-pointer"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Scope Filter Selection */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Sync Scope &amp; Filters</h3>
              </div>
              <span className="text-xs font-bold text-indigo-400 font-mono">
                {filteredPasses.length} / {passes.length} Passes In Scope
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={() => setFilterScope('assigned_only')}
                className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  filterScope === 'assigned_only'
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span>Assigned Passes</span>
                <span className="text-[10px] font-mono opacity-80">
                  {eventPasses.filter(p => p.status === 'assigned' || p.status === 'checked_in').length}
                </span>
              </button>

              <button
                onClick={() => setFilterScope('all')}
                className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  filterScope === 'all'
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span>All Passes</span>
                <span className="text-[10px] font-mono opacity-80">{eventPasses.length}</span>
              </button>

              <button
                onClick={() => setFilterScope('checked_in_only')}
                className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  filterScope === 'checked_in_only'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span>Gate Checked-In</span>
                <span className="text-[10px] font-mono opacity-80">
                  {eventPasses.filter(p => p.status === 'checked_in').length}
                </span>
              </button>

              <button
                onClick={() => setFilterScope('unassigned_only')}
                className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  filterScope === 'unassigned_only'
                    ? 'bg-amber-600 text-white border-amber-500 shadow-md'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span>Unassigned Queue</span>
                <span className="text-[10px] font-mono opacity-80">
                  {eventPasses.filter(p => p.status === 'unassigned').length}
                </span>
              </button>
            </div>
          </div>

          {/* Card 3: Interactive Dual-Tab Live Preview Table */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
            
            {/* View Switcher Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Table className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Live Sheet Preview ({filteredPasses.length} Rows)
                </h3>
              </div>

              {/* Switcher Buttons: Sheet 1 vs Sheet 2 */}
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveSheetView('people')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeSheetView === 'people'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Sheet 1: People Info</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSheetView('checkin')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeSheetView === 'checkin'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Sheet 2: Check-in &amp; Gates</span>
                </button>
              </div>
            </div>

            {/* Tab Destination Info Header */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5">
                Target Spreadsheet Tab: <span className="text-white font-mono font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800">[{currentTabName}]</span>
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Showing first {Math.min(filteredPasses.length, 5)} rows
              </span>
            </div>

            {/* Visual simulation of Google Sheets formatted table */}
            <div className="overflow-x-auto rounded-xl border border-slate-800 shadow-md">
              <table className="w-full text-left text-xs border-collapse font-sans">
                <thead>
                  <tr className={`text-slate-200 border-b border-slate-800 text-[11px] uppercase tracking-wider ${
                    activeSheetView === 'people' ? 'bg-slate-950' : 'bg-emerald-950/60'
                  }`}>
                    {currentColumns.map((col, idx) => (
                      <th key={idx} className="px-3.5 py-3 font-black whitespace-nowrap border-r border-slate-800 last:border-r-0">
                        {col.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 bg-slate-900/90 font-mono text-[11px]">
                  {filteredPasses.slice(0, 5).map((pass, rowIdx) => {
                    const isEven = rowIdx % 2 === 0;
                    return (
                      <tr 
                        key={pass.id} 
                        className={isEven ? 'bg-slate-900/40 hover:bg-slate-800/60' : 'bg-slate-950/40 hover:bg-slate-800/60'}
                      >
                        {currentColumns.map((col, colIdx) => {
                          const val = formatCellValue(pass, col.key, rowIdx + 2);
                          return (
                            <td 
                              key={colIdx} 
                              className="px-3.5 py-2.5 text-slate-300 whitespace-nowrap border-r border-slate-800/60 last:border-r-0"
                            >
                              {col.key === 'status' ? (
                                <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-sans font-bold ${
                                  val === 'checked_in' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
                                  val === 'assigned' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40' :
                                  'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                                }`}>
                                  {val}
                                </span>
                              ) : col.key === 'qrImage' ? (
                                <span className="text-[10px] text-indigo-300 font-mono truncate max-w-[140px] block" title={val}>
                                  =IMAGE(QR)
                                </span>
                              ) : col.key === 'gateName' ? (
                                <span className={`font-bold ${val && val !== '-' ? 'text-emerald-400' : 'text-slate-500'}`}>
                                  {val || '-'}
                                </span>
                              ) : col.key === 'checkedInAt' ? (
                                <span className={`font-mono ${val ? 'text-cyan-300 font-bold' : 'text-slate-500'}`}>
                                  {val || 'Not Checked In'}
                                </span>
                              ) : (
                                val || '-'
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {filteredPasses.length === 0 && (
                    <tr>
                      <td colSpan={currentColumns.length} className="px-4 py-8 text-center text-slate-500 font-sans">
                        No passes match the current filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Push individual tab button */}
            {isConnected && (
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleSyncCurrentTab}
                  disabled={isPushing}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isPushing ? 'animate-spin' : ''}`} />
                  <span>Sync Only Tab [{currentTabName}]</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1/3): AI Copilot & Smart Google Sheet Formulas */}
        <div className="space-y-6">
          
          {/* AI Optimizer Card */}
          <div className="bg-gradient-to-b from-indigo-950/40 to-slate-900 border border-indigo-500/30 p-5 rounded-2xl space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">AI Dual-Sheet Assistant</h3>
              </div>
              <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-[9px] font-black uppercase rounded-full">
                Gemini AI
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Generate cross-sheet KPI formulas connecting the People Info sheet and Gate Check-in log sheet:
            </p>

            <div className="space-y-2">
              <input
                id="input_ai_prompt"
                type="text"
                value={customAiPrompt}
                onChange={e => setCustomAiPrompt(e.target.value)}
                placeholder="e.g. Cross-sheet KPI formulas for VIP gates..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
              <button
                id="btn_ai_sheet_opt"
                type="button"
                onClick={handleRunAiAnalysis}
                disabled={isAnalyzing}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing Dual Sheets with AI...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate AI Cross-Sheet Formulas</span>
                  </>
                )}
              </button>
            </div>

            {/* AI Executive Summary */}
            {aiData?.executiveSummary && (
              <div className="p-3 bg-slate-950/80 border border-indigo-500/20 rounded-xl space-y-2">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">
                  AI Architecture Overview
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {aiData.executiveSummary}
                </p>
                {aiData.dataInsights && aiData.dataInsights.length > 0 && (
                  <ul className="space-y-1 pt-1 border-t border-slate-800">
                    {aiData.dataInsights.map((insight, idx) => (
                      <li key={idx} className="text-[11px] text-slate-400 flex items-start gap-1.5">
                        <span className="text-emerald-400">✓</span> {insight}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Google Sheets KPI Formulas to Copy */}
            {aiData?.formulas && (
              <div className="space-y-2.5 pt-2 border-t border-slate-800">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  Cross-Sheet Formulas
                </span>

                <div className="space-y-2 text-xs">
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">Total Checked-In (Gate Sheet)</span>
                      <span className="font-mono text-emerald-400 text-[11px]">{aiData.formulas.totalCheckedIn}</span>
                    </div>
                    <button
                      onClick={() => handleCopyTsv([{ key: 'f', header: aiData.formulas.totalCheckedIn, type: 'text' }], 'f1')}
                      className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white cursor-pointer"
                      title="Copy formula"
                    >
                      {copiedText === 'f1' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">Live Turnstile Attendance %</span>
                      <span className="font-mono text-indigo-400 text-[11px]">{aiData.formulas.attendanceRate}</span>
                    </div>
                    <button
                      onClick={() => handleCopyTsv([{ key: 'f', header: aiData.formulas.attendanceRate, type: 'text' }], 'f2')}
                      className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white cursor-pointer"
                      title="Copy formula"
                    >
                      {copiedText === 'f2' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans">Total Ticket Revenue (People Sheet)</span>
                      <span className="font-mono text-amber-400 text-[11px]">{aiData.formulas.totalRevenue}</span>
                    </div>
                    <button
                      onClick={() => handleCopyTsv([{ key: 'f', header: aiData.formulas.totalRevenue, type: 'text' }], 'f3')}
                      className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white cursor-pointer"
                      title="Copy formula"
                    >
                      {copiedText === 'f3' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Steps Card */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> How Dual-Sheet Sync Works
            </h4>
            <ol className="space-y-2 text-xs text-slate-400 list-decimal list-inside leading-relaxed">
              <li>
                <strong className="text-slate-200">Sheet 1 (People Info):</strong> Stores clean attendee registration, email, phone, ticket tier, and price without turnstile log clutter.
              </li>
              <li>
                <strong className="text-slate-200">Sheet 2 (Check-in &amp; Gates):</strong> Dedicated log containing the exact <strong>check-in stamp date/time</strong>, <strong>gate used</strong>, and scan counts.
              </li>
              <li>
                <strong className="text-slate-200">1-Click Dual Sync:</strong> Clicking <em>"Sync Both Sheets Now"</em> creates and formats both sheet tabs automatically.
              </li>
              <li>
                <strong className="text-slate-200">Real-Time Updates:</strong> As turnstiles admit attendees or organizers assign passes, both sheets refresh in real-time.
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};
