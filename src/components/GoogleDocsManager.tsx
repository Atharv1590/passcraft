import React, { useState, useEffect } from 'react';
import { EventItem, PassItem, FinancialEntry } from '../types';
import { 
  getWorkspaceAccessToken, 
  connectGoogleWorkspaceAuth,
  invalidateWorkspaceAccessToken,
  checkWorkspaceTokenValidity,
  isUserAuthCancellation 
} from '../lib/workspaceAuth';
import { 
  createEventPrintablePassesDoc, 
  createExecutiveReportDoc, 
  createAttendeeRosterDoc, 
  createBlankGoogleDoc,
  fetchGoogleDocDetails,
  extractDocumentId,
  buildExecutiveReportText,
  CreatedDocResult 
} from '../lib/googleDocsService';
import {
  saveGoogleDocsToCloud,
  loadGoogleDocsFromCloud,
  getStoredSession
} from '../lib/firebase';
import { 
  FileText, 
  Sparkles, 
  ExternalLink, 
  Copy, 
  Check, 
  Plus, 
  Printer, 
  TrendingUp, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Eye, 
  X, 
  FileCheck, 
  Calendar,
  Layers,
  Trash2,
  FileSpreadsheet,
  Moon,
  SunMedium
} from 'lucide-react';

interface GoogleDocsManagerProps {
  events: EventItem[];
  passes: PassItem[];
  financials: FinancialEntry[];
  selectedEventId: string;
  onSelectEvent?: (eventId: string) => void;
  userEmail?: string;
}

