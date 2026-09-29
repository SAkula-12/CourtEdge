"use client";

import { useEffect, useState } from "react";
import { useMatchStore } from "@/stores/matchStore";
import { MatchSetupForm } from "@/components/gametime/MatchSetupForm";
import { ScoringInterface } from "@/components/gametime/ScoringInterface";
import { PlayCircle, Loader2, RotateCcw, CloudRain } from "lucide-react";
import { db } from "@/lib/db";
import type { DBMatch } from "@/lib/db";

export default function GametimePage() {
  const { phase, startSetup, recoverActiveMatch } = useMatchStore();
  const [isHydrating, setIsHydrating] = useState(true);
  const [suspendedMatches, setSuspendedMatches] = useState<DBMatch[]>([]);

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

  // Query Dexie for suspended matches (only when idle)
  useEffect(() => {
    if (phase !== 'IDLE' || isHydrating) return;

    const loadSuspended = async () => {
      try {
        const matches = await db.matches.where('status').equals('SUSPENDED').toArray();
        setSuspendedMatches(matches.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      } catch {
        setSuspendedMatches([]);
      }
    };
    loadSuspended();
  }, [phase, isHydrating]);

  // Resume a suspended match by changing its status to IN_PROGRESS, then recovering
  const handleResumeMatch = async (matchId: string) => {
    await db.matches.update(matchId, { status: 'IN_PROGRESS' });
    await recoverActiveMatch(matchId);
  };

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

  // Idle — prompt to start a match or show setup
  if (phase === "IDLE") {
    if (suspendedMatches.length === 0) {
      return <MatchSetupForm />;
    }

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

          {/* Suspended matches — Resume buttons */}
          {suspendedMatches.length > 0 && (
            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400/80">
                <CloudRain size={13} />
                <span>Suspended Matches</span>
              </div>
              {suspendedMatches.map((match) => (
                <button
                  key={match.id}
                  onClick={() => handleResumeMatch(match.id)}
                  className="w-full flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/25 hover:border-amber-500/40 text-left transition-all group active:scale-[0.98]"
                >
                  <div className="shrink-0 w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center group-hover:bg-amber-500/30 transition-colors">
                    <RotateCcw size={18} className="text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white truncate">
                      Resume: {match.playerName} vs {match.opponentName}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {match.surface} • {match.format.replace(/_/g, ' ')} • {new Date(match.date).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="shrink-0 text-amber-400/60 group-hover:text-amber-400 transition-colors">
                    <PlayCircle size={20} />
                  </div>
                </button>
              ))}
            </div>
          )}
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
