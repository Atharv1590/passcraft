import { EventItem, PassItem, FinancialEntry } from '../types';
import { getPassGatesUsed } from './passUtils';

export interface CreatedDocResult {
  documentId: string;
  title: string;
  docType: 'printable_passes' | 'executive_report' | 'attendee_roster' | 'custom';
  eventId?: string;
  eventTitle?: string;
  docUrl: string;
  createdAt: string;
  itemCount?: number;
}

export class GoogleDocsAuthError extends Error {
  isAuthError: boolean = true;
  status: number;
  constructor(message: string, status: number = 401) {
    super(message);
    this.name = 'GoogleDocsAuthError';
    this.status = status;
  }
}

async function handleDocsApiResponse(response: Response, actionDesc: string) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `${actionDesc} failed (${response.status})`;
    const isAuthError = 
      response.status === 401 || 
      response.status === 403 || 
      message.toLowerCase().includes('invalid authentication credentials') ||
      message.toLowerCase().includes('oauth 2 access token') ||
      message.toLowerCase().includes('unauthenticated') ||
      message.toLowerCase().includes('permission denied');
    
    if (isAuthError) {
      throw new GoogleDocsAuthError(message, response.status);
    }
    throw new Error(message);
  }
  return response.json();
}

export function extractDocumentId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const clean = urlOrId.trim();
  const match = clean.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  if (/^[a-zA-Z0-9-_]{15,}$/.test(clean)) {
    return clean;
  }
  return null;
}

export interface DocSectionStyle {
  color?: { red: number; green: number; blue: number };
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  fontFamily?: string;
}

/**
 * Rich Google Docs Document Builder with Obsidian Black Background & Luxury Accent Styling
 */
export class RichDocBuilder {
  private content: string = '';
  private styleRanges: { startIndex: number; endIndex: number; style: DocSectionStyle }[] = [];

  append(text: string, style?: DocSectionStyle) {
    if (!text) return;
    const startIndex = this.content.length + 1; // Google Docs API is 1-indexed
    this.content += text;
    const endIndex = this.content.length + 1;

    if (style && text.trim().length > 0) {
      this.styleRanges.push({ startIndex, endIndex, style });
    }
  }

  getText(): string {
    return this.content;
  }

  buildBatchRequests(): any[] {
    const requests: any[] = [];

    // 1. True Obsidian Black Background (#07080B) with spacious margins
    requests.push({
      updateDocumentStyle: {
        documentStyle: {
          background: {
            color: {
              color: {
                rgbColor: { red: 0.04, green: 0.04, blue: 0.06 },
              },
            },
          },
          marginTop: { magnitude: 36, unit: 'PT' },
          marginBottom: { magnitude: 36, unit: 'PT' },
          marginLeft: { magnitude: 40, unit: 'PT' },
          marginRight: { magnitude: 40, unit: 'PT' },
        },
        fields: 'background,marginTop,marginBottom,marginLeft,marginRight',
      },
    });

    // 2. Base Document Foreground: Crisp Platinum White for high contrast readability
    requests.push({
      updateTextStyle: {
        range: {
          startIndex: 1,
          endIndex: this.content.length + 1,
        },
        textStyle: {
          foregroundColor: {
            color: {
              rgbColor: { red: 0.92, green: 0.94, blue: 0.98 },
            },
          },
          fontSize: { magnitude: 10, unit: 'PT' },
        },
        fields: 'foregroundColor,fontSize',
      },
    });

    // 3. Apply Section and Token Styling (Gold titles, Emerald sections, Cyan codes, Violet tags)
    for (const item of this.styleRanges) {
      const textStyle: any = {};
      const fields: string[] = [];

      if (item.style.color) {
        textStyle.foregroundColor = { color: { rgbColor: item.style.color } };
        fields.push('foregroundColor');
      }
      if (item.style.fontSize) {
        textStyle.fontSize = { magnitude: item.style.fontSize, unit: 'PT' };
        fields.push('fontSize');
      }
      if (item.style.bold !== undefined) {
        textStyle.bold = item.style.bold;
        fields.push('bold');
      }
      if (item.style.italic !== undefined) {
        textStyle.italic = item.style.italic;
        fields.push('italic');
      }
      if (item.style.fontFamily) {
        textStyle.weightedFontFamily = { fontFamily: item.style.fontFamily };
        fields.push('weightedFontFamily');
      }

      if (fields.length > 0) {
        requests.push({
          updateTextStyle: {
            range: {
              startIndex: item.startIndex,
              endIndex: item.endIndex,
            },
            textStyle,
            fields: fields.join(','),
          },
        });
      }
    }

    return requests;
  }
}

