import { EmailDispatchHistoryItem, DispatchChannelType } from '../types';

const STORAGE_KEY = 'passcraft_email_dispatch_history_v1';
export const DISPATCH_HISTORY_UPDATED_EVENT = 'passcraft_dispatch_history_updated';

// Realistic initial seed batches across all 3 tools (sorted newest to oldest)
const INITIAL_SEED_HISTORY: EmailDispatchHistoryItem[] = [
  {
    id: 'disp-seed-3',
    type: 'thank_you',
    sourceLabel: 'Thank You & Recap Bomber',
    eventId: 'evt-1',
    eventName: 'Global Tech Leaders Summit 2026',
    subject: '❤️ Thank You for Attending Global Tech Leaders Summit 2026! | Highlights & Feedback',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    senderEmail: 'desk@passcraft.events',
    senderName: 'PassCraft Event Desk',
    totalRecipients: 3,
    sentCount: 3,
    failedCount: 0,
    status: 'completed',
    summary: 'Sent post-event gratitude letter, official photo gallery link, feedback survey, and keynotes archive.',
    details: {
      headline: 'THANK YOU FOR AN UNFORGETTABLE EXPERIENCE!',
      highlights: [
        'Over 750+ delegates and innovators gathered under one roof',
        'Inspiring keynote sessions and collaborative workshops',
        'Groundbreaking connections and memorable conversations'
      ],
      hasGallery: true,
      hasSurvey: true,
      hasCertificate: true,
      hasRecording: true
    },
    recipients: [
      {
        attendeeName: 'Elena Rostova',
        email: 'elena.rostova@techinnovate.com',
        status: 'sent',
        category: 'VIP Pass',
        sentAt: new Date(Date.now() - 3600000 * 2).toLocaleTimeString()
      },
      {
        attendeeName: 'Marcus Vance',
        email: 'marcus.vance@vanceindustries.com',
        status: 'sent',
        category: 'VIP Pass',
        sentAt: new Date(Date.now() - 3600000 * 2).toLocaleTimeString()
      },
      {
        attendeeName: 'Priya Sharma',
        email: 'priya.s@cloudscale.net',
        status: 'sent',
        category: 'General Admission',
        sentAt: new Date(Date.now() - 3600000 * 2).toLocaleTimeString()
      }
    ]
  },
  {
    id: 'disp-seed-2',
    type: 'rules_bomber',
    sourceLabel: 'Rules Bomber (Guidelines & Entry Rules)',
    eventId: 'evt-1',
    eventName: 'Global Tech Leaders Summit 2026',
    subject: '⚠️ Mandatory Entry Rules & Security Guidelines: Global Tech Leaders Summit 2026',
    timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
    senderEmail: 'security@techsummit.io',
    senderName: 'Tech Summit Security & Gate Desk',
    totalRecipients: 4,
    sentCount: 4,
    failedCount: 0,
    status: 'completed',
    summary: 'Broadcasted dress code policies, prohibited items, fast-track lane requirements, and ID verification protocol.',
    details: {
      headline: 'OFFICIAL VENUE ADVISORY & CODE OF CONDUCT',
      allowedCount: 4,
      prohibitedCount: 4
    },
    recipients: [
      {
        attendeeName: 'Elena Rostova',
        email: 'elena.rostova@techinnovate.com',
        status: 'sent',
        category: 'VIP Pass',
        sentAt: new Date(Date.now() - 3600000 * 24).toLocaleTimeString()
      },
      {
        attendeeName: 'Marcus Vance',
        email: 'marcus.vance@vanceindustries.com',
        status: 'sent',
        category: 'VIP Pass',
        sentAt: new Date(Date.now() - 3600000 * 24).toLocaleTimeString()
      },
      {
        attendeeName: 'Priya Sharma',
        email: 'priya.s@cloudscale.net',
        status: 'sent',
        category: 'General Admission',
        sentAt: new Date(Date.now() - 3600000 * 24).toLocaleTimeString()
      },
      {
        attendeeName: 'David Chen',
        email: 'david.chen@horizonlabs.io',
        status: 'sent',
        category: 'General Admission',
        sentAt: new Date(Date.now() - 3600000 * 24).toLocaleTimeString()
      }
    ]
  },
  {
    id: 'disp-seed-1',
    type: 'pass_bomber',
    sourceLabel: 'Pass Bomber (Pass Tickets)',
    eventId: 'evt-1',
    eventName: 'Global Tech Leaders Summit 2026',
    subject: '🎟️ Your Official Pass & Access QR: Global Tech Leaders Summit 2026',
    timestamp: new Date(Date.now() - 3600000 * 48).toISOString(),
    senderEmail: 'operations@techsummit.io',
    senderName: 'Tech Summit Desk',
    totalRecipients: 4,
    sentCount: 4,
    failedCount: 0,
    status: 'completed',
    summary: 'Dispatched VIP & Delegate digital passes with secure 16-digit access code and dynamic QR attachments.',
    details: {
      headline: 'OFFICIAL ACCESS CREDENTIAL',
      displayMode: 'both',
      ticketTier: 'VIP & Executive Passes'
    },
    recipients: [
      {
        attendeeName: 'Elena Rostova',
        email: 'elena.rostova@techinnovate.com',
        status: 'sent',
        code16: '4920194820391823',
        formattedCode: '4920-1948-2039-1823',
        category: 'VIP Pass',
        sentAt: new Date(Date.now() - 3600000 * 48).toLocaleTimeString()
      },
      {
        attendeeName: 'Marcus Vance',
        email: 'marcus.vance@vanceindustries.com',
        status: 'sent',
        code16: '5819382910492817',
        formattedCode: '5819-3829-1049-2817',
        category: 'VIP Pass',
        sentAt: new Date(Date.now() - 3600000 * 48).toLocaleTimeString()
      },
      {
        attendeeName: 'Priya Sharma',
        email: 'priya.s@cloudscale.net',
        status: 'sent',
        code16: '9182736451029384',
        formattedCode: '9182-7364-5102-9384',
        category: 'General Admission',
        sentAt: new Date(Date.now() - 3600000 * 48).toLocaleTimeString()
      },
      {
        attendeeName: 'David Chen',
        email: 'david.chen@horizonlabs.io',
        status: 'sent',
        code16: '7362910482739102',
        formattedCode: '7362-9104-8273-9102',
        category: 'General Admission',
        sentAt: new Date(Date.now() - 3600000 * 48).toLocaleTimeString()
      }
    ]
  }
];

