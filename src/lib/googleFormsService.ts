import { EventItem, PassItem } from '../types';
import { generate16DigitCode, format16DigitCode } from './passUtils';

export interface CreatedFormResult {
  formId: string;
  title: string;
  formType: 'registration' | 'feedback' | 'custom';
  eventId?: string;
  eventTitle?: string;
  formUrl: string;
  responderUrl: string;
  createdAt: string;
  responseCount?: number;
}

export interface FormResponseAnswer {
  questionTitle: string;
  value: string;
}

export interface FormResponseItem {
  responseId: string;
  submittedAt: string;
  respondentEmail?: string;
  name: string;
  email: string;
  phone: string;
  organization?: string;
  ticketTier: string;
  specialRequests?: string;
  rawAnswers: Record<string, string>;
}

export function extractFormId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const clean = urlOrId.trim();
  const match = clean.match(/\/forms\/d\/(?:e\/[a-zA-Z0-9-_]+\/viewform|([a-zA-Z0-9-_]+))/);
  if (match && match[1]) {
    return match[1];
  }
  const matchDirect = clean.match(/\/forms\/d\/([a-zA-Z0-9-_]+)/);
  if (matchDirect && matchDirect[1]) {
    return matchDirect[1];
  }
  if (/^[a-zA-Z0-9-_]{15,}$/.test(clean)) {
    return clean;
  }
  return null;
}

/**
 * Creates a Live Google Registration & RSVP Form for an Event
 */
