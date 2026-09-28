"use client";

import { useMatchStore } from "@/stores/matchStore";
import { PointClassification } from "@/models/types";
import { Undo2 } from "lucide-react";

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

/* ---------- Main Scoring Interface ---------- */

export function ScoringInterface() {
  const { phase, setup, pendingPointWinner, score } = useMatchStore();
  const selectPointWinner = useMatchStore((s) => s.selectPointWinner);
  const selectClassification = useMatchStore((s) => s.selectClassification);
  const confirmShotType = useMatchStore((s) => s.confirmShotType);
  const cancelPointDetail = useMatchStore((s) => s.cancelPointDetail);

  const playerLabel = setup?.playerName || "Player";
  const opponentLabel = setup?.opponentName || "Opponent";

  /* ---- Match finished ---- */
  if (phase === "FINISHED") {
    const winner = score.playerSets > score.opponentSets ? playerLabel : opponentLabel;
    return (
      <div className="max-w-lg mx-auto p-6 md:p-10 text-center animate-in fade-in">
        <div className="text-6xl mb-6">🏆</div>
        <h1 className="text-3xl font-bold mb-2">Match Complete</h1>
        <p className="text-slate-400 mb-8">
          <span className="text-white font-semibold">{winner}</span> wins!{" "}
          {score.playerSets} – {score.opponentSets}
        </p>
        <ScoreDisplay />
        <button
          onClick={() => window.location.reload()}
          className="mt-8 px-8 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-colors"
        >
          New Match
        </button>
      </div>
    );
  }

  /* ---- Live scoring ---- */
  return (
    <div className="max-w-lg mx-auto p-4 md:p-10 animate-in fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl md:text-2xl font-bold">Live Scoring</h1>
        {score.isTiebreak && (
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full">
            Tiebreak
          </span>
        )}
      </div>

      <ScoreDisplay />

      {/* Step 1: Who won the point? */}
      <div className="mt-8">
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

            <div className="grid grid-cols-1 gap-3">
              {CLASSIFICATIONS.map((btn) => (
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
    </div>
  );
}
