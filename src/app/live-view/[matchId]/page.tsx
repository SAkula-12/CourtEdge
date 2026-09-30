"use client";

import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMatchStore } from "@/stores/matchStore";
import { ScoreDisplay, TiebreakBadge, CourtSideIndicator } from "@/components/gametime/ScoringInterface";
import { PlayByPlayTimeline } from "@/components/gametime/PlayByPlayTimeline";
import { Eye, AlertTriangle, Loader2 } from "lucide-react";

export default function LiveViewPage({ params }: { params: Promise<{ matchId: string }> }) {
  const resolvedParams = use(params);
  const { matchId } = resolvedParams;

  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const access = searchParams.get("access");

  const [isValidating, setIsValidating] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(true);

  const setup = useMatchStore((s) => s.setup);
  const recoverActiveMatch = useMatchStore((s) => s.recoverActiveMatch);

  // Validate access if restricted
  useEffect(() => {
    const checkAccess = async () => {
      setIsValidating(true);
      try {
        await new Promise((resolve) => setTimeout(resolve, 300));
        if (access === "approved") {
          if (token && token.trim().length > 0) {
            setIsAuthorized(true);
          } else {
            setIsAuthorized(false);
          }
        } else {
          setIsAuthorized(true);
        }
      } catch {
        setIsAuthorized(false);
      } finally {
        setIsValidating(false);
      }
    };
    checkAccess();
  }, [access, token]);

  // Connect to BroadcastChannel for real-time synchronization and Dexie hydration
  useEffect(() => {
    if (!matchId) return;

    // Hydrate store from Dexie if not in memory
    recoverActiveMatch(matchId);

    const bc = new BroadcastChannel(`courtedge-live-score-${matchId}`);
    bc.postMessage({ type: "REQUEST_STATE" });

    bc.onmessage = (event) => {
      if (event.data.type === "SYNC_STATE") {
        const s = event.data.state;
        useMatchStore.setState((prev) => ({
          ...prev,
          matchId,
          setup: s.setup,
          score: s.score,
          targetGames: s.targetGames,
          pendingDecision: s.pendingDecision,
          currentSetId: s.currentSetId,
          currentGameId: s.currentGameId,
          pointsInGame: s.pointsInGame,
          setsPlayed: s.setsPlayed,
          courtSide: s.courtSide,
          pressureContext: s.pressureContext,
          phase: s.phase,
          isRecovering: false,
        }));
      }
    };

    return () => {
      bc.close();
    };
  }, [matchId, recoverActiveMatch]);

  if (isValidating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-950 text-center animate-in fade-in duration-300">
        <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mb-4">
          <Loader2 size={24} className="animate-spin" />
        </div>
        <h2 className="text-base font-bold text-white tracking-wide mb-1">Connecting to Live Match...</h2>
        <p className="text-xs text-slate-400">Loading live scoreboard & play-by-play feed</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-950 text-center animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-6">
          <AlertTriangle size={32} />
        </div>
        <h2 className="text-xl font-bold text-white tracking-wide mb-2">Access Restricted</h2>
        <p className="text-sm text-slate-400 mb-8 max-w-[280px]">
          This match feed is set to Approved Viewers Only. Please request a valid spectator link from the recorder.
        </p>
      </div>
    );
  }

  const playerName = setup?.playerName || "Player";
  const opponentName = setup?.opponentName || "Opponent";

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-200">
      {/* Top Live Spectator Banner */}
      <div className="p-2.5 bg-sky-500/10 border-b border-sky-500/20 flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 text-[11px] font-black uppercase tracking-wider animate-pulse">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            LIVE
          </div>
          <span className="text-xs font-semibold text-sky-300 tracking-wide">
            Spectator View
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
          <Eye size={13} className="text-sky-400" />
          <span className="hidden sm:inline">Read-Only Live Feed</span>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 w-full max-w-lg mx-auto p-4 md:p-8 space-y-6">
        {/* Match Header info */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg md:text-xl font-extrabold text-white tracking-tight">
              {playerName} <span className="text-slate-500 font-normal">vs</span> {opponentName}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {setup?.surface ? `${setup.surface} Court` : "Tennis Match"} • {setup?.format || "Live Game"}
            </p>
          </div>
          <TiebreakBadge />
        </div>

        {/* Live Scoreboard */}
        <ScoreDisplay />

        {/* Court Side Indicator */}
        <CourtSideIndicator />

        {/* Play-by-Play History Timeline */}
        <PlayByPlayTimeline />
      </div>
    </div>
  );
}
