import QRCode from 'qrcode';
import { EventItem, PassItem, PassStatus } from '../types';

// Generate 16 digit code
export function generate16DigitCode(): string {
  let code = '';
  // Ensure 16 digits, first digit non-zero
  code += Math.floor(Math.random() * 9 + 1).toString();
  for (let i = 1; i < 16; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
}

export const generate16DigitNumericCode = generate16DigitCode;

// Format 16 digit code into 4 groups of 4: "XXXX-XXXX-XXXX-XXXX"
export function format16DigitCode(rawCode: string): string {
  const digits = rawCode.replace(/\D/g, '').slice(0, 16);
  if (digits.length <= 4) return digits;
  if (digits.length <= 8) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  if (digits.length <= 12) return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 12)}-${digits.slice(12, 16)}`;
}

// Fast QR Code Image URL for print sheets and Docs exports
export function generateQRDataURL(text: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(text)}`;
}

// Strict Hex Color Sanitizer (ensures #RRGGBB format and handles #10b00, rgb, etc.)
export function sanitizeHexColor(inputHex?: string | null, defaultColor: string = '#000000'): string {
  if (!inputHex || typeof inputHex !== 'string') return defaultColor;
  let trimmed = inputHex.trim();
  
  if (!trimmed.startsWith('#')) {
    trimmed = '#' + trimmed;
  }
  
  // Standard 6-digit hex format: #RRGGBB
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed;
  }
  
  // 3-digit hex format: #RGB -> #RRGGBB
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const r = trimmed[1], g = trimmed[2], b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  
  // 8-digit hex format: #RRGGBBAA -> #RRGGBB
  if (/^#[0-9a-fA-F]{8}$/.test(trimmed)) {
    return trimmed.slice(0, 7);
  }
  
  // 4-digit hex format: #RGBA -> #RRGGBB
  if (/^#[0-9a-fA-F]{4}$/.test(trimmed)) {
    const r = trimmed[1], g = trimmed[2], b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  
  // 5-digit hex (e.g. #10b00) -> pad with trailing 0
  if (/^#[0-9a-fA-F]{5}$/.test(trimmed)) {
    return trimmed + '0';
  }
  
  // If invalid or malformed, return defaultColor
  return defaultColor;
}

// Generate QR Code as Data URL
export async function generateQRCodeDataUrl(text: string, colorHex: string = '#000000'): Promise<string> {
  const safeDark = sanitizeHexColor(colorHex, '#000000');
  try {
    return await QRCode.toDataURL(text, {
      width: 320,
      margin: 1.5,
      color: {
        dark: safeDark,
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'H',
    });
  } catch (err) {
    // If custom color fails for any reason, safely fall back to pure black QR code
    try {
      return await QRCode.toDataURL(text, {
        width: 320,
        margin: 1.5,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: 'H',
      });
    } catch {
      return generateQRDataURL(text);
    }
  }
}

// Web Audio API Sound Feedback
export function playAssignSuccessChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    
    // First tone
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    gain1.gain.setValueAtTime(0.15, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.25);

    // Second tone higher pitch
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
    gain2.gain.setValueAtTime(0.2, ctx.currentTime + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.12);
    osc2.stop(ctx.currentTime + 0.5);
  } catch (e) {
    // Audio context allowed after user interaction
  }
}

export function playErrorChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {}
}

// Soothing, calm, and harmonious acoustic chime for Gate Scanner approved entry
export function playGateSuccessTick() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    
    // Soothing Major Chord harmonic blend: C5 (523.25Hz) + E5 (659.25Hz) + G5 (783.99Hz) with smooth soft envelopes
    const freqs = [523.25, 659.25, 783.99, 1046.5];
    const delays = [0, 0.04, 0.08, 0.12];

    freqs.forEach((freq, i) => {
      const startTime = ctx.currentTime + delays[i];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      // Gentle smooth attack and warm exponential decay
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(0.18 / (i + 1), startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.65);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.7);
    });
  } catch (e) {
    // Audio autoplay restrictions
  }
}

// Amber alert tone for duplicate / already scanned ticket
export function playGateDuplicateAlertSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Low dual tone pulse 1
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(320, ctx.currentTime);
    gain1.gain.setValueAtTime(0.2, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.18);

    // Low dual tone pulse 2
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(260, ctx.currentTime + 0.2);
    gain2.gain.setValueAtTime(0.25, ctx.currentTime + 0.2);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.2);
    osc2.stop(ctx.currentTime + 0.45);
  } catch (e) {}
}

// Urgent siren alarm for FAKE / counterfeit tickets
export function playGateFakeTicketAlarm() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Dissonant descending harsh siren
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'square';

    osc1.frequency.setValueAtTime(950, ctx.currentTime);
    osc1.frequency.linearRampToValueAtTime(220, ctx.currentTime + 0.45);

    osc2.frequency.setValueAtTime(890, ctx.currentTime);
    osc2.frequency.linearRampToValueAtTime(210, ctx.currentTime + 0.45);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(ctx.currentTime);
    osc2.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.5);
    osc2.stop(ctx.currentTime + 0.5);
  } catch (e) {}
}

// Heavy tri-tone security lockout for Lost/Stolen/Deactivated passes
export function playGateSecurityFlaggedAlarm() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    [0, 0.15, 0.3].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      const freqs = [350, 250, 180];
      osc.frequency.setValueAtTime(freqs[idx], ctx.currentTime + offset);
      gain.gain.setValueAtTime(0.25, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.18);
    });
  } catch (e) {}
}

