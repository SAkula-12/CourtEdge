"use client";

import { useMatchStore } from "@/stores/matchStore";
import type { CriticalPointFlagType } from "@/models/types";
import { Flag, AlertTriangle, Star, Eye } from "lucide-react";

const FLAG_OPTIONS: {
  type: CriticalPointFlagType;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  activeClasses: string;
  inactiveClasses: string;
}[] = [
  {
    type: "IMPORTANT",
    label: "Important",
    icon: Star,
    activeClasses: "bg-amber-500/20 border-amber-500 text-amber-400 shadow-lg shadow-amber-500/10",
    inactiveClasses: "bg-slate-900/60 border-slate-700 text-slate-500 hover:border-amber-500/50 hover:text-amber-500/70",
  },
  {
    type: "CRITICAL",
    label: "Critical",
    icon: AlertTriangle,
    activeClasses: "bg-red-500/20 border-red-500 text-red-400 shadow-lg shadow-red-500/10",
    inactiveClasses: "bg-slate-900/60 border-slate-700 text-slate-500 hover:border-red-500/50 hover:text-red-500/70",
  },
  {
    type: "WORTH_REVIEWING",
    label: "Review",
    icon: Eye,
    activeClasses: "bg-purple-500/20 border-purple-500 text-purple-400 shadow-lg shadow-purple-500/10",
    inactiveClasses: "bg-slate-900/60 border-slate-700 text-slate-500 hover:border-purple-500/50 hover:text-purple-500/70",
  },
];

export function CriticalPointFlags() {
  const pendingFlags = useMatchStore((s) => s.pendingPointFlags);
  const toggleFlag = useMatchStore((s) => s.togglePointFlag);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        <Flag size={12} />
        <span>Flag this point</span>
      </div>
      <div className="flex gap-2">
        {FLAG_OPTIONS.map((opt) => {
          const isActive = pendingFlags.includes(opt.type);
          const Icon = opt.icon;
          return (
            <button
              key={opt.type}
              onClick={() => toggleFlag(opt.type)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 ${
                isActive ? opt.activeClasses : opt.inactiveClasses
              }`}
            >
              <Icon size={13} />
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
