import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  User 
} from 'firebase/auth';
import { auth } from './firebase';

export { auth };

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');

// Initialize cached token from localStorage or sessionStorage if available
let cachedAccessToken: string | null = (() => {
  try {
    return localStorage.getItem('passcraft_gsheet_access_token') || sessionStorage.getItem('passcraft_gsheet_access_token');
  } catch (e) {
    return null;
  }
})();
let activeSheetsAuthPromise: Promise<{ user: User | null; accessToken: string }> | null = null;

// Extract Spreadsheet ID from standard Google Sheet URL or return raw ID
export function extractSpreadsheetId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const clean = urlOrId.trim();
  const match = clean.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  // If it's already an ID
  if (/^[a-zA-Z0-9-_]{15,}$/.test(clean)) {
    return clean;
  }
  return null;
}

// Get or refresh OAuth Access Token without prompting user if already granted
export async function getGoogleAccessToken(): Promise<string | null> {
  if (cachedAccessToken) {
    return cachedAccessToken;
  }
  try {
    const stored = localStorage.getItem('passcraft_gsheet_access_token') || sessionStorage.getItem('passcraft_gsheet_access_token');
    if (stored) {
      cachedAccessToken = stored;
      return stored;
    }
  } catch (e) {}
  return null;
}

export function setGoogleAccessToken(token: string | null) {
  cachedAccessToken = token;
  try {
    if (token) {
      localStorage.setItem('passcraft_gsheet_access_token', token);
      sessionStorage.setItem('passcraft_gsheet_access_token', token);
      localStorage.setItem('passcraft_gsheet_token_saved_at', String(Date.now()));
    } else {
      localStorage.removeItem('passcraft_gsheet_access_token');
      sessionStorage.removeItem('passcraft_gsheet_access_token');
      localStorage.removeItem('passcraft_gsheet_token_saved_at');
    }
  } catch (e) {}
}

// Connect / Sign In with Google Sheets permission (Only called when permission is first requested or explicit re-auth)
export async function connectGoogleSheetsAuth(forceReauth: boolean = false): Promise<{ user: User | null; accessToken: string }> {
  // If token is already present and not forcing reauth, return existing token immediately
  if (!forceReauth) {
    const existingToken = await getGoogleAccessToken();
    if (existingToken) {
      return { user: auth.currentUser, accessToken: existingToken };
    }
  }

  // If a popup operation is already in flight, reuse the ongoing promise
  if (activeSheetsAuthPromise) {
    return activeSheetsAuthPromise;
  }

  const authPromise = (async () => {
    try {
      if (forceReauth) {
        provider.setCustomParameters({ prompt: 'select_account' });
      }

      let result: any;
      try {
        result = await signInWithPopup(auth, provider);
      } catch (popupErr: any) {
        const msg = popupErr?.message || '';
        const code = popupErr?.code || '';
        if (
          msg.includes('INTERNAL ASSERTION FAILED') ||
          msg.includes('Pending promise was never set') ||
          code === 'auth/popup-closed-by-user' ||
          code === 'auth/cancelled-popup-request' ||
          code === 'auth/popup-blocked' ||
          msg.includes('popup-closed-by-user') ||
          msg.includes('cancelled-popup-request') ||
          msg.includes('popup-blocked') ||
          msg.includes('closed-by-user')
        ) {
          console.warn('Google Sheets sign-in popup was closed or cancelled.');
          const cancelErr = new Error('Google Sheets sign-in was cancelled.');
          (cancelErr as any).isCancelled = true;
          (cancelErr as any).isUserCancellation = true;
          (cancelErr as any).code = code || 'auth/popup-closed-by-user';
          throw cancelErr;
        }
        throw popupErr;
      }

      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error('Could not obtain Google Sheets access token. Please ensure popup was approved.');
      }
      setGoogleAccessToken(credential.accessToken);
      if (result.user?.email) {
        localStorage.setItem('passcraft_gsheet_user_email', result.user.email);
      }
      return { user: result.user, accessToken: credential.accessToken };
    } catch (err: any) {
      const code = err?.code || '';
      const message = typeof err?.message === 'string' ? err.message : '';
      if (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request' ||
        code === 'auth/popup-blocked' ||
        message.includes('popup-closed-by-user') ||
        message.includes('cancelled-popup-request') ||
        message.includes('popup-blocked') ||
        message.includes('closed-by-user')
      ) {
        console.warn('Google Sheets sign-in popup was closed or cancelled by user.');
        const cancelErr = new Error('Google Sheets sign-in was cancelled.');
        (cancelErr as any).isCancelled = true;
        (cancelErr as any).isUserCancellation = true;
        (cancelErr as any).code = code || 'auth/popup-closed-by-user';
        throw cancelErr;
      }
      throw err;
    } finally {
      activeSheetsAuthPromise = null;
    }
  })();

  activeSheetsAuthPromise = authPromise;
  return authPromise;
}