/**
 * Safely inserts content into a Google Doc and applies Obsidian Black theme & font colors
 */
async function applyDocumentContentAndStyles(
  documentId: string,
  accessToken: string,
  builder: RichDocBuilder
) {
  const fullText = builder.getText();

  // Step 1: Insert all text into document
  const insertRes = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: fullText,
          },
        },
      ],
    }),
  });
  await handleDocsApiResponse(insertRes, 'Writing Content to Google Doc');

  // Step 2: Apply Obsidian Black background and rich typography styles
  try {
    const styleRequests = builder.buildBatchRequests();
    const styleRes = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests: styleRequests }),
    });

    if (!styleRes.ok) {
      console.warn('Advanced text styles failed, applying base dark theme fallback...');
      // Fallback: Apply black background and white text
      await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              updateDocumentStyle: {
                documentStyle: {
                  background: {
                    color: {
                      color: {
                        rgbColor: { red: 0.04, green: 0.04, blue: 0.06 },
                      },
                    },
                  },
                },
                fields: 'background',
              },
            },
            {
              updateTextStyle: {
                range: {
                  startIndex: 1,
                  endIndex: fullText.length + 1,
                },
                textStyle: {
                  foregroundColor: {
                    color: {
                      rgbColor: { red: 0.95, green: 0.95, blue: 0.98 },
                    },
                  },
                },
                fields: 'foregroundColor',
              },
            },
          ],
        }),
      });
    }
  } catch (styleErr) {
    console.warn('Dark style application warning:', styleErr);
  }
}

/**
 * Creates a blank Google Doc with Obsidian Black background
 */