export const getDispatchHistory = (): EmailDispatchHistoryItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      }
    }
  } catch (e) {
    console.error('Failed to load dispatch history from localStorage:', e);
  }

  // Fallback to seed data
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SEED_HISTORY));
  } catch (e) {}
  return INITIAL_SEED_HISTORY;
};

export const recordDispatchHistory = (
  item: Omit<EmailDispatchHistoryItem, 'id' | 'timestamp'> & { id?: string; timestamp?: string }
): EmailDispatchHistoryItem => {
  const current = getDispatchHistory();
  const newItem: EmailDispatchHistoryItem = {
    ...item,
    id: item.id || `disp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: item.timestamp || new Date().toISOString(),
    status: item.failedCount === 0 ? 'completed' : item.sentCount === 0 ? 'failed' : 'partial'
  };

  const updated = [newItem, ...current];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(DISPATCH_HISTORY_UPDATED_EVENT, { detail: newItem }));
    }
  } catch (e) {
    console.error('Failed to save dispatch history to localStorage:', e);
  }

  return newItem;
};

export const deleteDispatchHistoryItem = (id: string): EmailDispatchHistoryItem[] => {
  const current = getDispatchHistory();
  const updated = current.filter(item => item.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(DISPATCH_HISTORY_UPDATED_EVENT));
    }
  } catch (e) {}
  return updated;
};

export const deleteRecipientLog = (batchId: string, email: string): EmailDispatchHistoryItem[] => {
  const current = getDispatchHistory();
  const updated = current.map(item => {
    if (item.id === batchId) {
      const remainingRecipients = item.recipients.filter(r => r.email !== email);
      const sentCount = remainingRecipients.filter(r => r.status === 'sent').length;
      const failedCount = remainingRecipients.filter(r => r.status === 'failed').length;
      return {
        ...item,
        totalRecipients: remainingRecipients.length,
        sentCount,
        failedCount,
        recipients: remainingRecipients
      };
    }
    return item;
  }).filter(item => item.recipients.length > 0);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(DISPATCH_HISTORY_UPDATED_EVENT));
    }
  } catch (e) {}
  return updated;
};

export const clearAllDispatchHistory = (): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(DISPATCH_HISTORY_UPDATED_EVENT));
    }
  } catch (e) {}
};

export const exportDispatchHistoryToCsv = (items: EmailDispatchHistoryItem[]): string => {
  const headers = ['Batch ID', 'Channel', 'Event Name', 'Subject', 'Timestamp', 'Sender Email', 'Sender Name', 'Attendee Name', 'Attendee Email', 'Pass Category', 'Delivery Status', 'Error'];
  const rows: string[] = [];

  rows.push(headers.join(','));

  items.forEach(batch => {
    const formattedDate = new Date(batch.timestamp).toLocaleString();
    batch.recipients.forEach(r => {
      const row = [
        `"${batch.id}"`,
        `"${batch.sourceLabel}"`,
        `"${(batch.eventName || '').replace(/"/g, '""')}"`,
        `"${(batch.subject || '').replace(/"/g, '""')}"`,
        `"${formattedDate}"`,
        `"${batch.senderEmail}"`,
        `"${(batch.senderName || '').replace(/"/g, '""')}"`,
        `"${(r.attendeeName || '').replace(/"/g, '""')}"`,
        `"${r.email}"`,
        `"${(r.category || '').replace(/"/g, '""')}"`,
        `"${r.status}"`,
        `"${(r.error || '').replace(/"/g, '""')}"`
      ];
      rows.push(row.join(','));
    });
  });

  return rows.join('\n');
};