// Wrong Gate / Barricade Denied tone (e.g. Silver pass trying to enter Gold/VIP Gate)
export function playGateWrongGateAlarm() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Two rapid mid-pitch buzzes
    [0, 0.16].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(240, ctx.currentTime + offset);
      gain.gain.setValueAtTime(0.25, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.12);
    });
  } catch (e) {}
}

// Helper to get or generate default gates for an event
export function getEventGates(event?: EventItem | null): import('../types').EventGateConfig[] {
  if (!event) {
    return [
      {
        id: 'gate-default-1',
        name: 'Gate 1 - Main Entrance (All Passes)',
        code: 'G1',
        description: 'Universal main entrance for all verified attendees',
        allowedCategories: ['all'],
        color: '#10b981',
        order: 1,
        isCheckpoint: false,
      }
    ];
  }

  if (event.gates && event.gates.length > 0) {
    return event.gates;
  }

  // Generate intelligent default gates based on event's ticket tiers if available
  const tiers = event.ticketTiers || [];
  const tierNames = tiers.map(t => t.categoryName.toLowerCase());
  const hasGold = tierNames.some(t => t.includes('gold'));
  const hasVip = tierNames.some(t => t.includes('vip') || t.includes('vvip'));
  const hasSilver = tierNames.some(t => t.includes('silver') || t.includes('general') || t.includes('student') || t.includes('early'));

  if (hasGold || hasVip) {
    const generatedGates: import('../types').EventGateConfig[] = [
      {
        id: `gate-${event.id}-1`,
        name: 'Gate 1 - Outer Perimeter & Silver Entry',
        code: 'G1',
        description: 'Outer security check • Admits All ticket tiers to general festival grounds',
        allowedCategories: ['all'],
        color: '#10b981',
        order: 1,
        isCheckpoint: true,
      }
    ];

    if (hasGold) {
      generatedGates.push({
        id: `gate-${event.id}-2`,
        name: 'Gate 2 - Gold Zone Barricade',
        code: 'G2',
        description: 'Inner checkpoint • Requires Gold, VIP, Speaker, or Organizer pass',
        allowedCategories: ['Gold', 'VIP', 'VVIP', 'Speaker', 'Organizer', 'Press VIP'],
        color: '#f59e0b',
        order: 2,
        isCheckpoint: true,
        requiredPreviousGateId: `gate-${event.id}-1`
      });
    }

    if (hasVip) {
      generatedGates.push({
        id: `gate-${event.id}-3`,
        name: 'Gate 3 - VIP Red Carpet & Lounge',
        code: 'G3',
        description: 'Executive area • Exclusive to VIP / VVIP pass holders',
        allowedCategories: ['VIP', 'VVIP', 'Speaker', 'Backstage VIP', 'Organizer'],
        color: '#ec4899',
        order: 3,
        isCheckpoint: false,
        requiredPreviousGateId: hasGold ? `gate-${event.id}-2` : `gate-${event.id}-1`
      });
    }

    return generatedGates;
  }

  // Default single universal gate
  return [
    {
      id: `gate-${event.id}-1`,
      name: 'Gate 1 - Main Entrance (All Passes)',
      code: 'G1',
      description: 'Universal main entrance for all verified attendees',
      allowedCategories: ['all'],
      color: '#10b981',
      order: 1,
      isCheckpoint: false,
    }
  ];
}

const STORAGE_GATE_LOGS_KEY = 'passcraft_gate_entry_logs_v1';

