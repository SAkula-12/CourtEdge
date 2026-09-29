"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMatchStore } from "@/stores/matchStore";
import { PointClassification } from "@/models/types";
import { Undo2, CheckCircle2, ArrowRight, Check, X, RotateCcw, Trophy, Save, Mic, MicOff, MessageSquare, PauseCircle, CloudRain, ChevronDown, ArrowLeftRight, QrCode, Send, ArrowLeft } from "lucide-react";
import { CriticalPointFlags } from "./CriticalPointFlags";
import { PressurePrompt } from "./PressurePrompt";
import { NotesPanel } from "./NotesPanel";
import { SyncIndicator } from "./SyncIndicator";
import { FlaggedPointsSummary } from "./FlaggedPointsSummary";
import { NotesLog } from "./NotesLog";
import { FinishMatchModal } from "./FinishMatchModal";
import { MatchShareQR } from "@/components/share/MatchShareQR";
import { GuestMatchTransferUI } from "./GuestMatchTransferUI";
import { triggerHaptic } from "@/lib/haptics";

/* ---------- Quick Tags Array (Specification 1) ---------- */

export const QUICK_TAGS = [
  '#ForehandMiss',
  '#DeepReturn',
  '#DoubleFault',
  '#NetApproach',
  '#Winner',
  '#UnforcedError',
] as const;

/* ---------- Voice-to-Text Tennis Vocabulary Helpers ---------- */

const TENNIS_VOCAB: Record<string, string> = {
  'juice': 'deuce',
  'add out': 'ad-out',
  'ad out': 'ad-out',
  'add in': 'ad-in',
  'ad in': 'ad-in',
  'four hand': 'forehand',
  'for hand': 'forehand',
  'back hand': 'backhand',
  'unforced error': 'unforced error',
  'un forced error': 'unforced error',
  'four hand slice': 'forehand slice',
  'for hand slice': 'forehand slice',
  'double fault': 'double fault',
  'brick point': 'break point',
  'set point': 'set point',
  'match point': 'match point',
  'ace': 'ace',
  'let': 'let',
  'net': 'net',
  'love': 'love',
};

function processTennisVocab(text: string): string {
  let processed = text;
  for (const [wrong, right] of Object.entries(TENNIS_VOCAB)) {
    const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
    processed = processed.replace(regex, right);
  }
  return processed;
}

/* ---------- Voice Notes Input & Tag Shortcuts Component ---------- */

