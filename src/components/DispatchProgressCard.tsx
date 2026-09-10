import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Sparkles, 
  Mail, 
  Clock, 
  Users,
  X
} from 'lucide-react';

export interface DispatchProgressState {
  isActive: boolean;
  phase: 'idle' | 'drafting' | 'sending' | 'completed' | 'failed';
  currentStep: 1 | 2;
  totalSteps: 1 | 2;
  
  // Step 1: Drafting Phase Counters (Only when totalSteps === 2 / draft_all_send)
  draftsCreated: number;
  draftsLeft: number;
  draftsTotal: number;

  // Step 2: Sending Phase Counters
  sentCount: number;
  toBeSentCount: number;
  failedCount: number;
  totalToSend: number;

  // Live Processing Item
  currentName?: string;
  currentEmail?: string;
  statusText?: string;
  percent: number;
}

interface DispatchProgressCardProps {
  progress: DispatchProgressState;
  accentColor?: string; // e.g. 'indigo' | 'rose' | 'emerald'
  title?: string;
  onDismiss?: () => void;
}

export const DispatchProgressCard: React.FC<DispatchProgressCardProps> = ({
  progress,
  accentColor = 'indigo',
  title = 'Email Transmission Hub',
  onDismiss
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(30);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  const onDismissRef = React.useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  const isTwoPhase = progress.totalSteps === 2;
  const isStep1 = isTwoPhase && (progress.currentStep === 1 || progress.phase === 'drafting');
  const isStep2 = (!isTwoPhase) || progress.currentStep === 2 || progress.phase === 'sending';
  const isDone = progress.phase === 'completed';
  const isFailed = progress.phase === 'failed';
  const isFinished = isDone || isFailed;

  // 30-Second Auto-dismiss timer after completion
  useEffect(() => {
    if (!progress.isActive || !isFinished) {
      setSecondsRemaining(30);
      setIsDismissed(false);
      return;
    }

    setSecondsRemaining(30);
    setIsDismissed(false);

    // Visual second countdown (pure state update, no external callbacks)
    const interval = setInterval(() => {
      setSecondsRemaining(prev => Math.max(0, prev - 1));
    }, 1000);

    // Auto-dismiss after 30 seconds (runs asynchronously outside render phase)
    const timer = setTimeout(() => {
      setIsDismissed(true);
      onDismissRef.current?.();
    }, 30000);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [progress.isActive, isFinished]);

  if (!progress.isActive || progress.phase === 'idle' || isDismissed) {
    return null;
  }

  // Compute clean display percentage
  const step1Percent = progress.draftsTotal > 0
    ? Math.min(100, Math.round((progress.draftsCreated / progress.draftsTotal) * 100))
    : 0;

  const step2Percent = progress.totalToSend > 0
    ? Math.min(100, Math.round(((progress.sentCount + progress.failedCount) / progress.totalToSend) * 100))
    : 0;

  const currentPercent = isStep1 ? step1Percent : (progress.percent || step2Percent);

  const handleManualDismiss = () => {
    setIsDismissed(true);
    onDismissRef.current?.();
  };

  return (
    <div 
      id="dispatch-progress-hub" 
      className="bg-slate-950 border-2 border-indigo-500/40 rounded-3xl p-5 md:p-6 shadow-2xl space-y-5 animate-fadeIn transition-all"
    >
      {/* Header & Overall Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            {isDone ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 animate-bounce" />
            ) : isFailed ? (
              <AlertCircle className="w-5 h-5 text-rose-400" />
            ) : (
              <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
            )}
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-indigo-400 font-mono">
              Live Automated Dispatch Engine
            </div>
            <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
              {isDone ? '🎉 Email Dispatch Completed!' : isFailed ? '⚠️ Dispatch Encountered Issues' : title}
            </h3>
          </div>
        </div>

        {/* Step Indicator Badges / Auto-dismiss counter */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* If TWO-PHASE (draft_all_send): Show "1. Making Drafts" -> "2. Sending via Gmail" */}
          {isTwoPhase ? (
            <>
              {/* Step 1 Pill */}
              <div 
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all ${
                  isStep1
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-md shadow-cyan-500/10 animate-pulse'
                    : progress.draftsCreated >= progress.draftsTotal && progress.draftsTotal > 0
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-900 text-slate-500 border border-slate-800'
                }`}
              >
                {progress.draftsCreated >= progress.draftsTotal && progress.draftsTotal > 0 ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <FileText className="w-3.5 h-3.5" />
                )}
                <span>1. Making Drafts</span>
              </div>

              <span className="text-slate-600 font-mono text-xs">&rarr;</span>

              {/* Step 2 Pill */}
              <div 
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all ${
                  isStep2 && !isDone
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-md shadow-indigo-500/10 animate-pulse'
                    : isDone
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-900 text-slate-500 border border-slate-800'
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>2. Sending via Gmail</span>
              </div>
            </>
          ) : (
            /* If SINGLE-PHASE (gap_1.5, gap_3, gap_5, or test): ONLY SHOW "Sending via Gmail" */
            <div 
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold font-mono transition-all ${
                isDone
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : isFailed
                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-md shadow-indigo-500/10 animate-pulse'
              }`}
            >
              {isDone ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : isFailed ? (
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>{isDone ? 'Delivered via Gmail' : 'Sending via Gmail'}</span>
            </div>
          )}

          {/* 30s Auto-dismiss badge & close button when finished */}
          {isFinished && (
            <button
              type="button"
              onClick={handleManualDismiss}
              title="Dismiss status banner"
              className="flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white rounded-xl text-[11px] font-mono transition-all cursor-pointer ml-1"
            >
              <Clock className="w-3 h-3 text-indigo-400" />
              <span>Closes in {secondsRemaining}s</span>
              <X className="w-3 h-3 ml-0.5 text-slate-500 hover:text-white" />
            </button>
          )}
        </div>
      </div>

      {/* PHASE 1: DRAFTING NUMERICAL METRICS (Only when totalSteps === 2 and currently drafting) */}
      {isTwoPhase && isStep1 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] font-black uppercase text-cyan-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Step 1 of 2: Generating & Pre-Drafting Email Templates
            </span>
            <span className="font-mono font-bold text-white bg-slate-900 px-2.5 py-0.5 rounded-lg border border-slate-800">
              {progress.draftsCreated} of {progress.draftsTotal} Drafted ({step1Percent}%)
            </span>
          </div>

          {/* Metric Counter Chips */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 font-mono">
            <div className="bg-cyan-950/40 border border-cyan-500/30 p-3 rounded-2xl text-center">
              <div className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider">Drafts Created</div>
              <div className="text-2xl font-black text-white mt-0.5">{progress.draftsCreated}</div>
            </div>

            <div className="bg-amber-950/30 border border-amber-500/30 p-3 rounded-2xl text-center">
              <div className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">Drafts Left</div>
              <div className="text-2xl font-black text-amber-200 mt-0.5">{progress.draftsLeft}</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl text-center">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Queue</div>
              <div className="text-2xl font-black text-slate-300 mt-0.5">{progress.draftsTotal}</div>
            </div>
          </div>
        </div>
      )}

      {/* PHASE 2 / DIRECT TRANSMISSION NUMERICAL METRICS */}
      {(!isTwoPhase || isStep2 || isDone || isFailed) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] font-black uppercase text-indigo-400 flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-indigo-400" />
              {isTwoPhase ? 'Step 2 of 2: Dispatching Emails via Gmail SMTP' : 'Dispatching Emails via Gmail SMTP'}
            </span>
            <span className="font-mono font-bold text-white bg-slate-900 px-2.5 py-0.5 rounded-lg border border-slate-800">
              {progress.sentCount} of {progress.totalToSend} Sent ({step2Percent}%)
            </span>
          </div>

          {/* Metric Counter Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 font-mono">
            <div className="bg-emerald-950/40 border border-emerald-500/30 p-3 rounded-2xl text-center">
              <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Sent</div>
              <div className="text-2xl font-black text-emerald-300 mt-0.5">{progress.sentCount}</div>
            </div>

            <div className="bg-indigo-950/40 border border-indigo-500/30 p-3 rounded-2xl text-center">
              <div className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">To Be Sent</div>
              <div className="text-2xl font-black text-indigo-200 mt-0.5">{progress.toBeSentCount}</div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl text-center">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Emails</div>
              <div className="text-2xl font-black text-slate-300 mt-0.5">{progress.totalToSend}</div>
            </div>

            <div className={`border p-3 rounded-2xl text-center ${
              progress.failedCount > 0 
                ? 'bg-rose-950/50 border-rose-500/40 text-rose-300' 
                : 'bg-slate-900/50 border-slate-800 text-slate-500'
            }`}>
              <div className="text-[10px] font-bold uppercase tracking-wider">Failed</div>
              <div className={`text-2xl font-black mt-0.5 ${progress.failedCount > 0 ? 'text-rose-400' : 'text-slate-600'}`}>
                {progress.failedCount}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PROGRESS BAR */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-xs font-mono">
          <span className="text-slate-300 font-medium truncate max-w-[80%] flex items-center gap-1.5">
            {isDone ? (
              <span className="text-emerald-400 font-bold">✨ All {progress.sentCount} emails successfully delivered to inboxes!</span>
            ) : isFailed && progress.sentCount === 0 ? (
              <span className="text-rose-400 font-bold">❌ Transmission failed. Please verify credentials.</span>
            ) : (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-indigo-400 shrink-0" />
                <span className="truncate">
                  {progress.statusText || (isStep1 ? 'Compiling personalized tags & QR codes...' : 'Transmitting via Gmail App Password...')}
                </span>
              </>
            )}
          </span>
          <span className="font-bold font-mono text-white shrink-0">
            {currentPercent}%
          </span>
        </div>

        <div className="w-full bg-slate-900 border border-slate-800 rounded-full h-3 overflow-hidden p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-300 shadow-lg ${
              isStep1
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500'
                : isDone
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600'
            }`}
            style={{ width: `${Math.max(4, currentPercent)}%` }}
          />
        </div>
      </div>

      {/* CURRENT ATTENDEE BADGE (While active and not done) */}
      {!isDone && !isFailed && (progress.currentName || progress.currentEmail) && (
        <div className="bg-slate-900/90 border border-slate-800 px-3.5 py-2.5 rounded-2xl flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2 truncate">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping shrink-0" />
            <span className="text-slate-400">Target Attendee:</span>
            <span className="text-white font-bold truncate">{progress.currentName}</span>
            {progress.currentEmail && (
              <span className="text-indigo-400 text-[11px] truncate">&lt;{progress.currentEmail}&gt;</span>
            )}
          </div>
          <span className="text-[10px] font-bold uppercase text-slate-500 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800 shrink-0">
            {isStep1 ? 'Drafting' : 'Sending'}
          </span>
        </div>
      )}
    </div>
  );
};

export default DispatchProgressCard;
