import React, { useState, useEffect, useRef } from 'react';
import { ActiveTab, EventItem, PassItem, FinancialEntry, DeviceSession, CurrentUserSession } from './types';
import { 
  loadEventsFromStorage, 
  saveEventsToStorage, 
  loadPassesFromStorage, 
  savePassesToStorage,
  loadFinancialsFromStorage,
  saveFinancialsToStorage,
  getPassGatesUsed,
  ALL_SHEET_COLUMNS,
  DEFAULT_PEOPLE_COLUMN_KEYS,
  DEFAULT_CHECKIN_COLUMN_KEYS,
  formatPassColumnValue,
  SheetColumnDef
} from './lib/passUtils';
import { safeFetchJson } from './lib/apiHelper';
import { 
  subscribeToAccountCloudData, 
  subscribeToActiveDevices, 
  subscribeToCurrentDeviceStatus,
  syncDataToFirestore, 
  fetchAccountCloudData,
  heartbeatDeviceSession, 
  authenticateSharedAccount,
  authenticateWithQuickCode,
  getStoredSession,
  saveStoredSession,
  getDeviceLabel,
  getDeviceLocation
} from './lib/firebase';
import { 
  extractSpreadsheetId, 
  getGoogleAccessToken, 
  syncPassesToGoogleSheetApi 
} from './lib/googleSheetsService';
import { Header } from './components/Header';
import { EventsPage } from './components/EventsPage';
import { BatchGenerator } from './components/BatchGenerator';
import { QRScanAssigner } from './components/QRScanAssigner';
import { GateScannerPage } from './components/GateScannerPage';
import { PassesRegistry } from './components/PassesRegistry';
import { AssignedPasses } from './components/AssignedPasses';
import { UnassignedQueue } from './components/UnassignedQueue';
import { PassDocsAndTransferHub } from './components/PassDocsAndTransferHub';
import { AIPassStudio } from './components/AIPassStudio';
import { FinancialsPage } from './components/FinancialsPage';
import { EmailTicketDispatcher } from './components/EmailTicketDispatcher';
import { RulesBomber } from './components/RulesBomber';
import { ThankYouPage } from './components/ThankYouPage';
import { GmailLoginModal } from './components/GmailLoginModal';

