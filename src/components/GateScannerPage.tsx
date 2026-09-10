import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import jsQR from 'jsqr';
import { EventItem, PassItem, GateEntryRecord, PassSecurityStatus, EventGateConfig } from '../types';
import { 
  format16DigitCode,
  playGateSuccessTick,
  playGateDuplicateAlertSound,
  playGateFakeTicketAlarm,
  playGateSecurityFlaggedAlarm,
  playGateWrongGateAlarm,
  loadGateLogsFromStorage,
  saveGateLogsToStorage,
  loadPassesFromStorage,
  getEventGates
} from '../lib/passUtils';
import { GateManagerTab } from './GateManagerTab';
import { 
  ScanLine, 
  Camera, 
  SwitchCamera, 
  Upload, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  ShieldCheck, 
  ShieldX, 
  FileSpreadsheet, 
  Download, 
  Printer, 
  Lock, 
  Unlock, 
  Trash2, 
  UserCheck, 
  Calendar, 
  Clock, 
  Tag, 
  Users, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  RefreshCw, 
  ChevronRight, 
  Eye, 
  X, 
  AlertCircle,
  FileText,
  Filter,
  Check,
  Layers,
  Sliders,
  Laptop,
  Video,
  ArrowRightLeft,
  ExternalLink,
  Copy,
  Table
} from 'lucide-react';

interface GateScannerPageProps {
  passes: PassItem[];
  events: EventItem[];
  selectedEventId: string;
  onUpdatePass: (updatedPass: PassItem) => void;
  onUpdatePasses: (updatedPasses: PassItem[]) => void;
  onUpdateEvent?: (updatedEvent: EventItem) => void;
  onNavigateToTab?: (tab: string) => void;
}

type GateSubTab = 'scanner' | 'gates' | 'roster' | 'security';

