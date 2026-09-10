import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  CheckCircle2, 
  ShieldCheck, 
  LogOut, 
  RefreshCw, 
  X, 
  Sparkles, 
  Database,
  Lock,
  Eye,
  EyeOff,
  Laptop,
  Smartphone,
  MapPin,
  Users,
  Copy,
  Check,
  Radio,
  Share2,
  Globe,
  Key,
  UserCheck,
  ShieldAlert,
  Trash2,
  Plus,
  Power,
  Filter,
  AlertCircle,
  QrCode,
  ScanLine,
  DollarSign,
  Send
} from 'lucide-react';
import { DeviceSession, EventItem, QuickAccessCode, CurrentUserSession, UserRole } from '../types';
import { 
  getDeviceId, 
  getDeviceLabel, 
  setDeviceLabel, 
  getDeviceLocation, 
  setDeviceLocation,
  createQuickAccessCode,
  subscribeToQuickAccessCodes,
  toggleQuickAccessCode,
  deleteQuickAccessCode,
  revokeDeviceSession,
  generateRandomAccessCode
} from '../lib/firebase';

interface GmailLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserEmail: string | null;
  currentSession: CurrentUserSession | null;
  events: EventItem[];
  onLogin: (email: string, password?: string, deviceLabel?: string, deviceLocation?: string) => Promise<{ success: boolean; error?: string }>;
  onLoginWithCode: (code: string, email?: string, deviceLocation?: string, deviceLabel?: string) => Promise<{ success: boolean; error?: string }>;
  onLogout: () => void;
  isSyncing: boolean;
  lastSaved: string | null;
  activeDevices?: DeviceSession[];
}

