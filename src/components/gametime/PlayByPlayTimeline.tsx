"use client";

import { useEffect, useState, useCallback } from "react";
import { useMatchStore } from "@/stores/matchStore";
import { db, DBPoint, DBGame, DBSet } from "@/lib/db";
import { Activity, MessageSquare, ChevronDown, ChevronUp, History } from "lucide-react";

const POINT_LABELS = ["0", "15", "30", "40"] as const;

interface TimelineItem {
  id: string;
  pointNumber: number;
  setNumber: number;
  gameNumber: number;
  scoreContext: string;
  winnerName: string;
  winnerSide: "PLAYER" | "OPPONENT";
  classificationLabel: string;
  shotTypeLabel?: string;
  note?: string;
  flags: string[];
  timestamp: string;
}

function formatClassification(cls: string): string {
  if (!cls) return "Point";
  return cls
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatShotType(shot?: string): string {
  if (!shot) return "";
  return shot
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

export function PlayByPlayTimeline() {
  const matchId = useMatchStore((s) => s.matchId);
  const setup = useMatchStore((s) => s.setup);
  const score = useMatchStore((s) => s.score);
  const pointsInGame = useMatchStore((s) => s.pointsInGame);

  const [items, setItems] = useState<TimelineItem[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);

  const playerName = setup?.playerName || "Player";
  const opponentName = setup?.opponentName || "Opponent";

  const loadTimeline = useCallback(async () => {
    if (!matchId) return;

    try {
      const sets = await db.sets.where("matchId").equals(matchId).sortBy("setNumber");
      const games = await db.games.where("matchId").equals(matchId).sortBy("gameNumber");
      const points = await db.points.where("matchId").equals(matchId).sortBy("pointNumber");

      const setsMap = new Map<string, DBSet>();
      sets.forEach((s) => setsMap.set(s.id, s));

      const pointsByGame = new Map<string, DBPoint[]>();
      points.forEach((pt) => {
        const list = pointsByGame.get(pt.gameId) || [];
        list.push(pt);
        pointsByGame.set(pt.gameId, list);
      });

      const timeline: TimelineItem[] = [];

      games.forEach((game) => {
        const gamePts = pointsByGame.get(game.id) || [];
        const setObj = setsMap.get(game.setId);
        const setNumber = setObj?.setNumber || 1;

        let p1Pts = 0;
        let p2Pts = 0;
        let isDeuce = false;
        let advantage: "PLAYER" | "OPPONENT" | undefined = undefined;

        gamePts.forEach((pt) => {
          let scoreStr = "";
          if (game.isTiebreak) {
            scoreStr = `${p1Pts}-${p2Pts}`;
          } else {
            if (isDeuce) {
              if (advantage === "PLAYER") {
                scoreStr = "Ad-In";
              } else if (advantage === "OPPONENT") {
                scoreStr = "Ad-Out";
              } else {
                scoreStr = "40-40 (Deuce)";
              }
            } else {
              const p1Label = p1Pts <= 3 ? POINT_LABELS[p1Pts] : "40";
              const p2Label = p2Pts <= 3 ? POINT_LABELS[p2Pts] : "40";
              scoreStr = `${p1Label}-${p2Label}`;
            }
          }

          let parsedFlags: string[] = [];
          if (pt.flags) {
            try {
              parsedFlags = JSON.parse(pt.flags);
            } catch {}
          }

          timeline.push({
            id: pt.id,
            pointNumber: pt.pointNumber,
            setNumber,
            gameNumber: game.gameNumber,
            scoreContext: `Set ${setNumber}, Game ${game.gameNumber} (${scoreStr})`,
            winnerName: pt.winner === "PLAYER" ? playerName : opponentName,
            winnerSide: pt.winner,
            classificationLabel: formatClassification(pt.classification),
            shotTypeLabel: formatShotType(pt.shotType),
            note: pt.note,
            flags: parsedFlags,
            timestamp: pt.timestamp,
          });

          if (game.isTiebreak) {
            if (pt.winner === "PLAYER") p1Pts++;
            else p2Pts++;
          } else {
            if (pt.winner === "PLAYER") {
              if (isDeuce) {
                if (advantage === "OPPONENT") {
                  advantage = undefined;
                } else {
                  advantage = "PLAYER";
                  isDeuce = false;
                }
              } else if (advantage === "OPPONENT") {
                advantage = undefined;
                isDeuce = true;
              } else {
                p1Pts++;
                if (p1Pts >= 3 && p2Pts >= 3 && p1Pts === p2Pts) {
                  isDeuce = true;
                }
              }
            } else {
              if (isDeuce) {
                if (advantage === "PLAYER") {
                  advantage = undefined;
                } else {
                  advantage = "OPPONENT";
                  isDeuce = false;
                }
              } else if (advantage === "PLAYER") {
                advantage = undefined;
                isDeuce = true;
              } else {
                p2Pts++;
                if (p1Pts >= 3 && p2Pts >= 3 && p1Pts === p2Pts) {
                  isDeuce = true;
                }
              }
            }
          }
        });
      });

      timeline.sort((a, b) => b.pointNumber - a.pointNumber);
      setItems(timeline);
    } catch (err) {
      console.error("Failed to load play-by-play timeline:", err);
    }
  }, [matchId, playerName, opponentName]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline, pointsInGame, score]);

  if (!matchId) return null;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl mt-6">
      {/* Header Bar */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-3.5 flex items-center justify-between bg-slate-900 border-b border-slate-800 hover:bg-slate-850 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Activity size={15} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              Play-by-Play Timeline
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {items.length} {items.length === 1 ? "Point" : "Points"}
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">Live sports point ticker</p>
          </div>
        </div>
        <div className="text-slate-400 hover:text-white transition-colors">
          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {/* Timeline List */}
      {isExpanded && (
        <div className="p-4 max-h-80 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-slate-700">
          {items.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              <History size={24} className="mx-auto mb-2 opacity-40" />
              No points recorded yet. Log a point to start the live ticker.
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col gap-1.5"
              >
                {/* Top Row: Score context & Timestamp */}
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-semibold text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700/50">
                    {item.scoreContext}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    Point #{item.pointNumber}
                  </span>
                </div>

                {/* Main Row: Winner & Classification */}
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-bold text-sm ${
                        item.winnerSide === "PLAYER" ? "text-blue-400" : "text-indigo-400"
                      }`}
                    >
                      {item.winnerName}
                    </span>
                    <span className="text-xs text-slate-400">won point</span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/20">
                      {item.classificationLabel}
                    </span>
                    {item.shotTypeLabel && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                        {item.shotTypeLabel}
                      </span>
                    )}
                  </div>
                </div>

                {/* Point Note Callout */}
                {item.note && (
                  <div className="mt-1 flex items-start gap-1.5 text-xs text-slate-300 bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800">
                    <MessageSquare size={13} className="text-blue-400 shrink-0 mt-0.5" />
                    <span className="italic">{item.note}</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
