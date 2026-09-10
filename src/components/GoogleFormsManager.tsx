import React, { useState, useEffect } from 'react';
import { EventItem, PassItem } from '../types';
import { 
  getWorkspaceAccessToken, 
  connectGoogleWorkspaceAuth,
  invalidateWorkspaceAccessToken,
  checkWorkspaceTokenValidity,
  isUserAuthCancellation 
} from '../lib/workspaceAuth';
import { 
  createEventRegistrationForm, 
  createFeedbackForm, 
  fetchFormDetails, 
  fetchFormResponses, 
  convertFormResponsesToPasses,
  extractFormId,
  CreatedFormResult,
  FormResponseItem 
} from '../lib/googleFormsService';
import {
  saveGoogleFormsToCloud,
  loadGoogleFormsFromCloud,
  getStoredSession
} from '../lib/firebase';
import { 
  ClipboardList, 
  Sparkles, 
  ExternalLink, 
  Copy, 
  Check, 
  Plus, 
  RefreshCw, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  Share2, 
  QrCode, 
  Calendar, 
  Mail, 
  Phone, 
  Send,
  Trash2,
  Filter,
  Layers,
  Star,
  MessageSquare
} from 'lucide-react';

interface GoogleFormsManagerProps {
  events: EventItem[];
  passes: PassItem[];
  selectedEventId: string;
  onPassesUpdated?: (updatedPasses: PassItem[]) => void;
  onSelectEvent?: (eventId: string) => void;
  userEmail?: string;
}