export async function createBlankGoogleDoc(
  title: string,
  accessToken: string
): Promise<CreatedDocResult> {
  const response = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: title.trim() || `PassCraft Document - ${new Date().toLocaleDateString()}`,
    }),
  });

  const docData = await handleDocsApiResponse(response, 'Creating Google Doc');
  const documentId = docData.documentId;
  const docUrl = `https://docs.google.com/document/d/${documentId}/edit`;

  // Apply dark background styling to blank doc
  try {
    await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            updateDocumentStyle: {
              documentStyle: {
                background: {
                  color: {
                    color: {
                      rgbColor: { red: 0.04, green: 0.04, blue: 0.06 },
                    },
                  },
                },
                marginTop: { magnitude: 36, unit: 'PT' },
                marginBottom: { magnitude: 36, unit: 'PT' },
                marginLeft: { magnitude: 40, unit: 'PT' },
                marginRight: { magnitude: 40, unit: 'PT' },
              },
              fields: 'background,marginTop,marginBottom,marginLeft,marginRight',
            },
          },
        ],
      }),
    });
  } catch (err) {
    console.warn('Could not set dark background on blank doc:', err);
  }

  return {
    documentId,
    title: docData.title || title,
    docType: 'custom',
    docUrl,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Creates a richly formatted "Printable Passes & Badge Sheets" Google Doc with Obsidian Black Theme
 */
export async function createEventPrintablePassesDoc(
  event: EventItem | undefined,
  passes: PassItem[],
  accessToken: string,
  options?: { customTitle?: string; includeUnassigned?: boolean }
): Promise<CreatedDocResult> {
  const eventTitle = event?.title || 'Event Passes';
  const docTitle = options?.customTitle || `${eventTitle} - Printable QR Passes & Badges`;
  
  const initialDoc = await createBlankGoogleDoc(docTitle, accessToken);
  const documentId = initialDoc.documentId;

  const targetPasses = options?.includeUnassigned ? passes : passes.filter(p => p.status === 'assigned' || p.status === 'checked_in');
  const passesToPrint = targetPasses.length > 0 ? targetPasses : passes;

  const builder = new RichDocBuilder();

  // Title Banner (Luxury Amber Gold)
  builder.append(`PASSCRAFT OFFICIAL PASS DIRECTORY & BADGE MANIFEST\n`, {
    color: { red: 1.0, green: 0.8, blue: 0.28 },
    fontSize: 18,
    bold: true,
  });
  builder.append(`${docTitle.toUpperCase()}\n`, {
    color: { red: 0.95, green: 0.96, blue: 1.0 },
    fontSize: 13,
    bold: true,
  });
  builder.append(`Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()} • Certified Cryptographic Event Record\n\n`, {
    color: { red: 0.58, green: 0.64, blue: 0.76 },
    fontSize: 9,
    italic: true,
  });

  // Event Profile (Electric Emerald)
  if (event) {
    builder.append(`EVENT PROFILE & VENUE\n`, {
      color: { red: 0.2, green: 0.88, blue: 0.58 },
      fontSize: 12,
      bold: true,
    });
    builder.append(`Event Title: `, { color: { red: 0.7, green: 0.75, blue: 0.85 }, bold: true });
    builder.append(`${event.title}\n`, { color: { red: 1.0, green: 1.0, blue: 1.0 }, bold: true });

    builder.append(`Date & Time: `, { color: { red: 0.7, green: 0.75, blue: 0.85 }, bold: true });
    builder.append(`${event.date} ${event.commencementTime ? `• Starts: ${event.commencementTime}` : ''} ${event.endTime ? `• Ends: ${event.endTime}` : ''}\n`, { color: { red: 0.9, green: 0.92, blue: 0.96 } });

    builder.append(`Location / Venue: `, { color: { red: 0.7, green: 0.75, blue: 0.85 }, bold: true });
    builder.append(`${event.location}\n`, { color: { red: 0.9, green: 0.92, blue: 0.96 } });

    builder.append(`Organizer: `, { color: { red: 0.7, green: 0.75, blue: 0.85 }, bold: true });
    builder.append(`${event.organizer || 'PassCraft Event Command'}\n`, { color: { red: 0.9, green: 0.92, blue: 0.96 } });

    if (event.dressCode) {
      builder.append(`Dress Code: `, { color: { red: 0.7, green: 0.75, blue: 0.85 }, bold: true });
      builder.append(`${event.dressCode}\n`, { color: { red: 0.9, green: 0.92, blue: 0.96 } });
    }
    builder.append(`\n----------------------------------------------------------------------------------------------------\n\n`, {
      color: { red: 0.25, green: 0.28, blue: 0.38 },
    });
  }

  // Section Header (Electric Sky Cyan)
  builder.append(`ATTENDEE PASS DIRECTORY (${passesToPrint.length} PASSES)\n\n`, {
    color: { red: 0.28, green: 0.76, blue: 0.98 },
    fontSize: 12.5,
    bold: true,
  });

  passesToPrint.forEach((p, idx) => {
    const attendeeName = p.assignedTo?.name || (p.status === 'unassigned' ? '[Unassigned Pass]' : 'Attendee');
    const attendeeEmail = p.assignedTo?.email || 'N/A';
    const attendeePhone = p.assignedTo?.phone || 'N/A';
    const statusText = p.status === 'checked_in' ? 'CHECKED-IN / ADMITTED' : p.status === 'assigned' ? 'ASSIGNED & READY' : 'UNASSIGNED';

    // Tier badge (Neon Violet)
    builder.append(`[PASS #${idx + 1}]  ${p.category.toUpperCase()} TIER\n`, {
      color: { red: 0.76, green: 0.48, blue: 0.98 },
      fontSize: 11,
      bold: true,
    });

    builder.append(`Attendee: `, { color: { red: 0.7, green: 0.75, blue: 0.85 }, bold: true });
    builder.append(`${attendeeName}\n`, { color: { red: 1.0, green: 1.0, blue: 1.0 }, bold: true });

    builder.append(`Contact: `, { color: { red: 0.7, green: 0.75, blue: 0.85 }, bold: true });
    builder.append(`Email: ${attendeeEmail} | Phone: ${attendeePhone}\n`, { color: { red: 0.85, green: 0.88, blue: 0.94 } });

    builder.append(`16-Digit Pass Code: `, { color: { red: 0.7, green: 0.75, blue: 0.85 }, bold: true });
    // Monospace glowing Amber Code
    builder.append(`${p.formattedCode} (Raw: ${p.code16})\n`, {
      color: { red: 1.0, green: 0.82, blue: 0.2 },
      fontSize: 11,
      bold: true,
    });

    builder.append(`Status: `, { color: { red: 0.7, green: 0.75, blue: 0.85 }, bold: true });
    builder.append(`${statusText}\n`, {
      color: p.status === 'checked_in' ? { red: 0.2, green: 0.88, blue: 0.58 } : { red: 0.28, green: 0.76, blue: 0.98 },
      bold: true,
    });

    builder.append(`Verify / Live Scan URL: `, { color: { red: 0.7, green: 0.75, blue: 0.85 }, bold: true });
    builder.append(`https://passcraft.app/verify/${p.code16}\n`, {
      color: { red: 0.38, green: 0.82, blue: 0.98 },
    });

    builder.append(`----------------------------------------------------------------------------------------------------\n\n`, {
      color: { red: 0.22, green: 0.25, blue: 0.34 },
    });
  });

  // Security Notice
  builder.append(`SECURITY PROTOCOL NOTICE:\n`, {
    color: { red: 1.0, green: 0.45, blue: 0.45 },
    bold: true,
    fontSize: 10,
  });
  builder.append(`Each badge is cryptographically linked to a 16-digit security token verified in real-time at event gate turnstiles. Duplicated, altered, or voided badges will be automatically rejected.\n`, {
    color: { red: 0.6, green: 0.65, blue: 0.75 },
    fontSize: 9,
    italic: true,
  });

  await applyDocumentContentAndStyles(documentId, accessToken, builder);

  return {
    documentId,
    title: docTitle,
    docType: 'printable_passes',
    eventId: event?.id,
    eventTitle: event?.title,
    docUrl: initialDoc.docUrl,
    createdAt: new Date().toISOString(),
    itemCount: passesToPrint.length,
  };
}

/**
 * Builds standard formatted text for Executive Brief & Financial Summary
 */
export function buildExecutiveReportText(
  event: EventItem | undefined,
  passes: PassItem[],
  financials: FinancialEntry[]
): string {
  const eventPasses = event ? passes.filter(p => p.eventId === event.id) : passes;
  const eventFinancials = event ? financials.filter(f => !f.eventId || f.eventId === event.id) : financials;

  const totalPasses = eventPasses.length;
  const assignedPasses = eventPasses.filter(p => p.status === 'assigned' || p.status === 'checked_in').length;
  const checkedInPasses = eventPasses.filter(p => p.status === 'checked_in').length;
  const unassignedPasses = eventPasses.filter(p => p.status === 'unassigned').length;
  const checkInRate = assignedPasses > 0 ? Math.round((checkedInPasses / assignedPasses) * 100) : 0;

  const totalIncome = eventFinancials.filter(f => f.type === 'income').reduce((sum, f) => sum + (f.amount || 0), 0);
  const totalExpense = eventFinancials.filter(f => f.type === 'expense').reduce((sum, f) => sum + (f.amount || 0), 0);
  const netProfit = totalIncome - totalExpense;

  const lines: string[] = [];
  lines.push(`EXECUTIVE BRIEF & POST-EVENT REPORT\n`);
  lines.push(`Generated by PassCraft Event Command System • ${new Date().toLocaleDateString()}\n\n`);

  if (event) {
    lines.push(`EVENT PROFILE\n`);
    lines.push(`Title: ${event.title}\n`);
    lines.push(`Date & Time: ${event.date} at ${event.time || 'TBD'}\n`);
    lines.push(`Location / Venue: ${event.location}\n`);
    lines.push(`Organizer / Organization: ${event.organizer || 'PassCraft Organizer'}\n`);
    if (event.tagline) lines.push(`Tagline: ${event.tagline}\n`);
    if (event.description) lines.push(`Description: ${event.description}\n`);
    lines.push(`\n============================================================\n\n`);
  }

  lines.push(`KEY PERFORMANCE INDICATORS (KPIs)\n`);
  lines.push(`• Total Passes Provisioned: ${totalPasses}\n`);
  lines.push(`• Passes Claimed / Assigned: ${assignedPasses} (${totalPasses > 0 ? Math.round((assignedPasses / totalPasses) * 100) : 0}% capacity)\n`);
  lines.push(`• Turnstile Check-Ins / Admitted: ${checkedInPasses} (${checkInRate}% turnout)\n`);
  lines.push(`• Unassigned / Queue Pool: ${unassignedPasses}\n\n`);

  lines.push(`FINANCIAL SUMMARY (FLAP DESK)\n`);
  lines.push(`• Gross Revenue / Income: $${totalIncome.toLocaleString()}\n`);
  lines.push(`• Total Operating Expenses: $${totalExpense.toLocaleString()}\n`);
  lines.push(`• Net Event Profit: $${netProfit.toLocaleString()}\n\n`);

  lines.push(`FINANCIAL LINE ITEMS\n`);
  if (eventFinancials.length === 0) {
    lines.push(`No financial records logged yet.\n\n`);
  } else {
    eventFinancials.forEach((f, i) => {
      lines.push(`${i + 1}. [${f.type.toUpperCase()}] ${f.title} — $${(f.amount || 0).toLocaleString()} (${f.category || 'General'})\n`);
    });
    lines.push(`\n`);
  }

  lines.push(`TICKET TIER DISTRIBUTION\n`);
  const tierCounts: Record<string, number> = {};
  eventPasses.forEach(p => {
    const cat = p.category || 'General';
    tierCounts[cat] = (tierCounts[cat] || 0) + 1;
  });
  Object.entries(tierCounts).forEach(([tier, count]) => {
    lines.push(`• ${tier}: ${count} passes\n`);
  });

  lines.push(`\n============================================================\n`);
  lines.push(`Document certified by PassCraft Google Workspace Integration.\n`);

  return lines.join('');
}

/**
 * Creates an Executive Brief & Financial Summary Google Doc with Obsidian Black Theme
 */
export async function createExecutiveReportDoc(
  event: EventItem | undefined,
  passes: PassItem[],
  financials: FinancialEntry[],
  accessToken: string
): Promise<CreatedDocResult> {
  const eventTitle = event?.title || 'All Events';
  const docTitle = `${eventTitle} - Executive Brief & Event Report`;

  const initialDoc = await createBlankGoogleDoc(docTitle, accessToken);
  const documentId = initialDoc.documentId;

  const eventPasses = event ? passes.filter(p => p.eventId === event.id) : passes;
  const eventFinancials = event ? financials.filter(f => !f.eventId || f.eventId === event.id) : financials;

  const totalPasses = eventPasses.length;
  const assignedPasses = eventPasses.filter(p => p.status === 'assigned' || p.status === 'checked_in').length;
  const checkedInPasses = eventPasses.filter(p => p.status === 'checked_in').length;
  const unassignedPasses = eventPasses.filter(p => p.status === 'unassigned').length;
  const checkInRate = assignedPasses > 0 ? Math.round((checkedInPasses / assignedPasses) * 100) : 0;

  const totalIncome = eventFinancials.filter(f => f.type === 'income').reduce((sum, f) => sum + (f.amount || 0), 0);
  const totalExpense = eventFinancials.filter(f => f.type === 'expense').reduce((sum, f) => sum + (f.amount || 0), 0);
  const netProfit = totalIncome - totalExpense;

  const builder = new RichDocBuilder();

  // Document Title (Luxury Gold)
  builder.append(`EXECUTIVE BRIEF & POST-EVENT AUDIT REPORT\n`, {
    color: { red: 1.0, green: 0.8, blue: 0.28 },
    fontSize: 18,
    bold: true,
  });
  builder.append(`${docTitle.toUpperCase()}\n`, {
    color: { red: 0.95, green: 0.96, blue: 1.0 },
    fontSize: 13,
    bold: true,
  });
  builder.append(`PassCraft Event Command System • Certified Financial & Attendance Record • ${new Date().toLocaleDateString()}\n\n`, {
    color: { red: 0.58, green: 0.64, blue: 0.76 },
    fontSize: 9,
    italic: true,
  });

  // Event Profile
  if (event) {
    builder.append(`EVENT PROFILE\n`, {
      color: { red: 0.2, green: 0.88, blue: 0.58 },
      fontSize: 12,
      bold: true,
    });
    builder.append(`Title: `, { color: { red: 0.7, green: 0.75, blue: 0.85 }, bold: true });
    builder.append(`${event.title}\n`, { color: { red: 1.0, green: 1.0, blue: 1.0 }, bold: true });

    builder.append(`Date & Time: `, { color: { red: 0.7, green: 0.75, blue: 0.85 }, bold: true });
    builder.append(`${event.date} at ${event.time || 'TBD'}\n`, { color: { red: 0.9, green: 0.92, blue: 0.96 } });

    builder.append(`Venue: `, { color: { red: 0.7, green: 0.75, blue: 0.85 }, bold: true });
    builder.append(`${event.location}\n`, { color: { red: 0.9, green: 0.92, blue: 0.96 } });

    builder.append(`Organizer: `, { color: { red: 0.7, green: 0.75, blue: 0.85 }, bold: true });
    builder.append(`${event.organizer || 'PassCraft Organizer'}\n`, { color: { red: 0.9, green: 0.92, blue: 0.96 } });

    if (event.tagline) {
      builder.append(`Tagline: `, { color: { red: 0.7, green: 0.75, blue: 0.85 }, bold: true });
      builder.append(`${event.tagline}\n`, { color: { red: 0.9, green: 0.92, blue: 0.96 } });
    }
    builder.append(`\n====================================================================================================\n\n`, {
      color: { red: 0.25, green: 0.28, blue: 0.38 },
    });
  }

  // KPIs
  builder.append(`KEY PERFORMANCE INDICATORS (KPIS)\n`, {
    color: { red: 0.28, green: 0.76, blue: 0.98 },
    fontSize: 12,
    bold: true,
  });
  builder.append(`• Total Passes Provisioned: `, { color: { red: 0.85, green: 0.88, blue: 0.94 } });
  builder.append(`${totalPasses}\n`, { color: { red: 1.0, green: 0.82, blue: 0.2 }, bold: true });

  builder.append(`• Passes Claimed / Assigned: `, { color: { red: 0.85, green: 0.88, blue: 0.94 } });
  builder.append(`${assignedPasses} (${totalPasses > 0 ? Math.round((assignedPasses / totalPasses) * 100) : 0}% capacity)\n`, { color: { red: 0.2, green: 0.88, blue: 0.58 }, bold: true });

  builder.append(`• Turnstile Check-Ins / Admitted: `, { color: { red: 0.85, green: 0.88, blue: 0.94 } });
  builder.append(`${checkedInPasses} (${checkInRate}% turnout rate)\n`, { color: { red: 0.28, green: 0.76, blue: 0.98 }, bold: true });

  builder.append(`• Unassigned / Queue Pool: `, { color: { red: 0.85, green: 0.88, blue: 0.94 } });
  builder.append(`${unassignedPasses}\n\n`, { color: { red: 0.7, green: 0.75, blue: 0.85 } });

  // Financial Summary
  builder.append(`FINANCIAL SUMMARY (FLAP DESK)\n`, {
    color: { red: 1.0, green: 0.8, blue: 0.28 },
    fontSize: 12,
    bold: true,
  });
  builder.append(`• Gross Revenue / Income: `, { color: { red: 0.85, green: 0.88, blue: 0.94 } });
  builder.append(`$${totalIncome.toLocaleString()}\n`, { color: { red: 0.2, green: 0.88, blue: 0.58 }, bold: true });

  builder.append(`• Total Operating Expenses: `, { color: { red: 0.85, green: 0.88, blue: 0.94 } });
  builder.append(`$${totalExpense.toLocaleString()}\n`, { color: { red: 1.0, green: 0.45, blue: 0.45 }, bold: true });

  builder.append(`• Net Event Profit: `, { color: { red: 0.85, green: 0.88, blue: 0.94 } });
  builder.append(`$${netProfit.toLocaleString()}\n\n`, {
    color: netProfit >= 0 ? { red: 0.2, green: 0.88, blue: 0.58 } : { red: 1.0, green: 0.45, blue: 0.45 },
    bold: true,
  });

  // Financial Line Items
  builder.append(`FINANCIAL LINE ITEMS\n`, {
    color: { red: 0.76, green: 0.48, blue: 0.98 },
    fontSize: 11.5,
    bold: true,
  });
  if (eventFinancials.length === 0) {
    builder.append(`No financial records logged yet.\n\n`, { color: { red: 0.6, green: 0.65, blue: 0.75 }, italic: true });
  } else {
    eventFinancials.forEach((f, i) => {
      const isIncome = f.type === 'income';
      builder.append(`${i + 1}. [${f.type.toUpperCase()}] `, {
        color: isIncome ? { red: 0.2, green: 0.88, blue: 0.58 } : { red: 1.0, green: 0.45, blue: 0.45 },
        bold: true,
      });
      builder.append(`${f.title} — `, { color: { red: 0.95, green: 0.95, blue: 0.98 } });
      builder.append(`$${(f.amount || 0).toLocaleString()} `, {
        color: isIncome ? { red: 0.2, green: 0.88, blue: 0.58 } : { red: 1.0, green: 0.45, blue: 0.45 },
        bold: true,
      });
      builder.append(`(${f.category || 'General'})\n`, { color: { red: 0.6, green: 0.65, blue: 0.75 } });
    });
    builder.append(`\n`);
  }

  // Tier Distribution
  builder.append(`TICKET TIER DISTRIBUTION\n`, {
    color: { red: 0.28, green: 0.76, blue: 0.98 },
    fontSize: 11.5,
    bold: true,
  });
  const tierCounts: Record<string, number> = {};
  eventPasses.forEach(p => {
    const cat = p.category || 'General';
    tierCounts[cat] = (tierCounts[cat] || 0) + 1;
  });
  Object.entries(tierCounts).forEach(([tier, count]) => {
    builder.append(`• ${tier}: `, { color: { red: 0.85, green: 0.88, blue: 0.94 } });
    builder.append(`${count} passes\n`, { color: { red: 1.0, green: 0.82, blue: 0.2 }, bold: true });
  });

  builder.append(`\n====================================================================================================\n`, {
    color: { red: 0.25, green: 0.28, blue: 0.38 },
  });
  builder.append(`Document certified by PassCraft Google Workspace Integration.\n`, {
    color: { red: 0.5, green: 0.55, blue: 0.65 },
    fontSize: 9,
    italic: true,
  });

  await applyDocumentContentAndStyles(documentId, accessToken, builder);

  return {
    documentId,
    title: docTitle,
    docType: 'executive_report',
    eventId: event?.id,
    eventTitle: event?.title,
    docUrl: initialDoc.docUrl,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Creates a structured Attendee Roster & Gate Security Roster Google Doc with Obsidian Black Theme
 */
export async function createAttendeeRosterDoc(
  event: EventItem | undefined,
  passes: PassItem[],
  accessToken: string
): Promise<CreatedDocResult> {
  const eventTitle = event?.title || 'All Events';
  const docTitle = `${eventTitle} - Attendee & Gate Security Roster`;

  const initialDoc = await createBlankGoogleDoc(docTitle, accessToken);
  const documentId = initialDoc.documentId;

  const targetPasses = event ? passes.filter(p => p.eventId === event.id) : passes;
  const assigned = targetPasses.filter(p => p.status === 'assigned' || p.status === 'checked_in');

  const builder = new RichDocBuilder();

  // Document Title
  builder.append(`OFFICIAL ATTENDEE & GATE ADMISSION SECURITY ROSTER\n`, {
    color: { red: 0.28, green: 0.76, blue: 0.98 },
    fontSize: 18,
    bold: true,
  });
  builder.append(`Event: ${eventTitle} | Generated: ${new Date().toLocaleString()}\n`, {
    color: { red: 0.95, green: 0.96, blue: 1.0 },
    fontSize: 11,
    bold: true,
  });
  builder.append(`Total Confirmed Attendees: ${assigned.length}\n`, {
    color: { red: 0.2, green: 0.88, blue: 0.58 },
    fontSize: 10,
    bold: true,
  });
  builder.append(`----------------------------------------------------------------------------------------------------\n\n`, {
    color: { red: 0.25, green: 0.28, blue: 0.38 },
  });

  assigned.forEach((p, idx) => {
    const gates = getPassGatesUsed(p);
    const checkinTime = p.checkedInAt ? new Date(p.checkedInAt).toLocaleString() : 'Not Checked In';
    
    builder.append(`${idx + 1}. ATTENDEE: `, { color: { red: 0.7, green: 0.75, blue: 0.85 }, bold: true });
    builder.append(`${p.assignedTo?.name || 'Attendee'} `, { color: { red: 1.0, green: 1.0, blue: 1.0 }, bold: true });
    builder.append(`[${p.category.toUpperCase()}]\n`, { color: { red: 0.76, green: 0.48, blue: 0.98 }, bold: true });

    builder.append(`   Contact: `, { color: { red: 0.6, green: 0.65, blue: 0.75 } });
    builder.append(`Email: ${p.assignedTo?.email || 'N/A'} | Phone: ${p.assignedTo?.phone || 'N/A'}\n`, { color: { red: 0.85, green: 0.88, blue: 0.94 } });

    builder.append(`   Pass Code: `, { color: { red: 0.6, green: 0.65, blue: 0.75 } });
    builder.append(`${p.formattedCode} (Raw: ${p.code16})\n`, {
      color: { red: 1.0, green: 0.82, blue: 0.2 },
      bold: true,
    });

    builder.append(`   Status: `, { color: { red: 0.6, green: 0.65, blue: 0.75 } });
    builder.append(`${p.status.toUpperCase()} `, {
      color: p.status === 'checked_in' ? { red: 0.2, green: 0.88, blue: 0.58 } : { red: 0.28, green: 0.76, blue: 0.98 },
      bold: true,
    });
    builder.append(`| Gate Check-in: ${checkinTime}\n`, { color: { red: 0.8, green: 0.84, blue: 0.92 } });

    if (gates && gates !== '-') {
      builder.append(`   Gate Scanner: ${gates}\n`, { color: { red: 0.7, green: 0.75, blue: 0.85 } });
    }
    if (p.assignedTo?.notes) {
      builder.append(`   Notes: ${p.assignedTo.notes}\n`, { color: { red: 0.6, green: 0.65, blue: 0.75 }, italic: true });
    }
    builder.append(`\n`);
  });

  await applyDocumentContentAndStyles(documentId, accessToken, builder);

  return {
    documentId,
    title: docTitle,
    docType: 'attendee_roster',
    eventId: event?.id,
    eventTitle: event?.title,
    docUrl: initialDoc.docUrl,
    createdAt: new Date().toISOString(),
    itemCount: assigned.length,
  };
}

/**
 * Fetch Google Doc structure and preview text
 */
export async function fetchGoogleDocDetails(
  documentId: string,
  accessToken: string
): Promise<{ title: string; bodyText: string; revisionId?: string }> {
  const response = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await handleDocsApiResponse(response, 'Fetching Google Doc Details');
  let bodyText = '';

  if (data.body && Array.isArray(data.body.content)) {
    data.body.content.forEach((elem: any) => {
      if (elem.paragraph && Array.isArray(elem.paragraph.elements)) {
        elem.paragraph.elements.forEach((pElem: any) => {
          if (pElem.textRun && pElem.textRun.content) {
            bodyText += pElem.textRun.content;
          }
        });
      }
    });
  }

  return {
    title: data.title || 'Untitled Document',
    bodyText,
    revisionId: data.revisionId,
  };
}
