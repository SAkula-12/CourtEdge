"use client";

import React, { useState } from 'react';
import { AlertTriangle, Check, User, HelpCircle } from 'lucide-react';

interface ConflictingObservation {
  id: string;
  contributorId: string;
  contributorRole: string; // 'Primary Scorer' | 'Secondary Observer'
  classification: string;
  shotType: string;
}

interface ConflictPoint {
  pointId: string;
  gameScoreContext: string;
  observations: ConflictingObservation[];
}

interface ConflictResolutionUIProps {
  conflicts: ConflictPoint[];
  onResolve: (pointId: string, resolvedObservationId: string | null) => void;
}

export function ConflictResolutionUI({ conflicts, onResolve }: ConflictResolutionUIProps) {
  const [activeConflictIdx, setActiveConflictIdx] = useState(0);

  if (!conflicts || conflicts.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-900 rounded-3xl border border-slate-800">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
          <Check size={32} className="text-emerald-400" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">No Conflicts Found</h3>
        <p className="text-slate-400 text-sm">All scorer observations align perfectly.</p>
      </div>
    );
  }

  const currentConflict = conflicts[activeConflictIdx];

  const handleSelect = (obsId: string | null) => {
    onResolve(currentConflict.pointId, obsId);
    if (activeConflictIdx < conflicts.length - 1) {
      setActiveConflictIdx(prev => prev + 1);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
      <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
          <AlertTriangle size={20} className="text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Review Conflicting Data</h2>
          <p className="text-xs text-slate-400">
            Conflict {activeConflictIdx + 1} of {conflicts.length}
          </p>
        </div>
      </div>

      <div className="mb-6">
        <p className="text-sm font-semibold text-slate-300 mb-1">Point Context</p>
        <p className="text-xl font-mono text-white bg-slate-800 py-2 px-4 rounded-xl inline-block">
          {currentConflict.gameScoreContext}
        </p>
      </div>

      <div className="space-y-3 mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Select Correct Observation</p>
        {currentConflict.observations.map((obs) => (
          <button
            key={obs.id}
            onClick={() => handleSelect(obs.id)}
            className="w-full text-left p-4 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-blue-500/50 transition-all group"
          >
            <div className="flex items-center gap-2 mb-2">
              <User size={14} className="text-slate-400" />
              <span className="text-xs font-medium text-slate-400">
                {obs.contributorRole} ({obs.contributorId.substring(0,6)})
              </span>
            </div>
            <div className="text-base font-bold text-white group-hover:text-blue-400 transition-colors">
              {obs.classification} <span className="text-slate-500 font-normal">— {obs.shotType}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="pt-4 border-t border-slate-800">
        <button
          onClick={() => handleSelect(null)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-800 text-slate-300 font-medium hover:bg-slate-700 transition-colors"
        >
          <HelpCircle size={16} />
          Leave as Uncertain (Flag for later)
        </button>
      </div>
    </div>
  );
}