export const GateScannerPage: React.FC<GateScannerPageProps> = ({
  passes,
  events,
  selectedEventId,
  onUpdatePass,
  onUpdatePasses,
  onUpdateEvent,
  onNavigateToTab,
}) => {
  // Sub-navigation
  const [activeSubTab, setActiveSubTab] = useState<GateSubTab>('scanner');

  // Auto scroll to top when page mounts or sub-tab switches so user never has to scroll up
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }, [activeSubTab]);

  // Active event selection
  const [currentEventId, setCurrentEventId] = useState<string>(() => {
    return selectedEventId !== 'all' ? selectedEventId : (events[0]?.id || '');
  });

  useEffect(() => {
    if (selectedEventId !== 'all' && selectedEventId) {
      setCurrentEventId(selectedEventId);
    }
  }, [selectedEventId]);

  const activeEvents = events.filter(e => e.status !== 'ended');
  const currentEvent = events.find(e => e.id === currentEventId) || activeEvents[0] || events[0] || {
    id: 'default-event',
    title: 'University Tech & Innovation Fest 2026',
    date: '2026-08-25',
    time: '10:00 AM',
    location: 'Main Auditorium',
    organizer: 'Tech Committee',
    description: 'Annual flagship technology fest',
    tagline: 'Empowering Creators',
    category: 'VIP',
    createdAt: new Date().toISOString(),
    themeColor: '#10b981'
  };

  // Event Gates
  const eventGates = useMemo(() => {
    return getEventGates(currentEvent);
  }, [currentEvent]);

  // Selected Active Gate stationed at
  const [selectedGateId, setSelectedGateId] = useState<string>(() => {
    return eventGates[0]?.id || 'gate-1';
  });

  // Ensure selected gate stays valid when switching events
  useEffect(() => {
    if (eventGates.length > 0) {
      const exists = eventGates.some(g => g.id === selectedGateId);
      if (!exists) {
        setSelectedGateId(eventGates[0].id);
      }
    }
  }, [eventGates, selectedGateId]);

  const activeGate = eventGates.find(g => g.id === selectedGateId) || eventGates[0];

  // -------------------------------------------------------------
  // Live State Refs to Guarantee Zero Stale Closures in Camera Loop
  // -------------------------------------------------------------
  const passesRef = useRef<PassItem[]>(passes);
  useEffect(() => {
    passesRef.current = passes;
  }, [passes]);

  // Gate Logs from local storage
  const [gateLogs, setGateLogs] = useState<GateEntryRecord[]>(() => {
    return loadGateLogsFromStorage();
  });

  const gateLogsRef = useRef<GateEntryRecord[]>(gateLogs);
  useEffect(() => {
    gateLogsRef.current = gateLogs;
  }, [gateLogs]);

  // Sound toggle
  const [soundEnabled, setSoundEnabled] = useState(true);

  // -------------------------------------------------------------
  // Camera & Device State (Front / Back / External)
  // -------------------------------------------------------------
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraModeType, setCameraModeType] = useState<'back' | 'front' | 'external'>('back');
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameId = useRef<number | null>(null);
  const lastScannedTimeRef = useRef<number>(0);
  const isProcessingScanRef = useRef<boolean>(false);

  // Modal / Alert Popups States
  // 1. Success 1-second auto-dismiss popup
  const [successEntryPass, setSuccessEntryPass] = useState<PassItem | null>(null);
  const [successEntryRecord, setSuccessEntryRecord] = useState<GateEntryRecord | null>(null);
  const successTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 2. Center Blur Popup: Duplicate Entry / Already Entered (Strict 1-Ticket 1-Entry Policy)
  const [duplicateEntryData, setDuplicateEntryData] = useState<{
    pass: PassItem;
    priorRecord?: GateEntryRecord;
    gateName?: string;
    timestamp: string;
  } | null>(null);

  // 3. Center Blur Popup: Wrong Gate / Unauthorized Section
  const [wrongGateData, setWrongGateData] = useState<{
    pass: PassItem;
    targetGate: EventGateConfig;
    allowedTiers: string[];
    timestamp: string;
  } | null>(null);

  // 4. Center Blur Popup: Fake / Counterfeit Ticket
  const [fakeTicketData, setFakeTicketData] = useState<{
    scannedCode: string;
    timestamp: string;
  } | null>(null);

  // 5. Center Blur Popup: Security Flagged (Lost / Stolen / Deactivated)
  const [securityBlockedData, setSecurityBlockedData] = useState<{
    pass: PassItem;
    flag: PassSecurityStatus;
    notes?: string;
    timestamp: string;
  } | null>(null);

  // 6. Unassigned Pass Notice
  const [unassignedScannedPass, setUnassignedScannedPass] = useState<PassItem | null>(null);

  // Enumerate cameras
  const fetchCameras = useCallback(async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevs = devices.filter(d => d.kind === 'videoinput');
        setAvailableCameras(videoDevs);
        if (videoDevs.length > 0 && !selectedDeviceId) {
          // If back camera exists, prefer it
          const backDev = videoDevs.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear') || d.label.toLowerCase().includes('environment'));
          if (backDev) {
            setSelectedDeviceId(backDev.deviceId);
          } else {
            setSelectedDeviceId(videoDevs[0].deviceId);
          }
        }
      }
    } catch (e) {
      console.error('Error fetching cameras:', e);
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    fetchCameras();
  }, [fetchCameras]);

  // Save gate logs helper (single or batch)
  const addGateLogs = useCallback((records: GateEntryRecord | GateEntryRecord[]) => {
    const list = Array.isArray(records) ? records : [records];
    if (list.length === 0) return;
    setGateLogs(prev => {
      const updated = [...list, ...prev];
      gateLogsRef.current = updated;
      saveGateLogsToStorage(updated);
      return updated;
    });
  }, []);

  const addGateLog = useCallback((record: GateEntryRecord) => {
    addGateLogs(record);
  }, [addGateLogs]);

  // -------------------------------------------------------------
  // Comprehensive QR & Barcode Payload Parser & Matcher
  // -------------------------------------------------------------
  const findMatchingPass = useCallback((scannedRaw: string): PassItem | undefined => {
    if (!scannedRaw) return undefined;
    const trimmed = scannedRaw.trim();
    if (!trimmed) return undefined;

    const allPasses = passesRef.current && passesRef.current.length > 0
      ? passesRef.current
      : loadPassesFromStorage();

    // 1. Try JSON payload parse (e.g. {"id":"...", "code16":"..."})
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.id) {
          const byId = allPasses.find(p => p.id === parsed.id);
          if (byId) return byId;
        }
        if (parsed.passId) {
          const byPassId = allPasses.find(p => p.id === parsed.passId);
          if (byPassId) return byPassId;
        }
        if (parsed.code16) {
          const digits = String(parsed.code16).replace(/\D/g, '');
          const byCode16 = allPasses.find(p => p.code16 === digits || p.code16?.replace(/\D/g, '') === digits);
          if (byCode16) return byCode16;
        }
        if (parsed.code) {
          const digits = String(parsed.code).replace(/\D/g, '');
          const byCode = allPasses.find(p => p.code16 === digits || p.formattedCode === parsed.code);
          if (byCode) return byCode;
        }
      } catch (e) {}
    }

    // 2. Try URL parameter extraction (e.g. https://domain.com/?code=4592892139401928 or /pass/pass-123)
    if (trimmed.includes('http://') || trimmed.includes('https://')) {
      try {
        const url = new URL(trimmed);
        const codeParam = url.searchParams.get('code') || 
                          url.searchParams.get('pass') || 
                          url.searchParams.get('id') || 
                          url.searchParams.get('passId') || 
                          url.searchParams.get('ticket');
        if (codeParam) {
          const paramDigits = codeParam.replace(/\D/g, '');
          const byParam = allPasses.find(p => 
            p.id === codeParam || 
            p.code16 === paramDigits || 
            p.formattedCode === codeParam
          );
          if (byParam) return byParam;
        }
        const pathSegments = url.pathname.split('/').filter(Boolean);
        if (pathSegments.length > 0) {
          const lastSeg = pathSegments[pathSegments.length - 1];
          const segDigits = lastSeg.replace(/\D/g, '');
          const bySeg = allPasses.find(p => 
            p.id === lastSeg || 
            p.code16 === segDigits || 
            p.formattedCode === lastSeg
          );
          if (bySeg) return bySeg;
        }
      } catch (e) {}
    }

    const cleanedDigits = trimmed.replace(/\D/g, '');
    const rawLower = trimmed.toLowerCase();

    // 3. Exact match by 16-digit code16
    if (cleanedDigits.length === 16) {
      const found = allPasses.find(p => p.code16 === cleanedDigits || (p.code16 && p.code16.replace(/\D/g, '') === cleanedDigits));
      if (found) return found;
    }

    // 4. Exact match by formattedCode
    const foundByFormatted = allPasses.find(p => 
      p.formattedCode?.toLowerCase() === rawLower || 
      p.formattedCode?.replace(/\s+/g, '') === trimmed.replace(/\s+/g, '')
    );
    if (foundByFormatted) return foundByFormatted;

    // 5. Match by pass ID
    const foundById = allPasses.find(p => p.id === trimmed || p.id.toLowerCase() === rawLower);
    if (foundById) return foundById;

    // 6. Match by cleaned digits if 10 to 16 digits
    if (cleanedDigits.length >= 10) {
      const foundByDigits = allPasses.find(p => {
        const pDigits = (p.code16 || p.formattedCode || '').replace(/\D/g, '');
        return pDigits === cleanedDigits || (pDigits && cleanedDigits && (pDigits.includes(cleanedDigits) || cleanedDigits.includes(pDigits)));
      });
      if (foundByDigits) return foundByDigits;
    }

    // 7. Match by last 4 digits (if typed manually)
    if (cleanedDigits.length === 4) {
      const candidates = allPasses.filter(p => p.code16?.endsWith(cleanedDigits) || p.formattedCode?.endsWith(cleanedDigits));
      if (candidates.length === 1) return candidates[0];
    }

    // 8. Match by attendee ID number or attendee email
    const foundByAttendee = allPasses.find(p => 
      (p.assignedTo?.email && p.assignedTo.email.toLowerCase() === rawLower) ||
      (p.assignedTo?.idNumber && p.assignedTo.idNumber.toLowerCase() === rawLower)
    );
    if (foundByAttendee) return foundByAttendee;

    return undefined;
  }, []);

  // -------------------------------------------------------------
  // QR & Manual Barcode Verification Logic with Gate Progression
  // -------------------------------------------------------------
  const handleProcessCode = useCallback((scannedRaw: string) => {
    if (!scannedRaw || isProcessingScanRef.current) return;
    isProcessingScanRef.current = true;
    const now = Date.now();
    lastScannedTimeRef.current = now;

    const timestampIso = new Date().toISOString();
    const currentGateConfig = activeGate || {
      id: 'gate-default',
      name: 'Gate 1 - Main Entrance',
      allowedCategories: ['all'],
      color: '#10b981',
      isCheckpoint: false
    };

    // Look up in database
    const matchedPass = findMatchingPass(scannedRaw);

    // SCENARIO 1: FAKE / UNREGISTERED TICKET
    if (!matchedPass) {
      if (soundEnabled) playGateFakeTicketAlarm();
      setFakeTicketData({
        scannedCode: scannedRaw,
        timestamp: timestampIso,
      });

      // Log fake scan attempt
      const fakeRecord: GateEntryRecord = {
        id: `gate-fake-${Date.now()}`,
        passId: 'unregistered',
        code16: scannedRaw.slice(0, 16),
        formattedCode: format16DigitCode(scannedRaw),
        eventId: currentEvent.id,
        eventName: currentEvent.title,
        attendeeName: 'Unknown / Counterfeit',
        ticketCategory: 'Counterfeit',
        entryTimestamp: timestampIso,
        dateSession: 'single_event',
        sessionLabel: 'Gate Entry',
        gateId: currentGateConfig.id,
        gateName: currentGateConfig.name,
        status: 'security_denied',
        notes: `🚨 COUNTERFEIT / UNREGISTERED CODE SCANNED AT ${currentGateConfig.name}: ${scannedRaw}`,
      };
      addGateLog(fakeRecord);

      setTimeout(() => {
        isProcessingScanRef.current = false;
      }, 1000);
      return;
    }

    // SCENARIO 2: PASS IS FLAGGED AS LOST, STOLEN, DEACTIVATED, OR VOIDED
    if (matchedPass.securityFlag && matchedPass.securityFlag !== 'none') {
      if (soundEnabled) playGateSecurityFlaggedAlarm();
      setSecurityBlockedData({
        pass: matchedPass,
        flag: matchedPass.securityFlag,
        notes: matchedPass.securityNotes,
        timestamp: timestampIso,
      });

      // Log security denial
      const record: GateEntryRecord = {
        id: `gate-log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        passId: matchedPass.id,
        code16: matchedPass.code16,
        formattedCode: matchedPass.formattedCode,
        eventId: matchedPass.eventId || currentEvent.id,
        eventName: matchedPass.eventName || currentEvent.title,
        attendeeName: matchedPass.assignedTo?.name || 'Blocked Pass Attendee',
        attendeeEmail: matchedPass.assignedTo?.email,
        attendeePhone: matchedPass.assignedTo?.phone,
        attendeeIdNumber: matchedPass.assignedTo?.idNumber,
        ticketCategory: matchedPass.category,
        ticketPrice: matchedPass.ticketPrice,
        entryTimestamp: timestampIso,
        dateSession: 'single_event',
        sessionLabel: '1 Entry Event Pass',
        gateId: currentGateConfig.id,
        gateName: currentGateConfig.name,
        status: 'security_denied',
        notes: `Security Block: ${matchedPass.securityFlag.toUpperCase()} - ${matchedPass.securityNotes || 'No notes provided'} (Stopped at ${currentGateConfig.name})`,
      };
      addGateLog(record);

      setTimeout(() => {
        isProcessingScanRef.current = false;
      }, 1000);
      return;
    }

    // SCENARIO 3: UNASSIGNED PASS (Needs attendee details before admission)
    if (matchedPass.status === 'unassigned' || !matchedPass.assignedTo?.name) {
      if (soundEnabled) playGateDuplicateAlertSound();
      setUnassignedScannedPass(matchedPass);
      setTimeout(() => {
        isProcessingScanRef.current = false;
      }, 1000);
      return;
    }

    // SCENARIO 4: GATE CATEGORY ACCESS CHECK (Wrong Gate / Tier Restriction)
    const allowedCats = currentGateConfig.allowedCategories || ['all'];
    const allowsAll = allowedCats.includes('all');
    const passCat = (matchedPass.category || '').toLowerCase();
    const isCategoryPermitted = allowsAll || allowedCats.some(c => c.toLowerCase() === passCat || passCat.includes(c.toLowerCase()));

    if (!isCategoryPermitted) {
      if (soundEnabled) playGateWrongGateAlarm();
      setWrongGateData({
        pass: matchedPass,
        targetGate: currentGateConfig,
        allowedTiers: allowedCats,
        timestamp: timestampIso,
      });

      // Log wrong gate attempt
      const wrongGateRecord: GateEntryRecord = {
        id: `gate-wrong-${Date.now()}`,
        passId: matchedPass.id,
        code16: matchedPass.code16,
        formattedCode: matchedPass.formattedCode,
        eventId: matchedPass.eventId || currentEvent.id,
        eventName: matchedPass.eventName || currentEvent.title,
        attendeeName: matchedPass.assignedTo?.name || 'Attendee',
        attendeeEmail: matchedPass.assignedTo?.email,
        attendeePhone: matchedPass.assignedTo?.phone,
        attendeeIdNumber: matchedPass.assignedTo?.idNumber,
        ticketCategory: matchedPass.category,
        ticketPrice: matchedPass.ticketPrice,
        entryTimestamp: timestampIso,
        dateSession: 'single_event',
        sessionLabel: 'Gate Restriction',
        gateId: currentGateConfig.id,
        gateName: currentGateConfig.name,
        status: 'wrong_gate_denied',
        notes: `⛔ WRONG GATE: Attendee holds ${matchedPass.category} tier, which is not permitted at ${currentGateConfig.name}. Allowed: ${allowedCats.join(', ')}`,
      };
      addGateLog(wrongGateRecord);

      setTimeout(() => {
        isProcessingScanRef.current = false;
      }, 1000);
      return;
    }

    // SCENARIO 5: MULTI-GATE & DUPLICATE CHECK
    // Check if this pass was already scanned at THIS specific gate
    const priorScanAtThisGate = gateLogsRef.current.find(
      l => l.passId === matchedPass.id && 
           l.status === 'admitted' && 
           (l.gateId === currentGateConfig.id || (!l.gateId && currentGateConfig.id === eventGates[0]?.id))
    );

    // If single gate event and already checked in anywhere, or if already admitted at this specific gate
    const isAlreadyAtThisGate = Boolean(priorScanAtThisGate);
    const isSingleGateEvent = eventGates.length <= 1;
    const isAlreadyGloballyEntered = isSingleGateEvent && (matchedPass.status === 'checked_in' || Boolean(matchedPass.checkedInAt));

    if (isAlreadyAtThisGate || isAlreadyGloballyEntered) {
      if (soundEnabled) playGateDuplicateAlertSound();
      const priorTime = priorScanAtThisGate?.entryTimestamp || matchedPass.checkedInAt || timestampIso;
      
      setDuplicateEntryData({
        pass: matchedPass,
        priorRecord: priorScanAtThisGate,
        gateName: currentGateConfig.name,
        timestamp: priorTime,
      });

      // Record duplicate entry attempt
      const dupRecord: GateEntryRecord = {
        id: `gate-log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        passId: matchedPass.id,
        code16: matchedPass.code16,
        formattedCode: matchedPass.formattedCode,
        eventId: matchedPass.eventId || currentEvent.id,
        eventName: matchedPass.eventName || currentEvent.title,
        attendeeName: matchedPass.assignedTo?.name || 'Attendee',
        attendeeEmail: matchedPass.assignedTo?.email,
        attendeePhone: matchedPass.assignedTo?.phone,
        attendeeIdNumber: matchedPass.assignedTo?.idNumber,
        ticketCategory: matchedPass.category,
        ticketPrice: matchedPass.ticketPrice,
        entryTimestamp: timestampIso,
        dateSession: 'single_event',
        sessionLabel: '1 Entry Event Pass',
        gateId: currentGateConfig.id,
        gateName: currentGateConfig.name,
        status: 'duplicate_denied',
        notes: `Duplicate scan at ${currentGateConfig.name}. Original gate admission recorded at ${new Date(priorTime).toLocaleTimeString()}.`,
      };
      addGateLog(dupRecord);

      setTimeout(() => {
        isProcessingScanRef.current = false;
      }, 1000);
      return;
    }

    // SCENARIO 6: VALID APPROVED ENTRY AT CURRENT GATE
    if (soundEnabled) playGateSuccessTick();

    const entryRecord: GateEntryRecord = {
      id: `gate-log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      passId: matchedPass.id,
      code16: matchedPass.code16,
      formattedCode: matchedPass.formattedCode,
      eventId: matchedPass.eventId || currentEvent.id,
      eventName: matchedPass.eventName || currentEvent.title,
      attendeeName: matchedPass.assignedTo?.name || 'Attendee',
      attendeeEmail: matchedPass.assignedTo?.email,
      attendeePhone: matchedPass.assignedTo?.phone,
      attendeeIdNumber: matchedPass.assignedTo?.idNumber,
      ticketCategory: matchedPass.category,
      ticketPrice: matchedPass.ticketPrice,
      entryTimestamp: timestampIso,
      dateSession: 'single_event',
      sessionLabel: '1 Entry Event Pass',
      gateId: currentGateConfig.id,
      gateName: currentGateConfig.name,
      status: 'admitted',
      notes: `${currentGateConfig.name} - Verified & Admitted`,
    };

    // Auto Cascade Admittance for Predecessor Gates:
    // If attendee is scanned at Gate 3 (or any inner gate), automatically mark them as admitted in predecessor gates (e.g. Gate 2, Gate 1) if not already admitted
    const currentGateIdx = eventGates.findIndex(g => g.id === currentGateConfig.id);
    const cascadeRecords: GateEntryRecord[] = [];

    if (currentGateIdx > 0) {
      const predecessorGates = eventGates.slice(0, currentGateIdx);
      predecessorGates.forEach((prevGate, pIdx) => {
        const alreadyAdmittedAtPrev = gateLogsRef.current.some(
          l => l.passId === matchedPass.id && 
               l.status === 'admitted' && 
               (l.gateId === prevGate.id || (!l.gateId && prevGate.id === eventGates[0]?.id))
        ) || matchedPass.entryHistory?.some(
          h => (h.gateId === prevGate.id || (!h.gateId && prevGate.id === eventGates[0]?.id)) && h.status === 'admitted'
        );

        if (!alreadyAdmittedAtPrev) {
          const autoCascadeRecord: GateEntryRecord = {
            id: `gate-log-${Date.now()}-${pIdx}-${Math.random().toString(36).substring(2, 6)}-cascade`,
            passId: matchedPass.id,
            code16: matchedPass.code16,
            formattedCode: matchedPass.formattedCode,
            eventId: matchedPass.eventId || currentEvent.id,
            eventName: matchedPass.eventName || currentEvent.title,
            attendeeName: matchedPass.assignedTo?.name || 'Attendee',
            attendeeEmail: matchedPass.assignedTo?.email,
            attendeePhone: matchedPass.assignedTo?.phone,
            attendeeIdNumber: matchedPass.assignedTo?.idNumber,
            ticketCategory: matchedPass.category,
            ticketPrice: matchedPass.ticketPrice,
            entryTimestamp: timestampIso,
            dateSession: 'single_event',
            sessionLabel: 'In-Transit Cascade Entry',
            gateId: prevGate.id,
            gateName: prevGate.name,
            status: 'admitted',
            notes: `${prevGate.name} - Auto-admitted via transit (Scanned at ${currentGateConfig.name})`,
          };
          cascadeRecords.push(autoCascadeRecord);
        }
      });
    }

    const allNewRecords = [entryRecord, ...cascadeRecords];
    addGateLogs(allNewRecords);

    // Update Pass State in React & Local Storage
    const updatedPass: PassItem = {
      ...matchedPass,
      status: 'checked_in',
      checkedInAt: timestampIso,
      entryHistory: [...(matchedPass.entryHistory || []), ...allNewRecords],
    };
    onUpdatePass(updatedPass);

    // 1-Second Auto-dismiss Notification Popup
    setSuccessEntryPass(updatedPass);
    setSuccessEntryRecord(entryRecord);

    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
    }
    successTimerRef.current = setTimeout(() => {
      setSuccessEntryPass(null);
      setSuccessEntryRecord(null);
      isProcessingScanRef.current = false;
    }, 1200);
  }, [activeGate, findMatchingPass, soundEnabled, addGateLogs, onUpdatePass, currentEvent, eventGates]);

  const handleProcessCodeRef = useRef(handleProcessCode);
  useEffect(() => {
    handleProcessCodeRef.current = handleProcessCode;
  }, [handleProcessCode]);

  // -------------------------------------------------------------
  // Camera Video Loop
  // -------------------------------------------------------------
  const scanVideoFrame = useCallback(() => {
    if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      animFrameId.current = requestAnimationFrame(scanVideoFrame);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data && !isProcessingScanRef.current) {
          const now = Date.now();
          if (now - lastScannedTimeRef.current > 1200) {
            handleProcessCodeRef.current(code.data);
          }
        }
      }
    }

    animFrameId.current = requestAnimationFrame(scanVideoFrame);
  }, []);

  const startCamera = async (targetDeviceId?: string, targetFacingMode?: 'environment' | 'user') => {
    setCameraError(null);
    setIsCameraActive(true);

    try {
      if (animFrameId.current) {
        cancelAnimationFrame(animFrameId.current);
        animFrameId.current = null;
      }

      const devId = targetDeviceId || selectedDeviceId;
      const facing = targetFacingMode || facingMode;

      const constraints: MediaStreamConstraints = {
        video: devId
          ? { deviceId: { exact: devId } }
          : { facingMode: facing },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        scanVideoFrame();
      }
    } catch (err: any) {
      console.error('Camera stream error:', err);
      setCameraError(err.message || 'Camera permission denied or camera not available');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (animFrameId.current) {
      cancelAnimationFrame(animFrameId.current);
      animFrameId.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  // Switch camera mode (back / front / external)
  const handleSelectCameraMode = async (mode: 'back' | 'front' | 'external') => {
    setCameraModeType(mode);
    if (mode === 'back') {
      setFacingMode('environment');
      const backDev = availableCameras.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear') || d.label.toLowerCase().includes('environment'));
      const devId = backDev?.deviceId || '';
      setSelectedDeviceId(devId);
      if (isCameraActive) {
        stopCamera();
        setTimeout(() => startCamera(devId, 'environment'), 150);
      }
    } else if (mode === 'front') {
      setFacingMode('user');
      const frontDev = availableCameras.find(d => d.label.toLowerCase().includes('front') || d.label.toLowerCase().includes('user') || d.label.toLowerCase().includes('facetime'));
      const devId = frontDev?.deviceId || '';
      setSelectedDeviceId(devId);
      if (isCameraActive) {
        stopCamera();
        setTimeout(() => startCamera(devId, 'user'), 150);
      }
    } else {
      // External / USB mode: pick first non-default or first available external device
      const extDev = availableCameras.find(d => d.label.toLowerCase().includes('usb') || d.label.toLowerCase().includes('external') || d.label.toLowerCase().includes('cam')) || availableCameras[0];
      if (extDev) {
        setSelectedDeviceId(extDev.deviceId);
        if (isCameraActive) {
          stopCamera();
          setTimeout(() => startCamera(extDev.deviceId), 150);
        }
      }
    }
  };

  const handleDeviceChange = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    if (isCameraActive) {
      stopCamera();
      setTimeout(() => startCamera(deviceId), 150);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  // Quick Manual Search input
  const [manualCodeInput, setManualCodeInput] = useState('');

  // -------------------------------------------------------------
  // TURNSTILE METRICS (GATE-SPECIFIC & EVENT-WIDE DYNAMIC ROUTING)
  // -------------------------------------------------------------
  const eventPasses = useMemo(() => {
    return passes.filter(p => p.eventId === currentEvent.id || (p.eventName && p.eventName === currentEvent.title));
  }, [passes, currentEvent]);

  const eventGateLogs = useMemo(() => {
    return gateLogs.filter(l => l.eventId === currentEvent.id || (l.eventName && l.eventName === currentEvent.title));
  }, [gateLogs, currentEvent]);

  // Current Gate Index and Main Gate determination
  const currentGateIndex = useMemo(() => {
    return eventGates.findIndex(g => g.id === activeGate?.id);
  }, [eventGates, activeGate]);

  const isMainGate = useMemo(() => {
    return currentGateIndex <= 0 || activeGate?.id === eventGates[0]?.id;
  }, [currentGateIndex, activeGate, eventGates]);

  // Passes eligible for the currently selected Gate
  const gateEligiblePasses = useMemo(() => {
    if (!activeGate) return eventPasses;
    if (activeGate.allowedCategories.includes('all')) return eventPasses;
    return eventPasses.filter(p => activeGate.allowedCategories.includes(p.category));
  }, [eventPasses, activeGate]);

  // Downstream gates (inner gates beyond active gate)
  const downstreamGates = useMemo(() => {
    if (currentGateIndex < 0) return [];
    return eventGates.slice(currentGateIndex + 1);
  }, [eventGates, currentGateIndex]);

  const downstreamGateIds = useMemo(() => {
    return new Set(downstreamGates.map(g => g.id));
  }, [downstreamGates]);

  // Predecessor gates (outer gates before active gate)
  const predecessorGates = useMemo(() => {
    if (currentGateIndex <= 0) return [];
    return eventGates.slice(0, currentGateIndex);
  }, [eventGates, currentGateIndex]);

  const predecessorGateIds = useMemo(() => {
    return new Set(predecessorGates.map(g => g.id));
  }, [predecessorGates]);

  // Set of Pass IDs that have already been admitted at this specific gate
  const gateAdmittedPassIds = useMemo(() => {
    // 1. Direct logs for this gate
    const fromLogs = eventGateLogs
      .filter(l => (l.gateId === activeGate?.id || (!l.gateId && isMainGate)) && l.status === 'admitted')
      .map(l => l.passId);

    // 2. Direct entry history for this gate
    const fromHistory = eventPasses
      .filter(p => p.entryHistory?.some(h => (h.gateId === activeGate?.id || (!h.gateId && isMainGate)) && h.status === 'admitted'))
      .map(p => p.id);

    // 3. For Main Gate: ANY pass that has status 'checked_in', checkedInAt, or any entry history
    const fromMainStatus = isMainGate 
      ? eventPasses.filter(p => p.status === 'checked_in' || !!p.checkedInAt || (p.entryHistory && p.entryHistory.length > 0)).map(p => p.id)
      : [];

    // 4. Cascade from inner / downstream gates: If admitted at an inner gate (e.g. Gate 3), automatically admitted at Gate 1 and preceding gates
    const fromDownstream = eventPasses.filter(p => {
      const allAdmittedGates = [
        ...(p.entryHistory?.filter(h => h.status === 'admitted').map(h => h.gateId).filter(Boolean) || []),
        ...eventGateLogs.filter(l => l.passId === p.id && l.status === 'admitted').map(l => l.gateId).filter(Boolean)
      ];
      if (allAdmittedGates.length === 0) return false;
      if (isMainGate) return true;
      return allAdmittedGates.some(gId => {
        const gIdx = eventGates.findIndex(g => g.id === gId);
        return gIdx >= currentGateIndex;
      });
    }).map(p => p.id);

    return new Set([...fromLogs, ...fromHistory, ...fromMainStatus, ...fromDownstream]);
  }, [eventGateLogs, eventPasses, activeGate, isMainGate, currentGateIndex, eventGates]);

  // 1. Attendees who used this gate just to proceed to subsequent gates (in-transit passed through)
  const passedThroughToNextGateCount = useMemo(() => {
    if (downstreamGates.length === 0) return 0;
    return eventPasses.filter(p => {
      const hasEnteredThis = gateAdmittedPassIds.has(p.id);
      const hasEnteredDownstream = (
        p.entryHistory?.some(h => downstreamGateIds.has(h.gateId || '') && h.status === 'admitted') ||
        eventGateLogs.some(l => l.passId === p.id && downstreamGateIds.has(l.gateId || '') && l.status === 'admitted')
      );
      return hasEnteredThis && hasEnteredDownstream;
    }).length;
  }, [eventPasses, gateAdmittedPassIds, downstreamGates, downstreamGateIds, eventGateLogs]);

  // 2. Attendees who checked in at outer checkpoints and are moving in-transit towards this gate
  const incomingInTransitCount = useMemo(() => {
    if (predecessorGates.length === 0) return 0;
    return eventPasses.filter(p => {
      const hasEnteredPredecessor = (
        p.entryHistory?.some(h => predecessorGateIds.has(h.gateId || '') && h.status === 'admitted') ||
        eventGateLogs.some(l => l.passId === p.id && predecessorGateIds.has(l.gateId || '') && l.status === 'admitted')
      );
      const hasReachedThis = gateAdmittedPassIds.has(p.id);
      const isEligible = activeGate?.allowedCategories.includes('all') || activeGate?.allowedCategories.includes(p.category);
      return hasEnteredPredecessor && !hasReachedThis && isEligible;
    }).length;
  }, [eventPasses, predecessorGates, predecessorGateIds, gateAdmittedPassIds, activeGate, eventGateLogs]);

  // Combined In-Transit count: people who use gate just to go to next gate + incoming transit
  const metricsGateInTransit = useMemo(() => {
    return passedThroughToNextGateCount + incomingInTransitCount;
  }, [passedThroughToNextGateCount, incomingInTransitCount]);

  // 1. Total Admitted at THIS chosen Gate
  const metricsGateAdmitted = useMemo(() => {
    const directLogsCount = eventGateLogs.filter(l => (l.gateId === activeGate?.id || (!l.gateId && isMainGate)) && l.status === 'admitted').length;
    return Math.max(gateAdmittedPassIds.size, directLogsCount);
  }, [eventGateLogs, activeGate, isMainGate, gateAdmittedPassIds]);

  // Event total admitted across all gates
  const metricsEventTotalAdmitted = useMemo(() => {
    const totalCheckedInPasses = eventPasses.filter(p => p.status === 'checked_in' || !!p.checkedInAt || (p.entryHistory && p.entryHistory.length > 0)).length;
    const totalUniqueAdmittedLogs = new Set(eventGateLogs.filter(l => l.status === 'admitted').map(l => l.passId)).size;
    return Math.max(totalCheckedInPasses, totalUniqueAdmittedLogs, eventGateLogs.filter(l => l.status === 'admitted').length);
  }, [eventPasses, eventGateLogs]);

  // 2. In Queue / Remaining Entries for THIS chosen Gate
  const metricsGateQueue = useMemo(() => {
    return gateEligiblePasses.filter(p => !gateAdmittedPassIds.has(p.id)).length;
  }, [gateEligiblePasses, gateAdmittedPassIds]);

  // 3. Duplicate Blocks at THIS chosen Gate
  const metricsGateDuplicateBlocks = useMemo(() => {
    return eventGateLogs.filter(l => (l.gateId === activeGate?.id || (!l.gateId && isMainGate)) && l.status === 'duplicate_denied').length;
  }, [eventGateLogs, activeGate, isMainGate]);

  // 4. Fakes / Wrong Gate intercepted at THIS chosen Gate
  const metricsGateFakesIntercepted = useMemo(() => {
    return eventGateLogs.filter(l => 
      (l.gateId === activeGate?.id || (!l.gateId && isMainGate)) && 
      (l.status === 'security_denied' || l.status === 'wrong_gate_denied' || l.notes?.includes('🚨 COUNTERFEIT') || l.notes?.includes('Fake'))
    ).length;
  }, [eventGateLogs, activeGate, isMainGate]);

  // -------------------------------------------------------------
  // Sub-page 1: Entry Roster Spreadsheet State & Filter
  // -------------------------------------------------------------
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterCategoryFilter, setRosterCategoryFilter] = useState<string>('all');
  const [rosterStatusFilter, setRosterStatusFilter] = useState<string>('all');
  const [rosterGateFilter, setRosterGateFilter] = useState<string>('all');

  const filteredGateLogs = useMemo(() => {
    return gateLogs.filter(log => {
      // Event filter
      if (currentEventId && log.eventId && log.eventId !== currentEventId) {
        return false;
      }
      // Status filter
      if (rosterStatusFilter !== 'all' && log.status !== rosterStatusFilter) {
        return false;
      }
      // Gate filter
      if (rosterGateFilter !== 'all' && log.gateId !== rosterGateFilter) {
        return false;
      }
      // Category filter
      if (rosterCategoryFilter !== 'all' && log.ticketCategory !== rosterCategoryFilter) {
        return false;
      }
      // Search
      if (rosterSearch.trim()) {
        const q = rosterSearch.toLowerCase();
        const matchName = log.attendeeName?.toLowerCase().includes(q);
        const matchCode = log.code16?.includes(q) || log.formattedCode?.includes(q);
        const matchEmail = log.attendeeEmail?.toLowerCase().includes(q);
        const matchId = log.attendeeIdNumber?.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchEmail && !matchId) return false;
      }
      return true;
    });
  }, [gateLogs, currentEventId, rosterStatusFilter, rosterGateFilter, rosterCategoryFilter, rosterSearch]);

  // Google Sheets Roster Export & Sync Hub States
  const [isGoogleSheetsModalOpen, setIsGoogleSheetsModalOpen] = useState(false);
  const [googleSheetCopied, setGoogleSheetCopied] = useState(false);
  const [googleSheetNotification, setGoogleSheetNotification] = useState<string | null>(null);

  // Generate Google Sheets Data (TSV formatted for direct spreadsheet cell alignment or CSV)
  const generateGoogleSheetsData = useCallback((format: 'tsv' | 'csv' = 'tsv') => {
    const headers = [
      'Record ID',
      'Entry Status',
      'Gate Station',
      'Attendee Name',
      'Ticket Category',
      'Ticket Price',
      'Scan Timestamp',
      'Pass Code (16-Digit)',
      'Formatted Pass Code',
      'Attendee Email',
      'Phone Number',
      'Student / Govt ID',
      'Event Name',
      'Gate / Security Notes'
    ];

    const delimiter = format === 'tsv' ? '\t' : ',';

    const rows = filteredGateLogs.map(log => {
      const statusLabel = 
        log.status === 'admitted' ? 'ADMITTED' :
        log.status === 'duplicate_denied' ? 'DUPLICATE BLOCKED' :
        log.status === 'wrong_gate_denied' ? 'WRONG GATE BLOCKED' :
        log.status === 'security_denied' ? 'SECURITY FLAGGED' :
        log.status.toUpperCase();

      const gateName = log.gateName || 'Main Gate';
      const attendeeName = log.attendeeName || 'Unassigned / Walk-in';
      const category = log.ticketCategory || 'General Admission';
      const price = typeof log.ticketPrice === 'number' ? `$${log.ticketPrice.toFixed(2)}` : '$0.00';
      const timestamp = log.entryTimestamp ? new Date(log.entryTimestamp).toLocaleString() : '';
      const code16 = log.code16 || '';
      const formattedCode = log.formattedCode || '';
      const email = log.attendeeEmail || '';
      const phone = log.attendeePhone || '';
      const idNum = log.attendeeIdNumber || '';
      const eventName = log.eventName || currentEvent.title;
      const notes = log.notes || 'Verified at turnstile';

      if (format === 'tsv') {
        return [
          log.id,
          statusLabel,
          gateName,
          attendeeName,
          category,
          price,
          timestamp,
          code16,
          formattedCode,
          email,
          phone,
          idNum,
          eventName,
          notes
        ].map(v => String(v ?? '').replace(/\t/g, ' ').replace(/\n/g, ' ')).join('\t');
      } else {
        return [
          `"${log.id}"`,
          `"${statusLabel}"`,
          `"${gateName.replace(/"/g, '""')}"`,
          `"${attendeeName.replace(/"/g, '""')}"`,
          `"${category.replace(/"/g, '""')}"`,
          `"${price}"`,
          `"${timestamp}"`,
          `"${code16}"`,
          `"${formattedCode}"`,
          `"${email.replace(/"/g, '""')}"`,
          `"${phone.replace(/"/g, '""')}"`,
          `"${idNum.replace(/"/g, '""')}"`,
          `"${eventName.replace(/"/g, '""')}"`,
          `"${notes.replace(/"/g, '""')}"`,
        ].join(',');
      }
    });

    return [headers.join(delimiter), ...rows].join('\n');
  }, [filteredGateLogs, currentEvent.title]);

  // Copy Formatted Spreadsheet Matrix to Clipboard
  const handleCopyGoogleSheetData = () => {
    const tsvContent = generateGoogleSheetsData('tsv');
    navigator.clipboard.writeText(tsvContent);
    setGoogleSheetCopied(true);
    setGoogleSheetNotification('📋 Formatted Google Sheets matrix copied! Paste (Ctrl+V / Cmd+V) directly into Google Sheets.');
    setTimeout(() => {
      setGoogleSheetCopied(false);
      setGoogleSheetNotification(null);
    }, 4000);
  };

  // 1-Click Open in Google Sheets Web and copy data for instant Ctrl+V
  const handleOpenDirectGoogleSheet = () => {
    const tsvContent = generateGoogleSheetsData('tsv');
    navigator.clipboard.writeText(tsvContent);
    window.open('https://docs.google.com/spreadsheets/create', '_blank', 'noopener,noreferrer');
    setGoogleSheetCopied(true);
    setGoogleSheetNotification('🚀 New Google Sheet opened! Press Ctrl+V (or Cmd+V) to paste your neatly organized attendance roster.');
    setTimeout(() => {
      setGoogleSheetCopied(false);
      setGoogleSheetNotification(null);
    }, 5000);
  };

  // Download Google Sheets Compatible CSV
  const handleDownloadGoogleSheetsCsv = () => {
    const csvContent = generateGoogleSheetsData('csv');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentEvent.title.replace(/\s+/g, '_')}_GoogleSheets_Attendance_Roster_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setGoogleSheetNotification('📥 Google Sheets attendance report downloaded successfully.');
    setTimeout(() => setGoogleSheetNotification(null), 3000);
  };

  // Legacy fallback
  const handleExportRosterCSV = handleDownloadGoogleSheetsCsv;

  // -------------------------------------------------------------
  // Sub-page 2: Pass Control & Security (Last 4 Digits Desk)
  // -------------------------------------------------------------
  const [securityQuery, setSecurityQuery] = useState('');
  const [selectedSecurityPass, setSelectedSecurityPass] = useState<PassItem | null>(null);
  const [securityNoteInput, setSecurityNoteInput] = useState('');
  const [securitySuccessMsg, setSecuritySuccessMsg] = useState<string | null>(null);

  const securityMatchedPasses = useMemo(() => {
    if (!securityQuery.trim()) return [];
    const q = securityQuery.trim().toLowerCase();
    const digitsOnly = q.replace(/\D/g, '');

    return passes.filter(p => {
      if (currentEventId && p.eventId && p.eventId !== currentEventId) return false;
      if (digitsOnly.length >= 4 && p.code16.endsWith(digitsOnly)) return true;
      if (p.code16.includes(digitsOnly) && digitsOnly.length >= 3) return true;
      if (p.formattedCode.toLowerCase().includes(q)) return true;
      if (p.assignedTo?.name.toLowerCase().includes(q)) return true;
      if (p.assignedTo?.email?.toLowerCase().includes(q)) return true;
      if (p.assignedTo?.idNumber?.toLowerCase().includes(q)) return true;
      return false;
    }).slice(0, 20);
  }, [passes, securityQuery, currentEventId]);

  const flaggedPassesList = useMemo(() => {
    return passes.filter(p => p.securityFlag && p.securityFlag !== 'none');
  }, [passes]);

  const handleSetSecurityFlag = (targetPass: PassItem, flag: PassSecurityStatus, noteText?: string) => {
    const updated: PassItem = {
      ...targetPass,
      securityFlag: flag,
      securityNotes: noteText || securityNoteInput || targetPass.securityNotes || '',
      securityFlaggedAt: flag !== 'none' ? new Date().toISOString() : undefined,
      securityFlaggedBy: flag !== 'none' ? 'Gate Security Desk' : undefined,
    };

    onUpdatePass(updated);
    setSelectedSecurityPass(updated);
    setSecuritySuccessMsg(`Pass ${updated.formattedCode} (${updated.assignedTo?.name || 'Guest'}) marked as ${flag.toUpperCase()}`);
    setSecurityNoteInput('');
    setTimeout(() => setSecuritySuccessMsg(null), 4000);
  };

  const handleResetPassEntry = (targetPass: PassItem) => {
    const updated: PassItem = {
      ...targetPass,
      status: 'assigned',
      checkedInAt: undefined,
      checkedInSession: undefined,
    };
    onUpdatePass(updated);
    setSelectedSecurityPass(updated);
    setSecuritySuccessMsg(`Pass ${updated.formattedCode} entry status reset to ASSIGNED (Entry Allowed again)`);
    setTimeout(() => setSecuritySuccessMsg(null), 4000);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      
      {/* --------------------------------------------------------- */}
      {/* TOP HEADER & SUB-PAGE NAVIGATION TABS (Pic 3)             */}
      {/* --------------------------------------------------------- */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 shrink-0">
            <ScanLine className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight leading-tight">Gate Entry Scanner</h2>
              {isCameraActive ? (
                <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full flex items-center gap-1 shadow-sm shadow-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> LIVE GATE
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-slate-800 text-slate-400 border border-slate-700 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span> READY
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              Checkpoint Ingress • Multi-Gate Routing • 1-Ticket 1-Entry Enforcement
            </p>
          </div>
        </div>

        {/* Sub Navigation Buttons */}
        <div className="flex items-center flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveSubTab('scanner')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer min-h-[38px] ${
              activeSubTab === 'scanner'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-750 hover:text-white border border-slate-700/80'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            Scanner
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('gates')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer min-h-[38px] ${
              activeSubTab === 'gates'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-750 hover:text-white border border-slate-700/80'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            Gates ({eventGates.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('roster')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer min-h-[38px] ${
              activeSubTab === 'roster'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-750 hover:text-white border border-slate-700/80'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            Roster ({eventGateLogs.filter(l => l.status === 'admitted').length})
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('security')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer min-h-[38px] ${
              activeSubTab === 'security'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-750 hover:text-white border border-slate-700/80'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            Security
            {flaggedPassesList.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-rose-500 text-white text-[9px] font-black rounded-full">
                {flaggedPassesList.length}
              </span>
            )}
          </button>

          {/* Sound Mute/Unmute toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled(prev => !prev)}
            className={`p-2 rounded-xl border transition-all cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center ${
              soundEnabled
                ? 'bg-slate-800 border-slate-700 text-emerald-400 hover:bg-slate-750'
                : 'bg-slate-850 border-rose-800/50 text-rose-400'
            }`}
            title={soundEnabled ? 'Harmonic chime audio active' : 'Audio muted'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* --------------------------------------------------------- */}
      {/* SUB-PAGE 1: MAIN GATE SCANNER VIEW (BODYGUARD / DELEGATE) */}
      {/* --------------------------------------------------------- */}
      {activeSubTab === 'scanner' && (
        <div className="space-y-5">
          
          {/* Compact Event & Stationed Gate Selector Bar (Pic 1) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl px-3.5 py-2 shadow-md flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Event Selector Dropdown */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">Event:</span>
                <select
                  value={currentEventId}
                  onChange={e => setCurrentEventId(e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-white text-xs font-bold px-2.5 py-1 rounded-lg focus:outline-none focus:border-emerald-500 cursor-pointer min-h-[32px] max-w-[200px] sm:max-w-[240px] truncate"
                >
                  {events.filter(e => e.status !== 'ended').map(ev => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title} ({ev.date})
                    </option>
                  ))}
                </select>
              </div>

              {/* Stationed Gate Selector Dropdown */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 flex items-center gap-1">
                  <Layers className="w-3 h-3 text-emerald-400" /> Gate:
                </span>
                <select
                  value={selectedGateId}
                  onChange={e => setSelectedGateId(e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-white text-xs font-bold px-2.5 py-1 rounded-lg focus:outline-none focus:border-emerald-500 cursor-pointer min-h-[32px] max-w-[190px] sm:max-w-[220px] truncate"
                >
                  {eventGates.map((gate) => (
                    <option key={gate.id} value={gate.id}>
                      {gate.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Active Gate Permissions Chip */}
            <div className="flex items-center gap-1.5 text-xs">
              <span 
                className="w-2 h-2 rounded-full shrink-0" 
                style={{ backgroundColor: activeGate?.color || '#10b981' }}
              />
              <span className="text-slate-300 font-bold text-[10.5px] truncate max-w-[140px] sm:max-w-[180px]">
                {activeGate?.name}:
              </span>
              <span className="px-2 py-0.5 rounded-md text-[9.5px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 truncate max-w-[180px] sm:max-w-[240px]">
                {activeGate?.allowedCategories.includes('all') ? 'All Ticket Types' : `Allowed: ${activeGate?.allowedCategories.join(', ')}`}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            
            {/* Left Column: Live Scanner / Camera / Simulation (50% Side-by-Side) */}
            <div className="w-full space-y-3.5">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-xl relative overflow-hidden">
                
                {/* Sleek Compact Camera & Control Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-emerald-400 shrink-0" />
                    <h3 className="font-bold text-white text-xs sm:text-sm">Live Camera Scanner</h3>
                    <span className="text-[9.5px] text-emerald-400/90 font-mono font-bold px-1.5 py-0.5 bg-emerald-950/60 border border-emerald-500/20 rounded-md truncate max-w-[140px]">
                      {activeGate?.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Camera Selector Dropdown */}
                    <select
                      value={
                        selectedDeviceId && availableCameras.some(c => c.deviceId === selectedDeviceId)
                          ? selectedDeviceId
                          : cameraModeType === 'front'
                          ? 'mode:front'
                          : cameraModeType === 'external'
                          ? 'mode:external'
                          : 'mode:back'
                      }
                      onChange={e => {
                        const val = e.target.value;
                        if (val === 'mode:back') handleSelectCameraMode('back');
                        else if (val === 'mode:front') handleSelectCameraMode('front');
                        else if (val === 'mode:external') handleSelectCameraMode('external');
                        else handleDeviceChange(val);
                      }}
                      className="bg-slate-950 border border-slate-700 text-slate-200 text-xs font-bold px-2 py-1 rounded-lg focus:outline-none focus:border-emerald-500 cursor-pointer min-h-[32px] max-w-[150px] truncate"
                    >
                      <option value="mode:back">📷 Back</option>
                      <option value="mode:front">🤳 Front</option>
                      {availableCameras.length > 0 ? (
                        <optgroup label="Available Cameras">
                          {availableCameras.map((d, idx) => (
                            <option key={d.deviceId || idx} value={d.deviceId}>
                              📹 {d.label || `Camera ${idx + 1}`}
                            </option>
                          ))}
                        </optgroup>
                      ) : (
                        <option value="mode:external">🎥 USB / Ext</option>
                      )}
                    </select>

                    {isCameraActive ? (
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-black uppercase tracking-wider cursor-pointer min-h-[32px] flex items-center gap-1 shrink-0"
                      >
                        Stop
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startCamera()}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1 shadow-md shadow-emerald-600/30 cursor-pointer min-h-[32px] shrink-0"
                      >
                        <Camera className="w-3.5 h-3.5" /> Start
                      </button>
                    )}
                  </div>
                </div>

                {/* Video Viewport - Compact & Aspect Responsive */}
                <div className="relative aspect-video max-h-[290px] sm:max-h-[310px] bg-slate-950 rounded-xl overflow-hidden border-2 border-dashed border-slate-700/80 flex items-center justify-center">
                  <video
                    ref={videoRef}
                    className={`w-full h-full object-cover ${!isCameraActive ? 'hidden' : ''}`}
                  />
                  <canvas ref={canvasRef} className="hidden" />

                  {!isCameraActive ? (
                    <div className="text-center p-4 space-y-2">
                      <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                        <ScanLine className="w-6 h-6 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-200">Camera is Inactive</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Click "Start" above or scan pass barcode below
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => startCamera()}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer shadow-lg shadow-emerald-600/20 min-h-[36px]"
                      >
                        Turn On Gate Camera
                      </button>
                    </div>
                  ) : (
                    /* Optical Scanning Reticle Overlay */
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
                      <div className="w-48 h-48 sm:w-56 sm:h-56 border-2 border-emerald-400 rounded-2xl relative animate-pulse shadow-[0_0_24px_rgba(16,185,129,0.3)]">
                        <div className="absolute -top-2 -left-2 w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg"></div>
                        <div className="absolute -top-2 -right-2 w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg"></div>
                        <div className="absolute -bottom-2 -left-2 w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg"></div>
                        <div className="absolute -bottom-2 -right-2 w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br-lg"></div>
                        
                        {/* Laser scanning line */}
                        <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent absolute top-1/2 -translate-y-1/2 animate-bounce"></div>
                      </div>
                      <span className="mt-3 px-2.5 py-0.5 bg-slate-950/80 backdrop-blur-md border border-emerald-500/40 text-emerald-300 font-mono text-[10px] font-bold rounded-full">
                        ALIGN PASS QR / BARCODE
                      </span>
                    </div>
                  )}
                </div>

                {cameraError && (
                  <div className="mt-2.5 p-2.5 bg-rose-950/40 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{cameraError}</span>
                  </div>
                )}

                {/* Manual Barcode / Scanner Input Field */}
                <div className="mt-3.5 space-y-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    Manual Code Entry or USB Laser Gun:
                  </label>
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      if (manualCodeInput.trim()) {
                        handleProcessCode(manualCodeInput.trim());
                        setManualCodeInput('');
                      }
                    }}
                    className="flex gap-2"
                  >
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={manualCodeInput}
                        onChange={e => setManualCodeInput(e.target.value)}
                        placeholder="Scan/Paste 16 digits or last 4 digits (e.g. 4592... or 1928)..."
                        className="w-full bg-slate-950 border border-slate-700 text-white font-mono text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-emerald-500 shadow-inner min-h-[38px]"
                        autoFocus
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer transition-all shadow-md shadow-emerald-600/30 shrink-0 min-h-[38px]"
                    >
                      Verify
                    </button>
                  </form>
                </div>

                {/* Gate Simulation Quick Triggers */}
                <div className="mt-3 pt-3 border-t border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                    Test Pass Simulations for {currentEvent.title}:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {eventPasses.slice(0, 4).map((p, idx) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleProcessCode(p.code16 || p.id)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 rounded-lg text-[11px] font-mono font-medium cursor-pointer transition-colors min-h-[30px]"
                      >
                        {p.assignedTo?.name ? `👤 ${p.assignedTo.name}` : `Pass #${idx + 1}`} ({p.category} • ••••{(p.code16 || '').slice(-4)})
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleProcessCode('9999999999999999')}
                      className="px-2.5 py-1 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 rounded-lg text-[11px] font-mono font-bold cursor-pointer transition-colors min-h-[30px]"
                    >
                      🚨 Test Fake Pass
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Turnstile Metrics & Ingress Feed (50% Side-by-Side) */}
            <div className="w-full space-y-3.5">
              
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
                
                {/* Header with 1-Ticket 1-Entry pill */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                    <div>
                      <h3 className="font-bold text-white text-sm">Turnstile Metrics</h3>
                      <p className="text-[10px] text-slate-400 truncate max-w-[180px]">
                        Event: <span className="text-emerald-300 font-bold">{currentEvent.title}</span>
                      </p>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    1-TICKET 1-ENTRY
                  </span>
                </div>

                {/* Metric Boxes (Dynamic for Main vs Secondary/Transit Gates - Compact & Balanced) */}
                {isMainGate ? (
                  /* 4-Box Grid for Main / Primary Gate */
                  <div className="grid grid-cols-2 gap-2">
                    {/* 1. Total Admitted */}
                    <div className="bg-slate-950/80 border border-emerald-500/30 p-2.5 rounded-xl">
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                          Admitted ({activeGate?.name.split('-')[0].trim() || 'Gate 1'})
                        </span>
                        <span 
                          className="w-1.5 h-1.5 rounded-full shrink-0" 
                          style={{ backgroundColor: activeGate?.color || '#10b981' }} 
                        />
                      </div>
                      <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400 mt-0.5">
                        {metricsGateAdmitted}
                      </div>
                      <span className="text-[8px] sm:text-[9px] text-emerald-400/80 font-medium truncate block">
                        At {activeGate?.name.split('-')[0].trim()} ({metricsEventTotalAdmitted} event total)
                      </span>
                    </div>

                    {/* 2. Remaining Entries (for Main Gate) */}
                    <div className="bg-slate-950/80 border border-indigo-500/30 p-2.5 rounded-xl">
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] font-bold uppercase tracking-wider text-indigo-300 block truncate">
                          Remaining Entries
                        </span>
                        <span className="text-[7.5px] font-black px-1.5 py-0.2 bg-indigo-950 text-indigo-300 border border-indigo-500/30 rounded uppercase">
                          {activeGate?.allowedCategories.includes('all') ? 'ALL' : activeGate?.allowedCategories.join('/')}
                        </span>
                      </div>
                      <div className="text-xl sm:text-2xl font-black font-mono text-indigo-400 mt-0.5">
                        {metricsGateQueue}
                      </div>
                      <span className="text-[8px] sm:text-[9px] text-indigo-300/80 font-medium truncate block">
                        Awaiting entry ({gateEligiblePasses.length} total)
                      </span>
                    </div>

                    {/* 3. Duplicate Blocks */}
                    <div className="bg-slate-950/80 border border-amber-500/30 p-2.5 rounded-xl">
                      <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                        Duplicate Blocks
                      </span>
                      <div className="text-xl sm:text-2xl font-black font-mono text-amber-400 mt-0.5">
                        {metricsGateDuplicateBlocks}
                      </div>
                      <span className="text-[8px] sm:text-[9px] text-amber-400/80 font-medium truncate block">
                        1-entry stops at {activeGate?.name.split('-')[0].trim()}
                      </span>
                    </div>

                    {/* 4. Fakes / Wrong Gate Intercepted */}
                    <div className="bg-slate-950/80 border border-rose-500/30 p-2.5 rounded-xl">
                      <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                        Fakes / Wrong Gate
                      </span>
                      <div className="text-xl sm:text-2xl font-black font-mono text-rose-400 mt-0.5">
                        {metricsGateFakesIntercepted}
                      </div>
                      <span className="text-[8px] sm:text-[9px] text-rose-400/80 font-medium truncate block">
                        Blocked at {activeGate?.name.split('-')[0].trim()}
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Sleek 2-Row Layout for Secondary Gates (2 Top Cards + 3 Compact Bottom Cards) */
                  <div className="space-y-2">
                    {/* Row 1: Primary Gate Stats (Admitted & In Queue) */}
                    <div className="grid grid-cols-2 gap-2">
                      {/* 1. Admitted */}
                      <div className="bg-slate-950/80 border border-emerald-500/30 p-2.5 rounded-xl">
                        <div className="flex items-center justify-between">
                          <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                            Admitted ({activeGate?.name.split('-')[0].trim()})
                          </span>
                          <span 
                            className="w-1.5 h-1.5 rounded-full shrink-0" 
                            style={{ backgroundColor: activeGate?.color || '#10b981' }} 
                          />
                        </div>
                        <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400 mt-0.5">
                          {metricsGateAdmitted}
                        </div>
                        <span className="text-[8px] sm:text-[9px] text-emerald-400/80 font-medium truncate block">
                          At {activeGate?.name.split('-')[0].trim()} ({metricsEventTotalAdmitted} event total)
                        </span>
                      </div>

                      {/* 2. In Queue */}
                      <div className="bg-slate-950/80 border border-indigo-500/30 p-2.5 rounded-xl">
                        <div className="flex items-center justify-between">
                          <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                            In Queue ({activeGate?.name.split('-')[0].trim()})
                          </span>
                          <span className="text-[7.5px] font-black px-1.5 py-0.2 bg-indigo-950 text-indigo-300 border border-indigo-500/30 rounded uppercase">
                            {activeGate?.allowedCategories.includes('all') ? 'ALL' : activeGate?.allowedCategories.join('/')}
                          </span>
                        </div>
                        <div className="text-xl sm:text-2xl font-black font-mono text-indigo-400 mt-0.5">
                          {metricsGateQueue}
                        </div>
                        <span className="text-[8px] sm:text-[9px] text-indigo-300/80 font-medium truncate block">
                          Awaiting entry ({gateEligiblePasses.length} eligible)
                        </span>
                      </div>
                    </div>

                    {/* Row 2: Secondary 3-Card Monitoring Row (In-Transit, Duplicates, Fakes/Wrong Gate) */}
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                      {/* IN-TRANSIT */}
                      <div className="bg-slate-950/80 border border-sky-500/30 p-2 rounded-xl">
                        <div className="flex items-center justify-between">
                          <span className="text-[7.5px] sm:text-[8px] font-bold uppercase tracking-wider text-sky-400 block truncate flex items-center gap-0.5">
                            <ArrowRightLeft className="w-2 h-2 text-sky-400 shrink-0" /> Transit
                          </span>
                          <span className="text-[7px] font-black px-1 py-0.2 bg-sky-950 text-sky-300 border border-sky-500/30 rounded">
                            TRANSIT
                          </span>
                        </div>
                        <div className="text-lg sm:text-xl font-black font-mono text-sky-400 mt-0.5">
                          {metricsGateInTransit}
                        </div>
                        <span className="text-[7.5px] sm:text-[8px] text-sky-300/80 font-medium truncate block">
                          {passedThroughToNextGateCount > 0 
                            ? `${passedThroughToNextGateCount} passed` 
                            : `${metricsGateInTransit} in-transit`}
                        </span>
                      </div>

                      {/* Duplicate Blocks */}
                      <div className="bg-slate-950/80 border border-amber-500/30 p-2 rounded-xl">
                        <span className="text-[7.5px] sm:text-[8px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                          Duplicates
                        </span>
                        <div className="text-lg sm:text-xl font-black font-mono text-amber-400 mt-0.5">
                          {metricsGateDuplicateBlocks}
                        </div>
                        <span className="text-[7.5px] sm:text-[8px] text-amber-400/80 font-medium truncate block">
                          1-ticket stops
                        </span>
                      </div>

                      {/* Fakes / Wrong Gate */}
                      <div className="bg-slate-950/80 border border-rose-500/30 p-2 rounded-xl">
                        <span className="text-[7.5px] sm:text-[8px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                          Fakes / Gate
                        </span>
                        <div className="text-lg sm:text-xl font-black font-mono text-rose-400 mt-0.5">
                          {metricsGateFakesIntercepted}
                        </div>
                        <span className="text-[7.5px] sm:text-[8px] text-rose-400/80 font-medium truncate block">
                          Blocked scans
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Recent Scan Feed (Strictly for this event) */}
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Recent Scan Feed:
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveSubTab('roster')}
                      className="text-[10px] font-bold text-emerald-400 hover:underline uppercase cursor-pointer"
                    >
                      View Roster &rarr;
                    </button>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {eventGateLogs.length === 0 ? (
                      <div className="p-4 bg-slate-950/60 rounded-xl text-center text-xs text-slate-500">
                        No scans logged for this event yet. Start camera or scan a pass to record entries.
                      </div>
                    ) : (
                      eventGateLogs.slice(0, 6).map(log => (
                        <div
                          key={log.id}
                          className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
                            log.status === 'admitted'
                              ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-200'
                              : log.status === 'duplicate_denied'
                              ? 'bg-amber-950/30 border-amber-800/40 text-amber-200'
                              : 'bg-rose-950/30 border-rose-800/40 text-rose-200'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            {log.status === 'admitted' ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                            )}
                            <div>
                              <p className="font-bold text-white leading-none">{log.attendeeName}</p>
                              <p className="text-[10px] text-slate-400 mt-1 font-mono">
                                {log.gateName || 'Main Gate'} • {log.ticketCategory} • ••••{(log.code16 || '').slice(-4)}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-md ${
                              log.status === 'admitted' 
                                ? 'bg-emerald-500/20 text-emerald-300' 
                                : log.status === 'wrong_gate_denied'
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}>
                              {log.status === 'admitted' ? 'ENTRY DONE' : log.status === 'wrong_gate_denied' ? 'WRONG GATE' : 'DUPLICATE'}
                            </span>
                            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                              {new Date(log.entryTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* SUB-PAGE 2: GATE BUILDER & ARCHITECTURE TAB               */}
      {/* --------------------------------------------------------- */}
      {activeSubTab === 'gates' && (
        <GateManagerTab
          currentEvent={currentEvent}
          events={events}
          selectedEventId={currentEventId}
          onSelectEvent={setCurrentEventId}
          onUpdateEvent={(upd) => {
            if (onUpdateEvent) onUpdateEvent(upd);
          }}
        />
      )}

      {/* --------------------------------------------------------- */}
      {/* SUB-PAGE 3: ENTRY ROSTER SPREADSHEET                      */}
      {/* --------------------------------------------------------- */}
      {activeSubTab === 'roster' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
          {/* Google Sheets Toast Notification Banner */}
          {googleSheetNotification && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-500/40 rounded-2xl text-emerald-300 text-xs font-bold flex items-center justify-between shadow-lg shadow-emerald-950/40 animate-fadeIn">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{googleSheetNotification}</span>
              </div>
              <button 
                type="button" 
                onClick={() => setGoogleSheetNotification(null)}
                className="text-emerald-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                Live Attendance &amp; Gate Roster ({filteredGateLogs.length} Records)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Real-time gate ingress records formatted for Google Sheets sync &amp; audit reports for {currentEvent.title}.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Main Google Sheets Export & Hub Button */}
              <button
                type="button"
                onClick={() => setIsGoogleSheetsModalOpen(true)}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/30 transition-all"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
                Google Sheets Hub
              </button>

              {/* 1-Click Direct Launch */}
              <button
                type="button"
                onClick={handleOpenDirectGoogleSheet}
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all"
                title="Create a new Google Sheet and automatically copy table data"
              >
                <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                1-Click Open Sheet
              </button>

              {/* Copy Formatted Matrix */}
              <button
                type="button"
                onClick={handleCopyGoogleSheetData}
                className="px-3 py-2.5 bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-750 rounded-xl text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-all"
                title="Copy formatted spreadsheet TSV to paste in Google Sheets (Ctrl+V)"
              >
                {googleSheetCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copy TSV</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <input
              type="text"
              value={rosterSearch}
              onChange={e => setRosterSearch(e.target.value)}
              placeholder="Search by name, email, or code..."
              className="bg-slate-950 border border-slate-700 text-white text-xs px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-emerald-500"
            />

            <select
              value={rosterStatusFilter}
              onChange={e => setRosterStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-white text-xs px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="admitted">Admitted (Entry Done)</option>
              <option value="duplicate_denied">Duplicate Blocked</option>
              <option value="wrong_gate_denied">Wrong Gate Blocked</option>
              <option value="security_denied">Security Flagged</option>
            </select>

            <select
              value={rosterGateFilter}
              onChange={e => setRosterGateFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-white text-xs px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">All Gates</option>
              {eventGates.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                setRosterSearch('');
                setRosterStatusFilter('all');
                setRosterGateFilter('all');
              }}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
            >
              Reset Filters
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Gate</th>
                  <th className="p-3.5">Attendee</th>
                  <th className="p-3.5">Pass Category</th>
                  <th className="p-3.5">16-Digit Code</th>
                  <th className="p-3.5">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredGateLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500">
                      No matching entry logs found.
                    </td>
                  </tr>
                ) : (
                  filteredGateLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-850/50">
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-md ${
                          log.status === 'admitted'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : log.status === 'wrong_gate_denied'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {log.status === 'admitted' ? 'ADMITTED' : log.status === 'wrong_gate_denied' ? 'WRONG GATE' : 'DUPLICATE'}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold text-slate-200">{log.gateName || 'Main Gate'}</td>
                      <td className="p-3.5 font-bold text-white">{log.attendeeName}</td>
                      <td className="p-3.5 text-slate-300">{log.ticketCategory}</td>
                      <td className="p-3.5 font-mono text-slate-400">••••{(log.code16 || '').slice(-4)}</td>
                      <td className="p-3.5 font-mono text-slate-400">
                        {new Date(log.entryTimestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* SUB-PAGE 4: SECURITY & LOST/STOLEN PASS DESK              */}
      {/* --------------------------------------------------------- */}
      {activeSubTab === 'security' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              Security Desk &amp; Pass Flagging
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Search by last 4 digits, attendee name, or pass code to flag Lost/Stolen passes or reset entry status.
            </p>
          </div>

          {securitySuccessMsg && (
            <div className="p-4 bg-emerald-950/60 border border-emerald-500/40 rounded-2xl text-emerald-300 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {securitySuccessMsg}
            </div>
          )}

          <div className="relative">
            <input
              type="text"
              value={securityQuery}
              onChange={e => setSecurityQuery(e.target.value)}
              placeholder="Search by last 4 digits (e.g. 1928), full 16 digits, or attendee name..."
              className="w-full bg-slate-950 border border-slate-700 text-white text-sm px-4 py-3 rounded-2xl focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>

          {securityMatchedPasses.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {securityMatchedPasses.map(p => (
                <div key={p.id} className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-white text-sm">{p.assignedTo?.name || 'Unassigned Pass'}</h4>
                      <p className="text-xs font-mono text-emerald-400 mt-0.5">{p.formattedCode}</p>
                      <span className="text-[10px] text-slate-400">{p.category} • {p.eventName}</span>
                    </div>

                    <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded-md ${
                      p.securityFlag && p.securityFlag !== 'none'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : p.status === 'checked_in'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-emerald-500/20 text-emerald-300'
                    }`}>
                      {p.securityFlag && p.securityFlag !== 'none' ? p.securityFlag : p.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-850">
                    <button
                      type="button"
                      onClick={() => handleSetSecurityFlag(p, 'lost', 'Reported lost by attendee')}
                      className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Flag Lost
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetSecurityFlag(p, 'stolen', 'Reported stolen pass')}
                      className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Flag Stolen
                    </button>
                    {p.status === 'checked_in' && (
                      <button
                        type="button"
                        onClick={() => handleResetPassEntry(p)}
                        className="px-3 py-1.5 bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 rounded-lg text-xs font-bold cursor-pointer"
                      >
                        Reset Entry (Allow In)
                      </button>
                    )}
                    {p.securityFlag && p.securityFlag !== 'none' && (
                      <button
                        type="button"
                        onClick={() => handleSetSecurityFlag(p, 'none', '')}
                        className="px-3 py-1.5 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 rounded-lg text-xs font-bold cursor-pointer"
                      >
                        Clear Security Flag
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------------------- */}
      {/* CENTERED POPUPS & MODALS                                  */}
      {/* --------------------------------------------------------- */}

      {/* 1. SUCCESS ENTRY POPUP (1-SECOND AUTO-DISMISS) */}
      {successEntryPass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border-2 border-emerald-500 p-8 rounded-3xl max-w-md w-full text-center space-y-4 shadow-[0_0_50px_rgba(16,185,129,0.3)] animate-scaleUp">
            <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-500/10">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <div>
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-black uppercase tracking-widest rounded-full">
                ACCESS GRANTED • {successEntryRecord?.gateName || 'GATE 1'}
              </span>
              <h3 className="text-2xl font-black text-white mt-2">
                {successEntryPass.assignedTo?.name || 'Verified Attendee'}
              </h3>
              <p className="text-sm font-mono text-emerald-400 mt-1">
                {successEntryPass.category} Pass • {successEntryPass.formattedCode}
              </p>
            </div>
            <p className="text-xs text-slate-400">1-Ticket 1-Entry Verified • Turnstile Open</p>
          </div>
        </div>
      )}

      {/* 2. DUPLICATE ENTRY ALERT MODAL */}
      {duplicateEntryData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border-2 border-amber-500 p-8 rounded-3xl max-w-md w-full text-center space-y-5 shadow-[0_0_50px_rgba(245,158,11,0.3)] animate-scaleUp">
            <div className="w-20 h-20 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto ring-8 ring-amber-500/10">
              <AlertTriangle className="w-12 h-12" />
            </div>
            <div>
              <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-black uppercase tracking-widest rounded-full">
                DUPLICATE ENTRY STOPPED
              </span>
              <h3 className="text-2xl font-black text-white mt-2">
                {duplicateEntryData.pass.assignedTo?.name || 'Attendee'}
              </h3>
              <p className="text-xs font-mono text-amber-400 mt-1">
                Already admitted at {duplicateEntryData.gateName || 'this gate'} on{' '}
                {new Date(duplicateEntryData.timestamp).toLocaleTimeString()}
              </p>
            </div>
            <p className="text-xs text-slate-400">
              Strict 1-Ticket 1-Entry Policy. Pass cannot be reused for second gate entry.
            </p>
            <button
              type="button"
              onClick={() => setDuplicateEntryData(null)}
              className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer shadow-lg shadow-amber-600/30"
            >
              Acknowledge &amp; Dismiss
            </button>
          </div>
        </div>
      )}

      {/* 3. WRONG GATE / SECTION RESTRICTION MODAL */}
      {wrongGateData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border-2 border-rose-500 p-8 rounded-3xl max-w-md w-full text-center space-y-5 shadow-[0_0_50px_rgba(244,63,94,0.3)] animate-scaleUp">
            <div className="w-20 h-20 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center mx-auto ring-8 ring-rose-500/10">
              <ShieldX className="w-12 h-12" />
            </div>
            <div>
              <span className="px-3 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-black uppercase tracking-widest rounded-full">
                ⛔ WRONG GATE / SECTION
              </span>
              <h3 className="text-2xl font-black text-white mt-2">
                {wrongGateData.pass.assignedTo?.name || 'Attendee'}
              </h3>
              <div className="mt-3 p-3 bg-slate-950 rounded-xl border border-rose-500/30 text-xs text-rose-200">
                <p className="font-bold">Pass Tier: <span className="text-amber-400">{wrongGateData.pass.category}</span></p>
                <p className="text-slate-400 mt-1">
                  This checkpoint ({wrongGateData.targetGate.name}) requires: <span className="text-white font-bold">{wrongGateData.allowedTiers.join(' or ')}</span>.
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Please direct attendee to Gate 1 (General Entry).
            </p>
            <button
              type="button"
              onClick={() => setWrongGateData(null)}
              className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer shadow-lg shadow-rose-600/30"
            >
              Acknowledge &amp; Redirect Attendee
            </button>
          </div>
        </div>
      )}

      {/* 4. FAKE TICKET MODAL */}
      {fakeTicketData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border-2 border-rose-600 p-8 rounded-3xl max-w-md w-full text-center space-y-5 shadow-[0_0_60px_rgba(225,29,72,0.4)] animate-scaleUp">
            <div className="w-20 h-20 bg-rose-600/20 text-rose-500 rounded-full flex items-center justify-center mx-auto ring-8 ring-rose-600/10">
              <ShieldAlert className="w-12 h-12" />
            </div>
            <div>
              <span className="px-3 py-1 bg-rose-600/20 text-rose-300 border border-rose-600/30 text-xs font-black uppercase tracking-widest rounded-full">
                🚨 COUNTERFEIT / UNREGISTERED PASS
              </span>
              <h3 className="text-2xl font-black text-white mt-2">ACCESS BLOCKED</h3>
              <p className="text-xs font-mono text-rose-400 mt-2 bg-slate-950 p-2 rounded-xl border border-rose-800/40">
                Scanned: {fakeTicketData.scannedCode}
              </p>
            </div>
            <p className="text-xs text-slate-400">
              This QR / 16-digit code does not exist in the official database. Escort to Security Desk.
            </p>
            <button
              type="button"
              onClick={() => setFakeTicketData(null)}
              className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer shadow-lg shadow-rose-600/30"
            >
              Dismiss Alarm
            </button>
          </div>
        </div>
      )}

      {/* 5. SECURITY BLOCKED PASS MODAL */}
      {securityBlockedData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border-2 border-rose-600 p-8 rounded-3xl max-w-md w-full text-center space-y-5 shadow-[0_0_60px_rgba(225,29,72,0.4)] animate-scaleUp">
            <div className="w-20 h-20 bg-rose-600/20 text-rose-500 rounded-full flex items-center justify-center mx-auto ring-8 ring-rose-600/10">
              <Lock className="w-12 h-12" />
            </div>
            <div>
              <span className="px-3 py-1 bg-rose-600/20 text-rose-300 border border-rose-600/30 text-xs font-black uppercase tracking-widest rounded-full">
                SECURITY LOCKOUT: {securityBlockedData.flag.toUpperCase()}
              </span>
              <h3 className="text-2xl font-black text-white mt-2">
                {securityBlockedData.pass.assignedTo?.name || 'Blocked Attendee'}
              </h3>
              <p className="text-xs text-rose-300 mt-2 bg-slate-950 p-3 rounded-xl border border-rose-800/40">
                {securityBlockedData.notes || 'This pass has been marked as Lost, Stolen, or Voided.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSecurityBlockedData(null)}
              className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer shadow-lg shadow-rose-600/30"
            >
              Acknowledge &amp; Retain Pass
            </button>
          </div>
        </div>
      )}

      {/* 6. UNASSIGNED PASS MODAL */}
      {unassignedScannedPass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border-2 border-amber-500 p-8 rounded-3xl max-w-md w-full text-center space-y-5 shadow-[0_0_50px_rgba(245,158,11,0.3)] animate-scaleUp">
            <div className="w-20 h-20 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto ring-8 ring-amber-500/10">
              <Users className="w-12 h-12" />
            </div>
            <div>
              <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-black uppercase tracking-widest rounded-full">
                PASS NOT YET ASSIGNED
              </span>
              <h3 className="text-2xl font-black text-white mt-2">
                {unassignedScannedPass.category} Pass
              </h3>
              <p className="text-xs font-mono text-amber-400 mt-1">
                {unassignedScannedPass.formattedCode}
              </p>
            </div>
            <p className="text-xs text-slate-400">
              This pass is in the unassigned inventory. Please bind an attendee's name and email in the Assign Pass tab before gate entry.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setUnassignedScannedPass(null)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer"
              >
                Close
              </button>
              {onNavigateToTab && (
                <button
                  type="button"
                  onClick={() => {
                    setUnassignedScannedPass(null);
                    onNavigateToTab('scanner');
                  }}
                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer shadow-lg shadow-amber-600/30"
                >
                  Assign Attendee Now
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 7. GOOGLE SHEETS ROSTER HUB & SYNC MODAL */}
      {isGoogleSheetsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-4xl w-full p-6 space-y-6 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scaleUp">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    Google Sheets Attendance Hub
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                      LIVE MATRIX
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Export, sync, and format real-time turnstile data directly for Google Sheets.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGoogleSheetsModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Notification Banner in Modal */}
            {googleSheetNotification && (
              <div className="p-3 bg-emerald-950/80 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{googleSheetNotification}</span>
              </div>
            )}

            {/* Live Stats Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Rows</span>
                <span className="text-xl font-black font-mono text-white mt-0.5 block">{filteredGateLogs.length}</span>
              </div>
              <div className="bg-slate-950/80 border border-emerald-500/30 p-3 rounded-2xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">Admitted Entries</span>
                <span className="text-xl font-black font-mono text-emerald-400 mt-0.5 block">
                  {filteredGateLogs.filter(l => l.status === 'admitted').length}
                </span>
              </div>
              <div className="bg-slate-950/80 border border-rose-500/30 p-3 rounded-2xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 block">Security / Duplicates</span>
                <span className="text-xl font-black font-mono text-rose-400 mt-0.5 block">
                  {filteredGateLogs.filter(l => l.status !== 'admitted').length}
                </span>
              </div>
              <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Event Title</span>
                <span className="text-xs font-bold text-slate-200 mt-1 block truncate">{currentEvent.title}</span>
              </div>
            </div>

            {/* Workflow Action Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              
              {/* Option 1: 1-Click Google Sheets Instant Launch */}
              <button
                type="button"
                onClick={handleOpenDirectGoogleSheet}
                className="bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/40 hover:border-emerald-400 p-4 rounded-2xl text-left cursor-pointer transition-all flex flex-col justify-between group shadow-lg shadow-emerald-950/20"
              >
                <div>
                  <div className="w-8 h-8 rounded-xl bg-emerald-600/30 text-emerald-400 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                    <ExternalLink className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                    1-Click Open Sheet
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Opens a new Google Sheet &amp; copies all table data. Simply press <span className="text-emerald-300 font-mono font-bold">Ctrl+V</span> to paste.
                  </p>
                </div>
                <div className="mt-3 text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                  Launch Google Sheets &rarr;
                </div>
              </button>

              {/* Option 2: Copy Formatted Spreadsheet Matrix */}
              <button
                type="button"
                onClick={handleCopyGoogleSheetData}
                className="bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 p-4 rounded-2xl text-left cursor-pointer transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="w-8 h-8 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                    <Copy className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                    Copy TSV Matrix
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Copies tab-delimited cells directly to clipboard. Fully aligned with columns and numbers.
                  </p>
                </div>
                <div className="mt-3 text-[10px] font-black uppercase tracking-wider text-slate-400 group-hover:text-emerald-400 flex items-center gap-1">
                  {googleSheetCopied ? '✓ Copied to Clipboard' : 'Copy Formatted Cells'}
                </div>
              </button>

              {/* Option 3: Download Formatted CSV */}
              <button
                type="button"
                onClick={handleDownloadGoogleSheetsCsv}
                className="bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 p-4 rounded-2xl text-left cursor-pointer transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="w-8 h-8 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
                    <Download className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                    Download File (.csv)
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Downloads UTF-8 file ready for Google Sheets <span className="font-mono text-slate-300">File &gt; Import</span> or Excel.
                  </p>
                </div>
                <div className="mt-3 text-[10px] font-black uppercase tracking-wider text-slate-400 group-hover:text-emerald-400 flex items-center gap-1">
                  Download File
                </div>
              </button>
            </div>

            {/* Spreadsheet Matrix Preview Table */}
            <div className="flex-1 min-h-[220px] bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden flex flex-col">
              <div className="p-3 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Table className="w-3.5 h-3.5 text-emerald-400" />
                  Spreadsheet Matrix Alignment Preview
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Showing {Math.min(filteredGateLogs.length, 10)} of {filteredGateLogs.length} rows
                </span>
              </div>
              <div className="overflow-x-auto overflow-y-auto max-h-[240px]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 sticky top-0 border-b border-slate-800">
                    <tr>
                      <th className="px-3 py-2 border-r border-slate-800">Status</th>
                      <th className="px-3 py-2 border-r border-slate-800">Gate</th>
                      <th className="px-3 py-2 border-r border-slate-800">Attendee</th>
                      <th className="px-3 py-2 border-r border-slate-800">Tier</th>
                      <th className="px-3 py-2 border-r border-slate-800">Price</th>
                      <th className="px-3 py-2 border-r border-slate-800">Timestamp</th>
                      <th className="px-3 py-2 border-r border-slate-800">Pass Code</th>
                      <th className="px-3 py-2">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 font-mono text-[11px]">
                    {filteredGateLogs.slice(0, 10).map((log) => (
                      <tr key={log.id} className="hover:bg-slate-900/50">
                        <td className="px-3 py-1.5 border-r border-slate-800">
                          <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold ${
                            log.status === 'admitted'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {log.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 border-r border-slate-800 text-slate-300 font-sans">{log.gateName || 'Main Gate'}</td>
                        <td className="px-3 py-1.5 border-r border-slate-800 text-white font-sans font-bold">{log.attendeeName || 'Unassigned'}</td>
                        <td className="px-3 py-1.5 border-r border-slate-800 text-slate-300">{log.ticketCategory || 'General'}</td>
                        <td className="px-3 py-1.5 border-r border-slate-800 text-emerald-400 font-bold">${(log.ticketPrice || 0).toFixed(2)}</td>
                        <td className="px-3 py-1.5 border-r border-slate-800 text-slate-400 text-[10px]">
                          {log.entryTimestamp ? new Date(log.entryTimestamp).toLocaleTimeString() : ''}
                        </td>
                        <td className="px-3 py-1.5 border-r border-slate-800 text-slate-300">{log.formattedCode || log.code16}</td>
                        <td className="px-3 py-1.5 text-slate-400">{log.attendeeEmail || '-'}</td>
                      </tr>
                    ))}
                    {filteredGateLogs.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-slate-500 font-sans text-xs">
                          No ingress logs match current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsGoogleSheetsModalOpen(false)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleOpenDirectGoogleSheet}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl cursor-pointer shadow-lg shadow-emerald-600/30 flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Launch Google Sheet
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
