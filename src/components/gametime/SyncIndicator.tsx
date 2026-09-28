"use client";

import { useEffect } from "react";
import { useMatchStore } from "@/stores/matchStore";
import { Cloud, CloudOff, Loader2 } from "lucide-react";

/**
 * Visual indicator for offline sync state (Section 19).
 * Shows a persistent badge when:
 * 1. The device is offline, or
 * 2. There are unsynced matches in Dexie.
 */
export function SyncIndicator() {
  const isOnline = useMatchStore((s) => s.isOnline);
  const unsyncedCount = useMatchStore((s) => s.unsyncedCount);
  const setOnlineStatus = useMatchStore((s) => s.setOnlineStatus);
  const refreshSyncStatus = useMatchStore((s) => s.refreshSyncStatus);

  // Listen to browser online/offline events
  useEffect(() => {
    const handleOnline = () => setOnlineStatus(true);
    const handleOffline = () => setOnlineStatus(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial sync check
    refreshSyncStatus();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [setOnlineStatus, refreshSyncStatus]);

  // Re-check sync status periodically (every 30s)
  useEffect(() => {
    const interval = setInterval(refreshSyncStatus, 30_000);
    return () => clearInterval(interval);
  }, [refreshSyncStatus]);

  // Everything is online and synced — nothing to show
  if (isOnline && unsyncedCount === 0) return null;

  const isOfflineWithPending = !isOnline && unsyncedCount > 0;
  const isOnlineWithPending = isOnline && unsyncedCount > 0;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-300 ${
        isOfflineWithPending
          ? "bg-red-500/10 border-red-500/30 text-red-400"
          : !isOnline
          ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
          : isOnlineWithPending
          ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
          : ""
      }`}
    >
      {!isOnline ? (
        <>
          <CloudOff size={13} className="shrink-0" />
          <span>
            Offline{unsyncedCount > 0 ? ` · ${unsyncedCount} waiting to sync` : ""}
          </span>
        </>
      ) : isOnlineWithPending ? (
        <>
          <Loader2 size={13} className="shrink-0 animate-spin" />
          <span>{unsyncedCount} waiting to sync</span>
        </>
      ) : (
        <>
          <Cloud size={13} className="shrink-0" />
          <span>Synced</span>
        </>
      )}
    </div>
  );
}