export const GoogleFormsManager: React.FC<GoogleFormsManagerProps> = ({
  events,
  passes,
  selectedEventId,
  onPassesUpdated,
  userEmail,
}) => {
  const [accessToken, setAccessToken] = useState<string | null>(() => getWorkspaceAccessToken());
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Active event
  const currentSelectedEvent = selectedEventId === 'all' 
    ? events[0] 
    : events.find(e => e.id === selectedEventId) || events[0];

  const effectiveEmail = (userEmail || getStoredSession()?.email || 'atharvdhanawade15@gmail.com').trim().toLowerCase();

  // Created / Connected Forms List
  const [formsList, setFormsList] = useState<CreatedFormResult[]>(() => {
    try {
      const saved = localStorage.getItem('passcraft_google_forms_list');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });

  const [activeFormId, setActiveFormId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem('passcraft_active_form_id');
      if (saved) return saved;
    } catch (e) {}
    return null;
  });

  const [filterType, setFilterType] = useState<'all' | 'registration' | 'feedback'>('all');
  const [isCreating, setIsCreating] = useState(false);
  const [creationStatus, setCreationStatus] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form Responses State
  const [responses, setResponses] = useState<FormResponseItem[]>([]);
  const [isLoadingResponses, setIsLoadingResponses] = useState(false);
  const [responsesStatus, setResponsesStatus] = useState<string | null>(null);

  // Connect existing Form URL input
  const [customFormUrl, setCustomFormUrl] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; desc: string; action: () => void } | null>(null);

  // Initial cloud sync load
  useEffect(() => {
    if (!effectiveEmail) return;
    loadGoogleFormsFromCloud(effectiveEmail).then(cloudForms => {
      if (cloudForms && Array.isArray(cloudForms) && cloudForms.length > 0) {
        setFormsList(prev => {
          const map = new Map<string, CreatedFormResult>();
          // Merge local and cloud forms by formId
          cloudForms.forEach(f => { if (f?.formId) map.set(f.formId, f); });
          prev.forEach(f => { if (f?.formId) map.set(f.formId, f); });
          const merged = Array.from(map.values());
          merged.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          return merged;
        });
      }
    });
  }, [effectiveEmail]);

  // Save to localStorage & Cloud whenever formsList updates
  useEffect(() => {
    try {
      localStorage.setItem('passcraft_google_forms_list', JSON.stringify(formsList));
    } catch (e) {}

    if (effectiveEmail && formsList.length > 0) {
      saveGoogleFormsToCloud(effectiveEmail, formsList);
    }
  }, [formsList, effectiveEmail]);

  // Keep activeFormId valid
  useEffect(() => {
    if (formsList.length > 0) {
      if (!activeFormId || !formsList.some(f => f.formId === activeFormId)) {
        setActiveFormId(formsList[0].formId);
      }
    }
  }, [formsList, activeFormId]);

  useEffect(() => {
    if (activeFormId) {
      try {
        localStorage.setItem('passcraft_active_form_id', activeFormId);
      } catch (e) {}
      // Do not trigger interactive popup auth during automatic component mount / useEffect
      handleFetchResponses(activeFormId, false);
    }
  }, [activeFormId]);

  const handleConnectAuth = async (force: boolean = false) => {
    setIsAuthenticating(true);
    try {
      const res = await connectGoogleWorkspaceAuth(force);
      setAccessToken(res.accessToken);
    } catch (err: any) {
      if (err?.isCancelled || err?.isUserCancellation || isUserAuthCancellation(err)) {
        console.warn('Google Forms Auth: Sign-in popup was closed or cancelled by user.');
        setCreationStatus('Sign-in cancelled. Click "Connect Google Forms" when ready.');
        return;
      }
      console.error('Workspace Auth Error:', err);
      setCreationStatus(`Auth Error: ${err?.message || 'Could not connect to Google Forms.'}`);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getValidToken = async (): Promise<string> => {
    let token = accessToken || getWorkspaceAccessToken();
    let isValid = token ? await checkWorkspaceTokenValidity(token) : false;
    if (!token || !isValid) {
      if (token && !isValid) {
        invalidateWorkspaceAccessToken();
        setAccessToken(null);
      }
      const res = await connectGoogleWorkspaceAuth(false);
      token = res.accessToken;
      setAccessToken(token);
    }
    return token;
  };

  const handleCreateRegistrationForm = async () => {
    setIsCreating(true);
    setCreationStatus('Building Live Google Registration Form with custom pass tiers...');

    try {
      const token = await getValidToken();
      const result = await createEventRegistrationForm(currentSelectedEvent, token);
      
      // Preserve ALL existing forms and prepend new registration form
      setFormsList(prev => [result, ...prev.filter(f => f.formId !== result.formId)]);
      setActiveFormId(result.formId);
      setCreationStatus(`Live Google Form "${result.title}" created successfully!`);
    } catch (err: any) {
      if (err?.isCancelled || err?.isUserCancellation || isUserAuthCancellation(err)) {
        console.warn('Create Form: Sign-in popup was closed or cancelled by user.');
        setCreationStatus('Action paused: Google sign-in was cancelled. Click "Connect Google Forms" to retry.');
        return;
      }
      console.error('Create Form Error:', err);
      const isAuth = err?.message?.includes('invalid authentication credentials') || err?.status === 401;
      if (isAuth) {
        invalidateWorkspaceAccessToken();
        setAccessToken(null);
      }
      setCreationStatus(`Creation Error: ${err?.message || 'Failed to generate Google Form.'}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateFeedbackForm = async () => {
    setIsCreating(true);
    setCreationStatus('Building Post-Event Satisfaction & Feedback Form...');

    try {
      const token = await getValidToken();
      const result = await createFeedbackForm(currentSelectedEvent, token);
      
      // Preserve ALL existing forms and prepend new feedback form
      setFormsList(prev => [result, ...prev.filter(f => f.formId !== result.formId)]);
      setActiveFormId(result.formId);
      setCreationStatus(`Feedback Form "${result.title}" created successfully!`);
    } catch (err: any) {
      if (err?.isCancelled || err?.isUserCancellation || isUserAuthCancellation(err)) {
        console.warn('Create Feedback Form: Sign-in popup was closed or cancelled by user.');
        setCreationStatus('Action paused: Google sign-in was cancelled. Click "Connect Google Forms" to retry.');
        return;
      }
      console.error('Create Feedback Form Error:', err);
      const isAuth = err?.message?.includes('invalid authentication credentials') || err?.status === 401;
      if (isAuth) {
        invalidateWorkspaceAccessToken();
        setAccessToken(null);
      }
      setCreationStatus(`Creation Error: ${err?.message || 'Failed to create Feedback Form.'}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleConnectExistingForm = async () => {
    const formId = extractFormId(customFormUrl);
    if (!formId) {
      alert('Please enter a valid Google Forms URL or Form ID.');
      return;
    }

    setIsCreating(true);
    setCreationStatus('Fetching form metadata...');

    try {
      const token = await getValidToken();
      const details = await fetchFormDetails(formId, token);
      const newFormItem: CreatedFormResult = {
        formId: details.formId,
        title: details.title,
        formType: 'custom',
        eventId: currentSelectedEvent?.id,
        eventTitle: currentSelectedEvent?.title,
        formUrl: `https://docs.google.com/forms/d/${details.formId}/edit`,
        responderUrl: details.responderUri,
        createdAt: new Date().toISOString(),
      };

      setFormsList(prev => [newFormItem, ...prev.filter(f => f.formId !== details.formId)]);
      setActiveFormId(details.formId);
      setCustomFormUrl('');
      setCreationStatus(`Connected to form "${details.title}"!`);
    } catch (err: any) {
      if (err?.isCancelled || err?.isUserCancellation || isUserAuthCancellation(err)) {
        console.warn('Connect Existing Form: Sign-in popup was closed or cancelled by user.');
        setCreationStatus('Action paused: Google sign-in was cancelled. Click "Connect Google Forms" to retry.');
        return;
      }
      console.error('Connect Existing Form Error:', err);
      setCreationStatus(`Connection Error: ${err?.message || 'Could not fetch Google Form.'}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRemoveForm = (formIdToRemove: string) => {
    setFormsList(prev => prev.filter(f => f.formId !== formIdToRemove));
    if (activeFormId === formIdToRemove) {
      const remaining = formsList.filter(f => f.formId !== formIdToRemove);
      setActiveFormId(remaining.length > 0 ? remaining[0].formId : null);
    }
  };

  const handleFetchResponses = async (formId: string, allowInteractivePrompt: boolean = false) => {
    let token = accessToken || getWorkspaceAccessToken();
    if (!token) {
      if (!allowInteractivePrompt) {
        setResponsesStatus('Google Workspace not connected. Click "Authorize Google Forms" to fetch live attendee submissions.');
        return;
      }
      try {
        const res = await connectGoogleWorkspaceAuth(false);
        token = res.accessToken;
        setAccessToken(token);
      } catch (e: any) {
        if (e?.isCancelled || e?.isUserCancellation || isUserAuthCancellation(e)) {
          console.warn('Fetch Responses: Sign-in popup was closed or cancelled by user.');
          setResponsesStatus('Sign-in cancelled. Please authorize Google Forms.');
          return;
        }
        console.error('Fetch Responses Auth Error:', e);
        return;
      }
    }

    setIsLoadingResponses(true);
    setResponsesStatus('Polling Google Forms API for attendee submissions...');

    try {
      const list = await fetchFormResponses(formId, token);
      setResponses(list);
      setResponsesStatus(`Found ${list.length} attendee submissions.`);
      
      // Update response count on form item
      setFormsList(prev => prev.map(f => f.formId === formId ? { ...f, responseCount: list.length } : f));
    } catch (err: any) {
      console.error('Fetch Responses Error:', err);
      setResponsesStatus(`Response Fetch Error: ${err?.message || 'Could not load form responses.'}`);
    } finally {
      setIsLoadingResponses(false);
    }
  };

  const handleConvertResponsesToPasses = () => {
    if (responses.length === 0) {
      alert('No form responses found to convert into passes.');
      return;
    }

    const { newPasses, updatedPasses, importedCount } = convertFormResponsesToPasses(
      responses,
      currentSelectedEvent,
      passes
    );

    if (importedCount === 0) {
      setResponsesStatus('All respondents already have issued passes in PassCraft.');
      return;
    }

    if (onPassesUpdated) {
      onPassesUpdated(updatedPasses);
    }

    setResponsesStatus(`Success! Issued ${importedCount} new cryptographic QR passes from Google Form responses.`);
  };

  const filteredForms = formsList.filter(f => {
    if (filterType === 'all') return true;
    if (filterType === 'registration') return f.formType === 'registration' || (!f.formType && f.title.toLowerCase().includes('registration'));
    if (filterType === 'feedback') return f.formType === 'feedback' || (!f.formType && (f.title.toLowerCase().includes('feedback') || f.title.toLowerCase().includes('survey')));
    return true;
  });

  const activeFormObj = formsList.find(f => f.formId === activeFormId) || formsList[0];

  const registrationCount = formsList.filter(f => f.formType === 'registration' || (!f.formType && f.title.toLowerCase().includes('registration'))).length;
  const feedbackCount = formsList.filter(f => f.formType === 'feedback' || (!f.formType && (f.title.toLowerCase().includes('feedback') || f.title.toLowerCase().includes('survey')))).length;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">Google Forms Registration &amp; Feedback Hub</h1>
                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-[10px] font-bold uppercase tracking-wider rounded-md border border-purple-500/30">
                  Multi-Form Live Sync
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Generate and manage multiple simultaneous Google Forms: distribute Registration &amp; Feedback surveys at the same time without losing history.
              </p>
            </div>
          </div>

          {/* Auth Connection Status & Button */}
          <div className="flex items-center gap-3">
            {accessToken ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-950/60 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="font-semibold">Google Forms Connected</span>
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
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-md shadow-purple-600/30 cursor-pointer disabled:opacity-50"
              >
                {isAuthenticating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <ClipboardList className="w-4 h-4" />
                    Connect Google Forms
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Selected Event Context Pill */}
        {currentSelectedEvent && (
          <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-slate-400">Target Event:</span>
              <span className="font-bold text-white">{currentSelectedEvent.title}</span>
              <span className="text-slate-500 font-mono">({currentSelectedEvent.date})</span>
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

      {/* Form Creation Cards - Simultaneous Support */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Live Event Registration & Pass Claim Form */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-purple-500/40 transition-all rounded-2xl p-5 flex flex-col justify-between group shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform">
                <ClipboardList className="w-5 h-5" />
              </div>
              <span className="px-2 py-0.5 bg-purple-950 text-purple-300 border border-purple-800 rounded-md text-[10px] font-bold uppercase tracking-wider">
                Registration RSVP
              </span>
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Live Registration &amp; RSVP Form</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Instantly creates a ready-to-share Google Form for attendee name, contact, organization, and tier selection. Keeps your feedback forms safe and separate.
            </p>
          </div>

          <button
            onClick={() => {
              setConfirmDialog({
                title: 'Create Google Registration Form',
                desc: `This will create a new Live Registration Form for "${currentSelectedEvent?.title || 'Event'}" in your Google Forms account. Your previous forms will remain active and intact. Continue?`,
                action: handleCreateRegistrationForm,
              });
            }}
            disabled={isCreating}
            className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-purple-600/20 cursor-pointer disabled:opacity-50"
          >
            {isCreating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Live Registration Form
          </button>
        </div>

        {/* Card 2: Post-Event Attendee Feedback Form */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-indigo-500/40 transition-all rounded-2xl p-5 flex flex-col justify-between group shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform">
                <Sparkles className="w-5 h-5" />
              </div>
              <span className="px-2 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-800 rounded-md text-[10px] font-bold uppercase tracking-wider">
                Feedback &amp; Rating
              </span>
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Attendee Feedback &amp; Survey Form</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Creates a post-event satisfaction survey with 1-5 star ratings, gate experience, and recommendations. Can run concurrently with your registration forms!
            </p>
          </div>

          <button
            onClick={() => {
              setConfirmDialog({
                title: 'Create Feedback Survey Form',
                desc: 'This will create an attendee feedback and rating survey in your Google Forms account without replacing your registration forms. Continue?',
                action: handleCreateFeedbackForm,
              });
            }}
            disabled={isCreating}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-600/20 cursor-pointer disabled:opacity-50"
          >
            {isCreating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Create Feedback Survey Form
          </button>
        </div>
      </div>

      {/* Connect Existing Form URL Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <Share2 className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-bold text-white">Connect Existing Google Form</h3>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Have an existing Google Form? Paste its edit or responder URL below to link it to your event and issue passes.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Paste Google Form URL (https://docs.google.com/forms/d/...)"
            value={customFormUrl}
            onChange={(e) => setCustomFormUrl(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
          />
          <button
            onClick={handleConnectExistingForm}
            disabled={!customFormUrl.trim() || isCreating}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
          >
            {isCreating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Connect Form
          </button>
        </div>
      </div>

      {/* MULTI-FORM ACTIVE DIRECTORY: Shows BOTH Registration and Feedback forms at the same time */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-purple-400" />
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Active Forms Directory ({formsList.length})
                <span className="text-[11px] font-normal text-slate-400">
                  — Registration &amp; Feedback Forms available simultaneously
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Copy public responder links below to distribute registration and feedback at the same time.
              </p>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                filterType === 'all' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({formsList.length})
            </button>
            <button
              onClick={() => setFilterType('registration')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                filterType === 'registration' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Registration ({registrationCount})
            </button>
            <button
              onClick={() => setFilterType('feedback')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                filterType === 'feedback' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Feedback ({feedbackCount})
            </button>
          </div>
        </div>

        {filteredForms.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl">
            <ClipboardList className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-400 font-medium">No Google Forms created yet in this view.</p>
            <p className="text-[11px] text-slate-500 mt-1">Click "Create Live Registration Form" or "Create Feedback Survey Form" above to generate your live forms.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredForms.map((formItem) => {
              const isFeedback = formItem.formType === 'feedback' || formItem.title.toLowerCase().includes('feedback') || formItem.title.toLowerCase().includes('survey');
              const isRegistration = formItem.formType === 'registration' || (!isFeedback && formItem.title.toLowerCase().includes('registration'));
              const isSelectedActive = formItem.formId === activeFormId;

              return (
                <div
                  key={formItem.formId}
                  className={`border rounded-2xl p-4 transition-all flex flex-col justify-between ${
                    isSelectedActive
                      ? 'bg-slate-900/95 border-purple-500/60 shadow-lg shadow-purple-950/20 ring-1 ring-purple-500/30'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    {/* Header: Badge + Actions */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        {isFeedback ? (
                          <span className="px-2 py-0.5 bg-indigo-950/80 border border-indigo-500/30 text-indigo-300 text-[10px] font-bold uppercase tracking-wider rounded-md flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-indigo-400" />
                            Feedback Form
                          </span>
                        ) : isRegistration ? (
                          <span className="px-2 py-0.5 bg-purple-950/80 border border-purple-500/30 text-purple-300 text-[10px] font-bold uppercase tracking-wider rounded-md flex items-center gap-1">
                            <ClipboardList className="w-3 h-3 text-purple-400" />
                            Registration Form
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-blue-950/80 border border-blue-500/30 text-blue-300 text-[10px] font-bold uppercase tracking-wider rounded-md">
                            Connected Form
                          </span>
                        )}

                        {isSelectedActive && (
                          <span className="px-1.5 py-0.5 bg-emerald-950 border border-emerald-500/40 text-emerald-300 text-[9px] font-bold uppercase tracking-wider rounded">
                            Inspecting
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          setConfirmDialog({
                            title: `Remove "${formItem.title}" from Directory`,
                            desc: 'This removes the form from your local hub. The live Google Form in your Google Drive will remain safe.',
                            action: () => handleRemoveForm(formItem.formId),
                          });
                        }}
                        className="text-slate-500 hover:text-rose-400 p-1 transition-colors cursor-pointer"
                        title="Remove form from list"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Title */}
                    <h4 className="text-sm font-bold text-white line-clamp-1 mb-1" title={formItem.title}>
                      {formItem.title}
                    </h4>

                    {/* Meta info */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400 mb-3">
                      {formItem.eventTitle && (
                        <span>Event: <strong className="text-slate-300">{formItem.eventTitle}</strong></span>
                      )}
                      <span>•</span>
                      <span>Created: {new Date(formItem.createdAt).toLocaleDateString()}</span>
                      {formItem.responseCount !== undefined && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-400 font-bold">{formItem.responseCount} Submissions</span>
                        </>
                      )}
                    </div>

                    {/* Link Sharing Box */}
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 mb-3">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-mono font-bold mb-1">
                        <span>Shareable Public Link:</span>
                        <span className={copiedId === formItem.formId ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                          {copiedId === formItem.formId ? 'Copied to Clipboard!' : 'Attendee Link'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          readOnly
                          value={formItem.responderUrl}
                          className="flex-1 bg-transparent text-[11px] text-slate-300 font-mono select-all focus:outline-none truncate"
                        />
                        <button
                          onClick={() => copyToClipboard(formItem.responderUrl, formItem.formId)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                        >
                          {copiedId === formItem.formId ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-slate-400" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
                    <button
                      onClick={() => {
                        setActiveFormId(formItem.formId);
                        handleFetchResponses(formItem.formId, true);
                      }}
                      className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        isSelectedActive
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      {isSelectedActive ? 'Submissions Loaded' : 'Inspect Submissions'}
                    </button>

                    <a
                      href={formItem.responderUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center justify-center transition-colors"
                      title="Open Live Responder Form"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <a
                      href={formItem.formUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg flex items-center gap-1 transition-colors"
                      title="Open Google Forms Editor"
                    >
                      <span>Edit</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Form Responder Hub & Submissions Table */}
      {activeFormObj && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white">
                  Inspecting Submissions: {activeFormObj.title}
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Review attendee responses and automatically generate 16-digit QR passes.
              </p>
            </div>

            {/* Quick Switcher dropdown if multiple */}
            {formsList.length > 1 && (
              <select
                value={activeFormId || ''}
                onChange={(e) => setActiveFormId(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                {formsList.map(f => (
                  <option key={f.formId} value={f.formId}>
                    {f.formType === 'feedback' ? '⭐ Feedback: ' : '🎟️ Registration: '}{f.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Submissions Controls */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Submissions ({responses.length})
                </h4>
                {responsesStatus && (
                  <span className="text-[11px] text-slate-400 font-mono">• {responsesStatus}</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => activeFormObj && handleFetchResponses(activeFormObj.formId, true)}
                  disabled={isLoadingResponses}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingResponses ? 'animate-spin' : ''}`} />
                  Refresh Submissions
                </button>

                <button
                  onClick={() => {
                    setConfirmDialog({
                      title: 'Auto-Issue Passes to All Form Respondents',
                      desc: `This will generate cryptographic 16-digit QR passes for all ${responses.length} attendee submissions and sync them to your Passes Registry. Continue?`,
                      action: handleConvertResponsesToPasses,
                    });
                  }}
                  disabled={responses.length === 0}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/30 cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  Auto-Issue &amp; Generate QR Passes
                </button>
              </div>
            </div>

            {/* Submissions Table */}
            {responses.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl">
                <ClipboardList className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-medium">No submissions recorded yet for this form.</p>
                <p className="text-[11px] text-slate-500 mt-1">Copy the public link above and submit a response in your browser, then click "Refresh Submissions".</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Respondent / Name</th>
                      <th className="py-2.5 px-3">Contact</th>
                      <th className="py-2.5 px-3">Pass Tier / Answers</th>
                      <th className="py-2.5 px-3">Submitted At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
                    {responses.map((resp, idx) => (
                      <tr key={resp.responseId || idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-slate-500">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-medium text-white">
                          <div className="flex items-center gap-2">
                            <span>{resp.respondentName || 'Attendee'}</span>
                            {resp.answers?.find(a => a.value?.toLowerCase().includes('vip')) && (
                              <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 text-[9px] font-bold rounded">VIP</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-400">
                          <div className="space-y-0.5">
                            {resp.respondentEmail && (
                              <div className="flex items-center gap-1">
                                <Mail className="w-3 h-3 text-slate-500" />
                                <span>{resp.respondentEmail}</span>
                              </div>
                            )}
                            {resp.respondentPhone && (
                              <div className="flex items-center gap-1 text-[11px]">
                                <Phone className="w-3 h-3 text-slate-500" />
                                <span>{resp.respondentPhone}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 max-w-xs truncate">
                          {resp.passTier ? (
                            <span className="px-2 py-0.5 bg-purple-500/10 text-purple-300 border border-purple-500/20 rounded font-semibold text-[11px]">
                              {resp.passTier}
                            </span>
                          ) : (
                            <span className="text-slate-500">Standard</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px]">
                          {resp.submittedAt ? new Date(resp.submittedAt).toLocaleTimeString() : 'Recent'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 flex items-center justify-center mb-3">
              <ClipboardList className="w-5 h-5" />
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
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
