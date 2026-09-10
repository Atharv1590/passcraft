import React, { useState, useEffect } from 'react';
import { PassItem, EventItem, FinancialEntry } from '../types';
import { generateQRDataURL } from '../lib/passUtils';
import { safeFetchJson } from '../lib/apiHelper';
import { 
  Sparkles, 
  Printer, 
  Download, 
  Copy, 
  Check, 
  Palette, 
  FileSpreadsheet, 
  ExternalLink, 
  Layout, 
  QrCode, 
  ShieldCheck, 
  Sliders, 
  RefreshCw,
  Wand2,
  FileText,
  ClipboardList
} from 'lucide-react';
import { GoogleDocsManager } from './GoogleDocsManager';
import { GoogleFormsManager } from './GoogleFormsManager';

interface AIPassStudioProps {
  passes: PassItem[];
  events: EventItem[];
  financials?: FinancialEntry[];
  selectedEventId?: string;
  onSelectEvent?: (eventId: string) => void;
  onPassesUpdated?: (newPasses: PassItem[]) => void;
  initialPage?: 'designer' | 'google-docs' | 'google-forms';
  onPageChange?: (page: 'designer' | 'google-docs' | 'google-forms') => void;
  userEmail?: string;
}

export const AIPassStudio: React.FC<AIPassStudioProps> = ({
  passes,
  events,
  financials = [],
  selectedEventId = 'all',
  onSelectEvent,
  onPassesUpdated,
  initialPage = 'designer',
  onPageChange,
  userEmail,
}) => {
  const [activePage, setActivePage] = useState<'designer' | 'google-docs' | 'google-forms'>(initialPage);

  useEffect(() => {
    if (initialPage && initialPage !== activePage) {
      setActivePage(initialPage);
    }
  }, [initialPage]);

  const handleSwitchPage = (newPage: 'designer' | 'google-docs' | 'google-forms') => {
    setActivePage(newPage);
    if (onPageChange) {
      onPageChange(newPage);
    }
  };

  const [selectedPassId, setSelectedPassId] = useState<string>(passes[0]?.id || '');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiDesigning, setIsAiDesigning] = useState(false);
  const [aiStatus, setAiStatus] = useState<string | null>(null);

  // Design Customization State
  const [badgeFormat, setBadgeFormat] = useState<'full-page' | 'lanyard' | 'ticket'>('full-page');
  const [headerTitle, setHeaderTitle] = useState('FUTURE TECH SUMMIT 2026');
  const [subHeader, setSubHeader] = useState('GENERAL DELEGATE ACCESS PASS');
  const [tagline, setTagline] = useState('OFFICIAL AI & QUANTUM COMPUTING SYMPOSIUM BADGE');
  const [backgroundColor, setBackgroundColor] = useState('#000000');
  const [accentColor, setAccentColor] = useState('#10b981');
  const [textColor, setTextColor] = useState('#ffffff');
  const [termsText, setTermsText] = useState('Official event badge. Non-transferable. Must be displayed prominently at all venue checkpoints.');
  const [showPenLine, setShowPenLine] = useState(true);

  // Copy states
  const [copiedCsv, setCopiedCsv] = useState(false);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  // Dataset Filter State for Batch Printing & Export
  const [printFilterMode, setPrintFilterMode] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [batchPrintLayout, setBatchPrintLayout] = useState<'full-page' | 'grid'>('full-page');

  // Filtered dataset
  const filteredPasses = passes.filter(p => {
    if (printFilterMode === 'assigned') return p.status === 'assigned' || p.status === 'checked_in';
    if (printFilterMode === 'unassigned') return p.status === 'unassigned';
    return true;
  });

  const assignedCount = passes.filter(p => p.status === 'assigned' || p.status === 'checked_in').length;
  const unassignedCount = passes.filter(p => p.status === 'unassigned').length;

  const currentPass = passes.find(p => p.id === selectedPassId) || filteredPasses[0] || passes[0] || {
    id: 'demo',
    code16: '5920987999705807',
    formattedCode: '5920-9879-9970-5807',
    eventName: headerTitle,
    category: 'VIP DELEGATE',
    status: 'unassigned',
  };

  // Size & Custom Dimensions State
  const [badgePreset, setBadgePreset] = useState<
    'lanyard-portrait' | 'standard-card' | 'square-badge' | 'lanyard-landscape' | 'wristband' | 'a4-fullpage' | 'custom'
  >('lanyard-portrait');
  const [customWidth, setCustomWidth] = useState<number>(100);
  const [customHeight, setCustomHeight] = useState<number>(150);
  const [customUnit, setCustomUnit] = useState<'mm' | 'cm' | 'in' | 'px'>('mm');

  // AI-adapted design properties
  const [layoutOrientation, setLayoutOrientation] = useState<'portrait' | 'landscape' | 'square' | 'compact-horizontal'>('portrait');
  const [aiQrSizePx, setAiQrSizePx] = useState<number>(180);
  const [aiTitleFontSizePx, setAiTitleFontSizePx] = useState<number>(26);
  const [aiCodeFontSizePx, setAiCodeFontSizePx] = useState<number>(18);

  // Studio Mode: 'canvas-ai' | 'size-designer' | 'batch-print'
  const [studioMode, setStudioMode] = useState<'canvas-ai' | 'size-designer' | 'batch-print'>('canvas-ai');

  // AI Canvas Generator State
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [canvasPrompt, setCanvasPrompt] = useState('Cyberpunk neon VIP badge with dark circuit grid background and gold glowing frame');
  const [isCanvasGenerating, setIsCanvasGenerating] = useState(false);
  const [canvasDesignData, setCanvasDesignData] = useState<{
    themeTitle: string;
    backgroundColor: string;
    backgroundType: 'gradient' | 'dark-grid' | 'circuit' | 'neon-glow' | 'metallic' | 'glassmorphism';
    gradientColors: string[];
    borderColor: string;
    borderStyle: 'double-gold' | 'neon-frame' | 'corner-notches' | 'subtle-hairline' | 'solid-thick';
    headerTitle: string;
    subHeader: string;
    tagline: string;
    badgeShape: 'crest' | 'shield' | 'hexagon' | 'ribbon' | 'pill';
    badgeText: string;
    accentColor: string;
    textColor: string;
    secondaryTextColor: string;
    showWatermark: boolean;
    customStickers: string[];
  }>({
    themeTitle: 'Cyberpunk Neon VIP',
    backgroundColor: '#07090e',
    backgroundType: 'dark-grid',
    gradientColors: ['#07090e', '#130026'],
    borderColor: '#10b981',
    borderStyle: 'double-gold',
    headerTitle: headerTitle || 'FUTURE TECH SUMMIT 2026',
    subHeader: 'VIP ALL-ACCESS DELEGATE PASS',
    tagline: 'OFFICIAL AI & QUANTUM SYMPOSIUM BADGE',
    badgeShape: 'crest',
    badgeText: 'VIP 2026',
    accentColor: '#10b981',
    textColor: '#ffffff',
    secondaryTextColor: '#94a3b8',
    showWatermark: true,
    customStickers: ['256-BIT SECURE', 'QR AUTHENTICATED'],
  });

  // Call API for Canvas AI Generation
  const handleGenerateCanvasAi = async (promptOverride?: string) => {
    const p = promptOverride || canvasPrompt || 'Futuristic neon VIP pass with dark grid background';
    setIsCanvasGenerating(true);
    try {
      const res = await safeFetchJson<{ success: boolean; data?: any }>('/api/gemini/design-canvas-pass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: p,
          currentEvent: currentPass.eventName,
        }),
      });
      if (res.ok && res.data?.success && res.data.data) {
        setCanvasDesignData(res.data.data);
      }
    } catch (err) {
      console.error('Error generating canvas design:', err);
    } finally {
      setIsCanvasGenerating(false);
    }
  };

  // Render Canvas Directives onto HTML5 Canvas element
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High DPI Canvas Setup
    const W = 800;
    const H = 1200;
    canvas.width = W;
    canvas.height = H;

    const d = canvasDesignData;

    // 1. Background Layer
    if (d.backgroundType === 'gradient' && d.gradientColors && d.gradientColors.length >= 2) {
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, d.gradientColors[0] || d.backgroundColor);
      grad.addColorStop(1, d.gradientColors[1] || '#000000');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    } else if (d.backgroundType === 'metallic') {
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, '#111827');
      grad.addColorStop(0.5, '#1f2937');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = d.backgroundColor || '#0a0a0c';
      ctx.fillRect(0, 0, W, H);

      // Dark Grid effect
      if (d.backgroundType === 'dark-grid' || d.backgroundType === 'circuit') {
        ctx.strokeStyle = `${d.accentColor || '#10b981'}20`;
        ctx.lineWidth = 1;
        const step = 40;
        for (let x = 0; x < W; x += step) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
        }
        for (let y = 0; y < H; y += step) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        }
      }
    }

    // Neon Corner Glows
    if (d.backgroundType === 'neon-glow' || d.borderStyle === 'neon-frame') {
      const glow1 = ctx.createRadialGradient(0, 0, 10, 0, 0, 400);
      glow1.addColorStop(0, `${d.accentColor}60`);
      glow1.addColorStop(1, 'transparent');
      ctx.fillStyle = glow1;
      ctx.fillRect(0, 0, W, H);
    }

    // 2. Outer Border Frame
    const inset = 30;
    ctx.strokeStyle = d.borderColor || d.accentColor || '#10b981';
    ctx.lineWidth = 6;
    ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);

    if (d.borderStyle === 'double-gold') {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.strokeRect(inset + 12, inset + 12, W - (inset + 12) * 2, H - (inset + 12) * 2);
    } else if (d.borderStyle === 'corner-notches') {
      ctx.fillStyle = d.accentColor;
      ctx.fillRect(inset - 5, inset - 5, 24, 24);
      ctx.fillRect(W - inset - 19, inset - 5, 24, 24);
      ctx.fillRect(inset - 5, H - inset - 19, 24, 24);
      ctx.fillRect(W - inset - 19, H - inset - 19, 24, 24);
    }

    // 3. Header & Tagline
    ctx.textAlign = 'center';
    
    // Tagline
    ctx.fillStyle = d.accentColor || '#10b981';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText((d.tagline || 'OFFICIAL EVENT PASS').toUpperCase(), W / 2, 100);

    // Event Header Title
    ctx.fillStyle = d.textColor || '#ffffff';
    ctx.font = '900 42px sans-serif';
    ctx.fillText((d.headerTitle || currentPass.eventName || 'EVENT PASS').toUpperCase(), W / 2, 160);

    // SubHeader / Category Pill
    ctx.fillStyle = `${d.accentColor}25`;
    ctx.fillRect(W / 2 - 200, 190, 400, 44);
    ctx.strokeStyle = d.accentColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(W / 2 - 200, 190, 400, 44);

    ctx.fillStyle = d.accentColor;
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText((d.subHeader || currentPass.category || 'VIP PASS').toUpperCase(), W / 2, 220);

    // 4. Badge Crest / Shield Graphic Shape
    const crestY = 320;
    ctx.save();
    ctx.beginPath();
    if (d.badgeShape === 'shield') {
      ctx.moveTo(W / 2 - 60, crestY);
      ctx.lineTo(W / 2 + 60, crestY);
      ctx.lineTo(W / 2 + 60, crestY + 60);
      ctx.lineTo(W / 2, crestY + 110);
      ctx.lineTo(W / 2 - 60, crestY + 60);
      ctx.closePath();
    } else if (d.badgeShape === 'hexagon') {
      ctx.moveTo(W / 2, crestY - 20);
      ctx.lineTo(W / 2 + 70, crestY + 20);
      ctx.lineTo(W / 2 + 70, crestY + 80);
      ctx.lineTo(W / 2, crestY + 120);
      ctx.lineTo(W / 2 - 70, crestY + 80);
      ctx.lineTo(W / 2 - 70, crestY + 20);
      ctx.closePath();
    } else {
      ctx.arc(W / 2, crestY + 45, 60, 0, Math.PI * 2);
    }
    
    ctx.fillStyle = d.accentColor;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#000000';
    ctx.font = '900 22px sans-serif';
    ctx.fillText((d.badgeText || 'VIP 2026').toUpperCase(), W / 2, crestY + 52);
    ctx.restore();

    // 5. Draw QR Code Image in Center White Container Box
    const qrSize = 280;
    const qrX = W / 2 - qrSize / 2;
    const qrY = 480;

    // QR Box Frame
    ctx.fillStyle = '#ffffff';
    if (ctx.roundRect) {
      ctx.roundRect(qrX - 16, qrY - 16, qrSize + 32, qrSize + 32, 16);
    } else {
      ctx.fillRect(qrX - 16, qrY - 16, qrSize + 32, qrSize + 32);
    }
    ctx.fill();

    const qrImg = new Image();
    qrImg.crossOrigin = 'anonymous';
    qrImg.src = generateQRDataURL(currentPass.code16);
    qrImg.onload = () => {
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

      // 6. 16-Digit Code Pill below QR
      const codeY = 830;
      ctx.fillStyle = '#18181b';
      if (ctx.roundRect) {
        ctx.roundRect(W / 2 - 240, codeY - 25, 480, 54, 12);
      } else {
        ctx.fillRect(W / 2 - 240, codeY - 25, 480, 54);
      }
      ctx.fill();
      ctx.strokeStyle = d.accentColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 28px monospace';
      ctx.fillText(currentPass.formattedCode, W / 2, codeY + 12);

      // 7. Attendee Box / Pass Holder
      const attY = 930;
      ctx.strokeStyle = '#ffffff30';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(80, attY);
      ctx.lineTo(W - 80, attY);
      ctx.stroke();

      ctx.fillStyle = d.secondaryTextColor || '#94a3b8';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('PASS HOLDER / ATTENDEE:', W / 2, attY + 30);

      const attendeeName = currentPass.assignedTo?.name || 'NAME: ____________________________';
      ctx.fillStyle = d.accentColor;
      ctx.font = '900 32px sans-serif';
      ctx.fillText(attendeeName.toUpperCase(), W / 2, attY + 75);

      // 8. Custom Stickers / Security Badges
      if (d.customStickers && d.customStickers.length >= 2) {
        ctx.fillStyle = '#18181b';
        ctx.fillRect(80, H - 110, 200, 32);
        ctx.strokeStyle = d.accentColor;
        ctx.strokeRect(80, H - 110, 200, 32);
        ctx.fillStyle = d.accentColor;
        ctx.font = 'bold 12px monospace';
        ctx.fillText(d.customStickers[0], 180, H - 89);

        ctx.fillStyle = '#18181b';
        ctx.fillRect(W - 280, H - 110, 200, 32);
        ctx.strokeStyle = d.accentColor;
        ctx.strokeRect(W - 280, H - 110, 200, 32);
        ctx.fillStyle = d.accentColor;
        ctx.font = 'bold 12px monospace';
        ctx.fillText(d.customStickers[1], W - 180, H - 89);
      }

      // Watermark
      if (d.showWatermark) {
        ctx.fillStyle = '#ffffff20';
        ctx.font = 'bold 12px monospace';
        ctx.fillText('PASSCRAFT AI CANVAS ENGINE • AES-256 VERIFIED', W / 2, H - 45);
      }
    };
  }, [canvasDesignData, currentPass]);

  const handleDownloadCanvasPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `AI_Canvas_Pass_${currentPass.formattedCode || 'badge'}.png`;
    a.click();
  };

  // Preset size change helper
  const handlePresetChange = (preset: typeof badgePreset) => {
    setBadgePreset(preset);
    if (preset === 'lanyard-portrait') {
      setCustomWidth(100); setCustomHeight(150); setCustomUnit('mm'); setLayoutOrientation('portrait');
    } else if (preset === 'standard-card') {
      setCustomWidth(85.6); setCustomHeight(53.9); setCustomUnit('mm'); setLayoutOrientation('landscape');
    } else if (preset === 'lanyard-landscape') {
      setCustomWidth(150); setCustomHeight(100); setCustomUnit('mm'); setLayoutOrientation('landscape');
    } else if (preset === 'square-badge') {
      setCustomWidth(80); setCustomHeight(80); setCustomUnit('mm'); setLayoutOrientation('square');
    } else if (preset === 'wristband') {
      setCustomWidth(250); setCustomHeight(25); setCustomUnit('mm'); setLayoutOrientation('compact-horizontal');
    } else if (preset === 'a4-fullpage') {
      setCustomWidth(210); setCustomHeight(297); setCustomUnit('mm'); setLayoutOrientation('portrait');
    }
  };

  // Trigger Gemini AI Pass Design Generator
  const handleGenerateAiDesign = async (promptToUse?: string) => {
    const finalPrompt = promptToUse || aiPrompt || 'Sleek official event pass layout tailored for badge size';

    setIsAiDesigning(true);
    setAiStatus(`Gemini AI is crafting custom layout for ${customWidth}${customUnit} × ${customHeight}${customUnit}...`);

    try {
      const res = await safeFetchJson<{ success: boolean; data?: any; error?: string }>('/api/gemini/design-pass-theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt,
          currentEvent: currentPass.eventName,
          dimensions: {
            width: customWidth,
            height: customHeight,
            unit: customUnit,
            preset: badgePreset,
          },
        }),
      });

      if (res.ok && res.data?.success && res.data.data) {
        const d = res.data.data;
        if (d.headerTitle) setHeaderTitle(d.headerTitle.toUpperCase());
        if (d.subHeader) setSubHeader(d.subHeader.toUpperCase());
        if (d.tagline) setTagline(d.tagline.toUpperCase());
        if (d.backgroundColor) setBackgroundColor(d.backgroundColor);
        if (d.accentColor) setAccentColor(d.accentColor);
        if (d.textColor) setTextColor(d.textColor || '#ffffff');
        if (d.termsAndConditions) setTermsText(d.termsAndConditions);
        if (d.layoutOrientation) setLayoutOrientation(d.layoutOrientation);
        if (d.qrSizePx) setAiQrSizePx(d.qrSizePx);
        if (d.titleFontSizePx) setAiTitleFontSizePx(d.titleFontSizePx);
        if (d.codeFontSizePx) setAiCodeFontSizePx(d.codeFontSizePx);

        setAiStatus(`AI Theme & ${customWidth}x${customHeight}${customUnit} Layout Applied: "${d.themeName || 'Custom Pass'}"!`);
      } else {
        setAiStatus('AI design generated! Applied preset colors.');
      }
    } catch (err) {
      setAiStatus('Applied preset theme styling.');
    } finally {
      setIsAiDesigning(false);
    }
  };

  // Generate Canva CSV File based on current filter
  const generateCanvaCsv = () => {
    const headers = ['AttendeeName', 'PassCode', 'Last4Digits', 'EventTitle', 'PassCategory', 'QRCodeURL', 'Status'];
    const rows = filteredPasses.map(p => [
      `"${p.assignedTo?.name || 'ATTENDEE: ____________________'}"`,
      p.formattedCode,
      p.code16.slice(-4),
      `"${p.eventName.replace(/"/g, '""')}"`,
      p.category,
      generateQRDataURL(p.code16),
      p.status,
    ]);
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  };

  const handleDownloadCanvaCsv = () => {
    const csvData = generateCanvaCsv();
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PassCraft_Canva_Bulk_${printFilterMode.toUpperCase()}_${filteredPasses.length}_Passes.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyTag = (tag: string) => {
    navigator.clipboard.writeText(tag);
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(null), 2000);
  };

  // Print single preview pass
  const handlePrintSinglePass = () => {
    if (!currentPass) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to open the printable pass.');
      return;
    }

    const qrDataUrl = generateQRDataURL(currentPass.code16);
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${headerTitle} - Full Page Pass (${currentPass.formattedCode})</title>
          <style>
            @media print {
              body { margin: 0; padding: 0; background: ${backgroundColor} !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .no-print { display: none; }
            }
            body { 
              font-family: system-ui, -apple-system, sans-serif; 
              background: ${backgroundColor}; 
              color: ${textColor}; 
              margin: 0; 
              padding: 40px; 
              display: flex; 
              flex-direction: column; 
              align-items: center; 
              justify-content: center;
              min-height: 100vh;
              box-sizing: border-box;
            }
            .pass-card {
              width: 100%;
              max-width: 600px;
              border: 3px solid ${accentColor};
              border-radius: 20px;
              padding: 40px;
              background: ${backgroundColor};
              text-align: center;
              box-sizing: border-box;
              box-shadow: 0 10px 30px rgba(0,0,0,0.8);
            }
            .qr-box {
              background: #ffffff;
              padding: 16px;
              border-radius: 12px;
              display: inline-block;
              margin: 20px 0;
            }
            .qr-box img {
              width: 220px;
              height: 220px;
              display: block;
            }
            .code-pill {
              font-family: monospace;
              font-size: 24px;
              font-weight: 900;
              letter-spacing: 3px;
              background: #18181b;
              color: #ffffff;
              padding: 12px 20px;
              border-radius: 10px;
              border: 1px solid #27272a;
              display: inline-block;
              margin-bottom: 12px;
            }
            .attendee-box {
              margin-top: 24px;
              padding-top: 20px;
              border-top: 2px dashed #333333;
              font-size: 16px;
              font-weight: bold;
              text-align: left;
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom: 20px; text-align: center;">
            <button onclick="window.print()" style="padding: 14px 28px; background: ${accentColor}; color: #000; font-weight: 900; font-size: 14px; border: none; border-radius: 8px; cursor: pointer; text-transform: uppercase;">
              Print Full Pass / Save as PDF
            </button>
          </div>

          <div class="pass-card">
            <div style="font-size: 11px; font-weight: 900; letter-spacing: 3px; color: ${accentColor}; text-transform: uppercase; margin-bottom: 8px;">
              ${tagline}
            </div>

            <h1 style="font-size: 32px; font-weight: 900; text-transform: uppercase; margin: 0 0 8px 0; letter-spacing: -1px; color: ${textColor};">
              ${headerTitle}
            </h1>

            <div style="font-size: 18px; font-weight: 900; text-transform: uppercase; color: ${accentColor}; margin-bottom: 20px; letter-spacing: 1px;">
              ${subHeader}
            </div>

            <div class="qr-box">
              <img src="${qrDataUrl}" alt="QR Pass" />
            </div>

            <div style="display: block;">
              <div class="code-pill">${currentPass.formattedCode}</div>
            </div>

            <div style="font-size: 13px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">
              LAST 4 DIGITS: <strong style="color: ${accentColor}; font-size: 16px;">${currentPass.code16.slice(-4)}</strong>
            </div>

            <div class="attendee-box">
              ${currentPass.assignedTo?.name ? `
                <div style="color: #a1a1aa; font-size: 11px; text-transform: uppercase; margin-bottom: 4px;">OFFICIAL PASS HOLDER:</div>
                <div style="font-size: 22px; font-weight: 900; color: ${accentColor}; text-transform: uppercase;">${currentPass.assignedTo.name}</div>
                ${currentPass.assignedTo?.email ? `<div style="font-size: 12px; color: #71717a; font-family: monospace;">${currentPass.assignedTo.email}</div>` : ''}
              ` : `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size: 14px; font-weight: 900;">ATTENDEE:</span>
                  <span style="font-family: monospace; color: #71717a; font-size: 18px;">_________________________________</span>
                </div>
                <div style="font-size: 10px; color: #71717a; text-transform: uppercase; margin-top: 6px;">
                  (WRITE NAME MANUALLY WITH PEN OR SCAN QR CODE TO BIND NAME)
                </div>
              `}
            </div>

            <div style="margin-top: 30px; font-size: 10px; color: #71717a; text-transform: uppercase; border-top: 1px solid #27272a; padding-top: 15px;">
              ${termsText}
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Batch Print All Filtered Passes (All / Assigned / Unassigned) with AI Customizer Theme
  const handlePrintBatchPasses = () => {
    if (filteredPasses.length === 0) {
      alert(`No passes found in "${printFilterMode.toUpperCase()}" filter.`);
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to open the printable pass document.');
      return;
    }

    const passesHtml = filteredPasses.map((pass, index) => {
      const qrDataUrl = generateQRDataURL(pass.code16);
      
      if (batchPrintLayout === 'grid') {
        // Multi-card grid style
        return `
          <div style="border: 2px solid ${accentColor}; padding: 20px; margin: 12px; width: 280px; display: inline-block; vertical-align: top; font-family: monospace; box-sizing: border-box; background: ${backgroundColor}; color: ${textColor}; page-break-inside: avoid; text-align: center; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
            <div style="font-size: 9px; font-weight: 800; text-transform: uppercase; color: ${accentColor}; letter-spacing: 1.5px; margin-bottom: 4px;">
              ${tagline}
            </div>
            <div style="font-size: 14px; font-weight: 900; margin-bottom: 6px; text-transform: uppercase; color: ${textColor};">
              ${pass.eventName || headerTitle}
            </div>
            <div style="font-size: 11px; font-weight: 900; text-transform: uppercase; color: ${accentColor}; margin-bottom: 8px;">
              ${pass.category || subHeader}
            </div>
            
            <div style="background: #ffffff; padding: 8px; display: inline-block; border-radius: 8px; margin: 6px auto;">
              <img src="${qrDataUrl}" style="width: 140px; height: 140px; display: block; margin: 0 auto;" alt="QR Code" />
            </div>

            <div style="font-size: 14px; font-weight: 900; letter-spacing: 2px; margin: 8px 0 4px 0; color: #ffffff; background: #18181b; padding: 6px 8px; border-radius: 6px; border: 1px solid #27272a;">
              ${pass.formattedCode}
            </div>

            <div style="font-size: 10px; text-transform: uppercase; color: #a1a1aa; margin-bottom: 10px;">
              LAST 4 DIGITS: <strong style="color: ${accentColor}; font-size: 12px;">${pass.code16.slice(-4)}</strong>
            </div>

            ${pass.assignedTo?.name ? `
              <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #333; font-size: 11px; font-weight: bold; color: ${textColor}; text-align: left;">
                ATTENDEE: <span style="color: ${accentColor};">${pass.assignedTo.name}</span>
              </div>
            ` : `
              <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #333; font-size: 11px; font-weight: bold; color: ${textColor}; text-align: left;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span>ATTENDEE:</span>
                  <span style="font-family: monospace; color: #71717a;">___________________</span>
                </div>
                <div style="font-size: 8px; color: #71717a; text-transform: uppercase; margin-top: 4px;">
                  (WRITE NAME MANUALLY OR SCAN QR)
                </div>
              </div>
            `}
          </div>
        `;
      }

      // Full Page Per Pass style
      return `
        <div class="pass-page" style="${index > 0 ? 'page-break-before: always; break-before: page;' : ''}">
          <div class="pass-card">
            <div style="font-size: 11px; font-weight: 900; letter-spacing: 3px; color: ${accentColor}; text-transform: uppercase; margin-bottom: 8px;">
              ${tagline}
            </div>

            <h1 style="font-size: 32px; font-weight: 900; text-transform: uppercase; margin: 0 0 8px 0; letter-spacing: -1px; color: ${textColor};">
              ${pass.eventName || headerTitle}
            </h1>

            <div style="font-size: 18px; font-weight: 900; text-transform: uppercase; color: ${accentColor}; margin-bottom: 20px; letter-spacing: 1px;">
              ${pass.category || subHeader}
            </div>

            <div class="qr-box">
              <img src="${qrDataUrl}" alt="QR Pass" />
            </div>

            <div style="display: block;">
              <div class="code-pill">${pass.formattedCode}</div>
            </div>

            <div style="font-size: 13px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">
              LAST 4 DIGITS: <strong style="color: ${accentColor}; font-size: 16px;">${pass.code16.slice(-4)}</strong>
            </div>

            <div class="attendee-box">
              ${pass.assignedTo?.name ? `
                <div style="color: #a1a1aa; font-size: 11px; text-transform: uppercase; margin-bottom: 4px;">OFFICIAL PASS HOLDER:</div>
                <div style="font-size: 22px; font-weight: 900; color: ${accentColor}; text-transform: uppercase;">${pass.assignedTo.name}</div>
                ${pass.assignedTo?.email ? `<div style="font-size: 12px; color: #71717a; font-family: monospace;">${pass.assignedTo.email}</div>` : ''}
              ` : `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size: 14px; font-weight: 900;">ATTENDEE:</span>
                  <span style="font-family: monospace; color: #71717a; font-size: 18px;">_________________________________</span>
                </div>
                <div style="font-size: 10px; color: #71717a; text-transform: uppercase; margin-top: 6px;">
                  (WRITE NAME MANUALLY WITH PEN OR SCAN QR CODE TO BIND NAME)
                </div>
              `}
            </div>

            <div style="margin-top: 30px; font-size: 10px; color: #71717a; text-transform: uppercase; border-top: 1px solid #27272a; padding-top: 15px;">
              ${termsText}
            </div>
          </div>
        </div>
      `;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>PassCraft AI Studio Batch Print (${filteredPasses.length} Passes - ${printFilterMode.toUpperCase()})</title>
          <style>
            @media print {
              body { margin: 0; padding: 0; background: ${backgroundColor} !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .no-print { display: none; }
            }
            body { 
              font-family: system-ui, -apple-system, sans-serif; 
              background: ${backgroundColor}; 
              color: ${textColor}; 
              margin: 0; 
              padding: 20px; 
              box-sizing: border-box;
            }
            .pass-page {
              min-height: 90vh;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              box-sizing: border-box;
              padding: 20px;
            }
            .pass-card {
              width: 100%;
              max-width: 600px;
              border: 3px solid ${accentColor};
              border-radius: 20px;
              padding: 36px;
              background: ${backgroundColor};
              text-align: center;
              box-sizing: border-box;
              box-shadow: 0 10px 30px rgba(0,0,0,0.8);
            }
            .qr-box {
              background: #ffffff;
              padding: 16px;
              border-radius: 12px;
              display: inline-block;
              margin: 16px 0;
            }
            .qr-box img {
              width: 200px;
              height: 200px;
              display: block;
            }
            .code-pill {
              font-family: monospace;
              font-size: 22px;
              font-weight: 900;
              letter-spacing: 3px;
              background: #18181b;
              color: #ffffff;
              padding: 10px 18px;
              border-radius: 10px;
              border: 1px solid #27272a;
              display: inline-block;
              margin-bottom: 12px;
            }
            .attendee-box {
              margin-top: 20px;
              padding-top: 16px;
              border-top: 2px dashed #333333;
              font-size: 15px;
              font-weight: bold;
              text-align: left;
            }
            .grid-container {
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom: 24px; text-align: center; background: #18181b; padding: 20px; border-radius: 12px; border: 1px solid #27272a; color: #ffffff;">
            <h2 style="margin: 0; font-size: 20px; text-transform: uppercase; color: ${accentColor}; font-weight: 900;">
              PassCraft AI Pass Studio - Batch Print Document
            </h2>
            <p style="margin: 6px 0 14px 0; font-size: 12px; color: #a1a1aa;">
              Printing <strong>${filteredPasses.length}</strong> passes in <strong>${printFilterMode.toUpperCase()}</strong> dataset filter using custom AI Theme settings.
            </p>
            <button onclick="window.print()" style="padding: 14px 28px; background: ${accentColor}; color: #000; font-weight: 900; font-size: 14px; border: none; border-radius: 8px; cursor: pointer; text-transform: uppercase; letter-spacing: 1px;">
              Print All ${filteredPasses.length} Passes / Save PDF
            </button>
          </div>

          <div class="${batchPrintLayout === 'grid' ? 'grid-container' : ''}">
            ${passesHtml}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 py-8 px-4">
      
      {/* Banner */}
      <div className="bg-neutral-900 border border-white/10 p-6 sm:p-10 text-white flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-2 block flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            // PASS STUDIO & EXPORT ENGINE
          </span>
          <h2 className="text-4xl sm:text-6xl font-black tracking-tighter uppercase leading-none">
            PASS STUDIO <span className={activePage === 'google-docs' ? 'text-blue-400' : activePage === 'google-forms' ? 'text-purple-400' : 'text-emerald-400'}>
              {activePage === 'google-docs' ? '& GOOGLE DOCS' : activePage === 'google-forms' ? '& GOOGLE FORMS' : '& EXPORT'}
            </span>
          </h2>
          <p className="text-xs font-bold uppercase tracking-widest text-neutral-400 max-w-xl mt-3 leading-relaxed">
            {activePage === 'google-docs'
              ? 'Export professional printable QR pass badge sheets, executive event summaries, and security check-in rosters directly to Google Docs with live Docs API synchronization.'
              : activePage === 'google-forms'
              ? 'Deploy live attendee registration forms and post-event attendee surveys with instant 1-click QR pass generation and auto-issuance into your event registry.'
              : 'Batch print all sheets or filter by All, Assigned, or Unassigned passes with custom themes. Export CSV data for Canva, Adobe, or external design tools, and print full-page badges with pen write lines!'}
          </p>
        </div>

        {activePage === 'designer' && (
          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 w-full md:w-auto">
            <button
              onClick={handlePrintBatchPasses}
              className="w-full sm:w-auto px-6 py-4 bg-emerald-400 text-black font-black text-xs uppercase tracking-widest hover:bg-white transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Printer className="w-5 h-5" />
              PRINT ALL MATCHING PASSES ({filteredPasses.length})
            </button>

            <button
              onClick={handleDownloadCanvaCsv}
              className="w-full sm:w-auto px-5 py-4 bg-white/10 hover:bg-white/20 text-white font-black text-xs uppercase tracking-widest border border-white/20 flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              EXPORT CSV ({filteredPasses.length})
            </button>
          </div>
        )}
      </div>

      {/* Sub-Page Navigation Tabs */}
      <div className="bg-neutral-900/90 border border-white/10 p-2 rounded-2xl flex flex-wrap gap-2 shadow-xl backdrop-blur-sm">
        <button
          id="pass-studio-page-designer"
          onClick={() => handleSwitchPage('designer')}
          className={`flex-1 min-w-[200px] flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
            activePage === 'designer'
              ? 'bg-emerald-400 text-black shadow-lg shadow-emerald-400/20'
              : 'text-neutral-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>Pass Designer &amp; Print</span>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${activePage === 'designer' ? 'bg-black/20 text-black' : 'bg-white/10 text-neutral-400'}`}>
            {passes.length} Passes
          </span>
        </button>

        <button
          id="pass-studio-page-google-docs"
          onClick={() => handleSwitchPage('google-docs')}
          className={`flex-1 min-w-[200px] flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
            activePage === 'google-docs'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              : 'text-neutral-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <FileText className="w-4 h-4 text-blue-400" />
          <span>Google Docs Export Hub</span>
          <span className={`text-[9px] font-mono px-2 py-0.5 rounded uppercase font-bold tracking-widest ${activePage === 'google-docs' ? 'bg-blue-800 text-blue-100' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
            Docs API
          </span>
        </button>

        <button
          id="pass-studio-page-google-forms"
          onClick={() => handleSwitchPage('google-forms')}
          className={`flex-1 min-w-[200px] flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
            activePage === 'google-forms'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
              : 'text-neutral-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <ClipboardList className="w-4 h-4 text-purple-400" />
          <span>Google Forms Registration Hub</span>
          <span className={`text-[9px] font-mono px-2 py-0.5 rounded uppercase font-bold tracking-widest ${activePage === 'google-forms' ? 'bg-purple-800 text-purple-100' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'}`}>
            Live RSVP
          </span>
        </button>
      </div>

      {/* Page: Google Docs Hub */}
      {activePage === 'google-docs' && (
        <GoogleDocsManager
          events={events}
          passes={passes}
          financials={financials}
          selectedEventId={selectedEventId}
          onSelectEvent={onSelectEvent}
          userEmail={userEmail}
        />
      )}

      {/* Page: Google Forms Hub */}
      {activePage === 'google-forms' && (
        <GoogleFormsManager
          events={events}
          passes={passes}
          selectedEventId={selectedEventId}
          onPassesUpdated={onPassesUpdated}
          onSelectEvent={onSelectEvent}
          userEmail={userEmail}
        />
      )}

      {/* Page: Pass Designer & Batch Print */}
      {activePage === 'designer' && (
        <>
          {/* Unified Studio Page Controls */}
          <div className="bg-white/5 border border-white/10 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 shrink-0">
            DATASET FILTER:
          </span>
          <div className="flex bg-neutral-900 p-1 border border-white/10 rounded-lg w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => setPrintFilterMode('all')}
              className={`px-4 py-2 font-black text-xs uppercase tracking-wider rounded-md transition-colors ${
                printFilterMode === 'all'
                  ? 'bg-emerald-400 text-black'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              ALL PASSES ({passes.length})
            </button>
            <button
              onClick={() => setPrintFilterMode('assigned')}
              className={`px-4 py-2 font-black text-xs uppercase tracking-wider rounded-md transition-colors ${
                printFilterMode === 'assigned'
                  ? 'bg-emerald-400 text-black'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              ASSIGNED ONLY ({assignedCount})
            </button>
            <button
              onClick={() => setPrintFilterMode('unassigned')}
              className={`px-4 py-2 font-black text-xs uppercase tracking-wider rounded-md transition-colors ${
                printFilterMode === 'unassigned'
                  ? 'bg-emerald-400 text-black'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              UNASSIGNED ONLY ({unassignedCount})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-end">
          <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
            LAYOUT:
          </span>
          <select
            value={batchPrintLayout}
            onChange={e => setBatchPrintLayout(e.target.value as any)}
            className="bg-neutral-900 border border-white/20 px-3 py-2 text-xs font-bold text-white uppercase focus:border-emerald-400 outline-none rounded-md"
          >
            <option value="full-page">1 PASS PER PAGE (FULL BADGE)</option>
            <option value="grid">4 PASSES PER PAGE (MULTI-CARD SHEET)</option>
          </select>
        </div>
      </div>

      {/* Main Grid: AI Controls on Left, Live Full-Page Preview on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: AI Designer & Customizer (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* AI Theme Generator Box */}
          <div className="bg-white/5 border border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-emerald-400" />
                AI PASS DESIGNER (POWERED BY GEMINI)
              </h3>
              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-400/10 px-2 py-0.5 border border-emerald-400/30 font-bold uppercase">
                AI ACTIVE
              </span>
            </div>

            <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-400 leading-relaxed">
              Describe your desired pass style or event vibe and Gemini AI will generate matching titles, taglines, and color palettes:
            </p>

            <div className="space-y-3">
              <input
                type="text"
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder="E.g. Cyberpunk VIP Summit in dark neon emerald"
                className="w-full bg-neutral-900 border border-white/20 p-3 font-mono text-xs text-white focus:border-emerald-400 outline-none uppercase placeholder:text-neutral-600"
              />

              {/* Preset Buttons */}
              <div className="flex flex-wrap gap-2">
                {[
                  'Dark Cyberpunk Neon',
                  'Royal Gold Executive',
                  'Minimalist Tech Black',
                  'Festival Lanyard'
                ].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setAiPrompt(preset);
                      handleGenerateAiDesign(preset);
                    }}
                    className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1.5 bg-white/5 hover:bg-emerald-400 hover:text-black text-neutral-300 border border-white/10 transition-colors"
                  >
                    + {preset}
                  </button>
                ))}
              </div>

              <button
                onClick={() => handleGenerateAiDesign()}
                disabled={isAiDesigning || !aiPrompt.trim()}
                className="w-full py-3 bg-emerald-400 text-black font-black text-xs uppercase tracking-widest hover:bg-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                {isAiDesigning ? 'AI CRAFTING PASS DESIGN...' : 'GENERATE AI PASS THEME'}
              </button>

              {aiStatus && (
                <p className="text-[10px] font-mono text-emerald-400 pt-1">
                  {aiStatus}
                </p>
              )}
            </div>
          </div>

          {/* Manual Theme Controls & Custom Dimensions */}
          <div className="bg-white/5 border border-white/10 p-6 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center justify-between border-b border-white/10 pb-3">
              <span className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-400" />
                CUSTOM FORMAT & BADGE SIZE
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-400/10 px-2 py-0.5 border border-emerald-400/30 font-bold uppercase rounded">
                AI SIZE-AWARE
              </span>
            </h3>

            <div className="space-y-4 text-xs">
              {/* Badge Size Presets */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">
                  BADGE SIZE PRESET
                </label>
                <select
                  value={badgePreset}
                  onChange={e => handlePresetChange(e.target.value as any)}
                  className="w-full bg-neutral-900 border border-white/20 p-2.5 font-bold text-white uppercase focus:border-emerald-400 outline-none rounded"
                >
                  <option value="lanyard-portrait">VERTICAL LANYARD BADGE (100mm × 150mm)</option>
                  <option value="standard-card">STANDARD CREDIT CARD BADGE (85.6mm × 53.9mm)</option>
                  <option value="lanyard-landscape">HORIZONTAL LANYARD BADGE (150mm × 100mm)</option>
                  <option value="square-badge">SQUARE EVENT BADGE (80mm × 80mm)</option>
                  <option value="wristband">VIP WRISTBAND / BAND (250mm × 25mm)</option>
                  <option value="a4-fullpage">FULL PAGE SHEET (210mm × 297mm / A4)</option>
                  <option value="custom">⚡ CUSTOM DIMENSIONS (USER SPECIFIED WIDTH × HEIGHT)</option>
                </select>
              </div>

              {/* Custom Size Width, Height & Unit Inputs */}
              <div className="bg-neutral-900 border border-white/10 p-3.5 space-y-3 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-emerald-400">
                    EXACT BADGE DIMENSIONS
                  </span>
                  <span className="text-[10px] font-mono text-neutral-400">
                    Aspect Ratio: {(customWidth / (customHeight || 1)).toFixed(2)}:1
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[9px] font-bold uppercase text-neutral-500 mb-1">WIDTH</label>
                    <input
                      type="number"
                      min="10"
                      max="1000"
                      value={customWidth}
                      onChange={e => {
                        setCustomWidth(parseFloat(e.target.value) || 10);
                        setBadgePreset('custom');
                      }}
                      className="w-full bg-neutral-950 border border-white/20 p-2 font-mono text-xs font-bold text-emerald-400 focus:border-emerald-400 outline-none rounded text-center"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold uppercase text-neutral-500 mb-1">HEIGHT</label>
                    <input
                      type="number"
                      min="10"
                      max="1000"
                      value={customHeight}
                      onChange={e => {
                        setCustomHeight(parseFloat(e.target.value) || 10);
                        setBadgePreset('custom');
                      }}
                      className="w-full bg-neutral-950 border border-white/20 p-2 font-mono text-xs font-bold text-emerald-400 focus:border-emerald-400 outline-none rounded text-center"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold uppercase text-neutral-500 mb-1">UNIT</label>
                    <select
                      value={customUnit}
                      onChange={e => setCustomUnit(e.target.value as any)}
                      className="w-full bg-neutral-950 border border-white/20 p-2 font-bold text-white text-xs focus:border-emerald-400 outline-none rounded"
                    >
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                      <option value="in">in</option>
                      <option value="px">px</option>
                    </select>
                  </div>
                </div>

                {/* AI Design Trigger button for this custom size */}
                <button
                  type="button"
                  onClick={() => handleGenerateAiDesign(`Craft pass design optimized specifically for ${customWidth}${customUnit} by ${customHeight}${customUnit} badge format`)}
                  disabled={isAiDesigning}
                  className="w-full py-2.5 bg-emerald-400/20 hover:bg-emerald-400 text-emerald-400 hover:text-black border border-emerald-400/40 font-black text-[10px] uppercase tracking-wider transition-colors flex items-center justify-center gap-2 rounded"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  GENERATE AI DESIGN FOR {customWidth}{customUnit} × {customHeight}{customUnit}
                </button>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Header Title</label>
                <input
                  type="text"
                  value={headerTitle}
                  onChange={e => setHeaderTitle(e.target.value)}
                  className="w-full bg-neutral-900 border border-white/20 p-2.5 font-bold text-white uppercase focus:border-emerald-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">SubHeader / Pass Tier</label>
                <input
                  type="text"
                  value={subHeader}
                  onChange={e => setSubHeader(e.target.value)}
                  className="w-full bg-neutral-900 border border-white/20 p-2.5 font-bold text-white uppercase focus:border-emerald-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Tagline</label>
                <input
                  type="text"
                  value={tagline}
                  onChange={e => setTagline(e.target.value)}
                  className="w-full bg-neutral-900 border border-white/20 p-2.5 font-bold text-white uppercase focus:border-emerald-400 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Background Color</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={backgroundColor}
                      onChange={e => setBackgroundColor(e.target.value)}
                      className="w-9 h-9 bg-transparent border-0 cursor-pointer shrink-0"
                    />
                    <input
                      type="text"
                      value={backgroundColor}
                      onChange={e => setBackgroundColor(e.target.value)}
                      className="w-full bg-neutral-900 border border-white/20 p-2 font-mono text-xs text-white uppercase"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Accent Color</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={e => setAccentColor(e.target.value)}
                      className="w-9 h-9 bg-transparent border-0 cursor-pointer shrink-0"
                    />
                    <input
                      type="text"
                      value={accentColor}
                      onChange={e => setAccentColor(e.target.value)}
                      className="w-full bg-neutral-900 border border-white/20 p-2 font-mono text-xs text-white uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Pass Target Selector */}
              <div className="pt-2 border-t border-white/10">
                <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Select Target Pass Preview</label>
                <select
                  value={selectedPassId}
                  onChange={e => setSelectedPassId(e.target.value)}
                  className="w-full bg-neutral-900 border border-white/20 p-2.5 font-bold text-white uppercase focus:border-emerald-400 outline-none"
                >
                  {passes.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.formattedCode} ({p.status.toUpperCase()}) - {p.assignedTo?.name || 'UNASSIGNED'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Live Full Pass Visual Preview (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white/5 border border-white/10 p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <Layout className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                  FULL-PAGE LIVE PASS PREVIEW
                </h3>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-400/10 px-2 py-0.5 border border-emerald-400/30 font-bold uppercase">
                BLACK BACKGROUND • HIGH-CONTRAST
              </span>
            </div>

            {/* Live Card Container */}
            <div 
              className="p-8 sm:p-12 rounded-2xl border-2 transition-all duration-300 text-center space-y-6 shadow-2xl relative overflow-hidden"
              style={{
                backgroundColor: backgroundColor,
                borderColor: accentColor,
                color: textColor,
              }}
            >
              {/* Top Banner Tagline */}
              <div 
                className="text-[10px] font-black uppercase tracking-[0.25em] mb-1"
                style={{ color: accentColor }}
              >
                {tagline}
              </div>

              {/* Main Event Title */}
              <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter leading-none">
                {headerTitle}
              </h2>

              {/* Pass Tier Subheader */}
              <div 
                className="text-base sm:text-lg font-black uppercase tracking-wider"
                style={{ color: accentColor }}
              >
                {subHeader}
              </div>

              {/* High Contrast White QR Box */}
              <div className="bg-white p-4 rounded-xl inline-block shadow-lg border border-neutral-200">
                <img 
                  src={generateQRDataURL(currentPass.code16)} 
                  alt="QR Code Pass" 
                  className="w-44 h-44 sm:w-52 sm:h-52 block mx-auto"
                />
              </div>

              {/* 16-Digit Code */}
              <div>
                <div className="bg-neutral-900 text-white font-mono font-black text-xl sm:text-2xl tracking-widest px-6 py-3 rounded-lg border border-neutral-800 inline-block shadow-inner">
                  {currentPass.formattedCode}
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-neutral-400 mt-2">
                  LAST 4 DIGITS: <span style={{ color: accentColor }} className="font-mono text-base font-black">{currentPass.code16.slice(-4)}</span>
                </p>
              </div>

              {/* Attendee Holder Box with Pen Write Line for Unassigned */}
              <div className="pt-5 border-t-2 border-dashed border-neutral-800 text-left space-y-2">
                {currentPass.assignedTo?.name ? (
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">
                      OFFICIAL ATTENDEE:
                    </span>
                    <span className="text-xl sm:text-2xl font-black uppercase tracking-tight" style={{ color: accentColor }}>
                      {currentPass.assignedTo.name}
                    </span>
                    {currentPass.assignedTo.email && (
                      <span className="text-xs font-mono text-neutral-500 block">
                        {currentPass.assignedTo.email}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black uppercase tracking-wider">ATTENDEE:</span>
                      <span className="font-mono text-neutral-500 font-bold text-base">________________________________</span>
                    </div>
                    <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-tight">
                      (WRITE NAME MANUALLY WITH PEN OR SCAN QR CODE TO BIND)
                    </p>
                  </div>
                )}
              </div>

              {/* Terms Footer */}
              <p className="text-[9px] text-neutral-500 uppercase tracking-widest pt-4 border-t border-neutral-900">
                {termsText}
              </p>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <button
                onClick={handlePrintBatchPasses}
                className="w-full sm:w-auto px-6 py-4 bg-emerald-400 text-black font-black text-xs uppercase tracking-widest hover:bg-white transition-colors flex items-center justify-center gap-2"
              >
                <Printer className="w-5 h-5" />
                PRINT ALL {filteredPasses.length} MATCHING PASSES
              </button>

              <button
                onClick={handlePrintSinglePass}
                className="w-full sm:w-auto px-5 py-4 bg-white/10 hover:bg-white/20 text-white font-black text-xs uppercase tracking-widest border border-white/20 flex items-center justify-center gap-2 transition-colors"
              >
                <Printer className="w-4 h-4 text-emerald-400" />
                PRINT SELECTED PASS ONLY
              </button>

              <button
                onClick={handleDownloadCanvaCsv}
                className="w-full sm:w-auto px-5 py-4 bg-white/10 hover:bg-white/20 text-white font-black text-xs uppercase tracking-widest border border-white/20 flex items-center justify-center gap-2 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                EXPORT CSV ({filteredPasses.length})
              </button>
            </div>

          </div>

          {/* Canva Bulk Integration Guide */}
          <div className="bg-white/5 border border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-xs uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                <Palette className="w-4 h-4" />
                CANVA BULK CREATE FIELD MAPPING GUIDE
              </h4>
              <a
                href="https://www.canva.com"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] font-bold uppercase tracking-widest text-white hover:text-emerald-400 flex items-center gap-1"
              >
                OPEN CANVA <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              Use Canva's <strong>Bulk Create</strong> feature to inject all {passes.length} 16-digit pass codes and high-res QR image URLs into your custom Canva templates in seconds:
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                '{{AttendeeName}}',
                '{{PassCode}}',
                '{{Last4Digits}}',
                '{{QRCodeURL}}',
              ].map(tag => (
                <button
                  key={tag}
                  onClick={() => handleCopyTag(tag)}
                  className="p-2.5 bg-neutral-900 border border-white/10 hover:border-emerald-400 text-left font-mono text-xs font-bold text-white flex items-center justify-between transition-colors"
                >
                  <span className="truncate">{tag}</span>
                  {copiedTag === tag ? <Check className="w-3 h-3 text-emerald-400 shrink-0" /> : <Copy className="w-3 h-3 text-neutral-500 shrink-0" />}
                </button>
              ))}
            </div>
          </div>

        </div>

      </div>
        </>
      )}

    </div>
  );
};