export async function createEventRegistrationForm(
  event: EventItem | undefined,
  accessToken: string,
  options?: { customTitle?: string }
): Promise<CreatedFormResult> {
  const eventTitle = event?.title || 'Event';
  const formTitle = options?.customTitle || `${eventTitle} - Official Registration & Pass Claim`;

  // 1. Initialize Form
  const response = await fetch('https://forms.googleapis.com/v1/forms', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      info: {
        title: formTitle,
        documentTitle: formTitle,
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Failed to create Google Form (${response.status})`);
  }

  const formData = await response.json();
  const formId = formData.formId;
  const responderUrl = formData.responderUri || `https://docs.google.com/forms/d/e/${formId}/viewform`;
  const formEditUrl = `https://docs.google.com/forms/d/${formId}/edit`;

  // 2. Populate Questions via batchUpdate
  const ticketTiers = event?.ticketTiers && event.ticketTiers.length > 0
    ? event.ticketTiers.map(t => t.categoryName)
    : ['VIP Pass', 'General Admission', 'Speaker / VIP Guest', 'Staff & Crew'];

  const batchRequests: any[] = [];

  // Update Form Description
  if (event) {
    batchRequests.push({
      updateFormInfo: {
        info: {
          description: `Welcome to official registration for ${event.title}.\n📅 Date: ${event.date} (${event.commencementTime || event.time || 'All Day'})\n📍 Venue: ${event.location}\n🎟️ Fill in your details below to claim your cryptographic 16-digit QR Pass.`,
        },
        updateMask: 'description',
      },
    });
  }

  // Question 1: Full Name
  batchRequests.push({
    createItem: {
      item: {
        title: 'Full Name',
        description: 'Your legal name as it should appear on your security event pass.',
        questionItem: {
          question: {
            required: true,
            textQuestion: {
              paragraph: false,
            },
          },
        },
      },
      location: { index: 0 },
    },
  });

  // Question 2: Email Address
  batchRequests.push({
    createItem: {
      item: {
        title: 'Email Address',
        description: 'Where your digital pass and QR code will be delivered.',
        questionItem: {
          question: {
            required: true,
            textQuestion: {
              paragraph: false,
            },
          },
        },
      },
      location: { index: 1 },
    },
  });

  // Question 3: Phone Number
  batchRequests.push({
    createItem: {
      item: {
        title: 'Phone Number',
        description: 'Mobile contact for gate entry verification and emergency alerts.',
        questionItem: {
          question: {
            required: true,
            textQuestion: {
              paragraph: false,
            },
          },
        },
      },
      location: { index: 2 },
    },
  });

  // Question 4: Pass Tier Selection
  batchRequests.push({
    createItem: {
      item: {
        title: 'Ticket Tier / Pass Category',
        description: 'Select your registered pass tier.',
        questionItem: {
          question: {
            required: true,
            choiceQuestion: {
              type: 'RADIO',
              options: ticketTiers.map(tier => ({ value: tier })),
              shuffle: false,
            },
          },
        },
      },
      location: { index: 3 },
    },
  });

  // Question 5: Organization / Company
  batchRequests.push({
    createItem: {
      item: {
        title: 'Organization / Affiliation (Optional)',
        description: 'Company, university, or studio affiliation.',
        questionItem: {
          question: {
            required: false,
            textQuestion: {
              paragraph: false,
            },
          },
        },
      },
      location: { index: 4 },
    },
  });

  // Question 6: Special Requests
  batchRequests.push({
    createItem: {
      item: {
        title: 'Accessibility or Special Requests (Optional)',
        questionItem: {
          question: {
            required: false,
            textQuestion: {
              paragraph: true,
            },
          },
        },
      },
      location: { index: 5 },
    },
  });

  // Apply batch updates
  await fetch(`https://forms.googleapis.com/v1/forms/${formId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: batchRequests,
    }),
  });

  return {
    formId,
    title: formTitle,
    formType: 'registration',
    eventId: event?.id,
    eventTitle: event?.title,
    formUrl: formEditUrl,
    responderUrl,
    createdAt: new Date().toISOString(),
    responseCount: 0,
  };
}

/**
 * Creates a Post-Event Feedback & Satisfaction Survey Form
 */
export async function createFeedbackForm(
  event: EventItem | undefined,
  accessToken: string
): Promise<CreatedFormResult> {
  const eventTitle = event?.title || 'Event';
  const formTitle = `${eventTitle} - Attendee Feedback & Experience Survey`;

  const response = await fetch('https://forms.googleapis.com/v1/forms', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      info: {
        title: formTitle,
        documentTitle: formTitle,
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Failed to create Feedback Form (${response.status})`);
  }

  const formData = await response.json();
  const formId = formData.formId;
  const responderUrl = formData.responderUri || `https://docs.google.com/forms/d/e/${formId}/viewform`;
  const formEditUrl = `https://docs.google.com/forms/d/${formId}/edit`;

  const batchRequests: any[] = [
    {
      updateFormInfo: {
        info: {
          description: `Thank you for attending ${eventTitle}! Please take 60 seconds to share your experience and help us make the next edition even better.`,
        },
        updateMask: 'description',
      },
    },
    {
      createItem: {
        item: {
          title: 'Overall Event Rating',
          description: 'How would you rate your overall experience?',
          questionItem: {
            question: {
              required: true,
              scaleQuestion: {
                low: 1,
                high: 5,
                lowLabel: 'Poor',
                highLabel: 'Outstanding',
              },
            },
          },
        },
        location: { index: 0 },
      },
    },
    {
      createItem: {
        item: {
          title: 'What was the highlight of the event for you?',
          questionItem: {
            question: {
              required: false,
              textQuestion: { paragraph: true },
            },
          },
        },
        location: { index: 1 },
      },
    },
    {
      createItem: {
        item: {
          title: 'How was the check-in and gate entry experience?',
          questionItem: {
            question: {
              required: false,
              choiceQuestion: {
                type: 'RADIO',
                options: [
                  { value: 'Lightning fast & seamless (< 10 seconds)' },
                  { value: 'Good & steady' },
                  { value: 'Slight delay at turnstiles' },
                  { value: 'Encountered verification issues' },
                ],
              },
            },
          },
        },
        location: { index: 2 },
      },
    },
    {
      createItem: {
        item: {
          title: 'Any suggestions or topics for future events?',
          questionItem: {
            question: {
              required: false,
              textQuestion: { paragraph: true },
            },
          },
        },
        location: { index: 3 },
      },
    },
  ];

  await fetch(`https://forms.googleapis.com/v1/forms/${formId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: batchRequests,
    }),
  });

  return {
    formId,
    title: formTitle,
    formType: 'feedback',
    eventId: event?.id,
    eventTitle: event?.title,
    formUrl: formEditUrl,
    responderUrl,
    createdAt: new Date().toISOString(),
    responseCount: 0,
  };
}

/**
 * Fetch Google Form structure, questions, and metadata
 */
export async function fetchFormDetails(
  formId: string,
  accessToken: string
): Promise<{ formId: string; title: string; description?: string; responderUri: string; items: any[] }> {
  const response = await fetch(`https://forms.googleapis.com/v1/forms/${formId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Failed to fetch Form (${response.status})`);
  }

  const data = await response.json();
  return {
    formId: data.formId,
    title: data.info?.title || 'Google Form',
    description: data.info?.description,
    responderUri: data.responderUri || `https://docs.google.com/forms/d/e/${formId}/viewform`,
    items: data.items || [],
  };
}

/**
 * Fetch submitted responses for a Google Form
 */
export async function fetchFormResponses(
  formId: string,
  accessToken: string
): Promise<FormResponseItem[]> {
  const formMeta = await fetchFormDetails(formId, accessToken);
  
  // Map questionId -> question title
  const questionMap: Record<string, string> = {};
  if (formMeta.items) {
    formMeta.items.forEach((item: any) => {
      if (item.questionItem?.question?.questionId) {
        questionMap[item.questionItem.question.questionId] = item.title || 'Question';
      }
    });
  }

  const response = await fetch(`https://forms.googleapis.com/v1/forms/${formId}/responses`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Failed to fetch Form Responses (${response.status})`);
  }

  const data = await response.json();
  const rawResponses: any[] = data.responses || [];

  const parsedItems: FormResponseItem[] = rawResponses.map((r: any) => {
    const rawAnswers: Record<string, string> = {};
    let name = '';
    let email = r.respondentEmail || '';
    let phone = '';
    let organization = '';
    let ticketTier = 'General';
    let specialRequests = '';

    if (r.answers) {
      Object.entries(r.answers).forEach(([qId, ansObj]: [string, any]) => {
        const qTitle = questionMap[qId] || qId;
        const textVal = ansObj.textAnswers?.answers?.[0]?.value || '';
        rawAnswers[qTitle] = textVal;

        const lowerQ = qTitle.toLowerCase();
        if (lowerQ.includes('name')) {
          name = textVal;
        } else if (lowerQ.includes('email')) {
          email = textVal;
        } else if (lowerQ.includes('phone') || lowerQ.includes('mobile') || lowerQ.includes('contact')) {
          phone = textVal;
        } else if (lowerQ.includes('tier') || lowerQ.includes('category') || lowerQ.includes('ticket')) {
          ticketTier = textVal || 'General';
        } else if (lowerQ.includes('organization') || lowerQ.includes('company')) {
          organization = textVal;
        } else if (lowerQ.includes('special') || lowerQ.includes('request') || lowerQ.includes('note')) {
          specialRequests = textVal;
        }
      });
    }

    return {
      responseId: r.responseId,
      submittedAt: r.createTime || new Date().toISOString(),
      respondentEmail: r.respondentEmail,
      name: name || 'Attendee',
      email: email || '',
      phone: phone || '',
      organization,
      ticketTier: ticketTier || 'General',
      specialRequests,
      rawAnswers,
    };
  });

  return parsedItems;
}

/**
 * Automatically converts Google Form Responses into cryptographically issued PassCraft passes
 */
export function convertFormResponsesToPasses(
  formResponses: FormResponseItem[],
  event: EventItem | undefined,
  existingPasses: PassItem[]
): {
  newPasses: PassItem[];
  updatedPasses: PassItem[];
  importedCount: number;
} {
  const existingCodeSet = new Set(existingPasses.map(p => p.code16));
  const existingEmailMap = new Map<string, PassItem>();
  
  existingPasses.forEach(p => {
    if (p.assignedTo?.email) {
      existingEmailMap.set(p.assignedTo.email.toLowerCase().trim(), p);
    }
  });

  const newlyCreated: PassItem[] = [];
  let updatedPassesList = [...existingPasses];
  let importedCount = 0;

  formResponses.forEach((resp) => {
    const cleanEmail = (resp.email || '').toLowerCase().trim();
    
    // Check if attendee with this email already has a pass
    if (cleanEmail && existingEmailMap.has(cleanEmail)) {
      // Pass already exists for this email, skip or retain
      return;
    }

    // Generate unique 16-digit code
    let code16 = generate16DigitCode();
    while (existingCodeSet.has(code16)) {
      code16 = generate16DigitCode();
    }
    existingCodeSet.add(code16);

    const formattedCode = format16DigitCode(code16);
    const passId = 'pass_form_' + code16 + '_' + Date.now().toString(36);

    const newPass: PassItem = {
      id: passId,
      code16,
      formattedCode,
      eventId: event?.id || 'all',
      eventName: event?.title || 'Main Event',
      eventDate: event?.date || new Date().toISOString().slice(0, 10),
      eventTime: event?.time || '10:00 AM',
      commencementTime: event?.commencementTime || '10:00 AM',
      endTime: event?.endTime || '06:00 PM',
      eventLocation: event?.location || 'Main Venue',
      category: resp.ticketTier || 'General',
      ticketPrice: 0,
      status: 'assigned',
      themeColor: event?.themeColor || '#4f46e5',
      assignedTo: {
        name: resp.name,
        email: resp.email,
        phone: resp.phone,
        notes: [resp.organization ? `Org: ${resp.organization}` : '', resp.specialRequests ? `Req: ${resp.specialRequests}` : '']
          .filter(Boolean)
          .join(' | ') || 'Registered via Google Form',
        assignedAt: resp.submittedAt || new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
    };

    newlyCreated.push(newPass);
    if (cleanEmail) {
      existingEmailMap.set(cleanEmail, newPass);
    }
    importedCount++;
  });

  updatedPassesList = [...newlyCreated, ...updatedPassesList];

  return {
    newPasses: newlyCreated,
    updatedPasses: updatedPassesList,
    importedCount,
  };
}