// Fetch Spreadsheet info & tabs
export async function fetchSpreadsheetMetadata(spreadsheetId: string, accessToken: string) {
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Failed to fetch sheet metadata (${response.status})`);
  }

  return response.json();
}

// Ensure tab exists in the spreadsheet
export async function ensureSheetTabExists(spreadsheetId: string, tabName: string, accessToken: string): Promise<number> {
  const meta = await fetchSpreadsheetMetadata(spreadsheetId, accessToken);
  const sheets = meta.sheets || [];
  const existingSheet = sheets.find((s: any) => s.properties?.title?.toLowerCase() === tabName.toLowerCase());
  
  if (!existingSheet) {
    // Add new sheet tab
    const addRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: tabName,
              },
            },
          },
        ],
      }),
    });
    if (!addRes.ok) {
      const err = await addRes.json().catch(() => ({}));
      console.warn('Could not auto-create tab:', err);
    }
    // Re-fetch metadata to get new sheetId
    const updatedMeta = await fetchSpreadsheetMetadata(spreadsheetId, accessToken);
    const created = updatedMeta.sheets?.find((s: any) => s.properties?.title?.toLowerCase() === tabName.toLowerCase());
    return created?.properties?.sheetId ?? 0;
  }
  return existingSheet.properties?.sheetId ?? 0;
}

// Format the sheet with professional table styling (Frozen header, dark background, borders, proper row height for QR codes, and clear invalid validation rules)
export async function formatSheetAsProfessionalTable(
  spreadsheetId: string,
  sheetId: number,
  rowCount: number,
  colCount: number,
  accessToken: string,
  options?: {
    customColumnWidths?: number[];
    headerBgColor?: { red: number; green: number; blue: number };
  }
) {
  try {
    const totalRows = Math.max(rowCount + 1, 2);
    const defaultColumnWidths = [
      180, // Pass Code
      90,  // Live QR Code
      170, // Attendee Name
      230, // Email Address
      140, // Phone Number
      180, // Event Title
      130, // Category / Tier
      100, // Price ($)
      120, // Pass Status
      180, // Check-in Timestamp
      180, // Gate Used
      110, // Total Check-ins
    ];
    const columnWidths = options?.customColumnWidths || defaultColumnWidths;
    const headerBg = options?.headerBgColor || { red: 0.0588, green: 0.0902, blue: 0.1647 }; // #0F172A

    const requests: any[] = [
      // 1. Remove all old/conflicting data validations (e.g. dropdown lists, checkboxes causing "Invalid: Input must be an item on the specified list" error)
      {
        setDataValidation: {
          range: {
            sheetId: sheetId,
            startRowIndex: 0,
            endRowIndex: 5000,
            startColumnIndex: 0,
            endColumnIndex: 30,
          },
          rule: null,
        },
      },

      // 2. Freeze Header Row 1
      {
        updateSheetProperties: {
          properties: {
            sheetId: sheetId,
            gridProperties: {
              frozenRowCount: 1,
            },
          },
          fields: 'gridProperties.frozenRowCount',
        },
      },

      // 3. Style Header Row: Dark Slate Navy Background (#0F172A), Bold White Text, Center/Middle aligned, 11pt font
      {
        repeatCell: {
          range: {
            sheetId: sheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: colCount,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: headerBg,
              textFormat: {
                foregroundColor: { red: 1, green: 1, blue: 1 },
                fontSize: 10,
                bold: true,
                fontFamily: 'Arial',
              },
              horizontalAlignment: 'CENTER',
              verticalAlignment: 'MIDDLE',
              padding: { top: 6, bottom: 6, left: 8, right: 8 },
              wrapStrategy: 'CLIP',
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,padding,wrapStrategy)',
        },
      },

      // 4. Style Data Rows: Vertical Middle alignment, clean 10pt font, proper padding
      {
        repeatCell: {
          range: {
            sheetId: sheetId,
            startRowIndex: 1,
            endRowIndex: totalRows,
            startColumnIndex: 0,
            endColumnIndex: colCount,
          },
          cell: {
            userEnteredFormat: {
              textFormat: {
                fontSize: 10,
                fontFamily: 'Arial',
              },
              verticalAlignment: 'MIDDLE',
              padding: { top: 4, bottom: 4, left: 8, right: 8 },
            },
          },
          fields: 'userEnteredFormat(textFormat,verticalAlignment,padding)',
        },
      },

      // 5. Center align QR Code column (Col 1) and Pass Code column (Col 0)
      {
        repeatCell: {
          range: {
            sheetId: sheetId,
            startRowIndex: 1,
            endRowIndex: totalRows,
            startColumnIndex: 0,
            endColumnIndex: 2,
          },
          cell: {
            userEnteredFormat: {
              horizontalAlignment: 'CENTER',
              verticalAlignment: 'MIDDLE',
            },
          },
          fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment)',
        },
      },

      // 6. Set Header Row Height to 40px
      {
        updateDimensionProperties: {
          range: {
            sheetId: sheetId,
            dimension: 'ROWS',
            startIndex: 0,
            endIndex: 1,
          },
          properties: {
            pixelSize: 40,
          },
          fields: 'pixelSize',
        },
      },

      // 7. Set Data Rows Height to 80px so QR Code =IMAGE() renders crisp and tall without clipping!
      {
        updateDimensionProperties: {
          range: {
            sheetId: sheetId,
            dimension: 'ROWS',
            startIndex: 1,
            endIndex: totalRows,
          },
          properties: {
            pixelSize: 80,
          },
          fields: 'pixelSize',
        },
      },

      // 8. Apply clean borders across the entire table
      {
        updateBorders: {
          range: {
            sheetId: sheetId,
            startRowIndex: 0,
            endRowIndex: totalRows,
            startColumnIndex: 0,
            endColumnIndex: colCount,
          },
          top: { style: 'SOLID', color: { red: 0.8, green: 0.84, blue: 0.88 } },
          bottom: { style: 'SOLID', color: { red: 0.8, green: 0.84, blue: 0.88 } },
          left: { style: 'SOLID', color: { red: 0.8, green: 0.84, blue: 0.88 } },
          right: { style: 'SOLID', color: { red: 0.8, green: 0.84, blue: 0.88 } },
          innerHorizontal: { style: 'SOLID', color: { red: 0.88, green: 0.91, blue: 0.94 } },
          innerVertical: { style: 'SOLID', color: { red: 0.88, green: 0.91, blue: 0.94 } },
        },
      },
    ];

    // Add specific column widths
    for (let i = 0; i < Math.min(colCount, columnWidths.length); i++) {
      requests.push({
        updateDimensionProperties: {
          range: {
            sheetId: sheetId,
            dimension: 'COLUMNS',
            startIndex: i,
            endIndex: i + 1,
          },
          properties: {
            pixelSize: columnWidths[i],
          },
          fields: 'pixelSize',
        },
      });
    }

    const batchRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    });

    if (!batchRes.ok) {
      const err = await batchRes.json().catch(() => ({}));
      console.warn('Table formatting warning (non-fatal):', err);
    }
  } catch (err) {
    console.warn('Table formatting error (non-fatal):', err);
  }
}

// Write / Append Pass rows to Google Sheet via REST API with table styling
export async function syncPassesToGoogleSheetApi(
  spreadsheetId: string,
  tabName: string,
  headers: string[],
  rows: string[][],
  accessToken: string,
  mode: 'replace_all' | 'append' = 'replace_all',
  options?: {
    customColumnWidths?: number[];
    headerBgColor?: { red: number; green: number; blue: number };
  }
) {
  // 1. Ensure tab exists and get sheetId
  let sheetId = 0;
  try {
    sheetId = await ensureSheetTabExists(spreadsheetId, tabName, accessToken);
  } catch (e) {
    console.warn('Tab existence verification note:', e);
  }

  if (mode === 'replace_all') {
    // Clear existing values range first
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A1:Z5000:clear`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    // Write headers and rows starting from A1
    const allValues = [headers, ...rows];
    const updateRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          range: `${tabName}!A1`,
          majorDimension: 'ROWS',
          values: allValues,
        }),
      }
    );

    if (!updateRes.ok) {
      const errJson = await updateRes.json().catch(() => ({}));
      throw new Error(errJson.error?.message || `Failed to write to Google Sheet (${updateRes.status})`);
    }

    // Apply Table Formatting (Header styling, 80px QR row heights, column widths, clear invalid validation rules, borders)
    await formatSheetAsProfessionalTable(spreadsheetId, sheetId, rows.length, headers.length, accessToken, options);

    return await updateRes.json();
  } else {
    // Append single or multiple rows
    const appendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A:Z:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          majorDimension: 'ROWS',
          values: rows,
        }),
      }
    );

    if (!appendRes.ok) {
      const errJson = await appendRes.json().catch(() => ({}));
      throw new Error(errJson.error?.message || `Failed to append row to Google Sheet (${appendRes.status})`);
    }

    // Apply row height & formatting to newly appended rows
    await formatSheetAsProfessionalTable(spreadsheetId, sheetId, rows.length, headers.length, accessToken, options);

    return await appendRes.json();
  }
}
