"use client";

import { UserX, XCircle, X, AlertTriangle } from "lucide-react";

interface FinishMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  opponentName: string;
  onSelectOption: (reason: "COMPLETED" | "PLAYER_FORFEIT" | "OPPONENT_FORFEIT" | "CANCEL") => void;
}

export function FinishMatchModal({
  isOpen,
  onClose,
  playerName,
  opponentName,
  onSelectOption,
}: FinishMatchModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Match Finish Options</h2>
            <p className="text-xs text-slate-400 mt-0.5">Select how this match is being concluded</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Options list */}
        <div className="space-y-3">
          {/* Option 1: Opponent Forfeited */}
          <button
            onClick={() => onSelectOption("OPPONENT_FORFEIT")}
            className="w-full flex items-center gap-3.5 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-left transition-all group"
          >
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 group-hover:scale-105 transition-transform">
              <UserX size={20} />
            </div>
            <div>
              <span className="font-bold text-white text-sm block">{opponentName} Forfeited</span>
              <span className="text-xs text-slate-400">Opponent retired or forfeited the match</span>
            </div>
          </button>

          {/* Option 2: Player Forfeited (I Forfeited) */}
          <button
            onClick={() => onSelectOption("PLAYER_FORFEIT")}
            className="w-full flex items-center gap-3.5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-left transition-all group"
          >
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 group-hover:scale-105 transition-transform">
              <AlertTriangle size={20} />
            </div>
            <div>
              <span className="font-bold text-white text-sm block">{playerName} Forfeited (I Forfeited)</span>
              <span className="text-xs text-slate-400">You retired or forfeited the match</span>
            </div>
          </button>

          {/* Option 3: Cancel Match */}
          <button
            onClick={() => onSelectOption("CANCEL")}
            className="w-full flex items-center gap-3.5 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-left transition-all group"
          >
            <div className="p-2.5 rounded-xl bg-red-500/20 text-red-400 group-hover:scale-105 transition-transform">
              <XCircle size={20} />
            </div>
            <div>
              <span className="font-bold text-red-300 text-sm block">Cancel Match</span>
              <span className="text-xs text-slate-400">Discard and cancel this match recording</span>
            </div>
          </button>
        </div>

        {/* Cancel modal button */}
        <div className="pt-2">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
          >
            Return to Live Match
          </button>
        </div>
      </div>
    </div>
  );
}
