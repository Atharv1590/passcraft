import React, { useState, useMemo, useEffect } from 'react';
import { PassItem, EventItem } from '../types';
import { recordDispatchHistory } from '../utils/historyStorage';
import { safeFetchJson } from '../lib/apiHelper';
import { DispatchProgressCard, DispatchProgressState } from './DispatchProgressCard';
import { 
  Mail, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Key, 
  User, 
  Calendar, 
  QrCode, 
  Sparkles, 
  Info, 
  Eye, 
  Code2, 
  Layers, 
  Check, 
  RefreshCw, 
  Search, 
  Users, 
  ShieldCheck, 
  Lock, 
  Loader2, 
  Clock, 
  Zap, 
  FastForward, 
  LogOut, 
  Sliders, 
  CheckCircle, 
  Palette, 
  ExternalLink, 
  Image as ImageIcon, 
  SlidersHorizontal, 
  Wand2, 
  Plus, 
  Trash2, 
  Save, 
  Bookmark, 
  X 
} from 'lucide-react';

interface EmailTicketDispatcherProps {
  passes: PassItem[];
  events: EventItem[];
  currentUserEmail: string | null;
}

const STORAGE_GMAIL_CREDENTIALS_KEY = 'passcraft_gmail_credentials_v1';
const STORAGE_CUSTOM_THEMES_KEY = 'passcraft_custom_email_themes_v1';
const STORAGE_EMAIL_DISPATCHER_STATE_KEY = 'passcraft_email_dispatcher_state_v2';

interface EmailDispatcherSavedState {
  subject?: string;
  bodyText?: string;
  displayMode?: 'both' | 'qr_only' | 'code_only';
  cardBackground?: string;
  headerGradientStart?: string;
  headerGradientEnd?: string;
  headerTextColor?: string;
  accentColor?: string;
  highlightColor?: string;
  outerBackground?: string;
  codeBoxBackground?: string;
  textColor?: string;
  subtextColor?: string;
  bannerUrl?: string;
  activeThemeId?: string;
  dispatchSpeed?: 'gap_1.5' | 'gap_3' | 'gap_5' | 'draft_all_send' | 'batch_parallel';
  selectedEventId?: string;
}

