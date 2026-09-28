"use client";

import { useEffect, useState } from "react";
import { db, type DBPoint, type DBNote } from "@/lib/db";
import { FileText, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";

interface NotesLogProps {
  matchId: string | null;
}

interface PointNoteItem {
  id: string;
  gameNumber: number;
  pointNumber: number;
  winner: "PLAYER" | "OPPONENT";
  classification: string;
  text: string;
}

export function NotesLog({ matchId }: NotesLogProps) {
  const [matchNotes, setMatchNotes] = useState<DBNote[]>([]);
  const [pointNotes, setPointNotes] = useState<PointNoteItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!matchId) return;

    let isMounted = true;

    async function loadNotes() {
      // 1. Fetch match-level notes from db.notes
      const mNotes = await db.notes
        .where("matchId")
        .equals(matchId!)
        .filter((n) => n.scope === "MATCH")
        .toArray();

      // 2. Fetch point-level notes from db.points
      const points = await db.points.where("matchId").equals(matchId!).toArray();
      const games = await db.games.where("matchId").equals(matchId!).toArray();
      const gameMap = new Map<string, number>(games.map((g) => [g.id, g.gameNumber]));

      const pNotes: PointNoteItem[] = [];
      for (const p of points) {
        if (p.note && p.note.trim().length > 0) {
          pNotes.push({
            id: p.id,
            gameNumber: gameMap.get(p.gameId) ?? 1,
            pointNumber: p.pointNumber,
            winner: p.winner,
            classification: p.classification,
            text: p.note.trim(),
          });
        }
      }

      // Also include any notes saved in db.notes under scope 'POINT' or 'GAME'
      const extraNotes = await db.notes
        .where("matchId")
        .equals(matchId!)
        .filter((n) => n.scope === "POINT" || n.scope === "GAME")
        .toArray();

      for (const n of extraNotes) {
        pNotes.push({
          id: n.id,
          gameNumber: 1,
          pointNumber: 1,
          winner: "PLAYER",
          classification: n.scope === "GAME" ? "Game Note" : "Point Note",
          text: n.text,
        });
      }

      if (isMounted) {
        setMatchNotes(mNotes);
        setPointNotes(pNotes);
      }
    }

    loadNotes();

    return () => {
      isMounted = false;
    };
  }, [matchId]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 text-left mt-6 shadow-xl space-y-5">
      {/* Title Header */}
      <div className="flex items-center gap-2 text-sm font-bold text-slate-200 border-b border-slate-800 pb-3">
        <FileText size={16} className="text-blue-400" />
        <span>Notes Log</span>
      </div>

      {/* Section 1: Match Notes */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
          <MessageSquare size={13} className="text-emerald-400" />
          <span>Match Notes</span>
        </div>

        {matchNotes.length === 0 ? (
          <p className="text-xs text-slate-500 italic bg-slate-950/40 p-3 rounded-xl border border-slate-800/50">
            No match-level notes recorded for this match.
          </p>
        ) : (
          <div className="space-y-2">
            {matchNotes.map((note) => {
              const isExpanded = expandedId === note.id;
              const isLong = note.text.length > 80;

              return (
                <div
                  key={note.id}
                  onClick={() => isLong && toggleExpand(note.id)}
                  className={`bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-xs transition-all ${
                    isLong ? "cursor-pointer hover:border-slate-700" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-slate-200 leading-relaxed ${!isExpanded && isLong ? "line-clamp-2" : ""}`}>
                      &ldquo;{note.text}&rdquo;
                    </p>
                    {isLong && (
                      <span className="text-slate-500 shrink-0 pt-0.5">
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </span>
                    )}
                  </div>
                  {isLong && (
                    <span className="text-[10px] font-semibold text-blue-400 mt-1 block">
                      {isExpanded ? "Click to collapse" : "Click to view full note"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 2: Specific Point Notes */}
      <div>
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
          <div className="flex items-center gap-2">
            <FileText size={13} className="text-blue-400" />
            <span>Point Notes</span>
          </div>
          <span className="text-slate-500 font-mono">({pointNotes.length})</span>
        </div>

        {pointNotes.length === 0 ? (
          <p className="text-xs text-slate-500 italic bg-slate-950/40 p-3 rounded-xl border border-slate-800/50">
            No point-specific notes recorded for this match.
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {pointNotes.map((item) => {
              const isExpanded = expandedId === item.id;
              const isLong = item.text.length > 50;

              return (
                <div
                  key={item.id}
                  onClick={() => toggleExpand(item.id)}
                  className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-xs cursor-pointer hover:border-slate-700 transition-all space-y-1"
                >
                  {/* Item header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">
                        Game {item.gameNumber}, Point {item.pointNumber}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                        {item.winner === "PLAYER" ? "Won" : "Lost"} - {item.classification}
                      </span>
                    </div>
                    <span className="text-slate-500">
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </span>
                  </div>

                  {/* Truncated vs Full Note Content */}
                  <p className={`text-slate-300 italic ${!isExpanded ? "truncate max-w-full" : "whitespace-pre-wrap mt-2 leading-relaxed"}`}>
                    &ldquo;{item.text}&rdquo;
                  </p>

                  <div className="text-[10px] font-semibold text-blue-400/90 pt-0.5">
                    {isExpanded ? "Click to collapse" : isLong ? "Click to see full note..." : "Click to toggle"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
