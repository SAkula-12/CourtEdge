"use client";

import { useState } from "react";
import { useMatchStore } from "@/stores/matchStore";
import { PointClassification } from "@/models/types";
import { Undo2, CheckCircle2, ArrowRight, Check, X, RotateCcw } from "lucide-react";
import { CriticalPointFlags } from "./CriticalPointFlags";
import { PressurePrompt } from "./PressurePrompt";
import { PointNoteInput, NotesPanel } from "./NotesPanel";
import { SyncIndicator } from "./SyncIndicator";
import { FlaggedPointsSummary } from "./FlaggedPointsSummary";
import { NotesLog } from "./NotesLog";
import { FinishMatchModal } from "./FinishMatchModal";

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
  const dismissChangeEnds = useMatchStore((s) => s.dismissChangeEnds);

  if (!showChangeEnds) return null;

  return (
    <div className="relative mt-3 flex items-center gap-3 p-3.5 rounded-xl bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/40 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-orange-500/30">
        <RotateCcw size={18} className="text-orange-300 animate-spin" style={{ animationDuration: '3s' }} />
      </div>
      <div className="flex-1">
        <div className="text-sm font-bold text-orange-300 uppercase tracking-wider">Change Ends</div>
        <div className="text-xs text-orange-400/70 mt-0.5">Players switch sides of the court</div>
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

/* ---------- Main Scoring Interface ---------- */

export function ScoringInterface() {
  const { phase, setup, pendingPointWinner, score, canUndo, matchId } = useMatchStore();
  const selectPointWinner = useMatchStore((s) => s.selectPointWinner);
  const selectClassification = useMatchStore((s) => s.selectClassification);
  const confirmShotType = useMatchStore((s) => s.confirmShotType);
  const cancelPointDetail = useMatchStore((s) => s.cancelPointDetail);
  const undoLastPoint = useMatchStore((s) => s.undoLastPoint);
  const finishMatch = useMatchStore((s) => s.finishMatch);
  const resetMatch = useMatchStore((s) => s.resetMatch);

  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);

  const playerLabel = setup?.playerName || "Player";
  const opponentLabel = setup?.opponentName || "Opponent";

  /* ---- Match finished ---- */
  if (phase === "FINISHED") {
    const winner = score.playerSets > score.opponentSets ? playerLabel : opponentLabel;
    return (
      <div className="max-w-lg mx-auto p-6 md:p-10 text-center animate-in fade-in">
        <div className="text-6xl mb-4">🏆</div>
        
        {/* Saved confirmation badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-4">
          <Check size={14} className="shrink-0" />
          <span>Match data saved to local storage</span>
        </div>

        <h1 className="text-3xl font-bold mb-2">Match Complete</h1>
        <p className="text-slate-400 mb-8">
          <span className="text-white font-semibold">{winner}</span> wins!{" "}
          {score.playerSets} – {score.opponentSets}
        </p>
        <ScoreDisplay />

        {/* Breakdown of flagged points (Critical, Important, Review) */}
        <FlaggedPointsSummary matchId={matchId} />

        {/* Dedicated Notes Log (Match Notes & Point Notes) */}
        <NotesLog matchId={matchId} />

        {/* Primary Actions: Continue & New Match */}
        <div className="mt-8 flex flex-col gap-3 max-w-xs mx-auto">
          <button
            onClick={() => resetMatch()}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-blue-600 text-white font-bold text-base hover:bg-blue-500 shadow-lg shadow-blue-600/25 active:scale-95 transition-all"
          >
            <span>Continue</span>
            <ArrowRight size={18} />
          </button>

          {canUndo && (
            <button
              onClick={undoLastPoint}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-700 hover:text-white transition-all border border-slate-700"
            >
              <Undo2 size={14} />
              Undo Last Point
            </button>
          )}
        </div>

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
        <div className="flex items-center gap-3">
          <TiebreakBadge />
          <button
            onClick={() => setIsFinishModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-all"
            title="Finish match options"
          >
            <CheckCircle2 size={13} />
            <span>Game Done</span>
          </button>
          <SyncIndicator />
        </div>
      </div>

      <ScoreDisplay />

      {/* Court side indicator (tiebreaks only) */}
      <CourtSideIndicator />

      {/* No-Ad deciding point indicator */}
      <NoAdIndicator />

      {/* Change ends banner */}
      <ChangeEndsBanner />

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
                onClick={() => selectPointWinner("PLAYER")}
                className="py-6 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-lg font-bold shadow-lg shadow-blue-600/20 active:scale-95 transition-all"
              >
                {playerLabel}
              </button>
              <button
                onClick={() => selectPointWinner("OPPONENT")}
                className="py-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-lg font-bold shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
              >
                {opponentLabel}
              </button>
            </div>

            {/* Bottom Controls: Dynamic stretching Game Done when no Undo */}
            <div className="mt-4">
              {!canUndo ? (
                <button
                  onClick={() => setIsFinishModalOpen(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/40 text-sm font-semibold transition-all shadow-md active:scale-95"
                >
                  <CheckCircle2 size={15} />
                  <span>Game Done</span>
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={undoLastPoint}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800/60 text-slate-400 text-sm font-medium hover:bg-slate-800 hover:text-white transition-all border border-slate-700/50"
                  >
                    <Undo2 size={14} />
                    Undo Last Point
                  </button>
                  <button
                    onClick={() => setIsFinishModalOpen(true)}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/40 text-sm font-semibold transition-all"
                  >
                    <CheckCircle2 size={15} />
                    <span>Game Done</span>
                  </button>
                </div>
              )}
            </div>
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
              <button onClick={cancelPointDetail} className="text-slate-500 hover:text-white transition-colors p-1">
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
                  onClick={() => selectClassification(btn.value)}
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
              <button onClick={cancelPointDetail} className="text-slate-500 hover:text-white transition-colors p-1">
                <Undo2 size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {SHOT_TYPES.map((btn) => (
                <button
                  key={btn.value}
                  onClick={() => confirmShotType(btn.value)}
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
