import { create } from 'zustand';
import { db } from '@/lib/db';
import type { DBMatch, DBSet, DBGame, DBPoint, DBNote } from '@/lib/db';
import { PointClassification } from '@/models/types';
import type { CriticalPointFlagType } from '@/models/types';

/* ------------------------------------------------------------------ */
/*  Tennis scoring helpers                                            */
/* ------------------------------------------------------------------ */

const POINT_LABELS = ['0', '15', '30', '40'] as const;

function nextPointScore(current: number): number {
  // 0→1→2→3  (maps to 0,15,30,40 via POINT_LABELS)
  return current + 1;
}

/* ------------------------------------------------------------------ */
/*  Store shape                                                       */
/* ------------------------------------------------------------------ */

export interface MatchSetup {
  playerName: string;
  opponentName: string;
  format: 'BEST_OF_1' | 'BEST_OF_3' | 'BEST_OF_5' | string;
  surface: string;
  firstServer: 'PLAYER' | 'OPPONENT';
}

interface LiveScore {
  playerPoints: number;  // 0-3 index into POINT_LABELS, or raw count in tiebreak
  opponentPoints: number;
  playerGames: number;
  opponentGames: number;
  playerSets: number;
  opponentSets: number;
  currentServer: 'PLAYER' | 'OPPONENT';
  isTiebreak: boolean;
  isDeuce: boolean;
  advantage?: 'PLAYER' | 'OPPONENT';
}

/** System-detected pressure context (Section 18.2) */
export type PressureContext =
  | 'BREAK_POINT'
  | 'SET_POINT'
  | 'MATCH_POINT'
  | 'BREAK_POINT_AGAINST'
  | null;

/** Snapshot stored per-point for undo */
interface UndoSnapshot {
  score: LiveScore;
  pointsInGame: number;
  currentSetId: string;
  currentGameId: string;
  setsPlayed: DBSet[];
  phase: MatchState['phase'];
  /** DB entities to delete on undo */
  pointId: string;
  /** If the point ended a game, we created a new game — need to delete it too */
  createdGameId?: string;
  /** If the point ended a set, we created a new set — need to delete it too */
  createdSetId?: string;
  /** If the previous game had no winner yet but we set one, revert it */
  previousGameId?: string;
  /** If the previous set was updated, revert it */
  previousSetId?: string;
  previousSetData?: Partial<DBSet>;
  previousGameWinner?: 'PLAYER' | 'OPPONENT' | undefined;
  /** If match status was changed */
  previousMatchStatus?: 'IN_PROGRESS' | 'COMPLETED';
}

interface MatchState {
  // State
  phase: 'IDLE' | 'SETUP' | 'PLAYING' | 'POINT_DETAIL' | 'SHOT_DETAIL' | 'FINISHED';
  matchId: string | null;
  setup: MatchSetup | null;
  score: LiveScore;
  pendingPointWinner: 'PLAYER' | 'OPPONENT' | null;
  pendingClassification: PointClassification | null;
  currentSetId: string | null;
  currentGameId: string | null;
  pointsInGame: number;
  setsPlayed: DBSet[];

  // Point-level metadata (Section 16 & 18)
  pendingPointNote: string;
  pendingPointFlags: CriticalPointFlagType[];

  // System detection (Section 18.2)
  pressureContext: PressureContext;
  pressurePromptDismissed: boolean;

  // Undo stack (Section 17)
  undoStack: UndoSnapshot[];
  canUndo: boolean;

  // Offline sync (Section 19)
  isOnline: boolean;
  unsyncedCount: number;
  isSyncing: boolean;
  syncPendingMatches: () => Promise<void>;

  // Actions
  startSetup: () => void;
  confirmSetup: (setup: MatchSetup) => Promise<void>;
  selectPointWinner: (winner: 'PLAYER' | 'OPPONENT') => void;
  selectClassification: (classification: PointClassification) => void;
  confirmShotType: (shotType: string) => Promise<void>;
  confirmPoint: (classification: PointClassification, shotType?: string) => Promise<void>;
  cancelPointDetail: () => void;
  getPointLabel: (side: 'PLAYER' | 'OPPONENT') => string;

