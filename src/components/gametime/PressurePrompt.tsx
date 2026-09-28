"use client";

import { useMatchStore } from "@/stores/matchStore";
import { AlertTriangle, Zap, Trophy, Shield, X } from "lucide-react";

const PRESSURE_CONFIG = {
  BREAK_POINT: {
    label: "Break Point",
    description: "Receiver can break serve",
    icon: Zap,
    gradient: "from-amber-500/20 to-orange-500/20",
    border: "border-amber-500/40",
    textColor: "text-amber-400",
    iconColor: "text-amber-400",
  },
  BREAK_POINT_AGAINST: {
    label: "Break Point Against",
    description: "Opponent can break your serve",
    icon: Shield,
    gradient: "from-orange-500/20 to-red-500/20",
    border: "border-orange-500/40",
    textColor: "text-orange-400",
    iconColor: "text-orange-400",
  },
  SET_POINT: {
    label: "Set Point",
    description: "This point could decide the set",
    icon: AlertTriangle,
    gradient: "from-purple-500/20 to-indigo-500/20",
    border: "border-purple-500/40",
    textColor: "text-purple-400",
    iconColor: "text-purple-400",
  },
  MATCH_POINT: {
    label: "Match Point",
    description: "This point could decide the match",
    icon: Trophy,
    gradient: "from-red-500/20 to-pink-500/20",
    border: "border-red-500/40",
    textColor: "text-red-400",
    iconColor: "text-red-400",
  },
} as const;

export function PressurePrompt() {
  const pressureContext = useMatchStore((s) => s.pressureContext);
  const dismissed = useMatchStore((s) => s.pressurePromptDismissed);
  const dismiss = useMatchStore((s) => s.dismissPressurePrompt);
  const toggleFlag = useMatchStore((s) => s.togglePointFlag);
  const pendingFlags = useMatchStore((s) => s.pendingPointFlags);

  if (!pressureContext || dismissed) return null;

  const config = PRESSURE_CONFIG[pressureContext];
  const Icon = config.icon;
  const alreadyFlagged = pendingFlags.includes("SYSTEM_DETECTED");

  return (
    <div
      className={`relative bg-gradient-to-r ${config.gradient} border ${config.border} rounded-xl p-3.5 animate-in slide-in-from-top-2 fade-in duration-300`}
    >
      <button
        onClick={dismiss}
        className="absolute top-2 right-2 text-slate-500 hover:text-white transition-colors"
      >
        <X size={14} />
      </button>

      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${config.iconColor}`}>
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold ${config.textColor}`}>{config.label}</p>
          <p className="text-xs text-slate-400 mt-0.5">{config.description}</p>
          <button
            onClick={() => {
              if (!alreadyFlagged) toggleFlag("SYSTEM_DETECTED");
              dismiss();
            }}
            className={`mt-2 text-xs font-medium px-3 py-1 rounded-lg border transition-all ${
              alreadyFlagged
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                : "bg-white/5 border-slate-600 text-slate-300 hover:bg-white/10 hover:border-slate-500"
            }`}
          >
            {alreadyFlagged ? "✓ Flagged" : "⚑ Auto-flag as Critical"}
          </button>
        </div>
      </div>
    </div>
  );
}
