"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, CheckCircle2, AlertTriangle, KeyRound } from "lucide-react";

export default function ClaimMatchPage() {
  const router = useRouter();
  const [claimCode, setClaimCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (claimCode.length !== 6) {
      setError("Claim code must be exactly 6 characters.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Mock API call to claim the match
      await new Promise(res => setTimeout(res, 1500));
      
      // In a real implementation:
      // const res = await fetch('/api/matches/claim', { method: 'POST', body: JSON.stringify({ code: claimCode }) });
      // if (!res.ok) throw new Error("Invalid or expired claim code.");

      setSuccess(true);
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to claim match. The code may be invalid or expired.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-950 text-center animate-in zoom-in duration-300">
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6 border border-emerald-500/20 shadow-[0_0_40px_rgba(16,185,129,0.2)]">
          <CheckCircle2 size={40} className="text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Match Claimed!</h1>
        <p className="text-slate-400">The match data has been permanently assigned to your profile.</p>
        <p className="text-xs text-slate-500 mt-4 animate-pulse">Redirecting to your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 mb-6 shadow-lg shadow-indigo-500/10">
          <UploadCloud size={28} className="text-indigo-400" />
        </div>
        
        <h1 className="text-2xl font-bold text-white mb-2">Claim Match Data</h1>
        <p className="text-sm text-slate-400 mb-8 leading-relaxed">
          Enter the 6-digit Claim Code provided by your guest scorer to permanently transfer the match data to your account.
        </p>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex gap-3 text-left">
            <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleClaim} className="space-y-6">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Claim Code
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <KeyRound size={18} className="text-slate-500" />
              </div>
              <input
                type="text"
                value={claimCode}
                onChange={(e) => setClaimCode(e.target.value.toUpperCase().trim())}
                maxLength={6}
                placeholder="e.g., A83K9Z"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-4 pl-12 pr-4 text-white font-mono text-lg tracking-[0.2em] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600 placeholder:tracking-normal"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || claimCode.length !== 6}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold text-base shadow-xl shadow-indigo-500/20 hover:shadow-2xl hover:shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Verifying...
              </>
            ) : (
              "Claim Match"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
