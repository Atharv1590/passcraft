import React, { useState } from 'react';
import { PassItem, EventItem } from '../types';
import { generateQRDataURL } from '../lib/passUtils';
import { 
  FileText, 
  Printer, 
  Download, 
  Copy, 
  Check, 
  CheckCircle,
  Send, 
  ExternalLink, 
  Share2, 
  Sparkles, 
  Code, 
  FileSpreadsheet,
  QrCode,
  Globe,
  AlertCircle,
  Trash2
} from 'lucide-react';

interface PassDocsAndTransferHubProps {
  passes: PassItem[];
  events: EventItem[];
  onDeleteEvent?: (eventId: string) => void;
}

export const PassDocsAndTransferHub: React.FC<PassDocsAndTransferHubProps> = ({
  passes,
  events,
  onDeleteEvent,
}) => {
  const [selectedEventId, setSelectedEventId] = useState<string>('all');
  const [passStatusFilter, setPassStatusFilter] = useState<'all' | 'unassigned' | 'assigned'>('all');
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [copiedCsv, setCopiedCsv] = useState(false);
  
  // Webhook / API Transfer State
  const [webhookUrl, setWebhookUrl] = useState('');
  const [transferStatus, setTransferStatus] = useState<string | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  // Google Docs Creation State
  const [isCreatingDoc, setIsCreatingDoc] = useState(false);
  const [docCreationStatus, setDocCreationStatus] = useState<string | null>(null);

  // Filter Target Passes
  const targetPasses = passes.filter(p => {
    const matchesEvent = selectedEventId === 'all' || p.eventId === selectedEventId;
    const matchesStatus = 
      passStatusFilter === 'all' || 
      (passStatusFilter === 'unassigned' && p.status === 'unassigned') ||
      (passStatusFilter === 'assigned' && p.status !== 'unassigned');
    return matchesEvent && matchesStatus;
  });

  // Generate Print Sheet HTML and trigger Browser Print
  const handlePrintSheet = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to open the printable pass document sheet.');
      return;
    }

    const cardsHtml = targetPasses.map(pass => {
      const qrDataUrl = generateQRDataURL(pass.code16);
      const categoryTitle = pass.category.toUpperCase().includes('PASS') ? pass.category.toUpperCase() : `${pass.category.toUpperCase()} ACCESS PASS`;

      return `
        <div style="width: 4cm; height: 4cm; border: 1.5px solid #27272a; border-radius: 8px; padding: 2.5mm 1.5mm; margin: 1mm; display: inline-flex; flex-direction: column; align-items: center; justify-content: space-between; font-family: system-ui, -apple-system, sans-serif; box-sizing: border-box; background: #000000; color: #ffffff; page-break-inside: avoid; text-align: center; vertical-align: top; overflow: hidden; box-shadow: 0 2px 5px rgba(0,0,0,0.7);">
          <div style="font-size: 7.5pt; font-weight: 900; text-transform: uppercase; color: #10b981; letter-spacing: 0.3px; line-height: 1.1; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${pass.eventName}
          </div>

          <div style="font-size: 8.5pt; font-weight: 900; text-transform: uppercase; color: #ffffff; letter-spacing: 0.2px; line-height: 1.1; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${categoryTitle}
          </div>
          
          <div style="background: #ffffff; padding: 1.5px; border-radius: 4px; display: inline-block; margin: 0.5mm 0;">
            <img src="${qrDataUrl}" style="width: 2.1cm; height: 2.1cm; display: block;" alt="QR Code" />
          </div>

          <div style="font-family: monospace; font-size: 7.5pt; font-weight: 900; letter-spacing: 0.5px; color: #ffffff; background: #18181b; border: 1px solid #27272a; padding: 1px 3px; border-radius: 4px; width: 100%; box-sizing: border-box; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${pass.formattedCode}
          </div>
        </div>
      `;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>PassCraft Printable Pass Sheet (${targetPasses.length} Passes)</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 0.2in;
            }
            @media print {
              body { margin: 0; padding: 0; background: #000000 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .no-print { display: none; }
            }
            body { font-family: system-ui, -apple-system, sans-serif; background: #09090b; color: #ffffff; padding: 8px; text-align: center; }
            .header { text-align: center; margin-bottom: 12px; background: #18181b; color: #ffffff; padding: 12px; border-radius: 8px; border: 1px solid #27272a; max-width: 800px; margin-left: auto; margin-right: auto; }
            .grid { display: flex; flex-wrap: wrap; justify-content: center; align-items: flex-start; gap: 1.5mm; }
          </style>
        </head>
        <body>
          <div class="header no-print">
            <h1 style="margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 1px; color: #10b981;">PassCraft 4x4cm Compact Printable Pass Sheet</h1>
            <p style="margin: 4px 0 0; font-size: 11px; color: #a1a1aa;">
              Total Passes: ${targetPasses.length} • Exact 4cm × 4cm card size optimized for maximum cards per A4 sheet (Event Name, Pass Tier, QR Code & 16-Digit Code).
            </p>
            <button onclick="window.print()" style="margin-top: 10px; padding: 10px 20px; background: #10b981; color: #000; font-weight: 900; border: none; cursor: pointer; text-transform: uppercase; font-size: 12px; border-radius: 6px; letter-spacing: 1px;">
              Print Document / Save PDF
            </button>
          </div>
          <div class="grid">
            ${cardsHtml}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Export Document as HTML file
  const handleDownloadDocHtml = () => {
    const cardsHtml = targetPasses.map(pass => {
      const qrDataUrl = generateQRDataURL(pass.code16);
      const categoryTitle = pass.category.toUpperCase().includes('PASS') ? pass.category.toUpperCase() : `${pass.category.toUpperCase()} ACCESS PASS`;

      return `
        <div style="width: 4cm; height: 4cm; border: 1.5px solid #27272a; border-radius: 8px; padding: 2.5mm 1.5mm; margin: 1mm; display: inline-flex; flex-direction: column; align-items: center; justify-content: space-between; font-family: system-ui, -apple-system, sans-serif; box-sizing: border-box; background: #000000; color: #ffffff; page-break-inside: avoid; text-align: center; vertical-align: top; overflow: hidden; box-shadow: 0 2px 5px rgba(0,0,0,0.7);">
          <div style="font-size: 7.5pt; font-weight: 900; text-transform: uppercase; color: #10b981; letter-spacing: 0.3px; line-height: 1.1; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${pass.eventName}
          </div>

          <div style="font-size: 8.5pt; font-weight: 900; text-transform: uppercase; color: #ffffff; letter-spacing: 0.2px; line-height: 1.1; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${categoryTitle}
          </div>
          
          <div style="background: #ffffff; padding: 1.5px; border-radius: 4px; display: inline-block; margin: 0.5mm 0;">
            <img src="${qrDataUrl}" style="width: 2.1cm; height: 2.1cm; display: block;" alt="QR Code" />
          </div>

          <div style="font-family: monospace; font-size: 7.5pt; font-weight: 900; letter-spacing: 0.5px; color: #ffffff; background: #18181b; border: 1px solid #27272a; padding: 1px 3px; border-radius: 4px; width: 100%; box-sizing: border-box; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${pass.formattedCode}
          </div>
        </div>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>PassCraft Event Passes Document (4x4cm Cards)</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; margin: 15px; background-color: #09090b; color: #ffffff; text-align: center; }
            h1 { text-transform: uppercase; border-bottom: 3px solid #10b981; padding-bottom: 8px; color: #10b981; font-size: 20px; }
            .grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; }
          </style>
        </head>
        <body>
          <h1>PassCraft 4x4cm QR Pass Directory (${targetPasses.length} Passes)</h1>
          <p style="color: #a1a1aa; margin-bottom: 16px; font-size: 12px;">Generated on ${new Date().toLocaleDateString()} for high-density event printing and transfer.</p>
          <div class="grid">
            ${cardsHtml}
          </div>
        </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PassCraft_Printable_Passes_${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Create Google Doc via Browser Download / Opening Google Docs Template
  const handleCreateGoogleDoc = async () => {
    setIsCreatingDoc(true);
    setDocCreationStatus('Preparing printable Google Docs template payload...');

    setTimeout(() => {
      // Create Google Docs friendly HTML document that opens in Google Docs / Drive
      handleDownloadDocHtml();
      setDocCreationStatus('Printable document created! You can now import or paste this into Google Docs to edit and print.');
      setIsCreatingDoc(false);
    }, 800);
  };

  // Data Transfer JSON Payload Generator
  const generateTransferPayloadJson = () => {
    return JSON.stringify({
      version: '1.0',
      exportedAt: new Date().toISOString(),
      totalCount: targetPasses.length,
      passes: targetPasses.map(p => ({
        id: p.id,
        code16: p.code16,
        formattedCode: p.formattedCode,
        last4Digits: p.code16.slice(-4),
        eventName: p.eventName,
        eventDate: p.eventDate,
        eventLocation: p.eventLocation,
        category: p.category,
        status: p.status,
        qrDataUrl: generateQRDataURL(p.code16),
        assignedTo: p.assignedTo || null,
        checkedInAt: p.checkedInAt || null,
      })),
    }, null, 2);
  };

  // People Info CSV Generator (Clean, no check-in timestamps)
  const generatePeopleCsvData = () => {
    const headers = ['16-Digit Code', 'Formatted Code', 'Attendee Name', 'Attendee Email', 'Attendee Phone', 'Event Name', 'Category', 'Price ($)', 'Status'];
    const rows = targetPasses.map(p => [
      p.code16,
      p.formattedCode,
      `"${(p.assignedTo?.name || (p.status === 'unassigned' ? '[Unassigned]' : '')).replace(/"/g, '""')}"`,
      `"${(p.assignedTo?.email || '').replace(/"/g, '""')}"`,
      `"${(p.assignedTo?.phone || '').replace(/"/g, '""')}"`,
      `"${(p.eventName || '').replace(/"/g, '""')}"`,
      p.category || 'General',
      String(p.ticketPrice || 0),
      p.status,
    ]);
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  };

  // Check-in Timestamp & Gate Logs CSV Generator
  const generateCheckinGateCsvData = () => {
    const headers = ['16-Digit Code', 'Attendee Name', 'Attendee Email', 'Event Name', 'Category', 'Check-in Timestamp', 'Gate Used', 'Total Gate Admissions', 'Status'];
    const rows = targetPasses.map(p => {
      const gateUsed = Array.isArray(p.gateScans) && p.gateScans.length > 0
        ? p.gateScans.map(s => s.gateName || 'Gate').join(', ')
        : (p.status === 'checked_in' ? 'Main Gate' : '-');
      const totalEntries = Array.isArray(p.gateScans) && p.gateScans.length > 0
        ? p.gateScans.length
        : (p.status === 'checked_in' ? 1 : 0);
      const timestamp = p.checkedInAt ? new Date(p.checkedInAt).toLocaleString() : '';

      return [
        p.code16,
        `"${(p.assignedTo?.name || '').replace(/"/g, '""')}"`,
        `"${(p.assignedTo?.email || '').replace(/"/g, '""')}"`,
        `"${(p.eventName || '').replace(/"/g, '""')}"`,
        p.category || 'General',
        `"${timestamp}"`,
        `"${gateUsed.replace(/"/g, '""')}"`,
        String(totalEntries),
        p.status,
      ];
    });
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  };

  // Download People Info CSV
  const handleDownloadPeopleCsv = () => {
    const csvContent = generatePeopleCsvData();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PassCraft_People_Info_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Download Check-in & Gate Logs CSV
  const handleDownloadCheckinGateCsv = () => {
    const csvContent = generateCheckinGateCsvData();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PassCraft_Checkin_And_Gate_Logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Download JSON Transfer File
  const handleDownloadJsonTransfer = () => {
    const jsonStr = generateTransferPayloadJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PassCraft_Transfer_Payload_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Copy JSON Payload to Clipboard
  const handleCopyPayload = () => {
    navigator.clipboard.writeText(generateTransferPayloadJson());
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  // Copy CSV to Clipboard
  const handleCopyCsv = () => {
    navigator.clipboard.writeText(generatePeopleCsvData());
    setCopiedCsv(true);
    setTimeout(() => setCopiedCsv(false), 2000);
  };

  // Send Webhook Payload to External App Endpoint
  const handleSendWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.trim()) return;

    setIsTransferring(true);
    setTransferStatus('Connecting to target app endpoint...');

    try {
      const payload = generateTransferPayloadJson();
      const res = await fetch(webhookUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });

      if (res.ok) {
        setTransferStatus('SUCCESS! Transfer payload received by external app endpoint.');
      } else {
        setTransferStatus(`Endpoint responded with status ${res.status}. Payload copied to clipboard as backup.`);
        navigator.clipboard.writeText(payload);
      }
    } catch (err) {
      setTransferStatus('Network error sending webhook. Payload copied to clipboard so you can paste directly into the other app.');
      navigator.clipboard.writeText(generateTransferPayloadJson());
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 py-8 px-4">
      
      {/* Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 text-white flex flex-col md:flex-row md:items-end justify-between gap-6 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="p-1.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-lg">
              <Printer className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-400">
              PRINTABLE DOCS & DATA TRANSFER CONSOLE
            </span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight uppercase leading-none">
            PRINT PASSES <span className="text-indigo-400">& TRANSFER</span>
          </h2>
          <p className="text-xs text-slate-300 max-w-xl mt-3 leading-relaxed">
            Download all 16-digit passes with QR codes in Google Docs / Printable sheet format to print and hand out, or transfer QR pass codes directly to another app.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 w-full md:w-auto relative z-10">
          <button
            onClick={handlePrintSheet}
            disabled={targetPasses.length === 0}
            className="w-full sm:w-auto px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            PRINT PASS SHEET ({targetPasses.length})
          </button>

          <button
            onClick={handleDownloadDocHtml}
            disabled={targetPasses.length === 0}
            className="w-full sm:w-auto px-5 py-3.5 bg-slate-950 hover:bg-slate-800 text-slate-200 hover:text-white font-bold text-xs uppercase tracking-wider rounded-xl border border-slate-800 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            <FileText className="w-4 h-4 text-indigo-400" />
            EXPORT DOC FILE
          </button>
        </div>
      </div>

      {/* Dataset Filter Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
            <QrCode className="w-5 h-5 shrink-0" />
          </div>
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-white">DATASET SELECTOR</h3>
            <p className="text-[11px] text-slate-400">Choose event and pass status to include in export</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            value={selectedEventId}
            onChange={e => setSelectedEventId(e.target.value)}
            className="bg-slate-950 border border-slate-800 p-2.5 font-bold text-xs text-white focus:border-indigo-500 rounded-xl outline-none uppercase flex-1 sm:flex-none"
          >
            <option value="all">ALL EVENTS ({passes.length} PASSES)</option>
            {events.map(ev => {
              const count = passes.filter(p => p.eventId === ev.id).length;
              return (
                <option key={ev.id} value={ev.id}>
                  {ev.title.toUpperCase()} ({count} PASSES)
                </option>
              );
            })}
          </select>

          {selectedEventId !== 'all' && onDeleteEvent && (
            <button
              type="button"
              onClick={() => {
                const targetEv = events.find(e => e.id === selectedEventId);
                if (window.confirm(`Are you sure you want to delete event "${targetEv?.title || 'Selected Event'}"? All associated passes will also be removed.`)) {
                  onDeleteEvent(selectedEventId);
                  setSelectedEventId('all');
                }
              }}
              className="bg-rose-500/10 text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-500/30 p-2.5 font-bold text-xs uppercase rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
              title="Delete Selected Event"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>DELETE EVENT</span>
            </button>
          )}

          <select
            value={passStatusFilter}
            onChange={e => setPassStatusFilter(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 p-2.5 font-bold text-xs text-white focus:border-indigo-500 rounded-xl outline-none uppercase flex-1 sm:flex-none"
          >
            <option value="all">ALL PASS STATUSES</option>
            <option value="unassigned">UNASSIGNED ONLY (BLANK FOR PRINTING)</option>
            <option value="assigned">ASSIGNED PASSES ONLY</option>
          </select>
        </div>
      </div>

      {/* Grid: Google Docs / Printable Sheet on Left, App-to-App Transfer on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Box: Google Docs & Printable Sheet Generator */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              1. GOOGLE DOCS & PRINTABLE PASSES
            </h3>
            <span className="text-[10px] font-mono uppercase bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2.5 py-0.5 rounded-full">
              PHYSICAL PRINT
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Generate printable pass cards with high-resolution QR codes and 16-digit security codes. Print directly to physical paper, cut into cards, hand them out to guests, and scan to bind names later!
          </p>

          <div className="space-y-4 pt-2">
            
            {/* Action Card: Open Printable Window */}
            <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs uppercase tracking-wider text-white flex items-center gap-2">
                  <Printer className="w-4 h-4 text-indigo-400" />
                  Print Sheet & Cut-Out Cards
                </span>
                <span className="text-[10px] font-mono text-indigo-400">HIGH-RES QR</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Formats all {targetPasses.length} selected passes into a 3-column printable grid with 16-digit codes and cut marks.
              </p>
              <button
                onClick={handlePrintSheet}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                OPEN PRINTABLE SHEET / SAVE PDF
              </button>
            </div>

            {/* Action Card: Google Docs Export */}
            <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs uppercase tracking-wider text-white flex items-center gap-2">
                  <Globe className="w-4 h-4 text-indigo-400" />
                  Google Docs Compatible Document
                </span>
                <span className="text-[10px] font-mono text-indigo-400">DOCS / DRIVE</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Downloads a standalone HTML/DOCX file ready to upload or paste directly into Google Docs or Microsoft Word.
              </p>
              <button
                onClick={handleCreateGoogleDoc}
                disabled={isCreatingDoc}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white font-bold text-xs uppercase tracking-wider border border-slate-800 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4 text-indigo-400" />
                {isCreatingDoc ? 'GENERATING DOCUMENT...' : 'DOWNLOAD GOOGLE DOCS FILE (.HTML)'}
              </button>
              {docCreationStatus && (
                <p className="text-[11px] font-mono text-indigo-400 pt-1">
                  {docCreationStatus}
                </p>
              )}
            </div>

          </div>
        </div>

        {/* Right Box: Transfer Passes & QR Codes to Another App */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Share2 className="w-4 h-4 text-indigo-400" />
              2. TRANSFER QR CODES TO ANOTHER APP
            </h3>
            <span className="text-[10px] font-mono uppercase bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
              APP INTEGRATION
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Export all 16-digit pass codes, QR image payloads, and attendee details to sync with external software, event management platforms, or custom apps.
          </p>

          <div className="space-y-4 pt-2">
            
            {/* Quick Export Buttons Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                onClick={handleDownloadJsonTransfer}
                className="p-3.5 bg-slate-950 border border-slate-800 hover:border-indigo-500/50 rounded-2xl text-left space-y-1 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <Code className="w-4 h-4 text-indigo-400" />
                  <span className="text-[9px] font-mono text-slate-500">.JSON</span>
                </div>
                <div className="font-bold text-xs uppercase text-white">JSON Payload</div>
                <div className="text-[10px] text-slate-400 font-mono">Full QR Data</div>
              </button>

              <button
                onClick={handleCopyPayload}
                className="p-3.5 bg-slate-950 border border-slate-800 hover:border-indigo-500/50 rounded-2xl text-left space-y-1 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  {copiedPayload ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-indigo-400" />}
                  <span className="text-[9px] font-mono text-slate-500">CLIPBOARD</span>
                </div>
                <div className="font-bold text-xs uppercase text-white">Copy JSON</div>
                <div className="text-[10px] text-slate-400 font-mono">{copiedPayload ? 'Copied!' : '1-Click Copy'}</div>
              </button>

              <button
                onClick={handleDownloadPeopleCsv}
                className="p-3.5 bg-slate-950 border border-slate-800 hover:border-indigo-500/50 rounded-2xl text-left space-y-1 transition-all cursor-pointer"
                title="Export clean People & Attendee Info without check-in timestamps"
              >
                <div className="flex items-center justify-between">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  <span className="text-[9px] font-mono text-indigo-400 font-bold">PEOPLE</span>
                </div>
                <div className="font-bold text-xs uppercase text-white">People CSV</div>
                <div className="text-[10px] text-slate-400 font-mono">Roster Directory</div>
              </button>

              <button
                onClick={handleDownloadCheckinGateCsv}
                className="p-3.5 bg-slate-950 border border-slate-800 hover:border-emerald-500/50 rounded-2xl text-left space-y-1 transition-all cursor-pointer"
                title="Export Check-in Timestamps and Gate Used Turnstile Logs"
              >
                <div className="flex items-center justify-between">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-[9px] font-mono text-emerald-400 font-bold">GATES</span>
                </div>
                <div className="font-bold text-xs uppercase text-white">Gate Logs CSV</div>
                <div className="text-[10px] text-slate-400 font-mono">Scan &amp; Gate Data</div>
              </button>
            </div>

            {/* Webhook / Direct Endpoint Transfer Form */}
            <form onSubmit={handleSendWebhook} className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs uppercase tracking-wider text-white flex items-center gap-2">
                  <Send className="w-4 h-4 text-indigo-400" />
                  Direct Webhook / API Transfer to Another App
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Send pass payload (16-digit codes & QR image data) directly to another application's API endpoint:
              </p>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={e => setWebhookUrl(e.target.value)}
                  placeholder="https://my-event-app.com/api/receive-passes"
                  className="flex-1 bg-slate-900 border border-slate-800 p-2.5 font-mono text-xs text-white focus:border-indigo-500 rounded-xl outline-none placeholder:text-slate-600"
                />
                <button
                  type="submit"
                  disabled={isTransferring || !webhookUrl.trim()}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-600/30 shrink-0 disabled:opacity-50 cursor-pointer"
                >
                  {isTransferring ? 'SENDING...' : 'TRANSFER NOW'}
                </button>
              </div>

              {transferStatus && (
                <p className="text-[11px] font-mono text-indigo-400 pt-1">
                  {transferStatus}
                </p>
              )}
            </form>

          </div>
        </div>

      </div>

      {/* Dataset Quick Summary Table Preview */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-xs uppercase tracking-wider text-indigo-400 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            PASS DATASET SUMMARY ({targetPasses.length} PASSES READY FOR PRINT/TRANSFER)
          </h4>
          <button
            onClick={handleCopyCsv}
            className="text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {copiedCsv ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedCsv ? 'CSV COPIED' : 'COPY CSV'}
          </button>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-xs text-indigo-300 overflow-x-auto max-h-48 shadow-inner">
          <pre>
            {generatePeopleCsvData().split('\n').slice(0, 10).join('\n')}
            {targetPasses.length > 9 ? `\n... (and ${targetPasses.length - 9} more passes)` : ''}
          </pre>
        </div>
      </div>

    </div>
  );
};
