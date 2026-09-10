import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  User 
} from 'firebase/auth';
import { auth } from './firebase';

export { auth };

// Google Auth Provider with full Workspace scopes (Docs, Forms, Sheets, Drive)
export const workspaceGoogleProvider = new GoogleAuthProvider();
workspaceGoogleProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
workspaceGoogleProvider.addScope('https://www.googleapis.com/auth/documents');
workspaceGoogleProvider.addScope('https://www.googleapis.com/auth/documents.readonly');
workspaceGoogleProvider.addScope('https://www.googleapis.com/auth/forms.body');
workspaceGoogleProvider.addScope('https://www.googleapis.com/auth/forms.body.readonly');
workspaceGoogleProvider.addScope('https://www.googleapis.com/auth/forms.responses.readonly');
workspaceGoogleProvider.addScope('https://www.googleapis.com/auth/drive');
workspaceGoogleProvider.addScope('https://www.googleapis.com/auth/drive.file');
workspaceGoogleProvider.addScope('https://www.googleapis.com/auth/drive.readonly');

const TOKEN_KEY = 'passcraft_google_workspace_token';
const TOKEN_SAVED_AT_KEY = 'passcraft_workspace_token_saved_at';
const USER_EMAIL_KEY = 'passcraft_google_workspace_user_email';
const MAX_TOKEN_AGE_MS = 50 * 60 * 1000; // 50 minutes (Google tokens expire at 60m)

// Mutex to prevent multiple concurrent signInWithPopup requests causing Firebase Auth assertion race conditions
let activeWorkspaceAuthPromise: Promise<{ user: User | null; accessToken: string }> | null = null;

let cachedAccessToken: string | null = (() => {
  try {
    const savedAt = localStorage.getItem(TOKEN_SAVED_AT_KEY);
    if (savedAt && Date.now() - Number(savedAt) > MAX_TOKEN_AGE_MS) {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_SAVED_AT_KEY);
      return null;
    }
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  } catch (e) {
    return null;
  }
})();

export function invalidateWorkspaceAccessToken() {
  cachedAccessToken = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_SAVED_AT_KEY);
  } catch (e) {}
}

export function getWorkspaceAccessToken(): string | null {
  try {
    const savedAt = localStorage.getItem(TOKEN_SAVED_AT_KEY);
    if (savedAt && Date.now() - Number(savedAt) > MAX_TOKEN_AGE_MS) {
      invalidateWorkspaceAccessToken();
      return null;
    }
  } catch (e) {}

  if (cachedAccessToken) {
    return cachedAccessToken;
  }
  try {
    const stored = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    if (stored) {
      cachedAccessToken = stored;
      return stored;
    }
  } catch (e) {}
  return null;
}

export function setWorkspaceAccessToken(token: string | null) {
  cachedAccessToken = token;
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      sessionStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(TOKEN_SAVED_AT_KEY, String(Date.now()));
    } else {
      invalidateWorkspaceAccessToken();
    }
  } catch (e) {}
}

/**
 * Checks if the given Google OAuth access token is valid and active with Google's tokeninfo endpoint
 */
export async function checkWorkspaceTokenValidity(token: string): Promise<boolean> {
  if (!token) return false;
  try {
    const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${encodeURIComponent(token)}`);
    if (!response.ok) return false;
    const data = await response.json();
    if (data.expires_in && Number(data.expires_in) <= 30) {
      return false; // Token is on the verge of expiring
    }
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Detects if an error is due to the user closing or cancelling the Google sign-in popup
 */
export function isUserAuthCancellation(err: any): boolean {
  if (!err) return false;
  const code = typeof err.code === 'string' ? err.code : '';
  const message = typeof err.message === 'string' ? err.message : '';
  return (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request' ||
    code === 'auth/popup-blocked' ||
    message.includes('popup-closed-by-user') ||
    message.includes('cancelled-popup-request') ||
    message.includes('popup-blocked') ||
    message.includes('closed-by-user')
  );
}

export async function connectGoogleWorkspaceAuth(forceReauth: boolean = false): Promise<{ user: User | null; accessToken: string }> {
  if (!forceReauth) {
    const existingToken = getWorkspaceAccessToken();
    if (existingToken) {
      const isValid = await checkWorkspaceTokenValidity(existingToken);
      if (isValid) {
        return { user: auth.currentUser, accessToken: existingToken };
      }
      // Token is stale or invalid; clear it
      invalidateWorkspaceAccessToken();
    }
  }

  // If a popup operation is already in flight, reuse the ongoing promise
  if (activeWorkspaceAuthPromise) {
    return activeWorkspaceAuthPromise;
  }

  const authPromise = (async () => {
    try {
      // Ensure user is prompted to consent and pick account if forcing reauth
      if (forceReauth) {
        workspaceGoogleProvider.setCustomParameters({ prompt: 'select_account' });
      }

      let result: any;
      try {
        result = await signInWithPopup(auth, workspaceGoogleProvider);
      } catch (popupErr: any) {
        const msg = popupErr?.message || '';
        if (
          msg.includes('INTERNAL ASSERTION FAILED') ||
          msg.includes('Pending promise was never set') ||
          isUserAuthCancellation(popupErr)
        ) {
          console.warn('Google Workspace sign-in was cancelled or closed.');
          const cancelErr = new Error('Google Workspace sign-in was cancelled. Please try again when ready.');
          (cancelErr as any).isCancelled = true;
          (cancelErr as any).isUserCancellation = true;
          (cancelErr as any).code = popupErr?.code || 'auth/popup-closed-by-user';
          throw cancelErr;
        }
        throw popupErr;
      }

      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error('Could not obtain Google Workspace access token. Please ensure popup was approved.');
      }
      setWorkspaceAccessToken(credential.accessToken);
      if (result.user?.email) {
        localStorage.setItem(USER_EMAIL_KEY, result.user.email);
      }
      return { user: result.user, accessToken: credential.accessToken };
    } catch (err: any) {
      if (isUserAuthCancellation(err)) {
        console.warn('Google Workspace sign in: popup closed or cancelled by user.');
        const cancelErr = new Error('Google Workspace sign-in popup was closed or cancelled. Please try again when ready.');
        (cancelErr as any).isCancelled = true;
        (cancelErr as any).isUserCancellation = true;
        (cancelErr as any).code = err.code || 'auth/popup-closed-by-user';
        throw cancelErr;
      }
      console.error('Google Workspace sign in error:', err);
      throw err;
    } finally {
      activeWorkspaceAuthPromise = null;
    }
  })();

  activeWorkspaceAuthPromise = authPromise;
  return authPromise;
}