export default function App() {
  const [currentSession, setCurrentSession] = useState<CurrentUserSession | null>(() => getStoredSession());
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(() => {
    return currentSession?.email || localStorage.getItem('passcraft_user_email') || null;
  });

  const isGateOperator = currentSession?.role === 'gate_operator';
  const isClientViewer = currentSession?.role === 'client_viewer';
  const isOwner = !currentSession || currentSession.isOwner || currentSession.role === 'owner';
  const isScopedEvent = Boolean(currentSession?.allowedEventId && currentSession.allowedEventId !== 'all');

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    if (isGateOperator) return 'gate_scanner';
    return 'events';
  });

  const [events, setEvents] = useState<EventItem[]>(() => loadEventsFromStorage());
  const [passes, setPasses] = useState<PassItem[]>(() => loadPassesFromStorage());
  const [financials, setFinancials] = useState<FinancialEntry[]>(() => loadFinancialsFromStorage());
  
  // Persist selectedEventId in localStorage across refreshes
  const [selectedEventId, setSelectedEventId] = useState<string>(() => {
    if (currentSession?.allowedEventId && currentSession.allowedEventId !== 'all') {
      return currentSession.allowedEventId;
    }
    try {
      const saved = localStorage.getItem('passcraft_selected_event_id');
      if (saved) return saved;
    } catch (e) {}
    return 'all';
  });

  const handleSelectEvent = (eventId: string) => {
    // If user has a locked event scope, don't allow switching to other events
    if (isScopedEvent && currentSession?.allowedEventId) {
      setSelectedEventId(currentSession.allowedEventId);
      return;
    }
    setSelectedEventId(eventId);
    try {
      localStorage.setItem('passcraft_selected_event_id', eventId);
    } catch (e) {}
  };

  const [isInitialized, setIsInitialized] = useState(true);
  const [isGmailModalOpen, setIsGmailModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [activeDevices, setActiveDevices] = useState<DeviceSession[]>([]);
  const [disconnectedNotice, setDisconnectedNotice] = useState<string | null>(null);

  // Ref to prevent cyclical echo when remote updates arrive from Firestore
  const isApplyingRemoteRef = useRef(false);
  const lastLocalMutationTimestamp = useRef<number>(0);

  // Real-time listener for device revocation (If owner kicks this device, auto-logout immediately)
  useEffect(() => {
    if (!currentUserEmail) return;
    const unsubRevoke = subscribeToCurrentDeviceStatus(currentUserEmail, () => {
      setDisconnectedNotice('⚠️ Session Disconnected: This device was removed from the workspace by the owner.');
      handleGmailLogout();
    });
    return () => {
      if (unsubRevoke) unsubRevoke();
    };
  }, [currentUserEmail]);

  // Auto-sync helper to connected Google Sheet (Dual Tab)
  const triggerGoogleSheetAutoSync = async (updatedPasses: PassItem[]) => {
    try {
      const autoSync = localStorage.getItem('passcraft_gsheet_autosync') === 'true';
      const sheetUrl = localStorage.getItem('passcraft_gsheet_url') || '';
      const peopleTab = localStorage.getItem('passcraft_gsheet_tab_people') || localStorage.getItem('passcraft_gsheet_tab') || 'PassCraft Roster';
      const checkinTab = localStorage.getItem('passcraft_gsheet_tab_checkin') || 'Check-in & Gate Activity';
      const webhookUrl = localStorage.getItem('passcraft_gsheet_webhook');

      if (!autoSync) return;

      const activePasses = updatedPasses.filter(p => p.status === 'assigned' || p.status === 'checked_in');

      // 1. Resolve selected columns from localStorage preferences (or fallback to defaults)
      let peopleColKeys: string[] = DEFAULT_PEOPLE_COLUMN_KEYS;
      try {
        const savedPeopleCols = localStorage.getItem('passcraft_gsheet_cols_people');
        if (savedPeopleCols) {
          const parsed = JSON.parse(savedPeopleCols);
          if (Array.isArray(parsed) && parsed.length > 0) peopleColKeys = parsed;
        }
      } catch (e) {}

      let checkinColKeys: string[] = DEFAULT_CHECKIN_COLUMN_KEYS;
      try {
        const savedCheckinCols = localStorage.getItem('passcraft_gsheet_cols_checkin');
        if (savedCheckinCols) {
          const parsed = JSON.parse(savedCheckinCols);
          if (Array.isArray(parsed) && parsed.length > 0) checkinColKeys = parsed;
        }
      } catch (e) {}

      const peopleSchema = peopleColKeys
        .map(k => ALL_SHEET_COLUMNS.find(c => c.key === k))
        .filter((c): c is SheetColumnDef => Boolean(c));

      const checkinSchema = checkinColKeys
        .map(k => ALL_SHEET_COLUMNS.find(c => c.key === k))
        .filter((c): c is SheetColumnDef => Boolean(c));

      // 1. Sheet 1: People & Pass Info
      const peopleHeaders = peopleSchema.map(c => c.header);
      const peopleRows = activePasses.map((p, rowIdx) => 
        peopleSchema.map(c => formatPassColumnValue(p, c.key, rowIdx + 2))
      );

      // 2. Sheet 2: Check-in Timestamp & Gates Used (Dedicated turnstile logs)
      const checkinHeaders = checkinSchema.map(c => c.header);
      const checkinRows = activePasses.map((p, rowIdx) => 
        checkinSchema.map(c => formatPassColumnValue(p, c.key, rowIdx + 2))
      );

      // Method 1: Google Sheets Direct REST API (if user connected via OAuth)
      const sheetId = extractSpreadsheetId(sheetUrl);
      const token = await getGoogleAccessToken();
      if (sheetId && token) {
        // Sync Sheet 1 (People Info)
        syncPassesToGoogleSheetApi(sheetId, peopleTab, peopleHeaders, peopleRows, token, 'replace_all', {
          headerBgColor: { red: 0.0588, green: 0.0902, blue: 0.1647 }
        }).catch(err => console.warn('Auto-sync people tab note:', err));

        // Sync Sheet 2 (Check-in & Gate Activity)
        syncPassesToGoogleSheetApi(sheetId, checkinTab, checkinHeaders, checkinRows, token, 'replace_all', {
          headerBgColor: { red: 0.035, green: 0.18, blue: 0.14 }
        }).then(() => {
          const now = new Date().toLocaleTimeString();
          localStorage.setItem('passcraft_gsheet_last_sync', now);
        }).catch(err => console.warn('Auto-sync checkin tab note:', err));
      }

      // Method 2: Webhook Relay fallback if configured
      if (webhookUrl && webhookUrl.startsWith('http')) {
        safeFetchJson('/api/sheets/push-webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            webhookUrl,
            payload: {
              action: 'autosync',
              tabName: checkinTab,
              headers: checkinHeaders,
              rows: checkinRows
            }
          })
        }).catch(() => {});
      }
    } catch (e) {
      console.warn('Auto-sync execution error:', e);
    }
  };

  // Immediate Cloud Data Hydration on Startup or User Change
  useEffect(() => {
    if (!currentUserEmail) return;
    let isCancelled = false;

    async function loadCloudDataImmediately() {
      try {
        isApplyingRemoteRef.current = true;
        const cloudData = await fetchAccountCloudData(currentUserEmail!);
        if (isCancelled) return;

        if (cloudData) {
          if (Array.isArray(cloudData.events) && cloudData.events.length > 0) {
            setEvents(cloudData.events);
            saveEventsToStorage(cloudData.events);
          }
          if (Array.isArray(cloudData.passes) && cloudData.passes.length > 0) {
            setPasses(cloudData.passes);
            savePassesToStorage(cloudData.passes);
          }
          if (Array.isArray(cloudData.financials) && cloudData.financials.length > 0) {
            setFinancials(cloudData.financials);
            saveFinancialsToStorage(cloudData.financials);
          }
          if (cloudData.lastSaved) {
            setLastSaved(cloudData.lastSaved);
          }
        } else {
          // Backup fallback from server store
          const res = await safeFetchJson<{ success: boolean; data: any }>(`/api/user/load-data?email=${encodeURIComponent(currentUserEmail!)}`);
          if (res.ok && res.data?.data && !isCancelled) {
            const d = res.data.data;
            if (Array.isArray(d.events) && d.events.length > 0) {
              setEvents(d.events);
              saveEventsToStorage(d.events);
            }
            if (Array.isArray(d.passes) && d.passes.length > 0) {
              setPasses(d.passes);
              savePassesToStorage(d.passes);
            }
            if (Array.isArray(d.financials) && d.financials.length > 0) {
              setFinancials(d.financials);
              saveFinancialsToStorage(d.financials);
            }
          }
        }
      } catch (err) {
        console.warn('Initial cloud hydration note:', err);
      } finally {
        setTimeout(() => {
          isApplyingRemoteRef.current = false;
        }, 600);
      }
    }

    loadCloudDataImmediately();

    return () => {
      isCancelled = true;
    };
  }, [currentUserEmail]);

  // Real-time Firestore Cloud Subscription & Active Devices Tracking
  useEffect(() => {
    if (!currentUserEmail) {
      setActiveDevices([]);
      return;
    }

    // 1. Initial Device Heartbeat with session attributes
    heartbeatDeviceSession(currentUserEmail, {
      role: currentSession?.role || 'owner',
      allowedEventId: currentSession?.allowedEventId || 'all',
      customLabel: currentSession?.deviceLabel || getDeviceLabel(),
      customLocation: currentSession?.deviceLocation || getDeviceLocation(),
      accessCodeUsed: currentSession?.accessCodeUsed,
    });

    // 2. Periodic Device Ping Heartbeat every 30s
    const heartbeatInterval = setInterval(() => {
      heartbeatDeviceSession(currentUserEmail, {
        role: currentSession?.role || 'owner',
        allowedEventId: currentSession?.allowedEventId || 'all',
        customLabel: currentSession?.deviceLabel || getDeviceLabel(),
        customLocation: currentSession?.deviceLocation || getDeviceLocation(),
      });
    }, 30000);

    // 3. Subscribe to Active Devices
    const unsubDevices = subscribeToActiveDevices(currentUserEmail, (devices) => {
      setActiveDevices(devices);
    });

    // 4. Subscribe to Realtime Account Data changes from ANY device
    const unsubData = subscribeToAccountCloudData(currentUserEmail, (remoteData) => {
      const now = Date.now();
      if (now - lastLocalMutationTimestamp.current < 1500) {
        return;
      }

      isApplyingRemoteRef.current = true;
      if (remoteData.events && Array.isArray(remoteData.events) && remoteData.events.length > 0) {
        setEvents(remoteData.events);
        saveEventsToStorage(remoteData.events);
      }
      if (remoteData.passes && Array.isArray(remoteData.passes) && remoteData.passes.length > 0) {
        setPasses(remoteData.passes);
        savePassesToStorage(remoteData.passes);
      }
      if (remoteData.financials && Array.isArray(remoteData.financials) && remoteData.financials.length > 0) {
        setFinancials(remoteData.financials);
        saveFinancialsToStorage(remoteData.financials);
      }
      if (remoteData.lastSaved) {
        setLastSaved(remoteData.lastSaved);
      }
      setTimeout(() => {
        isApplyingRemoteRef.current = false;
      }, 400);
    });

    return () => {
      clearInterval(heartbeatInterval);
      if (unsubDevices) unsubDevices();
      if (unsubData) unsubData();
    };
  }, [currentUserEmail, currentSession]);

  // Sync to Cloud DB (Firestore + redundant local server API)
  const syncToCloud = async (
    email: string, 
    evts: EventItem[], 
    pss: PassItem[], 
    fins?: FinancialEntry[]
  ) => {
    if (!email || isApplyingRemoteRef.current) return;
    lastLocalMutationTimestamp.current = Date.now();
    setIsSyncing(true);

    try {
      // 1. Primary Real-time Sync to Firebase Firestore
      const firestoreResult = await syncDataToFirestore(email, {
        events: evts,
        passes: pss,
        financials: fins || financials,
      });
      if (firestoreResult.lastSaved) {
        setLastSaved(firestoreResult.lastSaved);
      }

      // 2. Backup to server file store
      safeFetchJson<{ success: boolean; lastSaved?: string }>('/api/user/save-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, events: evts, passes: pss, financials: fins || financials }),
      }).catch(() => {});

    } catch (err) {
      console.warn('Sync to Firestore failed, attempting fallback server save:', err);
      try {
        const res = await safeFetchJson<{ success: boolean; lastSaved?: string }>('/api/user/save-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, events: evts, passes: pss, financials: fins || financials }),
        });
        if (res.ok && res.data?.lastSaved) {
          setLastSaved(res.data.lastSaved);
        }
      } catch (fallbackErr) {
        console.error('All cloud sync attempts failed:', fallbackErr);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Sync state to LocalStorage and trigger Cloud Sync on local mutation
  useEffect(() => {
    if (isInitialized && !isApplyingRemoteRef.current) {
      saveEventsToStorage(events);
      savePassesToStorage(passes);
      saveFinancialsToStorage(financials);
      if (currentUserEmail && (isOwner || !isClientViewer)) {
        syncToCloud(currentUserEmail, events, passes, financials);
      }
    }
  }, [events, passes, financials, isInitialized, currentUserEmail, isOwner, isClientViewer]);

  // Master Owner Login Handler
  const handleGmailLogin = async (
    email: string, 
    password?: string, 
    deviceLabel?: string, 
    deviceLocation?: string
  ): Promise<{ success: boolean; error?: string }> => {
    // If a non-owner (or already authenticated quick-code user) initiates sync without password, refresh cloud workspace data
    if (!password && currentSession && !currentSession.isOwner) {
      setIsSyncing(true);
      try {
        const cloudData = await fetchAccountCloudData(currentUserEmail || currentSession.email);
        if (cloudData) {
          if (Array.isArray(cloudData.events) && cloudData.events.length > 0) {
            setEvents(cloudData.events);
            saveEventsToStorage(cloudData.events);
          }
          if (Array.isArray(cloudData.passes) && cloudData.passes.length > 0) {
            setPasses(cloudData.passes);
            savePassesToStorage(cloudData.passes);
          }
        }
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Sync failed.' };
      } finally {
        setIsSyncing(false);
      }
    }

    setIsSyncing(true);
    try {
      const authRes = await authenticateSharedAccount(email, password, deviceLocation, deviceLabel);
      if (!authRes.success && authRes.error) {
        setIsSyncing(false);
        return { success: false, error: authRes.error };
      }

      const session: CurrentUserSession = authRes.session || {
        email: email.trim().toLowerCase(),
        role: 'owner',
        isOwner: true,
        allowedEventId: 'all',
        deviceLocation: deviceLocation || getDeviceLocation(),
        deviceLabel: deviceLabel || getDeviceLabel(),
      };

      setCurrentUserEmail(session.email);
      setCurrentSession(session);
      saveStoredSession(session);

      // Hydrate from cloud immediately
      isApplyingRemoteRef.current = true;
      try {
        const cloudData = await fetchAccountCloudData(session.email);
        if (cloudData) {
          if (Array.isArray(cloudData.events) && cloudData.events.length > 0) {
            setEvents(cloudData.events);
            saveEventsToStorage(cloudData.events);
          }
          if (Array.isArray(cloudData.passes) && cloudData.passes.length > 0) {
            setPasses(cloudData.passes);
            savePassesToStorage(cloudData.passes);
          }
          if (Array.isArray(cloudData.financials) && cloudData.financials.length > 0) {
            setFinancials(cloudData.financials);
            saveFinancialsToStorage(cloudData.financials);
          }
        }
      } finally {
        setTimeout(() => {
          isApplyingRemoteRef.current = false;
        }, 500);
      }

      setIsGmailModalOpen(false);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Login failed. Please try again.' };
    } finally {
      setIsSyncing(false);
    }
  };

  // 1-Time Quick Code Login Handler
  const handleLoginWithCode = async (
    code: string,
    email?: string,
    deviceLocation?: string,
    deviceLabel?: string
  ): Promise<{ success: boolean; error?: string }> => {
    setIsSyncing(true);
    try {
      const authRes = await authenticateWithQuickCode(code, email, deviceLocation, deviceLabel);
      if (!authRes.success || !authRes.session) {
        setIsSyncing(false);
        return { success: false, error: authRes.error || 'Invalid or expired Quick Access Code' };
      }

      setCurrentUserEmail(authRes.session.email);
      setCurrentSession(authRes.session);
      saveStoredSession(authRes.session);

      // Immediately fetch cloud workspace data
      isApplyingRemoteRef.current = true;
      try {
        const cloudData = await fetchAccountCloudData(authRes.session.email);
        if (cloudData) {
          if (Array.isArray(cloudData.events) && cloudData.events.length > 0) {
            setEvents(cloudData.events);
            saveEventsToStorage(cloudData.events);
          }
          if (Array.isArray(cloudData.passes) && cloudData.passes.length > 0) {
            setPasses(cloudData.passes);
            savePassesToStorage(cloudData.passes);
          }
          if (Array.isArray(cloudData.financials) && cloudData.financials.length > 0) {
            setFinancials(cloudData.financials);
            saveFinancialsToStorage(cloudData.financials);
          }
        } else {
          // Backup fallback from server
          const backupRes = await safeFetchJson<{ success: boolean; data: any }>(`/api/user/load-data?email=${encodeURIComponent(authRes.session.email)}`);
          if (backupRes.ok && backupRes.data?.data) {
            const d = backupRes.data.data;
            if (Array.isArray(d.events) && d.events.length > 0) {
              setEvents(d.events);
              saveEventsToStorage(d.events);
            }
            if (Array.isArray(d.passes) && d.passes.length > 0) {
              setPasses(d.passes);
              savePassesToStorage(d.passes);
            }
          }
        }
      } finally {
        setTimeout(() => {
          isApplyingRemoteRef.current = false;
        }, 500);
      }

      if (authRes.session.role === 'gate_operator') {
        setActiveTab('gate_scanner');
      }

      if (authRes.session.allowedEventId && authRes.session.allowedEventId !== 'all') {
        handleSelectEvent(authRes.session.allowedEventId);
      }

      setIsGmailModalOpen(false);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Verification failed. Please try again.' };
    } finally {
      setIsSyncing(false);
    }
  };

  // Logout Handler
  const handleGmailLogout = () => {
    setCurrentUserEmail(null);
    setCurrentSession(null);
    saveStoredSession(null);
    setActiveDevices([]);
    setIsGmailModalOpen(false);
    setActiveTab('events');
  };

  // Guard modification actions for client viewers
  const checkClientViewerGuard = (): boolean => {
    if (isClientViewer) {
      alert('👁️ Client Live View Only: Ticket creation, event editing, and deletions are disabled in client preview mode.');
      return true;
    }
    return false;
  };

  // Handlers
  const handleAddEvent = (newEvent: EventItem) => {
    if (checkClientViewerGuard()) return;
    setEvents(prev => [newEvent, ...prev]);
  };

  const handleUpdateEvent = (updatedEvent: EventItem) => {
    if (checkClientViewerGuard()) return;
    const nextEvents = events.map(ev => ev.id === updatedEvent.id ? updatedEvent : ev);
    setEvents(nextEvents);
    saveEventsToStorage(nextEvents);
    if (currentUserEmail) {
      syncToCloud(currentUserEmail, nextEvents, passes);
    }
  };

  const handleDeleteEvent = (eventId: string) => {
    if (checkClientViewerGuard()) return;
    const targetEvent = events.find(ev => ev.id === eventId);
    const targetTitle = targetEvent?.title ? targetEvent.title.toLowerCase().trim() : '';

    const nextEvents = events.filter(ev => ev.id !== eventId);
    const nextPasses = passes.filter(p => {
      if (p.eventId && p.eventId === eventId) return false;
      if (targetTitle && p.eventName && p.eventName.toLowerCase().trim() === targetTitle) return false;
      return true;
    });

    setEvents(nextEvents);
    setPasses(nextPasses);

    saveEventsToStorage(nextEvents);
    savePassesToStorage(nextPasses);
    if (currentUserEmail) {
      syncToCloud(currentUserEmail, nextEvents, nextPasses);
    }
  };

  const handleEndEvent = (eventId: string) => {
    if (checkClientViewerGuard()) return;
    const nextEvents = events.map(ev => {
      if (ev.id === eventId) {
        return {
          ...ev,
          status: 'ended' as const,
          endedAt: new Date().toISOString(),
        };
      }
      return ev;
    });

    setEvents(nextEvents);
    saveEventsToStorage(nextEvents);
    if (currentUserEmail) {
      syncToCloud(currentUserEmail, nextEvents, passes);
    }
  };

  const handleReopenEvent = (eventId: string) => {
    if (checkClientViewerGuard()) return;
    const nextEvents = events.map(ev => {
      if (ev.id === eventId) {
        return {
          ...ev,
          status: 'active' as const,
          endedAt: undefined,
        };
      }
      return ev;
    });

    setEvents(nextEvents);
    saveEventsToStorage(nextEvents);
    if (currentUserEmail) {
      syncToCloud(currentUserEmail, nextEvents, passes);
    }
  };

  const handleAddPasses = (newPasses: PassItem[]) => {
    if (checkClientViewerGuard()) return;
    setPasses(prev => {
      const updated = [...newPasses, ...prev];
      savePassesToStorage(updated);
      if (currentUserEmail) {
        syncToCloud(currentUserEmail, events, updated);
      }
      return updated;
    });
  };

  const handleAddFinancials = (newFinancials: any[]) => {
    if (checkClientViewerGuard() || isGateOperator) return;
    setFinancials(prev => {
      const updated = [...newFinancials, ...prev];
      saveFinancialsToStorage(updated);
      if (currentUserEmail) {
        syncToCloud(currentUserEmail, events, passes, updated);
      }
      return updated;
    });
  };

  const handleClearDemoData = () => {
    if (checkClientViewerGuard()) return;
    const demoEventIds = new Set(
      events
        .filter(e => e.id.startsWith('demo-evt-') || ['evt-101', 'evt-102', 'evt-103'].includes(e.id))
        .map(e => e.id)
    );

    const nextEvents = events.filter(e => !demoEventIds.has(e.id));
    const nextPasses = passes.filter(
      p => !p.id.startsWith('demo-pass-') && (!p.eventId || !demoEventIds.has(p.eventId))
    );
    const nextFinancials = financials.filter(
      f => !f.id.startsWith('fin-demo-') && (!f.eventId || !demoEventIds.has(f.eventId))
    );

    setEvents(nextEvents);
    setPasses(nextPasses);
    setFinancials(nextFinancials);

    saveEventsToStorage(nextEvents);
    savePassesToStorage(nextPasses);
    saveFinancialsToStorage(nextFinancials);

    if (demoEventIds.has(selectedEventId)) {
      setSelectedEventId('all');
    }

    if (currentUserEmail) {
      syncToCloud(currentUserEmail, nextEvents, nextPasses, nextFinancials);
    }
  };

  const handleAssignPass = (
    passId: string, 
    attendeeName: string, 
    email?: string, 
    phone?: string, 
    notes?: string
  ) => {
    setPasses(prev => {
      const updated = prev.map(p => {
        if (p.id === passId) {
          return {
            ...p,
            status: 'assigned' as const,
            assignedTo: {
              name: attendeeName,
              email,
              phone,
              notes,
              assignedAt: new Date().toISOString(),
            },
          };
        }
        return p;
      });
      savePassesToStorage(updated);
      if (currentUserEmail) {
        syncToCloud(currentUserEmail, events, updated);
      }
      triggerGoogleSheetAutoSync(updated);
      return updated;
    });
  };

  const handleDeletePass = (passId: string) => {
    if (checkClientViewerGuard()) return;
    const nextPasses = passes.filter(p => p.id !== passId);
    setPasses(nextPasses);
    savePassesToStorage(nextPasses);
    if (currentUserEmail) {
      syncToCloud(currentUserEmail, events, nextPasses);
    }
    triggerGoogleSheetAutoSync(nextPasses);
  };

  const handleDeleteAllUnassignedPasses = () => {
    if (checkClientViewerGuard()) return;
    const nextPasses = passes.filter(p => p.status !== 'unassigned');
    setPasses(nextPasses);
    savePassesToStorage(nextPasses);
    if (currentUserEmail) {
      syncToCloud(currentUserEmail, events, nextPasses);
    }
    triggerGoogleSheetAutoSync(nextPasses);
  };

  const handleUpdatePass = (targetPass: PassItem) => {
    setPasses(prev => {
      const updated = prev.map(p => (p.id === targetPass.id ? targetPass : p));
      savePassesToStorage(updated);
      if (currentUserEmail) {
        syncToCloud(currentUserEmail, events, updated);
      }
      triggerGoogleSheetAutoSync(updated);
      return updated;
    });
  };

  const handleUpdatePasses = (newPasses: PassItem[]) => {
    setPasses(newPasses);
    savePassesToStorage(newPasses);
    if (currentUserEmail) {
      syncToCloud(currentUserEmail, events, newPasses);
    }
    triggerGoogleSheetAutoSync(newPasses);
  };

  const handleToggleCheckIn = (targetPass: PassItem) => {
    setPasses(prev => {
      const updated = prev.map(p => {
        if (p.id === targetPass.id) {
          const isCurrentlyCheckedIn = p.status === 'checked_in';
          return {
            ...p,
            status: isCurrentlyCheckedIn ? ('assigned' as const) : ('checked_in' as const),
            checkedInAt: isCurrentlyCheckedIn ? undefined : new Date().toISOString(),
          };
        }
        return p;
      });
      savePassesToStorage(updated);
      if (currentUserEmail) {
        syncToCloud(currentUserEmail, events, updated);
      }
      triggerGoogleSheetAutoSync(updated);
      return updated;
    });
  };

  // Separate active events from completed/ended events (and strictly enforce scoped event permission)
  const baseActiveEvents = events.filter(e => {
    if (isScopedEvent && currentSession?.allowedEventId) {
      const isIdMatch = e.id === currentSession.allowedEventId;
      const isTitleMatch = Boolean(currentSession.allowedEventTitle && e.title.toLowerCase().trim() === currentSession.allowedEventTitle.toLowerCase().trim());
      return isIdMatch || isTitleMatch;
    }
    if (e.status === 'ended') return false;
    return true;
  });

  const activeEvents = (isScopedEvent && currentSession?.allowedEventId && baseActiveEvents.length === 0)
    ? [{
        id: currentSession.allowedEventId,
        title: currentSession.allowedEventTitle || 'Selected Event',
        date: new Date().toLocaleDateString(),
        venue: currentSession.deviceLocation || 'Event Venue',
        category: 'Conference',
        status: 'active' as const,
        expectedAttendance: passes.length || 50,
        assignedCount: passes.filter(p => p.status === 'assigned' || p.status === 'checked_in').length,
      }]
    : baseActiveEvents;

  const activeEventIds = new Set(activeEvents.map(e => e.id));
  const activeEventTitles = new Set(activeEvents.map(e => e.title.toLowerCase().trim()));

  // Active event selection guard - strictly lock when scoped to an event
  const effectiveSelectedEventId = isScopedEvent && currentSession?.allowedEventId 
    ? (activeEvents[0]?.id || currentSession.allowedEventId)
    : (selectedEventId === 'all' || activeEventIds.has(selectedEventId) ? selectedEventId : 'all');

  const selectedEvent = activeEvents.find(e => e.id === effectiveSelectedEventId);
  const selectedEventTitle = selectedEvent ? selectedEvent.title.toLowerCase().trim() : (currentSession?.allowedEventTitle?.toLowerCase().trim() || '');

  // Auto scroll to top on tab change
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }, [activeTab]);

  // Operational Passes: Strictly filter to the selected/scoped event
  const operationalPasses = passes.filter(p => {
    // If scoped to a specific event, strictly only return passes belonging to that event
    if (isScopedEvent) {
      const pEventId = p.eventId || '';
      const pEventTitle = (p.eventName || '').toLowerCase().trim();
      const allowedId = currentSession?.allowedEventId;
      const allowedTitle = (currentSession?.allowedEventTitle || '').toLowerCase().trim();

      const matchId = Boolean(allowedId && (pEventId === allowedId || activeEventIds.has(pEventId)));
      const matchTitle = Boolean(
        (allowedTitle && pEventTitle === allowedTitle) ||
        (selectedEventTitle && pEventTitle === selectedEventTitle) ||
        (activeEventTitles.has(pEventTitle))
      );
      return matchId || matchTitle;
    }

    if (effectiveSelectedEventId === 'all') {
      return true;
    }
    if (p.eventId && p.eventId === effectiveSelectedEventId) {
      return true;
    }
    if (selectedEventTitle && p.eventName && p.eventName.toLowerCase().trim() === selectedEventTitle) {
      return true;
    }
    return false;
  });

  // Scoped Financials: If scoped to a specific event, only show this event's financials
  const scopedFinancials = financials.filter(f => {
    if (isScopedEvent) {
      const fEventId = (f as any).eventId;
      const fTitle = ((f as any).eventName || '').toLowerCase().trim();
      if (fEventId && (fEventId === currentSession?.allowedEventId || activeEventIds.has(fEventId))) return true;
      if (selectedEventTitle && fTitle === selectedEventTitle) return true;
      return false;
    }
    if (effectiveSelectedEventId === 'all') return true;
    const fEventId = (f as any).eventId;
    const fTitle = ((f as any).eventName || '').toLowerCase().trim();
    if (fEventId && fEventId === effectiveSelectedEventId) return true;
    if (selectedEventTitle && fTitle === selectedEventTitle) return true;
    return true;
  });

  // Operational counts based on active operational passes
  const assignedCount = operationalPasses.filter(p => p.status === 'assigned' || p.status === 'checked_in').length;
  const unassignedCount = operationalPasses.filter(p => p.status === 'unassigned').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-600 selection:text-white pb-16 flex flex-col justify-between">
      
      <div>
        {/* Top Application Navigation */}
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          assignedCount={assignedCount}
          unassignedCount={unassignedCount}
          eventsCount={activeEvents.length}
          events={activeEvents}
          selectedEventId={effectiveSelectedEventId}
          onSelectEvent={handleSelectEvent}
          currentUserEmail={currentUserEmail}
          currentSession={currentSession}
          onOpenGmailModal={() => setIsGmailModalOpen(true)}
          activeDevicesCount={Math.max(activeDevices.length, currentUserEmail ? 1 : 0)}
        />

        {/* Remote Device Disconnection Notice */}
        {disconnectedNotice && (
          <div 
            id="banner-disconnected-notice"
            className="bg-rose-950/90 border-b border-rose-500/50 px-4 py-2.5 text-center text-xs font-bold text-rose-200 flex items-center justify-center gap-3 animate-fadeIn"
          >
            <span>{disconnectedNotice}</span>
            <button
              type="button"
              onClick={() => setDisconnectedNotice(null)}
              className="px-2 py-0.5 bg-rose-900 hover:bg-rose-800 text-rose-100 rounded-lg text-[10px] font-black uppercase cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Client Viewer / Restricted Banner */}
        {isClientViewer && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-center text-xs font-bold text-amber-300 flex items-center justify-center gap-2">
            <span>👁️ <strong>Client Live Monitoring Mode:</strong> You have real-time live viewer access to event turnstiles and passes. Ticket creation and deletions are restricted.</span>
          </div>
        )}

        {/* Gate Operator Security Banner */}
        {isGateOperator && (
          <div className="bg-cyan-500/10 border-b border-cyan-500/30 px-4 py-2 text-center text-xs font-bold text-cyan-300 flex items-center justify-center gap-2">
            <span>🛡️ <strong>Gate Security Mode:</strong> Active turnstiles, pass scanner, and registry only. Financial revenue is hidden.</span>
          </div>
        )}

        {/* Gmail Login & Multi-Device Cloud Synchronization Modal */}
        <GmailLoginModal
          isOpen={isGmailModalOpen}
          onClose={() => setIsGmailModalOpen(false)}
          currentUserEmail={currentUserEmail}
          currentSession={currentSession}
          events={activeEvents}
          onLogin={handleGmailLogin}
          onLoginWithCode={handleLoginWithCode}
          onLogout={handleGmailLogout}
          isSyncing={isSyncing}
          lastSaved={lastSaved}
          activeDevices={activeDevices}
        />

        {/* Main Tab Content Views */}
        <main className="transition-all duration-200 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full mt-6">
          {(activeTab === 'events' || activeTab === 'generator') && !isGateOperator && (
            <EventsPage
              events={activeEvents}
              passes={isScopedEvent ? operationalPasses : passes}
              financials={scopedFinancials}
              selectedEventId={effectiveSelectedEventId}
              onSelectEvent={handleSelectEvent}
              onAddEvent={handleAddEvent}
              onUpdateEvent={handleUpdateEvent}
              onDeleteEvent={handleDeleteEvent}
              onEndEvent={handleEndEvent}
              onReopenEvent={handleReopenEvent}
              onNavigateToPasses={() => setActiveTab('passes')}
              onAddPasses={handleAddPasses}
              onAddFinancials={handleAddFinancials}
              onClearDemoData={handleClearDemoData}
              onNavigateToTab={(tab) => setActiveTab(tab as any)}
            />
          )}

          {activeTab === 'gate_scanner' && (
            <GateScannerPage
              passes={operationalPasses}
              events={activeEvents}
              selectedEventId={effectiveSelectedEventId}
              onUpdatePass={handleUpdatePass}
              onUpdatePasses={handleUpdatePasses}
              onUpdateEvent={handleUpdateEvent}
              onNavigateToTab={(tab) => setActiveTab(tab as any)}
            />
          )}

          {activeTab === 'scanner' && (
            <QRScanAssigner
              passes={operationalPasses}
              onAssignPass={handleAssignPass}
              onNavigateToAssigned={() => setActiveTab('assigned')}
              isReadOnly={isClientViewer || isGateOperator}
            />
          )}

          {(activeTab === 'passes' || activeTab === 'assigned' || activeTab === 'unassigned') && (
            <PassesRegistry
              passes={operationalPasses}
              events={activeEvents}
              defaultSubTab={activeTab === 'unassigned' ? 'unassigned' : 'assigned'}
              selectedEventId={effectiveSelectedEventId}
              onToggleCheckIn={handleToggleCheckIn}
              onNavigateToDocsHub={() => setActiveTab('docs')}
              onAssignClick={pass => {
                setActiveTab('scanner');
              }}
              onNavigateToGenerator={() => setActiveTab('events')}
              onNavigateToScanner={() => setActiveTab('scanner')}
              onDeletePass={handleDeletePass}
              onDeleteAllUnassignedPasses={handleDeleteAllUnassignedPasses}
            />
          )}

          {activeTab === 'email_tickets' && !isGateOperator && (
            <EmailTicketDispatcher
              passes={operationalPasses}
              events={activeEvents}
              currentUserEmail={currentUserEmail}
            />
          )}

          {activeTab === 'rules_bomber' && !isGateOperator && (
            <RulesBomber
              passes={operationalPasses}
              events={activeEvents}
              currentUserEmail={currentUserEmail}
            />
          )}

          {activeTab === 'thank_you' && !isGateOperator && (
            <RulesBomber
              passes={operationalPasses}
              events={activeEvents}
              currentUserEmail={currentUserEmail}
              initialSubTab="recap"
            />
          )}

          {activeTab === 'docs' && !isGateOperator && (
            <PassDocsAndTransferHub
              passes={operationalPasses}
              events={activeEvents}
              onDeleteEvent={handleDeleteEvent}
            />
          )}

          {activeTab === 'financials' && !isGateOperator && (
            <FinancialsPage
              events={activeEvents}
              passes={operationalPasses}
              financials={scopedFinancials}
              setFinancials={setFinancials}
              selectedEventId={effectiveSelectedEventId}
              onSelectEvent={handleSelectEvent}
            />
          )}

          {(activeTab === 'designer' || activeTab === 'google_docs' || activeTab === 'google_forms') && !isGateOperator && (
            <AIPassStudio
              passes={operationalPasses}
              events={activeEvents}
              financials={scopedFinancials}
              selectedEventId={effectiveSelectedEventId}
              onSelectEvent={handleSelectEvent}
              onPassesUpdated={handleUpdatePasses}
              initialPage={activeTab === 'google_docs' ? 'google-docs' : activeTab === 'google_forms' ? 'google-forms' : 'designer'}
              onPageChange={(page) => {
                if (page === 'google-docs') setActiveTab('google_docs');
                else if (page === 'google-forms') setActiveTab('google_forms');
                else setActiveTab('designer');
              }}
            />
          )}
        </main>
      </div>

      {/* Modern Aesthetic Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full mt-14 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="font-semibold text-slate-300">
            {currentUserEmail ? (
              <span>
                Cloud Synchronized • Multi-Device Active ({activeDevices.length > 0 ? `${activeDevices.length} Connected` : '1 Connected'}) • Role: {currentSession?.role || 'owner'}
              </span>
            ) : (
              <span>Local System Ready • Sign In or Use Quick Code to Enable Cloud Sync</span>
            )}
          </span>
        </div>
        <div className="font-mono text-[11px] text-slate-400">16-Digit QR Engine • PassCraft Pro</div>
      </footer>

    </div>
  );
}
