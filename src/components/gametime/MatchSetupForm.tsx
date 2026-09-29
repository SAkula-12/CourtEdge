"use client";

import { useState } from "react";
import { useMatchStore, type MatchSetup } from "@/stores/matchStore";
import { ChevronRight, CircleDot, Settings2 } from "lucide-react";

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
    tiebreakProcedure: "standard",
    thirdSetFormat: "full-set",
    scoringFormat: "ad",
  });

  const [showCustomFormat, setShowCustomFormat] = useState(false);
  const [customFormat, setCustomFormat] = useState("");
  const [showCustomSurface, setShowCustomSurface] = useState(false);
  const [customSurface, setCustomSurface] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

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

  // Only show 3rd-set format when Best of 3 (the only format where it applies)
  const showThirdSetOption = form.format === "BEST_OF_3" && !showCustomFormat;

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

        {/* Advanced Scoring Options Toggle */}
        <div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors group"
          >
            <Settings2 size={15} className={`transition-transform duration-300 ${showAdvanced ? 'rotate-90 text-blue-400' : 'group-hover:rotate-45'}`} />
            <span>{showAdvanced ? 'Hide' : 'Show'} Advanced Scoring Rules</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 ml-1">Optional</span>
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-5 p-4 rounded-xl bg-slate-900/50 border border-slate-800 animate-in fade-in slide-in-from-top-2 duration-200">

              {/* Scoring Format (Ad vs No-Ad) */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Scoring Format
                  <span className="ml-2 text-slate-600 normal-case font-normal">Deuce behavior</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: 'ad' as const, label: 'Advantage', desc: 'Standard deuce' },
                    { value: 'no-ad' as const, label: 'No-Ad', desc: 'Sudden death at 40-40' },
                  ]).map((opt) => {
                    const isActive = form.scoringFormat === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setForm({ ...form, scoringFormat: opt.value })}
                        className={`py-3 rounded-xl text-sm font-medium border transition-all ${
                          isActive
                            ? "bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-500/20"
                            : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500"
                        }`}
                      >
                        <div className="font-semibold">{opt.label}</div>
                        <div className={`text-[10px] mt-0.5 ${isActive ? 'text-violet-200' : 'text-slate-600'}`}>{opt.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Changeover Procedure
                  <span className="ml-2 text-slate-600 normal-case font-normal">When to switch sides</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: 'standard' as const, label: 'Standard', desc: 'End of every odd game (1st, 3rd, 5th, etc.)' },
                    { value: 'coman' as const, label: 'Coman', desc: 'After 1st, then every 4' },
                  ]).map((opt) => {
                    const isActive = form.tiebreakProcedure === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setForm({ ...form, tiebreakProcedure: opt.value })}
                        className={`py-3 rounded-xl text-sm font-medium border transition-all ${
                          isActive
                            ? "bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-500/20"
                            : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500"
                        }`}
                      >
                        <div className="font-semibold">{opt.label}</div>
                        <div className={`text-[10px] mt-0.5 ${isActive ? 'text-amber-200' : 'text-slate-600'}`}>{opt.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Third Set Format (only for Best of 3) */}
              {showThirdSetOption && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Deciding Set Format
                    <span className="ml-2 text-slate-600 normal-case font-normal">3rd set rules</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { value: 'full-set' as const, label: 'Full Set', desc: 'Normal set play' },
                      { value: '10-point-match-tiebreak' as const, label: 'Match Tiebreak', desc: 'First to 10 points' },
                    ]).map((opt) => {
                      const isActive = form.thirdSetFormat === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => setForm({ ...form, thirdSetFormat: opt.value })}
                          className={`py-3 rounded-xl text-sm font-medium border transition-all ${
                            isActive
                              ? "bg-teal-600 border-teal-500 text-white shadow-lg shadow-teal-500/20"
                              : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500"
                          }`}
                        >
                          <div className="font-semibold">{opt.label}</div>
                          <div className={`text-[10px] mt-0.5 ${isActive ? 'text-teal-200' : 'text-slate-600'}`}>{opt.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
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
