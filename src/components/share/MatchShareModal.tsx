"use client";

import React, { useState } from "react";
import QRCode from "react-qr-code";
import { Eye, Users, Copy, Check, X, Shield, Lock, Globe } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";

interface MatchShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchId: string;
  token?: string;
}

export function MatchShareModal({
  isOpen,
  onClose,
  matchId,
  token = "live_token",
}: MatchShareModalProps) {
  const [accessMode, setAccessMode] = useState<"ANYONE" | "APPROVED">("ANYONE");
  const [copiedSpectator, setCopiedSpectator] = useState(false);
  const [copiedCoScorer, setCopiedCoScorer] = useState(false);

  if (!isOpen) return null;

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const spectatorUrl = `${baseUrl}/live-view/${matchId}?token=${token}_spectator&access=${accessMode.toLowerCase()}`;
  const coScorerUrl = `${baseUrl}/live-score/${matchId}?token=${token}_coscorer`;

  const copyToClipboard = async (text: string, type: "spectator" | "coscorer") => {
    try {
      triggerHaptic(40);
      await navigator.clipboard.writeText(text);
      if (type === "spectator") {
        setCopiedSpectator(true);
        setTimeout(() => setCopiedSpectator(false), 2000);
      } else {
        setCopiedCoScorer(true);
        setTimeout(() => setCopiedCoScorer(false), 2000);
      }
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl shadow-black/60 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/90">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-white tracking-wide">
              Share Match Access
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Choose the appropriate access link for spectators or scoring partners.
            </p>
          </div>
          <button
            onClick={() => {
              triggerHaptic(30);
              onClose();
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body: Split-Screen Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800 overflow-y-auto">
          {/* LEFT HALF: Spectator View-Only */}
          <div className="p-6 flex flex-col items-center text-center bg-gradient-to-b from-sky-950/20 to-transparent">
            {/* Header Badge */}
            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mb-3 shadow-md shadow-sky-500/5">
              <Eye size={24} />
            </div>

            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold text-white">Spectator (View-Only)</h3>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/20">
                Read-Only
              </span>
            </div>

            <p className="text-xs text-slate-400 mb-4 max-w-xs leading-relaxed">
              Share this with friends and family so they can watch live play-by-play updates.
            </p>

            {/* Access Control Toggle */}
            <div className="w-full max-w-xs mb-4">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 text-left">
                Access Control
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(30);
                    setAccessMode("ANYONE");
                  }}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                    accessMode === "ANYONE"
                      ? "bg-sky-600 text-white shadow-md shadow-sky-600/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Globe size={12} />
                  <span>Anyone</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(30);
                    setAccessMode("APPROVED");
                  }}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                    accessMode === "APPROVED"
                      ? "bg-sky-600 text-white shadow-md shadow-sky-600/30"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Lock size={12} />
                  <span>Approved Only</span>
                </button>
              </div>
            </div>

            {/* QR Code Container */}
            <div className="bg-white p-3.5 rounded-2xl shadow-xl shadow-sky-500/5 mb-4 border border-slate-200">
              <QRCode
                value={spectatorUrl}
                size={140}
                bgColor="#ffffff"
                fgColor="#0f172a"
                level="Q"
              />
            </div>

            {/* Copy Link Input Bar */}
            <div className="flex items-center gap-2 w-full max-w-xs mt-auto">
              <div className="flex-1 truncate bg-slate-950/90 border border-slate-800 rounded-xl px-3 py-2 text-[11px] text-slate-300 font-mono text-left">
                {spectatorUrl}
              </div>
              <button
                onClick={() => copyToClipboard(spectatorUrl, "spectator")}
                className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 ${
                  copiedSpectator
                    ? "bg-emerald-600 text-white"
                    : "bg-sky-600 hover:bg-sky-500 text-white"
                }`}
                title="Copy spectator link"
              >
                {copiedSpectator ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
            {copiedSpectator && (
              <span className="text-[11px] text-emerald-400 font-medium mt-1 animate-in fade-in">
                Spectator link copied to clipboard!
              </span>
            )}
          </div>

          {/* RIGHT HALF: Co-Scorer / Secondary Recorder */}
          <div className="p-6 flex flex-col items-center text-center bg-gradient-to-b from-indigo-950/20 to-transparent">
            {/* Header Badge */}
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3 shadow-md shadow-indigo-500/5">
              <Users size={24} />
            </div>

            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold text-white">Co-Scorer Access</h3>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                Co-Recorder
              </span>
            </div>

            <p className="text-xs text-slate-400 mb-4 max-w-xs leading-relaxed">
              Restricted access. Share this only with trusted individuals to help you log points and notes.
            </p>

            {/* Guardrail Notice Banner */}
            <div className="w-full max-w-xs mb-4 p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-left">
              <div className="flex items-start gap-2">
                <Shield size={14} className="text-indigo-400 shrink-0 mt-0.5" />
                <div className="text-[11px] text-indigo-200/90 leading-relaxed">
                  <span className="font-semibold text-white">Critical Action Guardrail:</span> Co-scorers have full scoring controls, but ending or suspending matches requires Primary Recorder approval.
                </div>
              </div>
            </div>

            {/* QR Code Container */}
            <div className="bg-white p-3.5 rounded-2xl shadow-xl shadow-indigo-500/5 mb-4 border border-slate-200">
              <QRCode
                value={coScorerUrl}
                size={140}
                bgColor="#ffffff"
                fgColor="#0f172a"
                level="Q"
              />
            </div>

            {/* Copy Link Input Bar */}
            <div className="flex items-center gap-2 w-full max-w-xs mt-auto">
              <div className="flex-1 truncate bg-slate-950/90 border border-slate-800 rounded-xl px-3 py-2 text-[11px] text-slate-300 font-mono text-left">
                {coScorerUrl}
              </div>
              <button
                onClick={() => copyToClipboard(coScorerUrl, "coscorer")}
                className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 ${
                  copiedCoScorer
                    ? "bg-emerald-600 text-white"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white"
                }`}
                title="Copy co-scorer link"
              >
                {copiedCoScorer ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
            {copiedCoScorer && (
              <span className="text-[11px] text-emerald-400 font-medium mt-1 animate-in fade-in">
                Co-Scorer link copied to clipboard!
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