export const GoogleDocsManager: React.FC<GoogleDocsManagerProps> = ({
  events,
  passes,
  financials,
  selectedEventId,
  userEmail,
}) => {
  const [accessToken, setAccessToken] = useState<string | null>(() => getWorkspaceAccessToken());
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Active event
  const currentSelectedEvent = selectedEventId === 'all' 
    ? events[0] 
    : events.find(e => e.id === selectedEventId) || events[0];

  const targetPasses = selectedEventId === 'all' 
    ? passes 
    : passes.filter(p => p.eventId === selectedEventId);

  const effectiveEmail = (userEmail || getStoredSession()?.email || 'atharvdhanawade15@gmail.com').trim().toLowerCase();

  // Created Docs List with persistence
  const [createdDocs, setCreatedDocs] = useState<CreatedDocResult[]>(() => {
    try {
      const saved = localStorage.getItem('passcraft_created_docs_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });

  const [docFilterType, setDocFilterType] = useState<'all' | 'printable_passes' | 'executive_report' | 'attendee_roster'>('all');
  const [isCreating, setIsCreating] = useState(false);
  const [creationStatus, setCreationStatus] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Document Preview Modal
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{ title: string; bodyText: string } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Executive Report Local Viewer Modal
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportModalContent, setReportModalContent] = useState('');

  // Custom Doc Input Form
  const [customDocTitle, setCustomDocTitle] = useState('');
  const [inputDocUrl, setInputDocUrl] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; desc: string; action: () => void } | null>(null);

  // Initial cloud sync load
  useEffect(() => {
    if (!effectiveEmail) return;
    loadGoogleDocsFromCloud(effectiveEmail).then(cloudDocs => {
      if (cloudDocs && Array.isArray(cloudDocs) && cloudDocs.length > 0) {
        setCreatedDocs(prev => {
          const map = new Map<string, CreatedDocResult>();
          cloudDocs.forEach(d => { if (d?.documentId) map.set(d.documentId, d); });
          prev.forEach(d => { if (d?.documentId) map.set(d.documentId, d); });
          const merged = Array.from(map.values());
          merged.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          return merged;
        });
      }
    });
  }, [effectiveEmail]);

  // Save to localStorage & Cloud
  useEffect(() => {
    try {
      localStorage.setItem('passcraft_created_docs_history', JSON.stringify(createdDocs));
    } catch (e) {}

    if (effectiveEmail && createdDocs.length > 0) {
      saveGoogleDocsToCloud(effectiveEmail, createdDocs);
    }
  }, [createdDocs, effectiveEmail]);

  const handleConnectAuth = async (force: boolean = false) => {
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      const res = await connectGoogleWorkspaceAuth(force);
      setAccessToken(res.accessToken);
      setCreationStatus('Google Workspace account authorized successfully.');
    } catch (err: any) {
      if (err?.isCancelled || err?.isUserCancellation || isUserAuthCancellation(err)) {
        console.warn('Google Workspace Auth: Sign-in popup was closed or cancelled by user.');
        setCreationStatus('Sign-in cancelled. Click "Connect Google Docs" when ready.');
        setAuthError(null);
        return;
      }
      console.error('Google Workspace Auth Error:', err);
      setAuthError(err?.message || 'Could not connect to Google Docs.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const executeDocAction = async (
    actionName: string,
    actionFn: (token: string) => Promise<CreatedDocResult>
  ) => {
    setIsCreating(true);
    setAuthError(null);
    setCreationStatus(`Styling Obsidian Black Theme for ${actionName}...`);

    try {
      let token = accessToken || getWorkspaceAccessToken();
      let isValid = token ? await checkWorkspaceTokenValidity(token) : false;

      if (!token || !isValid) {
        if (token && !isValid) {
          invalidateWorkspaceAccessToken();
          setAccessToken(null);
        }
        setCreationStatus('Authorizing with Google Workspace...');
        const authRes = await connectGoogleWorkspaceAuth(false);
        token = authRes.accessToken;
        setAccessToken(token);
      }

      setCreationStatus(`Creating Obsidian Black styled ${actionName} in Google Docs...`);
      const result = await actionFn(token);
      
      // Preserve all previous documents without overwriting!
      setCreatedDocs(prev => [result, ...prev.filter(d => d.documentId !== result.documentId)]);
      setCreationStatus(`Successfully generated "${result.title}" with Black Background & Custom Colors!`);
      return result;
    } catch (err: any) {
      if (err?.isCancelled || err?.isUserCancellation || isUserAuthCancellation(err)) {
        console.warn(`${actionName}: Sign-in popup was closed or cancelled by user.`);
        setCreationStatus('Action paused: Google sign-in was cancelled. Click "Connect Google Docs" to retry.');
        return null;
      }
      console.error(`${actionName} Error:`, err);
      const isAuth = err?.isAuthError || 
        err?.name === 'GoogleDocsAuthError' || 
        err?.status === 401 || 
        err?.message?.includes('invalid authentication credentials') ||
        err?.message?.includes('OAuth 2');

      if (isAuth) {
        invalidateWorkspaceAccessToken();
        setAccessToken(null);
        setAuthError('Google Workspace credentials expired or invalid. Please click "Reconnect Google Docs" to re-authorize.');
        setCreationStatus(`Authentication Error: Google Docs requires sign-in.`);
      } else {
        setCreationStatus(`Creation Error: ${err?.message || `Failed to create ${actionName}.`}`);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreatePrintablePassesDoc = async () => {
    await executeDocAction('Printable Passes & Badge Sheets', token => 
      createEventPrintablePassesDoc(currentSelectedEvent, targetPasses, token)
    );
  };

  const handleCreateExecutiveReportDoc = async () => {
    await executeDocAction('Executive Brief & Financial Report', token => 
      createExecutiveReportDoc(currentSelectedEvent, passes, financials, token)
    );
  };

  const handleCreateAttendeeRosterDoc = async () => {
    await executeDocAction('Attendee Admission & Gate Security Roster', token => 
      createAttendeeRosterDoc(currentSelectedEvent, targetPasses, token)
    );
  };

  const handleCreateCustomBlankDoc = async () => {
    if (!customDocTitle.trim()) return;
    const title = customDocTitle.trim();
    await executeDocAction(`Document "${title}"`, token => 
      createBlankGoogleDoc(title, token)
    );
    setCustomDocTitle('');
  };

  const handleInspectDoc = async (docIdOrUrl: string) => {
    const docId = extractDocumentId(docIdOrUrl);
    if (!docId) {
      alert('Please provide a valid Google Docs URL or Document ID.');
      return;
    }

    let token = accessToken || getWorkspaceAccessToken();
    let isValid = token ? await checkWorkspaceTokenValidity(token) : false;

    if (!token || !isValid) {
      try {
        const res = await connectGoogleWorkspaceAuth(false);
        token = res.accessToken;
        setAccessToken(token);
      } catch (e: any) {
        if (e?.isCancelled || e?.isUserCancellation || isUserAuthCancellation(e)) {
          console.warn('Inspect Doc: Sign-in popup was closed or cancelled by user.');
          return;
        }
        console.error('Inspect Doc Auth Error:', e);
        return;
      }
    }

    setIsLoadingPreview(true);
    setPreviewDocId(docId);
    setPreviewData(null);

    try {
      const data = await fetchGoogleDocDetails(docId, token);
      setPreviewData(data);
    } catch (err: any) {
      console.error('Fetch Doc Details Error:', err);
      setPreviewData({
        title: 'Error Loading Document',
        bodyText: `Could not fetch document contents: ${err?.message || 'Permission denied or invalid document ID.'}`,
      });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleRemoveDoc = (docIdToRemove: string) => {
    setCreatedDocs(prev => prev.filter(d => d.documentId !== docIdToRemove));
  };

  const filteredDocs = createdDocs.filter(d => {
    if (docFilterType === 'all') return true;
    return d.docType === docFilterType;
  });

  const printableCount = createdDocs.filter(d => d.docType === 'printable_passes').length;
  const reportCount = createdDocs.filter(d => d.docType === 'executive_report').length;
  const rosterCount = createdDocs.filter(d => d.docType === 'attendee_roster').length;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">Google Docs Command Hub</h1>
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase tracking-wider rounded-md border border-amber-500/30 flex items-center gap-1">
                  <Moon className="w-3 h-3 text-amber-400" />
                  Obsidian Black Theme
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Generate high-contrast, black-background Google Docs with gold titles, electric cyan codes, and neon badges. Never replaces or deletes previous documents.
              </p>
            </div>
          </div>

          {/* Auth Button */}
          <div className="flex items-center gap-3">
            {accessToken ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-950/60 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="font-semibold">Google Docs Connected</span>
                <button
                  onClick={() => handleConnectAuth(true)}
                  className="ml-2 text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                >
                  Switch
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleConnectAuth(false)}
                disabled={isAuthenticating}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-md shadow-blue-600/30 cursor-pointer disabled:opacity-50"
              >
                {isAuthenticating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Connect Google Docs
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Status Context Pill */}
        {currentSelectedEvent && (
          <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-slate-400">Target Event:</span>
              <span className="font-bold text-white">{currentSelectedEvent.title}</span>
              <span className="text-slate-500 font-mono">({targetPasses.length} total passes)</span>
            </div>

            {creationStatus && (
              <div className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-2 ${
                creationStatus.includes('Error') 
                  ? 'bg-rose-950/60 border border-rose-500/40 text-rose-300' 
                  : 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
              }`}>
                {creationStatus.includes('Error') ? <AlertCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>{creationStatus}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Doc Creation Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Printable Passes & Badges Sheet */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 transition-all rounded-2xl p-5 flex flex-col justify-between group shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                <Printer className="w-5 h-5" />
              </div>
              <span className="px-2 py-0.5 bg-amber-950 text-amber-300 border border-amber-800 rounded-md text-[10px] font-bold uppercase tracking-wider">
                Black + Gold
              </span>
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Printable QR Passes &amp; Badges</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Obsidian black Google Doc with Gold headers, neon badge tiers, and glowing 16-digit verification codes ready for print and turnstiles.
            </p>
          </div>

          <button
            onClick={() => {
              setConfirmDialog({
                title: 'Generate Printable Passes Google Doc',
                desc: `Create an obsidian black Google Doc with ${targetPasses.length} attendee badges for "${currentSelectedEvent?.title || 'Event'}". Your previous docs remain intact.`,
                action: handleCreatePrintablePassesDoc,
              });
            }}
            disabled={isCreating}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-50"
          >
            {isCreating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            Generate Black Theme Passes Doc
          </button>
        </div>

        {/* Card 2: Executive Brief & Financial Report */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 transition-all rounded-2xl p-5 flex flex-col justify-between group shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                <TrendingUp className="w-5 h-5" />
              </div>
              <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-md text-[10px] font-bold uppercase tracking-wider">
                KPIs &amp; Flap Desk
              </span>
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Executive Brief &amp; Audit Report</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Certified dark luxury briefing with revenue, net profit, line items, attendance capacity, and admission audit tables.
            </p>
          </div>

          <button
            onClick={() => {
              setConfirmDialog({
                title: 'Generate Executive Brief Google Doc',
                desc: 'Create an obsidian black Executive Financial & KPI Briefing doc in your Google Docs account without overwriting past documents.',
                action: handleCreateExecutiveReportDoc,
              });
            }}
            disabled={isCreating}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
          >
            {isCreating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
            Generate Executive Report Doc
          </button>
        </div>

        {/* Card 3: Attendee Admission & Gate Security Roster */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-cyan-500/40 transition-all rounded-2xl p-5 flex flex-col justify-between group shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
                <Users className="w-5 h-5" />
              </div>
              <span className="px-2 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-800 rounded-md text-[10px] font-bold uppercase tracking-wider">
                Gate Security
              </span>
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Attendee &amp; Gate Security Roster</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Comprehensive turnstile check-in log with attendee contacts, timestamped gate admissions, notes, and 16-digit pass verification IDs.
            </p>
          </div>

          <button
            onClick={() => {
              setConfirmDialog({
                title: 'Generate Gate Security Roster Google Doc',
                desc: 'Create an obsidian black Gate Security Roster doc in your Google Docs account.',
                action: handleCreateAttendeeRosterDoc,
              });
            }}
            disabled={isCreating}
            className="w-full py-2.5 px-4 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-cyan-600/20 cursor-pointer disabled:opacity-50"
          >
            {isCreating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
            Generate Gate Security Roster
          </button>
        </div>
      </div>

      {/* Quick Custom Document Creation Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Blank Black-Theme Doc</h3>
            <p className="text-[11px] text-slate-400">Initialize a new blank Google Doc pre-configured with the Obsidian Black canvas.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <input
            type="text"
            placeholder="Document title (e.g. VIP VIP Lounge Guest Notes)"
            value={customDocTitle}
            onChange={(e) => setCustomDocTitle(e.target.value)}
            className="flex-1 md:w-64 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
          <button
            onClick={handleCreateCustomBlankDoc}
            disabled={!customDocTitle.trim() || isCreating}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Doc
          </button>
        </div>
      </div>

      {/* MULTI-DOC DIRECTORY: All created docs persisted without deletion */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Document Library &amp; History ({createdDocs.length})
                <span className="text-[11px] font-normal text-slate-400">
                  — All generated documents preserved across sessions
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Access, preview, and share all your black-themed Google Docs.
              </p>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setDocFilterType('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                docFilterType === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({createdDocs.length})
            </button>
            <button
              onClick={() => setDocFilterType('printable_passes')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                docFilterType === 'printable_passes' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Passes ({printableCount})
            </button>
            <button
              onClick={() => setDocFilterType('executive_report')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                docFilterType === 'executive_report' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Reports ({reportCount})
            </button>
            <button
              onClick={() => setDocFilterType('attendee_roster')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                docFilterType === 'attendee_roster' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Rosters ({rosterCount})
            </button>
          </div>
        </div>

        {filteredDocs.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl">
            <FileText className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-400 font-medium">No documents created in this category yet.</p>
            <p className="text-[11px] text-slate-500 mt-1">Use the cards above to generate high-contrast black-theme documents in Google Docs.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDocs.map((docItem) => {
              const isPasses = docItem.docType === 'printable_passes';
              const isReport = docItem.docType === 'executive_report';
              const isRoster = docItem.docType === 'attendee_roster';

              return (
                <div
                  key={docItem.documentId}
                  className="bg-slate-950 border border-slate-800/90 hover:border-slate-700 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                      isPasses ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                      isReport ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                      isRoster ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' :
                      'bg-blue-500/10 border-blue-500/30 text-blue-400'
                    }`}>
                      {isPasses ? <Printer className="w-4 h-4" /> :
                       isReport ? <TrendingUp className="w-4 h-4" /> :
                       isRoster ? <Users className="w-4 h-4" /> :
                       <FileText className="w-4 h-4" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-white truncate" title={docItem.title}>
                          {docItem.title}
                        </h4>
                        <span className="px-1.5 py-0.2 bg-black border border-slate-700 text-slate-300 text-[9px] font-mono rounded">
                          Black Theme
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-slate-400 font-mono mt-0.5">
                        {docItem.eventTitle && (
                          <span>Event: <strong className="text-slate-300">{docItem.eventTitle}</strong></span>
                        )}
                        <span>•</span>
                        <span>Created: {new Date(docItem.createdAt).toLocaleDateString()} at {new Date(docItem.createdAt).toLocaleTimeString()}</span>
                        {docItem.itemCount !== undefined && (
                          <>
                            <span>•</span>
                            <span className="text-amber-400 font-bold">{docItem.itemCount} Passes</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <button
                      onClick={() => copyToClipboard(docItem.docUrl, docItem.documentId)}
                      className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      {copiedId === docItem.documentId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedId === docItem.documentId ? 'Copied' : 'Copy Link'}
                    </button>

                    <button
                      onClick={() => handleInspectDoc(docItem.documentId)}
                      className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-blue-300 text-xs rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Preview
                    </button>

                    <a
                      href={docItem.docUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open Live Doc
                    </a>

                    <button
                      onClick={() => {
                        setConfirmDialog({
                          title: `Remove "${docItem.title}"`,
                          desc: 'This removes the document from your local library. The Google Doc in your Google Drive will remain safe.',
                          action: () => handleRemoveDoc(docItem.documentId),
                        });
                      }}
                      className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Remove from history"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* DOCUMENT PREVIEW MODAL: TRUE OBSIDIAN BLACK LUXURY THEME */}
      {previewDocId && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0c0d12] border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-[#08080c]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Moon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    {previewData?.title || 'Obsidian Black Google Doc Preview'}
                    <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 text-[9px] font-bold rounded">
                      Black Canvas
                    </span>
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">Live Google Docs API Preview</span>
                </div>
              </div>
              <button
                onClick={() => setPreviewDocId(null)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Document Sheet in Obsidian Pitch Black (#050508) */}
            <div className="p-6 overflow-y-auto flex-1 bg-[#050508] border-y border-slate-900">
              {isLoadingPreview ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <RefreshCw className="w-8 h-8 animate-spin text-amber-400 mb-3" />
                  <span className="text-xs font-semibold">Reading document styling &amp; content from Google Docs API...</span>
                </div>
              ) : previewData ? (
                <div className="max-w-3xl mx-auto p-6 bg-[#07080b] border border-slate-800/80 rounded-xl shadow-2xl space-y-4">
                  <div className="border-b border-amber-500/30 pb-3">
                    <h2 className="text-lg font-bold text-amber-400 tracking-wide">
                      {previewData.title.toUpperCase()}
                    </h2>
                    <p className="text-[11px] text-slate-400 font-mono mt-1">
                      Obsidian Black Background • High-Contrast Cryptographic Manifest
                    </p>
                  </div>

                  <div className="text-xs font-mono text-slate-200 leading-relaxed whitespace-pre-wrap selection:bg-amber-500 selection:text-black">
                    {previewData.bodyText}
                  </div>
                </div>
              ) : (
                <div className="text-slate-500 text-center py-8">No document text available.</div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-[#08080c] text-xs">
              <span className="text-slate-400 font-mono">Doc ID: {previewDocId}</span>
              <div className="flex items-center gap-2">
                <a
                  href={`https://docs.google.com/document/d/${previewDocId}/edit`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-amber-600/30 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open Live in Google Docs
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center mb-3">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">{confirmDialog.title}</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">{confirmDialog.desc}</p>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const action = confirmDialog.action;
                  setConfirmDialog(null);
                  action();
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Generate Doc
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
