export type PassStatus = 'unassigned' | 'assigned' | 'checked_in';

export interface TicketTierConfig {
  id?: string;
  categoryName: string;
  price: number;
  color?: string;
  description?: string;
  capacity?: number;
}

export interface EventItem {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD (Start Date)
  durationDays?: number; // Number of days (e.g. 1, 2, 3...)
  endDate?: string; // YYYY-MM-DD for multi-day events
  eventDates?: string[]; // Array of YYYY-MM-DD dates for multi-day events
  time: string; // HH:MM or commencement time
  commencementTime?: string; // Entry Commencement Time (e.g. "10:00 AM")
  endTime?: string; // Event End Time (e.g. "06:00 PM")
  location: string;
  organizer: string;
  description: string;
  tagline: string;
  category: string; // e.g. 'VIP', 'General', 'Press', 'Speaker', 'Staff'
  createdAt: string;
  themeColor: string; // Hex color code
  status?: 'active' | 'ended'; // Active or Completed/Ended event status
  endedAt?: string; // Timestamp when event was ended
  dressCode?: string;
  ticketTiers?: TicketTierConfig[];
  gates?: EventGateConfig[];
}

export interface AssignedDetails {
  name: string;
  email?: string;
  phone?: string;
  idNumber?: string;
  notes?: string;
  assignedAt: string;
}

export type PassSecurityStatus = 'none' | 'lost' | 'stolen' | 'deactivated' | 'voided';

export interface EventGateConfig {
  id: string;
  name: string; // e.g. "Gate 1 - General / Outer Entry", "Gate 2 - Gold Zone", "Gate 3 - VIP Red Carpet"
  code?: string; // e.g. "G1", "G2", "VIP"
  description?: string;
  allowedCategories: string[]; // e.g. ['all'] or ['VIP', 'Gold', 'Silver']
  color?: string; // Hex color for gate indicator
  order?: number; // Sequence order (e.g. 1 -> 2 -> 3)
  isCheckpoint?: boolean; // If true, scanning here allows re-scanning at inner gates
  requiredPreviousGateId?: string; // Optional prerequisite gate
}

export interface GateEntryRecord {
  id: string;
  passId: string;
  code16: string;
  formattedCode: string;
  eventId: string;
  eventName: string;
  attendeeName: string;
  attendeeEmail?: string;
  attendeePhone?: string;
  attendeeIdNumber?: string;
  ticketCategory: string;
  ticketPrice?: number;
  entryTimestamp: string; // ISO string e.g. 2026-08-25T14:32:05.123Z
  dateSession: string; // e.g. "2026-08-25" or "single_event"
  sessionLabel: string; // e.g. "Day 1 (Aug 25)", "Overnight Single Event"
  gateId?: string;
  gateName?: string;
  operatorName?: string;
  status: 'admitted' | 'duplicate_denied' | 'security_denied' | 'wrong_gate_denied';
  notes?: string;
}

export interface PassItem {
  id: string;
  code16: string; // Raw 16 digits e.g. "4920194820391823"
  formattedCode: string; // Formatted e.g. "4920-1948-2039-1823"
  eventId: string;
  eventName: string;
  eventDate: string;
  eventTime: string;
  commencementTime?: string;
  endTime?: string;
  eventLocation: string;
  category: string;
  ticketPrice?: number; // Price of this ticket in USD / currency
  status: PassStatus;
  themeColor: string;
  assignedTo?: AssignedDetails;
  checkedInAt?: string;
  checkedInSession?: string;
  createdAt: string;
  // Gate Security & Status Flags
  securityFlag?: PassSecurityStatus;
  securityNotes?: string;
  securityFlaggedAt?: string;
  securityFlaggedBy?: string;
  entryHistory?: GateEntryRecord[];
}

export interface FinancialEntry {
  id: string;
  type: 'income' | 'expense';
  title: string;
  amount: number;
  category: string; // e.g. 'Ticket Sales', 'Sponsorship', 'Venue', 'Catering', 'Marketing', 'Audio/Visual'
  date: string;
  time?: string;
  createdAt?: string;
  vendorName?: string;
  vendorPhone?: string;
  isAutomaticTicketSale?: boolean;
  passId?: string;
  eventId?: string;
  notes?: string;
}

export type DispatchChannelType = 'pass_bomber' | 'rules_bomber' | 'thank_you';

export interface RecipientDispatchLog {
  attendeeName: string;
  email: string;
  status: 'sent' | 'failed';
  error?: string;
  code16?: string;
  formattedCode?: string;
  category?: string;
  sentAt?: string;
}

export interface EmailDispatchHistoryItem {
  id: string;
  type: DispatchChannelType;
  sourceLabel: string;
  eventId?: string;
  eventName: string;
  subject: string;
  timestamp: string; // ISO string
  senderEmail: string;
  senderName: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  status: 'completed' | 'partial' | 'failed';
  summary?: string;
  details?: {
    headline?: string;
    highlights?: string[];
    allowedCount?: number;
    prohibitedCount?: number;
    hasSurvey?: boolean;
    hasGallery?: boolean;
    hasCertificate?: boolean;
    hasRecording?: boolean;
    displayMode?: string;
    ticketTier?: string;
  };
  recipients: RecipientDispatchLog[];
}

export type ActiveTab = 'events' | 'generator' | 'gate_scanner' | 'scanner' | 'passes' | 'assigned' | 'unassigned' | 'docs' | 'designer' | 'financials' | 'email_tickets' | 'rules_bomber' | 'thank_you' | 'google_docs' | 'google_forms';

export type UserRole = 'owner' | 'organizer' | 'client_viewer' | 'gate_operator';

export interface DeviceSession {
  id: string;
  deviceName: string;
  location: string;
  lastPing: string;
  isCurrentDevice?: boolean;
  userAgent?: string;
  role?: UserRole;
  allowedEventId?: string; // 'all' or specific eventId
  accessCodeUsed?: string;
  revoked?: boolean;
  revokedAt?: string;
}

export interface QuickAccessCode {
  id: string;
  code: string;
  role: UserRole;
  targetLocation: string; // e.g. "Bangalore Client Office", "Hyderabad Gate 1"
  targetLabel: string; // e.g. "Bangalore Client Live Viewer", "Gate 1 Turnstile"
  allowedEventId: string; // 'all' or specific event ID
  allowedEventTitle?: string;
  createdAt: string;
  createdByEmail: string;
  expiresAt?: string;
  useCount: number;
  isActive: boolean;
  notes?: string;
}

export interface UserAccountProfile {
  email: string;
  passwordHash?: string;
  displayName?: string;
  role?: UserRole;
  createdAt: string;
  lastActiveAt: string;
}

export interface CurrentUserSession {
  email: string;
  role: UserRole;
  isOwner: boolean;
  allowedEventId: string; // 'all' or specific event ID
  allowedEventTitle?: string;
  deviceLocation: string;
  deviceLabel: string;
  accessCodeUsed?: string;
}