export const GmailLoginModal: React.FC<GmailLoginModalProps> = ({
  isOpen,
  onClose,
  currentUserEmail,
  currentSession,
  events = [],
  onLogin,
  onLoginWithCode,
  onLogout,
  isSyncing,
  lastSaved,
  activeDevices = [],
}) => {
  // Login Form States
  const [loginMode, setLoginMode] = useState<'quick_code' | 'owner_master'>('quick_code');
  const [inputEmail, setInputEmail] = useState(currentUserEmail || '');
  const [inputPassword, setInputPassword] = useState('');
  const [quickCodeOwnerEmail, setQuickCodeOwnerEmail] = useState(currentUserEmail || '');
  const [inputQuickCode, setInputQuickCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [deviceLocation, setDeviceLocationState] = useState(() => getDeviceLocation());
  const [deviceLabel, setDeviceLabelState] = useState(() => getDeviceLabel());
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Share Dialog state for proper formatted invite sending
  const [sharingCodeItem, setSharingCodeItem] = useState<QuickAccessCode | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  // Owner View Tabs: 'devices' | 'create_code' | 'codes_list'
  const [ownerTab, setOwnerTab] = useState<'devices' | 'create_code' | 'codes_list'>('devices');

  // Quick Code Generator Form States
  const [codeRole, setCodeRole] = useState<UserRole>('client_viewer');
  const [codeEventId, setCodeEventId] = useState<string>('all');
  const [codeLocation, setCodeLocation] = useState('Bangalore Client Office');
  const [codeLabel, setCodeLabel] = useState('Bangalore Client Viewer');
  const [customCodeInput, setCustomCodeInput] = useState('');
  const [codeNotes, setCodeNotes] = useState('');
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [createdCodeResult, setCreatedCodeResult] = useState<QuickAccessCode | null>(null);

  // Firestore Quick Codes list
  const [accessCodes, setAccessCodes] = useState<QuickAccessCode[]>([]);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [copiedShareInfo, setCopiedShareInfo] = useState(false);
  const [revokingDeviceId, setRevokingDeviceId] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [isRevokingAll, setIsRevokingAll] = useState(false);
  const [confirmDeleteCodeId, setConfirmDeleteCodeId] = useState<string | null>(null);
  const [isDeletingCodeId, setIsDeletingCodeId] = useState<string | null>(null);

  const currentDeviceId = getDeviceId();
  const isOwner = !currentSession || currentSession.isOwner || currentSession.role === 'owner';

  useEffect(() => {
    if (currentUserEmail) {
      setInputEmail(currentUserEmail);
      setQuickCodeOwnerEmail(currentUserEmail);
    }
  }, [currentUserEmail]);

  // Subscribe to Quick Access Codes
  useEffect(() => {
    const effectiveEmail = currentUserEmail || quickCodeOwnerEmail || inputEmail || 'atharvdhanawade15@gmail.com';
    if (!isOpen) return;
    const unsub = subscribeToQuickAccessCodes(effectiveEmail, (codes) => {
      setAccessCodes(codes);
    });
    return () => {
      if (unsub) unsub();
    };
  }, [currentUserEmail, quickCodeOwnerEmail, inputEmail, isOpen]);

  if (!isOpen) return null;

  // Master Login Submit
  const handleMasterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputEmail || !inputEmail.includes('@')) {
      setError('Please enter a valid Gmail address.');
      return;
    }
    if (!inputPassword || inputPassword.length < 4) {
      setError('Please provide a password of at least 4 characters for master login.');
      return;
    }
    setError(null);
    setSuccessMsg(null);

    setDeviceLocation(deviceLocation);
    setDeviceLabel(deviceLabel);

    const result = await onLogin(
      inputEmail.trim().toLowerCase(), 
      inputPassword, 
      deviceLabel, 
      deviceLocation
    );

    if (result && !result.success && result.error) {
      setError(result.error);
    }
  };

  // Generate formatted invitation text for WhatsApp, Email, or Clipboard
  const formatInvitationMessage = (codeObj?: QuickAccessCode | null) => {
    const currentUrl = window.location.origin;
    const code = codeObj?.code || inputQuickCode || 'ACCESS-CODE';
    const roleTitle = codeObj 
      ? (codeObj.role === 'client_viewer' ? 'Client Live Viewer (Read-Only)' : 'Gate Security Operator') 
      : 'Live Viewer';
    const eventScope = codeObj?.allowedEventTitle || 'All Events';
    const owner = currentUserEmail || inputEmail || 'Workspace Owner';
    const location = codeObj?.targetLocation || 'Assigned Station';

    return `🎟️ PASSCRAFT PRO — EVENT WORKSPACE INVITATION
══════════════════════════════════════════════════
🔑 Access Credentials:
• Workspace Owner Gmail: ${owner}
• 1-Time Quick Access Code: ${code}
• Assigned Role: ${roleTitle}
• Assigned Location / Station: ${location}
• Event Scope: ${eventScope}

📲 How to Join the Workspace:
1. Open App: ${currentUrl}
2. Click "LOGIN / QUICK CODE"
3. Select "1-Time Quick Code"
4. Enter Workspace Owner Gmail: ${owner}
5. Enter Quick Access Code: ${code}
══════════════════════════════════════════════════
✨ Real-time synchronized turnstiles, passes, and attendance tracking.`;
  };

  // Quick Code Login Submit (Direct cross-device verification)
  const handleQuickCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = inputQuickCode.trim().toUpperCase();
    if (!cleanCode) {
      setError('Please enter your 1-Time Quick Access Code.');
      return;
    }
    setError(null);
    setSuccessMsg(null);

    // When logging in with code, station location and nickname are determined by the code
    const result = await onLoginWithCode(
      cleanCode,
      quickCodeOwnerEmail.trim().toLowerCase() || undefined
    );

    if (result && !result.success && result.error) {
      setError(result.error);
    }
  };

  // Delete Access Code Handler with optimistic update
  const handleDeleteCode = async (codeItem: QuickAccessCode) => {
    const effectiveEmail = currentUserEmail || quickCodeOwnerEmail || inputEmail || 'atharvdhanawade15@gmail.com';
    setIsDeletingCodeId(codeItem.id);
    setError(null);
    // Optimistic UI update: remove immediately from UI
    setAccessCodes(prev => prev.filter(c => c.id !== codeItem.id && c.code !== codeItem.code));
    try {
      await deleteQuickAccessCode(effectiveEmail, codeItem.id, codeItem.code);
      setSuccessMsg(`Access Code "${codeItem.code}" was successfully deleted.`);
      setConfirmDeleteCodeId(null);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      console.error('Failed to delete access code:', err);
      setError('Could not delete access code. Please try again.');
    } finally {
      setIsDeletingCodeId(null);
    }
  };

  // Toggle Access Code active status with optimistic update
  const handleToggleCode = async (codeItem: QuickAccessCode) => {
    const effectiveEmail = currentUserEmail || quickCodeOwnerEmail || inputEmail || 'atharvdhanawade15@gmail.com';
    const nextStatus = !codeItem.isActive;
    // Optimistic UI update
    setAccessCodes(prev => prev.map(c => (c.id === codeItem.id || c.code === codeItem.code) ? { ...c, isActive: nextStatus } : c));
    try {
      await toggleQuickAccessCode(effectiveEmail, codeItem.id, nextStatus, codeItem.code);
      setSuccessMsg(`Access Code "${codeItem.code}" is now ${nextStatus ? 'active' : 'disabled'}.`);
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err: any) {
      console.error('Failed to toggle access code:', err);
    }
  };

  // Create Quick Access Code Handler (Supports direct 1-click preset generation)
  const handleCreateCode = async (e?: React.FormEvent, directRole?: UserRole, directLocation?: string, directLabel?: string) => {
    if (e) e.preventDefault();
    const effectiveEmail = (currentUserEmail || quickCodeOwnerEmail || inputEmail || 'atharvdhanawade15@gmail.com').trim().toLowerCase();
    setIsGeneratingCode(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const chosenRole: UserRole = directRole || codeRole;
      const targetEvent = events.find(ev => ev.id === codeEventId);
      const allowedTitle = codeEventId === 'all' ? 'All Events' : (targetEvent?.title || 'Selected Event');
      const finalLoc = directLocation || codeLocation || (chosenRole === 'client_viewer' ? 'Bangalore Client Office' : 'Gate 1 Turnstile');
      const finalLbl = directLabel || codeLabel || (chosenRole === 'client_viewer' ? 'Client Live Viewer' : 'Gate Scanner');

      const newCode = await createQuickAccessCode(effectiveEmail, {
        role: chosenRole,
        targetLocation: finalLoc,
        targetLabel: finalLbl,
        allowedEventId: codeEventId,
        allowedEventTitle: allowedTitle,
        customCode: customCodeInput.trim() || undefined,
        notes: codeNotes.trim() || undefined,
      });

      setCreatedCodeResult(newCode);
      setAccessCodes(prev => [newCode, ...prev.filter(c => c.id !== newCode.id)]);
      setSuccessMsg(`Access Code ${newCode.code} generated successfully for ${chosenRole === 'client_viewer' ? 'Client Live Viewer' : 'Gate Security'}!`);
      setCustomCodeInput('');
      setCodeNotes('');
    } catch (err: any) {
      setError(err?.message || 'Failed to create access code.');
    } finally {
      setIsGeneratingCode(false);
    }
  };

  // Revoke / Kick Connected Device Session (Non-blocking inline confirmation)
  const handleExecuteRevokeDevice = async (deviceId: string, deviceName: string) => {
    if (!currentUserEmail) return;

    setRevokingDeviceId(deviceId);
    setError(null);
    try {
      const success = await revokeDeviceSession(currentUserEmail, deviceId);
      if (success) {
        setSuccessMsg(`Disconnected and removed "${deviceName}" from workspace.`);
      } else {
        setError(`Could not disconnect device "${deviceName}". Please try again.`);
      }
      setConfirmRevokeId(null);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error('Failed to revoke device:', err);
      setError(err?.message || 'Failed to remove device session.');
    } finally {
      setRevokingDeviceId(null);
    }
  };

  // Bulk Revoke all remote devices except this device
  const handleRevokeAllOtherDevices = async () => {
    if (!currentUserEmail) return;
    const remoteDevices = activeDevices.filter(d => !d.isCurrentDevice && d.id !== currentDeviceId);
    if (remoteDevices.length === 0) return;

    setIsRevokingAll(true);
    setError(null);
    try {
      await Promise.all(remoteDevices.map(d => revokeDeviceSession(currentUserEmail, d.id)));
      setSuccessMsg(`Disconnected ${remoteDevices.length} remote device sessions.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error('Failed to revoke all other devices:', err);
      setError('Could not disconnect all remote devices.');
    } finally {
      setIsRevokingAll(false);
    }
  };

  // Copy Code
  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2500);
  };

  // Copy Full Share Card for Client/Security
  const handleCopyShareCredentials = (codeObj?: QuickAccessCode) => {
    const text = formatInvitationMessage(codeObj);
    navigator.clipboard.writeText(text);
    setCopiedShareInfo(true);
    setTimeout(() => setCopiedShareInfo(false), 3000);
  };

  const handleShareWhatsApp = (codeObj?: QuickAccessCode | null) => {
    const text = formatInvitationMessage(codeObj);
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleShareEmail = (codeObj?: QuickAccessCode | null) => {
    const text = formatInvitationMessage(codeObj);
    const subject = `PassCraft Access Invitation for ${codeObj?.allowedEventTitle || 'Event'}`;
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl text-white shadow-2xl relative flex flex-col max-h-[94vh] overflow-hidden">
        
        {/* Modal Top Bar */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="space-y-1 pr-6">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
                <Globe className="w-4 h-4" />
              </span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
                MULTI-DEVICE REAL-TIME CLOUD &amp; ROLE ACCESS
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
              PASSCRAFT <span className="text-emerald-400">WORKSPACE ACCESS</span>
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-full transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body Scroll Area */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          
          {error && (
            <div className="p-3.5 bg-rose-950/90 border border-rose-500/50 rounded-2xl text-rose-200 text-xs font-bold flex items-center gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-950/90 border border-emerald-500/50 rounded-2xl text-emerald-200 text-xs font-bold flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {currentUserEmail ? (
            /* =========================================================================
               AUTHENTICATED WORKSPACE VIEW
               ========================================================================= */
            <div className="space-y-5">
              
              {/* Account Identity Card */}
              <div className="bg-slate-950/80 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white font-black flex items-center justify-center text-lg uppercase shadow-lg shadow-emerald-600/30 shrink-0">
                      {currentUserEmail.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-black text-white flex items-center gap-1.5 flex-wrap">
                        <span>{currentUserEmail}</span>
                        {isOwner ? (
                          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full text-[9px] font-black uppercase font-mono">
                            WORKSPACE OWNER
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-[9px] font-black uppercase font-mono">
                            {currentSession?.role === 'client_viewer' ? 'CLIENT VIEWER' : 'GATE OPERATOR'}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <MapPin className="w-3 h-3 text-emerald-400" />
                        <span>My Location: <strong className="text-white">{deviceLocation}</strong> ({deviceLabel})</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => onLogin(currentUserEmail, inputPassword, deviceLabel, deviceLocation)}
                      disabled={isSyncing}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
                      title="Force sync live Firestore data"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
                      <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={onLogout}
                      className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>

                {/* Session Restrictions Note if Client or Gate */}
                {!isOwner && (
                  <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-xl text-[11px] text-amber-200 leading-relaxed">
                    {currentSession?.role === 'client_viewer' && (
                      <span>👁️ <strong>Client Read-Only Access:</strong> You can inspect live event passes, gate entries, and turnstile logs. Ticket creation and deletions are protected.</span>
                    )}
                    {currentSession?.role === 'gate_operator' && (
                      <span>🛡️ <strong>Gate Security Access:</strong> You have full access to Gate Turnstiles, Scan &amp; Assign, and Pass Check-ins. Financial revenue data is hidden.</span>
                    )}
                    {currentSession?.allowedEventId && currentSession.allowedEventId !== 'all' && (
                      <div className="mt-1 font-mono text-[10px] text-amber-400">
                        Event Scope Locked: {events.find(e => e.id === currentSession.allowedEventId)?.title || currentSession.allowedEventId}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Owner Sub-Navigation Tabs */}
              {isOwner && (
                <div className="flex border-b border-slate-800 gap-1 pb-1">
                  <button
                    type="button"
                    onClick={() => setOwnerTab('devices')}
                    className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                      ownerTab === 'devices'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Connected Devices ({activeDevices.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOwnerTab('create_code')}
                    className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                      ownerTab === 'create_code'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>Create 1-Time Quick Code</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOwnerTab('codes_list')}
                    className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                      ownerTab === 'codes_list'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Issued Access Codes ({accessCodes.length})</span>
                  </button>
                </div>
              )}

              {/* =========================================================================
                 TAB 1: CONNECTED DEVICES LIST & OWNER REVOCATION
                 ========================================================================= */}
              {(ownerTab === 'devices' || !isOwner) && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                        <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                        Live Connected Devices
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        {isOwner 
                          ? 'Real-time overview of all connected sessions across Hyderabad, Bangalore, and gates. As the owner, you can remove/disconnect any device.' 
                          : 'Live connected sessions in this event workspace.'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 font-bold">
                        {activeDevices.length} Active
                      </span>
                      {isOwner && activeDevices.filter(d => !d.isCurrentDevice && d.id !== currentDeviceId).length > 0 && (
                        <button
                          id="btn-disconnect-all-remote-devices"
                          type="button"
                          onClick={handleRevokeAllOtherDevices}
                          disabled={isRevokingAll}
                          className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                        >
                          <Power className="w-3 h-3" />
                          <span>{isRevokingAll ? 'Disconnecting...' : 'Disconnect All Others'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {activeDevices.length > 0 ? (
                      activeDevices.map((dev) => (
                        <div 
                          id={`device-row-${dev.id}`}
                          key={dev.id}
                          className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            dev.isCurrentDevice 
                              ? 'bg-emerald-950/25 border-emerald-500/40 shadow-sm' 
                              : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl shrink-0 ${dev.isCurrentDevice ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                              {dev.deviceName?.toLowerCase().includes('phone') || dev.deviceName?.toLowerCase().includes('mobile') || dev.deviceName?.toLowerCase().includes('gate') ? (
                                <Smartphone className="w-4 h-4" />
                              ) : (
                                <Laptop className="w-4 h-4" />
                              )}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white flex items-center gap-2 flex-wrap">
                                <span>{dev.deviceName || 'Workspace Device'}</span>
                                {dev.isCurrentDevice && (
                                  <span className="px-1.5 py-0.5 bg-emerald-500 text-black text-[9px] font-black rounded uppercase font-mono">
                                    THIS DEVICE
                                  </span>
                                )}
                                {dev.role && (
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase font-mono ${
                                    dev.role === 'owner' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' :
                                    dev.role === 'client_viewer' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                  }`}>
                                    {dev.role === 'client_viewer' ? 'Client Viewer' : dev.role === 'gate_operator' ? 'Gate Security' : 'Owner'}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10.5px] text-slate-400 font-mono flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className="flex items-center gap-1 text-slate-300">
                                  <MapPin className="w-3 h-3 text-emerald-400" />
                                  <strong>{dev.location || 'Online'}</strong>
                                </span>
                                <span>•</span>
                                <span>Ping: {dev.lastPing ? new Date(dev.lastPing).toLocaleTimeString() : 'Active'}</span>
                                {dev.allowedEventId && dev.allowedEventId !== 'all' && (
                                  <>
                                    <span>•</span>
                                    <span className="text-amber-400 font-semibold">Event-Scoped</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            {dev.isCurrentDevice ? (
                              <span className="text-[10px] font-mono font-bold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                ACTIVE
                              </span>
                            ) : isOwner ? (
                              confirmRevokeId === dev.id ? (
                                <div className="flex items-center gap-1.5 animate-fadeIn">
                                  <button
                                    id={`btn-confirm-remove-${dev.id}`}
                                    type="button"
                                    onClick={() => handleExecuteRevokeDevice(dev.id, dev.deviceName || 'Device')}
                                    disabled={revokingDeviceId === dev.id}
                                    className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shadow-md shadow-rose-600/30 disabled:opacity-50"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>{revokingDeviceId === dev.id ? 'Removing...' : 'Confirm Remove'}</span>
                                  </button>
                                  <button
                                    id={`btn-cancel-remove-${dev.id}`}
                                    type="button"
                                    onClick={() => setConfirmRevokeId(null)}
                                    className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium cursor-pointer transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  id={`btn-remove-device-${dev.id}`}
                                  type="button"
                                  onClick={() => setConfirmRevokeId(dev.id)}
                                  className="px-3 py-1.5 bg-rose-500/15 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                                  title="Remove and disconnect this device from workspace"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Remove Device</span>
                                </button>
                              )
                            ) : (
                              <span className="text-[10px] font-mono text-emerald-400">Connected</span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 bg-slate-950/40 rounded-2xl border border-slate-800 text-center text-xs text-slate-400">
                        No additional devices connected.
                      </div>
                    )}
                  </div>

                  {/* Manual Location & Device Label Editor - Visible ONLY for Workspace Owner */}
                  {isOwner && (
                    <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl space-y-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 block">
                        Edit My Device Location &amp; Name:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-[9.5px] uppercase font-bold text-slate-400 block mb-1">
                            Manual Location (City / Desk / Venue)
                          </label>
                          <input
                            type="text"
                            value={deviceLocation}
                            onChange={(e) => {
                              setDeviceLocationState(e.target.value);
                              setDeviceLocation(e.target.value);
                            }}
                            placeholder="e.g. Hyderabad HQ, Bangalore Office..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-emerald-400"
                          />
                          {/* Quick Preset Location Chips */}
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {['Hyderabad HQ', 'Bangalore Client Office', 'Gate 1 Turnstile', 'VIP Gate'].map(loc => (
                              <button
                                key={loc}
                                type="button"
                                onClick={() => {
                                  setDeviceLocationState(loc);
                                  setDeviceLocation(loc);
                                }}
                                className="text-[9px] px-2 py-0.5 bg-slate-800 hover:bg-emerald-500 hover:text-black rounded-lg text-slate-300 transition-colors cursor-pointer"
                              >
                                {loc}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-[9.5px] uppercase font-bold text-slate-400 block mb-1">
                            Device Name / Workspace Role
                          </label>
                          <input
                            type="text"
                            value={deviceLabel}
                            onChange={(e) => {
                              setDeviceLabelState(e.target.value);
                              setDeviceLabel(e.target.value);
                            }}
                            placeholder="e.g. Organizer Primary Laptop..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-emerald-400"
                          />
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {['Organizer Workspace', 'Client Live Viewer', 'Mobile Gate Scanner'].map(lbl => (
                              <button
                                key={lbl}
                                type="button"
                                onClick={() => {
                                  setDeviceLabelState(lbl);
                                  setDeviceLabel(lbl);
                                }}
                                className="text-[9px] px-2 py-0.5 bg-slate-800 hover:bg-emerald-500 hover:text-black rounded-lg text-slate-300 transition-colors cursor-pointer"
                              >
                                {lbl}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* =========================================================================
                 TAB 2: CREATE QUICK ACCESS CODE (CLIENT VIEW / GATE SECURITY)
                 ========================================================================= */}
              {isOwner && ownerTab === 'create_code' && (
                <form onSubmit={handleCreateCode} className="space-y-4 bg-slate-950/70 border border-slate-800 p-5 rounded-2xl">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      Generate Role-Based 1-Time Quick Access Code
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Issue a quick login code for your client (Bangalore) or gate security operator with restricted permissions.
                    </p>
                  </div>

                  {/* Role Selector */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-300">
                      1. Select Access Role:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setCodeRole('client_viewer');
                          setCodeLabel('Client Live Viewer');
                          setCodeLocation('Bangalore Client Office');
                        }}
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                          codeRole === 'client_viewer'
                            ? 'bg-amber-950/40 border-amber-500 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-xs font-black text-amber-300">
                          <UserCheck className="w-4 h-4" />
                          <span>Client Live Viewer (Read-Only)</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                          Can see live passes, turnstiles, and stats. <strong>Cannot</strong> generate tickets, edit, or delete events.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setCodeRole('gate_operator');
                          setCodeLabel('Gate Security Turnstile');
                          setCodeLocation('Turnstile Gate 1');
                        }}
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                          codeRole === 'gate_operator'
                            ? 'bg-cyan-950/40 border-cyan-500 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-xs font-black text-cyan-300">
                          <ScanLine className="w-4 h-4" />
                          <span>Gate Security Operator</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                          Only Gate Scanner, Scan &amp; Assign, and Passes. <strong>Money / Financials are hidden</strong>.
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Event Scope Restriction */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-300">
                      2. Event Scope Permission:
                    </label>
                    <select
                      value={codeEventId}
                      onChange={(e) => setCodeEventId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-white focus:outline-none focus:border-emerald-400 cursor-pointer"
                    >
                      <option value="all">🌐 All Events in Workspace</option>
                      {events.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          🎯 Specific Event: {ev.title} ({ev.date || 'Active'})
                        </option>
                      ))}
                    </select>
                    <span className="text-[9.5px] text-slate-400 block">
                      {codeEventId === 'all' 
                        ? 'The user can browse all events in your workspace.' 
                        : 'The user will ONLY be able to see this specific event. All other events are isolated & hidden.'}
                    </span>
                  </div>

                  {/* Target Location & Label */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9.5px] font-bold uppercase text-slate-400 mb-1">
                        Assigned Location
                      </label>
                      <input
                        type="text"
                        value={codeLocation}
                        onChange={(e) => setCodeLocation(e.target.value)}
                        placeholder="e.g. Bangalore Client Office"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-emerald-400"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[9.5px] font-bold uppercase text-slate-400 mb-1">
                        Device Name / Label
                      </label>
                      <input
                        type="text"
                        value={codeLabel}
                        onChange={(e) => setCodeLabel(e.target.value)}
                        placeholder="e.g. Bangalore Live Viewer"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-emerald-400"
                        required
                      />
                    </div>
                  </div>

                  {/* Optional Custom Passcode or Auto */}
                  <div>
                    <label className="block text-[9.5px] font-bold uppercase text-slate-400 mb-1">
                      Custom Passcode (Optional - Leave blank for auto code):
                    </label>
                    <input
                      type="text"
                      value={customCodeInput}
                      onChange={(e) => setCustomCodeInput(e.target.value.toUpperCase())}
                      placeholder={`e.g. ${codeRole === 'client_viewer' ? 'CLNT-BANGALORE' : 'GATE-SEC-2026'}`}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-400 uppercase"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isGeneratingCode}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
                  >
                    <Key className="w-4 h-4" />
                    {isGeneratingCode ? 'GENERATING ACCESS CODE...' : 'CREATE & ACTIVATE QUICK CODE'}
                  </button>

                  {/* Recently Created Code Card Preview */}
                  {createdCodeResult && (
                    <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl space-y-3 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                          Active Quick Access Code Created:
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSharingCodeItem(createdCodeResult)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            <span>Share Invite</span>
                          </button>
                        </div>
                      </div>

                      <div className="bg-slate-950 border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <div className="text-xl font-mono font-black text-emerald-400 tracking-wider">
                            {createdCodeResult.code}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Role: <strong>{createdCodeResult.role}</strong> • Scope: <strong>{createdCodeResult.allowedEventTitle}</strong>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopyCode(createdCodeResult.code, createdCodeResult.id)}
                            className="p-2 bg-slate-800 hover:bg-slate-750 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer border border-slate-700"
                          >
                            {copiedCodeId === createdCodeResult.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                            <span>{copiedCodeId === createdCodeResult.id ? 'Copied' : 'Copy'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleShareWhatsApp(createdCodeResult)}
                            className="p-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                            title="Share on WhatsApp"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </form>
              )}

              {/* =========================================================================
                 TAB 3: ISSUED ACCESS CODES DIRECTORY
                 ========================================================================= */}
              {isOwner && ownerTab === 'codes_list' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-200">
                        Issued Quick Access Codes
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Manage active login passcodes for external clients and gate operators.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOwnerTab('create_code')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Code</span>
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {accessCodes.length > 0 ? (
                      accessCodes.map((codeItem) => (
                        <div
                          key={codeItem.id}
                          className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            codeItem.isActive 
                              ? 'bg-slate-950/80 border-slate-800' 
                              : 'bg-slate-950/40 border-slate-900 opacity-60'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-mono font-black text-emerald-400 tracking-wider">
                                {codeItem.code}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase font-mono ${
                                codeItem.role === 'client_viewer' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                                codeItem.role === 'gate_operator' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-emerald-500/20 text-emerald-300'
                              }`}>
                                {codeItem.role === 'client_viewer' ? 'Client Read-Only' : codeItem.role === 'gate_operator' ? 'Gate Security' : 'Co-Organizer'}
                              </span>
                              {codeItem.isActive ? (
                                <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-[9px] font-bold">
                                  ACTIVE
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 bg-rose-500/20 text-rose-400 rounded text-[9px] font-bold">
                                  DISABLED
                                </span>
                              )}
                            </div>
                            <div className="text-[10.5px] text-slate-400 font-mono flex items-center gap-2 flex-wrap">
                              <span>Scope: <strong className="text-slate-200">{codeItem.allowedEventTitle || 'All Events'}</strong></span>
                              <span>•</span>
                              <span>Target: {codeItem.targetLocation}</span>
                              <span>•</span>
                              <span>Uses: {codeItem.useCount || 0}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 self-end sm:self-auto">
                            <button
                              type="button"
                              onClick={() => setSharingCodeItem(codeItem)}
                              className="px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                              title="Open shareable formatted invitation"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Share</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyCode(codeItem.code, codeItem.id)}
                              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                              title="Copy code"
                            >
                              {copiedCodeId === codeItem.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleCode(codeItem)}
                              className={`p-2 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-colors ${
                                codeItem.isActive ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/30' : 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/30'
                              }`}
                              title={codeItem.isActive ? 'Disable Code' : 'Enable Code'}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                            {confirmDeleteCodeId === codeItem.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCode(codeItem)}
                                  disabled={isDeletingCodeId === codeItem.id}
                                  className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer shadow-md shadow-rose-600/30 disabled:opacity-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>{isDeletingCodeId === codeItem.id ? 'Deleting...' : 'Delete'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteCodeId(null)}
                                  className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteCodeId(codeItem.id)}
                                className="p-2 bg-rose-500/15 hover:bg-rose-600 text-rose-300 hover:text-white rounded-xl text-xs cursor-pointer transition-colors"
                                title="Delete Code"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-5 bg-slate-950/40 rounded-2xl border border-slate-800 text-center text-xs text-slate-400 space-y-2">
                        <p>No Quick Access Codes generated yet.</p>
                        <button
                          type="button"
                          onClick={() => setOwnerTab('create_code')}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Create First Access Code</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          ) : (
            /* =========================================================================
               AUTHENTICATION / LOGIN SCREEN (QUICK CODE OR MASTER GMAIL)
               ========================================================================= */
            <div className="space-y-5">
              
              {/* Login Mode Switcher */}
              <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode('quick_code');
                    setError(null);
                  }}
                  className={`py-2.5 px-3 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    loginMode === 'quick_code'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>1-Time Quick Code</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode('owner_master');
                    setError(null);
                  }}
                  className={`py-2.5 px-3 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    loginMode === 'owner_master'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Workspace Owner</span>
                </button>
              </div>

              {/* MODE 1: Quick Code Login Form */}
              {loginMode === 'quick_code' && (
                <form onSubmit={handleQuickCodeSubmit} className="space-y-4">
                  <div className="bg-slate-950/80 border border-emerald-500/30 p-4 rounded-2xl space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                      FAST 1-STEP CLIENT &amp; GATE SECURITY LOGIN
                    </span>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Enter your 1-Time Quick Access Code (e.g. <span className="text-emerald-400 font-mono font-bold">CLNT-BLR-8492</span> or <span className="text-cyan-400 font-mono font-bold">GATE-SEC-4190</span>) provided by your Workspace Owner to join the event live.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-300 mb-1.5">
                      1. ENTER 1-TIME QUICK ACCESS CODE *
                    </label>
                    <input
                      type="text"
                      value={inputQuickCode}
                      onChange={e => setInputQuickCode(e.target.value.toUpperCase())}
                      placeholder="e.g. CLNT-BLR-8492 or GATE-SEC-4190"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 font-mono text-base font-black text-emerald-400 uppercase tracking-wider focus:border-emerald-400 outline-none shadow-inner"
                      required
                      autoFocus
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-300">
                        2. WORKSPACE OWNER GMAIL (OPTIONAL)
                      </label>
                      <span className="text-[9px] text-slate-400 font-mono">Auto-discovered if left blank</span>
                    </div>
                    <input
                      type="email"
                      value={quickCodeOwnerEmail}
                      onChange={e => setQuickCodeOwnerEmail(e.target.value)}
                      placeholder="e.g. owner@gmail.com (Optional)"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 font-mono text-xs text-white focus:border-emerald-400 outline-none"
                    />
                    <span className="text-[9.5px] text-slate-400 mt-1 block">
                      If known, enter the owner's Gmail. If blank, our system will automatically match your code cross-device.
                    </span>
                  </div>

                  {/* Station, Device Name and Access Type are locked & pre-configured by the access code */}
                  <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Preset Security &amp; Access Controls</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Your station location, device role, and event scope are locked and automatically configured from your 1-Time Quick Access Code.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isSyncing}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
                  >
                    <Key className="w-4 h-4" />
                    {isSyncing ? 'VERIFYING CODE & CONNECTING...' : 'LOGIN WITH QUICK ACCESS CODE'}
                  </button>

                  <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-center">
                    <p className="text-[11px] text-slate-400">
                      🛡️ <strong>Owner Security Notice:</strong> 1-Time Quick Access Codes can only be generated by a signed-in Workspace Owner from inside their active account.
                    </p>
                  </div>
                </form>
              )}

              {/* MODE 3: Master Owner Login Form */}
              {loginMode === 'owner_master' && (
                <form onSubmit={handleMasterSubmit} className="space-y-4">
                  <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 block">
                      ORGANIZER / MASTER WORKSPACE ACCOUNT
                    </span>
                    <p className="text-xs text-slate-400">
                      Sign in with your Gmail to manage tickets, revenue, generate passes, and issue access codes for your clients and staff.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-300 mb-1.5">
                      1. YOUR GMAIL ADDRESS *
                    </label>
                    <input
                      type="email"
                      value={inputEmail}
                      onChange={e => setInputEmail(e.target.value)}
                      placeholder="e.g. yourname@gmail.com"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 font-mono text-xs text-white focus:border-emerald-400 outline-none"
                      required
                      autoFocus
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-300">
                        2. MASTER PASSWORD *
                      </label>
                      <span className="text-[9px] text-emerald-400 font-mono">Min 4 characters</span>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={inputPassword}
                        onChange={e => setInputPassword(e.target.value)}
                        placeholder="Enter your master password"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 font-mono text-xs text-white focus:border-emerald-400 outline-none pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Manual Location & Device Label */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[9.5px] font-bold uppercase text-slate-400 mb-1">
                        Your Location (Manual)
                      </label>
                      <input
                        type="text"
                        value={deviceLocation}
                        onChange={e => setDeviceLocationState(e.target.value)}
                        placeholder="e.g. Hyderabad Organizer HQ"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:border-emerald-400 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9.5px] font-bold uppercase text-slate-400 mb-1">
                        Device Name / Label
                      </label>
                      <input
                        type="text"
                        value={deviceLabel}
                        onChange={e => setDeviceLabelState(e.target.value)}
                        placeholder="e.g. Organizer Primary Workspace"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:border-emerald-400 outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSyncing}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
                  >
                    <Database className="w-4 h-4" />
                    {isSyncing ? 'SIGNING IN & SYNCING...' : 'LOGIN AS WORKSPACE OWNER'}
                  </button>
                </form>
              )}

            </div>
          )}

        </div>

        {/* Dedicated Share Passcode Invitation Modal */}
        {sharingCodeItem && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-slate-900 border-2 border-emerald-500 rounded-3xl w-full max-w-lg p-5 text-white shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase text-white">Share Workspace Invitation</h3>
                    <p className="text-[10px] text-slate-400 font-mono">Role: {sharingCodeItem.role} • Scope: {sharingCodeItem.allowedEventTitle}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSharingCodeItem(null)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  ✕ Close
                </button>
              </div>

              {/* Formatted Message Preview Card */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Formatted Invitation Message:
                </label>
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 font-mono text-[11px] text-emerald-300 leading-relaxed whitespace-pre-wrap max-h-52 overflow-y-auto select-all">
                  {formatInvitationMessage(sharingCodeItem)}
                </div>
              </div>

              {/* Quick Actions Grid */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(formatInvitationMessage(sharingCodeItem));
                    setCopiedSection('full');
                    setTimeout(() => setCopiedSection(null), 2500);
                  }}
                  className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                >
                  {copiedSection === 'full' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedSection === 'full' ? 'Invitation Copied!' : 'Copy Full Message'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleShareWhatsApp(sharingCodeItem)}
                  className="py-2.5 px-3 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Send className="w-4 h-4" />
                  <span>Send via WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleShareEmail(sharingCodeItem)}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
                >
                  <Mail className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Send via Email</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(sharingCodeItem.code);
                    setCopiedSection('code');
                    setTimeout(() => setCopiedSection(null), 2500);
                  }}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
                >
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  <span>{copiedSection === 'code' ? 'Code Copied!' : 'Copy Code Only'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