const loadSavedDispatcherState = (): EmailDispatcherSavedState | null => {
  try {
    const saved = localStorage.getItem(STORAGE_EMAIL_DISPATCHER_STATE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return null;
};

export interface EmailThemeItem {
  id?: string;
  name: string;
  cardBackground: string;
  headerGradientStart: string;
  headerGradientEnd: string;
  headerTextColor: string;
  accentColor: string;
  highlightColor: string;
  outerBackground: string;
  codeBoxBackground: string;
  textColor: string;
  subtextColor: string;
  isCustom?: boolean;
}

// Default Theme Presets for Email Tickets
const DEFAULT_EMAIL_THEME_PRESETS: EmailThemeItem[] = [
  {
    id: 'electric-indigo',
    name: 'Electric Indigo Tech',
    cardBackground: '#0f172a',
    headerGradientStart: '#4338ca',
    headerGradientEnd: '#6366f1',
    headerTextColor: '#ffffff',
    accentColor: '#818cf8',
    highlightColor: '#38bdf8',
    outerBackground: '#020617',
    codeBoxBackground: '#020617',
    textColor: '#f1f5f9',
    subtextColor: '#94a3b8',
  },
  {
    id: 'slate-sapphire',
    name: 'Slate Sapphire',
    cardBackground: '#0f172a',
    headerGradientStart: '#1e293b',
    headerGradientEnd: '#3b82f6',
    headerTextColor: '#ffffff',
    accentColor: '#60a5fa',
    highlightColor: '#93c5fd',
    outerBackground: '#020617',
    codeBoxBackground: '#0b1329',
    textColor: '#f8fafc',
    subtextColor: '#94a3b8',
  },
  {
    id: 'royal-gold',
    name: 'Royal Gold Executive',
    cardBackground: '#18181b',
    headerGradientStart: '#b45309',
    headerGradientEnd: '#fbbf24',
    headerTextColor: '#000000',
    accentColor: '#fbbf24',
    highlightColor: '#fef08a',
    outerBackground: '#09090b',
    codeBoxBackground: '#000000',
    textColor: '#ffffff',
    subtextColor: '#a1a1aa',
  },
  {
    id: 'emerald-cyber',
    name: 'Emerald Aurora',
    cardBackground: '#0d131f',
    headerGradientStart: '#059669',
    headerGradientEnd: '#10b981',
    headerTextColor: '#ffffff',
    accentColor: '#10b981',
    highlightColor: '#f59e0b',
    outerBackground: '#030712',
    codeBoxBackground: '#050b14',
    textColor: '#f8fafc',
    subtextColor: '#94a3b8',
  },
  {
    id: 'sunset-rose',
    name: 'Sunset Rose & Coral',
    cardBackground: '#1c1017',
    headerGradientStart: '#be123c',
    headerGradientEnd: '#fb7185',
    headerTextColor: '#ffffff',
    accentColor: '#fb7185',
    highlightColor: '#fbbf24',
    outerBackground: '#0c050a',
    codeBoxBackground: '#000000',
    textColor: '#fff1f2',
    subtextColor: '#fda4af',
  },
  {
    id: 'cyberpunk-neon',
    name: 'Cyberpunk Neon Cyan',
    cardBackground: '#05131e',
    headerGradientStart: '#0e7490',
    headerGradientEnd: '#22d3ee',
    headerTextColor: '#000000',
    accentColor: '#22d3ee',
    highlightColor: '#67e8f9',
    outerBackground: '#02090e',
    codeBoxBackground: '#010508',
    textColor: '#ecfeff',
    subtextColor: '#a5f3fc',
  },
  {
    id: 'clean-white',
    name: 'Clean Studio White',
    cardBackground: '#ffffff',
    headerGradientStart: '#0f172a',
    headerGradientEnd: '#334155',
    headerTextColor: '#ffffff',
    accentColor: '#059669',
    highlightColor: '#d97706',
    outerBackground: '#f1f5f9',
    codeBoxBackground: '#f8fafc',
    textColor: '#0f172a',
    subtextColor: '#64748b',
  },
];

export const EmailTicketDispatcher: React.FC<EmailTicketDispatcherProps> = ({
  passes,
  events,
  currentUserEmail
}) => {
  // Only active events for selector
  const activeEvents = useMemo(() => events.filter(e => e.status !== 'ended'), [events]);

  // Gmail Saved Credentials State
  const [senderEmail, setSenderEmail] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_GMAIL_CREDENTIALS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.senderEmail || currentUserEmail || '';
      }
    } catch (e) {}
    return currentUserEmail || '';
  });

  const [appPassword, setAppPassword] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_GMAIL_CREDENTIALS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.appPassword || '';
      }
    } catch (e) {}
    return '';
  });

  const [senderName, setSenderName] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_GMAIL_CREDENTIALS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.senderName || 'Pass Bomber';
      }
    } catch (e) {}
    return 'Pass Bomber';
  });

  const handleUpdateSenderName = (name: string) => {
    setSenderName(name);
    try {
      const saved = localStorage.getItem(STORAGE_GMAIL_CREDENTIALS_KEY);
      const parsed = saved ? JSON.parse(saved) : {};
      parsed.senderName = name;
      localStorage.setItem(STORAGE_GMAIL_CREDENTIALS_KEY, JSON.stringify(parsed));
    } catch (e) {}
  };

  const [isCredentialsSaved, setIsCredentialsSaved] = useState<boolean>(() => {
    return Boolean(appPassword && appPassword.trim().length >= 8);
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showAppPasswordGuide, setShowAppPasswordGuide] = useState(false);

  // Save Gmail Credentials to LocalStorage
  const handleSaveCredentials = () => {
    if (!senderEmail || !senderEmail.includes('@')) {
      alert('Please enter a valid Gmail address.');
      return;
    }
    if (!appPassword || appPassword.trim().length < 8) {
      alert('Please enter a valid 16-character Gmail App Password.');
      return;
    }

    const payload = {
      senderEmail: senderEmail.trim(),
      appPassword: appPassword.trim(),
      senderName: senderName.trim(),
      savedAt: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_GMAIL_CREDENTIALS_KEY, JSON.stringify(payload));
    setIsCredentialsSaved(true);
    setAlertMessage({ type: 'success', text: '🔒 Gmail Credentials saved securely! They will persist until you press Disconnect.' });
    setTimeout(() => setAlertMessage(null), 4000);
  };

  // Disconnect & Clear Gmail Credentials
  const handleDisconnectCredentials = () => {
    const confirmDisconnect = window.confirm(
      `Are you sure you want to disconnect Gmail account (${senderEmail})?\nYour saved App Password will be cleared.`
    );

    if (confirmDisconnect) {
      localStorage.removeItem(STORAGE_GMAIL_CREDENTIALS_KEY);
      setAppPassword('');
      setIsCredentialsSaved(false);
      setAlertMessage({ type: 'error', text: 'Disconnected Gmail App Password credentials.' });
      setTimeout(() => setAlertMessage(null), 3000);
    }
  };

  const savedState = useMemo(() => loadSavedDispatcherState(), []);

  // Event & Recipient Selection State
  const [selectedEventId, setSelectedEventId] = useState<string>(() => savedState?.selectedEventId ?? 'all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter assigned passes with emails only
  const assignedPasses = useMemo(() => {
    return passes.filter(p => (p.status === 'assigned' || p.status === 'checked_in') && p.assignedTo?.email);
  }, [passes]);

  // Selected Pass IDs for batch dispatch
  const [selectedPassIds, setSelectedPassIds] = useState<Set<string>>(() => {
    return new Set(assignedPasses.map(p => p.id));
  });

  // Keep all passes selected if new passes are added
  useEffect(() => {
    setSelectedPassIds(new Set(assignedPasses.map(p => p.id)));
  }, [assignedPasses.length]);

  // Table rows filtered by event and search term
  const filteredRecipients = useMemo(() => {
    return assignedPasses.filter(p => {
      const matchesEvent = selectedEventId === 'all' || p.eventId === selectedEventId;
      const matchesSearch = !searchTerm || 
        (p.assignedTo?.name && p.assignedTo.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.assignedTo?.email && p.assignedTo.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        p.formattedCode.includes(searchTerm);
      return matchesEvent && matchesSearch;
    });
  }, [assignedPasses, selectedEventId, searchTerm]);

  // Check if all currently filtered rows are selected
  const allFilteredSelected = useMemo(() => {
    return filteredRecipients.length > 0 && filteredRecipients.every(p => selectedPassIds.has(p.id));
  }, [filteredRecipients, selectedPassIds]);

  // Toggle selection for a single pass
  const togglePassSelection = (id: string) => {
    const updated = new Set(selectedPassIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedPassIds(updated);
  };

  // Toggle select all filtered rows in table
  const toggleSelectAllFiltered = () => {
    const updated = new Set(selectedPassIds);
    if (allFilteredSelected) {
      filteredRecipients.forEach(p => updated.delete(p.id));
    } else {
      filteredRecipients.forEach(p => updated.add(p.id));
    }
    setSelectedPassIds(updated);
  };

  // Template Content State
  const [subject, setSubject] = useState(() => savedState?.subject ?? '🎟️ Official Entry Ticket for {{EVENT_NAME}} - {{ATTENDEE_NAME}}');
  const [bodyText, setBodyText] = useState(() => savedState?.bodyText ?? 
`Dear {{ATTENDEE_NAME}},

We are thrilled to confirm your registration for {{EVENT_NAME}}!

Event Details:
• Date: {{EVENT_DATE}}
• Entry Time: {{EVENT_TIME}}
• Location: {{VENUE}}
• Pass Category: {{PASS_CATEGORY}}

Please present this official ticket at the venue entry gate. Your 16-digit verification code is {{CODE_16}}.

Looking forward to seeing you at the event!`
  );

  // Pass Display Mode
  const [displayMode, setDisplayMode] = useState<'both' | 'qr_only' | 'code_only'>(() => savedState?.displayMode ?? 'both');

  // =========================================================================
  // EMAIL COLOR & CANVA STYLING STATE
  // =========================================================================
  const [cardBackground, setCardBackground] = useState(() => savedState?.cardBackground ?? '#0f172a');
  const [headerGradientStart, setHeaderGradientStart] = useState(() => savedState?.headerGradientStart ?? '#4338ca');
  const [headerGradientEnd, setHeaderGradientEnd] = useState(() => savedState?.headerGradientEnd ?? '#6366f1');
  const [headerTextColor, setHeaderTextColor] = useState(() => savedState?.headerTextColor ?? '#ffffff');
  const [accentColor, setAccentColor] = useState(() => savedState?.accentColor ?? '#818cf8');
  const [highlightColor, setHighlightColor] = useState(() => savedState?.highlightColor ?? '#38bdf8');
  const [outerBackground, setOuterBackground] = useState(() => savedState?.outerBackground ?? '#020617');
  const [codeBoxBackground, setCodeBoxBackground] = useState(() => savedState?.codeBoxBackground ?? '#0f172a');
  const [textColor, setTextColor] = useState(() => savedState?.textColor ?? '#f8fafc');
  const [subtextColor, setSubtextColor] = useState(() => savedState?.subtextColor ?? '#94a3b8');
  const [bannerUrl, setBannerUrl] = useState(() => savedState?.bannerUrl ?? '');

  // AI Theme Studio State
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [showColorControls, setShowColorControls] = useState(false);

  // Custom User-Created Themes State
  const [customThemes, setCustomThemes] = useState<EmailThemeItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CUSTOM_THEMES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  });
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [newThemeName, setNewThemeName] = useState('');
  const [activeThemeId, setActiveThemeId] = useState<string>(() => savedState?.activeThemeId ?? 'electric-indigo');

  // Combined theme presets (built-in + custom)
  const allThemes = useMemo(() => {
    return [...DEFAULT_EMAIL_THEME_PRESETS, ...customThemes];
  }, [customThemes]);

  // Dispatch Speed Strategy
  const [dispatchSpeed, setDispatchSpeed] = useState<'gap_1.5' | 'gap_3' | 'gap_5' | 'draft_all_send' | 'batch_parallel'>(() => savedState?.dispatchSpeed ?? 'gap_1.5');

  // Auto-persist Email Dispatcher state to localStorage
  useEffect(() => {
    const stateToSave: EmailDispatcherSavedState = {
      subject,
      bodyText,
      displayMode,
      cardBackground,
      headerGradientStart,
      headerGradientEnd,
      headerTextColor,
      accentColor,
      highlightColor,
      outerBackground,
      codeBoxBackground,
      textColor,
      subtextColor,
      bannerUrl,
      activeThemeId,
      dispatchSpeed,
      selectedEventId,
    };
    try {
      localStorage.setItem(STORAGE_EMAIL_DISPATCHER_STATE_KEY, JSON.stringify(stateToSave));
    } catch (e) {}
  }, [
    subject,
    bodyText,
    displayMode,
    cardBackground,
    headerGradientStart,
    headerGradientEnd,
    headerTextColor,
    accentColor,
    highlightColor,
    outerBackground,
    codeBoxBackground,
    textColor,
    subtextColor,
    bannerUrl,
    activeThemeId,
    dispatchSpeed,
    selectedEventId,
  ]);

  // Preview Sample Attendee Index
  const [previewIndex, setPreviewIndex] = useState<number>(0);

  // Sending Process State
  const [isSending, setIsSending] = useState(false);
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
  const [dispatchLogs, setDispatchLogs] = useState<Array<{ email: string; attendeeName: string; status: 'sent' | 'failed'; error?: string }>>([]);
  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleDismissProgress = React.useCallback(() => {
    setDispatchProgressState(prev => ({ ...prev, isActive: false }));
  }, []);

  // Apply Theme Preset
  const handleApplyPreset = (preset: EmailThemeItem) => {
    if (preset.id) setActiveThemeId(preset.id);
    setCardBackground(preset.cardBackground);
    setHeaderGradientStart(preset.headerGradientStart);
    setHeaderGradientEnd(preset.headerGradientEnd);
    setHeaderTextColor(preset.headerTextColor);
    setAccentColor(preset.accentColor);
    setHighlightColor(preset.highlightColor);
    setOuterBackground(preset.outerBackground);
    setCodeBoxBackground(preset.codeBoxBackground);
    setTextColor(preset.textColor);
    setSubtextColor(preset.subtextColor);
  };

  // Save Current Colors as Custom Theme
  const handleSaveCurrentTheme = (nameToSave?: string) => {
    const name = (nameToSave || newThemeName || '').trim();
    if (!name) {
      setAlertMessage({ type: 'error', text: 'Please enter a name for your custom theme.' });
      return;
    }

    const newTheme: EmailThemeItem = {
      id: `custom-${Date.now()}`,
      name,
      cardBackground,
      headerGradientStart,
      headerGradientEnd,
      headerTextColor,
      accentColor,
      highlightColor,
      outerBackground,
      codeBoxBackground,
      textColor,
      subtextColor,
      isCustom: true,
    };

    const updated = [...customThemes, newTheme];
    setCustomThemes(updated);
    try {
      localStorage.setItem(STORAGE_CUSTOM_THEMES_KEY, JSON.stringify(updated));
    } catch (e) {}

    setActiveThemeId(newTheme.id!);
    setNewThemeName('');
    setIsSavingTheme(false);
    setAlertMessage({
      type: 'success',
      text: `✨ Custom Theme "${name}" saved and added to your themes bar!`
    });
    setTimeout(() => setAlertMessage(null), 4000);
  };

  // Delete Custom Theme
  const handleDeleteCustomTheme = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customThemes.filter(t => t.id !== id);
    setCustomThemes(updated);
    try {
      localStorage.setItem(STORAGE_CUSTOM_THEMES_KEY, JSON.stringify(updated));
    } catch (e) {}
    if (activeThemeId === id) {
      setActiveThemeId('emerald-cyber');
    }
  };

  // AI Theme Generator
  const handleGenerateAiTheme = async (customPrompt?: string) => {
    const promptToUse = (customPrompt || aiPrompt).trim();
    if (!promptToUse) return;
    setIsGeneratingAi(true);
    setAlertMessage(null);

    const currentEvent = selectedEventId !== 'all' ? events.find(e => e.id === selectedEventId) : (activeEvents[0] || events[0]);

    try {
      const response = await safeFetchJson<{ success: boolean; data?: any; error?: string }>('/api/gemini/design-email-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: promptToUse, 
          eventContext: currentEvent ? { title: currentEvent.title, date: currentEvent.date, location: currentEvent.location } : undefined 
        }),
      });

      if (response.ok && response.data?.success && response.data?.data) {
        const d = response.data.data;
        if (d.subject) setSubject(d.subject);
        if (d.bodyText) setBodyText(d.bodyText);
        if (d.headerGradientStart) setHeaderGradientStart(d.headerGradientStart);
        if (d.headerGradientEnd) setHeaderGradientEnd(d.headerGradientEnd);
        if (d.headerTextColor) setHeaderTextColor(d.headerTextColor);
        if (d.cardBackground) setCardBackground(d.cardBackground);
        if (d.outerBackground) setOuterBackground(d.outerBackground);
        if (d.codeBoxBackground) setCodeBoxBackground(d.codeBoxBackground);
        if (d.accentColor) setAccentColor(d.accentColor);
        if (d.highlightColor) setHighlightColor(d.highlightColor);
        if (d.textColor) setTextColor(d.textColor);
        if (d.subtextColor) setSubtextColor(d.subtextColor);
        if (d.bannerUrl) setBannerUrl(d.bannerUrl);

        setActiveThemeId('ai-generated');

        setAlertMessage({
          type: 'success',
          text: `✨ Applied AI Theme: "${d.themeName || d.presetThemeName || 'Custom Theme'}"! Live preview updated.`
        });
        setTimeout(() => setAlertMessage(null), 5000);
      } else {
        setAlertMessage({ type: 'error', text: response.data?.error || response.error || 'Failed to generate AI email template.' });
      }
    } catch (err: any) {
      setAlertMessage({ type: 'error', text: err.message || 'AI generation failed.' });
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Insert placeholder tag into body text
  const insertPlaceholder = (tag: string) => {
    setBodyText(prev => prev + ' ' + tag);
  };

  // Active preview pass
  const samplePass = useMemo(() => {
    if (filteredRecipients.length === 0) {
      return {
        assignedTo: { name: 'Rahul Sharma', email: 'rahul@example.com' },
        eventName: 'GLOBAL TECH SUMMIT 2026',
        eventDate: '2026-09-15',
        eventTime: '10:00 AM',
        commencementTime: '10:00 AM',
        eventLocation: 'Grand Convention Center, Mumbai',
        category: 'VIP DELEGATE',
        formattedCode: '4920-1948-2039-1823',
        code16: '4920194820391823',
        qrDataUrl: '',
      };
    }
    return filteredRecipients[Math.min(previewIndex, filteredRecipients.length - 1)];
  }, [filteredRecipients, previewIndex]);

  // Generate Sample QR Data URL for preview
  const sampleQrUrl = useMemo(() => {
    const code = samplePass.code16 || '4920194820391823';
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(code)}`;
  }, [samplePass]);

  // Formatted Body Text for Preview
  const formattedPreviewBody = useMemo(() => {
    let txt = bodyText
      .replace(/\{\{ATTENDEE_NAME\}\}/g, samplePass.assignedTo?.name || 'Valued Guest')
      .replace(/\{\{EVENT_NAME\}\}/g, samplePass.eventName || 'Event')
      .replace(/\{\{EVENT_DATE\}\}/g, samplePass.eventDate || 'TBA')
      .replace(/\{\{EVENT_TIME\}\}/g, samplePass.eventTime || samplePass.commencementTime || '10:00 AM')
      .replace(/\{\{VENUE\}\}/g, samplePass.eventLocation || 'Venue')
      .replace(/\{\{PASS_CATEGORY\}\}/g, samplePass.category || 'General');

    if (displayMode === 'both' || displayMode === 'code_only') {
      txt = txt.replace(/\{\{CODE_16\}\}/g, samplePass.formattedCode || samplePass.code16);
    } else {
      txt = txt.replace(/16-digit verification code is \{\{CODE_16\}\}/gi, 'QR code is attached below.')
               .replace(/\{\{CODE_16\}\}/g, '');
    }
    return txt;
  }, [bodyText, samplePass, displayMode]);

  // Perform Email Dispatch
  const handleStartDispatch = async (isTestMode: boolean = false) => {
    if (!senderEmail || !senderEmail.includes('@')) {
      setAlertMessage({ type: 'error', text: 'Please enter your valid Gmail address.' });
      return;
    }

    if (!appPassword || appPassword.trim().length < 8) {
      setAlertMessage({ type: 'error', text: 'Please enter your 16-character Gmail App Password.' });
      return;
    }

    if (!isCredentialsSaved) {
      localStorage.setItem(STORAGE_GMAIL_CREDENTIALS_KEY, JSON.stringify({
        senderEmail: senderEmail.trim(),
        appPassword: appPassword.trim(),
        senderName: senderName.trim(),
        savedAt: new Date().toISOString()
      }));
      setIsCredentialsSaved(true);
    }

    const emailStylePayload = {
      cardBackground,
      headerGradientStart,
      headerGradientEnd,
      headerTextColor,
      accentColor,
      highlightColor,
      outerBackground,
      codeBoxBackground,
      textColor,
      subtextColor,
      bannerUrl: bannerUrl.trim() || undefined,
    };

    const recipientsToSend = isTestMode
      ? [{
          email: senderEmail.trim(),
          attendeeName: samplePass.assignedTo?.name || 'Test Guest',
          eventName: samplePass.eventName || 'Sample Event',
          eventDate: samplePass.eventDate || '2026-09-15',
          eventTime: samplePass.eventTime || samplePass.commencementTime || '10:00 AM',
          venue: samplePass.eventLocation || 'Main Hall',
          category: samplePass.category || 'VIP',
          code16: samplePass.code16,
          formattedCode: samplePass.formattedCode,
          qrDataUrl: sampleQrUrl,
        }]
      : assignedPasses
          .filter(p => selectedPassIds.has(p.id) && (selectedEventId === 'all' || p.eventId === selectedEventId))
          .map(p => ({
            email: p.assignedTo?.email || '',
            attendeeName: p.assignedTo?.name || 'Valued Guest',
            eventName: p.eventName || 'Event',
            eventDate: p.eventDate || 'TBA',
            eventTime: p.eventTime || p.commencementTime || 'Doors Open 6:00 PM',
            venue: p.eventLocation || 'Main Venue',
            category: p.category || 'Delegate',
            code16: p.code16,
            formattedCode: p.formattedCode,
            qrDataUrl: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(p.code16)}`,
          }));

    if (recipientsToSend.length === 0) {
      setAlertMessage({ type: 'error', text: 'No attendees selected for email dispatch.' });
      return;
    }

    setIsSending(true);
    setAlertMessage(null);
    setDispatchLogs([]);

    const totalCount = recipientsToSend.length;

    try {
      if ((dispatchSpeed === 'draft_all_send' || dispatchSpeed === 'batch_parallel') && !isTestMode) {
        // Phase 1: Pre-draft all emails with visible granular progress
        setDispatchProgressState({
          isActive: true,
          phase: 'drafting',
          currentStep: 1,
          totalSteps: 2,
          draftsCreated: 0,
          draftsLeft: totalCount,
          draftsTotal: totalCount,
          sentCount: 0,
          toBeSentCount: totalCount,
          failedCount: 0,
          totalToSend: totalCount,
          statusText: `Initializing draft engine for ${totalCount} attendees...`,
          percent: 0,
        });

        const draftedRecipients = [];
        for (let i = 0; i < recipientsToSend.length; i++) {
          const item = recipientsToSend[i];
          const createdSoFar = i + 1;
          const leftToDraft = totalCount - createdSoFar;
          const draftPercent = Math.round((createdSoFar / totalCount) * 100);

          setDispatchProgressState(prev => ({
            ...prev,
            phase: 'drafting',
            currentStep: 1,
            draftsCreated: createdSoFar,
            draftsLeft: leftToDraft,
            draftsTotal: totalCount,
            currentName: item.attendeeName,
            currentEmail: item.email,
            statusText: `Drafting customized pass email for ${item.attendeeName} (${createdSoFar}/${totalCount} created, ${leftToDraft} left)...`,
            percent: draftPercent,
          }));

          draftedRecipients.push(item);
          if (recipientsToSend.length > 1) {
            await new Promise(r => setTimeout(r, Math.min(80, 1500 / recipientsToSend.length)));
          }
        }

        // Phase 2: Dispatch all drafted emails with live tracking of sent and to be sent
        setDispatchProgressState(prev => ({
          ...prev,
          phase: 'sending',
          currentStep: 2,
          draftsCreated: totalCount,
          draftsLeft: 0,
          sentCount: 0,
          toBeSentCount: totalCount,
          failedCount: 0,
          totalToSend: totalCount,
          statusText: `All ${totalCount} drafts ready! Now connecting to Gmail SMTP...`,
          percent: 0,
        }));

        const logsAccumulator: Array<{ email: string; attendeeName: string; status: 'sent' | 'failed'; error?: string }> = [];

        for (let i = 0; i < draftedRecipients.length; i++) {
          const draftedItem = draftedRecipients[i];
          const remainingBefore = totalCount - (logsAccumulator.filter(l => l.status === 'sent').length + logsAccumulator.filter(l => l.status === 'failed').length);

          setDispatchProgressState(prev => ({
            ...prev,
            phase: 'sending',
            currentStep: 2,
            currentName: draftedItem.attendeeName,
            currentEmail: draftedItem.email,
            statusText: `Sending ticket to ${draftedItem.attendeeName} (${remainingBefore} to be sent)...`,
            toBeSentCount: remainingBefore,
          }));

          const resp = await safeFetchJson<{ success: boolean; results?: any[]; error?: string }>('/api/email/dispatch-passes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              smtpConfig: {
                senderEmail: senderEmail.trim(),
                appPassword: appPassword.trim(),
                senderName: senderName.trim(),
              },
              recipients: [draftedItem],
              template: { 
                subject, 
                bodyText, 
                displayMode,
                ...emailStylePayload,
                style: emailStylePayload
              },
            }),
          });

          if (resp.ok && resp.data?.success && resp.data.results && resp.data.results.length > 0) {
            logsAccumulator.push(resp.data.results[0]);
          } else {
            logsAccumulator.push({
              email: draftedItem.email,
              attendeeName: draftedItem.attendeeName,
              status: 'failed',
              error: resp.data?.error || resp.error || 'SMTP Connection Error',
            });
          }

          const curSent = logsAccumulator.filter(l => l.status === 'sent').length;
          const curFailed = logsAccumulator.filter(l => l.status === 'failed').length;
          const remainingToBeSent = totalCount - (curSent + curFailed);

          setDispatchLogs([...logsAccumulator]);
          setDispatchProgressState(prev => ({
            ...prev,
            sentCount: curSent,
            failedCount: curFailed,
            toBeSentCount: remainingToBeSent,
            percent: Math.round(((curSent + curFailed) / totalCount) * 100),
            statusText: `Dispatched ${curSent} of ${totalCount} email(s) via Gmail (${remainingToBeSent} to be sent)...`,
          }));
        }

        const totalSent = logsAccumulator.filter(l => l.status === 'sent').length;
        const totalFailed = logsAccumulator.filter(l => l.status === 'failed').length;

        // Record to unified broadcast history
        const currentEvt = selectedEventId !== 'all' ? events.find(e => e.id === selectedEventId) : null;
        recordDispatchHistory({
          type: 'pass_bomber',
          sourceLabel: 'Pass Bomber (Pass Tickets)',
          eventId: currentEvt?.id,
          eventName: currentEvt?.title || (selectedEventId === 'all' ? 'All Events' : samplePass.eventName || 'Official Event'),
          subject: subject,
          senderEmail: senderEmail.trim(),
          senderName: senderName.trim() || 'PassCraft Operations Desk',
          totalRecipients: totalCount,
          sentCount: totalSent,
          failedCount: totalFailed,
          status: totalFailed === 0 ? 'completed' : totalSent === 0 ? 'failed' : 'partial',
          summary: `Pre-drafted and dispatched ${totalSent} of ${totalCount} digital pass ticket(s) with QR codes and 16-digit access keys.`,
          details: {
            displayMode,
            ticketTier: 'Pass Tickets Dispatch'
          },
          recipients: logsAccumulator.map((r: any, idx: number) => ({
            attendeeName: r.attendeeName || recipientsToSend[idx]?.attendeeName || 'Guest',
            email: r.email,
            status: r.status,
            error: r.error,
            formattedCode: recipientsToSend[idx]?.formattedCode,
            category: recipientsToSend[idx]?.category,
            sentAt: new Date().toLocaleTimeString()
          }))
        });

        setDispatchProgressState(prev => ({
          ...prev,
          phase: totalFailed === 0 ? 'completed' : totalSent === 0 ? 'failed' : 'completed',
          statusText: totalFailed === 0 
            ? `🎉 Successfully drafted and delivered all ${totalSent} pass tickets!` 
            : `Delivered ${totalSent} tickets, ${totalFailed} failed.`,
          percent: 100,
        }));

        if (totalSent > 0) {
          setAlertMessage({
            type: 'success',
            text: `🎉 Pre-drafted and dispatched all ${totalSent} of ${totalCount} tickets at once via Gmail!`,
          });
        } else {
          setAlertMessage({
            type: 'error',
            text: 'Failed to dispatch emails. Please verify your Gmail address and 16-character App Password.',
          });
        }
      } else {
        const delayMs = isTestMode ? 0
                      : dispatchSpeed === 'gap_1.5' ? 1500
                      : dispatchSpeed === 'gap_3' ? 3000
                      : dispatchSpeed === 'gap_5' ? 5000
                      : 0;

        // Single-Phase Direct Sequential Dispatch via Gmail SMTP
        setDispatchProgressState({
          isActive: true,
          phase: 'sending',
          currentStep: 1,
          totalSteps: 1,
          draftsCreated: 0,
          draftsLeft: 0,
          draftsTotal: 0,
          sentCount: 0,
          toBeSentCount: totalCount,
          failedCount: 0,
          totalToSend: totalCount,
          statusText: `Connecting to Gmail SMTP and starting transmission...`,
          percent: 0,
        });

        const logsAccumulator: Array<{ email: string; attendeeName: string; status: 'sent' | 'failed'; error?: string }> = [];

        for (let i = 0; i < recipientsToSend.length; i++) {
          const item = recipientsToSend[i];
          const remainingBefore = totalCount - (logsAccumulator.filter(l => l.status === 'sent').length + logsAccumulator.filter(l => l.status === 'failed').length);

          setDispatchProgressState(prev => ({
            ...prev,
            phase: 'sending',
            currentStep: 1,
            totalSteps: 1,
            currentName: item.attendeeName,
            currentEmail: item.email,
            statusText: `Sending ticket to ${item.attendeeName} (${remainingBefore} to be sent)...`,
            toBeSentCount: remainingBefore,
          }));

          const resp = await safeFetchJson<{ success: boolean; results?: any[]; error?: string }>('/api/email/dispatch-passes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              smtpConfig: {
                senderEmail: senderEmail.trim(),
                appPassword: appPassword.trim(),
                senderName: senderName.trim(),
              },
              recipients: [item],
              template: { 
                subject, 
                bodyText, 
                displayMode,
                ...emailStylePayload,
                style: emailStylePayload
              },
            }),
          });

          if (resp.ok && resp.data?.success && resp.data.results && resp.data.results.length > 0) {
            logsAccumulator.push(resp.data.results[0]);
          } else {
            logsAccumulator.push({
              email: item.email,
              attendeeName: item.attendeeName,
              status: 'failed',
              error: resp.data?.error || resp.error || 'SMTP Connection Error',
            });
          }

          const curSent = logsAccumulator.filter(l => l.status === 'sent').length;
          const curFailed = logsAccumulator.filter(l => l.status === 'failed').length;
          const remainingToBeSent = totalCount - (curSent + curFailed);

          setDispatchLogs([...logsAccumulator]);
          setDispatchProgressState(prev => ({
            ...prev,
            sentCount: curSent,
            failedCount: curFailed,
            toBeSentCount: remainingToBeSent,
            percent: Math.round(((curSent + curFailed) / totalCount) * 100),
            statusText: `Dispatched ${curSent} of ${totalCount} email(s) via Gmail (${remainingToBeSent} to be sent)...`,
          }));

          if (i < recipientsToSend.length - 1 && delayMs > 0) {
            await new Promise(res => setTimeout(res, delayMs));
          }
        }

        const totalSent = logsAccumulator.filter(l => l.status === 'sent').length;
        const totalFailed = logsAccumulator.filter(l => l.status === 'failed').length;

        // Record to unified broadcast history
        const currentEvt = selectedEventId !== 'all' ? events.find(e => e.id === selectedEventId) : null;
        recordDispatchHistory({
          type: 'pass_bomber',
          sourceLabel: 'Pass Bomber (Pass Tickets)',
          eventId: currentEvt?.id,
          eventName: currentEvt?.title || (selectedEventId === 'all' ? 'All Events' : samplePass.eventName || 'Official Event'),
          subject: subject,
          senderEmail: senderEmail.trim(),
          senderName: senderName.trim() || 'PassCraft Operations Desk',
          totalRecipients: totalCount,
          sentCount: totalSent,
          failedCount: totalFailed,
          status: totalFailed === 0 ? 'completed' : totalSent === 0 ? 'failed' : 'partial',
          summary: `Dispatched ${totalSent} of ${totalCount} digital pass ticket(s) with QR codes and 16-digit access keys.`,
          details: {
            displayMode,
            ticketTier: 'Pass Tickets Dispatch'
          },
          recipients: logsAccumulator.map((r: any, idx: number) => ({
            attendeeName: r.attendeeName || recipientsToSend[idx]?.attendeeName || 'Guest',
            email: r.email,
            status: r.status,
            error: r.error,
            formattedCode: recipientsToSend[idx]?.formattedCode,
            category: recipientsToSend[idx]?.category,
            sentAt: new Date().toLocaleTimeString()
          }))
        });

        setDispatchProgressState(prev => ({
          ...prev,
          phase: totalFailed === 0 ? 'completed' : totalSent === 0 ? 'failed' : 'completed',
          statusText: totalFailed === 0 
            ? `🎉 Successfully delivered all ${totalSent} pass tickets!` 
            : `Delivered ${totalSent} tickets, ${totalFailed} failed.`,
          percent: 100,
        }));

        if (totalSent > 0) {
          setAlertMessage({ 
            type: 'success', 
            text: isTestMode 
              ? `✨ Test pass ticket delivered directly to ${senderEmail}!` 
              : `🚀 Dispatched pass tickets to ${totalSent} attendee(s)!`
          });
        } else {
          setAlertMessage({ 
            type: 'error', 
            text: 'Dispatch failed. Please check your Gmail address and 16-character App Password.' 
          });
        }
      }
    } catch (err: any) {
      setDispatchProgressState(prev => ({
        ...prev,
        phase: 'failed',
        statusText: err.message || 'Transmission halted by network error',
      }));
      setAlertMessage({ type: 'error', text: err.message || 'Network error occurred during dispatch.' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 py-6 px-4 animate-fadeIn">
      
      {/* 1. TOP HERO BANNER & GMAIL DISPATCH ACTION BAR */}
      <div className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-3xl shadow-xl relative overflow-hidden space-y-6">
        
        {/* Banner Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-3 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold uppercase tracking-wider rounded-full flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" /> High-Speed Gmail Dispatch & Designer
              </span>
              {isCredentialsSaved && (
                <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold rounded-lg flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Connected & Saved
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Pass <span className="text-indigo-400">Bomber</span>
            </h1>
            <p className="text-xs text-slate-400 max-w-xl mt-1">
              High-speed bulk pass dispatcher with custom banners, sender desk branding, real-time color styling, and Gmail App Password delivery.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAppPasswordGuide(!showAppPasswordGuide)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Info className="w-4 h-4 text-indigo-400" />
              App Password Guide
            </button>
          </div>
        </div>

        {/* TOP DISPATCH CONTROL BAR */}
        <div className="bg-slate-950 border border-slate-800 p-4 md:p-5 rounded-2xl shadow-xl space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            
            {/* Quick Gmail Status Info (4 cols) */}
            <div className="lg:col-span-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 font-bold">
                <Mail className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  Sender Gmail Account:
                </div>
                <div className="text-xs font-mono font-bold text-white flex items-center gap-2 truncate">
                  <span className="truncate">{senderEmail || 'Not Configured (Enter Below)'}</span>
                  {isCredentialsSaved && (
                    <button
                      type="button"
                      onClick={handleDisconnectCredentials}
                      className="text-[10px] font-mono text-rose-400 hover:underline flex items-center gap-0.5 shrink-0 ml-1 cursor-pointer"
                      title="Disconnect Gmail Credentials"
                    >
                      <LogOut className="w-3 h-3" /> Disconnect
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Sender / Desk Name Editor (4 cols) */}
            <div className="lg:col-span-4 bg-slate-900 border border-slate-800 p-2.5 rounded-xl flex items-center gap-2.5">
              <div className="text-[10px] font-bold uppercase text-indigo-400 tracking-wider whitespace-nowrap flex items-center gap-1">
                <User className="w-3.5 h-3.5" /> Sender Desk:
              </div>
              <input
                type="text"
                value={senderName}
                onChange={e => handleUpdateSenderName(e.target.value)}
                placeholder="e.g. Pass Bomber or Prom Desk"
                className="w-full bg-slate-950 border border-slate-800 px-2.5 py-1 text-xs font-medium text-white rounded-lg focus:border-indigo-500 outline-none"
                title="This name will appear as the Sender Display Name in the recipient's inbox"
              />
            </div>

            {/* TOP DISPATCH BUTTONS (4 cols) */}
            <div className="lg:col-span-4 flex flex-col sm:flex-row items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isSending}
                onClick={() => handleStartDispatch(true)}
                className="w-full sm:w-auto px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5 text-indigo-400" />
                Test to Self
              </button>

              <button
                type="button"
                disabled={isSending || selectedPassIds.size === 0}
                onClick={() => handleStartDispatch(false)}
                className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-600/30 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {dispatchProgressState.totalSteps === 2 && dispatchProgressState.currentStep === 1 
                      ? `Drafting (${dispatchProgressState.draftsCreated}/${dispatchProgressState.draftsTotal})...`
                      : `Sending (${dispatchProgressState.sentCount}/${dispatchProgressState.totalToSend})...`}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Dispatch ({selectedPassIds.size})
                  </>
                )}
              </button>
            </div>
          </div>

          {/* TWO-PHASE / SINGLE-PHASE DISPATCH PROGRESS HUB */}
          {(isSending || dispatchProgressState.isActive) && (
            <DispatchProgressCard 
              progress={dispatchProgressState} 
              title="Pass Ticket Blast Engine"
              onDismiss={handleDismissProgress}
            />
          )}
        </div>

        {/* NOTIFICATION ALERTS */}
        {alertMessage && (
          <div
            className={`p-4 rounded-2xl border flex items-center gap-3 text-xs font-mono font-bold animate-fadeIn ${
              alertMessage.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/80 border-rose-500/40 text-rose-300'
            }`}
          >
            {alertMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <div className="flex-1">{alertMessage.text}</div>
          </div>
        )}

        {/* APP PASSWORD GUIDE ACCORDION */}
        {showAppPasswordGuide && (
          <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl text-xs space-y-3 text-slate-300 animate-fadeIn font-sans">
            <div className="font-bold text-white text-sm flex items-center gap-2">
              <Key className="w-4 h-4 text-indigo-400" />
              How to create a 16-character Gmail App Password in 60 seconds:
            </div>
            <ol className="list-decimal pl-5 space-y-1.5 text-xs text-slate-300 font-mono">
              <li>Open your Google Account Security: <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" className="text-indigo-400 underline font-bold">myaccount.google.com/security</a></li>
              <li>Make sure <strong>2-Step Verification</strong> is switched <strong>ON</strong>.</li>
              <li>Search or click on <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-indigo-400 underline font-bold">App passwords</a>.</li>
              <li>Enter an app name (e.g. <em>"PassCraft Dispatcher"</em>) and click <strong>Create</strong>.</li>
              <li>Copy the generated 16-character code (e.g. <code className="bg-slate-900 px-1.5 py-0.5 text-indigo-400 rounded-md">abcd efgh ijkl mnop</code>) and paste it below.</li>
            </ol>
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* 2. AI EMAIL THEME & DESIGN STUDIO                                         */}
      {/* ========================================================================= */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base font-bold text-white">
                Email Theme & Design Studio
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Customize email colors, header gradients, and styling, or let AI generate a themed ticket palette.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSavingTheme(true)}
              className="px-3.5 py-2 bg-slate-950 hover:bg-slate-800 border border-indigo-500/30 text-indigo-300 hover:text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 shadow cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-400" />
              Add Theme
            </button>

            <button
              type="button"
              onClick={() => setShowColorControls(!showColorControls)}
              className="px-3.5 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Palette className="w-3.5 h-3.5 text-indigo-400" />
              {showColorControls ? 'Hide Custom Colors' : 'Fine-Tune Colors'}
            </button>
          </div>
        </div>

        {/* AI Quick Generator Prompt & Suggestion Chips */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              placeholder="e.g. VIP Music Festival with neon purple & gold glow, luxury gala dinner, tech keynote..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-white text-xs px-4 py-2.5 rounded-xl outline-none shadow-inner"
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleGenerateAiTheme())}
            />
            <button
              type="button"
              onClick={() => handleGenerateAiTheme()}
              disabled={isGeneratingAi || !aiPrompt.trim()}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 shrink-0 shadow-md shadow-indigo-600/30 cursor-pointer"
            >
              {isGeneratingAi ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              AI Design
            </button>
          </div>

          {/* Quick AI Inspiration Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Inspire:</span>
            {[
              { label: '⚡ Cyber Rave', prompt: 'Electric cyberpunk rave with neon cyan, ultraviolet, and dark obsidian' },
              { label: '👑 Royal Gold Gala', prompt: 'Luxury VIP royal gala dinner with deep charcoal and shimmering gold' },
              { label: '🚀 Silicon Tech Summit', prompt: 'Modern minimalist tech keynote summit with sapphire blue and electric teal' },
              { label: '🌅 Sunset Prom', prompt: 'Sunset beach prom party with warm coral, amber gold, and rose gradient' },
              { label: '💎 Electric Indigo', prompt: 'Modern futuristic conference with vivid electric indigo and deep navy' },
            ].map(item => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setAiPrompt(item.prompt);
                  handleGenerateAiTheme(item.prompt);
                }}
                disabled={isGeneratingAi}
                className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/50 text-[10px] text-slate-300 rounded-lg transition-colors cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Inline Save Custom Theme Box */}
          {isSavingTheme && (
            <div className="bg-slate-950 border border-indigo-500/40 p-3 rounded-2xl flex items-center gap-2 animate-fadeIn">
              <Bookmark className="w-4 h-4 text-indigo-400 shrink-0" />
              <input
                type="text"
                value={newThemeName}
                onChange={e => setNewThemeName(e.target.value)}
                placeholder="Enter theme name (e.g. Tech Gala 2026)..."
                className="flex-1 bg-slate-900 border border-slate-800 focus:border-indigo-500 text-white text-xs px-3 py-1.5 rounded-xl outline-none"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleSaveCurrentTheme())}
              />
              <button
                type="button"
                onClick={() => handleSaveCurrentTheme()}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-1 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSavingTheme(false);
                  setNewThemeName('');
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Quick Preset Theme Badges & Custom User Themes */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Themes:</span>
            {allThemes.map(preset => {
              const isActive = activeThemeId === preset.id;
              return (
                <div
                  key={preset.id || preset.name}
                  className="group relative inline-flex items-center"
                >
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border ${
                      isActive
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                        : 'bg-slate-950 hover:bg-slate-800 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <span 
                      className="w-3 h-3 rounded-full shrink-0 border border-white/20" 
                      style={{ background: `linear-gradient(135deg, ${preset.headerGradientStart}, ${preset.headerGradientEnd})` }} 
                    />
                    <span>{preset.name}</span>
                    {preset.isCustom && (
                      <span className="text-[8px] bg-purple-500/30 text-purple-300 border border-purple-500/40 px-1 py-0.2 rounded font-mono uppercase">
                        Custom
                      </span>
                    )}
                  </button>

                  {/* Delete button for custom themes */}
                  {preset.isCustom && preset.id && (
                    <button
                      type="button"
                      onClick={e => handleDeleteCustomTheme(preset.id!, e)}
                      title="Delete custom theme"
                      className="ml-1 p-1 bg-red-950/60 hover:bg-red-900 border border-red-500/30 text-red-400 hover:text-white rounded-lg text-[10px] opacity-70 group-hover:opacity-100 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Quick Button to Add New Custom Theme */}
            {!isSavingTheme && (
              <button
                type="button"
                onClick={() => setIsSavingTheme(true)}
                className="px-3 py-1.5 bg-slate-950 hover:bg-indigo-950/40 border border-dashed border-indigo-500/40 hover:border-indigo-400 text-indigo-400 text-xs font-semibold rounded-xl transition-all flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Theme</span>
              </button>
            )}
          </div>
        </div>

        {/* Expandable Fine-Tune Color Controls */}
        {showColorControls && (
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Custom Color Palette Adjuster
              </span>
              <button
                type="button"
                onClick={() => setIsSavingTheme(true)}
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
              >
                <Bookmark className="w-3.5 h-3.5" />
                Save Palette as Theme
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Header Start</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={headerGradientStart}
                    onChange={e => setHeaderGradientStart(e.target.value)}
                    className="w-8 h-8 rounded-lg bg-transparent cursor-pointer"
                  />
                  <span className="font-mono text-[10px] text-slate-300">{headerGradientStart}</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Header End</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={headerGradientEnd}
                    onChange={e => setHeaderGradientEnd(e.target.value)}
                    className="w-8 h-8 rounded-lg bg-transparent cursor-pointer"
                  />
                  <span className="font-mono text-[10px] text-slate-300">{headerGradientEnd}</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Accent Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={e => setAccentColor(e.target.value)}
                    className="w-8 h-8 rounded-lg bg-transparent cursor-pointer"
                  />
                  <span className="font-mono text-[10px] text-slate-300">{accentColor}</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Card Background</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={cardBackground}
                    onChange={e => setCardBackground(e.target.value)}
                    className="w-8 h-8 rounded-lg bg-transparent cursor-pointer"
                  />
                  <span className="font-mono text-[10px] text-slate-300">{cardBackground}</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Outer Background</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={outerBackground}
                    onChange={e => setOuterBackground(e.target.value)}
                    className="w-8 h-8 rounded-lg bg-transparent cursor-pointer"
                  />
                  <span className="font-mono text-[10px] text-slate-300">{outerBackground}</span>
                </div>
              </div>
            </div>

            {/* Banner Image URL Input */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1 flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5 text-indigo-400" /> Optional Header Banner Image URL (Top of Ticket)
              </label>
              <input
                type="url"
                value={bannerUrl}
                onChange={e => setBannerUrl(e.target.value)}
                placeholder="https://images.unsplash.com/... or banner image URL"
                className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 text-white text-xs px-3 py-2 rounded-xl outline-none font-mono"
              />
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. 50/50 SPLIT: EMAIL EDITOR (LEFT) vs LIVE EMAIL PREVIEW (RIGHT)         */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: EMAIL CONTENT & SPEED CONTROLS (6 COLS) */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-5 shadow-xl">
          
          <div className="border-b border-slate-800 pb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Code2 className="w-5 h-5 text-indigo-400" />
              1. Ticket Content & Speed
            </h2>
            <span className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-lg border border-indigo-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block animate-ping" />
              Live Preview
            </span>
          </div>

          {/* Sender Display Name & Email Subject Line */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1 flex items-center justify-between">
                <span>Sender Display Name</span>
                <span className="text-[10px] text-indigo-400 font-mono">(Customizable)</span>
              </label>
              <input
                type="text"
                value={senderName}
                onChange={e => handleUpdateSenderName(e.target.value)}
                placeholder="e.g. Pass Bomber or Event Desk"
                className="w-full bg-slate-950 border border-slate-800 p-2.5 font-medium text-xs text-white placeholder-slate-600 focus:border-indigo-500 outline-none rounded-xl"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                Email Subject Line
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 p-2.5 font-medium text-xs text-white placeholder-slate-600 focus:border-indigo-500 outline-none rounded-xl"
              />
            </div>
          </div>

          {/* Email Body Content */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-bold uppercase text-slate-400">
                Email Body Text
              </label>
              <div className="text-[10px] text-slate-500 font-mono">
                Supports Smart Tags
              </div>
            </div>
            
            <textarea
              rows={8}
              value={bodyText}
              onChange={e => setBodyText(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 p-3 font-mono text-xs text-white placeholder-slate-600 focus:border-indigo-500 outline-none rounded-xl leading-relaxed"
            />

            {/* Smart Tag Injectors */}
            <div className="pt-2">
              <div className="text-[9px] font-bold uppercase text-slate-500 tracking-wider mb-1.5">
                Click to Insert Dynamic Tag:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: '+ Attendee Name', tag: '{{ATTENDEE_NAME}}' },
                  { label: '+ Event Name', tag: '{{EVENT_NAME}}' },
                  { label: '+ Date', tag: '{{EVENT_DATE}}' },
                  { label: '+ Time', tag: '{{EVENT_TIME}}' },
                  { label: '+ Venue', tag: '{{VENUE}}' },
                  { label: '+ Category', tag: '{{PASS_CATEGORY}}' },
                  { label: '+ 16-Digit Code', tag: '{{CODE_16}}' },
                ].map(item => (
                  <button
                    key={item.tag}
                    type="button"
                    onClick={() => insertPlaceholder(item.tag)}
                    className="px-2 py-1 bg-slate-950 hover:bg-indigo-600 hover:text-white border border-slate-800 text-slate-300 text-[10px] font-mono font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Ticket Display Mode */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5">
              Ticket Pass Format in Email
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'both', label: 'QR Code + 16-Digit' },
                { id: 'qr_only', label: 'QR Code Only' },
                { id: 'code_only', label: '16-Digit Only' },
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDisplayMode(opt.id as any)}
                  className={`py-2 px-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all text-center cursor-pointer ${
                    displayMode === opt.id
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dispatch Speed Options */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 flex items-center justify-between">
              <span>Gmail Dispatch Rate Strategy</span>
              <span className="text-[10px] font-mono text-indigo-400">Safe & Anti-Spam</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'gap_1.5', label: '1.5s Gap', desc: 'Standard' },
                { id: 'gap_3', label: '3.0s Gap', desc: 'Relaxed' },
                { id: 'gap_5', label: '5.0s Gap', desc: 'Cautious' },
                { id: 'draft_all_send', label: 'Draft All & Send at Once', desc: 'Draft all first, send together' },
              ].map(speed => (
                <button
                  key={speed.id}
                  type="button"
                  onClick={() => setDispatchSpeed(speed.id as any)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    dispatchSpeed === speed.id || (speed.id === 'draft_all_send' && dispatchSpeed === 'batch_parallel')
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="text-[11px] font-bold text-white">{speed.label}</div>
                  <div className="text-[9px] font-mono opacity-60">{speed.desc}</div>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: LIVE 50/50 EMAIL TICKET PREVIEW (6 COLS) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-indigo-400" />
              <h2 className="text-sm font-bold text-white">
                Live Email Client Preview
              </h2>
            </div>
            
            {/* Sample Attendee Switcher */}
            {filteredRecipients.length > 1 && (
              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1 rounded-xl text-xs">
                <span className="text-[10px] text-slate-400 font-mono">Sample:</span>
                <select
                  value={previewIndex}
                  onChange={e => setPreviewIndex(Number(e.target.value))}
                  className="bg-transparent text-white font-bold text-xs outline-none cursor-pointer"
                >
                  {filteredRecipients.map((rec, idx) => (
                    <option key={rec.id} value={idx} className="bg-slate-900">
                      {rec.assignedTo?.name || `Pass #${idx + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Email Preview Outer Frame */}
          <div 
            className="rounded-3xl p-4 md:p-6 shadow-2xl border border-slate-800 transition-all"
            style={{ backgroundColor: outerBackground }}
          >
            
            {/* Email Header Bar */}
            <div className="bg-black/40 px-4 py-2.5 rounded-t-2xl border-b border-white/10 text-[11px] font-mono text-slate-400 space-y-1">
              <div><strong className="text-slate-300">From:</strong> {senderName} &lt;{senderEmail || 'organizer@gmail.com'}&gt;</div>
              <div><strong className="text-slate-300">To:</strong> {samplePass.assignedTo?.name} &lt;{samplePass.assignedTo?.email || 'attendee@example.com'}&gt;</div>
              <div className="truncate"><strong className="text-slate-300">Subject:</strong> {subject.replace(/\{\{EVENT_NAME\}\}/g, samplePass.eventName || 'Event').replace(/\{\{ATTENDEE_NAME\}\}/g, samplePass.assignedTo?.name || 'Guest')}</div>
            </div>

            {/* Email Ticket Card */}
            <div 
              className="rounded-b-2xl overflow-hidden shadow-2xl transition-all"
              style={{ backgroundColor: cardBackground }}
            >
              
              {/* Optional Banner Image */}
              {bannerUrl && (
                <div className="w-full h-32 overflow-hidden bg-slate-950">
                  <img src={bannerUrl} alt="Event Banner" className="w-full h-full object-cover" />
                </div>
              )}

              {/* Ticket Top Gradient Header */}
              <div 
                className="p-5 text-center"
                style={{ background: `linear-gradient(135deg, ${headerGradientStart}, ${headerGradientEnd})` }}
              >
                <div style={{ color: headerTextColor }} className="text-[10px] font-bold uppercase tracking-wider opacity-90">
                  Official Access Pass
                </div>
                <div style={{ color: headerTextColor }} className="text-xl md:text-2xl font-black uppercase tracking-tight mt-0.5">
                  {samplePass.eventName || 'GLOBAL TECH SUMMIT'}
                </div>
              </div>

              {/* Ticket Body */}
              <div className="p-5 space-y-4">
                {/* Attendee Name Box */}
                <div className="bg-black/20 p-3.5 rounded-xl border border-white/10">
                  <div style={{ color: accentColor }} className="text-[10px] font-bold uppercase tracking-wider">
                    Pass Holder Delegate
                  </div>
                  <div style={{ color: textColor }} className="text-lg font-bold uppercase mt-0.5">
                    {samplePass.assignedTo?.name || 'Rahul Sharma'}
                  </div>
                  <div style={{ color: highlightColor }} className="text-xs font-semibold mt-0.5">
                    TIER: {samplePass.category || 'VIP DELEGATE'}
                  </div>
                </div>

                {/* Metadata 2-Column Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                    <div style={{ color: subtextColor }} className="text-[9px] font-bold uppercase">📅 DATE & TIME</div>
                    <div style={{ color: textColor }} className="font-bold mt-0.5">{samplePass.eventDate || '2026-09-15'}</div>
                    <div style={{ color: subtextColor }} className="text-[10px]">{samplePass.eventTime || samplePass.commencementTime || '10:00 AM'}</div>
                  </div>

                  <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                    <div style={{ color: subtextColor }} className="text-[9px] font-bold uppercase">📍 VENUE LOCATION</div>
                    <div style={{ color: textColor }} className="font-bold mt-0.5 truncate">{samplePass.eventLocation || 'Grand Convention Center'}</div>
                  </div>
                </div>

                {/* Custom Body Text */}
                <div 
                  className="p-3.5 rounded-xl text-xs leading-relaxed font-sans whitespace-pre-wrap border border-white/5"
                  style={{ backgroundColor: codeBoxBackground, color: textColor }}
                >
                  {formattedPreviewBody}
                </div>

                {/* QR Code */}
                {(displayMode === 'both' || displayMode === 'qr_only') && (
                  <div className="text-center py-2">
                    <div className="inline-block bg-white p-3 rounded-2xl shadow-2xl border-2" style={{ borderColor: accentColor }}>
                      <img src={sampleQrUrl} alt="QR" className="w-32 h-32 object-contain" />
                    </div>
                  </div>
                )}

                {/* 16-Digit Code */}
                {(displayMode === 'both' || displayMode === 'code_only') && (
                  <div 
                    className="p-3 rounded-xl text-center border-2 border-dashed"
                    style={{ backgroundColor: codeBoxBackground, borderColor: accentColor }}
                  >
                    <div style={{ color: subtextColor }} className="text-[9px] font-bold uppercase tracking-wider mb-0.5">
                      16-Digit Verification Code
                    </div>
                    <div style={{ color: accentColor }} className="font-mono text-base font-bold tracking-widest">
                      {samplePass.formattedCode || samplePass.code16}
                    </div>
                  </div>
                )}

              </div>

              {/* Ticket Footer */}
              <div 
                className="p-3 text-center text-[10px] font-mono border-t border-white/10"
                style={{ backgroundColor: 'rgba(0,0,0,0.3)', color: subtextColor }}
              >
                {senderName || 'Pass Bomber'} Verified Event Pass • Present at Entry Gate
              </div>

            </div>

          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* 4. RECIPIENTS SELECTION TABLE (ACTIVE EVENTS ONLY)                        */}
      {/* ========================================================================= */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" />
              2. Target Recipients ({selectedPassIds.size} / {filteredRecipients.length} Selected)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Select delegates to receive their official QR pass tickets via Gmail.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter by Active Event */}
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl text-xs">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <select
                value={selectedEventId}
                onChange={e => setSelectedEventId(e.target.value)}
                className="bg-transparent text-white font-semibold text-xs outline-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900">All Active Events</option>
                {activeEvents.map(ev => (
                  <option key={ev.id} value={ev.id} className="bg-slate-900">
                    {ev.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search name, email..."
                className="bg-slate-950 border border-slate-800 text-white text-xs pl-8 pr-3 py-1.5 rounded-xl outline-none focus:border-indigo-500 w-44 font-medium"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="border border-slate-800 rounded-2xl overflow-x-auto max-h-72">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 text-[10px] font-bold uppercase sticky top-0 border-b border-slate-800">
              <tr>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAllFiltered}
                    className="w-4 h-4 accent-indigo-500 cursor-pointer"
                  />
                </th>
                <th className="p-3">Attendee Name</th>
                <th className="p-3">Recipient Email</th>
                <th className="p-3">Event</th>
                <th className="p-3">Category</th>
                <th className="p-3">16-Digit Code</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredRecipients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-500 font-sans">
                    No assigned passes with valid email addresses found for this event filter.
                  </td>
                </tr>
              ) : (
                filteredRecipients.map(p => {
                  const isChecked = selectedPassIds.has(p.id);
                  return (
                    <tr
                      key={p.id}
                      onClick={() => togglePassSelection(p.id)}
                      className={`cursor-pointer transition-colors ${
                        isChecked ? 'bg-indigo-950/40 hover:bg-indigo-950/60' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePassSelection(p.id)}
                          className="w-4 h-4 accent-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="p-3 font-bold text-white font-sans">{p.assignedTo?.name}</td>
                      <td className="p-3 text-indigo-400 font-sans">{p.assignedTo?.email}</td>
                      <td className="p-3 text-slate-300 truncate max-w-[150px] font-sans">{p.eventName}</td>
                      <td className="p-3 text-slate-300 font-sans">{p.category}</td>
                      <td className="p-3 text-slate-400 font-mono">{p.formattedCode}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. GMAIL APP PASSWORD CREDENTIALS FORM                                    */}
      {/* ========================================================================= */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            3. Gmail App Password Configuration
          </h2>
          {isCredentialsSaved && (
            <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 rounded-lg">
              Credentials Saved & Ready
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Your Gmail Address *</label>
            <input
              type="email"
              value={senderEmail}
              onChange={e => {
                setSenderEmail(e.target.value);
                setIsCredentialsSaved(false);
              }}
              placeholder="e.g. yourname@gmail.com"
              className="w-full bg-slate-950 border border-slate-800 p-2.5 font-medium text-xs text-white rounded-xl focus:border-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1 flex items-center justify-between">
              <span>Sender Display Name</span>
              <span className="text-[10px] text-indigo-400 font-mono">Customizable</span>
            </label>
            <input
              type="text"
              value={senderName}
              onChange={e => {
                handleUpdateSenderName(e.target.value);
                setIsCredentialsSaved(false);
              }}
              placeholder="e.g. Pass Bomber or Prom Committee"
              className="w-full bg-slate-950 border border-slate-800 p-2.5 font-medium text-xs text-white rounded-xl focus:border-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1 flex items-center justify-between">
              <span>16-Char Gmail App Password *</span>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[10px] text-indigo-400 hover:underline cursor-pointer"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={appPassword}
              onChange={e => {
                setAppPassword(e.target.value);
                setIsCredentialsSaved(false);
              }}
              placeholder="abcd efgh ijkl mnop"
              className="w-full bg-slate-950 border border-slate-800 p-2.5 font-mono font-bold text-xs text-indigo-300 rounded-xl focus:border-indigo-500 outline-none tracking-wider"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          {isCredentialsSaved ? (
            <button
              type="button"
              onClick={handleDisconnectCredentials}
              className="px-4 py-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-600 hover:text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-4 h-4" /> Disconnect Saved Password
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSaveCredentials}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-600/30 flex items-center gap-1.5 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" /> Save Gmail Credentials
            </button>
          )}
        </div>
      </div>

      {/* DISPATCH LOGS MODAL / LIST */}
      {dispatchLogs.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-3 shadow-xl">
          <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            Dispatch Results Log ({dispatchLogs.filter(l => l.status === 'sent').length} / {dispatchLogs.length} Successful)
          </h3>
          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-2 font-mono text-xs">
            {dispatchLogs.map((log, idx) => (
              <div
                key={idx}
                className={`p-2 rounded-xl flex items-center justify-between border ${
                  log.status === 'sent'
                    ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                }`}
              >
                <span>{log.attendeeName} &lt;{log.email}&gt;</span>
                <span className="font-bold uppercase text-[10px]">{log.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
