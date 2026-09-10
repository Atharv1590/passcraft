import React, { useState } from 'react';
import { EventItem, PassItem, TicketTierConfig } from '../types';
import { 
  BookOpen, 
  Sparkles, 
  PlusCircle, 
  CheckCircle2, 
  QrCode, 
  Users, 
  Mail, 
  Send, 
  ShieldCheck, 
  Palette, 
  ScanLine, 
  ArrowRight,
  Lightbulb,
  PlayCircle,
  Clock,
  Layers,
  Zap,
  Check,
  Trash2,
  HelpCircle,
  Bot,
  MessageSquare,
  Key,
  ExternalLink,
  ChevronRight,
  Info,
  Building2,
  DollarSign
} from 'lucide-react';

interface DemoGuidePageProps {
  events: EventItem[];
  onAddEvent: (event: EventItem) => void;
  onAddPasses?: (passes: PassItem[]) => void;
  onAddFinancials?: (financials: any[]) => void;
  onClearDemoData?: () => void;
  onSelectEvent: (eventId: string) => void;
  onNavigateToTab?: (tab: string) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

const FIRST_NAMES = [
  'Aarav', 'Ananya', 'Rohan', 'Priya', 'Aditya', 'Isha', 'Vikram', 'Sneha',
  'Alex', 'Jordan', 'Taylor', 'Morgan', 'Sam', 'Chris', 'David', 'Emma',
  'Liam', 'Olivia', 'Noah', 'Sophia', 'Ethan', 'Isabella', 'Lucas', 'Mia'
];

const LAST_NAMES = [
  'Sharma', 'Patel', 'Verma', 'Rao', 'Deshmukh', 'Mehta', 'Joshi', 'Kulkarni',
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Wilson'
];

const DEPARTMENTS = [
  'Computer Science', 'Data Science & AI', 'Electrical Engineering', 
  'Mechanical Eng.', 'Business Administration', 'Design & Media'
];

export const DemoGuidePage: React.FC<DemoGuidePageProps> = ({
  events,
  onAddEvent,
  onAddPasses,
  onAddFinancials,
  onClearDemoData,
  onSelectEvent,
  onNavigateToTab
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSuccess, setGeneratedSuccess] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  // AI Assistant Chat State
  const [userQuery, setUserQuery] = useState('');
  const [isAiAnswering, setIsAiAnswering] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      sender: 'assistant',
      text: "👋 Hi! I am your Intelligent PassCraft Assistant. Ask me anything about how to use the app, connecting your Gmail, generating QR passes, multi-day event gate scanning, or managing finances!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const handleAskAssistant = async (queryToAsk?: string) => {
    const question = (queryToAsk || userQuery).trim();
    if (!question || isAiAnswering) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: question,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, userMsg]);
    setUserQuery('');
    setIsAiAnswering(true);

    try {
      const res = await fetch('/api/gemini/app-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();

      const assistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: data.answer || "I'm sorry, I could not generate an answer right now. Please try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setChatMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      setChatMessages(prev => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          sender: 'assistant',
          text: "⚠️ Connection error while reaching the AI assistant. Please check your network and try again.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsAiAnswering(false);
    }
  };

  // Instant Demo Event Loader
  const handleGenerateDemoEvent = () => {
    setIsGenerating(true);

    try {
      const demoEventId = `demo-evt-${Date.now()}`;
      const demoEventTitle = '🎓 University Tech & Innovation Fest 2026';
      
      const today = new Date();
      today.setDate(today.getDate() + 14);
      const eventDate = today.toISOString().split('T')[0];

      const demoTiers: TicketTierConfig[] = [
        {
          id: `tier-demo-1-${Date.now()}`,
          categoryName: 'VIP Delegate Pass',
          price: 999,
          color: '#eab308',
          description: 'Access to VIP lounges, keynote front row, and networking luncheon',
          capacity: 50
        },
        {
          id: `tier-demo-2-${Date.now()}`,
          categoryName: 'Student Early Bird',
          price: 299,
          color: '#10b981',
          description: 'Access to keynote sessions, project expo, and lunch coupon',
          capacity: 200
        },
        {
          id: `tier-demo-3-${Date.now()}`,
          categoryName: 'Hackathon Competitor',
          price: 499,
          color: '#06b6d4',
          description: '36-hour arena entry, high-speed Wi-Fi, food and swags kit',
          capacity: 100
        }
      ];

      const newEvent: EventItem = {
        id: demoEventId,
        title: demoEventTitle,
        date: eventDate,
        time: '09:00 AM',
        commencementTime: '09:00 AM',
        endTime: '06:00 PM',
        location: 'Main Auditorium & Innovation Center, Silicon Campus',
        organizer: 'PassCraft University Tech Council',
        tagline: 'Official All-Access Delegate & Competitor Pass',
        description: 'National Level Technical Symposium, Hackathon & Leadership Summit',
        category: 'Tech Summit & Hackathon',
        createdAt: new Date().toISOString(),
        themeColor: '#059669',
        status: 'active',
        dressCode: 'Smart Casual / University ID',
        ticketTiers: demoTiers
      };

      onAddEvent(newEvent);
      onSelectEvent(demoEventId);

      // Generate 12 realistic attendees with passes
      const createdPasses: PassItem[] = [];
      for (let i = 1; i <= 12; i++) {
        const tier = demoTiers[(i - 1) % demoTiers.length];
        const firstName = FIRST_NAMES[(i * 3) % FIRST_NAMES.length];
        const lastName = LAST_NAMES[(i * 5) % LAST_NAMES.length];
        const dept = DEPARTMENTS[i % DEPARTMENTS.length];
        const rawCode = `8800${String(1000 + i).padStart(4, '0')}${String(5000 + i * 17).padStart(4, '0')}9921`.substring(0, 16);
        const formattedCode = `${rawCode.substring(0, 4)}-${rawCode.substring(4, 8)}-${rawCode.substring(8, 12)}-${rawCode.substring(12, 16)}`;

        const isAssigned = i <= 9;
        const isCheckedIn = i <= 3;

        createdPasses.push({
          id: `pass-demo-${demoEventId}-${i}`,
          code16: rawCode,
          formattedCode,
          eventId: demoEventId,
          eventName: demoEventTitle,
          eventDate,
          eventTime: '09:00 AM',
          commencementTime: '09:00 AM',
          endTime: '06:00 PM',
          eventLocation: 'Main Auditorium & Innovation Center, Silicon Campus',
          category: tier.categoryName,
          ticketPrice: tier.price,
          status: isCheckedIn ? 'checked_in' : isAssigned ? 'assigned' : 'unassigned',
          themeColor: tier.color || '#059669',
          createdAt: new Date().toISOString(),
          checkedInAt: isCheckedIn ? new Date(Date.now() - (4 - i) * 1800000).toISOString() : undefined,
          assignedTo: isAssigned ? {
            name: `${firstName} ${lastName}`,
            email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.edu`,
            phone: `+91 98${String(10000000 + i * 234567).substring(0, 8)}`,
            idNumber: `TC-${202600 + i}`,
            notes: `Dept: ${dept}`,
            assignedAt: new Date(Date.now() - (15 - i) * 3600000).toISOString(),
          } : undefined
        });
      }

      if (onAddPasses) {
        onAddPasses(createdPasses);
      }

      // Add Sample Financial Expenses
      if (onAddFinancials) {
        const demoFinancials = [
          {
            id: `fin-demo-${Date.now()}-1`,
            type: 'expense' as const,
            title: 'Auditorium Audio/Visual & Stage Lighting Setup',
            amount: 14500,
            category: 'Audio / Visual & Stage',
            date: eventDate,
            time: '08:00',
            createdAt: new Date().toISOString(),
            eventId: demoEventId,
            vendorName: 'Apex Pro Sound & Lightings',
            notes: 'Stage LED screens, microphones & audio console setup'
          },
          {
            id: `fin-demo-${Date.now()}-2`,
            type: 'expense' as const,
            title: 'Lanyard Badge Printing & Delegate Kits',
            amount: 6800,
            category: 'Printing & Badges',
            date: eventDate,
            time: '09:30',
            createdAt: new Date().toISOString(),
            eventId: demoEventId,
            vendorName: 'Express Print Hub',
            notes: 'High-density plastic lanyards and holographic ID sleeves'
          }
        ];
        onAddFinancials(demoFinancials);
      }

      setGeneratedSuccess(`🎉 Demo Event Loaded! "${demoEventTitle}" with 12 passes & financial entries created.`);
      setTimeout(() => setGeneratedSuccess(null), 6000);
    } catch (err: any) {
      alert(`Error loading demo data: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClear = () => {
    if (confirm('Are you sure you want to clear all loaded demo sandbox data?')) {
      setIsClearing(true);
      if (onClearDemoData) {
        onClearDemoData();
      }
      setTimeout(() => {
        setIsClearing(false);
        setGeneratedSuccess('🧹 Sandbox demo data cleared successfully.');
        setTimeout(() => setGeneratedSuccess(null), 3000);
      }, 400);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 py-6 px-4 animate-fadeIn">
      
      {/* HEADER HERO */}
      <div className="bg-slate-900 border border-slate-800 p-6 md:p-8 rounded-3xl relative overflow-hidden shadow-2xl">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-mono uppercase tracking-widest rounded-full flex items-center gap-1.5 font-bold">
                <BookOpen className="w-3.5 h-3.5" /> APP DEMO, WALKTHROUGH & AI ASSISTANT
              </span>
              <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono uppercase rounded-full font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Interactive
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tight">
              HOW TO USE <span className="text-indigo-400">PASSCRAFT</span>
            </h1>
            <p className="text-xs md:text-sm text-slate-300 max-w-2xl mt-2 leading-relaxed">
              Step-by-step master guide on connecting your Gmail, creating events with custom colors, issuing QR passes, running the gate scanner, and asking our integrated AI assistant any questions.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={handleGenerateDemoEvent}
              disabled={isGenerating}
              className="px-5 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isGenerating ? <Zap className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
              LOAD READY-TO-TEST DEMO DATA
            </button>

            {onClearDemoData && (
              <button
                onClick={handleClear}
                disabled={isClearing}
                className="px-4 py-3.5 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-rose-400 border border-slate-800 text-xs font-bold uppercase tracking-wider rounded-2xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                title="Clear demo data"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Demo Data
              </button>
            )}
          </div>
        </div>

        {generatedSuccess && (
          <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span className="font-medium">{generatedSuccess}</span>
          </div>
        )}
      </div>

      {/* SECTION 1: CONNECT GMAIL TUTORIAL (CRITICAL GUIDE) */}
      <div className="bg-gradient-to-br from-slate-900 to-indigo-950/40 border-2 border-indigo-500/30 p-6 md:p-8 rounded-3xl shadow-xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase font-bold text-indigo-400 tracking-wider">CRITICAL SETUP</span>
            <h2 className="text-xl md:text-2xl font-black text-white">How to Connect Gmail &amp; Enable Cloud Storage</h2>
          </div>
        </div>

        <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
          Connecting your Gmail account unlocks <strong>real-time cross-device cloud persistence</strong>, <strong>automated email ticket delivery with QR codes</strong>, and <strong>post-event Thank You email broadcasts</strong>.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-indigo-400 font-mono text-xs font-bold">
              <span className="w-6 h-6 rounded-full bg-indigo-600/30 border border-indigo-500 flex items-center justify-center text-white">1</span>
              CLICK CONNECT GMAIL
            </div>
            <p className="text-xs text-slate-400">
              Click the <strong>"Connect Gmail"</strong> button with the cloud icon located in the top navigation bar.
            </p>
          </div>

          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-indigo-400 font-mono text-xs font-bold">
              <span className="w-6 h-6 rounded-full bg-indigo-600/30 border border-indigo-500 flex items-center justify-center text-white">2</span>
              GET 16-CHAR APP PASSWORD
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Open your <strong>Google Account &gt; Security &gt; 2-Step Verification &gt; App Passwords</strong>. Generate a 16-letter code for "PassCraft".
            </p>
          </div>

          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-indigo-400 font-mono text-xs font-bold">
              <span className="w-6 h-6 rounded-full bg-indigo-600/30 border border-indigo-500 flex items-center justify-center text-white">3</span>
              PASTE &amp; VERIFY
            </div>
            <p className="text-xs text-slate-400">
              Paste your Gmail and the 16-letter App Password. Click <strong>Verify &amp; Connect</strong>. Your entire system is now live!
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 2: 4-STEP MASTER WALKTHROUGH */}
      <div className="space-y-4">
        <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-400" /> Complete Workflow Guide
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Step 1 */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-mono font-bold rounded-xl">
                STEP 01
              </span>
              <Building2 className="w-5 h-5 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-white">Create Events &amp; Pick Custom Colors</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Go to the <strong>Event Directory</strong> tab. Set the event name, date, and <strong>duration in days</strong> (1 Day, 2 Days, 3 Days). Choose from 12 curated color presets or click the color picker square to select any custom hex accent color.
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono font-bold rounded-xl">
                STEP 02
              </span>
              <QrCode className="w-5 h-5 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-white">Generate &amp; Assign Passes</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Under <strong>Passes Registry</strong>, generate batches of unique 16-digit QR passes. Assign them individually or import your attendees in bulk with names, emails, and phone numbers.
            </p>
          </div>

          {/* Step 3 */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 bg-sky-500/10 text-sky-400 border border-sky-500/20 text-xs font-mono font-bold rounded-xl">
                STEP 03
              </span>
              <ScanLine className="w-5 h-5 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-white">Gate Scanner &amp; 1-Ticket 1-Entry Rule</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Open <strong>Gate Scanner</strong>. Turn on the camera to scan tickets. 1st scan plays a pleasant chime and grants admission. Scanning the same ticket again triggers a <strong>bold red "ENTRY DONE"</strong> rejection alert. For multi-day events, use the Day selector.
            </p>
          </div>

          {/* Step 4 */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs font-mono font-bold rounded-xl">
                STEP 04
              </span>
              <DollarSign className="w-5 h-5 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-white">Email Dispatch &amp; FLAP Desk Financials</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Send branded tickets and thank-you notes using <strong>Email Tickets</strong>. Track automatic ticket revenues, vendor expenses, and net profit margins inside <strong>FLAP Desk</strong>.
            </p>
          </div>

        </div>
      </div>

      {/* SECTION 3: INTELLIGENT AI APP ASSISTANT */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl">
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600/20 border border-indigo-500 flex items-center justify-center text-indigo-400 shadow-lg shadow-indigo-600/20">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white">Intelligent AI Support Assistant</h2>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-mono uppercase font-bold rounded-full">
                  ONLINE
                </span>
              </div>
              <p className="text-xs text-slate-400">Ask any question on how to use PassCraft or configure features</p>
            </div>
          </div>

          {/* Quick FAQ Chips */}
          <div className="flex gap-2 flex-wrap">
            {[
              'How to connect Gmail?',
              'How does 1-ticket 1-entry work?',
              'How do multi-day events work?',
              'How to choose custom colors?'
            ].map(q => (
              <button
                key={q}
                onClick={() => handleAskAssistant(q)}
                className="px-3 py-1.5 bg-slate-950 hover:bg-indigo-950/60 border border-slate-800 hover:border-indigo-500/50 text-slate-300 hover:text-white text-xs font-semibold rounded-xl transition-all cursor-pointer"
              >
                💬 {q}
              </button>
            ))}
          </div>
        </div>

        {/* Chat History Container */}
        <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 md:p-6 space-y-4 max-h-96 overflow-y-auto">
          {chatMessages.map(msg => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'assistant' && (
                <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0 mt-1">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div
                className={`max-w-2xl p-4 rounded-2xl text-xs md:text-sm leading-relaxed whitespace-pre-line ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-none shadow-md shadow-indigo-600/30'
                    : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none'
                }`}
              >
                {msg.text}
                <div className={`text-[9px] font-mono mt-2 text-right ${msg.sender === 'user' ? 'text-indigo-200' : 'text-slate-500'}`}>
                  {msg.timestamp}
                </div>
              </div>
            </div>
          ))}

          {isAiAnswering && (
            <div className="flex gap-3 justify-start items-center">
              <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
                <Bot className="w-4 h-4 animate-spin" />
              </div>
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl text-xs text-indigo-300 font-mono flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                Thinking and compiling answer...
              </div>
            </div>
          )}
        </div>

        {/* Chat Input */}
        <form
          onSubmit={e => {
            e.preventDefault();
            handleAskAssistant();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={userQuery}
            onChange={e => setUserQuery(e.target.value)}
            placeholder="Type your question (e.g. 'How do I export PDF reports?' or 'Explain duplicate scan rule')..."
            className="flex-1 bg-slate-950 border border-slate-700/80 focus:border-indigo-500 rounded-2xl px-4 py-3 text-white text-xs md:text-sm outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={!userQuery.trim() || isAiAnswering}
            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Send className="w-4 h-4" /> Ask AI
          </button>
        </form>
      </div>

    </div>
  );
};