export function PointNoteInput() {
  const pendingPointNote = useMatchStore((s) => s.pendingPointNote);
  const setPointNote = useMatchStore((s) => s.setPointNote);

  // Specification 2: State Unification — both SpeechRecognition transcript and mobile keyboard feed into noteText
  const [noteText, setNoteText] = useState(pendingPointNote || "");
  const [interimText, setInterimText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const interimTextRef = useRef("");

  // Sync internal state when external store changes (e.g., cleared after point confirmation)
  useEffect(() => {
    setNoteText(pendingPointNote || "");
  }, [pendingPointNote]);

  // Web Speech API initialization
  useEffect(() => {
    if (typeof window === "undefined") return;

    const win = window as any;
    const SpeechRecognitionClass =
      win.SpeechRecognition || win.webkitSpeechRecognition;

    if (SpeechRecognitionClass) {
      setIsSupported(true);
      const rec = new SpeechRecognitionClass();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      rec.onresult = (event: any) => {
        let finalChunk = "";
        let interimChunk = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalChunk += event.results[i][0].transcript + " ";
          } else {
            interimChunk += event.results[i][0].transcript;
          }
        }

        interimTextRef.current = interimChunk;
        setInterimText(interimChunk);

        if (finalChunk.trim()) {
          const processed = processTennisVocab(finalChunk.trim());
          // State Unification: SpeechRecognition transcript output feeds directly into noteText
          const prev = useMatchStore.getState().pendingPointNote || "";
          const next = prev ? `${prev} ${processed}` : processed;
          setNoteText(next);
          setPointNote(next);
        }
      };

      rec.onerror = (event: any) => {
        console.warn("Speech recognition notice:", event);
      };

      rec.onend = () => {
        if (isListeningRef.current) {
          try {
            rec.start();
          } catch {
            setIsListening(false);
            isListeningRef.current = false;
          }
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = rec;
    }

    return () => {
      isListeningRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, [setPointNote]);

  const toggleListening = () => {
    triggerHaptic(40);
    const rec = recognitionRef.current;
    if (!rec) return;

    if (isListening) {
      isListeningRef.current = false;
      if (interimTextRef.current.trim()) {
        const processed = processTennisVocab(interimTextRef.current.trim());
        const prev = useMatchStore.getState().pendingPointNote || "";
        const next = prev ? `${prev} ${processed}` : processed;
        setNoteText(next);
        setPointNote(next);
        setInterimText("");
        interimTextRef.current = "";
      }
      try {
        rec.stop();
      } catch {}
      setIsListening(false);
    } else {
      isListeningRef.current = true;
      try {
        rec.start();
        setIsListening(true);
      } catch (err) {
        console.error("Failed to start speech recognition:", err);
        setIsListening(false);
        isListeningRef.current = false;
      }
    }
  };

  // Specification 1: Append tag text to note state with leading space if note is not empty
  const handleTagClick = (tag: string) => {
    triggerHaptic(40);
    const prev = useMatchStore.getState().pendingPointNote || "";
    const next = prev ? `${prev} ${tag}` : tag;
    setNoteText(next);
    setPointNote(next);
  };

  // Specification 2: Standard mobile keyboard onChange feeds into exact same state (noteText)
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNoteText(val);
    setPointNote(val);
  };

  // Specification 2: Focus Protection — Tapping textarea explicitly does NOT stop/abort recognition
  const handleFocus = () => {
    // Microphone continues to listen in the background while typing
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
        <span className="flex items-center gap-1.5">
          <MessageSquare size={13} className="text-blue-400" />
          Point Note
        </span>
        {isListening && (
          <span className="flex items-center gap-1.5 text-red-400 font-medium normal-case animate-pulse text-[11px]">
            <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
            Mic listening…
          </span>
        )}
      </div>

      {/* Specification 1: Horizontally scrolling row of touch-friendly pill buttons */}
      <div className="flex overflow-x-auto whitespace-nowrap gap-2 pb-2 scrollbar-hide">
        {QUICK_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => handleTagClick(tag)}
            className="px-3 py-1.5 rounded-full text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 transition-all shrink-0 active:scale-95 shadow-sm"
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Specification 2: Unified Note Textarea with Focus Protection */}
      <div className="relative">
        <textarea
          value={noteText}
          onChange={handleTextChange}
          onFocus={handleFocus}
          placeholder="Add point note or tap quick tags above…"
          rows={2}
          className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3.5 py-2.5 pr-11 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all resize-none shadow-inner"
        />

        {isSupported && (
          <button
            type="button"
            onClick={toggleListening}
            className={`absolute right-2.5 top-2.5 p-1.5 rounded-lg transition-all ${
              isListening
                ? "text-red-400 bg-red-500/10 border border-red-500/30 animate-pulse shadow-sm shadow-red-500/20"
                : "text-slate-400 hover:text-blue-400 hover:bg-slate-800"
            }`}
            title={isListening ? "Stop listening" : "Start voice dictation"}
          >
            {isListening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
        )}
      </div>

      {isListening && (
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5 text-red-400">
            <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-ping" />
            Listening… {interimText && <span className="text-slate-300 italic font-mono">"{interimText}"</span>}
          </span>
          <span className="text-[10px] text-slate-500">Tap mic to stop</span>
        </div>
      )}
    </div>
  );
}

/* ---------- Unified classification options (same for both players) ---------- */

const CLASSIFICATIONS = [
  { value: PointClassification.ACE,            label: "Ace",            color: "bg-emerald-600", hoverColor: "hover:bg-emerald-500" },
  { value: PointClassification.WINNER,         label: "Winner",         color: "bg-blue-600",    hoverColor: "hover:bg-blue-500" },
  { value: PointClassification.FORCED_ERROR,   label: "Forced Error",   color: "bg-amber-600",   hoverColor: "hover:bg-amber-500" },
  { value: PointClassification.UNFORCED_ERROR, label: "Unforced Error", color: "bg-red-600",     hoverColor: "hover:bg-red-500" },
];


/* ---------- Shot types for the Winner follow-up ---------- */

const SHOT_TYPES = [
  { value: "FOREHAND",        label: "Forehand",        color: "bg-blue-600",    hoverColor: "hover:bg-blue-500" },
  { value: "BACKHAND",        label: "Backhand",        color: "bg-indigo-600",  hoverColor: "hover:bg-indigo-500" },
  { value: "FOREHAND_SLICE",  label: "Forehand Slice",  color: "bg-sky-600",     hoverColor: "hover:bg-sky-500" },
  { value: "BACKHAND_SLICE",  label: "Backhand Slice",  color: "bg-violet-600",  hoverColor: "hover:bg-violet-500" },
  { value: "FOREHAND_VOLLEY", label: "Forehand Volley", color: "bg-teal-600",    hoverColor: "hover:bg-teal-500" },
  { value: "BACKHAND_VOLLEY", label: "Backhand Volley", color: "bg-cyan-600",    hoverColor: "hover:bg-cyan-500" },
  { value: "OVERHEAD",        label: "Overhead",        color: "bg-orange-600",  hoverColor: "hover:bg-orange-500" },
  { value: "DROP_SHOT",       label: "Drop Shot",       color: "bg-rose-600",    hoverColor: "hover:bg-rose-500" },
  { value: "LOB",             label: "Lob",             color: "bg-fuchsia-600", hoverColor: "hover:bg-fuchsia-500" },
];

/* ---------- Score Display ---------- */

function ScoreDisplay() {
  const score = useMatchStore((s) => s.score);
  const setup = useMatchStore((s) => s.setup);
  const getPointLabel = useMatchStore((s) => s.getPointLabel);

  const playerLabel = setup?.playerName || "Player";
  const opponentLabel = setup?.opponentName || "Opponent";

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-[1fr_60px_60px_60px] gap-2 items-center text-center px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-800">
        <span className="text-left"></span>
        <span>Sets</span>
        <span>Games</span>
        <span>Pts</span>
      </div>

      {/* Player row */}
      <div className="grid grid-cols-[1fr_60px_60px_60px] gap-2 items-center text-center px-5 py-4 border-b border-slate-800/50">
        <div className="text-left flex items-center gap-2 min-w-0">
          <span className="font-bold text-white text-lg truncate">{playerLabel}</span>
          {score.currentServer === "PLAYER" && (
            <span className="shrink-0 w-2 h-2 bg-yellow-400 rounded-full" title="Serving" />
          )}
        </div>
        <span className="text-xl font-bold text-blue-400">{score.playerSets}</span>
        <span className="text-xl font-bold text-white">{score.playerGames}</span>
        <span className="text-2xl font-black text-emerald-400">{getPointLabel("PLAYER")}</span>
      </div>

      {/* Opponent row */}
      <div className="grid grid-cols-[1fr_60px_60px_60px] gap-2 items-center text-center px-5 py-4">
        <div className="text-left flex items-center gap-2 min-w-0">
          <span className="font-bold text-white text-lg truncate">{opponentLabel}</span>
          {score.currentServer === "OPPONENT" && (
            <span className="shrink-0 w-2 h-2 bg-yellow-400 rounded-full" title="Serving" />
          )}
        </div>
        <span className="text-xl font-bold text-blue-400">{score.opponentSets}</span>
        <span className="text-xl font-bold text-white">{score.opponentGames}</span>
        <span className="text-2xl font-black text-emerald-400">{getPointLabel("OPPONENT")}</span>
      </div>
    </div>
  );
}

/* ---------- Change Ends Banner ---------- */

function ChangeEndsBanner() {
  const showChangeEnds = useMatchStore((s) => s.showChangeEnds);
  const changeEndsReason = useMatchStore((s) => s.changeEndsReason);
  const dismissChangeEnds = useMatchStore((s) => s.dismissChangeEnds);

  if (!showChangeEnds) return null;

  return (
    <div className="relative mt-3 flex items-center gap-3 p-3.5 rounded-xl bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/40 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-orange-500/30">
        <RotateCcw size={18} className="text-orange-300 animate-spin" style={{ animationDuration: '3s' }} />
      </div>
      <div className="flex-1">
        <div className="text-sm font-bold text-orange-300 uppercase tracking-wider">Change Ends</div>
        <div className="text-xs text-orange-400/80 mt-0.5">
          {changeEndsReason || "Players switch sides of the court"}
        </div>
      </div>
      <button
        onClick={dismissChangeEnds}
        className="shrink-0 p-1.5 rounded-lg hover:bg-orange-500/20 text-orange-400 transition-colors"
        title="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}

/* ---------- Manual Switch Server Button ---------- */

function ManualSwitchButton() {
  const switchServer = useMatchStore((s) => s.switchServer);
  const score = useMatchStore((s) => s.score);
  const setup = useMatchStore((s) => s.setup);

  const serverName = score.currentServer === "PLAYER"
    ? (setup?.playerName || "You")
    : (setup?.opponentName || "Opponent");

  return (
    <button
      onClick={() => { triggerHaptic(40); switchServer(); }}
      className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white text-xs font-semibold transition-all active:scale-[0.98] shadow-sm"
      title="Manually switch who is serving"
    >
      <ArrowLeftRight size={14} className="text-amber-400" />
      <span>Switch Server</span>
      <span className="text-slate-500 font-normal">({serverName} serving)</span>
    </button>
  );
}


/* ---------- Court Side Indicator ---------- */

function CourtSideIndicator() {
  const courtSide = useMatchStore((s) => s.courtSide);
  const score = useMatchStore((s) => s.score);
  const setup = useMatchStore((s) => s.setup);

  // Only show during tiebreaks or when it might be useful
  if (!score.isTiebreak && !score.isMatchTiebreak) return null;

  const serverName = score.currentServer === 'PLAYER'
    ? (setup?.playerName || 'Player')
    : (setup?.opponentName || 'Opponent');

  return (
    <div className="flex items-center gap-2 text-xs mt-2">
      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${
        courtSide === 'DEUCE'
          ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
          : 'bg-purple-500/10 border-purple-500/30 text-purple-400'
      }`}>
        <span className="font-semibold uppercase tracking-wider">{courtSide}</span>
        <span className="opacity-60">Court</span>
      </div>
      <span className="text-slate-600">•</span>
      <span className="text-slate-500">
        {serverName} serving
      </span>
    </div>
  );
}

/* ---------- Tiebreak / Match Tiebreak Badge ---------- */

function TiebreakBadge() {
  const score = useMatchStore((s) => s.score);

  if (score.isMatchTiebreak) {
    return (
      <span className="text-xs font-bold uppercase tracking-wider text-rose-400 bg-rose-400/10 px-3 py-1 rounded-full border border-rose-400/20 animate-pulse">
        Match Tiebreak — First to 10
      </span>
    );
  }

  if (score.isTiebreak) {
    return (
      <span className="text-xs font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full">
        Tiebreak
      </span>
    );
  }

  return null;
}

/* ---------- No-Ad Deuce Indicator ---------- */

function NoAdIndicator() {
  const score = useMatchStore((s) => s.score);
  const setup = useMatchStore((s) => s.setup);

  if (setup?.scoringFormat !== 'no-ad') return null;
  if (score.isTiebreak || score.isMatchTiebreak) return null;

  // Only show when at deuce (both >= 3 and equal)
  if (score.playerPoints >= 3 && score.opponentPoints >= 3 && score.playerPoints === score.opponentPoints) {
    return (
      <div className="mt-2 flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
        <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Deciding Point</span>
        <span className="text-xs text-red-400/60">• No-Ad</span>
      </div>
    );
  }

  return null;
}

/* ---------- Match Completion Modal ---------- */

function MatchCompletionModal({
  isOpen,
  onClose,
  onSave,
  playerName,
  opponentName,
  playerSets,
  opponentSets,
  matchId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  playerName: string;
  opponentName: string;
  playerSets: number;
  opponentSets: number;
  matchId: string | null;
}) {
  const [showTransferUI, setShowTransferUI] = useState(false);

  if (!isOpen) return null;

  const winner = playerSets > opponentSets ? playerName : opponentName;

  const handleCloseModal = () => {
    setShowTransferUI(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) handleCloseModal(); }}
    >
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/50 animate-in zoom-in-95 fade-in slide-in-from-bottom-4 duration-300 overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Decorative top gradient bar */}
        <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

        {showTransferUI ? (
          <div className="p-6 text-left">
            <button
              onClick={() => { triggerHaptic(); setShowTransferUI(false); }}
              className="mb-4 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold border border-slate-700 hover:text-white transition-all"
            >
              <ArrowLeft size={14} />
              Back to Match Summary
            </button>
            <GuestMatchTransferUI
              matchId={matchId || "guest_match"}
              matchSummary={{
                player: playerName,
                opponent: opponentName,
                scoreString: `${playerSets} - ${opponentSets}`,
              }}
            />
          </div>
        ) : (
          <div className="p-6 text-center">
            {/* Trophy icon */}
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-5 shadow-lg shadow-amber-500/30">
              <Trophy size={28} className="text-white" />
            </div>

            <h2 className="text-xl font-bold text-white mb-1">Match Complete</h2>
            <p className="text-slate-400 text-sm mb-6">
              <span className="text-white font-semibold">{winner}</span> wins the match{" "}
              <span className="text-emerald-400 font-bold">{playerSets} – {opponentSets}</span>
            </p>

            {/* Saved confirmation */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-6">
              <Check size={13} className="shrink-0" />
              <span>All match data has been saved</span>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={() => { triggerHaptic(60); onSave(); }}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base shadow-lg shadow-emerald-600/30 active:scale-95 transition-all"
              >
                <Save size={18} />
                Save & View Recap
              </button>

              <button
                onClick={() => { triggerHaptic(); handleCloseModal(); }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-sm font-medium border border-slate-700 hover:border-slate-600 hover:text-white transition-all"
              >
                <Undo2 size={14} />
                Return to Match
              </button>

              <button
                onClick={() => { triggerHaptic(); setShowTransferUI(true); }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-sm font-semibold border border-indigo-500/40 hover:border-indigo-500/60 transition-all"
              >
                <Send size={15} />
                Transfer Guest Match
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Main Scoring Interface ---------- */

export function ScoringInterface({ role = 'PRIMARY' }: { role?: 'PRIMARY' | 'OBSERVER' }) {
  const { phase, setup, pendingPointWinner, score, canUndo, matchId } = useMatchStore();
  const selectPointWinner = useMatchStore((s) => s.selectPointWinner);
  const selectClassification = useMatchStore((s) => s.selectClassification);
  const confirmShotType = useMatchStore((s) => s.confirmShotType);
  const cancelPointDetail = useMatchStore((s) => s.cancelPointDetail);
  const undoLastPoint = useMatchStore((s) => s.undoLastPoint);
  const finishMatch = useMatchStore((s) => s.finishMatch);
  const resetMatch = useMatchStore((s) => s.resetMatch);
  const setRole = useMatchStore((s) => s.setRole);

  useEffect(() => {
    setRole(role);
  }, [role, setRole]);

  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [showSuspendMenu, setShowSuspendMenu] = useState(false);
  const suspendMatch = useMatchStore((s) => s.suspendMatch);
  const router = useRouter();

  const playerLabel = setup?.playerName || "Player";
  const opponentLabel = setup?.opponentName || "Opponent";

  /* ---- Screen Wake Lock (Specification 1) ---- */
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;
    let isMounted = true;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator && isMounted && document.visibilityState === 'visible') {
          wakeLock = await navigator.wakeLock.request('screen');
          wakeLock.addEventListener('release', () => {
            // Wake lock was released (e.g., tab switch or screen off)
          });
        }
      } catch (err: any) {
        // Ignore expected NotAllowedError (e.g., page hidden or unfocused)
        if (err?.name !== 'NotAllowedError') {
          console.warn('Wake Lock request failed:', err);
        }
      }
    };

    // Request on mount
    requestWakeLock();

    // Re-request when the page becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isMounted) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) {
        wakeLock.release().catch(() => {});
        wakeLock = null;
      }
    };
  }, []);

  /* ---- Real-Time Sync Mockup (BroadcastChannel) ---- */
  useEffect(() => {
    if (!matchId) return;
    const bc = new BroadcastChannel(`courtedge-live-score-${matchId}`);
    
    if (role === 'PRIMARY') {
      const unsub = useMatchStore.subscribe((state, prevState) => {
        if (state.score !== prevState.score || state.setup !== prevState.setup || state.phase !== prevState.phase) {
          const serializableState = {
            setup: state.setup,
            score: state.score,
            currentSetId: state.currentSetId,
            currentGameId: state.currentGameId,
            pointsInGame: state.pointsInGame,
            setsPlayed: state.setsPlayed,
            courtSide: state.courtSide,
            pressureContext: state.pressureContext,
            phase: state.phase,
            isRecovering: state.isRecovering,
          };
          bc.postMessage({ type: 'SYNC_STATE', state: serializableState });
        }
      });

      const currentState = useMatchStore.getState();
      const initialSerializableState = {
        setup: currentState.setup,
        score: currentState.score,
        currentSetId: currentState.currentSetId,
        currentGameId: currentState.currentGameId,
        pointsInGame: currentState.pointsInGame,
        setsPlayed: currentState.setsPlayed,
        courtSide: currentState.courtSide,
        pressureContext: currentState.pressureContext,
        phase: currentState.phase,
        isRecovering: currentState.isRecovering,
      };
      bc.postMessage({ type: 'SYNC_STATE', state: initialSerializableState });

      bc.onmessage = (event) => {
        if (event.data.type === 'OBSERVER_OBSERVATION') {
          console.log('[Mock Backend] Received observer observation:', event.data.payload);
        }
      };

      return () => {
        unsub();
        bc.close();
      };
    } else {
      bc.postMessage({ type: 'REQUEST_STATE' });
      bc.onmessage = (event) => {
        if (event.data.type === 'SYNC_STATE') {
          const s = event.data.state;
          useMatchStore.setState((prev) => ({
            ...prev,
            setup: s.setup,
            score: s.score,
            currentSetId: s.currentSetId,
            currentGameId: s.currentGameId,
            pointsInGame: s.pointsInGame,
            setsPlayed: s.setsPlayed,
            courtSide: s.courtSide,
            pressureContext: s.pressureContext,
            // Only sync phase if we aren't currently logging a point
            phase: (prev.phase === 'POINT_DETAIL' || prev.phase === 'SHOT_DETAIL') ? prev.phase : s.phase,
            isRecovering: false,
          }));
        }
      };

      return () => bc.close();
    }
  }, [matchId, role]);

  /* ---- Suspend Match handler ---- */
  const handleSuspend = useCallback(async () => {
    triggerHaptic(60);
    setShowSuspendMenu(false);
    await suspendMatch();
    router.push('/gametime');
  }, [suspendMatch, router]);

  /* ---- Match finished ---- */
  if (phase === "FINISHED") {
    return (
      <div className="max-w-lg mx-auto p-6 md:p-10 text-center animate-in fade-in">
        {/* Match Completion Modal */}
        <MatchCompletionModal
          isOpen={showCompletionModal}
          onClose={() => setShowCompletionModal(false)}
          onSave={() => {
            setShowCompletionModal(false);
            resetMatch();
            // Future: navigate to /recap/:matchId
          }}
          playerName={playerLabel}
          opponentName={opponentLabel}
          playerSets={score.playerSets}
          opponentSets={score.opponentSets}
          matchId={matchId}
        />

        <div className="text-6xl mb-4">🏆</div>
        
        {/* Saved confirmation badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-4">
          <Check size={14} className="shrink-0" />
          <span>Match data saved to local storage</span>
        </div>

        <h1 className="text-3xl font-bold mb-2">Match Complete</h1>
        <p className="text-slate-400 mb-8">
          <span className="text-white font-semibold">
            {score.playerSets > score.opponentSets ? playerLabel : opponentLabel}
          </span> wins!{" "}
          {score.playerSets} – {score.opponentSets}
        </p>
        <ScoreDisplay />

        {/* Breakdown of flagged points (Critical, Important, Review) */}
        <FlaggedPointsSummary matchId={matchId} />

        {/* Dedicated Notes Log (Match Notes & Point Notes) */}
        <NotesLog matchId={matchId} />

        {/* Primary Actions */}
        {role !== 'OBSERVER' && (
          <div className="mt-8 flex flex-col gap-3 max-w-xs mx-auto">
            {/* Full-width Finish Match & Save — opens the completion modal */}
            <button
              onClick={() => { triggerHaptic(60); setShowCompletionModal(true); }}
              className="w-full flex items-center justify-center gap-2.5 py-4 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base shadow-xl shadow-emerald-600/30 active:scale-95 transition-all"
            >
              <CheckCircle2 size={20} />
              Finish Match & Save
            </button>

            {canUndo && (
              <button
                onClick={() => { triggerHaptic(); undoLastPoint(); }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-700 hover:text-white transition-all border border-slate-700"
              >
                <Undo2 size={14} />
                Undo Last Point
              </button>
            )}
          </div>
        )}

        {/* Match notes panel */}
        <div className="mt-6">
          <NotesPanel />
        </div>

        {/* Sync status */}
        <div className="mt-6 flex justify-center">
          <SyncIndicator />
        </div>
      </div>
    );
  }

  /* ---- Live scoring ---- */
  return (
    <div className="max-w-lg mx-auto p-4 md:p-10 animate-in fade-in">
      {/* Finish match options modal */}
      <FinishMatchModal
        isOpen={isFinishModalOpen}
        onClose={() => setIsFinishModalOpen(false)}
        playerName={playerLabel}
        opponentName={opponentLabel}
        onSelectOption={(reason) => {
          setIsFinishModalOpen(false);
          finishMatch(reason);
        }}
      />

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl md:text-2xl font-bold">Live Scoring</h1>
        <div className="flex items-center gap-2">
          <TiebreakBadge />

          {role !== 'OBSERVER' && (
            <>
              {/* Share QR Code Button */}
              <button
                onClick={() => { triggerHaptic(); setIsShareModalOpen(true); }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-semibold transition-all"
                title="Share live match"
              >
                <QrCode size={13} />
                <span className="hidden sm:inline">Share</span>
              </button>

              {/* Suspend Match dropdown */}
              <div className="relative">
                <button
                  onClick={() => { triggerHaptic(); setShowSuspendMenu(!showSuspendMenu); }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold transition-all"
                  title="Suspend match (rain delay)"
                >
                  <PauseCircle size={13} />
                  <span className="hidden sm:inline">Suspend</span>
                </button>
                {showSuspendMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowSuspendMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl shadow-black/40 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      <button
                        onClick={handleSuspend}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-amber-300 hover:bg-amber-500/10 transition-colors text-left"
                      >
                        <CloudRain size={16} className="shrink-0 text-amber-400" />
                        <div>
                          <div className="font-semibold">Suspend Match</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">Rain delay, break, or pause — resume later</div>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={() => { triggerHaptic(); setIsFinishModalOpen(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-all"
                title="Finish match options"
              >
                <CheckCircle2 size={13} />
                <span>Game Done</span>
              </button>
            </>
          )}
          <SyncIndicator />
        </div>
      </div>

      {/* Share QR Code Modal */}
      {isShareModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => { if (e.target === e.currentTarget) setIsShareModalOpen(false); }}
        >
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl animate-in zoom-in-95 fade-in duration-200 overflow-hidden relative p-6">
            <button
              onClick={() => setIsShareModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
            <MatchShareQR
              matchId={matchId || "live_match"}
              token="dummy_token_for_now"
            />
          </div>
        </div>
      )}

      <ScoreDisplay />

      {/* Court side indicator (tiebreaks only) */}
      <CourtSideIndicator />

      {/* No-Ad deciding point indicator */}
      <NoAdIndicator />

      {/* Change ends banner */}
      <ChangeEndsBanner />

      {/* Manual switch sides button ("Other" changeover procedure) */}
      <ManualSwitchButton />

      {/* Pressure context prompt (Section 18.2) */}
      <div className="mt-4">
        <PressurePrompt />
      </div>

      {/* Step 1: Who won the point? */}
      <div className="mt-6">
        {phase === "PLAYING" && (
          <>
            <p className="text-sm text-slate-400 font-medium mb-4 text-center">Who won the point?</p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => { triggerHaptic(); selectPointWinner("PLAYER"); }}
                className="py-6 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-lg font-bold shadow-lg shadow-blue-600/20 active:scale-95 transition-all"
              >
                {playerLabel}
              </button>
              <button
                onClick={() => { triggerHaptic(); selectPointWinner("OPPONENT"); }}
                className="py-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-lg font-bold shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
              >
                {opponentLabel}
              </button>
            </div>

            {/* Bottom Controls: Dynamic stretching Game Done when no Undo */}
            {role !== 'OBSERVER' && (
              <div className="mt-4">
                {!canUndo ? (
                  <button
                    onClick={() => { triggerHaptic(); setIsFinishModalOpen(true); }}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/40 text-sm font-semibold transition-all shadow-md active:scale-95"
                  >
                    <CheckCircle2 size={15} />
                    <span>Game Done</span>
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => { triggerHaptic(); undoLastPoint(); }}
                      className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800/60 text-slate-400 text-sm font-medium hover:bg-slate-800 hover:text-white transition-all border border-slate-700/50"
                    >
                      <Undo2 size={14} />
                      Undo Last Point
                    </button>
                    <button
                      onClick={() => { triggerHaptic(); setIsFinishModalOpen(true); }}
                      className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/40 text-sm font-semibold transition-all"
                    >
                      <CheckCircle2 size={15} />
                      <span>Game Done</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Step 2: How did it end? (same options for both players) */}
        {phase === "POINT_DETAIL" && pendingPointWinner && (
          <div className="animate-in slide-in-from-bottom-4 fade-in duration-200">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-400 font-medium">
                <span className="text-white font-semibold">
                  {pendingPointWinner === "PLAYER" ? playerLabel : opponentLabel}
                </span>{" "}
                won — How did it end?
              </p>
              <button onClick={() => { triggerHaptic(); cancelPointDetail(); }} className="text-slate-500 hover:text-white transition-colors p-1">
                <Undo2 size={18} />
              </button>
            </div>

            {/* Point note + flags BEFORE classification selection */}
            <div className="space-y-3 mb-4">
              <PointNoteInput />
              <CriticalPointFlags />
            </div>

            <div className="grid grid-cols-1 gap-3">
              {CLASSIFICATIONS.filter(
                (btn) => pendingPointWinner === score.currentServer || btn.value !== PointClassification.ACE
              ).map((btn) => (
                <button
                  key={btn.value}
                  onClick={() => { triggerHaptic(); selectClassification(btn.value); }}
                  className={`py-4 rounded-xl ${btn.color} ${btn.hoverColor} text-white font-semibold text-base shadow-md active:scale-95 transition-all`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: What type of winner? (only shown after selecting "Winner") */}
        {phase === "SHOT_DETAIL" && (
          <div className="animate-in slide-in-from-bottom-4 fade-in duration-200">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-400 font-medium">
                What type of winner?
              </p>
              <button onClick={() => { triggerHaptic(); cancelPointDetail(); }} className="text-slate-500 hover:text-white transition-colors p-1">
                <Undo2 size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {SHOT_TYPES.map((btn) => (
                <button
                  key={btn.value}
                  onClick={() => { triggerHaptic(); confirmShotType(btn.value); }}
                  className={`py-4 rounded-xl ${btn.color} ${btn.hoverColor} text-white font-semibold text-sm shadow-md active:scale-95 transition-all`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Notes panel (Section 16 — game & match level) */}
      {(phase === "PLAYING" || phase === "POINT_DETAIL" || phase === "SHOT_DETAIL") && (
        <div className="mt-6">
          <NotesPanel />
        </div>
      )}
    </div>
  );
}