  // New actions
  setPointNote: (note: string) => void;
  togglePointFlag: (flag: CriticalPointFlagType) => void;
  dismissPressurePrompt: () => void;
  undoLastPoint: () => Promise<void>;
  finishMatch: (reason?: 'COMPLETED' | 'PLAYER_FORFEIT' | 'OPPONENT_FORFEIT' | 'CANCEL') => Promise<void>;
  resetMatch: () => void;
  saveGameNote: (text: string) => Promise<void>;
  saveMatchNote: (text: string) => Promise<void>;
  refreshSyncStatus: () => Promise<void>;
  setOnlineStatus: (online: boolean) => void;
}

/* ------------------------------------------------------------------ */
/*  ID helper                                                         */
/* ------------------------------------------------------------------ */

function uid(): string {
  return crypto.randomUUID();
}

/**
 * Determine how many sets a player needs to win.
 * - BEST_OF_1 → 1, BEST_OF_3 → 2, BEST_OF_5 → 3
 * - Custom strings: extract the first number and treat it as total sets.
 *   e.g. "4 set game" → need ceil(4/2) = 2 sets to win.
 *   Falls back to 2 (best-of-3 behaviour) if no number is found.
 */
function getSetsToWin(format: string): number {
  if (format === 'BEST_OF_1') return 1;
  if (format === 'BEST_OF_3') return 2;
  if (format === 'BEST_OF_5') return 3;

  const match = format.match(/(\d+)/);
  if (match) {
    const totalSets = parseInt(match[1], 10);
    if (totalSets > 0) return Math.ceil(totalSets / 2);
  }
  return 2; // default: best-of-3
}

/* ------------------------------------------------------------------ */
/*  Pressure context detection (Section 18.2)                         */
/* ------------------------------------------------------------------ */

