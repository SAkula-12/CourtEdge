"use client";

import { useEffect, useState } from "react";
import { db, type DBPoint } from "@/lib/db";
import type { CriticalPointFlagType } from "@/models/types";
import { Flag, AlertTriangle, Star, Eye } from "lucide-react";

interface FlaggedPointsSummaryProps {
  matchId: string | null;
}

interface FlagCounts {
  critical: number;
  important: number;
  review: number;
  totalFlagged: number;
  flaggedPoints: {
    point: DBPoint;
    gameNumber: number;
    parsedFlags: CriticalPointFlagType[];
  }[];
}

export function FlaggedPointsSummary({ matchId }: FlaggedPointsSummaryProps) {
  const [data, setData] = useState<FlagCounts>({
    critical: 0,
    important: 0,
    review: 0,
    totalFlagged: 0,
    flaggedPoints: [],
  });

  useEffect(() => {
    if (!matchId) return;

    let isMounted = true;

    async function loadFlaggedPoints() {
      const points = await db.points.where("matchId").equals(matchId!).toArray();
      const games = await db.games.where("matchId").equals(matchId!).toArray();
      const gameMap = new Map<string, number>(games.map((g) => [g.id, g.gameNumber]));

      let critical = 0;
      let important = 0;
      let review = 0;
      const flaggedPoints: { point: DBPoint; gameNumber: number; parsedFlags: CriticalPointFlagType[] }[] = [];

      for (const p of points) {
        if (!p.flags) continue;
        try {
          const parsedFlags: CriticalPointFlagType[] = JSON.parse(p.flags);
          if (parsedFlags.length === 0) continue;

          let isCounted = false;
          if (parsedFlags.includes("CRITICAL") || parsedFlags.includes("SYSTEM_DETECTED")) {
            critical++;
            isCounted = true;
          }
          if (parsedFlags.includes("IMPORTANT")) {
            important++;
            isCounted = true;
          }
          if (parsedFlags.includes("WORTH_REVIEWING")) {
            review++;
            isCounted = true;
          }

          if (isCounted) {
            flaggedPoints.push({
              point: p,
              gameNumber: gameMap.get(p.gameId) ?? 1,
              parsedFlags,
            });
          }
        } catch {
          // ignore JSON parse errors
        }
      }

      if (isMounted) {
        setData({
          critical,
          important,
          review,
          totalFlagged: flaggedPoints.length,
          flaggedPoints,
        });
      }
    }

    loadFlaggedPoints();

    return () => {
      isMounted = false;
    };
  }, [matchId]);

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 text-left mt-6 shadow-xl">
      <div className="flex items-center gap-2 mb-4 text-sm font-bold text-slate-200">
        <Flag size={16} className="text-amber-400" />
        <span>Flagged Points Breakdown</span>
      </div>

      {/* Flag Count Grid */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {/* Critical */}
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-red-400 mb-1">
            <AlertTriangle size={13} />
            <span>Critical</span>
          </div>
          <span className="text-2xl font-black text-red-300">{data.critical}</span>
        </div>

        {/* Important */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-amber-400 mb-1">
            <Star size={13} />
            <span>Important</span>
          </div>
          <span className="text-2xl font-black text-amber-300">{data.important}</span>
        </div>

        {/* Review */}
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-purple-400 mb-1">
            <Eye size={13} />
            <span>Review</span>
          </div>
          <span className="text-2xl font-black text-purple-300">{data.review}</span>
        </div>
      </div>

      {/* Details List if any flagged points exist */}
      {data.flaggedPoints.length > 0 && (
        <div className="space-y-2 mt-4 pt-3 border-t border-slate-800">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Flagged Point Log ({data.flaggedPoints.length})
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {data.flaggedPoints.map(({ point, gameNumber, parsedFlags }) => (
              <div
                key={point.id}
                className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5 text-xs flex items-center justify-between gap-2"
              >
                <div>
                  <span className="font-semibold text-white">Game {gameNumber}, Point {point.pointNumber}</span>
                  <span className="text-slate-400 ml-2">({point.winner === "PLAYER" ? "Won" : "Lost"} - {point.classification})</span>
                  {point.note && <p className="text-slate-300 italic mt-0.5">&ldquo;{point.note}&rdquo;</p>}
                </div>

                {/* Badges */}
                <div className="flex gap-1 shrink-0">
                  {parsedFlags.includes("CRITICAL") && (
                    <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px] font-bold">
                      Critical
                    </span>
                  )}
                  {parsedFlags.includes("IMPORTANT") && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                      Important
                    </span>
                  )}
                  {parsedFlags.includes("WORTH_REVIEWING") && (
                    <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 text-[10px] font-bold">
                      Review
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
