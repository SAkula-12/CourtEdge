"use client";

import React, { useState } from 'react';
import QRCode from 'react-qr-code';
import { Share2, Check, Copy } from 'lucide-react';

interface MatchShareQRProps {
  matchId: string;
  token: string;
}

export function MatchShareQR({ matchId, token }: MatchShareQRProps) {
  const [copied, setCopied] = useState(false);

  // Determine the base URL dynamically
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl = `${baseUrl}/live-score/${matchId}?token=${token}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-slate-900 rounded-3xl border border-slate-800">
      <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
        <Share2 size={24} />
      </div>
      <h3 className="text-xl font-bold text-white mb-2">Share Match</h3>
      <p className="text-sm text-slate-400 text-center mb-6 max-w-[250px]">
        Scan this QR code to join as a Secondary Observer and help log point details.
      </p>

      <div className="bg-white p-4 rounded-2xl shadow-xl shadow-blue-500/10 mb-6">
        <QRCode 
          value={shareUrl}
          size={180}
          bgColor="#ffffff"
          fgColor="#0f172a"
          level="Q"
        />
      </div>

      <div className="flex items-center gap-2 w-full max-w-sm">
        <div className="flex-1 truncate bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-xs text-slate-300 font-mono">
          {shareUrl}
        </div>
        <button
          onClick={copyToClipboard}
          className="shrink-0 w-12 h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center justify-center transition-colors active:scale-95"
        >
          {copied ? <Check size={18} /> : <Copy size={18} />}
        </button>
      </div>
    </div>
  );
}