function detectPressureContext(
  score: LiveScore,
  format: string,
): PressureContext {
  const setsToWin = getSetsToWin(format);

  const isReceiverPlayer = score.currentServer === 'OPPONENT';
  const isReceiverOpponent = score.currentServer === 'PLAYER';

  // In a standard game (non-tiebreak), check for break/set/match points.
  // A break point exists when the receiver could win the game on this point.
  if (!score.isTiebreak) {
    const pp = score.playerPoints;
    const op = score.opponentPoints;

    // Player can win this game on the next point
    const playerCanWinGame =
      (pp >= 3 && pp > op) ||    // 40-anything with lead
      pp >= 4;                    // past deuce

    // Opponent can win this game on the next point
    const opponentCanWinGame =
      (op >= 3 && op > pp) ||
      op >= 4;

    // Match point: either side is one set from winning AND can win this game → could win the set → could win the match
    const playerOnSetPoint = (score.playerGames >= 5 && score.playerGames > score.opponentGames) && playerCanWinGame;
    const opponentOnSetPoint = (score.opponentGames >= 5 && score.opponentGames > score.playerGames) && opponentCanWinGame;

    const playerOnMatchPoint = playerOnSetPoint && (score.playerSets + 1 >= setsToWin);
    const opponentOnMatchPoint = opponentOnSetPoint && (score.opponentSets + 1 >= setsToWin);

    if (playerOnMatchPoint || opponentOnMatchPoint) return 'MATCH_POINT';
    if (playerOnSetPoint || opponentOnSetPoint) return 'SET_POINT';

    // Break point: the receiver can win this game
    if (isReceiverPlayer && playerCanWinGame) return 'BREAK_POINT';
    if (isReceiverOpponent && opponentCanWinGame) return 'BREAK_POINT_AGAINST';
  } else {
    // Tiebreak: set point when one side reaches 6+ and leads by 1+
    const pp = score.playerPoints;
    const op = score.opponentPoints;

    const playerOnTBSetPoint = pp >= 6 && pp > op;
    const opponentOnTBSetPoint = op >= 6 && op > pp;

    const playerOnMatchPoint = playerOnTBSetPoint && (score.playerSets + 1 >= setsToWin);
    const opponentOnMatchPoint = opponentOnTBSetPoint && (score.opponentSets + 1 >= setsToWin);

    if (playerOnMatchPoint || opponentOnMatchPoint) return 'MATCH_POINT';
    if (playerOnTBSetPoint || opponentOnTBSetPoint) return 'SET_POINT';
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Zustand store                                                     */
/* ------------------------------------------------------------------ */

const initialScore: LiveScore = {
  playerPoints: 0,
  opponentPoints: 0,
  playerGames: 0,
  opponentGames: 0,
  playerSets: 0,
  opponentSets: 0,
  currentServer: 'PLAYER',
  isTiebreak: false,
  isDeuce: false,
};

export const useMatchStore = create<MatchState>((set, get) => ({
  phase: 'IDLE',
  matchId: null,
  setup: null,
  score: { ...initialScore },
  pendingPointWinner: null,
  pendingClassification: null,
  currentSetId: null,
  currentGameId: null,
  pointsInGame: 0,
  setsPlayed: [],

  // Point metadata
  pendingPointNote: '',
  pendingPointFlags: [],

  // Pressure
  pressureContext: null,
  pressurePromptDismissed: false,

  // Undo
  undoStack: [],
  canUndo: false,

  // Sync
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  unsyncedCount: 0,
  isSyncing: false,

  /* ---- Lifecycle ---- */

  startSetup: () => set({ phase: 'SETUP' }),

  confirmSetup: async (setup) => {
    const matchId = uid();
    const setId = uid();
    const gameId = uid();

    const dbMatch: DBMatch = {
      id: matchId,
      playerName: setup.playerName,
      opponentName: setup.opponentName,
      date: new Date().toISOString(),
      surface: setup.surface,
      format: setup.format as DBMatch['format'],
      status: 'IN_PROGRESS',
      firstServer: setup.firstServer,
      synced: 0,
    };

    const dbSet: DBSet = {
      id: setId,
      matchId,
      setNumber: 1,
      playerGames: 0,
      opponentGames: 0,
      tiebreak: false,
    };

    const dbGame: DBGame = {
      id: gameId,
      setId,
      matchId,
      gameNumber: 1,
      server: setup.firstServer,
      isTiebreak: false,
    };

    await db.matches.add(dbMatch);
    await db.sets.add(dbSet);
    await db.games.add(dbGame);

    // Refresh unsynced count
    const unsyncedCount = await db.matches.where('synced').equals(0).count();

    set({
      phase: 'PLAYING',
      matchId,
      setup,
      currentSetId: setId,
      currentGameId: gameId,
      pointsInGame: 0,
      setsPlayed: [dbSet],
      undoStack: [],
      canUndo: false,
      pendingPointNote: '',
      pendingPointFlags: [],
      pressureContext: null,
      pressurePromptDismissed: false,
      unsyncedCount,
      score: {
        ...initialScore,
        currentServer: setup.firstServer,
      },
    });
  },

  /* ---- Point flow (three-step: winner → classification → shot type) ---- */

  selectPointWinner: (winner) =>
    set({ pendingPointWinner: winner, pendingClassification: null, phase: 'POINT_DETAIL' }),

  selectClassification: (classification) => {
    if (classification === PointClassification.WINNER || classification === PointClassification.OPPONENT_WINNER) {
      // Winner needs a follow-up shot type selection
      set({ pendingClassification: classification, phase: 'SHOT_DETAIL' });
    } else {
      // Non-winner classifications skip shot type and commit immediately
      get().confirmPoint(classification);
    }
  },

  confirmShotType: async (shotType) => {
    const state = get();
    await state.confirmPoint(state.pendingClassification!, shotType);
  },

  cancelPointDetail: () =>
    set({ pendingPointWinner: null, pendingClassification: null, phase: 'PLAYING' }),

  confirmPoint: async (classification, shotType) => {
    const state = get();
    const winner = state.pendingPointWinner!;
    const { score, matchId, currentSetId, currentGameId, pointsInGame } = state;

    // Build undo snapshot BEFORE mutating
    const undoSnapshot: UndoSnapshot = {
      score: { ...score },
      pointsInGame,
      currentSetId: currentSetId!,
      currentGameId: currentGameId!,
      setsPlayed: [...state.setsPlayed],
      phase: 'PLAYING',
      pointId: '', // filled after creating the point
    };

    // 1. Persist the point with note and flags
    const pointFlags = state.pendingPointFlags.length > 0
      ? JSON.stringify(state.pendingPointFlags)
      : undefined;

    const dbPoint: DBPoint = {
      id: uid(),
      gameId: currentGameId!,
      matchId: matchId!,
      pointNumber: pointsInGame + 1,
      server: score.currentServer,
      winner,
      classification,
      shotType,
      note: state.pendingPointNote || undefined,
      flags: pointFlags,
      isCritical: state.pendingPointFlags.length > 0 ? 1 : 0,
      timestamp: new Date().toISOString(),
    };
    await db.points.add(dbPoint);
    undoSnapshot.pointId = dbPoint.id;

    // 2. Compute new score
    const newScore = { ...score };
    let gameWon = false;
    let gameWinner: 'PLAYER' | 'OPPONENT' | null = null;

    if (score.isTiebreak) {
      // Tiebreak scoring
      if (winner === 'PLAYER') newScore.playerPoints++;
      else newScore.opponentPoints++;

      const p = newScore.playerPoints;
      const o = newScore.opponentPoints;
      if ((p >= 7 || o >= 7) && Math.abs(p - o) >= 2) {
        gameWon = true;
        gameWinner = p > o ? 'PLAYER' : 'OPPONENT';
      }

      // Server alternates every 2 points in tiebreak (after the first)
      const totalTBPoints = newScore.playerPoints + newScore.opponentPoints;
      if (totalTBPoints === 1 || (totalTBPoints > 1 && (totalTBPoints - 1) % 2 === 0)) {
        newScore.currentServer = newScore.currentServer === 'PLAYER' ? 'OPPONENT' : 'PLAYER';
      }
    } else {
      // Standard game scoring
      if (winner === 'PLAYER') newScore.playerPoints = nextPointScore(score.playerPoints);
      else newScore.opponentPoints = nextPointScore(score.opponentPoints);

      const p = newScore.playerPoints;
      const o = newScore.opponentPoints;

      if (p >= 3 && o >= 3) {
        // Deuce territory
        if (p === o) {
          newScore.isDeuce = true;
          newScore.advantage = undefined;
        } else if (Math.abs(p - o) === 1) {
          newScore.isDeuce = false;
          newScore.advantage = p > o ? 'PLAYER' : 'OPPONENT';
        } else {
          // Won from advantage
          gameWon = true;
          gameWinner = p > o ? 'PLAYER' : 'OPPONENT';
        }
      } else if (p >= 4 || o >= 4) {
        gameWon = true;
        gameWinner = p > o ? 'PLAYER' : 'OPPONENT';
      }
    }

    if (!gameWon) {
      // Detect pressure context for the NEXT point
      const pressure = detectPressureContext(newScore, state.setup!.format);
      const newUndoStack = [...state.undoStack, undoSnapshot];

      set({
        score: newScore,
        pendingPointWinner: null,
        pendingPointNote: '',
        pendingPointFlags: [],
        pointsInGame: pointsInGame + 1,
        phase: 'PLAYING',
        pressureContext: pressure,
        pressurePromptDismissed: false,
        undoStack: newUndoStack,
        canUndo: true,
      });
      return;
    }

    // 3. Game won — update DB game record
    undoSnapshot.previousGameId = currentGameId!;
    undoSnapshot.previousGameWinner = undefined; // was unset before
    await db.games.update(currentGameId!, { winner: gameWinner as 'PLAYER' | 'OPPONENT' });

    // Update game score
    if (gameWinner === 'PLAYER') newScore.playerGames++;
    else newScore.opponentGames++;

    // Check if set is won
    let setWon = false;
    let setWinner: 'PLAYER' | 'OPPONENT' | null = null;
    const pg = newScore.playerGames;
    const og = newScore.opponentGames;

    if (score.isTiebreak) {
      // Tiebreak game was just won
      setWon = true;
      setWinner = gameWinner;
    } else if ((pg >= 6 || og >= 6) && Math.abs(pg - og) >= 2) {
      setWon = true;
      setWinner = pg > og ? 'PLAYER' : 'OPPONENT';
    } else if (pg === 6 && og === 6) {
      // Enter tiebreak
      newScore.isTiebreak = true;
    }

    // Reset point scores for next game
    newScore.playerPoints = 0;
    newScore.opponentPoints = 0;
    newScore.isDeuce = false;
    newScore.advantage = undefined;

    // Alternate server (normal games; tiebreak handled above)
    if (!score.isTiebreak) {
      newScore.currentServer = score.currentServer === 'PLAYER' ? 'OPPONENT' : 'PLAYER';
    }

    if (!setWon) {
      // Start new game in same set
      const newGameId = uid();
      const nextGameNum = pg + og + 1; // already incremented
      const newGame: DBGame = {
        id: newGameId,
        setId: currentSetId!,
        matchId: matchId!,
        gameNumber: nextGameNum,
        server: newScore.currentServer,
        isTiebreak: newScore.isTiebreak,
      };
      await db.games.add(newGame);

      undoSnapshot.createdGameId = newGameId;

      const pressure = detectPressureContext(newScore, state.setup!.format);
      const newUndoStack = [...state.undoStack, undoSnapshot];

      set({
        score: newScore,
        pendingPointWinner: null,
        pendingPointNote: '',
        pendingPointFlags: [],
        currentGameId: newGameId,
        pointsInGame: 0,
        phase: 'PLAYING',
        pressureContext: pressure,
        pressurePromptDismissed: false,
        undoStack: newUndoStack,
        canUndo: true,
      });
      return;
    }

    // 4. Set won
    undoSnapshot.previousSetId = currentSetId!;
    undoSnapshot.previousSetData = {
      playerGames: score.playerGames,
      opponentGames: score.opponentGames,
      winner: undefined,
      tiebreak: false,
    };

    await db.sets.update(currentSetId!, {
      playerGames: newScore.playerGames,
      opponentGames: newScore.opponentGames,
      winner: setWinner as 'PLAYER' | 'OPPONENT',
      tiebreak: score.isTiebreak,
    });

    if (setWinner === 'PLAYER') newScore.playerSets++;
    else newScore.opponentSets++;

    // Check match won
    const setsToWin = getSetsToWin(state.setup!.format);
    if (newScore.playerSets >= setsToWin || newScore.opponentSets >= setsToWin) {
      undoSnapshot.previousMatchStatus = 'IN_PROGRESS';
      await db.matches.update(matchId!, { status: 'COMPLETED' });

      const newUndoStack = [...state.undoStack, undoSnapshot];
      set({
        score: newScore,
        pendingPointWinner: null,
        pendingPointNote: '',
        pendingPointFlags: [],
        phase: 'FINISHED',
        pressureContext: null,
        undoStack: newUndoStack,
        canUndo: true,
      });
      return;
    }

    // Start new set
    newScore.playerGames = 0;
    newScore.opponentGames = 0;
    newScore.isTiebreak = false;

    const newSetId = uid();
    const setNum = newScore.playerSets + newScore.opponentSets + 1;
    const newSet: DBSet = {
      id: newSetId,
      matchId: matchId!,
      setNumber: setNum,
      playerGames: 0,
      opponentGames: 0,
      tiebreak: false,
    };
    await db.sets.add(newSet);

    const newGameId = uid();
    const newGame: DBGame = {
      id: newGameId,
      setId: newSetId,
      matchId: matchId!,
      gameNumber: 1,
      server: newScore.currentServer,
      isTiebreak: false,
    };
    await db.games.add(newGame);

    undoSnapshot.createdSetId = newSetId;
    undoSnapshot.createdGameId = newGameId;

    const pressure = detectPressureContext(newScore, state.setup!.format);
    const newUndoStack = [...state.undoStack, undoSnapshot];

    set({
      score: newScore,
      pendingPointWinner: null,
      pendingPointNote: '',
      pendingPointFlags: [],
      currentSetId: newSetId,
      currentGameId: newGameId,
      pointsInGame: 0,
      setsPlayed: [...state.setsPlayed, newSet],
      phase: 'PLAYING',
      pressureContext: pressure,
      pressurePromptDismissed: false,
      undoStack: newUndoStack,
      canUndo: true,
    });
  },

  /* ---- Point metadata (Section 16 & 18) ---- */

  setPointNote: (note) => set({ pendingPointNote: note }),

  togglePointFlag: (flag) => {
    const current = get().pendingPointFlags;
    if (current.includes(flag)) {
      set({ pendingPointFlags: current.filter((f) => f !== flag) });
    } else {
      set({ pendingPointFlags: [...current, flag] });
    }
  },

  dismissPressurePrompt: () => set({ pressurePromptDismissed: true }),

  /* ---- Undo (Section 17) ---- */

  undoLastPoint: async () => {
    const state = get();
    if (state.undoStack.length === 0) return;

    const snapshot = state.undoStack[state.undoStack.length - 1];
    const newStack = state.undoStack.slice(0, -1);

    // 1. Delete the point from Dexie
    await db.points.delete(snapshot.pointId);

    // 2. If a new game was created (game boundary crossed), delete it
    if (snapshot.createdGameId) {
      await db.games.delete(snapshot.createdGameId);
    }

    // 3. If a new set was created, delete it
    if (snapshot.createdSetId) {
      await db.sets.delete(snapshot.createdSetId);
    }

    // 4. Revert game winner if we set one
    if (snapshot.previousGameId) {
      await db.games.update(snapshot.previousGameId, { winner: snapshot.previousGameWinner as 'PLAYER' | 'OPPONENT' | undefined });
    }

    // 5. Revert set data if we updated it
    if (snapshot.previousSetId && snapshot.previousSetData) {
      await db.sets.update(snapshot.previousSetId, snapshot.previousSetData);
    }

    // 6. Revert match status if changed
    if (snapshot.previousMatchStatus && state.matchId) {
      await db.matches.update(state.matchId, { status: snapshot.previousMatchStatus });
    }

    // 7. Restore in-memory state
    const pressure = state.setup
      ? detectPressureContext(snapshot.score, state.setup.format)
      : null;

    set({
      score: snapshot.score,
      pointsInGame: snapshot.pointsInGame,
      currentSetId: snapshot.currentSetId,
      currentGameId: snapshot.currentGameId,
      setsPlayed: snapshot.setsPlayed,
      phase: snapshot.phase,
      pendingPointWinner: null,
      pendingClassification: null,
      pendingPointNote: '',
      pendingPointFlags: [],
      pressureContext: pressure,
      pressurePromptDismissed: false,
      undoStack: newStack,
      canUndo: newStack.length > 0,
    });
  },

  finishMatch: async (reason = 'COMPLETED') => {
    const state = get();
    if (reason === 'CANCEL') {
      if (state.matchId) {
        await db.matches.update(state.matchId, { status: 'ABANDONED' });
      }
      get().resetMatch();
      return;
    }

    if (state.matchId) {
      await db.matches.update(state.matchId, { status: 'COMPLETED' });
    }

    const newScore = { ...state.score };
    const setsToWin = getSetsToWin(state.setup?.format || 'BEST_OF_3');

    if (reason === 'PLAYER_FORFEIT') {
      newScore.opponentSets = setsToWin;
    } else if (reason === 'OPPONENT_FORFEIT') {
      newScore.playerSets = setsToWin;
    }

    set({ phase: 'FINISHED', score: newScore });
  },

  resetMatch: () => {
    set({
      phase: 'IDLE',
      matchId: null,
      setup: null,
      score: { ...initialScore },
      pendingPointWinner: null,
      pendingClassification: null,
      currentSetId: null,
      currentGameId: null,
      pointsInGame: 0,
      setsPlayed: [],
      pendingPointNote: '',
      pendingPointFlags: [],
      pressureContext: null,
      pressurePromptDismissed: false,
      undoStack: [],
      canUndo: false,
    });
  },

  /* ---- Notes (Section 16) ---- */

  saveGameNote: async (text) => {
    const state = get();
    if (!text.trim() || !state.matchId || !state.currentGameId) return;

    const note: DBNote = {
      id: uid(),
      matchId: state.matchId,
      scope: 'GAME',
      scopeRefId: state.currentGameId,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };
    await db.notes.add(note);
  },

  saveMatchNote: async (text) => {
    const state = get();
    if (!text.trim() || !state.matchId) return;

    const note: DBNote = {
      id: uid(),
      matchId: state.matchId,
      scope: 'MATCH',
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };
    await db.notes.add(note);
  },

  /* ---- Sync status (Section 19) ---- */

  refreshSyncStatus: async () => {
    const count = await db.matches.where('synced').equals(0).count();
    set({ unsyncedCount: count });
  },

  setOnlineStatus: (online) => set({ isOnline: online }),

  syncPendingMatches: async () => {
    const { isOnline, isSyncing } = get();
    if (!isOnline || isSyncing) return;

    set({ isSyncing: true });

    try {
      const unsyncedMatches = await db.matches.where('synced').equals(0).toArray();
      for (const match of unsyncedMatches) {
        // Simulate background sync processing
        await new Promise((res) => setTimeout(res, 200));
        await db.matches.update(match.id, { synced: 1 });
        const remaining = await db.matches.where('synced').equals(0).count();
        set({ unsyncedCount: remaining });
      }
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      set({ isSyncing: false });
      await get().refreshSyncStatus();
    }
  },

  /* ---- Display helpers ---- */

  getPointLabel: (side) => {
    const { score } = get();
    const pts = side === 'PLAYER' ? score.playerPoints : score.opponentPoints;

    if (score.isTiebreak) return String(pts);

    if (score.isDeuce && score.playerPoints === score.opponentPoints) return '40';
    if (score.advantage === side) return 'AD';
    if (score.advantage && score.advantage !== side) return '40';

    return pts <= 3 ? POINT_LABELS[pts] : '40';
  },
}));
