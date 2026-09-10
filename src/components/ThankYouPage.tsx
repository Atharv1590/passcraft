import React, { useState, useEffect, useMemo } from 'react';
import { 
  HeartHandshake, 
  Sparkles, 
  Send, 
  Mail, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Search, 
  Image as ImageIcon, 
  Award, 
  Video, 
  Calendar, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Eye, 
  Smartphone, 
  Monitor, 
  Users, 
  FileText, 
  SlidersHorizontal,
  Wand2,
  Check,
  CheckSquare,
  Square,
  MessageSquare,
  Flame,
  ArrowRight,
  Pencil,
  Edit3,
  HelpCircle
} from 'lucide-react';
import { EventItem, PassItem } from '../types';
import { recordDispatchHistory } from '../utils/historyStorage';
import { safeFetchJson } from '../lib/apiHelper';
import DispatchProgressCard, { DispatchProgressState } from './DispatchProgressCard';

interface ThankYouPageProps {
  passes: PassItem[];
  events: EventItem[];
  currentUserEmail: string | null;
  onSwitchToRules?: () => void;
}

interface SmtpCreds {
  senderEmail: string;
  appPassword: string;
  senderName?: string;
}

export interface ThankYouTheme {
  name: string;
  cardBackground: string;
  outerBackground: string;
  headerGradientStart: string;
  headerGradientEnd: string;
  headerTextColor: string;
  accentColor: string;
  highlightColor: string;
  textColor: string;
  subtextColor: string;
}

const THEME_PRESETS: ThankYouTheme[] = [
  {
    name: "Rose Warmth",
    cardBackground: "#111827",
    outerBackground: "#030712",
    headerGradientStart: "#e11d48",
    headerGradientEnd: "#f43f5e",
    headerTextColor: "#ffffff",
    accentColor: "#fb7185",
    highlightColor: "#fda4af",
    textColor: "#f9fafb",
    subtextColor: "#9ca3af"
  },
  {
    name: "Royal Indigo",
    cardBackground: "#0f172a",
    outerBackground: "#020617",
    headerGradientStart: "#4f46e5",
    headerGradientEnd: "#7c3aed",
    headerTextColor: "#ffffff",
    accentColor: "#818cf8",
    highlightColor: "#a5b4fc",
    textColor: "#f8fafc",
    subtextColor: "#94a3b8"
  },
  {
    name: "Emerald Prestige",
    cardBackground: "#062419",
    outerBackground: "#02120b",
    headerGradientStart: "#059669",
    headerGradientEnd: "#10b981",
    headerTextColor: "#ffffff",
    accentColor: "#10b981",
    highlightColor: "#34d399",
    textColor: "#ecfdf5",
    subtextColor: "#a7f3d0"
  },
  {
    name: "Midnight Gold",
    cardBackground: "#18181b",
    outerBackground: "#09090b",
    headerGradientStart: "#d97706",
    headerGradientEnd: "#f59e0b",
    headerTextColor: "#000000",
    accentColor: "#fbbf24",
    highlightColor: "#fde68a",
    textColor: "#fafaf9",
    subtextColor: "#a1a1aa"
  },
  {
    name: "Sunset Glow",
    cardBackground: "#1a0f18",
    outerBackground: "#0d050c",
    headerGradientStart: "#c026d3",
    headerGradientEnd: "#f97316",
    headerTextColor: "#ffffff",
    accentColor: "#f43f5e",
    highlightColor: "#fb923c",
    textColor: "#fdf4ff",
    subtextColor: "#d8b4fe"
  }
];

const STORAGE_GMAIL_CREDENTIALS_KEY = 'passcraft_gmail_credentials_v1';
const STORAGE_THANK_YOU_STATE_KEY = 'passcraft_thank_you_state_v3';
const STORAGE_CUSTOM_THANKYOU_THEMES_KEY = 'passcraft_custom_thank_you_themes_v1';

interface ThankYouSavedState {
  selectedEventId?: string;
  subject?: string;
  headline?: string;
  topBadgeHeading?: string;
  thankYouMessage?: string;
  highlightsHeading?: string;
  eventHighlights?: string[];
  resourcesHeading?: string;
  galleryLink?: string;
  galleryTitle?: string;
  surveyHeading?: string;
  surveyLink?: string;
  surveyTitle?: string;
  certificateLink?: string;
  certificateTitle?: string;
  recordingLink?: string;
  recordingTitle?: string;
  futureEventSectionHeading?: string;
  futureEventTitle?: string;
  futureEventDetails?: string;
  futureEventLink?: string;
  closingNote?: string;
  selectedThemeName?: string;
  aiPrompt?: string;
  aiTone?: string;
  dispatchSpeed?: 'gap_1.5' | 'gap_3' | 'gap_5' | 'draft_all_send';
}

