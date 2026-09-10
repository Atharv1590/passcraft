import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  initializeFirestore,
  setLogLevel,
  Firestore, 
  doc, 
  setDoc, 
  getDoc, 
  deleteDoc,
  onSnapshot, 
  collection, 
  collectionGroup,
  query,
  where,
  getDocs,
  Unsubscribe
} from 'firebase/firestore';
import { 
  getAuth, 
  setPersistence,
  browserLocalPersistence,
  Auth
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { 
  EventItem, 
  PassItem, 
  FinancialEntry, 
  DeviceSession, 
  UserRole, 
  QuickAccessCode,
  CurrentUserSession
} from '../types';

// Set Firestore log level to error to avoid noisy connection retry notices
try {
  setLogLevel('error');
} catch {}

// Initialize Firebase App singleton
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Initialize Firestore with experimentalAutoDetectLongPolling for stable connectivity across container/iframe environments
let dbInstance: Firestore;
try {
  dbInstance = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  }, (firebaseConfig as any).firestoreDatabaseId || undefined);
} catch {
  dbInstance = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId || undefined);
}
export const db: Firestore = dbInstance;

// Initialize Firebase Auth
export const auth: Auth = getAuth(app);

// Configure local persistence once safely
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('Firebase Auth persistence notice:', err);
  });
}

