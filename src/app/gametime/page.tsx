"use client";

import { useEffect, useState } from "react";
import { useMatchStore } from "@/stores/matchStore";
import { MatchSetupForm } from "@/components/gametime/MatchSetupForm";
import { ScoringInterface } from "@/components/gametime/ScoringInterface";
import { PlayCircle, Loader2 } from "lucide-react";

export default function GametimePage() {
  const { phase, startSetup, recoverActiveMatch } = useMatchStore();
  const [isHydrating, setIsHydrating] = useState(true);

  // Specification 4: Run exactly once on component mount to recover active session
  useEffect(() => {
    let isMounted = true;
    recoverActiveMatch().finally(() => {
      if (isMounted) {
        setIsHydrating(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [recoverActiveMatch]);

  // Loading state: Prevent Match Setup Form flash while restoring match
  if (isHydrating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 text-center animate-in fade-in duration-300">
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-8 max-w-sm w-full flex flex-col items-center gap-4 shadow-xl shadow-black/20">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Loader2 size={24} className="animate-spin" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white tracking-wide">Restoring match…</h2>
            <p className="text-xs text-slate-400">Checking local database for active session</p>
          </div>
        </div>
      </div>
    );
  }

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
