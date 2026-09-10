import React, { useState, useEffect, useRef, useMemo } from 'react';
import jsQR from 'jsqr';
import { PassItem } from '../types';
import { format16DigitCode, playAssignSuccessChime, playErrorChime } from '../lib/passUtils';
import { PassBadgeCard } from './PassBadgeCard';
import { 
  ScanLine, 
  Camera, 
  Upload, 
  Search, 
  UserPlus, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  RefreshCw,
  QrCode,
  ArrowRight,
  SwitchCamera,
  Tag,
  Ticket,
  DollarSign,
  ShieldCheck,
  Check,
  Filter,
  Copy
} from 'lucide-react';

interface QRScanAssignerProps {
  passes: PassItem[];
  onAssignPass: (passId: string, attendeeName: string, email?: string, phone?: string, notes?: string) => void;
  onNavigateToAssigned: () => void;
  isReadOnly?: boolean;
}

export const QRScanAssigner: React.FC<QRScanAssignerProps> = ({
  passes,
  onAssignPass,
  onNavigateToAssigned,
  isReadOnly = false,
}) => {
  // Input / Scan state
  const [scannedCodeInput, setScannedCodeInput] = useState('');
  const [selectedPass, setSelectedPass] = useState<PassItem | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  // Form State for Assigning Name
  const [attendeeName, setAttendeeName] = useState('');
  const [attendeeEmail, setAttendeeEmail] = useState('');
  const [attendeePhone, setAttendeePhone] = useState('');
  const [attendeeNotes, setAttendeeNotes] = useState('');

  // Camera & Video Scan state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameId = useRef<number | null>(null);
  const lastScannedCodeRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  // Enumerate video devices
  const updateCameraDevices = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setAvailableCameras(videoDevices);
      }
    } catch (e) {
      console.error('Error enumerating cameras:', e);
    }
  };

  useEffect(() => {
    updateCameraDevices();
  }, []);

  const handleFlipCamera = () => {
    setSelectedDeviceId(''); // Reset device ID so facingMode toggles cleanly
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Success Feedback
  const [assignedSuccessPass, setAssignedSuccessPass] = useState<PassItem | null>(null);

  // List of Unassigned Passes
  const unassignedPasses = useMemo(() => {
    return passes.filter(p => p.status === 'unassigned');
  }, [passes]);

  // Unique Categories from all unassigned passes
  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    unassignedPasses.forEach(p => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats);
  }, [unassignedPasses]);

  // Filtered Unassigned Passes by Category & Search
  const matchingFilteredPasses = useMemo(() => {
    let list = unassignedPasses;
    if (selectedCategoryFilter !== 'all') {
      list = list.filter(p => p.category === selectedCategoryFilter);
    }

    const query = scannedCodeInput.trim().toLowerCase();
    if (!query) return list;

    const digitsOnly = query.replace(/\D/g, '');

    return list.filter(p => {
      // Digits match (e.g. last 4 digits "8286" or partial code)
      if (digitsOnly.length > 0) {
        if (p.code16.endsWith(digitsOnly) || p.code16.includes(digitsOnly)) return true;
      }
      // Formatted code match
      if (p.formattedCode.toLowerCase().includes(query)) return true;
      // Pass ID match
      if (p.id.toLowerCase().includes(query)) return true;
      // Category match (e.g. typing "VIP", "Student")
      if (p.category && p.category.toLowerCase().includes(query)) return true;
      // Event name match
      if (p.eventName.toLowerCase().includes(query)) return true;
      return false;
    });
  }, [unassignedPasses, selectedCategoryFilter, scannedCodeInput]);

  // Lookup Pass by raw 16 digits, last 4 digits, formatted code, or ID
  const handleLookupCode = (codeStr: string) => {
    const cleaned = codeStr.replace(/\D/g, '');
    const rawLower = codeStr.trim().toLowerCase();
    
    // First check exact 16 digits, formatted code, or ID across all passes
    let foundInAll = passes.find(
      p => p.code16 === cleaned || 
           p.formattedCode.toLowerCase() === rawLower || 
           p.id.toLowerCase() === rawLower
    );

    // If not found and input has digits (e.g., last 4 digits), look for unassigned pass ending with those digits
    if (!foundInAll && cleaned.length >= 4) {
      const matches = unassignedPasses.filter(p => p.code16.endsWith(cleaned) || p.code16.includes(cleaned));
      if (matches.length === 1) {
        foundInAll = matches[0];
      } else if (matches.length > 1) {
        // Multiple matches found - auto-select the first one matching category filter or first match
        const matchingCategory = selectedCategoryFilter !== 'all' 
          ? matches.find(p => p.category === selectedCategoryFilter) 
          : matches[0];
        foundInAll = matchingCategory || matches[0];
        setCameraError(null);
      }
    }

    if (foundInAll) {
      if (foundInAll.status !== 'unassigned') {
        playErrorChime();
        setSelectedPass(null);
        setCameraError(`⛔ ALREADY ASSIGNED: Pass "${foundInAll.formattedCode}" (${foundInAll.category || 'Pass'}) is already assigned to ${foundInAll.assignedTo?.name || 'an attendee'}.`);
        return;
      }

      setSelectedPass(foundInAll);
      playAssignSuccessChime();
      setCameraError(null);
    } else if (cleaned.length >= 16) {
      playErrorChime();
      setCameraError(`Pass with code "${codeStr}" not found in system.`);
    } else if (cleaned.length >= 4) {
      const assignedMatch = passes.find(p => p.code16.endsWith(cleaned) && p.status !== 'unassigned');
      if (assignedMatch) {
        playErrorChime();
        setCameraError(`⛔ ALREADY ASSIGNED: Pass ending in "${cleaned}" (${assignedMatch.category || 'Pass'}) is already assigned to "${assignedMatch.assignedTo?.name || 'an attendee'}".`);
      } else {
        playErrorChime();
        setCameraError(`No unassigned pass found matching "${codeStr}".`);
      }
    }
  };

  // Live Camera Scanner loop
  useEffect(() => {
    let stream: MediaStream | null = null;

    if (isCameraActive) {
      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId 
          ? { deviceId: { exact: selectedDeviceId } }
          : { facingMode: facingMode }
      };

      navigator.mediaDevices
        .getUserMedia(constraints)
        .then(s => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
            videoRef.current.setAttribute('playsinline', 'true');
            videoRef.current.play();
            requestAnimationFrame(scanFrame);
          }
          // Refresh list of devices now that permission is granted
          updateCameraDevices();
        })
        .catch(err => {
          console.error('Camera access error:', err);
          if (selectedDeviceId || facingMode) {
            navigator.mediaDevices.getUserMedia({ video: true })
              .then(s => {
                stream = s;
                if (videoRef.current) {
                  videoRef.current.srcObject = s;
                  videoRef.current.setAttribute('playsinline', 'true');
                  videoRef.current.play();
                  requestAnimationFrame(scanFrame);
                }
                updateCameraDevices();
              })
              .catch(() => {
                setCameraError('Camera access denied or unavailable. Please use file upload or manual code entry.');
                setIsCameraActive(false);
              });
          } else {
            setCameraError('Camera access denied or unavailable. Please use file upload or manual code entry.');
            setIsCameraActive(false);
          }
        });
    }

    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, [isCameraActive, facingMode, selectedDeviceId]);

  const scanFrame = () => {
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      if (isCameraActive) animFrameId.current = requestAnimationFrame(scanFrame);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        const now = Date.now();
        if (
          code.data !== lastScannedCodeRef.current.code ||
          now - lastScannedCodeRef.current.time > 2000
        ) {
          lastScannedCodeRef.current = { code: code.data, time: now };
          setScannedCodeInput(code.data);
          handleLookupCode(code.data);
        }
      }
    }

    if (isCameraActive) {
      animFrameId.current = requestAnimationFrame(scanFrame);
    }
  };

  // Helper for category badge styling
  const getCategoryBadgeClass = (category?: string) => {
    const cat = (category || '').toLowerCase();
    if (cat.includes('vip') || cat.includes('all-access') || cat.includes('platinum') || cat.includes('gold')) {
      return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    }
    if (cat.includes('student') || cat.includes('academic') || cat.includes('scholar')) {
      return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
    }
    if (cat.includes('speaker') || cat.includes('panelist') || cat.includes('guest')) {
      return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
    }
    if (cat.includes('press') || cat.includes('media')) {
      return 'bg-pink-500/20 text-pink-300 border-pink-500/40';
    }
    if (cat.includes('staff') || cat.includes('crew') || cat.includes('organizer')) {
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    }
    return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
  };

  // Assign Name Form Submission
  const handleAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    if (!selectedPass || !attendeeName.trim()) return;

    onAssignPass(
      selectedPass.id,
      attendeeName.trim(),
      attendeeEmail.trim() || undefined,
      attendeePhone.trim() || undefined,
      attendeeNotes.trim() || undefined
    );

    playAssignSuccessChime();

    const updatedPass = {
      ...selectedPass,
      status: 'assigned' as const,
      assignedTo: {
        name: attendeeName.trim(),
        email: attendeeEmail.trim() || undefined,
        phone: attendeePhone.trim() || undefined,
        notes: attendeeNotes.trim() || undefined,
        assignedAt: new Date().toISOString(),
      },
    };

    setAssignedSuccessPass(updatedPass);
    setSelectedPass(null);
    setAttendeeName('');
    setAttendeeEmail('');
    setAttendeePhone('');
    setAttendeeNotes('');
    setScannedCodeInput('');
  };

  // Auto-dismiss pass binding success popup after 3.5 seconds
  useEffect(() => {
    if (assignedSuccessPass) {
      const timer = setTimeout(() => {
        setAssignedSuccessPass(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [assignedSuccessPass]);

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 py-6 px-4 relative">
      
      {/* Floating Success Notification Modal / Popup */}
      {assignedSuccessPass && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl bg-slate-900 border-2 border-emerald-500 p-5 text-white shadow-2xl rounded-2xl flex items-center justify-between gap-4 animate-bounce">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  ✓ Pass Assigned Successfully
                </span>
                <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded-full border ${getCategoryBadgeClass(assignedSuccessPass.category)}`}>
                  🎟️ {assignedSuccessPass.category || 'General Pass'}
                </span>
              </div>
              <h3 className="text-lg font-black tracking-tight text-white mt-0.5">
                {assignedSuccessPass.assignedTo?.name}
              </h3>
              <p className="text-xs font-mono text-slate-300 mt-0.5">
                Code: <span className="text-emerald-400 font-bold">{assignedSuccessPass.formattedCode}</span> • {assignedSuccessPass.eventName}
              </p>
            </div>
          </div>

          <button
            onClick={() => setAssignedSuccessPass(null)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs uppercase rounded-xl transition-colors shrink-0 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0">
            <ScanLine className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-white tracking-tight">Scan &amp; Assign Passes</h2>
              <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
                {unassignedPasses.length} Ready in Queue
              </span>
              {isReadOnly && (
                <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
                  🔒 Read-Only View
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isReadOnly 
                ? 'Search and preview pass tier allocations and codes in read-only mode.' 
                : 'Verify pass type/tier, search by last 4 digits, and instantly bind guest identity.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onNavigateToAssigned}
          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white text-xs font-bold uppercase tracking-wider rounded-xl border border-slate-700 flex items-center gap-2 transition-all cursor-pointer self-start md:self-auto"
        >
          View Assigned Directory <ArrowRight className="w-4 h-4 text-indigo-400" />
        </button>
      </div>

      {isReadOnly && (
        <div className="p-3.5 bg-amber-950/30 border border-amber-500/30 rounded-2xl text-amber-200 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Gate Security Operator Mode:</strong> You have read-only access to view and verify passes. Editing and attendee assignment are restricted to workspace organizers. Use the <strong>Gate Scanner</strong> page for live barcode turnstile check-in.
          </span>
        </div>
      )}

      {/* Scanner Control Panel Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left Column: Fast Code Lookup & Live Camera Stream */}
        <div className="bg-slate-900 border border-slate-800 p-6 sm:p-8 space-y-6 rounded-3xl shadow-xl">
          
          {/* Fast Code Search Input (Placed Directly Above Live Camera) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Search className="w-4 h-4 text-indigo-400" />
                Search by Last 4 Digits, Code, or Pass Type
              </h3>
              <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 border border-indigo-500/30 font-bold uppercase rounded-lg">
                Fast Lookup
              </span>
            </div>

            {/* Category Filter Chips */}
            {uniqueCategories.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Filter className="w-3 h-3 text-indigo-400" /> Filter by Pass Type / Tier:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryFilter('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                      selectedCategoryFilter === 'all'
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    All Types ({unassignedPasses.length})
                  </button>
                  {uniqueCategories.map(cat => {
                    const count = unassignedPasses.filter(p => p.category === cat).length;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategoryFilter(cat)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                          selectedCategoryFilter === cat
                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                            : `${getCategoryBadgeClass(cat)} hover:brightness-125`
                        }`}
                      >
                        <Tag className="w-3 h-3 opacity-70" />
                        {cat} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="text-xs text-slate-400">
              Type the last 4 digits (e.g. <span className="text-indigo-400 font-mono font-bold">9182</span>), full pass code, or pass type name:
            </p>

            <form
              onSubmit={e => {
                e.preventDefault();
                if (scannedCodeInput.trim()) {
                  handleLookupCode(scannedCodeInput.trim());
                }
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={scannedCodeInput}
                onChange={e => {
                  const val = e.target.value;
                  setScannedCodeInput(val);
                  const cleaned = val.replace(/\D/g, '');
                  if (cleaned.length === 16) {
                    handleLookupCode(val);
                  }
                }}
                maxLength={24}
                placeholder="Enter last 4 digits (e.g. 8286) or code"
                className="flex-1 bg-slate-950 border border-slate-700/80 focus:border-indigo-500 p-3.5 font-mono font-bold text-sm text-white outline-none tracking-widest placeholder:text-slate-500 placeholder:text-xs rounded-xl shadow-inner transition-colors"
              />
              <button
                type="submit"
                className="px-5 py-3.5 bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider hover:bg-indigo-500 active:scale-95 transition-all rounded-xl shadow-md shadow-indigo-600/30 shrink-0 cursor-pointer flex items-center gap-1.5"
              >
                <Search className="w-3.5 h-3.5" /> Find Pass
              </button>
            </form>

            {/* Live Matching Passes with Clear Pass Type / Category Displays */}
            <div className="bg-slate-950 border border-slate-800 p-3 space-y-2.5 rounded-2xl">
              <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 flex items-center justify-between">
                <span>Matching Unassigned Passes ({matchingFilteredPasses.length}):</span>
                {scannedCodeInput.trim() && (
                  <span className="font-mono text-slate-400">Query: "{scannedCodeInput.trim()}"</span>
                )}
              </div>

              {matchingFilteredPasses.length === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-xs text-slate-500">
                    No unassigned passes match your search criteria.
                  </p>
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {matchingFilteredPasses.map(p => {
                    const isSelected = selectedPass?.id === p.id;
                    return (
                      <div 
                        key={p.id}
                        onClick={() => {
                          setSelectedPass(p);
                          setScannedCodeInput(p.formattedCode);
                          playAssignSuccessChime();
                          setCameraError(null);
                        }}
                        className={`p-3 border text-xs transition-all cursor-pointer rounded-xl flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-indigo-950/80 border-indigo-500 shadow-md shadow-indigo-500/20' 
                            : 'bg-slate-900/90 hover:bg-slate-850 border-slate-800 text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        <div className="space-y-1.5 min-w-0 flex-1">
                          
                          {/* 16-Digit Code & Copy */}
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-sm text-white tracking-wider">
                              {p.formattedCode}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyCode(p.formattedCode, p.id);
                              }}
                              className="text-slate-500 hover:text-indigo-400 p-1 transition-colors"
                              title="Copy code"
                            >
                              {copiedCodeId === p.id ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>

                          {/* PASS TYPE / CATEGORY BADGE & EVENT INFO */}
                          <div className="flex items-center flex-wrap gap-2">
                            {/* Prominent Pass Type Badge */}
                            <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md border flex items-center gap-1 ${getCategoryBadgeClass(p.category)}`}>
                              <Ticket className="w-3 h-3" />
                              {p.category || 'General Admission'}
                            </span>

                            {/* Ticket Price if configured */}
                            {typeof p.ticketPrice === 'number' && p.ticketPrice > 0 ? (
                              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold rounded-md flex items-center gap-0.5">
                                ₹{p.ticketPrice}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-mono font-medium rounded-md">
                                Free Entry
                              </span>
                            )}

                            {/* Event Title */}
                            <span className="text-[11px] text-slate-400 font-sans truncate max-w-[200px]" title={p.eventName}>
                              🎓 {p.eventName}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-medium font-mono">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                              (unassigned - ready)
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPass(p);
                              setScannedCodeInput(p.formattedCode);
                              playAssignSuccessChime();
                              setCameraError(null);
                            }}
                            className={`px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 ${
                              isSelected
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                                : 'bg-slate-800 text-indigo-300 hover:bg-indigo-600 hover:text-white border border-slate-700'
                            }`}
                          >
                            {isSelected ? (
                              <>
                                <Check className="w-3.5 h-3.5" /> Selected
                              </>
                            ) : (
                              'Select'
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Unassigned Selector Dropdown */}
            {unassignedPasses.length > 0 && (
              <div className="pt-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Or select from unassigned queue ({unassignedPasses.length}):
                </label>
                <select
                  onChange={e => {
                    const pass = unassignedPasses.find(p => p.id === e.target.value);
                    if (pass) {
                      setSelectedPass(pass);
                      setScannedCodeInput(pass.formattedCode);
                      playAssignSuccessChime();
                      setCameraError(null);
                    }
                  }}
                  value={selectedPass?.id || ''}
                  className="w-full bg-slate-950 border border-slate-700/80 p-3 font-mono text-xs text-white outline-none rounded-xl focus:border-indigo-500 cursor-pointer"
                >
                  <option value="">Select Blank Unassigned Pass...</option>
                  {unassignedPasses.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.formattedCode} — [{p.category || 'General'}] {p.ticketPrice ? `(₹${p.ticketPrice})` : ''} • {p.eventName}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Live Camera Scanner Toolbar & Camera Viewport */}
          <div className="pt-4 border-t border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Camera className="w-4 h-4 text-indigo-400" />
                Live Camera Scanner
              </h3>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCameraActive(!isCameraActive)}
                  className={`px-3 py-1.5 font-bold text-[10px] uppercase tracking-wider rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer ${
                    isCameraActive
                      ? 'bg-rose-600 text-white hover:bg-rose-500 shadow-sm shadow-rose-600/30'
                      : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm shadow-indigo-600/30'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  {isCameraActive ? 'Stop Camera' : 'Turn Camera On'}
                </button>

                {isCameraActive && (
                  <button
                    type="button"
                    onClick={handleFlipCamera}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 rounded-xl cursor-pointer"
                  >
                    <SwitchCamera className="w-3.5 h-3.5" />
                    Flip
                  </button>
                )}
              </div>
            </div>

            {/* Camera Viewport */}
            {isCameraActive ? (
              <div className="relative overflow-hidden bg-black aspect-video border-2 border-indigo-500 flex items-center justify-center rounded-2xl shadow-2xl">
                <video ref={videoRef} className="w-full h-full object-cover" />
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute inset-0 border border-indigo-500/50 pointer-events-none flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-dashed border-indigo-400 animate-pulse rounded-xl" />
                </div>

                {/* Status Overlay */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                  <span className="bg-slate-950/90 text-indigo-300 font-mono text-[10px] uppercase tracking-wider px-3 py-1 rounded-lg">
                    Scanning live for QR code...
                  </span>
                  <span className="bg-indigo-600 text-white font-bold text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-lg font-mono shadow-md">
                    {facingMode === 'environment' ? 'Rear Camera' : 'Front Camera'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="border border-slate-800 bg-slate-950/60 p-6 rounded-2xl text-center space-y-3">
                <Camera className="w-8 h-8 text-slate-500 mx-auto" />
                <p className="text-xs text-slate-400">
                  Camera is inactive. Turn on camera to scan printed passes or QR badges.
                </p>
                <button
                  type="button"
                  onClick={() => setIsCameraActive(true)}
                  className="px-4 py-2 bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider hover:bg-indigo-500 rounded-xl transition-colors inline-flex items-center gap-2 cursor-pointer shadow-sm shadow-indigo-600/30"
                >
                  <Camera className="w-4 h-4" />
                  Turn Camera On
                </button>
              </div>
            )}
          </div>

          {cameraError && (
            <div className="p-4 bg-rose-950/40 border border-rose-500/30 text-xs font-mono text-rose-300 flex items-start gap-2 rounded-xl">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{cameraError}</span>
            </div>
          )}
        </div>

        {/* Right Column: Attendee Assignment Form */}
        <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 space-y-3.5 rounded-3xl shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-indigo-400" />
              Assign Attendee Identity
            </h3>
            {selectedPass && (
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider rounded-full">
                Ready to Bind
              </span>
            )}
          </div>

          {selectedPass ? (
            <div className="space-y-3">
              
              {/* Ultra-Compact Selected Pass Summary Card */}
              <div className="bg-slate-950 border border-indigo-500/40 p-3 rounded-2xl space-y-1.5 shadow-md">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center flex-wrap gap-1.5 min-w-0">
                    {/* Pass Type Badge */}
                    <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md border flex items-center gap-1 ${getCategoryBadgeClass(selectedPass.category)}`}>
                      <Ticket className="w-3 h-3" />
                      {selectedPass.category || 'General'}
                    </span>

                    {/* Price if set */}
                    {typeof selectedPass.ticketPrice === 'number' && selectedPass.ticketPrice > 0 ? (
                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold rounded-md">
                        ₹{selectedPass.ticketPrice}
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 bg-slate-800 text-slate-400 text-[10px] font-mono rounded">
                        Free
                      </span>
                    )}

                    {/* 16-digit code */}
                    <span className="font-mono font-black text-xs sm:text-sm text-white tracking-wider">
                      {selectedPass.formattedCode}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPass(null);
                      setScannedCodeInput('');
                    }}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white font-semibold text-[10px] uppercase rounded-lg transition-colors cursor-pointer shrink-0 border border-slate-700"
                  >
                    Change Pass
                  </button>
                </div>

                <div className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                  <span>🎓 {selectedPass.eventName}</span>
                </div>
              </div>

              {/* Compact Attendee Registration Form */}
              <form onSubmit={handleAssignSubmit} className="space-y-2.5">
                {isReadOnly ? (
                  <div className="p-3 bg-slate-950 border border-amber-500/30 rounded-xl space-y-2 text-center">
                    <p className="text-xs font-bold text-amber-300">
                      🔒 Attendee Assignment Locked (Read-Only Mode)
                    </p>
                    <p className="text-[11px] text-slate-400">
                      As a Gate Operator / Live Viewer, pass assignment and editing are disabled. You can view pass allocations and use the Gate Scanner for entry verification.
                    </p>
                    <div className="p-2.5 bg-slate-900 rounded-lg text-left text-xs font-mono space-y-1">
                      <div className="text-slate-300">Pass Code: <strong>{selectedPass.formattedCode}</strong></div>
                      <div className="text-slate-300">Event: <strong>{selectedPass.eventName}</strong></div>
                      <div className="text-slate-300">Type: <strong>{selectedPass.category || 'General'}</strong></div>
                      <div className="text-slate-300">Status: <strong className="text-emerald-400 uppercase">{selectedPass.status}</strong></div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider mb-1 font-bold text-slate-300">
                        Attendee Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={attendeeName}
                        onChange={e => setAttendeeName(e.target.value)}
                        placeholder="e.g. Alex Rivera"
                        className="w-full bg-slate-950 border border-slate-700/80 focus:border-indigo-500 p-2.5 font-bold text-sm text-white outline-none rounded-xl transition-colors shadow-inner"
                        autoFocus
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider mb-1 font-bold text-slate-300">
                          Email Address (Gmail)
                        </label>
                        <input
                          type="email"
                          value={attendeeEmail}
                          onChange={e => setAttendeeEmail(e.target.value)}
                          placeholder="alex@gmail.com"
                          className="w-full bg-slate-950 border border-slate-700/80 focus:border-indigo-500 p-2 font-mono text-xs text-white outline-none rounded-xl transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase tracking-wider mb-1 font-bold text-slate-300">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          value={attendeePhone}
                          onChange={e => setAttendeePhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          className="w-full bg-slate-950 border border-slate-700/80 focus:border-indigo-500 p-2 font-mono text-xs text-white outline-none rounded-xl transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase tracking-wider mb-1 font-bold text-slate-300">
                        Access Notes / Designation / Student ID (Optional)
                      </label>
                      <input
                        type="text"
                        value={attendeeNotes}
                        onChange={e => setAttendeeNotes(e.target.value)}
                        placeholder="e.g. Keynote Speaker • Roll #2026 • VIP Front Row"
                        className="w-full bg-slate-950 border border-slate-700/80 focus:border-indigo-500 p-2 text-xs text-white outline-none rounded-xl transition-colors"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 mt-1 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white font-bold uppercase text-xs tracking-wider transition-all flex items-center justify-center gap-2 rounded-xl shadow-lg shadow-indigo-600/30 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Bind {attendeeName.trim() || 'Attendee'} to [{selectedPass.category || 'General'}] Pass
                    </button>
                  </>
                )}
              </form>

            </div>
          ) : (
            <div className="border-2 border-dashed border-slate-800 p-8 text-center space-y-3 rounded-2xl bg-slate-950/40">
              <div className="w-10 h-10 bg-slate-900 text-indigo-400 flex items-center justify-center mx-auto rounded-xl border border-slate-800">
                <ScanLine className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-xs text-white">No Pass Selected</h4>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                Type the last 4 digits (e.g. 8286), filter by pass type, or scan the QR code to select a pass.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