export function loadGateLogsFromStorage(): any[] {
  try {
    const raw = localStorage.getItem(STORAGE_GATE_LOGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to load gate logs from storage:', e);
  }
  return [];
}

export function saveGateLogsToStorage(logs: any[]) {
  try {
    if (Array.isArray(logs)) {
      localStorage.setItem(STORAGE_GATE_LOGS_KEY, JSON.stringify(logs));
    }
  } catch (e) {
    console.error('Failed to save gate logs to storage:', e);
  }
}

/**
 * Returns a clean, human-readable list of all gates used by a pass.
 * If 2 or more gates are used, shows all used gates (e.g. "Gate 1, Gate 2" or "Gate 1 - Main Entrance, Gate 2 - VIP Zone").
 * Checks both pass.entryHistory and stored gate logs to ensure all admissions are captured.
 */
export function getPassGatesUsed(pass: PassItem, gateLogs?: any[]): string {
  const admittedGateNames: string[] = [];

  const addGate = (name?: string | null) => {
    if (!name || typeof name !== 'string') return;
    const clean = name.trim();
    if (clean && !admittedGateNames.includes(clean)) {
      admittedGateNames.push(clean);
    }
  };

  // 1. Check pass.entryHistory records
  if (pass.entryHistory && Array.isArray(pass.entryHistory)) {
    pass.entryHistory.forEach((h) => {
      if (h.status === 'admitted' || !h.status) {
        addGate(h.gateName);
      }
    });
  }

  // 2. Check pass.gateScans if present
  if ((pass as any).gateScans && Array.isArray((pass as any).gateScans)) {
    (pass as any).gateScans.forEach((scan: any) => {
      addGate(scan.gateName || scan.name);
    });
  }

  // 3. Check pass.gateName if present
  if ((pass as any).gateName) {
    addGate((pass as any).gateName);
  }

  // 4. Also check external gate logs if provided (or fallback to checking storage)
  const logsToInspect = gateLogs || loadGateLogsFromStorage();
  if (Array.isArray(logsToInspect)) {
    logsToInspect.forEach((log) => {
      if (
        (log.passId === pass.id || (log.code16 && log.code16 === pass.code16)) &&
        (log.status === 'admitted' || !log.status)
      ) {
        addGate(log.gateName);
      }
    });
  }

  if (admittedGateNames.length === 0) {
    if (pass.status === 'checked_in' || pass.checkedInAt) {
      return 'Main Gate';
    }
    return '';
  }

  // If 2 or more gates are used, join all used gates with a comma & space so both/all are visible
  return admittedGateNames.join(', ');
}

export interface SheetColumnDef {
  key: string;
  header: string;
  type: 'text' | 'formula' | 'number' | 'status' | 'date';
  width: number;
  description: string;
  category: 'core' | 'attendee' | 'event' | 'checkin' | 'security';
}

export const ALL_SHEET_COLUMNS: SheetColumnDef[] = [
  { key: "code16", header: "16-Digit Pass Code", type: "text", width: 180, description: "Formatted pass code (XXXX-XXXX-XXXX-XXXX)", category: "core" },
  { key: "qrImage", header: "Live QR Formula", type: "formula", width: 110, description: "Google Sheets =IMAGE() scannable QR code", category: "core" },
  { key: "attendeeName", header: "Attendee Name", type: "text", width: 180, description: "Full name of the assigned ticket holder", category: "attendee" },
  { key: "email", header: "Email Address", type: "text", width: 220, description: "Attendee contact email address", category: "attendee" },
  { key: "phone", header: "Phone Number", type: "text", width: 150, description: "Attendee contact telephone / mobile", category: "attendee" },
  { key: "eventName", header: "Event Title", type: "text", width: 180, description: "Designated event name", category: "event" },
  { key: "category", header: "Tier / Category", type: "text", width: 140, description: "Pass tier (e.g. VIP, General Admission, Crew)", category: "event" },
  { key: "price", header: "Price ($)", type: "number", width: 110, description: "Ticket sale or admission price", category: "event" },
  { key: "status", header: "Pass Status", type: "status", width: 130, description: "Current lifecycle state (assigned, unassigned, checked_in)", category: "core" },
  { key: "checkedInAt", header: "Check-in Timestamp", type: "date", width: 190, description: "Exact date & time of first admission scan", category: "checkin" },
  { key: "gateName", header: "Gate Used", type: "text", width: 180, description: "Turnstile gate names scanned through (multi-gate supported)", category: "checkin" },
  { key: "totalEntries", header: "Total Gate Entries", type: "number", width: 140, description: "Number of gate scan admissions recorded", category: "checkin" },
  { key: "assignedAt", header: "Assigned Date", type: "date", width: 170, description: "Timestamp when pass was allocated to attendee", category: "attendee" },
  { key: "notes", header: "Access Notes", type: "text", width: 180, description: "Special notes or custom access remarks", category: "security" },
  { key: "securityHash", header: "Security Hash", type: "text", width: 160, description: "Cryptographic hash verification string", category: "security" },
];

export const DEFAULT_PEOPLE_COLUMN_KEYS = [
  'code16', 'qrImage', 'attendeeName', 'email', 'phone', 'eventName', 'category', 'price', 'status'
];

export const DEFAULT_CHECKIN_COLUMN_KEYS = [
  'code16', 'qrImage', 'attendeeName', 'email', 'eventName', 'category', 'checkedInAt', 'gateName', 'totalEntries', 'status'
];

export function formatPassColumnValue(pass: PassItem, key: string, rowIndex: number = 2, defaultEventName?: string): string {
  switch (key) {
    case 'code16':
      return pass.formattedCode || pass.code16 || '';
    case 'qrImage':
      return `=IMAGE("https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${pass.code16}")`;
    case 'attendeeName':
      return pass.assignedTo?.name || (pass.status === 'unassigned' ? '[Unassigned]' : '');
    case 'email':
      return pass.assignedTo?.email || '';
    case 'phone':
      return pass.assignedTo?.phone || '';
    case 'eventName':
      return pass.eventName || defaultEventName || '';
    case 'category':
      return pass.category || 'General';
    case 'price':
      return String(pass.ticketPrice || 0);
    case 'status':
      return pass.status;
    case 'checkedInAt':
      return pass.checkedInAt ? new Date(pass.checkedInAt).toLocaleString() : '';
    case 'gateName':
      return getPassGatesUsed(pass) || (pass.status === 'checked_in' ? 'Main Gate' : '-');
    case 'totalEntries':
      if (pass.entryHistory && Array.isArray(pass.entryHistory) && pass.entryHistory.length > 0) {
        return String(pass.entryHistory.length);
      }
      if (Array.isArray((pass as any).gateScans) && (pass as any).gateScans.length > 0) {
        return String((pass as any).gateScans.length);
      }
      return pass.status === 'checked_in' ? '1' : '0';
    case 'assignedAt':
      return (pass as any).assignedAt ? new Date((pass as any).assignedAt).toLocaleString() : '';
    case 'notes':
      return (pass as any).notes || '';
    case 'securityHash':
      return (pass as any).securityHash || (pass.id ? pass.id.slice(0, 12) : '');
    default:
      return '';
  }
}

// Export CSV for Canva Bulk Create
export function generateCanvaCSV(passes: PassItem[]): string {
  const headers = [
    'PassID',
    'Code16Digits',
    'FormattedCode',
    'AttendeeName',
    'AttendeeEmail',
    'AttendeePhone',
    'AttendeeIDNumber',
    'EventName',
    'EventDate',
    'CommencementTime',
    'EndTime',
    'EventTime',
    'EventLocation',
    'CategoryTier',
    'PassStatus',
    'AssignedDate',
    'QRCodeData'
  ];

  const rows = passes.map(pass => [
    csvEscape(pass.id),
    csvEscape(pass.code16),
    csvEscape(pass.formattedCode),
    csvEscape(pass.assignedTo?.name || 'Unassigned Guest'),
    csvEscape(pass.assignedTo?.email || ''),
    csvEscape(pass.assignedTo?.phone || ''),
    csvEscape(pass.assignedTo?.idNumber || ''),
    csvEscape(pass.eventName),
    csvEscape(pass.eventDate),
    csvEscape(pass.commencementTime || pass.eventTime),
    csvEscape(pass.endTime || ''),
    csvEscape(pass.eventTime),
    csvEscape(pass.eventLocation),
    csvEscape(pass.category),
    csvEscape(pass.status),
    csvEscape(pass.assignedTo?.assignedAt ? new Date(pass.assignedTo.assignedAt).toLocaleDateString() : ''),
    csvEscape(pass.formattedCode) // QR Code text payload for Canva QR element generator
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

function csvEscape(value: string): string {
  if (value === null || value === undefined) return '""';
  const stringVal = String(value);
  if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')) {
    return `"${stringVal.replace(/"/g, '""')}"`;
  }
  return `"${stringVal}"`;
}

// Local Storage Keys
const STORAGE_EVENTS_KEY = 'passcraft_events_v1';
const STORAGE_PASSES_KEY = 'passcraft_passes_v1';
const STORAGE_FINANCIALS_KEY = 'passcraft_financials_v1';

export const INITIAL_FINANCIALS: any[] = [];

// Demo Showcase Packages (Loaded only on-demand from the Demo Guide Page)
export const DEMO_SHOWCASE_FINANCIALS: any[] = [
  // --- Event 1: Future Tech Summit 2026 (evt-101) ---
  {
    id: 'fin-101',
    type: 'income',
    title: 'Headline Tech Sponsor - Apex Global',
    amount: 250000,
    category: 'Corporate Sponsorship',
    date: '2026-07-20',
    eventId: 'evt-101',
    notes: 'Gold sponsorship package payment received for Future Tech Summit 2026',
    createdAt: '2026-07-20T10:00:00.000Z'
  },
  {
    id: 'fin-101-b',
    type: 'income',
    title: 'Exhibitor Booths Package - CloudCore & Veloce',
    amount: 80000,
    category: 'Exhibitor Booth Fees',
    date: '2026-07-24',
    eventId: 'evt-101',
    notes: 'Two premium 10x10 expo booth spaces reserved',
    createdAt: '2026-07-24T14:30:00.000Z'
  },
  {
    id: 'fin-102',
    type: 'expense',
    title: 'Metropolitan Center Venue Booking Deposit',
    amount: 75000,
    category: 'Venue & Hall Rental',
    date: '2026-07-22',
    eventId: 'evt-101',
    notes: 'Main Hall A reservation deposit for Future Tech Summit 2026',
    createdAt: '2026-07-22T09:00:00.000Z'
  },
  {
    id: 'fin-103',
    type: 'expense',
    title: 'AV Lighting & Sound Crew Rental',
    amount: 25000,
    category: 'Audio / Visual & Stage',
    date: '2026-07-25',
    eventId: 'evt-101',
    notes: 'Stage mic arrays, 4K LED projectors and lighting rig',
    createdAt: '2026-07-25T11:00:00.000Z'
  },
  {
    id: 'fin-104',
    type: 'expense',
    title: 'Badge Printing & Lanyard Supplies',
    amount: 12000,
    category: 'Printing & Badges',
    date: '2026-07-28',
    eventId: 'evt-101',
    notes: 'Lanyard straps and PVC cards batch for 250 delegates',
    createdAt: '2026-07-28T16:00:00.000Z'
  },
  {
    id: 'fin-105',
    type: 'expense',
    title: 'VIP Keynote Speaker Hospitality & Catering',
    amount: 32000,
    category: 'Catering & Refreshments',
    date: '2026-08-01',
    eventId: 'evt-101',
    notes: 'Networking executive lunch & morning coffee bar',
    createdAt: '2026-08-01T12:00:00.000Z'
  },

  // --- Event 2: Design & Creative Expo 2026 (evt-102) ---
  {
    id: 'fin-201',
    type: 'income',
    title: 'Creative Arts Council Innovation Grant',
    amount: 120000,
    category: 'Grants & Donations',
    date: '2026-07-15',
    eventId: 'evt-102',
    notes: 'Government cultural grant for visual arts and graphic design promotion',
    createdAt: '2026-07-15T10:00:00.000Z'
  },
  {
    id: 'fin-202',
    type: 'income',
    title: 'Adobe Design Studio Co-Sponsorship',
    amount: 90000,
    category: 'Corporate Sponsorship',
    date: '2026-07-19',
    eventId: 'evt-102',
    notes: 'Official Creative Software Sponsor branding',
    createdAt: '2026-07-19T15:00:00.000Z'
  },
  {
    id: 'fin-203',
    type: 'expense',
    title: 'Grand Art Pavilion Gallery 4 Rental',
    amount: 45000,
    category: 'Venue & Hall Rental',
    date: '2026-07-20',
    eventId: 'evt-102',
    notes: 'Full day exhibition hall and display partitions',
    createdAt: '2026-07-20T11:00:00.000Z'
  },
  {
    id: 'fin-204',
    type: 'expense',
    title: 'Digital Projection & Ambient Lighting Installation',
    amount: 28000,
    category: 'Audio / Visual & Stage',
    date: '2026-07-26',
    eventId: 'evt-102',
    notes: 'Color accurate projection mapping fixtures',
    createdAt: '2026-07-26T14:00:00.000Z'
  },
  {
    id: 'fin-205',
    type: 'expense',
    title: 'Silk Screen PVC Badges & Exhibition Catalogues',
    amount: 15000,
    category: 'Printing & Badges',
    date: '2026-07-29',
    eventId: 'evt-102',
    notes: 'High-res catalog prints and magnetic delegate badges',
    createdAt: '2026-07-29T10:30:00.000Z'
  },

  // --- Event 3: 🎓 University Tech & Innovation Fest 2026 (evt-103) ---
  {
    id: 'fin-301',
    type: 'income',
    title: 'Title Sponsor - Google Cloud & Tech Leaders',
    amount: 300000,
    category: 'Corporate Sponsorship',
    date: '2026-08-05',
    eventId: 'evt-103',
    notes: 'Title sponsorship for University Tech & Innovation Fest 2026',
    createdAt: '2026-08-05T09:30:00.000Z'
  },
  {
    id: 'fin-302',
    type: 'income',
    title: 'Hackathon Prize Pool Sponsorship',
    amount: 100000,
    category: 'Grants & Donations',
    date: '2026-08-08',
    eventId: 'evt-103',
    notes: 'Grand prize cash pool for top 3 student build projects',
    createdAt: '2026-08-08T11:15:00.000Z'
  },
  {
    id: 'fin-303',
    type: 'income',
    title: 'Food Court & Merchandise Booth Rentals',
    amount: 40000,
    category: 'Exhibitor Booth Fees',
    date: '2026-08-10',
    eventId: 'evt-103',
    notes: '4 campus food stalls and tech book store kiosk',
    createdAt: '2026-08-10T16:00:00.000Z'
  },
  {
    id: 'fin-304',
    type: 'expense',
    title: 'Grand Auditorium Stage & Acoustic Booking',
    amount: 60000,
    category: 'Venue & Hall Rental',
    date: '2026-08-06',
    eventId: 'evt-103',
    notes: 'Building A central auditorium reservation & cleaning crew',
    createdAt: '2026-08-06T10:00:00.000Z'
  },
  {
    id: 'fin-305',
    type: 'expense',
    title: 'Hackathon Gigabit Network & AV Rigging',
    amount: 35000,
    category: 'Audio / Visual & Stage',
    date: '2026-08-09',
    eventId: 'evt-103',
    notes: 'Dedicated Wi-Fi access points, power distribution, and stage screens',
    createdAt: '2026-08-09T13:45:00.000Z'
  },
  {
    id: 'fin-306',
    type: 'expense',
    title: 'Student Badges, NFC Wristbands & Welcome Kits',
    amount: 22000,
    category: 'Printing & Badges',
    date: '2026-08-11',
    eventId: 'evt-103',
    notes: 'QR identity cards and student swag packs',
    createdAt: '2026-08-11T09:00:00.000Z'
  },
  {
    id: 'fin-307',
    type: 'expense',
    title: 'Student Hackathon Meals & Energy Drinks Bar',
    amount: 45000,
    category: 'Catering & Refreshments',
    date: '2026-08-12',
    eventId: 'evt-103',
    notes: 'Lunch boxes, midnight pizza for hackers, and hydration stations',
    createdAt: '2026-08-12T12:30:00.000Z'
  }
];

export function loadFinancialsFromStorage(): any[] {
  try {
    const data = localStorage.getItem(STORAGE_FINANCIALS_KEY);
    if (data !== null) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        // Strip legacy duplicate entries and legacy automatic hardcoded demo financials (evt-101, evt-102, evt-103)
        const sanitized = parsed.filter(item => {
          if (!item) return false;
          const isAutoCreditedLegacy = item.notes && typeof item.notes === 'string' && item.notes.includes('Auto-credited upon pass assignment');
          if (isAutoCreditedLegacy) return false;
          if (item.eventId && ['evt-101', 'evt-102', 'evt-103'].includes(item.eventId)) return false;
          return true;
        });

        if (sanitized.length !== parsed.length) {
          saveFinancialsToStorage(sanitized);
        }
        return sanitized;
      }
    }
  } catch (e) {
    console.error('Failed to load financials:', e);
  }
  return [];
}

export function saveFinancialsToStorage(financials: any[]) {
  try {
    if (Array.isArray(financials)) {
      localStorage.setItem(STORAGE_FINANCIALS_KEY, JSON.stringify(financials));
    }
  } catch (e) {
    console.error('Failed to save financials:', e);
  }
}

export const INITIAL_EVENTS: EventItem[] = [];

// Sample Demo Showcase Events Data (Only loaded when explicitly requested from Demo Guide Page)
export const DEMO_SHOWCASE_EVENTS: EventItem[] = [
  {
    id: 'evt-101',
    title: 'Future Tech Summit 2026',
    date: '2026-09-15',
    time: '09:00 AM',
    commencementTime: '09:00 AM',
    endTime: '05:00 PM',
    location: 'Metropolitan Convention Center, Main Hall A',
    organizer: 'Nexus Global Tech',
    description: 'Premier annual gathering of technology leaders, developers, and innovators.',
    tagline: 'Building Tomorrow\'s Innovations Today',
    category: 'VIP Pass',
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    themeColor: '#4f46e5', // Indigo
    dressCode: 'Business Formal',
    ticketTiers: [
      { id: 'tier-101-1', categoryName: 'VIP Pass', price: 1500, color: '#eab308', description: 'Includes Keynote front-row seating and Speaker Dinner', capacity: 50 },
      { id: 'tier-101-2', categoryName: 'General Admission', price: 499, color: '#10b981', description: 'Standard summit hall access and lunch voucher', capacity: 200 },
      { id: 'tier-101-3', categoryName: 'Early Bird Pass', price: 299, color: '#06b6d4', description: 'Discounted entry for early registrations', capacity: 100 }
    ],
    status: 'active'
  },
  {
    id: 'evt-102',
    title: 'Design & Creative Expo 2026',
    date: '2026-10-04',
    time: '06:30 PM',
    commencementTime: '06:30 PM',
    endTime: '10:00 PM',
    location: 'Grand Art Pavilion, Gallery 4',
    organizer: 'Creative Arts Network',
    description: 'An immersive showcase of graphic design, UI/UX, and visual arts.',
    tagline: 'Where Creativity Meets Purpose',
    category: 'Delegate Pass',
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    themeColor: '#059669', // Emerald
    dressCode: 'Creative Cocktail',
    ticketTiers: [
      { id: 'tier-102-1', categoryName: 'VIP Delegate Pass', price: 1200, color: '#8b5cf6', description: 'Access to VIP Gallery Lounge and Artist Meet & Greet', capacity: 40 },
      { id: 'tier-102-2', categoryName: 'General Entry', price: 350, color: '#059669', description: 'Standard expo and exhibition access', capacity: 150 }
    ],
    status: 'active'
  },
  {
    id: 'evt-103',
    title: '🎓 University Tech & Innovation Fest 2026',
    date: '2026-09-28',
    time: '09:30 AM',
    commencementTime: '09:30 AM',
    endTime: '06:00 PM',
    location: 'Grand Auditorium, Tech Campus, Building A',
    organizer: 'Student Council & Tech Department',
    description: 'University Flagship Technology, Hackathon & Leadership Summit with keynote addresses, interactive workshops, and project showcases.',
    tagline: 'Annual Flagship Technology, Hackathon & Leadership Summit',
    themeColor: '#4f46e5',
    category: 'College Festival / Hackathon',
    dressCode: 'Smart Casual / College ID Mandatory',
    ticketTiers: [
      { id: 'tier-103-1', categoryName: 'VIP Delegate Pass', price: 999, color: '#eab308', description: 'Access to VIP lounges, keynote front row, and networking luncheon', capacity: 50 },
      { id: 'tier-103-2', categoryName: 'Student Early Bird', price: 299, color: '#10b981', description: 'Standard campus pass with workshop access & entry credentials', capacity: 150 }
    ],
    status: 'active',
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString()
  }
];

export const INITIAL_PASSES: PassItem[] = [];

// Sample Demo Showcase Passes (Only loaded when explicitly requested from Demo Guide Page)
export const DEMO_SHOWCASE_PASSES: PassItem[] = [
  // --- Event 1: Future Tech Summit 2026 (evt-101) ---
  {
    id: 'pass-8492019482039182',
    code16: '8492019482039182',
    formattedCode: '8492-0194-8203-9182',
    eventId: 'evt-101',
    eventName: 'Future Tech Summit 2026',
    eventDate: '2026-09-15',
    eventTime: '09:00 AM',
    commencementTime: '09:00 AM',
    endTime: '05:00 PM',
    eventLocation: 'Metropolitan Convention Center, Main Hall A',
    category: 'VIP Pass',
    ticketPrice: 1500,
    status: 'assigned',
    themeColor: '#eab308',
    assignedTo: {
      name: 'Dr. Sarah Jenkins',
      email: 'sarah.jenkins@techcorp.io',
      phone: '+1 (555) 234-5678',
      idNumber: 'EMP-9021',
      notes: 'Keynote Speaker - VIP Front Row Access',
      assignedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'pass-7193028491028475',
    code16: '7193028491028475',
    formattedCode: '7193-0284-9102-8475',
    eventId: 'evt-101',
    eventName: 'Future Tech Summit 2026',
    eventDate: '2026-09-15',
    eventTime: '09:00 AM',
    commencementTime: '09:00 AM',
    endTime: '05:00 PM',
    eventLocation: 'Metropolitan Convention Center, Main Hall A',
    category: 'VIP Pass',
    ticketPrice: 1500,
    status: 'assigned',
    themeColor: '#eab308',
    assignedTo: {
      name: 'Marcus Vance',
      email: 'm.vance@innovate.org',
      phone: '+1 (555) 876-5432',
      idNumber: 'VIP-1082',
      notes: 'All-Access Pass & Speaker Dinner',
      assignedAt: new Date(Date.now() - 86400000).toISOString(),
    },
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'pass-4920194820391829',
    code16: '4920194820391829',
    formattedCode: '4920-1948-2039-1829',
    eventId: 'evt-101',
    eventName: 'Future Tech Summit 2026',
    eventDate: '2026-09-15',
    eventTime: '09:00 AM',
    commencementTime: '09:00 AM',
    endTime: '05:00 PM',
    eventLocation: 'Metropolitan Convention Center, Main Hall A',
    category: 'General Admission',
    ticketPrice: 499,
    status: 'assigned',
    themeColor: '#10b981',
    assignedTo: {
      name: 'Priya Sharma',
      email: 'priya.sharma@apexcloud.com',
      phone: '+1 (555) 432-8765',
      idNumber: 'GEN-2041',
      notes: 'Software Engineer Attendee',
      assignedAt: new Date(Date.now() - 86400000).toISOString(),
    },
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'pass-6192840192847192',
    code16: '6192840192847192',
    formattedCode: '6192-8401-9284-7192',
    eventId: 'evt-101',
    eventName: 'Future Tech Summit 2026',
    eventDate: '2026-09-15',
    eventTime: '09:00 AM',
    commencementTime: '09:00 AM',
    endTime: '05:00 PM',
    eventLocation: 'Metropolitan Convention Center, Main Hall A',
    category: 'Early Bird Pass',
    ticketPrice: 299,
    status: 'checked_in',
    themeColor: '#06b6d4',
    assignedTo: {
      name: 'Alex Wong',
      email: 'alex.wong@devhub.io',
      phone: '+1 (555) 321-9876',
      idNumber: 'EB-8012',
      notes: 'Early registrant • Gate VIP Scanned',
      assignedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    checkedInAt: new Date().toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'pass-1049283748291029',
    code16: '1049283748291029',
    formattedCode: '1049-2837-4829-1029',
    eventId: 'evt-101',
    eventName: 'Future Tech Summit 2026',
    eventDate: '2026-09-15',
    eventTime: '09:00 AM',
    commencementTime: '09:00 AM',
    endTime: '05:00 PM',
    eventLocation: 'Metropolitan Convention Center, Main Hall A',
    category: 'General Admission',
    ticketPrice: 499,
    status: 'unassigned',
    themeColor: '#10b981',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'pass-5829104829104920',
    code16: '5829104829104920',
    formattedCode: '5829-1048-2910-4920',
    eventId: 'evt-101',
    eventName: 'Future Tech Summit 2026',
    eventDate: '2026-09-15',
    eventTime: '09:00 AM',
    commencementTime: '09:00 AM',
    endTime: '05:00 PM',
    eventLocation: 'Metropolitan Convention Center, Main Hall A',
    category: 'VIP Pass',
    ticketPrice: 1500,
    status: 'unassigned',
    themeColor: '#eab308',
    createdAt: new Date().toISOString(),
  },

  // --- Event 2: Design & Creative Expo 2026 (evt-102) ---
  {
    id: 'pass-3829104829103948',
    code16: '3829104829103948',
    formattedCode: '3829-1048-2910-3948',
    eventId: 'evt-102',
    eventName: 'Design & Creative Expo 2026',
    eventDate: '2026-10-04',
    eventTime: '06:30 PM',
    commencementTime: '06:30 PM',
    endTime: '10:00 PM',
    eventLocation: 'Grand Art Pavilion, Gallery 4',
    category: 'VIP Delegate Pass',
    ticketPrice: 1200,
    status: 'assigned',
    themeColor: '#8b5cf6',
    assignedTo: {
      name: 'Elena Rostova',
      email: 'elena.rostova@designlab.com',
      phone: '+1 (555) 432-1098',
      idNumber: 'DES-402',
      notes: 'Creative Director & Panelist',
      assignedAt: new Date(Date.now() - 86400000).toISOString(),
    },
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'pass-4829104829105820',
    code16: '4829104829105820',
    formattedCode: '4829-1048-2910-5820',
    eventId: 'evt-102',
    eventName: 'Design & Creative Expo 2026',
    eventDate: '2026-10-04',
    eventTime: '06:30 PM',
    commencementTime: '06:30 PM',
    endTime: '10:00 PM',
    eventLocation: 'Grand Art Pavilion, Gallery 4',
    category: 'General Entry',
    ticketPrice: 350,
    status: 'assigned',
    themeColor: '#059669',
    assignedTo: {
      name: 'David Miller',
      email: 'david.miller@studioart.org',
      phone: '+1 (555) 654-3210',
      idNumber: 'GEN-3012',
      notes: 'UI/UX Visual Designer',
      assignedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'pass-9201938472910283',
    code16: '9201938472910283',
    formattedCode: '9201-9384-7291-0283',
    eventId: 'evt-102',
    eventName: 'Design & Creative Expo 2026',
    eventDate: '2026-10-04',
    eventTime: '06:30 PM',
    commencementTime: '06:30 PM',
    endTime: '10:00 PM',
    eventLocation: 'Grand Art Pavilion, Gallery 4',
    category: 'General Entry',
    ticketPrice: 350,
    status: 'unassigned',
    themeColor: '#059669',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'pass-7201948301928475',
    code16: '7201948301928475',
    formattedCode: '7201-9483-0192-8475',
    eventId: 'evt-102',
    eventName: 'Design & Creative Expo 2026',
    eventDate: '2026-10-04',
    eventTime: '06:30 PM',
    commencementTime: '06:30 PM',
    endTime: '10:00 PM',
    eventLocation: 'Grand Art Pavilion, Gallery 4',
    category: 'VIP Delegate Pass',
    ticketPrice: 1200,
    status: 'unassigned',
    themeColor: '#8b5cf6',
    createdAt: new Date().toISOString(),
  },

  // --- Event 3: 🎓 University Tech & Innovation Fest 2026 (evt-103) ---
  {
    id: 'pass-demo-103-1',
    code16: '4820194820193847',
    formattedCode: '4820-1948-2019-3847',
    eventId: 'evt-103',
    eventName: '🎓 University Tech & Innovation Fest 2026',
    eventDate: '2026-09-28',
    eventTime: '09:30 AM',
    commencementTime: '09:30 AM',
    endTime: '06:00 PM',
    eventLocation: 'Grand Auditorium, Tech Campus, Building A',
    category: 'VIP Delegate Pass',
    ticketPrice: 999,
    status: 'assigned',
    themeColor: '#eab308',
    assignedTo: {
      name: 'Aarav Patel',
      email: 'aarav.patel@campus.edu',
      phone: '+1 (555) 019-1001',
      idNumber: 'STU-2026-1001',
      notes: 'Dept: Computer Science • Hackathon Lead',
      assignedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'pass-demo-103-2',
    code16: '5920194839201948',
    formattedCode: '5920-1948-3920-1948',
    eventId: 'evt-103',
    eventName: '🎓 University Tech & Innovation Fest 2026',
    eventDate: '2026-09-28',
    eventTime: '09:30 AM',
    commencementTime: '09:30 AM',
    endTime: '06:00 PM',
    eventLocation: 'Grand Auditorium, Tech Campus, Building A',
    category: 'Student Early Bird',
    ticketPrice: 299,
    status: 'assigned',
    themeColor: '#10b981',
    assignedTo: {
      name: 'Ananya Deshmukh',
      email: 'ananya.deshmukh@campus.edu',
      phone: '+1 (555) 019-1002',
      idNumber: 'STU-2026-1002',
      notes: 'Dept: Data Science & AI • AI Workshop',
      assignedAt: new Date(Date.now() - 86400000).toISOString(),
    },
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'pass-demo-103-3',
    code16: '7102938472910394',
    formattedCode: '7102-9384-7291-0394',
    eventId: 'evt-103',
    eventName: '🎓 University Tech & Innovation Fest 2026',
    eventDate: '2026-09-28',
    eventTime: '09:30 AM',
    commencementTime: '09:30 AM',
    endTime: '06:00 PM',
    eventLocation: 'Grand Auditorium, Tech Campus, Building A',
    category: 'VIP Delegate Pass',
    ticketPrice: 999,
    status: 'checked_in',
    themeColor: '#eab308',
    assignedTo: {
      name: 'Liam Wilson',
      email: 'liam.wilson@campus.edu',
      phone: '+1 (555) 019-1003',
      idNumber: 'STU-2026-1003',
      notes: 'Dept: Electrical Engineering • Keynote Speaker Access',
      assignedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    checkedInAt: new Date().toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'pass-demo-103-4',
    code16: '8201948201948201',
    formattedCode: '8201-9482-0194-8201',
    eventId: 'evt-103',
    eventName: '🎓 University Tech & Innovation Fest 2026',
    eventDate: '2026-09-28',
    eventTime: '09:30 AM',
    commencementTime: '09:30 AM',
    endTime: '06:00 PM',
    eventLocation: 'Grand Auditorium, Tech Campus, Building A',
    category: 'Student Early Bird',
    ticketPrice: 299,
    status: 'assigned',
    themeColor: '#10b981',
    assignedTo: {
      name: 'Sophia Martinez',
      email: 'sophia.martinez@campus.edu',
      phone: '+1 (555) 019-1004',
      idNumber: 'STU-2026-1004',
      notes: 'Dept: Biotechnology',
      assignedAt: new Date(Date.now() - 86400000).toISOString(),
    },
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'pass-demo-103-5',
    code16: '9301948201948291',
    formattedCode: '9301-9482-0194-8291',
    eventId: 'evt-103',
    eventName: '🎓 University Tech & Innovation Fest 2026',
    eventDate: '2026-09-28',
    eventTime: '09:30 AM',
    commencementTime: '09:30 AM',
    endTime: '06:00 PM',
    eventLocation: 'Grand Auditorium, Tech Campus, Building A',
    category: 'Student Early Bird',
    ticketPrice: 299,
    status: 'unassigned',
    themeColor: '#10b981',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'pass-demo-103-6',
    code16: '1948201948201948',
    formattedCode: '1948-2019-4820-1948',
    eventId: 'evt-103',
    eventName: '🎓 University Tech & Innovation Fest 2026',
    eventDate: '2026-09-28',
    eventTime: '09:30 AM',
    commencementTime: '09:30 AM',
    endTime: '06:00 PM',
    eventLocation: 'Grand Auditorium, Tech Campus, Building A',
    category: 'VIP Delegate Pass',
    ticketPrice: 999,
    status: 'unassigned',
    themeColor: '#eab308',
    createdAt: new Date().toISOString(),
  }
];

export function loadEventsFromStorage(): EventItem[] {
  try {
    const data = localStorage.getItem(STORAGE_EVENTS_KEY);
    if (data !== null) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        // Strip out legacy automatic hardcoded demo seeds (evt-101, evt-102, evt-103)
        // Demo events are ONLY generated when explicitly requested from the Demo Guide Page.
        const userEvents = parsed.filter((e: any) => e && e.id && !['evt-101', 'evt-102', 'evt-103'].includes(e.id));
        if (userEvents.length !== parsed.length) {
          saveEventsToStorage(userEvents);
        }
        return userEvents;
      }
    }
  } catch (e) {
    console.error('Failed to load events:', e);
  }
  return [];
}

export function saveEventsToStorage(events: EventItem[]) {
  try {
    if (Array.isArray(events)) {
      localStorage.setItem(STORAGE_EVENTS_KEY, JSON.stringify(events));
    }
  } catch (e) {
    console.error('Failed to save events:', e);
  }
}

export function loadPassesFromStorage(): PassItem[] {
  try {
    const data = localStorage.getItem(STORAGE_PASSES_KEY);
    if (data !== null) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        // Strip out legacy automatic hardcoded demo passes for evt-101, evt-102, evt-103
        const userPasses = parsed.filter((p: any) => p && (!p.eventId || !['evt-101', 'evt-102', 'evt-103'].includes(p.eventId)));
        if (userPasses.length !== parsed.length) {
          savePassesToStorage(userPasses);
        }
        return userPasses;
      }
    }
  } catch (e) {
    console.error('Failed to load passes:', e);
  }
  return [];
}

export function savePassesToStorage(passes: PassItem[]) {
  try {
    if (Array.isArray(passes)) {
      localStorage.setItem(STORAGE_PASSES_KEY, JSON.stringify(passes));
    }
  } catch (e) {
    console.error('Failed to save passes:', e);
  }
}
