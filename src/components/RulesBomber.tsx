import React, { useState, useMemo, useEffect } from 'react';
import { EventItem, PassItem } from '../types';
import { recordDispatchHistory } from '../utils/historyStorage';
import { safeFetchJson } from '../lib/apiHelper';
import DispatchProgressCard, { DispatchProgressState } from './DispatchProgressCard';
import { 
  Send, 
  Mail, 
  ShieldAlert, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Search, 
  Eye, 
  Smartphone, 
  Monitor, 
  Check, 
  X, 
  Plus, 
  Trash2, 
  Clock, 
  Shirt, 
  Ban, 
  CheckSquare, 
  HelpCircle, 
  Users, 
  SlidersHorizontal,
  Wand2,
  Lock,
  Flame,
  Info,
  HeartHandshake
} from 'lucide-react';
import { ThankYouPage } from './ThankYouPage';

interface RulesBomberProps {
  passes: PassItem[];
  events: EventItem[];
  currentUserEmail: string | null;
  initialSubTab?: 'rules' | 'recap';
}

const STORAGE_GMAIL_CREDENTIALS_KEY = 'passcraft_gmail_credentials_v1';
const STORAGE_RULES_BOMBER_STATE_KEY = 'passcraft_rules_bomber_state_v2';

interface RulesBomberSavedState {
  subTab?: 'rules' | 'recap';
  selectedEventId?: string;
  subject?: string;
  introMessage?: string;
  dressCode?: string;
  dressCodeDetails?: string;
  gatePolicy?: string;
  allowedItems?: string[];
  prohibitedItems?: string[];
  dos?: string[];
  donts?: string[];
  importantNotice?: string;
  themePreset?: 'amber' | 'emerald' | 'cyan' | 'crimson' | 'slate';
  cardBackground?: string;
  outerBackground?: string;
  headerGradientStart?: string;
  headerGradientEnd?: string;
  headerTextColor?: string;
  accentColor?: string;
  highlightColor?: string;
  textColor?: string;
  subtextColor?: string;
  dispatchSpeed?: 'gap_1.5' | 'gap_3' | 'gap_5' | 'draft_all_send';
}

