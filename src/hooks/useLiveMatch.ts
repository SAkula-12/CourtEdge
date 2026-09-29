import { useState, useEffect, useCallback } from 'react';

// Mock types for the architecture
export type ScorerRole = 'PRIMARY' | 'SECONDARY';

interface LiveMatchState {
  matchId: string | null;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  role: ScorerRole;
  primaryScorerId: string | null;
  matchData: any; // In real app, this maps to DBMatch & LiveScore
}

/**
 * Hook for subscribing to a live match document via Firebase/Supabase real-time listeners.
 * Also handles optimistic UI updates and role transfers.
 */
export function useLiveMatch(matchId: string, initialRole: ScorerRole = 'SECONDARY', userId: string) {
  const [state, setState] = useState<LiveMatchState>({
    matchId,
    status: 'connecting',
    role: initialRole,
    primaryScorerId: null,
    matchData: null,
  });

  useEffect(() => {
    if (!matchId) return;

    setState(prev => ({ ...prev, status: 'connecting' }));

    // TODO: Replace with actual Firestore onSnapshot or Supabase channel
    /*
      const unsubscribe = onSnapshot(doc(db, "matches", matchId), (doc) => {
        const data = doc.data();
        setState(prev => ({
          ...prev,
          status: 'connected',
          matchData: data,
          role: data.primaryScorerId === userId ? 'PRIMARY' : 'SECONDARY',
          primaryScorerId: data.primaryScorerId
        }));
      }, (error) => {
        setState(prev => ({ ...prev, status: 'error' }));
      });
      return () => unsubscribe();
    */

    // MOCK IMPLEMENTATION
    const timer = setTimeout(() => {
      setState(prev => ({
        ...prev,
        status: 'connected',
        matchData: { score: { playerPoints: 0, opponentPoints: 0 } },
        primaryScorerId: initialRole === 'PRIMARY' ? userId : 'mock_primary_user'
      }));
    }, 1000);

    return () => clearTimeout(timer);
  }, [matchId, userId, initialRole]);

  // Optimistic UI Update function
  const updateMatchOptimistically = useCallback(async (mutationData: any) => {
    // 1. Instantly update local state for the UI
    setState(prev => ({
      ...prev,
      matchData: { ...prev.matchData, ...mutationData }
    }));

    // 2. Push to backend (TODO: Implement actual Firebase/Supabase setDoc/updateDoc)
    try {
      // await updateDoc(doc(db, "matches", matchId), mutationData);
    } catch (err) {
      // 3. Rollback local state if backend update fails
      console.error('Failed to sync mutation, rolling back...', err);
      // rollback logic here
    }
  }, [matchId]);

  // Role Transfer Function
  const transferPrimaryRole = useCallback(async (targetUserId: string) => {
    if (state.role !== 'PRIMARY') {
      throw new Error("Only the Primary Scorer can transfer roles.");
    }
    
    // Update local state optimistically
    setState(prev => ({
      ...prev,
      role: 'SECONDARY',
      primaryScorerId: targetUserId
    }));

    // TODO: Implement actual backend update
    /*
      await updateDoc(doc(db, "matches", matchId), {
        primaryScorerId: targetUserId
      });
    */
  }, [matchId, state.role]);

  return {
    ...state,
    updateMatchOptimistically,
    transferPrimaryRole
  };
}
