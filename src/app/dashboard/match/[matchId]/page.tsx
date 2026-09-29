"use client";

import { use, useEffect, useState } from "react";
import { Loader2, Activity, Users } from "lucide-react";

export default function DashboardMatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  const resolvedParams = use(params);
  const { matchId } = resolvedParams;
  
  const [isConnecting, setIsConnecting] = useState(true);
  const [matchData, setMatchData] = useState<any>(null);

  useEffect(() => {
    // In a real implementation, you would subscribe to a Firestore doc or Supabase channel
    // e.g. const unsubscribe = onSnapshot(doc(db, "matches", matchId), (doc) => setMatchData(doc.data()));
    
    setIsConnecting(true);
    const mockConnection = setTimeout(() => {
      setIsConnecting(false);
      setMatchData({
        player: "Roger",
        opponent: "Rafa",
        score: { playerPoints: 3, opponentPoints: 2, playerGames: 4, opponentGames: 3, playerSets: 1, opponentSets: 0 },
        activeObservers: 2,
      });
    }, 1200);

    return () => clearTimeout(mockConnection);
  }, [matchId]);

  if (isConnecting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center animate-in fade-in duration-300">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
          <Loader2 size={24} className="animate-spin" />
        </div>
        <h2 className="text-base font-bold text-white tracking-wide mb-1">Connecting to Live Feed...</h2>
      </div>
    );
  }

  if (!matchData) {
    return (
      <div className="p-6 text-center text-slate-400">
        Match not found or feed unavailable.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Live Match Dashboard</h1>
          <p className="text-sm text-slate-400 flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            Real-time feed active
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300">
          <Users size={14} className="text-blue-400" />
          {matchData.activeObservers} Observers
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Mock scoreboard block */}
        <div className="col-span-1 md:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
            <Activity size={14} className="text-indigo-400" />
            Live Score
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center text-lg font-bold text-white">
              <span>{matchData.player}</span>
              <div className="flex gap-4 font-mono">
                <span className="text-slate-500">{matchData.score.playerSets}</span>
                <span className="text-slate-400">{matchData.score.playerGames}</span>
                <span className="text-blue-400">{matchData.score.playerPoints * 15}</span>
              </div>
            </div>
            <div className="flex justify-between items-center text-lg font-bold text-white">
              <span>{matchData.opponent}</span>
              <div className="flex gap-4 font-mono">
                <span className="text-slate-500">{matchData.score.opponentSets}</span>
                <span className="text-slate-400">{matchData.score.opponentGames}</span>
                <span className="text-blue-400">{matchData.score.opponentPoints * 15}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Mock detailed stats block */}
        <div className="col-span-1 bg-slate-900 border border-slate-800 rounded-3xl p-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">Live Insights</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Win Probability</span>
              <span className="text-white font-medium">62%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Last Point</span>
              <span className="text-emerald-400 font-medium text-right">Winner (Forehand)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
