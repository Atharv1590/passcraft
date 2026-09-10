import React, { useEffect, useState } from 'react';
import { PassItem } from '../types';
import { generateQRCodeDataUrl, generateQRDataURL, sanitizeHexColor } from '../lib/passUtils';
import { 
  Download, 
  CheckCircle, 
  Copy, 
  UserCheck, 
  Calendar, 
  Clock, 
  MapPin, 
  ShieldCheck,
  QrCode as QrIcon,
  Phone,
  Mail,
  FileText,
  DollarSign
} from 'lucide-react';

interface PassBadgeCardProps {
  pass: PassItem;
  onAssignClick?: (pass: PassItem) => void;
  onToggleCheckIn?: (pass: PassItem) => void;
  compact?: boolean;
}

export const PassBadgeCard: React.FC<PassBadgeCardProps> = ({
  pass,
  onAssignClick,
  onToggleCheckIn,
  compact = false,
}) => {
  const initialQr = generateQRDataURL(pass.code16 || pass.formattedCode);
  const [qrUrl, setQrUrl] = useState<string>(initialQr);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fallback = generateQRDataURL(pass.code16 || pass.formattedCode);
    generateQRCodeDataUrl(pass.formattedCode, pass.themeColor || '#1e1b4b')
      .then(url => {
        if (mounted) setQrUrl(url || fallback);
      })
      .catch(() => {
        if (mounted) setQrUrl(fallback);
      });
    return () => { mounted = false; };
  }, [pass.formattedCode, pass.code16, pass.themeColor]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(pass.formattedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadImage = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 1100;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Outer Background
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, 800, 1100);

    // Accent Header Banner
    const themeColor = sanitizeHexColor(pass.themeColor, '#10b981');
    ctx.fillStyle = themeColor;
    ctx.fillRect(0, 0, 800, 160);

    // Header Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText((pass.eventName || 'PASSCRAFT EVENT').toUpperCase(), 400, 70);

    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#f1f5f9';
    ctx.fillText(`${(pass.category || 'VIP ACCESS').toUpperCase()} • TICKET PRICE: ₹${pass.ticketPrice || 0}`, 400, 115);

    // White Card Body
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(40, 180, 720, 870, 24);
    ctx.fill();

    // Prominent Status Pill Banner
    const isCheckedIn = pass.status === 'checked_in';
    const isAssigned = pass.status === 'assigned' || isCheckedIn;
    const statusBg = isCheckedIn ? '#059669' : isAssigned ? '#1d4ed8' : '#d97706';
    const statusLabel = isCheckedIn ? '✓ STATUS: CHECKED IN' : isAssigned ? '✓ STATUS: ASSIGNED' : 'PENDING ASSIGNMENT';

    ctx.fillStyle = statusBg;
    ctx.beginPath();
    ctx.roundRect(80, 210, 640, 56, 16);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(statusLabel, 400, 246);

    // Attendee Section Box
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.roundRect(80, 290, 640, 180, 16);
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('PASS HOLDER / ATTENDEE DETAILS', 110, 325);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(pass.assignedTo?.name || 'UNASSIGNED GUEST PASS', 110, 368);

    ctx.fillStyle = '#334155';
    ctx.font = '18px sans-serif';
    let detailY = 405;
    if (pass.assignedTo?.email) {
      ctx.fillText(`📧 Email: ${pass.assignedTo.email}`, 110, detailY);
      detailY += 28;
    }
    if (pass.assignedTo?.phone) {
      ctx.fillText(`📞 Phone: ${pass.assignedTo.phone}`, 110, detailY);
      detailY += 28;
    }
    if (pass.assignedTo?.notes) {
      ctx.fillText(`📝 Notes: ${pass.assignedTo.notes}`, 110, detailY);
    }

    // Event Details Box
    ctx.fillStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.roundRect(80, 490, 640, 140, 16);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`📅 Date: ${pass.eventDate}`, 110, 530);
    ctx.fillText(`⏰ Commencement: ${pass.commencementTime || pass.eventTime} ${pass.endTime ? `— End: ${pass.endTime}` : ''}`, 110, 565);
    ctx.fillText(`📍 Venue: ${pass.eventLocation}`, 110, 600);

    // Draw QR Code and Verification Text
    const finishCanvasAndDownload = (qrImageElement?: HTMLImageElement) => {
      // Draw QR Code
      if (qrImageElement) {
        ctx.drawImage(qrImageElement, 275, 650, 250, 250);
      } else {
        ctx.fillStyle = '#18181b';
        ctx.fillRect(275, 650, 250, 250);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('QR CODE', 400, 785);
      }

      // 16-Digit Code Box
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(80, 920, 640, 70, 16);
      ctx.fill();

      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 32px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(pass.formattedCode, 400, 965);

      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('16-DIGIT UNIQUE VERIFICATION CODE', 400, 1015);

      // Trigger Download
      const link = document.createElement('a');
      const attendeeClean = (pass.assignedTo?.name || 'Unassigned').replace(/[^a-zA-Z0-9]/g, '_');
      link.download = `Pass_${pass.formattedCode}_${attendeeClean}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };

    if (qrUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => finishCanvasAndDownload(img);
      img.onerror = () => finishCanvasAndDownload();
      img.src = qrUrl;
    } else {
      finishCanvasAndDownload();
    }
  };

  const isAssigned = pass.status === 'assigned' || pass.status === 'checked_in';

  if (compact) {
    return (
      <div 
        className="bg-slate-900 rounded-2xl border border-slate-800 p-4 shadow-lg hover:border-slate-700 transition-all flex flex-col md:flex-row items-center justify-between gap-4"
        style={{ borderLeft: `5px solid ${pass.themeColor || '#6366f1'}` }}
      >
        <div className="flex items-center gap-4 w-full md:w-auto">
          {qrUrl ? (
            <img src={qrUrl} alt="QR" className="w-16 h-16 rounded-xl border border-slate-700 bg-white p-1 shrink-0" />
          ) : (
            <div className="w-16 h-16 bg-slate-800 rounded-xl flex items-center justify-center shrink-0">
              <QrIcon className="w-6 h-6 text-slate-500" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center flex-wrap gap-2">
              <span className="font-mono font-bold text-indigo-400 text-sm">{pass.formattedCode}</span>
              <span 
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                  pass.status === 'checked_in'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : pass.status === 'assigned'
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {pass.status === 'checked_in' ? '✓ Checked In' : pass.status === 'unassigned' ? 'Unassigned' : 'Assigned'}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                ₹{pass.ticketPrice || 0}
              </span>
            </div>
            <h4 className="font-bold text-white text-base mt-0.5 truncate">
              {pass.assignedTo?.name || 'Unassigned Guest Pass'}
            </h4>
            <p className="text-xs text-slate-400 truncate">
              {pass.eventName} • {pass.category}
              {pass.assignedTo?.email && ` • ${pass.assignedTo.email}`}
              {pass.assignedTo?.phone && ` • ${pass.assignedTo.phone}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end shrink-0">
          {!isAssigned && onAssignClick && (
            <button
              onClick={() => onAssignClick(pass)}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm shadow-indigo-600/30"
            >
              <UserCheck className="w-3.5 h-3.5" />
              Assign
            </button>
          )}
          {onToggleCheckIn && isAssigned && (
            <button
              onClick={() => onToggleCheckIn(pass)}
              className={`px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer ${
                pass.status === 'checked_in'
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                  : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm shadow-indigo-600/30'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              {pass.status === 'checked_in' ? 'Undo Check-In' : 'Check In'}
            </button>
          )}
          <button
            onClick={handleDownloadImage}
            title="Download Official Pass Badge Image"
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Image
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 text-white rounded-2xl shadow-xl overflow-hidden flex flex-col justify-between border border-slate-800 hover:border-slate-700 transition-all group relative">
      
      {/* Top Banner Bar */}
      <div 
        className="p-3.5 flex items-center justify-between border-b border-slate-800 bg-slate-950"
        style={{ borderTop: `4px solid ${pass.themeColor || '#6366f1'}` }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
            {pass.category || 'VIP ACCESS'}
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            (₹{pass.ticketPrice || 0})
          </span>
        </div>
        <span 
          className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-lg ${
            pass.status === 'checked_in'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : pass.status === 'assigned'
              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
          }`}
        >
          {pass.status === 'checked_in' ? '✓ Checked In' : pass.status === 'unassigned' ? 'Unassigned' : 'Assigned'}
        </span>
      </div>

      {/* Ticket Body Layout */}
      <div className="p-5 space-y-4">
        
        {/* Event Banner */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-indigo-400">Event</p>
              <h3 className="text-lg font-bold text-white leading-snug">
                {pass.eventName}
              </h3>
            </div>
          </div>

          <div className="text-[11px] text-slate-300 space-y-1 pt-1 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>{pass.eventDate}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>{pass.commencementTime || pass.eventTime} {pass.endTime ? `— ${pass.endTime}` : ''}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="truncate">{pass.eventLocation}</span>
            </div>
          </div>
        </div>

        {/* Pass Holder Details */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-2">
          <p className="text-[9px] font-bold uppercase tracking-wider text-indigo-400">Pass Holder</p>
          {pass.assignedTo?.name ? (
            <div className="space-y-1">
              <p className="text-base font-bold text-white">
                {pass.assignedTo.name}
              </p>
              {pass.assignedTo?.email && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                  <span className="truncate">{pass.assignedTo.email}</span>
                </div>
              )}
              {pass.assignedTo?.phone && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                  <span>{pass.assignedTo.phone}</span>
                </div>
              )}
              {pass.assignedTo?.notes && (
                <div className="flex items-center gap-1.5 text-xs text-amber-300/90 pt-1">
                  <FileText className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>{pass.assignedTo.notes}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-400">
                Unassigned Guest Pass
              </p>
              <p className="text-[10px] text-slate-400">
                Scan QR or enter name to bind pass to an attendee.
              </p>
            </div>
          )}
        </div>

        {/* Verification Code & QR Section */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 flex items-center justify-between gap-3">
          <div className="space-y-1 flex-1 min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
              16-Digit Verification Code
            </p>
            <p className="text-base font-bold tracking-wider font-mono text-indigo-400 truncate">
              {pass.formattedCode}
            </p>
            <button
              onClick={handleCopyCode}
              className="text-[10px] font-bold uppercase tracking-wider bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 mt-1 cursor-pointer"
            >
              <Copy className="w-3 h-3" />
              {copied ? 'Copied!' : 'Copy Code'}
            </button>
          </div>

          <div className="w-20 h-20 bg-white p-1 rounded-xl shrink-0 flex items-center justify-center">
            {qrUrl ? (
              <img src={qrUrl} alt="QR Code" className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full bg-slate-800 animate-pulse rounded" />
            )}
          </div>
        </div>

      </div>

      {/* Ticket Footer Action Bar */}
      <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2">
        {!isAssigned && onAssignClick ? (
          <button
            onClick={() => onAssignClick(pass)}
            className="w-full py-2.5 bg-indigo-600 text-white font-bold uppercase tracking-wider text-xs hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2 rounded-xl shadow-md shadow-indigo-600/30 cursor-pointer"
          >
            <UserCheck className="w-4 h-4" />
            Scan & Assign Attendee
          </button>
        ) : (
          <>
            {onToggleCheckIn && (
              <button
                onClick={() => onToggleCheckIn(pass)}
                className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 rounded-xl cursor-pointer ${
                  pass.status === 'checked_in'
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                    : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/30'
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                {pass.status === 'checked_in' ? 'Undo Check-In' : 'Mark Checked In'}
              </button>
            )}

            <button
              onClick={handleDownloadImage}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-colors border border-slate-700 rounded-xl shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              Download
            </button>
          </>
        )}
      </div>

    </div>
  );
};