const loadSavedRulesState = (): RulesBomberSavedState | null => {
  try {
    const saved = localStorage.getItem(STORAGE_RULES_BOMBER_STATE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return null;
};

export const RulesBomber: React.FC<RulesBomberProps> = ({
  passes,
  events,
  currentUserEmail,
  initialSubTab = 'rules'
}) => {
  const savedState = useMemo(() => loadSavedRulesState(), []);

  // Sub-page switcher state: 'rules' (Pre-Event) vs 'recap' (Post-Event Thank You)
  const [subTab, setSubTab] = useState<'rules' | 'recap'>(() => {
    return savedState?.subTab || initialSubTab;
  });

  // Only active (non-ended) events for dispatch
  const activeEvents = useMemo(() => events.filter(e => e.status !== 'ended'), [events]);

  // Selected Event
  const [selectedEventId, setSelectedEventId] = useState<string>(() => {
    if (savedState?.selectedEventId) return savedState.selectedEventId;
    return activeEvents[0]?.id || (events[0]?.id || 'all');
  });

  useEffect(() => {
    if (selectedEventId !== 'all' && !events.some(e => e.id === selectedEventId)) {
      setSelectedEventId(activeEvents[0]?.id || 'all');
    }
  }, [events, activeEvents, selectedEventId]);

  // Shared Gmail Credentials from localStorage
  const [gmailCreds, setGmailCreds] = useState<{ senderEmail: string; appPassword: string; senderName?: string } | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_GMAIL_CREDENTIALS_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });

  // Manual inline credential toggle if user wants to change credentials here
  const [showCredsEditor, setShowCredsEditor] = useState(false);
  const [inputSenderEmail, setInputSenderEmail] = useState(gmailCreds?.senderEmail || currentUserEmail || '');
  const [inputAppPassword, setInputAppPassword] = useState(gmailCreds?.appPassword || '');
  const [inputSenderName, setInputSenderName] = useState(gmailCreds?.senderName || 'PassCraft Event Desk');

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputSenderEmail || !inputAppPassword) return;
    const newCreds = {
      senderEmail: inputSenderEmail.trim(),
      appPassword: inputAppPassword.replace(/\s+/g, ''),
      senderName: inputSenderName.trim() || 'PassCraft Event Desk'
    };
    setGmailCreds(newCreds);
    try {
      localStorage.setItem(STORAGE_GMAIL_CREDENTIALS_KEY, JSON.stringify(newCreds));
    } catch (err) {}
    setShowCredsEditor(false);
    setAlertMessage({ type: 'success', text: 'Gmail credentials updated and synced with Pass Bomber!' });
    setTimeout(() => setAlertMessage(null), 4000);
  };

  // Currently selected event object
  const currentEvent = useMemo(() => {
    if (selectedEventId === 'all') return activeEvents[0] || events[0];
    return events.find(e => e.id === selectedEventId) || activeEvents[0] || events[0];
  }, [selectedEventId, events, activeEvents]);

  // Recipient Pool
  const eventPasses = useMemo(() => {
    return passes.filter(p => {
      if (p.status !== 'assigned' && p.status !== 'checked_in') return false;
      const email = p.assignedTo?.email;
      if (!email || !email.includes('@')) return false;
      if (selectedEventId === 'all') return true;
      return p.eventId === selectedEventId || (p.eventName && currentEvent && p.eventName.toLowerCase() === currentEvent.title.toLowerCase());
    });
  }, [passes, selectedEventId, currentEvent]);

  // Recipient Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'checked_in' | 'not_checked_in'>('all');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [selectedPassIds, setSelectedPassIds] = useState<string[]>([]);

  // Filtered Recipients
  const filteredRecipients = useMemo(() => {
    return eventPasses.filter(p => {
      if (statusFilter === 'checked_in' && p.status !== 'checked_in') return false;
      if (statusFilter === 'not_checked_in' && p.status === 'checked_in') return false;
      if (recipientSearch) {
        const q = recipientSearch.toLowerCase();
        const matchesName = (p.assignedTo?.name || '').toLowerCase().includes(q);
        const matchesEmail = (p.assignedTo?.email || '').toLowerCase().includes(q);
        const matchesTier = (p.category || '').toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesTier) return false;
      }
      return true;
    });
  }, [eventPasses, statusFilter, recipientSearch]);

  // Initialize all selected when recipient pool changes
  useEffect(() => {
    setSelectedPassIds(filteredRecipients.map(p => p.id));
  }, [filteredRecipients.length, selectedEventId, statusFilter]);

  const toggleSelectAll = () => {
    if (selectedPassIds.length === filteredRecipients.length) {
      setSelectedPassIds([]);
    } else {
      setSelectedPassIds(filteredRecipients.map(p => p.id));
    }
  };

  const togglePassSelection = (id: string) => {
    setSelectedPassIds(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  // Rules & Guidelines Configuration State (Loaded from localStorage)
  const [subject, setSubject] = useState(() => savedState?.subject ?? '📋 IMPORTANT: Event Guidelines, Rules & Dress Code — {{EVENT_NAME}}');
  const [introMessage, setIntroMessage] = useState(() => savedState?.introMessage ?? 
    'Please review the official guidelines, dress code, allowed items, and venue entry policies prior to arrival for a seamless experience.'
  );
  const [dressCode, setDressCode] = useState(() => savedState?.dressCode ?? 'Semi-Casual / Smart Casual');
  const [dressCodeDetails, setDressCodeDetails] = useState(() => savedState?.dressCodeDetails ?? 'Collared shirts, smart jeans, chinos, dresses, or neat professional wear.');
  const [gatePolicy, setGatePolicy] = useState(() => savedState?.gatePolicy ?? 'Registration gates open 45 minutes prior. Entry closes strictly at 10:30 AM. Verification required at entrance.');
  
  // Lists
  const [allowedItems, setAllowedItems] = useState<string[]>(() => savedState?.allowedItems ?? [
    'Government Photo ID / College ID',
    'Digital QR Pass or 16-Digit Code',
    'Reusable Metal / BPA-Free Water Bottle',
    'Laptop & Charger / Notepad'
  ]);
  const [prohibitedItems, setProhibitedItems] = useState<string[]>(() => savedState?.prohibitedItems ?? [
    'Single-Use Plastic Bottles & Cups',
    'Outside Food & Alcoholic Beverages',
    'Sharp Objects, Weapons & Fireworks',
    'Laser Pointers & Disruptive Noise Makers'
  ]);
  const [dos, setDos] = useState<string[]>(() => savedState?.dos ?? [
    'Arrive at least 30 minutes early for smooth badge collection',
    'Wear your pass/badge visibly at all times in the venue',
    'Follow designated emergency exit signs and staff guidance'
  ]);
  const [donts, setDonts] = useState<string[]>(() => savedState?.donts ?? [
    'Do not bring single-use plastic bottles into auditoriums',
    'Do not engage in unapproved commercial promotions',
    'Do not enter restricted stage or backstage areas without badge'
  ]);
  const [importantNotice, setImportantNotice] = useState(() => savedState?.importantNotice ?? 
    'Zero tolerance policy for misconduct or harassment. Strict security and baggage inspection at all entrance gates.'
  );

  // New Item input state
  const [newAllowedItem, setNewAllowedItem] = useState('');
  const [newProhibitedItem, setNewProhibitedItem] = useState('');
  const [newDo, setNewDo] = useState('');
  const [newDont, setNewDont] = useState('');

  // Email Aesthetic Theme & Colors
  const [themePreset, setThemePreset] = useState<'amber' | 'emerald' | 'cyan' | 'crimson' | 'slate'>(() => savedState?.themePreset ?? 'amber');
  const [cardBackground, setCardBackground] = useState(() => savedState?.cardBackground ?? '#0f172a');
  const [outerBackground, setOuterBackground] = useState(() => savedState?.outerBackground ?? '#020617');
  const [headerGradientStart, setHeaderGradientStart] = useState(() => savedState?.headerGradientStart ?? '#d97706');
  const [headerGradientEnd, setHeaderGradientEnd] = useState(() => savedState?.headerGradientEnd ?? '#f59e0b');
  const [headerTextColor, setHeaderTextColor] = useState(() => savedState?.headerTextColor ?? '#000000');
  const [accentColor, setAccentColor] = useState(() => savedState?.accentColor ?? '#f59e0b');
  const [highlightColor, setHighlightColor] = useState(() => savedState?.highlightColor ?? '#fbbf24');
  const [textColor, setTextColor] = useState(() => savedState?.textColor ?? '#f8fafc');
  const [subtextColor, setSubtextColor] = useState(() => savedState?.subtextColor ?? '#94a3b8');

  // Preview Mode
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  // AI Generator
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  // Dispatch Engine State
  const [dispatchSpeed, setDispatchSpeed] = useState<'gap_1.5' | 'gap_3' | 'gap_5' | 'draft_all_send'>(() => savedState?.dispatchSpeed ?? 'gap_1.5');
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchProgress, setDispatchProgress] = useState(0);
  const [dispatchProgressState, setDispatchProgressState] = useState<DispatchProgressState>({
    isActive: false,
    phase: 'idle',
    currentStep: 1,
    totalSteps: 2,
    draftsCreated: 0,
    draftsLeft: 0,
    draftsTotal: 0,
    sentCount: 0,
    toBeSentCount: 0,
    failedCount: 0,
    totalToSend: 0,
    currentName: '',
    currentEmail: '',
    statusText: '',
    percent: 0,
  });
  const [dispatchLogs, setDispatchLogs] = useState<Array<{ email: string; name: string; status: 'sent' | 'failed'; error?: string; time: string }>>([]);
  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Auto-persist all Rules Bomber state to localStorage
  useEffect(() => {
    const stateToSave: RulesBomberSavedState = {
      subTab,
      selectedEventId,
      subject,
      introMessage,
      dressCode,
      dressCodeDetails,
      gatePolicy,
      allowedItems,
      prohibitedItems,
      dos,
      donts,
      importantNotice,
      themePreset,
      cardBackground,
      outerBackground,
      headerGradientStart,
      headerGradientEnd,
      headerTextColor,
      accentColor,
      highlightColor,
      textColor,
      subtextColor,
      dispatchSpeed,
    };
    try {
      localStorage.setItem(STORAGE_RULES_BOMBER_STATE_KEY, JSON.stringify(stateToSave));
    } catch (e) {}
  }, [
    subTab,
    selectedEventId,
    subject,
    introMessage,
    dressCode,
    dressCodeDetails,
    gatePolicy,
    allowedItems,
    prohibitedItems,
    dos,
    donts,
    importantNotice,
    themePreset,
    cardBackground,
    outerBackground,
    headerGradientStart,
    headerGradientEnd,
    headerTextColor,
    accentColor,
    highlightColor,
    textColor,
    subtextColor,
    dispatchSpeed,
  ]);

  // Reset to default guidelines
  const handleResetToDefaults = () => {
    if (!window.confirm('Reset guidelines and rules back to default template?')) return;
    setSubject('📋 IMPORTANT: Event Guidelines, Rules & Dress Code — {{EVENT_NAME}}');
    setIntroMessage('Please review the official guidelines, dress code, allowed items, and venue entry policies prior to arrival for a seamless experience.');
    setDressCode('Semi-Casual / Smart Casual');
    setDressCodeDetails('Collared shirts, smart jeans, chinos, dresses, or neat professional wear.');
    setGatePolicy('Registration gates open 45 minutes prior. Entry closes strictly at 10:30 AM. Verification required at entrance.');
    setAllowedItems([
      'Government Photo ID / College ID',
      'Digital QR Pass or 16-Digit Code',
      'Reusable Metal / BPA-Free Water Bottle',
      'Laptop & Charger / Notepad'
    ]);
    setProhibitedItems([
      'Single-Use Plastic Bottles & Cups',
      'Outside Food & Alcoholic Beverages',
      'Sharp Objects, Weapons & Fireworks',
      'Laser Pointers & Disruptive Noise Makers'
    ]);
    setDos([
      'Arrive at least 30 minutes early for smooth badge collection',
      'Wear your pass/badge visibly at all times in the venue',
      'Follow designated emergency exit signs and staff guidance'
    ]);
    setDonts([
      'Do not bring single-use plastic bottles into auditoriums',
      'Do not engage in unapproved commercial promotions',
      'Do not enter restricted stage or backstage areas without badge'
    ]);
    setImportantNotice('Zero tolerance policy for misconduct or harassment. Strict security and baggage inspection at all entrance gates.');
    handleApplyThemePreset('amber');
    setAlertMessage({ type: 'success', text: 'Reset rules & guidelines back to defaults.' });
    setTimeout(() => setAlertMessage(null), 3000);
  };

  // Apply Theme Preset
  const handleApplyThemePreset = (type: 'amber' | 'emerald' | 'cyan' | 'crimson' | 'slate') => {
    setThemePreset(type);
    if (type === 'amber') {
      setCardBackground('#0f172a');
      setOuterBackground('#020617');
      setHeaderGradientStart('#d97706');
      setHeaderGradientEnd('#f59e0b');
      setHeaderTextColor('#000000');
      setAccentColor('#f59e0b');
      setHighlightColor('#fbbf24');
      setTextColor('#f8fafc');
      setSubtextColor('#94a3b8');
    } else if (type === 'emerald') {
      setCardBackground('#0d131f');
      setOuterBackground('#030712');
      setHeaderGradientStart('#059669');
      setHeaderGradientEnd('#10b981');
      setHeaderTextColor('#ffffff');
      setAccentColor('#10b981');
      setHighlightColor('#34d399');
      setTextColor('#f8fafc');
      setSubtextColor('#94a3b8');
    } else if (type === 'cyan') {
      setCardBackground('#090d16');
      setOuterBackground('#020408');
      setHeaderGradientStart('#0284c7');
      setHeaderGradientEnd('#06b6d4');
      setHeaderTextColor('#ffffff');
      setAccentColor('#06b6d4');
      setHighlightColor('#38bdf8');
      setTextColor('#f0f9ff');
      setSubtextColor('#93c5fd');
    } else if (type === 'crimson') {
      setCardBackground('#170a0d');
      setOuterBackground('#090204');
      setHeaderGradientStart('#be123c');
      setHeaderGradientEnd('#f43f5e');
      setHeaderTextColor('#ffffff');
      setAccentColor('#f43f5e');
      setHighlightColor('#fda4af');
      setTextColor('#fff1f2');
      setSubtextColor('#fca5a5');
    } else {
      setCardBackground('#18181b');
      setOuterBackground('#09090b');
      setHeaderGradientStart('#334155');
      setHeaderGradientEnd('#64748b');
      setHeaderTextColor('#ffffff');
      setAccentColor('#94a3b8');
      setHighlightColor('#cbd5e1');
      setTextColor('#ffffff');
      setSubtextColor('#a1a1aa');
    }
  };

  // AI Rules Generator
  const handleGenerateAiRules = async (customPrompt?: string) => {
    const promptToUse = (customPrompt || aiPrompt || currentEvent?.title || 'Tech Conference').trim();
    setIsAiGenerating(true);
    setAlertMessage(null);

    try {
      const res = await safeFetchJson<{ success: boolean; data?: any; error?: string }>('/api/gemini/generate-event-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptToUse,
          eventContext: currentEvent ? {
            title: currentEvent.title,
            date: currentEvent.date,
            location: currentEvent.location
          } : undefined
        })
      });

      if (res.ok && res.data?.success && res.data.data) {
        const d = res.data.data;
        if (d.dressCode) setDressCode(d.dressCode);
        if (d.dressCodeDetails) setDressCodeDetails(d.dressCodeDetails);
        if (d.gatePolicy) setGatePolicy(d.gatePolicy);
        if (Array.isArray(d.allowedItems) && d.allowedItems.length > 0) setAllowedItems(d.allowedItems);
        if (Array.isArray(d.prohibitedItems) && d.prohibitedItems.length > 0) setProhibitedItems(d.prohibitedItems);
        if (Array.isArray(d.dos) && d.dos.length > 0) setDos(d.dos);
        if (Array.isArray(d.donts) && d.donts.length > 0) setDonts(d.donts);
        if (d.importantNotice) setImportantNotice(d.importantNotice);

        setAlertMessage({
          type: 'success',
          text: `✨ Generated event rules & guidelines for "${promptToUse}"!`
        });
        setTimeout(() => setAlertMessage(null), 5000);
      } else {
        throw new Error(res.data?.error || res.error || 'Failed to generate rules');
      }
    } catch (err: any) {
      setAlertMessage({
        type: 'error',
        text: `Error generating AI rules: ${err.message}`
      });
    } finally {
      setIsAiGenerating(false);
    }
  };

  // Add Item Helpers
  const handleAddAllowed = () => {
    if (!newAllowedItem.trim()) return;
    setAllowedItems(prev => [...prev, newAllowedItem.trim()]);
    setNewAllowedItem('');
  };

  const handleAddProhibited = () => {
    if (!newProhibitedItem.trim()) return;
    setProhibitedItems(prev => [...prev, newProhibitedItem.trim()]);
    setNewProhibitedItem('');
  };

  const handleAddDo = () => {
    if (!newDo.trim()) return;
    setDos(prev => [...prev, newDo.trim()]);
    setNewDo('');
  };

  const handleAddDont = () => {
    if (!newDont.trim()) return;
    setDonts(prev => [...prev, newDont.trim()]);
    setNewDont('');
  };

  // Helper Sleep for rate limiting
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Dispatch Rules Bomber Emails
  const handleStartDispatch = async (isTest: boolean = false) => {
    if (!gmailCreds || !gmailCreds.senderEmail || !gmailCreds.appPassword) {
      setShowCredsEditor(true);
      setAlertMessage({
        type: 'error',
        text: 'Please connect your Gmail account and 16-character App Password first.'
      });
      return;
    }

    const selectedPasses = isTest 
      ? [{
          id: 'test-pass',
          code16: '0000000000000000',
          formattedCode: '0000-0000-0000-0000',
          eventId: currentEvent?.id || 'event-1',
          eventName: currentEvent?.title || 'Official Event',
          eventDate: currentEvent?.date || 'Upcoming',
          eventTime: '10:00 AM',
          eventLocation: currentEvent?.location || 'Main Venue',
          category: 'VIP Delegate',
          status: 'assigned' as const,
          themeColor: '#059669',
          createdAt: new Date().toISOString(),
          assignedTo: {
            name: 'Test Delegate',
            email: gmailCreds.senderEmail,
            assignedAt: new Date().toISOString()
          }
        }]
      : filteredRecipients.filter(p => selectedPassIds.includes(p.id));

    if (selectedPasses.length === 0) {
      setAlertMessage({ type: 'error', text: 'No recipients selected for dispatch.' });
      return;
    }

    const delayMap: Record<string, number> = {
      'gap_1.5': 1500,
      'gap_3': 3000,
      'gap_5': 5000,
      'draft_all_send': 0,
    };
    const delayMs = delayMap[dispatchSpeed] || 0;

    setIsDispatching(true);
    setDispatchProgress(0);
    setDispatchLogs([]);
    setAlertMessage(null);

    let sentCount = 0;
    let failCount = 0;

    const rulesConfigPayload = {
      subject,
      introMessage,
      dressCode,
      dressCodeDetails,
      gatePolicy,
      allowedItems,
      prohibitedItems,
      dos,
      donts,
      importantNotice,
      senderName: gmailCreds.senderName || 'PassCraft Operations Team',
      style: {
        cardBackground,
        outerBackground,
        headerGradientStart,
        headerGradientEnd,
        headerTextColor,
        accentColor,
        highlightColor,
        textColor,
        subtextColor
      }
    };

    // Mode: Draft all rules emails first, then send all at once
    if (dispatchSpeed === 'draft_all_send') {
      const totalRecipients = selectedPasses.length;

      // Phase 1: Draft all rules emails
      setDispatchProgressState({
        isActive: true,
        phase: 'drafting',
        currentStep: 1,
        totalSteps: 2,
        draftsCreated: 0,
        draftsLeft: totalRecipients,
        draftsTotal: totalRecipients,
        sentCount: 0,
        toBeSentCount: totalRecipients,
        failedCount: 0,
        totalToSend: totalRecipients,
        statusText: `Compiling event rules & entry guidelines for ${totalRecipients} attendees...`,
        percent: 0,
      });

      const draftedRecipients = [];
      for (let i = 0; i < selectedPasses.length; i++) {
        const pass = selectedPasses[i];
        const recipientPayload = {
          attendeeName: pass.assignedTo?.name || 'Valued Attendee',
          email: pass.assignedTo?.email || '',
          eventName: pass.eventName || currentEvent?.title || 'Event',
          eventDate: pass.eventDate || currentEvent?.date || 'Upcoming',
          eventTime: pass.eventTime || '10:00 AM',
          venue: pass.eventLocation || currentEvent?.location || 'Main Convention Hall',
          category: pass.category || 'General Attendee'
        };
        draftedRecipients.push(recipientPayload);

        const createdSoFar = i + 1;
        const leftToDraft = totalRecipients - createdSoFar;
        const draftPct = Math.round((createdSoFar / totalRecipients) * 100);

        setDispatchProgress(draftPct);
        setDispatchProgressState(prev => ({
          ...prev,
          phase: 'drafting',
          currentStep: 1,
          draftsCreated: createdSoFar,
          draftsLeft: leftToDraft,
          draftsTotal: totalRecipients,
          currentName: recipientPayload.attendeeName,
          currentEmail: recipientPayload.email,
          statusText: `Drafting customized rules advisory for ${recipientPayload.attendeeName} (${createdSoFar}/${totalRecipients} created, ${leftToDraft} left)...`,
          percent: draftPct,
        }));

        if (selectedPasses.length > 1) {
          await sleep(Math.min(80, 1500 / selectedPasses.length));
        }
      }

      // Phase 2: Send all drafted emails with live tracking
      setDispatchProgressState(prev => ({
        ...prev,
        phase: 'sending',
        currentStep: 2,
        draftsCreated: totalRecipients,
        draftsLeft: 0,
        sentCount: 0,
        toBeSentCount: totalRecipients,
        failedCount: 0,
        totalToSend: totalRecipients,
        statusText: `All ${totalRecipients} rules drafts prepared! Now sending via Gmail...`,
        percent: 0,
      }));

      const logsAccumulator: Array<{ email: string; name: string; status: 'sent' | 'failed'; error?: string; time: string }> = [];

      for (let i = 0; i < draftedRecipients.length; i++) {
        const item = draftedRecipients[i];
        const remainingBefore = totalRecipients - (logsAccumulator.filter(l => l.status === 'sent').length + logsAccumulator.filter(l => l.status === 'failed').length);

        setDispatchProgressState(prev => ({
          ...prev,
          phase: 'sending',
          currentStep: 2,
          currentName: item.attendeeName,
          currentEmail: item.email,
          statusText: `Sending rules & guidelines to ${item.attendeeName} (${remainingBefore} to be sent)...`,
          toBeSentCount: remainingBefore,
        }));

        try {
          const res = await safeFetchJson<{ success: boolean; results?: any[]; error?: string }>('/api/email/dispatch-rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              smtpConfig: {
                senderEmail: gmailCreds.senderEmail,
                appPassword: gmailCreds.appPassword,
                senderName: gmailCreds.senderName || 'PassCraft Operations Team'
              },
              recipients: [item],
              rulesConfig: rulesConfigPayload
            })
          });

          if (res.ok && res.data?.success && res.data.results && res.data.results[0]?.status === 'sent') {
            logsAccumulator.push({
              email: item.email,
              name: item.attendeeName,
              status: 'sent',
              time: new Date().toLocaleTimeString()
            });
          } else {
            const errMsg = res.data?.results?.[0]?.error || res.data?.error || res.error || 'Failed to send';
            logsAccumulator.push({
              email: item.email,
              name: item.attendeeName,
              status: 'failed',
              error: errMsg,
              time: new Date().toLocaleTimeString()
            });
          }
        } catch (err: any) {
          logsAccumulator.push({
            email: item.email,
            name: item.attendeeName,
            status: 'failed',
            error: err.message || 'Network error',
            time: new Date().toLocaleTimeString()
          });
        }

        const curSent = logsAccumulator.filter(l => l.status === 'sent').length;
        const curFailed = logsAccumulator.filter(l => l.status === 'failed').length;
        const curLeft = totalRecipients - (curSent + curFailed);

        setDispatchLogs([...logsAccumulator]);
        setDispatchProgress(Math.round(((curSent + curFailed) / totalRecipients) * 100));
        setDispatchProgressState(prev => ({
          ...prev,
          sentCount: curSent,
          failedCount: curFailed,
          toBeSentCount: curLeft,
          percent: Math.round(((curSent + curFailed) / totalRecipients) * 100),
          statusText: `Dispatched ${curSent} of ${totalRecipients} rules email(s) (${curLeft} to be sent)...`,
        }));
      }

      sentCount = logsAccumulator.filter(l => l.status === 'sent').length;
      failCount = logsAccumulator.filter(l => l.status === 'failed').length;

      recordDispatchHistory({
        type: 'rules_bomber',
        sourceLabel: 'Rules Bomber (Entry Guidelines)',
        eventId: currentEvent?.id,
        eventName: currentEvent?.title || 'Official Event',
        subject: subject,
        senderEmail: gmailCreds.senderEmail,
        senderName: gmailCreds.senderName || 'PassCraft Operations Team',
        totalRecipients: selectedPasses.length,
        sentCount,
        failedCount: failCount,
        status: failCount === 0 ? 'completed' : sentCount === 0 ? 'failed' : 'partial',
        summary: `Pre-drafted and dispatched ${sentCount} of ${selectedPasses.length} official event rules & guidelines email(s).`,
        details: {
          headline: 'OFFICIAL VENUE ADVISORY & CODE OF CONDUCT',
          allowedCount: allowedItems.length,
          prohibitedCount: prohibitedItems.length
        },
        recipients: selectedPasses.map((p, idx) => ({
          attendeeName: p.assignedTo?.name || 'Attendee',
          email: p.assignedTo?.email || '',
          status: idx < sentCount ? 'sent' : 'failed',
          sentAt: new Date().toLocaleTimeString()
        }))
      });

      setDispatchProgressState(prev => ({
        ...prev,
        phase: failCount === 0 ? 'completed' : sentCount === 0 ? 'failed' : 'completed',
        statusText: failCount === 0 
          ? `🎉 Successfully delivered all ${sentCount} rules emails!` 
          : `Delivered ${sentCount} emails, ${failCount} failed.`,
        percent: 100,
      }));

      setIsDispatching(false);
      if (sentCount > 0) {
        setAlertMessage({
          type: 'success',
          text: `🎉 Pre-drafted and successfully dispatched all ${sentCount} of ${selectedPasses.length} rules emails at once via Gmail!`
        });
      } else {
        setAlertMessage({
          type: 'error',
          text: 'Failed to dispatch emails. Please check your Gmail App Password and credentials.'
        });
      }
      return;
    }

    const totalRecipients = selectedPasses.length;
    setDispatchProgressState({
      isActive: true,
      phase: 'sending',
      currentStep: 1,
      totalSteps: 1,
      draftsCreated: 0,
      draftsLeft: 0,
      draftsTotal: 0,
      sentCount: 0,
      toBeSentCount: totalRecipients,
      failedCount: 0,
      totalToSend: totalRecipients,
      statusText: isTest ? 'Transmitting test rules email...' : `Connecting to Gmail SMTP for ${totalRecipients} attendee(s)...`,
      percent: 0,
    });

    for (let i = 0; i < selectedPasses.length; i++) {
      const pass = selectedPasses[i];
      const recipientPayload = {
        attendeeName: pass.assignedTo?.name || 'Valued Attendee',
        email: pass.assignedTo?.email || '',
        eventName: pass.eventName || currentEvent?.title || 'Event',
        eventDate: pass.eventDate || currentEvent?.date || 'Upcoming',
        eventTime: pass.eventTime || '10:00 AM',
        venue: pass.eventLocation || currentEvent?.location || 'Main Convention Hall',
        category: pass.category || 'General Attendee'
      };

      const remainingBefore = totalRecipients - (sentCount + failCount);
      setDispatchProgressState(prev => ({
        ...prev,
        phase: 'sending',
        currentStep: 1,
        totalSteps: 1,
        currentName: recipientPayload.attendeeName,
        currentEmail: recipientPayload.email,
        statusText: `Sending rules & guidelines to ${recipientPayload.attendeeName} (${remainingBefore} to be sent)...`,
        toBeSentCount: remainingBefore,
      }));

      try {
        const res = await safeFetchJson<{ success: boolean; results?: any[]; error?: string }>('/api/email/dispatch-rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            smtpConfig: {
              senderEmail: gmailCreds.senderEmail,
              appPassword: gmailCreds.appPassword,
              senderName: gmailCreds.senderName || 'PassCraft Operations Team'
            },
            recipients: [recipientPayload],
            rulesConfig: rulesConfigPayload
          })
        });

        if (res.ok && res.data?.success && res.data.results && res.data.results[0]?.status === 'sent') {
          sentCount++;
          setDispatchLogs(prev => [
            {
              email: recipientPayload.email,
              name: recipientPayload.attendeeName,
              status: 'sent',
              time: new Date().toLocaleTimeString()
            },
            ...prev
          ]);
        } else {
          failCount++;
          const errMsg = res.data?.results?.[0]?.error || res.data?.error || res.error || 'Failed';
          setDispatchLogs(prev => [
            {
              email: recipientPayload.email,
              name: recipientPayload.attendeeName,
              status: 'failed',
              error: errMsg,
              time: new Date().toLocaleTimeString()
            },
            ...prev
          ]);
        }
      } catch (networkErr: any) {
        failCount++;
        setDispatchLogs(prev => [
          {
            email: recipientPayload.email,
            name: recipientPayload.attendeeName,
            status: 'failed',
            error: networkErr.message || 'Network error',
            time: new Date().toLocaleTimeString()
          },
          ...prev
        ]);
      }

      const curSentAndFailed = sentCount + failCount;
      const curLeft = totalRecipients - curSentAndFailed;
      const pct = Math.round((curSentAndFailed / totalRecipients) * 100);

      setDispatchProgress(pct);
      setDispatchProgressState(prev => ({
        ...prev,
        sentCount,
        failedCount: failCount,
        toBeSentCount: curLeft,
        percent: pct,
        statusText: `Dispatched ${sentCount} of ${totalRecipients} rules email(s) (${curLeft} to be sent)...`,
      }));

      if (i < selectedPasses.length - 1) {
        await sleep(delayMs);
      }
    }

    setDispatchProgressState(prev => ({
      ...prev,
      phase: failCount === 0 ? 'completed' : sentCount === 0 ? 'failed' : 'completed',
      statusText: failCount === 0 
        ? `🎉 Successfully delivered all ${sentCount} rules emails!` 
        : `Delivered ${sentCount} emails, ${failCount} failed.`,
      percent: 100,
    }));

    // Record to unified broadcast history
    recordDispatchHistory({
      type: 'rules_bomber',
      sourceLabel: 'Rules Bomber (Entry Guidelines)',
      eventId: currentEvent?.id,
      eventName: currentEvent?.title || 'Official Event',
      subject: subject,
      senderEmail: gmailCreds.senderEmail,
      senderName: gmailCreds.senderName || 'PassCraft Operations Team',
      totalRecipients: selectedPasses.length,
      sentCount,
      failedCount: failCount,
      status: failCount === 0 ? 'completed' : sentCount === 0 ? 'failed' : 'partial',
      summary: `Broadcasted dress code (${dressCode}), allowed items (${allowedItems.length}), and prohibited items (${prohibitedItems.length}) guidelines to attendees.`,
      details: {
        headline: 'OFFICIAL VENUE ADVISORY & CODE OF CONDUCT',
        allowedCount: allowedItems.length,
        prohibitedCount: prohibitedItems.length
      },
      recipients: selectedPasses.map(p => ({
        attendeeName: p.assignedTo?.name || 'Valued Attendee',
        email: p.assignedTo?.email || '',
        status: 'sent',
        category: p.category,
        sentAt: new Date().toLocaleTimeString()
      }))
    });

    setIsDispatching(false);
    if (failCount === 0) {
      setAlertMessage({
        type: 'success',
        text: `🚀 Success! Dispatched Rules & Guidelines to ${sentCount} attendee(s)!`
      });
    } else {
      setAlertMessage({
        type: 'error',
        text: `Completed with warnings: ${sentCount} sent, ${failCount} failed. Check log below.`
      });
    }
  };

  // Sample Preview Data
  const sampleAttendee = {
    name: 'Alex Vance',
    email: 'alex.vance@example.com',
    eventTitle: currentEvent?.title || 'Global Tech & Innovation Summit 2026',
    date: currentEvent?.date || 'Oct 24, 2026',
    time: '09:30 AM',
    venue: currentEvent?.location || 'Silicon Arena, Hall 4, Bangalore',
    category: 'VIP All-Access Pass'
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-7xl mx-auto pb-16">
      
      {/* ========================================================================= */}
      {/* 1. TOP HERO & GMAIL STATUS BAR                                            */}
      {/* ========================================================================= */}
      <div className="bg-slate-900 border border-slate-800 p-6 md:p-8 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl">
                <ShieldAlert className="w-5 h-5" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 font-mono">
                Event Guidelines, Protocols & Recap Broadcaster
              </span>
            </div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-white flex items-center gap-3">
              Recap & <span className="text-indigo-400">Rules Dispatcher</span>
            </h1>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Blast comprehensive dress codes, prohibited/allowed items, gate entry policies, and conduct guidelines directly to your registered attendees' inboxes.
            </p>
          </div>

          {/* Connected Gmail Badge / Settings */}
          <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 shadow-inner">
            {gmailCreds && gmailCreds.senderEmail ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-sm uppercase shrink-0 shadow-md shadow-indigo-600/30">
                  {gmailCreds.senderEmail.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white">{gmailCreds.senderEmail}</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="text-[10px] text-indigo-300 font-mono uppercase tracking-wider flex items-center gap-1 mt-0.5">
                    <span>⚡ Synced with Pass Bomber</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Mail className="w-8 h-8 text-slate-500" />
                <div>
                  <div className="text-xs font-bold text-indigo-400">Gmail Not Connected</div>
                  <div className="text-[10px] text-slate-400">Add App Password to dispatch emails</div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowCredsEditor(!showCredsEditor)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {showCredsEditor ? 'Close Setup' : (gmailCreds ? 'Switch Gmail' : 'Connect Gmail')}
            </button>
          </div>
        </div>

        {/* Inline Gmail Credential Setup Accordion */}
        {showCredsEditor && (
          <form onSubmit={handleSaveCredentials} className="mt-6 pt-6 border-t border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4 animate-fadeIn">
            <div>
              <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Your Gmail Address</label>
              <input
                type="email"
                value={inputSenderEmail}
                onChange={e => setInputSenderEmail(e.target.value)}
                placeholder="yourevent@gmail.com"
                required
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-white text-xs px-3 py-2 rounded-xl outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">
                Gmail 16-Char App Password
              </label>
              <input
                type="password"
                value={inputAppPassword}
                onChange={e => setInputAppPassword(e.target.value)}
                placeholder="xxxx xxxx xxxx xxxx"
                required
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-white text-xs px-3 py-2 rounded-xl outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Sender Brand Name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputSenderName}
                  onChange={e => setInputSenderName(e.target.value)}
                  placeholder="PassCraft Event Operations"
                  className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 text-white text-xs px-3 py-2 rounded-xl outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase rounded-xl transition-colors cursor-pointer shadow-md shadow-indigo-600/30"
                >
                  Save
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Alert Banner */}
      {alertMessage && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 border ${
          alertMessage.type === 'success' ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300' : 'bg-rose-950/80 border-rose-500/50 text-rose-300'
        }`}>
          {alertMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" /> : <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />}
          <div className="text-xs font-bold flex-1">{alertMessage.text}</div>
          <button onClick={() => setAlertMessage(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SUB-PAGE SWITCHER: PRE-EVENT RULES vs POST-EVENT RECAP & THANK YOU     */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            id="subpage-rules-btn"
            onClick={() => setSubTab('rules')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              subTab === 'rules'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            1. Pre-Event Rules & Guidelines
          </button>

          <button
            id="subpage-recap-btn"
            onClick={() => setSubTab('recap')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              subTab === 'recap'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <HeartHandshake className="w-4 h-4" />
            2. Post-Event Recap & Thank You
          </button>
        </div>

        <div className="text-xs text-slate-400 font-medium px-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          {subTab === 'rules' 
            ? 'Broadcast gate timings, dress codes, & security items'
            : 'Send appreciation notes, photo galleries, surveys & replays'
          }
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. CONDITIONAL RENDER: RECAP (POST-EVENT THANK YOU)                       */}
      {/* ========================================================================= */}
      {subTab === 'recap' ? (
        <ThankYouPage
          passes={passes}
          events={events}
          currentUserEmail={currentUserEmail}
          onSwitchToRules={() => setSubTab('rules')}
        />
      ) : (
        <>
          {/* ========================================================================= */}
          {/* 3A. EVENT SELECTOR & AI INSPIRATION STUDIO (PRE-EVENT RULES)              */}
          {/* ========================================================================= */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          
          {/* Event Picker */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-indigo-400 tracking-wider mb-1.5">
              1. Target Event for Guidelines Dispatch
            </label>
            <select
              value={selectedEventId}
              onChange={e => setSelectedEventId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-white text-xs font-bold px-3 py-2.5 rounded-xl outline-none"
            >
              <option value="all">⚡ All Active Events ({eventPasses.length} Total Attendees)</option>
              {activeEvents.map(evt => {
                const count = passes.filter(p => (p.status === 'assigned' || p.status === 'checked_in') && (p.eventId === evt.id || (p.eventName && p.eventName.toLowerCase() === evt.title.toLowerCase()))).length;
                return (
                  <option key={evt.id} value={evt.id}>
                    {evt.title} ({evt.date}) — {count} Assigned Attendee(s)
                  </option>
                );
              })}
            </select>
          </div>

          {/* AI Generator Bar */}
          <div className="lg:col-span-2">
            <label className="block text-[10px] font-bold uppercase text-indigo-400 tracking-wider mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              2. AI Rules & Dress Code Generator
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder="e.g. 24h AI Hackathon, VIP Black Tie Gala Dinner, College Rock Fest..."
                className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 text-white text-xs px-4 py-2.5 rounded-xl outline-none"
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleGenerateAiRules())}
              />
              <button
                type="button"
                onClick={() => handleGenerateAiRules()}
                disabled={isAiGenerating}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-md shadow-indigo-600/30"
              >
                {isAiGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                Generate Rules
              </button>
            </div>
          </div>
        </div>

        {/* Quick Inspiration Pills */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-800">
          <span className="text-[10px] font-mono text-slate-500 uppercase">Quick Scenarios:</span>
          {[
            { label: '💻 Tech Hackathon & Summit', prompt: '24-hour university coding hackathon with laptop rules and badge security' },
            { label: '🎸 Rock / EDM Concert', prompt: 'Outdoor live music festival with no outside plastic bottles and bag inspection' },
            { label: '👑 Black Tie Gala Dinner', prompt: 'Formal black tie executive award banquet and dinner protocol' },
            { label: '🏫 College Cultural Fest', prompt: 'Inter-college youth cultural festival with college ID and dress code' },
            { label: '🏆 Sports / Athletic Meet', prompt: 'Inter-state athletic championship meet with sportswear and hydration rules' },
          ].map(chip => (
            <button
              key={chip.label}
              type="button"
              onClick={() => {
                setAiPrompt(chip.prompt);
                handleGenerateAiRules(chip.prompt);
              }}
              disabled={isAiGenerating}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-indigo-500/50 text-[11px] text-slate-300 rounded-lg transition-colors cursor-pointer"
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MAIN WORKSPACE: LEFT EDITOR VS RIGHT LIVE EMAIL PREVIEW (50/50 SPLIT)   */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* LEFT COLUMN: GUIDELINES & EMAIL CONTENT BUILDER (50%) */}
        <div className="w-full space-y-6">
          
          {/* Action Bar: Auto-save status & Reset */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs shadow-inner">
            <div className="flex items-center gap-2 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="text-[11px] font-mono">Changes auto-saved to browser</span>
            </div>
            <button
              type="button"
              onClick={handleResetToDefaults}
              className="text-[11px] font-mono text-slate-400 hover:text-indigo-400 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset to Defaults
            </button>
          </div>

          {/* Card 1: Dress Code & Timings */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Shirt className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">Dress Code & Timings</h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400 uppercase">Attendee Attire & Access</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Dress Code Title</label>
                <input
                  type="text"
                  value={dressCode}
                  onChange={e => setDressCode(e.target.value)}
                  placeholder="e.g. Semi-Casual, Smart Casual, Formal Black Tie"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-white text-xs px-3 py-2 rounded-xl outline-none font-bold"
                />
              </div>

              {/* Quick Dress Code Chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {['Semi-Casual', 'Smart Casual', 'Casual / Hoodies', 'Business Formal', 'Black Tie', 'Festive / Ethnic', 'Sportswear'].map(dc => (
                  <button
                    key={dc}
                    type="button"
                    onClick={() => setDressCode(dc)}
                    className={`px-2.5 py-1 text-[10px] rounded-lg font-bold transition-all cursor-pointer ${
                      dressCode.toLowerCase() === dc.toLowerCase()
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700'
                    }`}
                  >
                    {dc}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Dress Code Notes / Advice</label>
                <input
                  type="text"
                  value={dressCodeDetails}
                  onChange={e => setDressCodeDetails(e.target.value)}
                  placeholder="e.g. Collared shirts, jeans, comfortable footwear for walking..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-white text-xs px-3 py-2 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" /> Timings & Gate Policy
                </label>
                <textarea
                  rows={2}
                  value={gatePolicy}
                  onChange={e => setGatePolicy(e.target.value)}
                  placeholder="e.g. Registration opens at 9:00 AM. Entry restricted after 10:30 AM."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-white text-xs p-3 rounded-xl outline-none resize-none font-sans"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Allowed Items vs Prohibited Items */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Ban className="w-4 h-4 text-rose-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">Item Checklist (Bring vs Do Not Bring)</h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400 uppercase">Security & Baggage</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Allowed Items */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-emerald-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase text-emerald-400 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> What to Bring (Allowed)
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">{allowedItems.length} items</span>
                </div>

                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newAllowedItem}
                    onChange={e => setNewAllowedItem(e.target.value)}
                    placeholder="Add item..."
                    className="flex-1 bg-slate-900 border border-slate-800 text-white text-xs px-2.5 py-1.5 rounded-lg outline-none focus:border-indigo-500"
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddAllowed())}
                  />
                  <button
                    type="button"
                    onClick={handleAddAllowed}
                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {allowedItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-900 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg text-xs text-emerald-200">
                      <span className="truncate pr-2 font-medium">{item}</span>
                      <button
                        type="button"
                        onClick={() => setAllowedItems(prev => prev.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-rose-400 cursor-pointer shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Prohibited Items */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-rose-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase text-rose-400 flex items-center gap-1">
                    <Ban className="w-3.5 h-3.5" /> Do Not Bring (Prohibited)
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">{prohibitedItems.length} items</span>
                </div>

                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newProhibitedItem}
                    onChange={e => setNewProhibitedItem(e.target.value)}
                    placeholder="e.g. Plastic bottles..."
                    className="flex-1 bg-slate-900 border border-slate-800 text-white text-xs px-2.5 py-1.5 rounded-lg outline-none focus:border-indigo-500"
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddProhibited())}
                  />
                  <button
                    type="button"
                    onClick={handleAddProhibited}
                    className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {prohibitedItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-900 border border-rose-500/20 px-2.5 py-1.5 rounded-lg text-xs text-rose-200">
                      <span className="truncate pr-2 font-medium">{item}</span>
                      <button
                        type="button"
                        onClick={() => setProhibitedItems(prev => prev.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-rose-400 cursor-pointer shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* Card 3: Do's and Don'ts */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">Event Code of Conduct (Do's & Don'ts)</h3>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Do's */}
              <div className="space-y-2">
                <label className="block text-[10px] font-mono text-emerald-400 uppercase">✅ Do's</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newDo}
                    onChange={e => setNewDo(e.target.value)}
                    placeholder="Add Do rule..."
                    className="flex-1 bg-slate-950 border border-slate-800 text-white text-xs px-2.5 py-1.5 rounded-lg outline-none focus:border-indigo-500"
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddDo())}
                  />
                  <button onClick={handleAddDo} className="px-2.5 py-1.5 bg-emerald-600 text-white font-bold rounded-lg text-xs cursor-pointer">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {dos.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-950 p-2 rounded-lg text-xs text-slate-200 border border-slate-800/60">
                      <span className="truncate pr-1">{item}</span>
                      <button onClick={() => setDos(prev => prev.filter((_, i) => i !== idx))} className="text-slate-400 hover:text-rose-400">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Don'ts */}
              <div className="space-y-2">
                <label className="block text-[10px] font-mono text-rose-400 uppercase">❌ Don'ts</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newDont}
                    onChange={e => setNewDont(e.target.value)}
                    placeholder="Add Don't rule..."
                    className="flex-1 bg-slate-950 border border-slate-800 text-white text-xs px-2.5 py-1.5 rounded-lg outline-none focus:border-indigo-500"
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddDont())}
                  />
                  <button onClick={handleAddDont} className="px-2.5 py-1.5 bg-rose-600 text-white font-bold rounded-lg text-xs cursor-pointer">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {donts.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-950 p-2 rounded-lg text-xs text-slate-200 border border-slate-800/60">
                      <span className="truncate pr-1">{item}</span>
                      <button onClick={() => setDonts(prev => prev.filter((_, i) => i !== idx))} className="text-slate-400 hover:text-rose-400">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Subject, Intro & Advisory */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">Email Subject & Advisory Notice</h3>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-slate-500 uppercase">Theme:</span>
                {(['amber', 'emerald', 'cyan', 'crimson', 'slate'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleApplyThemePreset(t)}
                    className={`w-4 h-4 rounded-full border ${themePreset === t ? 'ring-2 ring-white' : 'opacity-70'} ${
                      t === 'amber' ? 'bg-amber-400' :
                      t === 'emerald' ? 'bg-emerald-400' :
                      t === 'cyan' ? 'bg-cyan-400' :
                      t === 'crimson' ? 'bg-rose-500' : 'bg-slate-400'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Email Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-white text-xs px-3 py-2 rounded-xl outline-none font-bold font-sans"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Introductory Message</label>
                <textarea
                  rows={2}
                  value={introMessage}
                  onChange={e => setIntroMessage(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-white text-xs p-3 rounded-xl outline-none resize-none font-sans"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-indigo-400 uppercase mb-1">
                  ⚠️ Special Security / Advisory Notice
                </label>
                <textarea
                  rows={2}
                  value={importantNotice}
                  onChange={e => setImportantNotice(e.target.value)}
                  className="w-full bg-slate-950 border border-indigo-500/30 focus:border-indigo-500 text-indigo-200 text-xs p-3 rounded-xl outline-none resize-none font-sans"
                />
              </div>
            </div>
          </div>

          {/* Card 5: Audience & Dispatch Bar */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  Recipient Audience Selection ({selectedPassIds.length} / {filteredRecipients.length} Selected)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  {selectedPassIds.length === filteredRecipients.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex items-center gap-1.5 flex-1 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={recipientSearch}
                  onChange={e => setRecipientSearch(e.target.value)}
                  placeholder="Filter attendees by name, email, or tier..."
                  className="bg-transparent text-xs text-white outline-none w-full"
                />
              </div>

              <div className="flex gap-1">
                {(['all', 'checked_in', 'not_checked_in'] as const).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setStatusFilter(tab)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-xl transition-colors cursor-pointer ${
                      statusFilter === tab ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {tab === 'all' ? 'All' : tab === 'checked_in' ? 'Checked In' : 'Not Checked In'}
                  </button>
                ))}
              </div>
            </div>

            {/* Recipient Checkbox List */}
            <div className="max-h-48 overflow-y-auto space-y-1 bg-slate-950 p-2.5 rounded-2xl border border-slate-800">
              {filteredRecipients.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  No assigned attendees with valid emails found for this event.
                </div>
              ) : (
                filteredRecipients.map(pass => {
                  const isChecked = selectedPassIds.includes(pass.id);
                  return (
                    <div
                      key={pass.id}
                      onClick={() => togglePassSelection(pass.id)}
                      className={`flex items-center justify-between p-2 rounded-xl text-xs transition-colors cursor-pointer ${
                        isChecked ? 'bg-indigo-950/60 border border-indigo-500/40 text-white' : 'bg-slate-900/60 hover:bg-slate-900 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="accent-indigo-600 w-3.5 h-3.5 rounded"
                        />
                        <span className="font-bold text-white truncate">{pass.assignedTo?.name || 'Delegate'}</span>
                        <span className="text-[11px] text-slate-400 font-mono truncate">{pass.assignedTo?.email}</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 bg-slate-950 text-indigo-300 rounded-lg font-mono shrink-0 ml-2 border border-slate-800">
                        {pass.category || 'General'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Dispatch Speed Controls & Trigger Buttons */}
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-[10px] font-bold uppercase text-slate-400">Dispatch Speed / Rate Limit:</span>
                <div className="flex gap-1.5 flex-wrap">
                  {[
                    { id: 'gap_1.5', label: '1.5s Gap (Standard)' },
                    { id: 'gap_3', label: '3.0s Gap (Safe)' },
                    { id: 'gap_5', label: '5.0s Gap (Ultra-Safe)' },
                    { id: 'draft_all_send', label: '🚀 Draft All & Send at Once' },
                  ].map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setDispatchSpeed(s.id as any)}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-xl transition-all cursor-pointer ${
                        dispatchSpeed === s.id
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                          : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Two-Phase / Single-Phase Progress Hub when dispatching */}
              {(isDispatching || dispatchProgressState.isActive) && (
                <div className="pt-2">
                  <DispatchProgressCard 
                    progress={dispatchProgressState} 
                    title="Event Rules & Entry Guidelines Blast Engine"
                    onDismiss={() => setDispatchProgressState(prev => ({ ...prev, isActive: false }))}
                  />
                </div>
              )}

              {/* CTA Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => handleStartDispatch(true)}
                  disabled={isDispatching}
                  className="px-4 py-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 hover:text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
                >
                  <Mail className="w-4 h-4 text-indigo-400" />
                  Send Test Email to Me
                </button>

                <button
                  type="button"
                  onClick={() => handleStartDispatch(false)}
                  disabled={isDispatching || selectedPassIds.length === 0}
                  className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-sm uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xl shadow-indigo-600/30"
                >
                  {isDispatching ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <Flame className="w-5 h-5 text-white animate-pulse" />
                  )}
                  <span>BLAST RULES TO {selectedPassIds.length} ATTENDEE(S)</span>
                </button>
              </div>
            </div>

          </div>

          {/* Delivery Logs Table */}
          {dispatchLogs.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h4 className="text-xs font-bold uppercase text-white">Live Transmission Feed</h4>
                <span className="text-[10px] font-mono text-slate-400">{dispatchLogs.length} attempts</span>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1.5 font-mono text-[11px]">
                {dispatchLogs.map((log, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-slate-500">{log.time}</span>
                      <span className="text-white font-bold">{log.name}</span>
                      <span className="text-slate-400">({log.email})</span>
                    </div>
                    {log.status === 'sent' ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <Check className="w-3 h-3" /> SENT
                      </span>
                    ) : (
                      <span className="text-rose-400 font-bold flex items-center gap-1" title={log.error}>
                        <X className="w-3 h-3" /> FAILED
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: REAL-TIME GMAIL PREVIEW (50%) */}
        <div className="w-full sticky top-6 space-y-4">
          
          {/* Device Switcher */}
          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl flex items-center justify-between shadow-xl">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold uppercase text-white">Live Gmail Preview</span>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setPreviewDevice('desktop')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  previewDevice === 'desktop' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-400 hover:text-white'
                }`}
                title="Desktop View"
              >
                <Monitor className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice('mobile')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  previewDevice === 'mobile' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-400 hover:text-white'
                }`}
                title="Mobile View"
              >
                <Smartphone className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Live Rendered Email Container */}
          <div className={`mx-auto transition-all ${previewDevice === 'mobile' ? 'max-w-xs' : 'max-w-full'}`}>
            <div 
              className="rounded-2xl border-2 overflow-hidden shadow-2xl transition-all"
              style={{
                backgroundColor: outerBackground,
                borderColor: accentColor,
                color: textColor
              }}
            >
              {/* Email Content Box */}
              <div 
                className="m-3 p-5 rounded-xl border space-y-4 text-left"
                style={{
                  backgroundColor: cardBackground,
                  borderColor: `${accentColor}40`
                }}
              >
                {/* Header Banner */}
                <div 
                  className="p-5 rounded-xl text-center"
                  style={{
                    background: `linear-gradient(135deg, ${headerGradientStart} 0%, ${headerGradientEnd} 100%)`,
                    color: headerTextColor
                  }}
                >
                  <div className="text-[10px] font-black uppercase tracking-widest opacity-90 mb-1">
                    📋 ATTENDEE BRIEFING & PROTOCOL
                  </div>
                  <h2 className="text-xl font-black uppercase tracking-tight leading-snug">
                    {sampleAttendee.eventTitle}
                  </h2>
                  <div className="text-[11px] font-bold mt-1 opacity-90">
                    📍 {sampleAttendee.venue} • 📅 {sampleAttendee.date}
                  </div>
                </div>

                {/* Greeting & Intro */}
                <div>
                  <div className="text-sm font-extrabold" style={{ color: textColor }}>
                    Dear {sampleAttendee.name},
                  </div>
                  {introMessage && (
                    <div className="text-xs mt-1 leading-relaxed" style={{ color: subtextColor }}>
                      {introMessage}
                    </div>
                  )}
                </div>

                {/* 1. Dress Code Card (Only if dressCode is non-empty) */}
                {dressCode && dressCode.trim() !== '' && (
                  <div 
                    className="p-3.5 rounded-xl border-l-4 space-y-1"
                    style={{
                      backgroundColor: 'rgba(0,0,0,0.3)',
                      borderColor: accentColor
                    }}
                  >
                    <div className="text-[9px] font-black uppercase tracking-wider" style={{ color: accentColor }}>
                      👔 DRESS CODE SPECIFICATION
                    </div>
                    <div className="text-base font-black uppercase" style={{ color: highlightColor }}>
                      {dressCode}
                    </div>
                    {dressCodeDetails && (
                      <div className="text-[11px] leading-relaxed" style={{ color: subtextColor }}>
                        {dressCodeDetails}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Gate & Timing Policy (Only if gatePolicy is non-empty) */}
                {gatePolicy && gatePolicy.trim() !== '' && (
                  <div className="p-3 rounded-xl bg-black/20 border border-white/5 space-y-1">
                    <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: subtextColor }}>
                      ⏰ TIMINGS & GATE ACCESS POLICY
                    </div>
                    <div className="text-xs font-bold leading-relaxed" style={{ color: textColor }}>
                      {gatePolicy}
                    </div>
                  </div>
                )}

                {/* 3. What to Bring vs Do Not Bring (Flexibly Rendered - Hides completely if 0 items) */}
                {(allowedItems.length > 0 || prohibitedItems.length > 0) && (
                  <div className={`grid ${allowedItems.length > 0 && prohibitedItems.length > 0 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'} gap-2.5 text-xs`}>
                    {/* Allowed (Only rendered if items exist) */}
                    {allowedItems.length > 0 && (
                      <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-1.5">
                        <div className="text-[10px] font-black uppercase text-emerald-400 flex items-center gap-1">
                          <Check className="w-3 h-3" /> WHAT TO BRING (ALLOWED)
                        </div>
                        <ul className="space-y-1 pl-3 text-[11px] list-disc marker:text-emerald-400" style={{ color: textColor }}>
                          {allowedItems.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Prohibited (Only rendered if items exist) */}
                    {prohibitedItems.length > 0 && (
                      <div className="p-3 rounded-xl bg-red-950/20 border border-red-500/30 space-y-1.5">
                        <div className="text-[10px] font-black uppercase text-red-400 flex items-center gap-1">
                          <Ban className="w-3 h-3" /> DO NOT BRING (PROHIBITED)
                        </div>
                        <ul className="space-y-1 pl-3 text-[11px] list-disc marker:text-red-400 text-red-200">
                          {prohibitedItems.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Do's & Don'ts (Flexibly Rendered - Hides completely if 0 items) */}
                {(dos.length > 0 || donts.length > 0) && (
                  <div className="p-3 rounded-xl bg-black/30 border border-white/5 space-y-2">
                    <div className="text-[10px] font-black uppercase tracking-wider" style={{ color: highlightColor }}>
                      📌 GENERAL CODE OF CONDUCT
                    </div>
                    <div className={`grid ${dos.length > 0 && donts.length > 0 ? 'grid-cols-2' : 'grid-cols-1'} gap-2 text-[10px]`}>
                      {dos.length > 0 && (
                        <div>
                          <span className="font-bold text-emerald-400 uppercase">DO'S</span>
                          <ul className="mt-1 space-y-1 pl-3 list-disc marker:text-emerald-400" style={{ color: textColor }}>
                            {dos.map((d, i) => (
                              <li key={i}>{d}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {donts.length > 0 && (
                        <div>
                          <span className="font-bold text-red-400 uppercase">DON'TS</span>
                          <ul className="mt-1 space-y-1 pl-3 list-disc marker:text-red-400 text-red-200">
                            {donts.map((d, i) => (
                              <li key={i}>{d}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 5. Special Advisory Notice (Only if specified) */}
                {importantNotice && importantNotice.trim() !== '' && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-[11px] leading-relaxed space-y-1">
                    <div className="font-black text-[9px] uppercase tracking-wider text-amber-400">
                      ⚠️ SECURITY & ADVISORY NOTICE
                    </div>
                    <div>{importantNotice}</div>
                  </div>
                )}

                {/* Footer Notice */}
                <div className="text-center pt-2 text-[10px]" style={{ color: subtextColor }}>
                  Have your digital pass or QR barcode ready on arrival for expedited verification.
                </div>
              </div>

              {/* Bottom Email Signature */}
              <div 
                className="py-3 px-4 text-center text-[10px] border-t border-white/10"
                style={{
                  backgroundColor: 'rgba(0,0,0,0.4)',
                  color: subtextColor
                }}
              >
                {gmailCreds?.senderName || 'PassCraft Operations Team'} • Official Event Guidelines & Regulations Dispatch
              </div>
            </div>
          </div>

        </div>

      </div>
    </>
  )}

</div>
  );
};