const loadSavedThankYouState = (): ThankYouSavedState | null => {
  try {
    const saved = localStorage.getItem(STORAGE_THANK_YOU_STATE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return null;
};

const loadSavedCustomThemes = (): ThankYouTheme[] => {
  try {
    const saved = localStorage.getItem(STORAGE_CUSTOM_THANKYOU_THEMES_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return [];
};

export const ThankYouPage: React.FC<ThankYouPageProps> = ({
  passes,
  events,
  currentUserEmail,
  onSwitchToRules
}) => {
  const savedState = useMemo(() => loadSavedThankYouState(), []);

  // Modal for confirming editing a heading or section
  const [editConfirmModal, setEditConfirmModal] = useState<{
    isOpen: boolean;
    sectionKey: string;
    sectionName: string;
    targetElementId: string;
  } | null>(null);

  // 1. Shared Gmail Credentials
  const [gmailCreds, setGmailCreds] = useState<SmtpCreds | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_GMAIL_CREDENTIALS_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });

  const [showCredsEditor, setShowCredsEditor] = useState(false);
  const [inputEmail, setInputEmail] = useState(gmailCreds?.senderEmail || currentUserEmail || '');
  const [inputPassword, setInputPassword] = useState(gmailCreds?.appPassword || '');
  const [inputSenderName, setInputSenderName] = useState(gmailCreds?.senderName || 'PassCraft Event Desk');

  const handleSaveGmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputEmail.trim() || !inputPassword.trim()) return;
    const cleanPassword = inputPassword.replace(/\s+/g, '');
    const newCreds: SmtpCreds = {
      senderEmail: inputEmail.trim(),
      appPassword: cleanPassword,
      senderName: inputSenderName.trim() || 'PassCraft Event Desk'
    };
    setGmailCreds(newCreds);
    try {
      localStorage.setItem(STORAGE_GMAIL_CREDENTIALS_KEY, JSON.stringify(newCreds));
    } catch (err) {}
    setShowCredsEditor(false);
    setAlertMessage({ type: 'success', text: 'Gmail credentials saved and synced across all broadcaster tools!' });
    setTimeout(() => setAlertMessage(null), 4000);
  };

  // 2. Event Selection
  const [selectedEventId, setSelectedEventId] = useState<string>(() => {
    if (savedState?.selectedEventId) return savedState.selectedEventId;
    return events[0]?.id || 'all';
  });

  useEffect(() => {
    if (selectedEventId !== 'all' && !events.some(e => e.id === selectedEventId)) {
      setSelectedEventId(events[0]?.id || 'all');
    }
  }, [events, selectedEventId]);

  const currentEvent = useMemo(() => {
    if (selectedEventId === 'all') return events[0];
    return events.find(e => e.id === selectedEventId) || events[0];
  }, [selectedEventId, events]);

  // 3. Recipient Pool Calculation
  const eventPasses = useMemo(() => {
    return passes.filter(p => {
      if (p.status !== 'assigned' && p.status !== 'checked_in') return false;
      const email = p.assignedTo?.email;
      if (!email || !email.includes('@')) return false;
      if (selectedEventId === 'all') return true;
      return (
        p.eventId === selectedEventId || 
        (p.eventName && currentEvent && p.eventName.toLowerCase().trim() === currentEvent.title.toLowerCase().trim())
      );
    });
  }, [passes, selectedEventId, currentEvent]);

  // 4. Recipient Filter & Search
  const [statusFilter, setStatusFilter] = useState<'all' | 'checked_in' | 'not_checked_in'>('all');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [selectedPassIds, setSelectedPassIds] = useState<string[]>([]);

  const filteredRecipients = useMemo(() => {
    return eventPasses.filter(p => {
      if (statusFilter === 'checked_in' && p.status !== 'checked_in') return false;
      if (statusFilter === 'not_checked_in' && p.status === 'checked_in') return false;
      if (recipientSearch.trim()) {
        const q = recipientSearch.toLowerCase();
        const matchesName = (p.assignedTo?.name || '').toLowerCase().includes(q);
        const matchesEmail = (p.assignedTo?.email || '').toLowerCase().includes(q);
        const matchesTier = (p.category || '').toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesTier) return false;
      }
      return true;
    });
  }, [eventPasses, statusFilter, recipientSearch]);

  // Select all matching attendees on filter or event change
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

  // 5. Message Content & Section Headings State
  const [subject, setSubject] = useState(() => savedState?.subject ?? "❤️ Thank You for Attending {{EVENT_NAME}}! | Highlights & Feedback");
  const [topBadgeHeading, setTopBadgeHeading] = useState(() => savedState?.topBadgeHeading ?? "🌟 POST-EVENT RECAP & APPRECIATION");
  const [headline, setHeadline] = useState(() => savedState?.headline ?? "THANK YOU FOR AN UNFORGETTABLE EXPERIENCE!");
  const [thankYouMessage, setThankYouMessage] = useState(() => savedState?.thankYouMessage ?? 
    `Dear {{ATTENDEE_NAME}},\n\nOn behalf of our entire team, thank you for attending {{EVENT_NAME}} at {{VENUE}}.\n\nYour presence and energy made this gathering truly extraordinary. We hope you walked away with inspiring ideas, meaningful connections, and unforgettable memories.\n\nThank you for being part of our vibrant community!`
  );

  // Highlights Section
  const [highlightsHeading, setHighlightsHeading] = useState(() => savedState?.highlightsHeading ?? "🏆 EVENT HIGHLIGHTS & KEY MILESTONES");
  const [eventHighlights, setEventHighlights] = useState<string[]>(() => savedState?.eventHighlights ?? [
    "Over 750+ delegates and innovators gathered under one roof",
    "Inspiring keynote sessions and collaborative workshops",
    "Groundbreaking connections and memorable conversations"
  ]);
  const [newHighlight, setNewHighlight] = useState("");

  // Optional Resource Links
  const [resourcesHeading, setResourcesHeading] = useState(() => savedState?.resourcesHeading ?? "📦 EVENT RESOURCES & MEDIA");
  const [galleryLink, setGalleryLink] = useState(() => savedState?.galleryLink ?? "https://photos.google.com");
  const [galleryTitle, setGalleryTitle] = useState(() => savedState?.galleryTitle ?? "Official Event Photo Gallery");

  // Survey Section
  const [surveyHeading, setSurveyHeading] = useState(() => savedState?.surveyHeading ?? "💬 Help Us Improve!");
  const [surveyLink, setSurveyLink] = useState(() => savedState?.surveyLink ?? "https://forms.google.com");
  const [surveyTitle, setSurveyTitle] = useState(() => savedState?.surveyTitle ?? "2-Minute Attendee Feedback Survey");

  // Certificates & Recordings
  const [certificateLink, setCertificateLink] = useState(() => savedState?.certificateLink ?? "");
  const [certificateTitle, setCertificateTitle] = useState(() => savedState?.certificateTitle ?? "Download Certificate of Attendance");

  const [recordingLink, setRecordingLink] = useState(() => savedState?.recordingLink ?? "");
  const [recordingTitle, setRecordingTitle] = useState(() => savedState?.recordingTitle ?? "Watch Keynote Recordings & Slides");

  // Future Event Section ("What's Next")
  const [futureEventSectionHeading, setFutureEventSectionHeading] = useState(() => savedState?.futureEventSectionHeading ?? "🚀 WHAT'S NEXT");
  const [futureEventTitle, setFutureEventTitle] = useState(() => savedState?.futureEventTitle ?? "Next Edition: Early Access");
  const [futureEventDetails, setFutureEventDetails] = useState(() => savedState?.futureEventDetails ?? "Stay tuned for early registration discounts for our upcoming gathering.");
  const [futureEventLink, setFutureEventLink] = useState(() => savedState?.futureEventLink ?? "");

  const [closingNote, setClosingNote] = useState(() => savedState?.closingNote ?? `With warmest gratitude,\n${gmailCreds?.senderName || 'PassCraft Operations Team'}`);

  // Trigger confirmation dialog for heading/section edit
  const promptEditSection = (sectionKey: string, sectionName: string, targetElementId: string) => {
    setEditConfirmModal({
      isOpen: true,
      sectionKey,
      sectionName,
      targetElementId
    });
  };

  const handleConfirmEdit = () => {
    if (!editConfirmModal) return;
    const targetId = editConfirmModal.targetElementId;
    setEditConfirmModal(null);
    setTimeout(() => {
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
        el.classList.add('ring-2', 'ring-rose-500');
        setTimeout(() => el.classList.remove('ring-2', 'ring-rose-500'), 2000);
      }
    }, 100);
  };

  // Theme Presets & Custom Themes
  const [customThemes, setCustomThemes] = useState<ThankYouTheme[]>(() => loadSavedCustomThemes());
  const [showAddThemeModal, setShowAddThemeModal] = useState(false);
  const [newTheme, setNewTheme] = useState<ThankYouTheme>({
    name: 'Custom Coral',
    cardBackground: '#13111c',
    outerBackground: '#07050a',
    headerGradientStart: '#e11d48',
    headerGradientEnd: '#f97316',
    headerTextColor: '#ffffff',
    accentColor: '#fb7185',
    highlightColor: '#fb923c',
    textColor: '#fdf4ff',
    subtextColor: '#d8b4fe'
  });

  const allThemes = useMemo(() => [...THEME_PRESETS, ...customThemes], [customThemes]);

  const [selectedTheme, setSelectedTheme] = useState<ThankYouTheme>(() => {
    if (savedState?.selectedThemeName) {
      const all = [...THEME_PRESETS, ...loadSavedCustomThemes()];
      const match = all.find(t => t.name === savedState.selectedThemeName);
      if (match) return match;
    }
    return THEME_PRESETS[0];
  });

  const handleSaveCustomTheme = () => {
    if (!newTheme.name.trim()) return;
    const cleanTheme = { ...newTheme, name: newTheme.name.trim() };
    const updated = [...customThemes.filter(t => t.name !== cleanTheme.name), cleanTheme];
    setCustomThemes(updated);
    try {
      localStorage.setItem(STORAGE_CUSTOM_THANKYOU_THEMES_KEY, JSON.stringify(updated));
    } catch (e) {}
    setSelectedTheme(cleanTheme);
    setShowAddThemeModal(false);
  };

  const handleDeleteCustomTheme = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customThemes.filter(t => t.name !== name);
    setCustomThemes(updated);
    try {
      localStorage.setItem(STORAGE_CUSTOM_THANKYOU_THEMES_KEY, JSON.stringify(updated));
    } catch (e) {}
    if (selectedTheme.name === name) {
      setSelectedTheme(THEME_PRESETS[0]);
    }
  };

  // AI Generator State
  const [aiPrompt, setAiPrompt] = useState(() => savedState?.aiPrompt ?? "");
  const [aiTone, setAiTone] = useState(() => savedState?.aiTone ?? "heartfelt & inspiring");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

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

  // Preview Mode
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [testEmailAddress, setTestEmailAddress] = useState(gmailCreds?.senderEmail || '');
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Auto-persist state to localStorage
  useEffect(() => {
    const stateToSave: ThankYouSavedState = {
      selectedEventId,
      subject,
      headline,
      topBadgeHeading,
      thankYouMessage,
      highlightsHeading,
      eventHighlights,
      resourcesHeading,
      galleryLink,
      galleryTitle,
      surveyHeading,
      surveyLink,
      surveyTitle,
      certificateLink,
      certificateTitle,
      recordingLink,
      recordingTitle,
      futureEventSectionHeading,
      futureEventTitle,
      futureEventDetails,
      futureEventLink,
      closingNote,
      selectedThemeName: selectedTheme.name,
      aiPrompt,
      aiTone,
      dispatchSpeed,
    };
    try {
      localStorage.setItem(STORAGE_THANK_YOU_STATE_KEY, JSON.stringify(stateToSave));
    } catch (e) {}
  }, [
    selectedEventId,
    subject,
    headline,
    topBadgeHeading,
    thankYouMessage,
    highlightsHeading,
    eventHighlights,
    resourcesHeading,
    galleryLink,
    galleryTitle,
    surveyHeading,
    surveyLink,
    surveyTitle,
    certificateLink,
    certificateTitle,
    recordingLink,
    recordingTitle,
    futureEventSectionHeading,
    futureEventTitle,
    futureEventDetails,
    futureEventLink,
    closingNote,
    selectedTheme,
    aiPrompt,
    aiTone,
    dispatchSpeed,
  ]);

  // Reset to Defaults
  const handleResetToDefaults = () => {
    if (!window.confirm('Reset post-event thank you message and settings back to defaults?')) return;
    setSubject("❤️ Thank You for Attending {{EVENT_NAME}}! | Highlights & Feedback");
    setHeadline("THANK YOU FOR AN UNFORGETTABLE EXPERIENCE!");
    setThankYouMessage(`Dear {{ATTENDEE_NAME}},\n\nOn behalf of our entire team, thank you for attending {{EVENT_NAME}} at {{VENUE}}.\n\nYour presence and energy made this gathering truly extraordinary. We hope you walked away with inspiring ideas, meaningful connections, and unforgettable memories.\n\nThank you for being part of our vibrant community!`);
    setEventHighlights([
      "Over 750+ delegates and innovators gathered under one roof",
      "Inspiring keynote sessions and collaborative workshops",
      "Groundbreaking connections and memorable conversations"
    ]);
    setGalleryLink("https://photos.google.com");
    setGalleryTitle("Official Event Photo Gallery");
    setSurveyLink("https://forms.google.com");
    setSurveyTitle("2-Minute Attendee Feedback Survey");
    setCertificateLink("");
    setCertificateTitle("Download Certificate of Attendance");
    setRecordingLink("");
    setRecordingTitle("Watch Keynote Recordings & Slides");
    setFutureEventTitle("Next Edition: Early Access");
    setFutureEventDetails("Stay tuned for early registration discounts for our upcoming gathering.");
    setFutureEventLink("");
    setClosingNote(`With warmest gratitude,\n${gmailCreds?.senderName || 'PassCraft Operations Team'}`);
    setSelectedTheme(THEME_PRESETS[0]);
    setAlertMessage({ type: 'success', text: 'Reset thank you message back to defaults.' });
    setTimeout(() => setAlertMessage(null), 3000);
  };

  // 1-Click Preset Templates
  const applyPreset = (type: 'conference' | 'gala' | 'festival' | 'hackathon' | 'cultural') => {
    if (type === 'conference') {
      setSelectedTheme(THEME_PRESETS[1]);
      setSubject("❤️ Thank You for Attending {{EVENT_NAME}}! | Recap & Slides");
      setHeadline("THANK YOU FOR AN EXTRAORDINARY SUMMIT!");
      setThankYouMessage(
        `Dear {{ATTENDEE_NAME}},\n\nOn behalf of our entire organizing committee, thank you for joining us at {{EVENT_NAME}} at {{VENUE}}.\n\nFrom thought-provoking keynotes to high-impact networking, your active participation made this summit a landmark event for our industry.`
      );
      setEventHighlights([
        "Over 850+ delegates and industry leaders united",
        "18 groundbreaking presentations and interactive panels",
        "Hundreds of meaningful connections sparked"
      ]);
      setGalleryLink("https://photos.google.com");
      setSurveyLink("https://forms.google.com");
      setRecordingLink("https://youtube.com");
      setCertificateLink("");
    } else if (type === 'gala') {
      setSelectedTheme(THEME_PRESETS[3]);
      setSubject("✨ Heartfelt Gratitude: An Unforgettable Evening at {{EVENT_NAME}}");
      setHeadline("AN EVENING OF EXCELLENCE & GRATITUDE");
      setThankYouMessage(
        `Dear {{ATTENDEE_NAME}},\n\nThank you for gracing us with your distinguished presence at {{EVENT_NAME}}.\n\nYour presence, warmth, and generous support turned the evening into an unforgettable celebration of community leadership.`
      );
      setEventHighlights([
        "Record community turnout and distinguished honoree awards",
        "Seated banquet dinner with live musical performances",
        "Over 400 guests celebrating leadership together"
      ]);
      setGalleryLink("https://photos.google.com");
      setSurveyLink("");
      setCertificateLink("");
      setRecordingLink("");
    } else if (type === 'festival') {
      setSelectedTheme(THEME_PRESETS[4]);
      setSubject("🔥 YOU MADE IT EPIC! Thank You for Rocking {{EVENT_NAME}}!");
      setHeadline("WHAT AN INCREDIBLE EXPERIENCE! THANK YOU!");
      setThankYouMessage(
        `Hey {{ATTENDEE_NAME}},\n\nWhat an unforgettable show! Thank you for bringing your immense energy, spirit, and excitement to {{EVENT_NAME}}.\n\nYou brought the stage and festival grounds to life from start to finish!`
      );
      setEventHighlights([
        "Thousands of passionate music lovers dancing together",
        "Electrifying artist performances and light showcases",
        "Unbeatable positive vibes and unforgettable memories"
      ]);
      setGalleryLink("https://photos.google.com");
      setSurveyLink("https://forms.google.com");
      setCertificateLink("");
    } else if (type === 'hackathon') {
      setSelectedTheme(THEME_PRESETS[2]);
      setSubject("💻 Hackathon Wrap-Up & Thank You: {{EVENT_NAME}}!");
      setHeadline("48 HOURS OF PURE INNOVATION — THANK YOU BUILDERS!");
      setThankYouMessage(
        `Dear {{ATTENDEE_NAME}},\n\nCongratulations on completing {{EVENT_NAME}}!\n\nWe were blown away by the creative prototypes, technical rigor, and intense collaboration demonstrated across every demo.`
      );
      setEventHighlights([
        "60+ working prototypes shipped and demoed live",
        "$40,000+ in bounties and grand prizes awarded",
        "Over 300+ developers and designers building together"
      ]);
      setGalleryLink("https://photos.google.com");
      setSurveyLink("https://forms.google.com");
      setRecordingLink("https://youtube.com");
      setCertificateLink("https://example.com/certificate");
    } else if (type === 'cultural') {
      setSelectedTheme(THEME_PRESETS[0]);
      setSubject("🌸 Cherished Memories: Thank You for Celebrating {{EVENT_NAME}}!");
      setHeadline("CELEBRATING CULTURE & COMMUNITY TOGETHER");
      setThankYouMessage(
        `Dear {{ATTENDEE_NAME}},\n\nThank you for celebrating {{EVENT_NAME}} with us at {{VENUE}}.\n\nYour festive presence, traditional attire, and joyous enthusiasm made this celebration a cherished milestone for our entire family and community.`
      );
      setEventHighlights([
        "Vibrant cultural showcases, folk music, and dances",
        "Grand community gathering with unforgettable meals",
        "Lifelong memories created with friends and families"
      ]);
      setGalleryLink("https://photos.google.com");
      setSurveyLink("https://forms.google.com");
    }
  };

  // AI Thank You Generator
  const handleGenerateAi = async (customPrompt?: string) => {
    const promptToUse = (customPrompt || aiPrompt || currentEvent?.title || 'Special Event').trim();
    setIsGeneratingAi(true);
    setAlertMessage(null);

    try {
      const response = await safeFetchJson<{ success: boolean; data?: any; error?: string }>('/api/gemini/generate-thank-you', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: currentEvent?.category || 'Event',
          eventName: currentEvent?.title || promptToUse,
          highlights: promptToUse,
          organizerName: gmailCreds?.senderName || 'PassCraft Operations Team',
          tone: aiTone
        })
      });

      if (response.ok && response.data?.success && response.data.data) {
        const d = response.data.data;
        if (d.subject) setSubject(d.subject);
        if (d.headline) setHeadline(d.headline);
        if (d.thankYouMessage) setThankYouMessage(d.thankYouMessage);
        if (Array.isArray(d.eventHighlights) && d.eventHighlights.length > 0) {
          setEventHighlights(d.eventHighlights);
        }
        if (d.galleryTitle) setGalleryTitle(d.galleryTitle);
        if (d.surveyTitle) setSurveyTitle(d.surveyTitle);
        if (d.certificateTitle) setCertificateTitle(d.certificateTitle);
        if (d.recordingTitle) setRecordingTitle(d.recordingTitle);
        if (d.futureEventTitle) setFutureEventTitle(d.futureEventTitle);
        if (d.futureEventDetails) setFutureEventDetails(d.futureEventDetails);
        if (d.closingNote) setClosingNote(d.closingNote);

        setAlertMessage({
          type: 'success',
          text: `✨ Generated personalized thank you & recap copy for "${promptToUse}"!`
        });
        setTimeout(() => setAlertMessage(null), 5000);
      } else {
        throw new Error(response.data?.error || response.error || 'Failed to generate AI copy.');
      }
    } catch (err: any) {
      setAlertMessage({
        type: 'error',
        text: `Error generating AI thank you: ${err.message}`
      });
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Add / Remove Highlight
  const handleAddHighlight = () => {
    if (newHighlight.trim()) {
      setEventHighlights(prev => [...prev, newHighlight.trim()]);
      setNewHighlight("");
    }
  };

  const handleRemoveHighlight = (idx: number) => {
    setEventHighlights(prev => prev.filter((_, i) => i !== idx));
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Dispatch Engine (Test Email vs Mass Blast to All)
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
          eventDate: currentEvent?.date || 'Recent Event',
          eventTime: currentEvent?.time || '10:00 AM',
          eventLocation: currentEvent?.location || 'Main Venue',
          category: 'VIP Attendee',
          status: 'assigned' as const,
          themeColor: '#e11d48',
          createdAt: new Date().toISOString(),
          assignedTo: {
            name: 'Alex Vance (Test Attendee)',
            email: testEmailAddress.trim() || gmailCreds.senderEmail,
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

    if (isTest) {
      setIsSendingTest(true);
    } else {
      setIsDispatching(true);
      setDispatchProgress(0);
      setDispatchLogs([]);
    }
    setAlertMessage(null);

    let sentCount = 0;
    let failCount = 0;

    const thankYouConfigPayload = {
      subject,
      headline,
      topBadgeHeading,
      thankYouMessage,
      highlightsHeading,
      eventHighlights,
      resourcesHeading,
      galleryLink,
      galleryTitle,
      surveyHeading,
      surveyLink,
      surveyTitle,
      certificateLink,
      certificateTitle,
      recordingLink,
      recordingTitle,
      futureEventHeading: futureEventSectionHeading,
      futureEventTitle,
      futureEventDetails,
      futureEventLink,
      closingNote,
      senderName: gmailCreds.senderName || 'PassCraft Operations Team',
      style: selectedTheme
    };

    // Mode: Draft all emails first, then send all at once
    if (dispatchSpeed === 'draft_all_send' && !isTest) {
      const totalRecipients = selectedPasses.length;

      // Phase 1: Draft emails with step by step counter
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
        statusText: `Preparing Thank You drafts for ${totalRecipients} attendees...`,
        percent: 0,
      });

      const draftedRecipients = [];
      for (let i = 0; i < selectedPasses.length; i++) {
        const pass = selectedPasses[i];
        const recipientPayload = {
          attendeeName: pass.assignedTo?.name || 'Valued Attendee',
          email: pass.assignedTo?.email || '',
          eventName: pass.eventName || currentEvent?.title || 'Event',
          eventDate: pass.eventDate || currentEvent?.date || 'Recent Event',
          eventTime: pass.eventTime || currentEvent?.time || '10:00 AM',
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
          statusText: `Drafting customized thank you note for ${recipientPayload.attendeeName} (${createdSoFar}/${totalRecipients} created, ${leftToDraft} left)...`,
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
        statusText: `All ${totalRecipients} thank you drafts ready! Now transmitting via Gmail...`,
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
          statusText: `Sending thank you note to ${item.attendeeName} (${remainingBefore} to be sent)...`,
          toBeSentCount: remainingBefore,
        }));

        try {
          const res = await safeFetchJson<{ success: boolean; results?: any[]; error?: string }>('/api/email/dispatch-thank-you', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              smtpConfig: {
                senderEmail: gmailCreds.senderEmail,
                appPassword: gmailCreds.appPassword,
                senderName: gmailCreds.senderName || 'PassCraft Operations Team'
              },
              recipients: [item],
              thankYouConfig: thankYouConfigPayload
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
          statusText: `Dispatched ${curSent} of ${totalRecipients} thank you email(s) (${curLeft} to be sent)...`,
        }));
      }

      sentCount = logsAccumulator.filter(l => l.status === 'sent').length;
      failCount = logsAccumulator.filter(l => l.status === 'failed').length;

      recordDispatchHistory({
        type: 'thank_you',
        sourceLabel: 'Thank You & Recap Bomber',
        eventId: currentEvent?.id,
        eventName: currentEvent?.title || 'Official Event',
        subject: subject,
        senderEmail: gmailCreds.senderEmail,
        senderName: gmailCreds.senderName || 'PassCraft Operations Team',
        totalRecipients: selectedPasses.length,
        sentCount,
        failedCount: failCount,
        status: failCount === 0 ? 'completed' : sentCount === 0 ? 'failed' : 'partial',
        summary: `Pre-drafted and dispatched ${sentCount} of ${selectedPasses.length} post-event thank you & appreciation email(s).`,
        details: {
          headline,
          highlights: eventHighlights,
          hasGallery: Boolean(galleryLink),
          hasSurvey: Boolean(surveyLink),
          hasCertificate: Boolean(certificateLink),
          hasRecording: Boolean(recordingLink)
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
          ? `🎉 Successfully delivered all ${sentCount} thank you emails!` 
          : `Delivered ${sentCount} emails, ${failCount} failed.`,
        percent: 100,
      }));

      setIsDispatching(false);
      if (sentCount > 0) {
        setAlertMessage({
          type: 'success',
          text: `🎉 Pre-drafted and successfully dispatched all ${sentCount} of ${selectedPasses.length} thank you emails at once via Gmail!`
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
      statusText: isTest ? 'Transmitting test thank you email...' : `Connecting to Gmail SMTP for ${totalRecipients} attendee(s)...`,
      percent: 0,
    });

    for (let i = 0; i < selectedPasses.length; i++) {
      const pass = selectedPasses[i];
      const recipientPayload = {
        attendeeName: pass.assignedTo?.name || 'Valued Attendee',
        email: pass.assignedTo?.email || '',
        eventName: pass.eventName || currentEvent?.title || 'Event',
        eventDate: pass.eventDate || currentEvent?.date || 'Recent Event',
        eventTime: pass.eventTime || currentEvent?.time || '10:00 AM',
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
        statusText: `Sending thank you note to ${recipientPayload.attendeeName} (${remainingBefore} to be sent)...`,
        toBeSentCount: remainingBefore,
      }));

      try {
        const res = await safeFetchJson<{ success: boolean; results?: any[]; error?: string }>('/api/email/dispatch-thank-you', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            smtpConfig: {
              senderEmail: gmailCreds.senderEmail,
              appPassword: gmailCreds.appPassword,
              senderName: gmailCreds.senderName || 'PassCraft Operations Team'
            },
            recipients: [recipientPayload],
            thankYouConfig: thankYouConfigPayload
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
          const errMsg = res.data?.results?.[0]?.error || res.data?.error || res.error || 'Failed to send';
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
        statusText: `Dispatched ${sentCount} of ${totalRecipients} thank you email(s) (${curLeft} to be sent)...`,
      }));

      if (!isTest) {
        if (i < selectedPasses.length - 1) {
          await sleep(delayMs);
        }
      }
    }

    setDispatchProgressState(prev => ({
      ...prev,
      phase: failCount === 0 ? 'completed' : sentCount === 0 ? 'failed' : 'completed',
      statusText: failCount === 0 
        ? `🎉 Successfully delivered all ${sentCount} thank you emails!` 
        : `Delivered ${sentCount} emails, ${failCount} failed.`,
      percent: 100,
    }));

    if (isTest) {
      setIsSendingTest(false);
      if (sentCount > 0) {
        setAlertMessage({
          type: 'success',
          text: `✨ Test thank you email successfully delivered to ${testEmailAddress || gmailCreds.senderEmail}!`
        });
      } else {
        setAlertMessage({
          type: 'error',
          text: 'Failed to send test email. Please check your Gmail App Password.'
        });
      }
    } else {
      // Record to unified broadcast history
      recordDispatchHistory({
        type: 'thank_you',
        sourceLabel: 'Thank You & Recap Bomber',
        eventId: currentEvent?.id,
        eventName: currentEvent?.title || 'Official Event',
        subject: subject,
        senderEmail: gmailCreds.senderEmail,
        senderName: gmailCreds.senderName || 'PassCraft Operations Team',
        totalRecipients: selectedPasses.length,
        sentCount,
        failedCount: failCount,
        status: failCount === 0 ? 'completed' : sentCount === 0 ? 'failed' : 'partial',
        summary: `Dispatched post-event thank you letter, photo gallery link (${galleryLink ? 'Yes' : 'No'}), and attendee survey (${surveyLink ? 'Yes' : 'No'}).`,
        details: {
          headline,
          highlights: eventHighlights,
          hasGallery: Boolean(galleryLink),
          hasSurvey: Boolean(surveyLink),
          hasCertificate: Boolean(certificateLink),
          hasRecording: Boolean(recordingLink)
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
          text: `🚀 Success! Dispatched Thank You & Recap emails to all ${sentCount} attendee(s)!`
        });
      } else {
        setAlertMessage({
          type: 'error',
          text: `Dispatch finished: ${sentCount} sent, ${failCount} failed. Check audit logs below.`
        });
      }
    }
  };

  // Sample Preview Data
  const sampleAttendee = {
    name: 'Alex Vance',
    email: 'alex.vance@example.com',
    eventTitle: currentEvent?.title || 'Global Tech & Innovation Summit 2026',
    date: currentEvent?.date || 'Recent Event',
    time: currentEvent?.time || '10:00 AM',
    venue: currentEvent?.location || 'Grand Convention Center, Hall A',
    category: 'VIP Attendee'
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-7xl mx-auto pb-16">

      {/* Edit Confirmation Modal */}
      {editConfirmModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-neutral-900 border border-rose-500/40 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2 bg-rose-500/20 rounded-xl border border-rose-500/30">
                <Pencil className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-black uppercase tracking-wide text-white">
                  Edit Section Heading?
                </h3>
                <p className="text-xs text-neutral-400">
                  {editConfirmModal.sectionName}
                </p>
              </div>
            </div>

            <div className="bg-neutral-950 border border-white/10 rounded-xl p-4 text-xs text-neutral-300 space-y-2">
              <p className="font-semibold text-white">
                Are you sure you want to edit the heading for "{editConfirmModal.sectionName}"?
              </p>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Clicking <span className="text-rose-400 font-bold">Yes</span> will take you directly to the heading editor input so you can customize this section heading and text for all attendees.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditConfirmModal(null)}
                className="px-4 py-2 text-xs font-bold text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-xl transition-all cursor-pointer"
              >
                No, Keep Default
              </button>
              <button
                type="button"
                onClick={handleConfirmEdit}
                className="px-5 py-2 text-xs font-black text-black bg-rose-500 hover:bg-rose-400 rounded-xl uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-rose-500/20 cursor-pointer"
              >
                <Check className="w-4 h-4" /> Yes, Edit Heading
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* ========================================================================= */}
      {/* 1. TOP HERO & GMAIL STATUS BAR                                            */}
      {/* ========================================================================= */}
      <div className="bg-neutral-900 border border-rose-500/30 p-6 rounded-2xl shadow-2xl relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-rose-500/20 text-rose-400 border border-rose-500/40 rounded-lg">
                <HeartHandshake className="w-5 h-5" />
              </span>
              <span className="text-[11px] font-black uppercase tracking-widest text-rose-400">
                MASS POST-EVENT APPRECIATION, MEDIA & RECAP BROADCASTER
              </span>
            </div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-white flex items-center gap-3">
              POST-EVENT <span className="text-rose-400">THANK YOU</span>
            </h1>
            <p className="text-xs text-neutral-300 max-w-2xl leading-relaxed">
              Blast personalized gratitude notes, photo galleries, feedback surveys, keynote replays, and certificate links directly to all registered attendees in one click.
            </p>
          </div>

          {/* Connected Gmail Badge / Settings */}
          <div className="bg-neutral-950/80 border border-white/10 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
            {gmailCreds && gmailCreds.senderEmail ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-500 text-black font-black flex items-center justify-center text-sm uppercase shrink-0">
                  {gmailCreds.senderEmail.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-white">{gmailCreds.senderEmail}</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="text-[10px] text-rose-400 font-mono uppercase tracking-wider flex items-center gap-1 mt-0.5">
                    <span>⚡ Synced with Broadcaster Engine</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Mail className="w-8 h-8 text-neutral-500" />
                <div>
                  <div className="text-xs font-black text-rose-400">Gmail Not Connected</div>
                  <div className="text-[10px] text-neutral-400">Add App Password to dispatch emails</div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowCredsEditor(!showCredsEditor)}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/15 border border-white/15 text-neutral-200 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {showCredsEditor ? 'Close Setup' : (gmailCreds ? 'Switch Gmail' : 'Connect Gmail')}
            </button>
          </div>
        </div>

        {/* Inline Gmail Credential Setup Accordion */}
        {showCredsEditor && (
          <form onSubmit={handleSaveGmail} className="mt-6 pt-6 border-t border-white/10 grid grid-cols-1 md:grid-cols-3 gap-4 animate-fadeIn">
            <div>
              <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1">Your Gmail Address</label>
              <input
                type="email"
                value={inputEmail}
                onChange={e => setInputEmail(e.target.value)}
                placeholder="yourevent@gmail.com"
                required
                className="w-full bg-neutral-950 border border-white/20 focus:border-rose-400 text-white text-xs px-3 py-2 rounded-lg outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1">
                Gmail 16-Char App Password
              </label>
              <input
                type="password"
                value={inputPassword}
                onChange={e => setInputPassword(e.target.value)}
                placeholder="xxxx xxxx xxxx xxxx"
                required
                className="w-full bg-neutral-950 border border-white/20 focus:border-rose-400 text-white text-xs px-3 py-2 rounded-lg outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1">Sender Brand Name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputSenderName}
                  onChange={e => setInputSenderName(e.target.value)}
                  placeholder="PassCraft Event Operations"
                  className="flex-1 bg-neutral-950 border border-white/20 focus:border-rose-400 text-white text-xs px-3 py-2 rounded-lg outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-500 hover:bg-rose-400 text-black font-black text-xs uppercase rounded-lg transition-colors cursor-pointer"
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
        <div className={`p-4 rounded-xl flex items-center gap-3 border ${
          alertMessage.type === 'success' ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300' : 'bg-red-950/80 border-red-500/50 text-red-300'
        }`}>
          {alertMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" /> : <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />}
          <div className="text-xs font-bold flex-1">{alertMessage.text}</div>
          <button onClick={() => setAlertMessage(null)} className="text-neutral-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. EVENT SELECTOR & AI INSPIRATION STUDIO (LIKE EVENT RULE PAGE)          */}
      {/* ========================================================================= */}
      <div className="bg-neutral-900 border border-white/10 p-6 rounded-2xl shadow-xl space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          
          {/* Target Event Picker */}
          <div>
            <label className="block text-[10px] font-black uppercase text-rose-400 tracking-wider mb-1.5">
              1. Target Event for Thank You Blast
            </label>
            <select
              value={selectedEventId}
              onChange={e => setSelectedEventId(e.target.value)}
              className="w-full bg-neutral-950 border border-white/20 focus:border-rose-400 text-white text-xs font-bold px-3 py-2.5 rounded-xl outline-none"
            >
              <option value="all">⚡ All Events ({passes.filter(p => p.status === 'assigned' || p.status === 'checked_in').length} Total Attendees)</option>
              {events.map(evt => {
                const count = passes.filter(p => (p.status === 'assigned' || p.status === 'checked_in') && (p.eventId === evt.id || (p.eventName && p.eventName.toLowerCase().trim() === evt.title.toLowerCase().trim()))).length;
                return (
                  <option key={evt.id} value={evt.id}>
                    {evt.title} ({evt.date}) — {count} Assigned Attendee(s)
                  </option>
                );
              })}
            </select>
          </div>

          {/* AI Thank You Copy Generator Bar */}
          <div className="lg:col-span-2">
            <label className="block text-[10px] font-black uppercase text-rose-400 tracking-wider mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                2. AI Thank You & Recap Generator
              </span>
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-neutral-400 lowercase">tone:</span>
                <select
                  value={aiTone}
                  onChange={e => setAiTone(e.target.value)}
                  className="bg-neutral-950 border border-white/10 text-neutral-200 text-[10px] px-2 py-0.5 rounded outline-none"
                >
                  <option value="heartfelt & inspiring">Heartfelt & Inspiring</option>
                  <option value="executive & polished">Executive & Polished</option>
                  <option value="vibrant & energetic">Vibrant & Energetic</option>
                  <option value="festive & celebratory">Festive & Celebratory</option>
                </select>
              </div>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder="e.g. 2-Day AI Summit with 800 delegates, traditional gala banquet, unforgettable concerts..."
                className="flex-1 bg-neutral-950 border border-white/20 focus:border-rose-400 text-white text-xs px-4 py-2.5 rounded-xl outline-none"
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleGenerateAi())}
              />
              <button
                type="button"
                onClick={() => handleGenerateAi()}
                disabled={isGeneratingAi}
                className="px-5 py-2.5 bg-rose-500 hover:bg-rose-400 disabled:opacity-40 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow"
              >
                {isGeneratingAi ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                Generate Copy
              </button>
            </div>
          </div>
        </div>

        {/* Quick Scenario Pills */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-white/10">
          <span className="text-[10px] font-mono text-neutral-500 uppercase">Quick 1-Click Scenarios:</span>
          {[
            { label: '🏢 Tech Conference', type: 'conference' as const, prompt: '2-Day Tech summit with keynote slides and photo gallery' },
            { label: '✨ Gala Dinner', type: 'gala' as const, prompt: 'Formal black tie charity dinner and award presentations' },
            { label: '🎸 Live Festival', type: 'festival' as const, prompt: 'Outdoor live concert and music festival vibes' },
            { label: '💻 Hackathon Meet', type: 'hackathon' as const, prompt: '48-hour coding hackathon with project demos and certificate links' },
            { label: '🌸 Cultural Fest', type: 'cultural' as const, prompt: 'Community festive gathering with traditional celebrations' },
          ].map(chip => (
            <button
              key={chip.label}
              type="button"
              onClick={() => {
                applyPreset(chip.type);
                setAiPrompt(chip.prompt);
              }}
              className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-rose-400/50 text-[11px] text-neutral-300 rounded-lg transition-colors cursor-pointer"
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MAIN 2-COLUMN WORKSPACE (EDITOR vs RECIPIENT BLAST + LIVE PREVIEW)     */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* ======================================================================= */}
        {/* LEFT COLUMN: THANK YOU MESSAGE & MEDIA BUILDER (7 Cols)                 */}
        {/* ======================================================================= */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Action Bar: Auto-save status & Reset */}
          <div className="flex items-center justify-between px-3 py-2 bg-neutral-950/80 border border-white/10 rounded-xl text-xs">
            <div className="flex items-center gap-2 text-neutral-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="text-[11px] font-mono">Thank You copy auto-saved to browser</span>
            </div>
            <button
              type="button"
              onClick={handleResetToDefaults}
              className="text-[11px] font-mono text-neutral-400 hover:text-rose-400 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset to Defaults
            </button>
          </div>

          {/* Theme Palette Bar */}
          <div className="bg-neutral-900 border border-white/10 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xl">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-rose-400" /> Color Aesthetics:
              </span>
            </div>

            <div className="flex items-center gap-2">
              {allThemes.map(t => {
                const isCustom = customThemes.some(ct => ct.name === t.name);
                const isSelected = selectedTheme.name === t.name;
                return (
                  <div key={t.name} className="relative group">
                    <button
                      type="button"
                      onClick={() => setSelectedTheme(t)}
                      title={`${t.name}${isCustom ? ' (Custom)' : ''}`}
                      className={`w-7 h-7 rounded-full border-2 transition-all cursor-pointer ${
                        isSelected ? 'scale-110 border-white shadow-lg ring-2 ring-rose-500/50' : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                      style={{ background: `linear-gradient(135deg, ${t.headerGradientStart}, ${t.accentColor})` }}
                    />
                    {isCustom && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteCustomTheme(t.name, e)}
                        title="Delete custom palette"
                        className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-neutral-900 border border-red-500/80 rounded-full text-red-400 hover:text-white hover:bg-red-600 flex items-center justify-center text-[9px] opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-pointer"
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => setShowAddThemeModal(prev => !prev)}
                title="Add Custom Palette"
                className={`w-7 h-7 rounded-full border border-dashed flex items-center justify-center transition-all cursor-pointer ${
                  showAddThemeModal ? 'border-rose-400 bg-rose-500/20 text-rose-300 scale-105' : 'border-white/30 text-neutral-400 hover:border-white hover:text-white'
                }`}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mini Popover for Custom Coloring */}
          {showAddThemeModal && (
            <div className="bg-neutral-950 border border-rose-500/40 p-4 rounded-2xl shadow-2xl space-y-3 animate-scaleIn">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-xs font-black uppercase text-rose-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Create Custom Color Palette
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddThemeModal(false)}
                  className="text-neutral-500 hover:text-white text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">Palette Name</label>
                <input
                  type="text"
                  value={newTheme.name}
                  onChange={(e) => setNewTheme({ ...newTheme, name: e.target.value })}
                  placeholder="e.g. Sunset Glow..."
                  className="w-full bg-neutral-900 border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-400"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[10px]">
                <div>
                  <label className="block text-[9px] text-neutral-400 mb-1">Header Start</label>
                  <div className="flex items-center gap-1.5 bg-neutral-900 border border-white/15 rounded-lg px-2 py-1">
                    <input
                      type="color"
                      value={newTheme.headerGradientStart}
                      onChange={(e) => setNewTheme({ ...newTheme, headerGradientStart: e.target.value })}
                      className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                    />
                    <span className="font-mono text-[10px] text-neutral-300">{newTheme.headerGradientStart}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] text-neutral-400 mb-1">Header End</label>
                  <div className="flex items-center gap-1.5 bg-neutral-900 border border-white/15 rounded-lg px-2 py-1">
                    <input
                      type="color"
                      value={newTheme.headerGradientEnd}
                      onChange={(e) => setNewTheme({ ...newTheme, headerGradientEnd: e.target.value })}
                      className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                    />
                    <span className="font-mono text-[10px] text-neutral-300">{newTheme.headerGradientEnd}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] text-neutral-400 mb-1">Accent Color</label>
                  <div className="flex items-center gap-1.5 bg-neutral-900 border border-white/15 rounded-lg px-2 py-1">
                    <input
                      type="color"
                      value={newTheme.accentColor}
                      onChange={(e) => setNewTheme({ ...newTheme, accentColor: e.target.value })}
                      className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                    />
                    <span className="font-mono text-[10px] text-neutral-300">{newTheme.accentColor}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] text-neutral-400 mb-1">Card Background</label>
                  <div className="flex items-center gap-1.5 bg-neutral-900 border border-white/15 rounded-lg px-2 py-1">
                    <input
                      type="color"
                      value={newTheme.cardBackground}
                      onChange={(e) => setNewTheme({ ...newTheme, cardBackground: e.target.value })}
                      className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                    />
                    <span className="font-mono text-[10px] text-neutral-300">{newTheme.cardBackground}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddThemeModal(false)}
                  className="px-3 py-1 text-xs text-neutral-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCustomTheme}
                  className="px-4 py-1.5 bg-rose-500 hover:bg-rose-400 text-black font-black text-xs rounded-lg uppercase cursor-pointer"
                >
                  Save & Apply
                </button>
              </div>
            </div>
          )}

          {/* Card 1: Subject, Headline & Main Gratitude Note */}
          <div className="bg-neutral-900 border border-white/10 p-5 rounded-2xl space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-rose-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-white">Email Subject & Gratitude Message</h3>
              </div>
              <button
                type="button"
                onClick={() => promptEditSection('topBadge', 'Top Badge & Headline', 'input-top-badge-heading')}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                title="Edit section headings"
              >
                <Pencil className="w-3 h-3" />
                <span>Edit Heading</span>
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1 flex items-center justify-between">
                    <span>Subject Line</span>
                    <span className="text-[9px] text-neutral-500">&#123;&#123;EVENT_NAME&#125;&#125;</span>
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="e.g. ❤️ Thank You for Attending {{EVENT_NAME}}!"
                    className="w-full bg-neutral-950 border border-white/15 focus:border-rose-400 text-white text-xs px-3 py-2 rounded-lg outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1 flex items-center justify-between">
                    <span>Top Badge Label</span>
                    <span className="text-[9px] text-rose-400">Header pill</span>
                  </label>
                  <input
                    id="input-top-badge-heading"
                    type="text"
                    value={topBadgeHeading}
                    onChange={e => setTopBadgeHeading(e.target.value)}
                    placeholder="e.g. 🌟 POST-EVENT RECAP & APPRECIATION"
                    className="w-full bg-neutral-950 border border-white/15 focus:border-rose-400 text-white text-xs px-3 py-2 rounded-lg outline-none font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1">Email Banner Headline</label>
                <input
                  id="input-headline"
                  type="text"
                  value={headline}
                  onChange={e => setHeadline(e.target.value)}
                  placeholder="e.g. THANK YOU FOR AN UNFORGETTABLE EXPERIENCE!"
                  className="w-full bg-neutral-950 border border-white/15 focus:border-rose-400 text-white text-xs px-3 py-2 rounded-lg outline-none font-black uppercase"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1 flex items-center justify-between">
                  <span>Thank You & Appreciation Body</span>
                  <span className="text-[9px] text-neutral-500">&#123;&#123;ATTENDEE_NAME&#125;&#125;, &#123;&#123;VENUE&#125;&#125;, &#123;&#123;EVENT_NAME&#125;&#125; auto-replaced</span>
                </label>
                <textarea
                  rows={5}
                  value={thankYouMessage}
                  onChange={e => setThankYouMessage(e.target.value)}
                  placeholder="Write your heartfelt appreciation message..."
                  className="w-full bg-neutral-950 border border-white/15 focus:border-rose-400 text-white text-xs p-3 rounded-lg outline-none resize-none leading-relaxed font-sans"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Highlights & Milestones List */}
          <div className="bg-neutral-900 border border-white/10 p-5 rounded-2xl space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-white">Event Highlights & Milestones</h3>
              </div>
              <button
                type="button"
                onClick={() => promptEditSection('highlights', 'Event Highlights Section', 'input-highlights-heading')}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                title="Edit section headings"
              >
                <Pencil className="w-3 h-3" />
                <span>Edit Heading</span>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1 flex items-center justify-between">
                  <span>Section Heading Title</span>
                  <span className="text-[9px] text-amber-400">Customizable banner</span>
                </label>
                <input
                  id="input-highlights-heading"
                  type="text"
                  value={highlightsHeading}
                  onChange={e => setHighlightsHeading(e.target.value)}
                  placeholder="e.g. 🏆 EVENT HIGHLIGHTS & KEY MILESTONES"
                  className="w-full bg-neutral-950 border border-white/15 focus:border-rose-400 text-white text-xs px-3 py-2 rounded-lg outline-none font-bold"
                />
              </div>

              <div className="space-y-2 pt-1">
                {eventHighlights.map((hl, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-neutral-950 border border-white/10 px-3 py-2 rounded-xl text-xs">
                    <span className="text-rose-400 font-bold">🏆</span>
                    <span className="text-neutral-200 flex-1">{hl}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveHighlight(idx)}
                      className="text-neutral-500 hover:text-red-400 cursor-pointer p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={newHighlight}
                    onChange={e => setNewHighlight(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddHighlight(); } }}
                    placeholder="Add another key highlight (e.g. 500+ attendees connected, 20 speakers)..."
                    className="flex-1 bg-neutral-950 border border-white/15 focus:border-rose-400 text-white text-xs px-3 py-2 rounded-lg outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddHighlight}
                    className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold rounded-lg border border-white/10 cursor-pointer"
                  >
                    Add Bullet
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Media, Survey, Certificates & Recordings */}
          <div className="bg-neutral-900 border border-white/10 p-5 rounded-2xl space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-rose-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-white">Event Media, Surveys & Certificates</h3>
              </div>
              <button
                type="button"
                onClick={() => promptEditSection('resources', 'Resources & Survey Section', 'input-resources-heading')}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                title="Edit section headings"
              >
                <Pencil className="w-3 h-3" />
                <span>Edit Heading</span>
              </button>
            </div>

            <div className="space-y-4">
              {/* Media Section Header */}
              <div>
                <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1">📦 Resources Section Heading</label>
                <input
                  id="input-resources-heading"
                  type="text"
                  value={resourcesHeading}
                  onChange={e => setResourcesHeading(e.target.value)}
                  placeholder="e.g. 📦 EVENT RESOURCES & MEDIA"
                  className="w-full bg-neutral-950 border border-white/15 focus:border-rose-400 text-white text-xs px-3 py-2 rounded-lg outline-none font-bold"
                />
              </div>

              {/* Photo Gallery Link */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1">📸 Photo Gallery Title</label>
                  <input
                    type="text"
                    value={galleryTitle}
                    onChange={e => setGalleryTitle(e.target.value)}
                    className="w-full bg-neutral-950 border border-white/15 focus:border-rose-400 text-white text-xs px-3 py-2 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1">Photo Gallery URL</label>
                  <input
                    type="text"
                    value={galleryLink}
                    onChange={e => setGalleryLink(e.target.value)}
                    placeholder="https://photos.google.com/..."
                    className="w-full bg-neutral-950 border border-white/15 focus:border-rose-400 text-white text-xs px-3 py-2 rounded-lg outline-none font-mono"
                  />
                </div>
              </div>

              {/* Feedback Survey Heading & Link */}
              <div className="p-3 bg-neutral-950/60 border border-white/10 rounded-xl space-y-3">
                <div>
                  <label className="block text-[10px] font-mono text-rose-400 uppercase mb-1">💬 Survey Box Title / Heading</label>
                  <input
                    id="input-survey-heading"
                    type="text"
                    value={surveyHeading}
                    onChange={e => setSurveyHeading(e.target.value)}
                    placeholder="e.g. 💬 Help Us Improve!"
                    className="w-full bg-neutral-950 border border-white/15 focus:border-rose-400 text-white text-xs px-3 py-2 rounded-lg outline-none font-bold"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1">Button CTA Title</label>
                    <input
                      type="text"
                      value={surveyTitle}
                      onChange={e => setSurveyTitle(e.target.value)}
                      className="w-full bg-neutral-950 border border-white/15 focus:border-rose-400 text-white text-xs px-3 py-2 rounded-lg outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1">Survey URL (Google Forms / Typeform)</label>
                    <input
                      type="text"
                      value={surveyLink}
                      onChange={e => setSurveyLink(e.target.value)}
                      placeholder="https://forms.google.com/..."
                      className="w-full bg-neutral-950 border border-white/15 focus:border-rose-400 text-white text-xs px-3 py-2 rounded-lg outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Certificate & Keynote Recordings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1">📜 Certificate Download URL (Optional)</label>
                  <input
                    type="text"
                    value={certificateLink}
                    onChange={e => setCertificateLink(e.target.value)}
                    placeholder="https://example.com/certificate"
                    className="w-full bg-neutral-950 border border-white/15 focus:border-rose-400 text-white text-xs px-3 py-2 rounded-lg outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1">🎥 Keynote Replay / Video URL (Optional)</label>
                  <input
                    type="text"
                    value={recordingLink}
                    onChange={e => setRecordingLink(e.target.value)}
                    placeholder="https://youtube.com/..."
                    className="w-full bg-neutral-950 border border-white/15 focus:border-rose-400 text-white text-xs px-3 py-2 rounded-lg outline-none font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Next Edition Announcement ("What's Next") & Sign-Off */}
          <div className="bg-neutral-900 border border-white/10 p-5 rounded-2xl space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-white">Next Edition / What's Next & Sign-Off</h3>
              </div>
              <button
                type="button"
                onClick={() => promptEditSection('futureEvent', 'What\'s Next / Next Edition Section', 'input-future-event-heading')}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                title="Edit section headings"
              >
                <Pencil className="w-3 h-3" />
                <span>Edit Heading</span>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1 flex items-center justify-between">
                  <span>Section Header Tag (e.g. WHAT'S NEXT)</span>
                  <span className="text-[9px] text-emerald-400">Customizable</span>
                </label>
                <input
                  id="input-future-event-heading"
                  type="text"
                  value={futureEventSectionHeading}
                  onChange={e => setFutureEventSectionHeading(e.target.value)}
                  placeholder="e.g. 🚀 WHAT'S NEXT"
                  className="w-full bg-neutral-950 border border-white/15 focus:border-rose-400 text-white text-xs px-3 py-2 rounded-lg outline-none font-bold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1">Next Edition Teaser Title</label>
                  <input
                    type="text"
                    value={futureEventTitle}
                    onChange={e => setFutureEventTitle(e.target.value)}
                    placeholder="e.g. Next Edition: Early Access & Priority"
                    className="w-full bg-neutral-950 border border-white/15 focus:border-rose-400 text-white text-xs px-3 py-2 rounded-lg outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1">Next Event Link / Waitlist</label>
                  <input
                    type="text"
                    value={futureEventLink}
                    onChange={e => setFutureEventLink(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-neutral-950 border border-white/15 focus:border-rose-400 text-white text-xs px-3 py-2 rounded-lg outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-neutral-400 uppercase mb-1">Closing Note / Sign-Off</label>
                <textarea
                  rows={2}
                  value={closingNote}
                  onChange={e => setClosingNote(e.target.value)}
                  placeholder="e.g. With warmest gratitude,\nPassCraft Operations Team"
                  className="w-full bg-neutral-950 border border-white/15 focus:border-rose-400 text-white text-xs p-3 rounded-lg outline-none resize-none font-sans"
                />
              </div>
            </div>
          </div>

        </div>

        {/* ======================================================================= */}
        {/* RIGHT COLUMN: AUDIENCE SELECTOR, BLAST CONTROLS & LIVE EMAIL PREVIEW   */}
        {/* ======================================================================= */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
          
          {/* Dispatch & Audience Control Center */}
          <div className="bg-neutral-900 border border-rose-500/40 p-5 rounded-2xl space-y-4 shadow-2xl">
            
            {/* Header with Device Switcher */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-rose-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-white">Thank You Dispatch Controls</h3>
              </div>

              <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  className={`p-1.5 rounded cursor-pointer transition-colors ${previewDevice === 'desktop' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-white'}`}
                  title="Desktop View"
                >
                  <Monitor className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  className={`p-1.5 rounded cursor-pointer transition-colors ${previewDevice === 'mobile' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-white'}`}
                  title="Mobile View"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Recipient Audience Filter Bar */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase text-neutral-300 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-rose-400" /> Target Audience
                </span>
                <span className="text-[10px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-lg font-bold">
                  {selectedPassIds.length} of {filteredRecipients.length} Selected
                </span>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-white/10 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`flex-1 py-1 rounded transition-colors cursor-pointer ${statusFilter === 'all' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'}`}
                >
                  All ({eventPasses.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('checked_in')}
                  className={`flex-1 py-1 rounded transition-colors cursor-pointer ${statusFilter === 'checked_in' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30' : 'text-neutral-400 hover:text-white'}`}
                >
                  Checked In ({eventPasses.filter(p => p.status === 'checked_in').length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('not_checked_in')}
                  className={`flex-1 py-1 rounded transition-colors cursor-pointer ${statusFilter === 'not_checked_in' ? 'bg-amber-950 text-amber-300 border border-amber-500/30' : 'text-neutral-400 hover:text-white'}`}
                >
                  Not Checked In ({eventPasses.filter(p => p.status !== 'checked_in').length})
                </button>
              </div>

              {/* Search & Select All Bar */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3 h-3 text-neutral-500 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={recipientSearch}
                    onChange={e => setRecipientSearch(e.target.value)}
                    placeholder="Search attendee by name, email, tier..."
                    className="w-full bg-neutral-950 border border-white/10 rounded-lg pl-7 pr-3 py-1.5 text-[11px] text-white focus:border-rose-400 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white text-[10px] font-bold rounded-lg border border-white/10 whitespace-nowrap cursor-pointer"
                >
                  {selectedPassIds.length === filteredRecipients.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              {/* Interactive Recipient Checkbox List */}
              <div className="max-h-40 overflow-y-auto space-y-1 bg-neutral-950 p-2 rounded-xl border border-white/10">
                {filteredRecipients.length === 0 ? (
                  <div className="text-center py-4 text-neutral-500 text-[11px]">
                    No attendees match the selected event / filter.
                  </div>
                ) : (
                  filteredRecipients.map(pass => {
                    const isSelected = selectedPassIds.includes(pass.id);
                    return (
                      <div
                        key={pass.id}
                        onClick={() => togglePassSelection(pass.id)}
                        className={`flex items-center justify-between p-1.5 rounded-lg text-[11px] cursor-pointer transition-colors border ${
                          isSelected ? 'bg-rose-950/30 border-rose-500/30 text-white' : 'bg-transparent border-transparent text-neutral-400 hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {isSelected ? (
                            <CheckSquare className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
                          )}
                          <div className="truncate">
                            <span className="font-bold text-neutral-200 mr-1.5">{pass.assignedTo?.name || 'Attendee'}</span>
                            <span className="text-[10px] text-neutral-400 font-mono">{pass.assignedTo?.email}</span>
                          </div>
                        </div>
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                          pass.status === 'checked_in' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-neutral-800 text-neutral-300'
                        }`}>
                          {pass.category || 'General'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Speed & Test Email Section */}
            <div className="space-y-3 pt-2 border-t border-white/10">
              
              {/* Dispatch Speed Selector */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-[10px] font-black uppercase text-neutral-400">Dispatch Speed:</span>
                <div className="flex items-center gap-1 text-[10px] font-bold flex-wrap">
                  {[
                    { id: 'gap_1.5', label: '⚡ Fast (1.5s)' },
                    { id: 'gap_3', label: '⏱️ Normal (3s)' },
                    { id: 'gap_5', label: '🛡️ Safe (5s)' },
                    { id: 'draft_all_send', label: '🚀 Draft & Send All at Once' },
                  ].map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setDispatchSpeed(s.id as any)}
                      className={`px-2 py-1 rounded-lg cursor-pointer transition-all ${
                        dispatchSpeed === s.id ? 'bg-rose-500 text-white font-bold shadow-sm' : 'bg-neutral-950 text-neutral-400 hover:text-white border border-white/10'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Single Test Email Row */}
              <div className="flex gap-2">
                <input
                  type="email"
                  value={testEmailAddress}
                  onChange={e => setTestEmailAddress(e.target.value)}
                  placeholder="Enter test email address..."
                  className="flex-1 bg-neutral-950 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:border-rose-400 focus:outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={() => handleStartDispatch(true)}
                  disabled={isSendingTest || isDispatching}
                  className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold rounded-lg border border-white/10 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0"
                >
                  {isSendingTest ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                  Send Test
                </button>
              </div>

              {/* Main Mass Blast Primary Button */}
              <button
                type="button"
                onClick={() => handleStartDispatch(false)}
                disabled={selectedPassIds.length === 0 || isDispatching || isSendingTest}
                className="w-full py-3.5 bg-gradient-to-r from-rose-500 via-pink-500 to-rose-600 hover:from-rose-400 hover:to-pink-400 text-black font-black uppercase tracking-wider text-xs rounded-xl transition-all shadow-xl shadow-rose-950/50 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
              >
                {isDispatching ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Blasting Thank You Emails ({dispatchProgress}%)...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Blast Thank You to All {selectedPassIds.length} Attendee(s)
                  </>
                )}
              </button>
            </div>

            {/* Real-time Two-Phase / Single-Phase Progress Hub */}
            {(isDispatching || dispatchProgressState.isActive) && (
              <div className="pt-2">
                <DispatchProgressCard 
                  progress={dispatchProgressState} 
                  title="Thank You & Recap Blast Engine"
                  onDismiss={() => setDispatchProgressState(prev => ({ ...prev, isActive: false }))}
                />
              </div>
            )}

            {/* Live Dispatch Logs */}
            {dispatchLogs.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400">
                  <span>DISPATCH AUDIT LOG ({dispatchLogs.length})</span>
                  <button onClick={() => setDispatchLogs([])} className="hover:text-white cursor-pointer">Clear</button>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1 bg-neutral-950 p-2 rounded-lg border border-white/5 font-mono text-[10px]">
                  {dispatchLogs.map((log, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-neutral-300 truncate max-w-[180px]">{log.name} ({log.email})</span>
                      <span className={log.status === 'sent' ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                        {log.status === 'sent' ? `✓ SENT [${log.time}]` : `✕ ${log.error || 'FAILED'}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Live Inbox WYSIWYG Preview */}
          <div className="bg-neutral-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-3 bg-neutral-950 border-b border-white/10 flex items-center justify-between text-xs text-neutral-400">
              <span className="font-bold flex items-center gap-1.5 text-white">
                <Eye className="w-3.5 h-3.5 text-rose-400" /> Live Attendee Inbox Preview
              </span>
              <span className="text-[10px] text-neutral-500 font-mono">
                To: {sampleAttendee.name}
              </span>
            </div>

            {/* Email Canvas Box */}
            <div className="p-4 overflow-y-auto max-h-[550px]" style={{ backgroundColor: selectedTheme.outerBackground }}>
              <div 
                className={`mx-auto rounded-xl overflow-hidden border transition-all ${
                  previewDevice === 'mobile' ? 'max-w-[320px] text-xs' : 'max-w-[500px]'
                }`}
                style={{ 
                  backgroundColor: selectedTheme.cardBackground,
                  borderColor: selectedTheme.accentColor
                }}
              >
                {/* Header Gradient */}
                <div 
                  className="p-5 text-center"
                  style={{ 
                    background: `linear-gradient(135deg, ${selectedTheme.headerGradientStart} 0%, ${selectedTheme.headerGradientEnd} 100%)`,
                    color: selectedTheme.headerTextColor
                  }}
                >
                  <div className="text-[9px] font-black uppercase tracking-widest opacity-90 mb-1">
                    🌟 POST-EVENT RECAP & APPRECIATION
                  </div>
                  <h4 className="text-base font-black uppercase tracking-tight leading-tight m-0">
                    {headline}
                  </h4>
                  <div className="text-[10px] font-bold mt-1 opacity-90">
                    📍 {currentEvent?.location || sampleAttendee.venue} • 📅 {currentEvent?.date || sampleAttendee.date}
                  </div>
                </div>

                {/* Email Body */}
                <div className="p-4 space-y-4" style={{ color: selectedTheme.textColor }}>
                  
                  {/* Greeting & Message */}
                  <div>
                    <div className="text-xs font-bold">Dear {sampleAttendee.name},</div>
                    <div className="text-[11px] leading-relaxed mt-1 whitespace-pre-line" style={{ color: selectedTheme.textColor }}>
                      {thankYouMessage
                        .replace(/\{\{ATTENDEE_NAME\}\}/g, sampleAttendee.name)
                        .replace(/\{\{EVENT_NAME\}\}/g, currentEvent?.title || sampleAttendee.eventTitle)
                        .replace(/\{\{VENUE\}\}/g, currentEvent?.location || sampleAttendee.venue)
                        .replace(/\{\{EVENT_DATE\}\}/g, currentEvent?.date || sampleAttendee.date)}
                    </div>
                  </div>

                  {/* Highlights (Conditionally rendered) */}
                  {eventHighlights.length > 0 && (
                    <div 
                      className="p-3 rounded-lg border-l-4 space-y-1"
                      style={{ 
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        borderColor: selectedTheme.accentColor
                      }}
                    >
                      <div className="text-[9px] font-black uppercase tracking-wider" style={{ color: selectedTheme.highlightColor }}>
                        🏆 EVENT HIGHLIGHTS & KEY MILESTONES
                      </div>
                      <ul className="space-y-1 pl-3 text-[10px] list-disc" style={{ color: selectedTheme.textColor }}>
                        {eventHighlights.map((hl, i) => (
                          <li key={i}>{hl}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Resource Action Buttons */}
                  {(galleryLink || certificateLink || recordingLink) && (
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[9px] font-black uppercase tracking-wider" style={{ color: selectedTheme.accentColor }}>
                        📦 EVENT RESOURCES & MEDIA
                      </div>
                      {galleryLink && (
                        <a 
                          href={galleryLink} 
                          target="_blank" 
                          rel="noreferrer"
                          className="block p-2 rounded-lg text-center font-bold text-xs border border-white/10 hover:border-white/30"
                          style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: selectedTheme.textColor }}
                        >
                          📸 {galleryTitle} &rarr;
                        </a>
                      )}
                      {certificateLink && (
                        <a 
                          href={certificateLink} 
                          target="_blank" 
                          rel="noreferrer"
                          className="block p-2 rounded-lg text-center font-bold text-xs border border-white/10 hover:border-white/30"
                          style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: selectedTheme.textColor }}
                        >
                          📜 {certificateTitle} &rarr;
                        </a>
                      )}
                      {recordingLink && (
                        <a 
                          href={recordingLink} 
                          target="_blank" 
                          rel="noreferrer"
                          className="block p-2 rounded-lg text-center font-bold text-xs border border-white/10 hover:border-white/30"
                          style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: selectedTheme.textColor }}
                        >
                          🎥 {recordingTitle} &rarr;
                        </a>
                      )}
                    </div>
                  )}

                  {/* Feedback Survey CTA */}
                  {surveyLink && (
                    <div 
                      className="p-3 rounded-lg text-center space-y-1.5 border"
                      style={{ 
                        backgroundColor: 'rgba(244, 63, 94, 0.08)',
                        borderColor: 'rgba(244, 63, 94, 0.3)'
                      }}
                    >
                      <div className="text-xs font-bold" style={{ color: selectedTheme.highlightColor }}>
                        💬 Help Us Improve!
                      </div>
                      <div className="text-[10px]" style={{ color: selectedTheme.subtextColor }}>
                        Your feedback shapes our future events.
                      </div>
                      <a 
                        href={surveyLink} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-block px-3 py-1.5 rounded text-xs font-black uppercase text-black"
                        style={{ backgroundColor: selectedTheme.accentColor }}
                      >
                        {surveyTitle}
                      </a>
                    </div>
                  )}

                  {/* What's Next / Upcoming Event */}
                  {futureEventTitle && (
                    <div 
                      className="p-3 rounded-lg border space-y-1"
                      style={{ 
                        backgroundColor: 'rgba(0,0,0,0.25)',
                        borderColor: 'rgba(255,255,255,0.1)'
                      }}
                    >
                      <div className="text-[9px] font-black uppercase tracking-wider" style={{ color: selectedTheme.highlightColor }}>
                        🚀 WHAT'S NEXT
                      </div>
                      <div className="text-xs font-bold" style={{ color: selectedTheme.textColor }}>
                        {futureEventTitle}
                      </div>
                      {futureEventDetails && (
                        <div className="text-[10px]" style={{ color: selectedTheme.subtextColor }}>
                          {futureEventDetails}
                        </div>
                      )}
                      {futureEventLink && (
                        <a 
                          href={futureEventLink} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-block text-[10px] font-bold underline mt-1"
                          style={{ color: selectedTheme.accentColor }}
                        >
                          View details &rarr;
                        </a>
                      )}
                    </div>
                  )}

                  {/* Closing Note */}
                  {closingNote && (
                    <div className="text-[10px] pt-2 border-t border-white/10 whitespace-pre-line" style={{ color: selectedTheme.subtextColor }}>
                      {closingNote}
                    </div>
                  )}

                </div>

                {/* Email Footer */}
                <div 
                  className="p-3 text-center text-[9px] border-t border-white/10"
                  style={{ color: selectedTheme.subtextColor, backgroundColor: 'rgba(0,0,0,0.3)' }}
                >
                  {gmailCreds?.senderName || 'PassCraft Operations Team'} • Post-Event Appreciation & Community Updates
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
