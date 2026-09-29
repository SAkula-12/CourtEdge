"use client";

import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, AlertTriangle, ShieldCheck } from "lucide-react";
import { ScoringInterface } from "@/components/gametime/ScoringInterface";

export default function LiveScorePage({ params }: { params: Promise<{ matchId: string }> }) {
  const resolvedParams = use(params);
  const { matchId } = resolvedParams;
  
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  
  const [isValidating, setIsValidating] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // In a real implementation, you would validate the token against your backend
  useEffect(() => {
    const validateToken = async () => {
      setIsValidating(true);
      try {
        await new Promise(resolve => setTimeout(resolve, 800));
        if (!token || token.length > 0) {
          setIsAuthorized(true);
        } else {
          setIsAuthorized(false);
        }
      } catch (error) {
        setIsAuthorized(false);
      } finally {
        setIsValidating(false);
      }
    };
    validateToken();
  }, [matchId, token]);

  if (isValidating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-950 text-center animate-in fade-in duration-300">
        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
          <Loader2 size={24} className="animate-spin" />
        </div>
        <h2 className="text-base font-bold text-white tracking-wide mb-1">Authenticating Access...</h2>
        <p className="text-xs text-slate-400">Verifying secure token</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-950 text-center animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-6">
          <AlertTriangle size={32} />
        </div>
        <h2 className="text-xl font-bold text-white tracking-wide mb-2">Invalid or Expired Link</h2>
        <p className="text-sm text-slate-400 mb-8 max-w-[280px]">
          This temporary scoring link is no longer active. Please ask the primary scorer for a new QR code.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-200">
      <div className="p-2 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-center gap-2">
        <ShieldCheck size={16} className="text-emerald-400" />
        <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">
          Secure Observer Mode Active
        </span>
      </div>
      <div className="flex-1 w-full max-w-lg mx-auto relative">
        <ScoringInterface role="OBSERVER" />
      </div>
    </div>
  );
}

