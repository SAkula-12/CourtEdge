"use client";

import React, { useState } from 'react';
import QRCode from 'react-qr-code';
import { Share2, Mail, Check, AlertTriangle, Send } from 'lucide-react';

interface GuestMatchTransferUIProps {
  matchId: string;
  // Match summary to send in teaser
  matchSummary: {
    player: string;
    opponent: string;
    scoreString: string;
  };
}

export function GuestMatchTransferUI({ matchId, matchSummary }: GuestMatchTransferUIProps) {
  const [claimCode, setClaimCode] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [email, setEmail] = useState("");
  const [isSendingTeaser, setIsSendingTeaser] = useState(false);
  const [teaserStatus, setTeaserStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [teaserMessage, setTeaserMessage] = useState("");

  const handleGenerateTransfer = async () => {
    setIsGenerating(true);
    try {
      // Mock API call to upload match to holding queue and get code
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Generate a random 6-digit alphanumeric code for demo
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      setClaimCode(code);
    } catch (error) {
      console.error("Failed to generate transfer code", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendTeaser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;

    setIsSendingTeaser(true);
    setTeaserStatus('idle');
    setTeaserMessage("");

    try {
      const res = await fetch('/api/share/teaser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, matchSummary })
      });

      const data = await res.json();

      if (!res.ok) {
        setTeaserStatus('error');
        setTeaserMessage(data.message || data.error || "Failed to send summary.");
      } else {
        setTeaserStatus('success');
        setTeaserMessage("Complimentary summary sent! Tell them to check their inbox.");
        setEmail("");
      }
    } catch (error) {
      setTeaserStatus('error');
      setTeaserMessage("Network error. Please try again.");
    } finally {
      setIsSendingTeaser(false);
    }
  };

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const claimUrl = `${baseUrl}/claim-match`;

  return (
    <div className="w-full max-w-xl mx-auto space-y-6">
      
      {/* Handshake UI */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400">
            <Share2 size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Transfer Match Data</h2>
            <p className="text-sm text-slate-400">You scored this match as a Guest. Transfer it to a player's profile.</p>
          </div>
        </div>

        {!claimCode ? (
          <button
            onClick={handleGenerateTransfer}
            disabled={isGenerating}
            className="w-full py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all flex justify-center items-center gap-2 shadow-lg shadow-indigo-500/20"
          >
            {isGenerating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Generate Claim Code"}
          </button>
        ) : (
          <div className="flex flex-col md:flex-row items-center gap-8 bg-slate-950 p-6 rounded-2xl border border-slate-800">
            <div className="bg-white p-3 rounded-xl">
              <QRCode value={claimUrl} size={120} level="Q" />
            </div>
            <div className="text-center md:text-left flex-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">Claim Code</p>
              <div className="text-4xl font-mono font-bold text-white tracking-[0.2em] mb-4 bg-slate-900 py-3 px-4 rounded-xl inline-block border border-slate-700">
                {claimCode}
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                Have the player go to <span className="text-indigo-400 font-medium">courtedge.app/claim</span> or scan the QR code and enter this 6-digit code.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Viral Acquisition Teaser UI */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-400">
            <Mail size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Email Match Summary</h2>
            <p className="text-sm text-slate-400">Send a 1-time complimentary teaser summary to a player.</p>
          </div>
        </div>

        <form onSubmit={handleSendTeaser} className="space-y-4">
          <div className="flex gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="player@example.com"
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all placeholder:text-slate-600"
            />
            <button
              type="submit"
              disabled={isSendingTeaser || !email}
              className="px-6 py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold rounded-xl flex items-center gap-2 transition-all"
            >
              {isSendingTeaser ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send size={18} /> Send</>}
            </button>
          </div>

          {teaserStatus === 'error' && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
              <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-400 leading-relaxed">{teaserMessage}</p>
            </div>
          )}

          {teaserStatus === 'success' && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3">
              <Check size={18} className="text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-400 leading-relaxed">{teaserMessage}</p>
            </div>
          )}
        </form>
      </div>

    </div>
  );
}