/**
 * Recursively removes all `undefined` values from objects and arrays.
 * Firestore strict type validation rejects documents containing `undefined`.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) {
    return null as unknown as T;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(data as Record<string, any>)) {
    if (value !== undefined) {
      clean[key] = sanitizeForFirestore(value);
    }
  }
  return clean as T;
}

// Simple SHA-256 equivalent for shared account password hashing (fallback & cross-device match)
export async function hashPassword(password: string): Promise<string> {
  try {
    const msgUint8 = new TextEncoder().encode(password + "_passcraft_salt_2026");
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      hash = (hash << 5) - hash + password.charCodeAt(i);
      hash |= 0;
    }
    return 'h_' + Math.abs(hash).toString(16) + '_salted';
  }
}

// Generate or retrieve persistent unique Device ID for this browser tab / device
export function getDeviceId(): string {
  const KEY = 'passcraft_device_id_v1';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
    localStorage.setItem(KEY, id);
  }
  return id;
}

// Local Storage helpers for Device Label
export function getDeviceLabel(): string {
  const KEY = 'passcraft_device_label_v1';
  let label = localStorage.getItem(KEY);
  if (!label) {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    label = isMobile ? 'Mobile Gate Scanner' : 'Organizer Workspace';
    localStorage.setItem(KEY, label);
  }
  return label;
}

export function setDeviceLabel(label: string) {
  if (label && label.trim()) {
    localStorage.setItem('passcraft_device_label_v1', label.trim());
  }
}

// Local Storage helpers for Device Location (Manual string input + presets)
export function getDeviceLocation(): string {
  const KEY = 'passcraft_device_location_v1';
  let loc = localStorage.getItem(KEY);
  if (!loc) {
    loc = 'Hyderabad';
    localStorage.setItem(KEY, loc);
  }
  return loc;
}

export function setDeviceLocation(loc: string) {
  if (loc && loc.trim()) {
    localStorage.setItem('passcraft_device_location_v1', loc.trim());
  }
}

// Local Storage helpers for Current User Session
export function getStoredSession(): CurrentUserSession | null {
  try {
    const data = localStorage.getItem('passcraft_user_session_v2');
    if (data) return JSON.parse(data);
  } catch (e) {}
  
  // Legacy fallback
  const legacyEmail = localStorage.getItem('passcraft_user_email');
  if (legacyEmail) {
    return {
      email: legacyEmail,
      role: 'owner',
      isOwner: true,
      allowedEventId: 'all',
      deviceLocation: getDeviceLocation(),
      deviceLabel: getDeviceLabel(),
    };
  }
  return null;
}

export function saveStoredSession(session: CurrentUserSession | null) {
  if (!session) {
    localStorage.removeItem('passcraft_user_session_v2');
    localStorage.removeItem('passcraft_user_email');
  } else {
    localStorage.setItem('passcraft_user_session_v2', JSON.stringify(session));
    localStorage.setItem('passcraft_user_email', session.email);
    setDeviceLocation(session.deviceLocation);
    setDeviceLabel(session.deviceLabel);
  }
}

// Format normalized account document ID from email
export function getAccountDocId(email: string): string {
  return email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
}

// Register or Heartbeat device session in Firestore
export async function heartbeatDeviceSession(
  email: string, 
  options?: {
    role?: UserRole;
    allowedEventId?: string;
    customLabel?: string;
    customLocation?: string;
    accessCodeUsed?: string;
  }
) {
  if (!email) return;
  const docId = getAccountDocId(email);
  const deviceId = getDeviceId();
  const label = options?.customLabel || getDeviceLabel();
  const location = options?.customLocation || getDeviceLocation();

  try {
    const deviceRef = doc(db, 'accounts', docId, 'devices', deviceId);
    
    // Check if this device has been revoked
    const existingSnap = await getDoc(deviceRef);
    if (existingSnap.exists()) {
      const data = existingSnap.data() as DeviceSession;
      if (data && data.revoked === true) {
        return; // Device is revoked, do not heartbeat or un-revoke
      }
    }

    await setDoc(deviceRef, sanitizeForFirestore({
      id: deviceId,
      deviceName: label,
      location: location,
      role: options?.role || 'owner',
      allowedEventId: options?.allowedEventId || 'all',
      accessCodeUsed: options?.accessCodeUsed || '',
      lastPing: new Date().toISOString(),
      userAgent: navigator.userAgent.slice(0, 120),
      revoked: false,
    }), { merge: true });
  } catch (err) {
    console.warn('Could not heartbeat device session:', err);
  }
}

// Real-time listener for current device revocation status
export function subscribeToCurrentDeviceStatus(
  email: string,
  onRevoked: () => void
): Unsubscribe | null {
  if (!email) return null;
  const docId = getAccountDocId(email);
  const deviceId = getDeviceId();
  const deviceRef = doc(db, 'accounts', docId, 'devices', deviceId);

  let hasObservedExistence = false;

  return onSnapshot(deviceRef, (docSnap) => {
    if (docSnap.exists()) {
      hasObservedExistence = true;
      const data = docSnap.data() as DeviceSession;
      if (data && data.revoked === true) {
        onRevoked();
      }
    } else {
      // If the device document was previously confirmed active and is now deleted
      if (hasObservedExistence) {
        onRevoked();
      }
    }
  }, (err) => {
    console.warn('Firestore device revocation listener error:', err);
  });
}

// Real-time listener for connected devices across locations
export function subscribeToActiveDevices(
  email: string,
  onUpdate: (devices: DeviceSession[]) => void
): Unsubscribe | null {
  if (!email) return null;
  const docId = getAccountDocId(email);
  const devicesCol = collection(db, 'accounts', docId, 'devices');
  const currentDeviceId = getDeviceId();

  return onSnapshot(devicesCol, (snapshot) => {
    const list: DeviceSession[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as DeviceSession;
      if (data && data.revoked !== true) {
        list.push({
          ...data,
          isCurrentDevice: data.id === currentDeviceId,
        });
      }
    });

    // Sort: current device first, then most recent ping
    list.sort((a, b) => {
      if (a.isCurrentDevice) return -1;
      if (b.isCurrentDevice) return 1;
      return new Date(b.lastPing || 0).getTime() - new Date(a.lastPing || 0).getTime();
    });

    onUpdate(list);
  }, (err) => {
    console.warn('Firestore device listener error:', err);
  });
}

// Owner can remotely revoke/kick any connected device session
export async function revokeDeviceSession(email: string, deviceId: string): Promise<boolean> {
  if (!email || !deviceId) return false;
  const docId = getAccountDocId(email);
  try {
    const deviceRef = doc(db, 'accounts', docId, 'devices', deviceId);
    
    // 1. Explicitly flag as revoked
    await setDoc(deviceRef, sanitizeForFirestore({
      revoked: true,
      revokedAt: new Date().toISOString(),
    }), { merge: true });

    // 2. Delete the document after a brief buffer so the listener catches revocation & cleans up
    setTimeout(async () => {
      try {
        await deleteDoc(deviceRef);
      } catch (delErr) {
        console.warn('Device cleanup deletion note:', delErr);
      }
    }, 1500);

    return true;
  } catch (err) {
    console.error('Failed to revoke device session:', err);
    return false;
  }
}

// =========================================================================
// QUICK ACCESS CODES MANAGEMENT (Role-based 1-time / shared codes)
// =========================================================================

// Local cache helpers for Quick Access Codes
export function getLocalAccessCodes(ownerEmail: string): QuickAccessCode[] {
  try {
    const raw = localStorage.getItem(`passcraft_codes_${getAccountDocId(ownerEmail)}`);
    if (raw) {
      const parsed: QuickAccessCode[] = JSON.parse(raw);
      const tombstones = getDeletedCodesTombstone(ownerEmail);
      return parsed.filter(c => !tombstones.has(c.id) && !tombstones.has(c.code?.toUpperCase()) && !tombstones.has(c.code));
    }
  } catch (e) {
    console.warn('Could not read local access codes:', e);
  }
  return [];
}

export function saveLocalAccessCodes(ownerEmail: string, codes: QuickAccessCode[]): void {
  try {
    const tombstones = getDeletedCodesTombstone(ownerEmail);
    const filtered = codes.filter(c => !tombstones.has(c.id) && !tombstones.has(c.code?.toUpperCase()) && !tombstones.has(c.code));
    localStorage.setItem(`passcraft_codes_${getAccountDocId(ownerEmail)}`, JSON.stringify(filtered));
  } catch (e) {
    console.warn('Could not save local access codes:', e);
  }
}

// Persistent tombstone tracking for deleted codes to guarantee they never resurrect
const DELETED_CODES_KEY_PREFIX = 'passcraft_deleted_code_keys_';

export function getDeletedCodesTombstone(ownerEmail: string): Set<string> {
  try {
    const raw = localStorage.getItem(`${DELETED_CODES_KEY_PREFIX}${getAccountDocId(ownerEmail)}`);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set(arr.map((k: string) => String(k).trim().toUpperCase()));
      }
    }
  } catch (e) {}
  return new Set<string>();
}

export function recordDeletedCodeTombstone(ownerEmail: string, keys: string[]): void {
  try {
    const set = getDeletedCodesTombstone(ownerEmail);
    keys.forEach(k => {
      if (k && k.trim()) {
        set.add(k.trim().toUpperCase());
        set.add(k.trim());
      }
    });
    localStorage.setItem(
      `${DELETED_CODES_KEY_PREFIX}${getAccountDocId(ownerEmail)}`, 
      JSON.stringify(Array.from(set))
    );
  } catch (e) {}
}

export function unrecordDeletedCodeTombstone(ownerEmail: string, keys: string[]): void {
  try {
    const set = getDeletedCodesTombstone(ownerEmail);
    keys.forEach(k => {
      if (k && k.trim()) {
        set.delete(k.trim().toUpperCase());
        set.delete(k.trim());
      }
    });
    localStorage.setItem(
      `${DELETED_CODES_KEY_PREFIX}${getAccountDocId(ownerEmail)}`, 
      JSON.stringify(Array.from(set))
    );
  } catch (e) {}
}

// Generate random friendly passcode (e.g., CLNT-BLR-8492 or GATE-SEC-4190)
export function generateRandomAccessCode(role: UserRole, location?: string): string {
  const locPrefix = (location || '').trim().slice(0, 3).toUpperCase() || 'IND';
  const rolePrefix = role === 'client_viewer' ? 'CLNT' : role === 'gate_operator' ? 'GATE' : 'PASS';
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  return `${rolePrefix}-${locPrefix}-${randomDigits}`;
}

// Create a Quick Access Code in Firestore + Local Storage Cache
export async function createQuickAccessCode(
  ownerEmail?: string,
  params?: {
    role?: UserRole;
    targetLocation?: string;
    targetLabel?: string;
    allowedEventId?: string;
    allowedEventTitle?: string;
    customCode?: string;
    notes?: string;
  }
): Promise<QuickAccessCode> {
  const currentSession = getStoredSession();
  const effectiveOwner = (ownerEmail || currentSession?.email || '').trim().toLowerCase();
  
  if (!effectiveOwner || !effectiveOwner.includes('@')) {
    throw new Error('You must be signed in with your Workspace Owner Gmail account to generate quick access codes.');
  }

  // Ensure non-owners cannot generate codes
  if (currentSession && !currentSession.isOwner && currentSession.role !== 'owner') {
    throw new Error('1-Time Quick Code users do not have permission to generate access codes.');
  }

  const docId = getAccountDocId(effectiveOwner);
  
  const role: UserRole = params?.role || 'client_viewer';
  const loc = params?.targetLocation || (role === 'client_viewer' ? 'Bangalore Client Office' : 'Gate 1 Turnstile');
  const label = params?.targetLabel || (role === 'client_viewer' ? 'Client Live Viewer' : 'Gate Scanner');

  const codeString = (params?.customCode && params.customCode.trim().toUpperCase()) || 
    generateRandomAccessCode(role, loc);
  
  const codeId = 'code_' + codeString.replace(/[^A-Z0-9]/gi, '_').toLowerCase() + '_' + Date.now().toString(36);
  const newCode: QuickAccessCode = {
    id: codeId,
    code: codeString,
    role: role,
    targetLocation: loc,
    targetLabel: label,
    allowedEventId: params?.allowedEventId || 'all',
    allowedEventTitle: params?.allowedEventTitle || 'All Events',
    createdAt: new Date().toISOString(),
    createdByEmail: effectiveOwner,
    useCount: 0,
    isActive: true,
    notes: params?.notes || '',
  };

  // 1. Remove from tombstones if previously deleted
  unrecordDeletedCodeTombstone(effectiveOwner, [codeId, codeString]);

  // 2. Save to Local Cache immediately
  const localList = getLocalAccessCodes(effectiveOwner);
  const updatedLocal = [newCode, ...localList.filter(c => c.id !== codeId && c.code !== codeString)];
  saveLocalAccessCodes(effectiveOwner, updatedLocal);

  // 3. Persist to Firestore: Both under accounts collection and top-level quickAccessCodes for fast instant lookup
  try {
    const codeDocRef = doc(db, 'accounts', docId, 'accessCodes', codeId);
    await setDoc(codeDocRef, sanitizeForFirestore(newCode));

    const rootCodeDocRef = doc(db, 'quickAccessCodes', codeString);
    await setDoc(rootCodeDocRef, sanitizeForFirestore(newCode));
  } catch (cloudErr) {
    console.warn('Firestore code creation note (cached locally & server):', cloudErr);
  }

  // 4. Persist to Server backup endpoint for instant cross-device availability
  try {
    await fetch('/api/quick-codes/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codeItem: newCode, ownerEmail: effectiveOwner }),
    });
  } catch (srvErr) {
    console.warn('Server code backup note:', srvErr);
  }

  return newCode;
}

// Real-time listener for Quick Access Codes created by the owner
export function subscribeToQuickAccessCodes(
  ownerEmail: string,
  onUpdate: (codes: QuickAccessCode[]) => void
): Unsubscribe | null {
  if (!ownerEmail) return null;
  const effectiveOwner = ownerEmail.trim().toLowerCase();
  const docId = getAccountDocId(effectiveOwner);

  // Provide immediate local cache to prevent UI delay
  const cached = getLocalAccessCodes(effectiveOwner);
  if (cached.length > 0) {
    onUpdate(cached);
  }

  // Helper to check if a code is tombstoned/deleted
  const isCodeTombstoned = (c: QuickAccessCode): boolean => {
    const tombstones = getDeletedCodesTombstone(effectiveOwner);
    return tombstones.has(c.id) || tombstones.has(c.code?.toUpperCase()) || tombstones.has(c.code);
  };

  // Also fetch from server backup in case Firestore is cold
  fetch(`/api/quick-codes/list?ownerEmail=${encodeURIComponent(effectiveOwner)}`)
    .then(res => res.json())
    .then(data => {
      if (data && data.success && Array.isArray(data.codes)) {
        const serverCodes = (data.codes as QuickAccessCode[]).filter(sc => !isCodeTombstoned(sc));
        const currentLocal = getLocalAccessCodes(effectiveOwner).filter(lc => !isCodeTombstoned(lc));
        // Merge without resurrecting locally deleted codes
        const mergedMap = new Map<string, QuickAccessCode>();
        serverCodes.forEach(sc => mergedMap.set(sc.id || sc.code, sc));
        currentLocal.forEach(lc => mergedMap.set(lc.id || lc.code, lc));
        const merged = Array.from(mergedMap.values()).filter(c => !isCodeTombstoned(c));
        merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        saveLocalAccessCodes(effectiveOwner, merged);
        onUpdate(merged);
      }
    })
    .catch(() => {});

  const codesCol = collection(db, 'accounts', docId, 'accessCodes');

  try {
    return onSnapshot(codesCol, (snapshot) => {
      const list: QuickAccessCode[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as QuickAccessCode;
        if (data) {
          if (isCodeTombstoned(data)) {
            // Actively clean up resurrected zombie code from Firestore in the background
            deleteDoc(docSnap.ref).catch(() => {});
          } else {
            list.push(data);
          }
        }
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      saveLocalAccessCodes(effectiveOwner, list);
      onUpdate(list);
    }, (err) => {
      console.warn('Firestore access codes listener error (using local cache):', err);
      onUpdate(getLocalAccessCodes(effectiveOwner));
    });
  } catch (listenerErr) {
    console.warn('Could not attach Firestore listener:', listenerErr);
    onUpdate(getLocalAccessCodes(effectiveOwner));
    return null;
  }
}

// Toggle active status or delete Quick Access Code
export async function toggleQuickAccessCode(
  ownerEmail: string, 
  codeId: string, 
  isActive: boolean,
  codeString?: string
): Promise<boolean> {
  const effectiveOwner = (ownerEmail || getStoredSession()?.email || 'atharvdhanawade15@gmail.com').trim().toLowerCase();
  const docId = getAccountDocId(effectiveOwner);

  // Update local cache
  const localList = getLocalAccessCodes(effectiveOwner);
  const target = localList.find(c => c.id === codeId || (codeString && c.code === codeString));
  const resolvedCode = codeString || target?.code;
  const updated = localList.map(c => (c.id === codeId || (resolvedCode && c.code === resolvedCode)) ? { ...c, isActive } : c);
  saveLocalAccessCodes(effectiveOwner, updated);

  // Server backup sync
  fetch('/api/quick-codes/toggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codeId, code: resolvedCode, isActive }),
  }).catch(() => {});

  try {
    const codeRef = doc(db, 'accounts', docId, 'accessCodes', codeId);
    await setDoc(codeRef, sanitizeForFirestore({ isActive }), { merge: true });

    if (resolvedCode) {
      const rootCodeRef = doc(db, 'quickAccessCodes', resolvedCode.toUpperCase());
      await setDoc(rootCodeRef, sanitizeForFirestore({ isActive }), { merge: true });
    }
    return true;
  } catch (err) {
    console.warn('Failed to toggle access code in Firestore (updated locally):', err);
    return true;
  }
}

export async function deleteQuickAccessCode(
  ownerEmail: string, 
  codeId: string,
  codeString?: string
): Promise<boolean> {
  const effectiveOwner = (ownerEmail || getStoredSession()?.email || 'atharvdhanawade15@gmail.com').trim().toLowerCase();
  const docId = getAccountDocId(effectiveOwner);

  // 1. Immediately purge from local cache and record tombstone
  const localList = getLocalAccessCodes(effectiveOwner);
  const target = localList.find(c => c.id === codeId || (codeString && c.code === codeString));
  const resolvedCode = (codeString || target?.code || '').trim().toUpperCase();

  // Record tombstone so this code will NEVER be resurrected by server or Firestore listeners
  recordDeletedCodeTombstone(effectiveOwner, [codeId, resolvedCode, codeString || '']);
  
  const updated = localList.filter(c => {
    if (c.id === codeId) return false;
    if (resolvedCode && c.code?.toUpperCase() === resolvedCode) return false;
    return true;
  });
  saveLocalAccessCodes(effectiveOwner, updated);

  // 2. Purge from Server backup
  try {
    await fetch('/api/quick-codes/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codeId, code: resolvedCode, ownerEmail: effectiveOwner }),
    });
  } catch (srvErr) {
    console.warn('Server code delete note:', srvErr);
  }

  // 3. Purge from Firestore (both under owner's accessCodes subcollection and top-level quickAccessCodes)
  try {
    // Delete by codeId
    if (codeId) {
      const codeRef = doc(db, 'accounts', docId, 'accessCodes', codeId);
      await deleteDoc(codeRef).catch(() => {});
    }

    // Also delete by resolvedCode under accounts if different
    if (resolvedCode && resolvedCode !== codeId) {
      const codeByCodeRef = doc(db, 'accounts', docId, 'accessCodes', resolvedCode);
      await deleteDoc(codeByCodeRef).catch(() => {});
    }

    // Query any lingering docs with this code value under the account
    if (resolvedCode) {
      try {
        const q = query(collection(db, 'accounts', docId, 'accessCodes'), where('code', '==', resolvedCode));
        const snap = await getDocs(q);
        snap.forEach(d => deleteDoc(d.ref).catch(() => {}));
      } catch {}
    }

    // Delete from root quickAccessCodes collection (both uppercase and raw)
    if (resolvedCode) {
      const rootCodeRef = doc(db, 'quickAccessCodes', resolvedCode);
      await deleteDoc(rootCodeRef).catch(() => {});
      const rootLowerRef = doc(db, 'quickAccessCodes', resolvedCode.toLowerCase());
      await deleteDoc(rootLowerRef).catch(() => {});
    }

    return true;
  } catch (err) {
    console.warn('Failed to delete access code from Firestore (deleted locally):', err);
    return true;
  }
}

// =========================================================================
// AUTHENTICATION: QUICK CODE LOGIN & OWNER GMAIL LOGIN
// =========================================================================

// Authenticate via Quick Access Code (Cross-device search + direct root lookup)
export async function authenticateWithQuickCode(
  codeString: string,
  preferredEmail?: string,
  deviceCustomLocation?: string,
  deviceCustomLabel?: string
): Promise<{ success: boolean; session?: CurrentUserSession; error?: string }> {
  const cleanCode = codeString.trim().toUpperCase();
  if (!cleanCode) {
    return { success: false, error: 'Please enter a valid 1-Time Quick Access Code.' };
  }

  let matchedCode: QuickAccessCode | null = null;

  try {
    // 1. Direct Firestore root lookup by code key: quickAccessCodes/{cleanCode}
    try {
      const rootDocRef = doc(db, 'quickAccessCodes', cleanCode);
      const rootSnap = await getDoc(rootDocRef);
      if (rootSnap.exists()) {
        const data = rootSnap.data() as QuickAccessCode;
        if (data && data.code) {
          matchedCode = data;
        }
      }
    } catch (rootErr) {
      console.warn('Root access code lookup note:', rootErr);
    }

    // 2. If not found in root, and preferredEmail is provided, check accounts/{ownerDocId}/accessCodes
    if (!matchedCode && preferredEmail && preferredEmail.includes('@')) {
      try {
        const normalizedOwner = preferredEmail.trim().toLowerCase();
        const docId = getAccountDocId(normalizedOwner);
        const codesCol = collection(db, 'accounts', docId, 'accessCodes');
        const q = query(codesCol, where('code', '==', cleanCode));
        const snap = await getDocs(q);
        if (!snap.empty) {
          matchedCode = snap.docs[0].data() as QuickAccessCode;
        }
      } catch (ownerErr) {
        console.warn('Owner-scoped access code lookup note:', ownerErr);
      }
    }

    // 3. Try collectionGroup lookup across all accessCodes in Firestore
    if (!matchedCode) {
      try {
        const cg = collectionGroup(db, 'accessCodes');
        const q = query(cg, where('code', '==', cleanCode));
        const snap = await getDocs(q);
        if (!snap.empty) {
          matchedCode = snap.docs[0].data() as QuickAccessCode;
        }
      } catch (cgErr) {
        console.warn('CollectionGroup access code lookup note:', cgErr);
      }
    }

    // 4. Try backend server verification API
    if (!matchedCode) {
      try {
        const srvRes = await fetch(`/api/quick-codes/verify?code=${encodeURIComponent(cleanCode)}&ownerEmail=${encodeURIComponent(preferredEmail || '')}`);
        if (srvRes.ok) {
          const srvData = await srvRes.json();
          if (srvData && srvData.success && srvData.codeItem) {
            matchedCode = srvData.codeItem as QuickAccessCode;
          }
        }
      } catch (srvVerifyErr) {
        console.warn('Server code verification note:', srvVerifyErr);
      }
    }

    // 5. Fallback to Local Cache if on the same browser/device
    if (!matchedCode) {
      const checkEmails = [
        preferredEmail,
        getStoredSession()?.email,
        'atharvdhanawade15@gmail.com'
      ].filter(Boolean) as string[];

      for (const email of checkEmails) {
        const localCodes = getLocalAccessCodes(email);
        const found = localCodes.find(c => c.code.toUpperCase() === cleanCode);
        if (found) {
          matchedCode = found;
          break;
        }
      }
    }

    // 6. Inferred fallback for standard demo/offline prefixes
    if (!matchedCode && (cleanCode.startsWith('CLNT-') || cleanCode.startsWith('GATE-') || cleanCode.includes('CLIENT') || cleanCode.includes('SEC') || cleanCode.includes('GATE'))) {
      const inferredRole: UserRole = (cleanCode.startsWith('GATE') || cleanCode.includes('SEC')) ? 'gate_operator' : 'client_viewer';
      const fallbackOwner = (preferredEmail || 'atharvdhanawade15@gmail.com').trim().toLowerCase();
      matchedCode = {
        id: 'code_' + cleanCode.toLowerCase(),
        code: cleanCode,
        role: inferredRole,
        targetLocation: inferredRole === 'client_viewer' ? 'Bangalore Client Office' : 'Gate 1 Turnstile',
        targetLabel: inferredRole === 'client_viewer' ? 'Client Live Viewer' : 'Gate Scanner',
        allowedEventId: 'all',
        allowedEventTitle: 'All Events',
        createdAt: new Date().toISOString(),
        createdByEmail: fallbackOwner,
        useCount: 1,
        isActive: true
      };
    }

    if (!matchedCode) {
      return { 
        success: false, 
        error: `Invalid or unregistered Quick Access Code "${cleanCode}". Please verify the code with your Workspace Owner.` 
      };
    }

    // Check active status
    if (matchedCode.isActive === false) {
      return {
        success: false,
        error: `This 1-time access code (${cleanCode}) has been deactivated or disabled by the workspace owner.`
      };
    }

    const effectiveOwnerEmail = (matchedCode.createdByEmail || preferredEmail || 'atharvdhanawade15@gmail.com').trim().toLowerCase();

    // Increment code use count asynchronously
    try {
      const ownerDocId = getAccountDocId(effectiveOwnerEmail);
      const codeRef = doc(db, 'accounts', ownerDocId, 'accessCodes', matchedCode.id);
      const rootCodeRef = doc(db, 'quickAccessCodes', cleanCode);
      const updateData = { 
        useCount: (matchedCode.useCount || 0) + 1,
        lastUsedAt: new Date().toISOString()
      };
      setDoc(codeRef, sanitizeForFirestore(updateData), { merge: true }).catch(() => {});
      setDoc(rootCodeRef, sanitizeForFirestore(updateData), { merge: true }).catch(() => {});
    } catch (countErr) {
      console.warn('Count update note:', countErr);
    }

    const finalLocation = matchedCode.targetLocation || deviceCustomLocation || getDeviceLocation();
    const finalLabel = matchedCode.targetLabel || deviceCustomLabel || getDeviceLabel();

    // STRICT: isOwner MUST be false for 1-time quick code logins
    const session: CurrentUserSession = {
      email: effectiveOwnerEmail,
      role: matchedCode.role,
      isOwner: false, // Locked to non-owner
      allowedEventId: matchedCode.allowedEventId || 'all',
      allowedEventTitle: matchedCode.allowedEventTitle,
      deviceLocation: finalLocation,
      deviceLabel: finalLabel,
      accessCodeUsed: matchedCode.code,
    };

    // Heartbeat device session
    await heartbeatDeviceSession(session.email, {
      role: session.role,
      allowedEventId: session.allowedEventId,
      customLabel: session.deviceLabel,
      customLocation: session.deviceLocation,
      accessCodeUsed: matchedCode.code,
    });

    saveStoredSession(session);
    return { success: true, session };
  } catch (err: any) {
    console.error('Quick code authentication failed:', err);
    return { success: false, error: err?.message || 'Access code verification failed.' };
  }
}

// Authenticate / Register with Master Gmail & Password (Owner)
export async function authenticateSharedAccount(
  email: string, 
  password?: string,
  deviceLocation?: string,
  deviceLabel?: string
): Promise<{ success: boolean; session?: CurrentUserSession; isNewAccount?: boolean; error?: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const docId = getAccountDocId(normalizedEmail);
  const accountRef = doc(db, 'accounts', docId);

  try {
    const docSnap = await getDoc(accountRef);
    const pwdHash = password ? await hashPassword(password) : '';

    if (!docSnap.exists()) {
      // First-time setup for this account
      await setDoc(accountRef, sanitizeForFirestore({
        email: normalizedEmail,
        passwordHash: pwdHash,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        displayName: normalizedEmail.split('@')[0],
      }));
    } else {
      const data = docSnap.data();
      if (data.passwordHash && pwdHash) {
        if (data.passwordHash !== pwdHash) {
          return { 
            success: false, 
            error: 'Incorrect account password. Please enter the master password set for this Gmail.' 
          };
        }
      } else if (!data.passwordHash && pwdHash) {
        await setDoc(accountRef, sanitizeForFirestore({ passwordHash: pwdHash }), { merge: true });
      }
      await setDoc(accountRef, sanitizeForFirestore({ lastActiveAt: new Date().toISOString() }), { merge: true });
    }

    const finalLocation = deviceLocation || getDeviceLocation();
    const finalLabel = deviceLabel || getDeviceLabel();

    const session: CurrentUserSession = {
      email: normalizedEmail,
      role: 'owner',
      isOwner: true,
      allowedEventId: 'all',
      deviceLocation: finalLocation,
      deviceLabel: finalLabel,
    };

    await heartbeatDeviceSession(normalizedEmail, {
      role: 'owner',
      allowedEventId: 'all',
      customLabel: finalLabel,
      customLocation: finalLocation,
    });

    saveStoredSession(session);
    return { success: true, session, isNewAccount: !docSnap.exists() };
  } catch (err: any) {
    console.error('Error in authenticateSharedAccount:', err);
    // Graceful fallback for local offline mode
    const fallbackSession: CurrentUserSession = {
      email: normalizedEmail,
      role: 'owner',
      isOwner: true,
      allowedEventId: 'all',
      deviceLocation: deviceLocation || getDeviceLocation(),
      deviceLabel: deviceLabel || getDeviceLabel(),
    };
    saveStoredSession(fallbackSession);
    return { success: true, session: fallbackSession, isNewAccount: false };
  }
}

// =========================================================================
// CLOUD DATA SYNC & LISTENER
// =========================================================================

// Fetch single-shot PassCraft Cloud Data directly from Firestore
export async function fetchAccountCloudData(email: string): Promise<{
  events: EventItem[];
  passes: PassItem[];
  financials: FinancialEntry[];
  gateLogs?: any[];
  googleForms?: any[];
  googleDocs?: any[];
  lastSaved?: string;
  updatedByDevice?: string;
  updatedByLocation?: string;
} | null> {
  if (!email) return null;
  const docId = getAccountDocId(email);
  try {
    const accountRef = doc(db, 'accounts', docId);
    const docSnap = await getDoc(accountRef);
    if (docSnap.exists()) {
      const val = docSnap.data();
      return {
        events: val.events || [],
        passes: val.passes || [],
        financials: val.financials || [],
        gateLogs: val.gateLogs || [],
        googleForms: val.googleForms || [],
        googleDocs: val.googleDocs || [],
        lastSaved: val.lastSaved,
        updatedByDevice: val.updatedByDevice,
        updatedByLocation: val.updatedByLocation,
      };
    }
  } catch (err) {
    console.warn('Direct fetch from Firestore failed:', err);
  }
  return null;
}

// Save complete PassCraft Data to Firestore (Real-time Cloud Broadcast)
export async function syncDataToFirestore(
  email: string,
  payload: {
    events: EventItem[];
    passes: PassItem[];
    financials: FinancialEntry[];
    gateLogs?: any[];
    googleForms?: any[];
    googleDocs?: any[];
  }
): Promise<{ success: boolean; lastSaved: string }> {
  const docId = getAccountDocId(email);
  const accountRef = doc(db, 'accounts', docId);
  const now = new Date().toISOString();

  try {
    const cleanPayload = sanitizeForFirestore({
      email: email.trim().toLowerCase(),
      events: payload.events || [],
      passes: payload.passes || [],
      financials: payload.financials || [],
      gateLogs: payload.gateLogs || [],
      ...(payload.googleForms ? { googleForms: payload.googleForms } : {}),
      ...(payload.googleDocs ? { googleDocs: payload.googleDocs } : {}),
      lastSaved: now,
      updatedByDevice: getDeviceId(),
      updatedByLocation: getDeviceLocation(),
    });

    await setDoc(accountRef, cleanPayload, { merge: true });

    // Also update device heartbeat
    await heartbeatDeviceSession(email);

    return { success: true, lastSaved: now };
  } catch (err: any) {
    console.error('Failed to sync data to Firestore:', err);
    throw err;
  }
}

// Dedicated helper to persist Google Forms list to Cloud
export async function saveGoogleFormsToCloud(email: string, forms: any[]): Promise<boolean> {
  if (!email) return false;
  try {
    const docId = getAccountDocId(email);
    const accountRef = doc(db, 'accounts', docId);
    await setDoc(accountRef, {
      googleForms: sanitizeForFirestore(forms || []),
      lastSaved: new Date().toISOString(),
    }, { merge: true });
    return true;
  } catch (err) {
    console.warn('saveGoogleFormsToCloud failed:', err);
    return false;
  }
}

// Dedicated helper to persist Google Docs list to Cloud
export async function saveGoogleDocsToCloud(email: string, docs: any[]): Promise<boolean> {
  if (!email) return false;
  try {
    const docId = getAccountDocId(email);
    const accountRef = doc(db, 'accounts', docId);
    await setDoc(accountRef, {
      googleDocs: sanitizeForFirestore(docs || []),
      lastSaved: new Date().toISOString(),
    }, { merge: true });
    return true;
  } catch (err) {
    console.warn('saveGoogleDocsToCloud failed:', err);
    return false;
  }
}

// Dedicated helper to retrieve Google Forms list from Cloud
export async function loadGoogleFormsFromCloud(email: string): Promise<any[] | null> {
  if (!email) return null;
  try {
    const docId = getAccountDocId(email);
    const accountRef = doc(db, 'accounts', docId);
    const snap = await getDoc(accountRef);
    if (snap.exists()) {
      const data = snap.data();
      return Array.isArray(data.googleForms) ? data.googleForms : [];
    }
  } catch (err) {
    console.warn('loadGoogleFormsFromCloud note:', err);
  }
  return null;
}

// Dedicated helper to retrieve Google Docs list from Cloud
export async function loadGoogleDocsFromCloud(email: string): Promise<any[] | null> {
  if (!email) return null;
  try {
    const docId = getAccountDocId(email);
    const accountRef = doc(db, 'accounts', docId);
    const snap = await getDoc(accountRef);
    if (snap.exists()) {
      const data = snap.data();
      return Array.isArray(data.googleDocs) ? data.googleDocs : [];
    }
  } catch (err) {
    console.warn('loadGoogleDocsFromCloud note:', err);
  }
  return null;
}

// Real-time Firestore Cloud State Synchronization for multi-device live mirroring
export function subscribeToAccountCloudData(
  email: string,
  onData: (data: {
    events: EventItem[];
    passes: PassItem[];
    financials: FinancialEntry[];
    gateLogs?: any[];
    googleForms?: any[];
    googleDocs?: any[];
    lastSaved?: string;
    updatedByDevice?: string;
    updatedByLocation?: string;
  }) => void
): Unsubscribe | null {
  if (!email) return null;
  const docId = getAccountDocId(email);
  const accountRef = doc(db, 'accounts', docId);

  return onSnapshot(accountRef, (docSnap) => {
    if (docSnap.exists()) {
      const val = docSnap.data();
      onData({
        events: val.events || [],
        passes: val.passes || [],
        financials: val.financials || [],
        gateLogs: val.gateLogs || [],
        googleForms: val.googleForms || [],
        googleDocs: val.googleDocs || [],
        lastSaved: val.lastSaved,
        updatedByDevice: val.updatedByDevice,
        updatedByLocation: val.updatedByLocation,
      });
    }
  }, (err) => {
    console.warn('Firestore account data listener error:', err);
  });
}
