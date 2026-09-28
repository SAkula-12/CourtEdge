"use client";

import { useMatchStore } from "@/stores/matchStore";
import { MatchSetupForm } from "@/components/gametime/MatchSetupForm";
import { ScoringInterface } from "@/components/gametime/ScoringInterface";
import { PlayCircle } from "lucide-react";

export default function GametimePage() {
  const { phase, startSetup } = useMatchStore();

  // Idle — prompt to start a match
  if (phase === "IDLE") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 text-center animate-in fade-in">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 max-w-md w-full">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/30">
            <PlayCircle size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Gametime</h1>
          <p className="text-slate-400 text-sm mb-8">
            Track points live, classify each rally, and build your match
            intelligence — even without internet.
          </p>
          <button
            onClick={startSetup}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-base shadow-xl shadow-blue-500/30 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Start New Match
          </button>
        </div>
      </div>
    );
  }

  // Setup phase
  if (phase === "SETUP") {
    return <MatchSetupForm />;
  }

  // Playing / Point Detail / Finished
  return <ScoringInterface />;
}
