"use client";

import { useState } from "react";
import { useMatchStore, type MatchSetup } from "@/stores/matchStore";
import { ChevronRight, CircleDot } from "lucide-react";

const PRESET_FORMATS = ["BEST_OF_1", "BEST_OF_3", "BEST_OF_5"] as const;
const PRESET_SURFACES = ["HARD", "CLAY", "GRASS"];

export function MatchSetupForm() {
  const confirmSetup = useMatchStore((s) => s.confirmSetup);

  const [form, setForm] = useState<MatchSetup>({
    playerName: "",
    opponentName: "",
    format: "BEST_OF_3",
    surface: "HARD",
    firstServer: "PLAYER",
  });

  const [showCustomFormat, setShowCustomFormat] = useState(false);
  const [customFormat, setCustomFormat] = useState("");
  const [showCustomSurface, setShowCustomSurface] = useState(false);
  const [customSurface, setCustomSurface] = useState("");

  const canStart = form.playerName.trim() !== "" && form.opponentName.trim() !== "";

  const handleSubmit = async () => {
    if (!canStart) return;
    const finalForm = { ...form };
    if (showCustomFormat && customFormat.trim()) {
      finalForm.format = customFormat.trim();
    }
    if (showCustomSurface && customSurface.trim()) {
      finalForm.surface = customSurface.trim();
    }
    await confirmSetup(finalForm);
  };

  const formatLabel = (fmt: string) =>
    fmt === "BEST_OF_1" ? "1 Set" : fmt === "BEST_OF_3" ? "Best of 3" : "Best of 5";

  return (
    <div className="max-w-lg mx-auto p-6 md:p-10 animate-in fade-in">
      <h1 className="text-2xl md:text-3xl font-bold mb-1">New Match</h1>
      <p className="text-slate-400 text-sm mb-8">Set up match details before scoring.</p>

      <div className="space-y-6">
        {/* Player Name */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Your Name</label>
          <input
            type="text"
            value={form.playerName}
            onChange={(e) => setForm({ ...form, playerName: e.target.value })}
            placeholder="e.g. Alex"
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        {/* Opponent Name */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Opponent</label>
          <input
            type="text"
            value={form.opponentName}
            onChange={(e) => setForm({ ...form, opponentName: e.target.value })}
            placeholder="e.g. Jordan"
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        {/* Match Format */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Match Format</label>
          <div className="grid grid-cols-4 gap-2">
            {PRESET_FORMATS.map((fmt) => {
              const isActive = !showCustomFormat && form.format === fmt;
              return (
                <button
                  key={fmt}
                  onClick={() => {
                    setShowCustomFormat(false);
                    setForm({ ...form, format: fmt });
                  }}
                  className={`py-3 rounded-xl text-sm font-medium border transition-all ${
                    isActive
                      ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20"
                      : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500"
                  }`}
                >
                  {formatLabel(fmt)}
                </button>
              );
            })}
            <button
              onClick={() => {
                setShowCustomFormat(true);
                setForm({ ...form, format: "" });
              }}
              className={`py-3 rounded-xl text-sm font-medium border transition-all ${
                showCustomFormat
                  ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20"
                  : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500"
              }`}
            >
              Other
            </button>
          </div>
          {showCustomFormat && (
            <input
              type="text"
              value={customFormat}
              onChange={(e) => setCustomFormat(e.target.value)}
              placeholder="e.g. 8-game pro set"
              autoFocus
              className="mt-3 w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          )}
        </div>

        {/* Surface */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Surface</label>
          <div className="grid grid-cols-4 gap-2">
            {PRESET_SURFACES.map((s) => {
              const isActive = !showCustomSurface && form.surface === s;
              return (
                <button
                  key={s}
                  onClick={() => {
                    setShowCustomSurface(false);
                    setForm({ ...form, surface: s });
                  }}
                  className={`py-2.5 rounded-xl text-xs font-medium border transition-all capitalize ${
                    isActive
                      ? "bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                      : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500"
                  }`}
                >
                  {s.toLowerCase()}
                </button>
              );
            })}
            <button
              onClick={() => {
                setShowCustomSurface(true);
                setForm({ ...form, surface: "" });
              }}
              className={`py-2.5 rounded-xl text-xs font-medium border transition-all ${
                showCustomSurface
                  ? "bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                  : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500"
              }`}
            >
              Other
            </button>
          </div>
          {showCustomSurface && (
            <input
              type="text"
              value={customSurface}
              onChange={(e) => setCustomSurface(e.target.value)}
              placeholder="e.g. Indoor carpet"
              autoFocus
              className="mt-3 w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          )}
        </div>

        {/* First Server */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">First Server</label>
          <div className="grid grid-cols-2 gap-3">
            {(["PLAYER", "OPPONENT"] as const).map((who) => {
              const isActive = form.firstServer === who;
              const displayName = who === "PLAYER" ? (form.playerName || "You") : (form.opponentName || "Opponent");
              return (
                <button
                  key={who}
                  onClick={() => setForm({ ...form, firstServer: who })}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium border transition-all ${
                    isActive
                      ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                      : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500"
                  }`}
                >
                  <CircleDot size={14} />
                  {displayName}
                </button>
              );
            })}
          </div>
        </div>

        {/* Start Button */}
        <button
          onClick={handleSubmit}
          disabled={!canStart}
          className={`w-full py-4 rounded-xl text-base font-bold flex items-center justify-center gap-2 transition-all mt-4 ${
            canStart
              ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/30 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]"
              : "bg-slate-800 text-slate-500 cursor-not-allowed"
          }`}
        >
          Start Match
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
