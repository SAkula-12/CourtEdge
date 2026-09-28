"use client";

import { useEffect, useState, useRef } from "react";
import { useMatchStore } from "@/stores/matchStore";
import { Check, CloudOff, Loader2, RefreshCw } from "lucide-react";

/**
 * Visual indicator for offline sync state (Section 19).
 * Shows a persistent badge when:
 * 1. The device is offline, or
 * 2. There are unsynced matches in Dexie.
 * When sync finishes, displays a green success state before hiding.
 */
export function SyncIndicator() {
  const isOnline = useMatchStore((s) => s.isOnline);
  const unsyncedCount = useMatchStore((s) => s.unsyncedCount);
  const isSyncing = useMatchStore((s) => s.isSyncing);
  const setOnlineStatus = useMatchStore((s) => s.setOnlineStatus);
  const refreshSyncStatus = useMatchStore((s) => s.refreshSyncStatus);
  const syncPendingMatches = useMatchStore((s) => s.syncPendingMatches);

  const [showSuccess, setShowSuccess] = useState(false);
  const prevUnsyncedRef = useRef(unsyncedCount);

  // Listen to browser online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setOnlineStatus(true);
      syncPendingMatches();
    };
    const handleOffline = () => setOnlineStatus(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial sync check
    refreshSyncStatus();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [setOnlineStatus, refreshSyncStatus, syncPendingMatches]);

  // Auto-sync when online and there are unsynced matches
  useEffect(() => {
    if (isOnline && unsyncedCount > 0 && !isSyncing) {
      syncPendingMatches();
    }
  }, [isOnline, unsyncedCount, isSyncing, syncPendingMatches]);

  // Show temporary green success toast when count drops from >0 to 0
  useEffect(() => {
    if (prevUnsyncedRef.current > 0 && unsyncedCount === 0 && isOnline) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 4000);
      return () => clearTimeout(timer);
    }
    prevUnsyncedRef.current = unsyncedCount;
  }, [unsyncedCount, isOnline]);

  // Everything is online and fully synced (and not showing success) — hide badge
  if (isOnline && unsyncedCount === 0 && !showSuccess && !isSyncing) return null;

  const isOfflineWithPending = !isOnline && unsyncedCount > 0;
  const isOnlineWithPending = isOnline && unsyncedCount > 0;

  return (
    <button
      onClick={() => isOnline && syncPendingMatches()}
      disabled={isSyncing || !isOnline}
      title={isOnline ? "Click to sync now" : "Offline mode active"}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-300 shadow-sm ${
        showSuccess
          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
          : isOfflineWithPending
          ? "bg-red-500/10 border-red-500/30 text-red-400 cursor-not-allowed"
          : !isOnline
          ? "bg-amber-500/10 border-amber-500/30 text-amber-400 cursor-not-allowed"
          : isOnlineWithPending || isSyncing
          ? "bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20 cursor-pointer"
          : "bg-slate-800 border-slate-700 text-slate-300"
      }`}
    >
      {showSuccess ? (
        <>
          <Check size={13} className="shrink-0 text-emerald-400 animate-bounce" />
          <span>All matches synced!</span>
        </>
      ) : !isOnline ? (
        <>
          <CloudOff size={13} className="shrink-0" />
          <span>
            Offline{unsyncedCount > 0 ? ` · ${unsyncedCount} waiting to sync` : ""}
          </span>
        </>
      ) : isSyncing ? (
        <>
          <Loader2 size={13} className="shrink-0 animate-spin text-blue-400" />
          <span>Syncing {unsyncedCount} match{unsyncedCount === 1 ? "" : "es"}...</span>
        </>
      ) : isOnlineWithPending ? (
        <>
          <RefreshCw size={13} className="shrink-0 text-blue-400" />
          <span>{unsyncedCount} waiting to sync · Sync now</span>
        </>
      ) : null}
    </button>
  );
}

