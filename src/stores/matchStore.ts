import { create } from 'zustand';
import { db } from '@/lib/db';
import type { DBMatch, DBSet, DBGame, DBPoint, DBNote } from '@/lib/db';
import { PointClassification } from '@/models/types';
import type { CriticalPointFlagType, TiebreakProcedure, ThirdSetFormat, ScoringFormat } from '@/models/types';

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
  // Tournament-grade settings
  tiebreakProcedure: TiebreakProcedure;
  thirdSetFormat: ThirdSetFormat;
  scoringFormat: ScoringFormat;
}

/** Which side of the court the server is on */
export type CourtSide = 'DEUCE' | 'AD';

interface LiveScore {
  playerPoints: number;  // 0-3 index into POINT_LABELS, or raw count in tiebreak
  opponentPoints: number;
  playerGames: number;
  opponentGames: number;
  playerSets: number;
  opponentSets: number;
  currentServer: 'PLAYER' | 'OPPONENT';
  isTiebreak: boolean;
  isMatchTiebreak: boolean;   // 10-point match tiebreak (3rd set format)
  isDeuce: boolean;
  advantage?: 'PLAYER' | 'OPPONENT';
  /** Who served the very first point of this tiebreak (for next-set transition) */
  tiebreakFirstServer?: 'PLAYER' | 'OPPONENT';
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
  /** Whether a change-ends banner was showing */
  showChangeEnds: boolean;
  changeEndsReason?: string;
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
  previousMatchStatus?: 'IN_PROGRESS' | 'COMPLETED' | 'SUSPENDED';
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

  // Tiebreak UI state
  courtSide: CourtSide;
  showChangeEnds: boolean;
  changeEndsReason?: string;


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
  dismissChangeEnds: () => void;
  manualChangeEnds: () => void;
  switchServer: () => void;
  undoLastPoint: () => Promise<void>;
  finishMatch: (reason?: 'COMPLETED' | 'PLAYER_FORFEIT' | 'OPPONENT_FORFEIT' | 'CANCEL') => Promise<void>;
  resetMatch: () => void;
  suspendMatch: () => Promise<void>;
  saveGameNote: (text: string) => Promise<void>;
  saveMatchNote: (text: string) => Promise<void>;
  refreshSyncStatus: () => Promise<void>;
  setOnlineStatus: (online: boolean) => void;

  // Session recovery & DB hydration
  isRecovering: boolean;
  recoverActiveMatch: () => Promise<boolean>;
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
/*  Tiebreak change-of-ends detection                                 */
/* ------------------------------------------------------------------ */

/**
 * Determine if players should change ends based on the total points
 * played so far in the tiebreak (BEFORE adding the current point).
 * We check if the NEW total (after this point) hits a threshold.
 *
 * Standard: change at 6, 12, 18, ...
 * Coman: change at 1, 5, 9, 13, 17, ...
 */
function shouldChangeEnds(
  totalPointsAfter: number,
  procedure: TiebreakProcedure,
): boolean {
  if (procedure === 'standard') {
    return totalPointsAfter > 0 && totalPointsAfter % 6 === 0;
  }
  // Coman: after 1st point, then every 4 points (1, 5, 9, 13, ...)
  if (totalPointsAfter === 1) return true;
  if (totalPointsAfter > 1 && (totalPointsAfter - 1) % 4 === 0) return true;
  return false;
}

/* ------------------------------------------------------------------ */
/*  Tiebreak service rotation                                         */
/* ------------------------------------------------------------------ */

/**
 * Compute who should serve a given tiebreak point (0-indexed total).
 *   Point 0: firstServer serves 1 point
 *   Points 1-2: other serves 2 points
 *   Points 3-4: firstServer serves 2 points
 *   etc. → pattern repeats every 4 after the first
 */
function tiebreakServerForPoint(
  totalPoints: number,
  firstServer: 'PLAYER' | 'OPPONENT',
): 'PLAYER' | 'OPPONENT' {
  const other = firstServer === 'PLAYER' ? 'OPPONENT' : 'PLAYER';
  if (totalPoints === 0) return firstServer;
  // After point 0, group into pairs starting at index 1
  const groupIndex = Math.floor((totalPoints - 1) / 2);
  // Even groups → other, odd groups → firstServer
  return groupIndex % 2 === 0 ? other : firstServer;
}

/**
 * Determine the court side for the current point in a tiebreak.
 * Point 0 → Deuce; then alternate Ad, Deuce, Ad, Deuce, ...
 * But actually each server change resets to a specific pattern:
 *   Point 0: Deuce (server A, 1 point)
 *   Point 1: Ad    (server B, point 1 of 2)
 *   Point 2: Deuce (server B, point 2 of 2)
 *   Point 3: Ad    (server A, point 1 of 2)
 *   Point 4: Deuce (server A, point 2 of 2)
 *   ...
 * The pattern is simply: even total = Deuce, odd total = Ad
 */
function tiebreakCourtSide(totalPoints: number): CourtSide {
  return totalPoints % 2 === 0 ? 'DEUCE' : 'AD';
}

/**
 * For standard (non-tiebreak) games, court side based on total points.
 * First point: Deuce (right), then alternates.
 */
function standardCourtSide(totalPoints: number): CourtSide {
  return totalPoints % 2 === 0 ? 'DEUCE' : 'AD';
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
  if (!score.isTiebreak && !score.isMatchTiebreak) {
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

    // Set point checks
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
    // Tiebreak (set or match): check for set/match points
    const pp = score.playerPoints;
    const op = score.opponentPoints;

    const tbTarget = score.isMatchTiebreak ? 10 : 7;
    const playerOnTBPoint = pp >= (tbTarget - 1) && pp > op;
    const opponentOnTBPoint = op >= (tbTarget - 1) && op > pp;

    // A match tiebreak winning IS match point
    if (score.isMatchTiebreak) {
      if (playerOnTBPoint || opponentOnTBPoint) return 'MATCH_POINT';
    } else {
      const playerOnMatchPoint = playerOnTBPoint && (score.playerSets + 1 >= setsToWin);
      const opponentOnMatchPoint = opponentOnTBPoint && (score.opponentSets + 1 >= setsToWin);
      if (playerOnMatchPoint || opponentOnMatchPoint) return 'MATCH_POINT';
      if (playerOnTBPoint || opponentOnTBPoint) return 'SET_POINT';
    }
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
  isMatchTiebreak: false,
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

  // Tiebreak UI
  courtSide: 'DEUCE',
  showChangeEnds: false,
  changeEndsReason: undefined,


  // Undo
  undoStack: [],
  canUndo: false,

  // Sync
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  unsyncedCount: 0,
  isSyncing: false,
  isRecovering: false,

  /* ---- Lifecycle ---- */

  startSetup: () => set({ phase: 'SETUP' }),

  confirmSetup: async (setup) => {
    const matchId = uid();
    const setId = uid();
    const gameId = uid();

    const isMatchTiebreak =
      setup.format === 'BEST_OF_3' &&
      setup.thirdSetFormat === '10-point-match-tiebreak' &&
      false; // only applies at 1-1 sets — not at start

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
      tiebreakProcedure: setup.tiebreakProcedure,
      thirdSetFormat: setup.thirdSetFormat,
      scoringFormat: setup.scoringFormat,
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
      courtSide: 'DEUCE',
      showChangeEnds: false,
      changeEndsReason: undefined,
      unsyncedCount,
      score: {
        ...initialScore,
        currentServer: setup.firstServer,
        isMatchTiebreak: false,
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
    const { score, matchId, currentSetId, currentGameId, pointsInGame, setup } = state;

    const scoringFormat: ScoringFormat = setup?.scoringFormat ?? 'ad';
    const tiebreakProcedure: TiebreakProcedure = setup?.tiebreakProcedure ?? 'standard';
    const thirdSetFormat: ThirdSetFormat = setup?.thirdSetFormat ?? 'full-set';

    // Build undo snapshot BEFORE mutating
    const undoSnapshot: UndoSnapshot = {
      score: { ...score },
      pointsInGame,
      currentSetId: currentSetId!,
      currentGameId: currentGameId!,
      setsPlayed: [...state.setsPlayed],
      phase: 'PLAYING',
      showChangeEnds: state.showChangeEnds,
      changeEndsReason: state.changeEndsReason,
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
    let triggerChangeEnds = false;
    let changeEndsMsg: string | undefined = undefined;

    if (score.isTiebreak || score.isMatchTiebreak) {
      // === TIEBREAK scoring ===
      if (winner === 'PLAYER') newScore.playerPoints++;
      else newScore.opponentPoints++;

      const p = newScore.playerPoints;
      const o = newScore.opponentPoints;
      const tbTarget = score.isMatchTiebreak ? 10 : 7;

      if ((p >= tbTarget || o >= tbTarget) && Math.abs(p - o) >= 2) {
        gameWon = true;
        gameWinner = p > o ? 'PLAYER' : 'OPPONENT';
      }

      // Service rotation: 1-2-2-2 pattern
      const totalTBPointsAfter = newScore.playerPoints + newScore.opponentPoints;
      const firstServer = score.tiebreakFirstServer ?? score.currentServer;
      newScore.currentServer = tiebreakServerForPoint(totalTBPointsAfter, firstServer);

      // Preserve tiebreakFirstServer through the tiebreak
      newScore.tiebreakFirstServer = firstServer;

      // Change of ends in tiebreak
      if (tiebreakProcedure !== 'manual') {
        triggerChangeEnds = shouldChangeEnds(totalTBPointsAfter, tiebreakProcedure);
        if (triggerChangeEnds) {
          changeEndsMsg = tiebreakProcedure === 'coman'
            ? `Coman changeover (point ${totalTBPointsAfter}) — switch sides`
            : `Tiebreak changeover (${totalTBPointsAfter} points) — switch sides`;
        }
      }
    } else {
      // === Standard game scoring ===
      if (winner === 'PLAYER') newScore.playerPoints = nextPointScore(score.playerPoints);
      else newScore.opponentPoints = nextPointScore(score.opponentPoints);

      const p = newScore.playerPoints;
      const o = newScore.opponentPoints;

      if (p >= 3 && o >= 3) {
        // Deuce territory
        if (scoringFormat === 'no-ad') {
          // No-Ad: at 40-40 (both >= 3 and equal), it's a deciding point
          // The next point wins. So if someone just scored and they're now ahead, they win.
          if (p === o) {
            // Deuce — next point is deciding
            newScore.isDeuce = true;
            newScore.advantage = undefined;
          } else {
            // Someone just scored the deciding point
            gameWon = true;
            gameWinner = p > o ? 'PLAYER' : 'OPPONENT';
          }
        } else {
          // Advantage scoring
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
        }
      } else if (p >= 4 || o >= 4) {
        gameWon = true;
        gameWinner = p > o ? 'PLAYER' : 'OPPONENT';
      }
    }

    if (!gameWon) {
      // Compute court side for the NEXT point
      const totalPointsInGame = pointsInGame + 1; // 0-indexed: this becomes the index of the next point
      const nextCourtSide = (score.isTiebreak || score.isMatchTiebreak)
        ? tiebreakCourtSide(newScore.playerPoints + newScore.opponentPoints)
        : standardCourtSide(totalPointsInGame);

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
        courtSide: nextCourtSide,
        showChangeEnds: triggerChangeEnds,
        changeEndsReason: changeEndsMsg,
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

    if (score.isTiebreak || score.isMatchTiebreak) {
      // Tiebreak game was just won — set is won
      setWon = true;
      setWinner = gameWinner;
    } else if ((pg >= 6 || og >= 6) && Math.abs(pg - og) >= 2) {
      setWon = true;
      setWinner = pg > og ? 'PLAYER' : 'OPPONENT';
    } else if (pg === 6 && og === 6) {
      // Enter tiebreak at 6-6
      newScore.isTiebreak = true;
      // The server for the tiebreak is whoever's turn it is
      // (already set by normal alternation below)
    }

    // Reset point scores for next game
    newScore.playerPoints = 0;
    newScore.opponentPoints = 0;
    newScore.isDeuce = false;
    newScore.advantage = undefined;

    // Alternate server for standard games (tiebreak handled internally)
    if (!score.isTiebreak && !score.isMatchTiebreak) {
      newScore.currentServer = score.currentServer === 'PLAYER' ? 'OPPONENT' : 'PLAYER';
    } else {
      // After a tiebreak, the RECEIVER of the first tiebreak point serves first in next set
      const tbFirst = score.tiebreakFirstServer ?? score.currentServer;
      newScore.currentServer = tbFirst === 'PLAYER' ? 'OPPONENT' : 'PLAYER';
      newScore.tiebreakFirstServer = undefined;
    }

    // When entering a tiebreak (6-6), set the tiebreak first server
    if (!setWon && newScore.isTiebreak) {
      newScore.tiebreakFirstServer = newScore.currentServer;
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

      // Standard changeover: players change ends at the end of the 1st, 3rd, 5th, and every subsequent odd game
      const totalCompletedGames = pg + og;
      const isOddGameChange = tiebreakProcedure !== 'manual' && totalCompletedGames % 2 !== 0;

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
        courtSide: 'DEUCE',
        showChangeEnds: isOddGameChange,
        changeEndsReason: isOddGameChange
          ? `End of game ${totalCompletedGames} (odd game) — switch sides`
          : undefined,
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
      tiebreak: score.isTiebreak || score.isMatchTiebreak,
    });

    if (setWinner === 'PLAYER') newScore.playerSets++;
    else newScore.opponentSets++;

    // Reset tiebreak flags for the new set
    newScore.isTiebreak = false;
    newScore.isMatchTiebreak = false;

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
        showChangeEnds: false,
        undoStack: newUndoStack,
        canUndo: true,
      });
      return;
    }

    // Start new set: players change ends if the set ended with an odd number of games
    const previousSetCompletedGames = newScore.playerGames + newScore.opponentGames;
    const isOddSetChange = previousSetCompletedGames % 2 !== 0;

    newScore.playerGames = 0;
    newScore.opponentGames = 0;

    // Check if this is the deciding set and should be a match tiebreak
    const totalSetsPlayed = newScore.playerSets + newScore.opponentSets;
    const isDecidingSet = newScore.playerSets === newScore.opponentSets; // e.g. 1-1
    const shouldBeMatchTiebreak =
      isDecidingSet &&
      thirdSetFormat === '10-point-match-tiebreak' &&
      totalSetsPlayed >= 2; // only for 3rd+ set

    const newSetId = uid();
    const setNum = totalSetsPlayed + 1;
    const newSet: DBSet = {
      id: newSetId,
      matchId: matchId!,
      setNumber: setNum,
      playerGames: 0,
      opponentGames: 0,
      tiebreak: shouldBeMatchTiebreak,
    };
    await db.sets.add(newSet);

    const newGameId = uid();
    const newGame: DBGame = {
      id: newGameId,
      setId: newSetId,
      matchId: matchId!,
      gameNumber: 1,
      server: newScore.currentServer,
      isTiebreak: shouldBeMatchTiebreak,
    };
    await db.games.add(newGame);

    if (shouldBeMatchTiebreak) {
      newScore.isMatchTiebreak = true;
      newScore.isTiebreak = true;
      newScore.tiebreakFirstServer = newScore.currentServer;
    }

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
      courtSide: 'DEUCE',
      showChangeEnds: tiebreakProcedure !== 'manual' && isOddSetChange,
      changeEndsReason: (tiebreakProcedure !== 'manual' && isOddSetChange)
        ? `End of set (${previousSetCompletedGames} games, odd) — switch sides`
        : undefined,
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

  dismissChangeEnds: () => set({ showChangeEnds: false, changeEndsReason: undefined }),

  switchServer: () => set((state) => ({
    score: {
      ...state.score,
      currentServer: state.score.currentServer === 'PLAYER' ? 'OPPONENT' : 'PLAYER',
    },
  })),

  manualChangeEnds: () => set((state) => ({
    score: {
      ...state.score,
      currentServer: state.score.currentServer === 'PLAYER' ? 'OPPONENT' : 'PLAYER',
    },
    showChangeEnds: true,
    changeEndsReason: 'Manual server switch',
  })),

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

    // 7. Restore in-memory state (including court side and change-ends)
    const pressure = state.setup
      ? detectPressureContext(snapshot.score, state.setup.format)
      : null;

    // Recompute court side from the restored score
    const restoredTotal = snapshot.score.playerPoints + snapshot.score.opponentPoints;
    const restoredCourtSide = (snapshot.score.isTiebreak || snapshot.score.isMatchTiebreak)
      ? tiebreakCourtSide(restoredTotal)
      : standardCourtSide(snapshot.pointsInGame);

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
      courtSide: restoredCourtSide,
      showChangeEnds: snapshot.showChangeEnds,
      changeEndsReason: snapshot.changeEndsReason,
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
      courtSide: 'DEUCE',
      showChangeEnds: false,
      changeEndsReason: undefined,
      undoStack: [],
      canUndo: false,
    });
  },

  /* ---- Match Suspension / Rain Delay ---- */

  suspendMatch: async () => {
    const state = get();
    if (!state.matchId) return;

    // Mark the match as SUSPENDED in Dexie
    await db.matches.update(state.matchId, { status: 'SUSPENDED' });

    // Clear the entire Zustand store back to IDLE
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
      courtSide: 'DEUCE',
      showChangeEnds: false,
      changeEndsReason: undefined,
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

  /* ---- Session Recovery & Database Hydration ---- */

  recoverActiveMatch: async () => {
    // If we are already in an active session in memory, don't overwrite
    const current = get();
    if (current.phase !== 'IDLE' && current.matchId) {
      return true;
    }

    set({ isRecovering: true });

    try {
      // Query Dexie database for the most recent match that has not been completed
      // Also find SUSPENDED matches (rain delay / resume flow)
      let activeMatch = await db.matches.where('status').equals('IN_PROGRESS').last();
      if (!activeMatch) {
        activeMatch = await db.matches.where('status').equals('SUSPENDED').last();
      }
      if (!activeMatch) {
        activeMatch = await db.matches.where('status').equals('in-progress').last();
      }
      if (!activeMatch) {
        const allMatches = await db.matches.toArray();
        activeMatch = allMatches
          .filter((m) => {
            const st = (m.status || '').toLowerCase();
            return st === 'in_progress' || st === 'in-progress' || st === 'suspended';
          })
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      }

      if (!activeMatch) {
        set({ isRecovering: false });
        return false;
      }

      // Reconstruct MatchSetup
      const setup: MatchSetup = {
        playerName: activeMatch.playerName,
        opponentName: activeMatch.opponentName,
        format: activeMatch.format,
        surface: activeMatch.surface,
        firstServer: activeMatch.firstServer,
        tiebreakProcedure: activeMatch.tiebreakProcedure || 'standard',
        thirdSetFormat: activeMatch.thirdSetFormat || 'full-set',
        scoringFormat: activeMatch.scoringFormat || 'ad',
      };

      // Query all sets for this match
      let matchSets = await db.sets
        .where('matchId')
        .equals(activeMatch.id)
        .sortBy('setNumber');

      if (matchSets.length === 0) {
        const setId = uid();
        const gameId = uid();
        const newSet: DBSet = {
          id: setId,
          matchId: activeMatch.id,
          setNumber: 1,
          playerGames: 0,
          opponentGames: 0,
          tiebreak: false,
        };
        const newGame: DBGame = {
          id: gameId,
          setId,
          matchId: activeMatch.id,
          gameNumber: 1,
          server: activeMatch.firstServer,
          isTiebreak: false,
        };
        await db.sets.add(newSet);
        await db.games.add(newGame);
        matchSets = [newSet];
      }

      // Active set is the first set without a winner or the last set
      const activeSet = matchSets.find((s) => !s.winner) || matchSets[matchSets.length - 1];

      // Query games for the active set
      let setGames = await db.games
        .where('setId')
        .equals(activeSet.id)
        .sortBy('gameNumber');

      if (setGames.length === 0) {
        const gameId = uid();
        const newGame: DBGame = {
          id: gameId,
          setId: activeSet.id,
          matchId: activeMatch.id,
          gameNumber: 1,
          server: activeMatch.firstServer,
          isTiebreak: activeSet.tiebreak,
        };
        await db.games.add(newGame);
        setGames = [newGame];
      }

      const activeGame = setGames.find((g) => !g.winner) || setGames[setGames.length - 1];

      // Query points for the active game
      const allMatchPoints = await db.points
        .where('matchId')
        .equals(activeMatch.id)
        .sortBy('pointNumber');

      const activeGamePoints = allMatchPoints.filter((p) => p.gameId === activeGame.id);

      // Sets won
      const playerSets = matchSets.filter((s) => s.winner === 'PLAYER').length;
      const opponentSets = matchSets.filter((s) => s.winner === 'OPPONENT').length;

      // Games in active set
      const playerGames = activeSet.playerGames;
      const opponentGames = activeSet.opponentGames;

      // Tiebreak status
      const isTiebreak = Boolean(activeGame.isTiebreak || activeSet.tiebreak);
      const isMatchTiebreak =
        setup.format === 'BEST_OF_3' &&
        setup.thirdSetFormat === '10-point-match-tiebreak' &&
        activeSet.setNumber === 3;

      let playerPoints = 0;
      let opponentPoints = 0;
      let isDeuce = false;
      let advantage: 'PLAYER' | 'OPPONENT' | undefined = undefined;
      let currentServer = activeGame.server;
      const tiebreakFirstServer = activeGame.server;

      if (isTiebreak || isMatchTiebreak) {
        playerPoints = activeGamePoints.filter((p) => p.winner === 'PLAYER').length;
        opponentPoints = activeGamePoints.filter((p) => p.winner === 'OPPONENT').length;
        const totalTBPoints = playerPoints + opponentPoints;
        currentServer = tiebreakServerForPoint(totalTBPoints, activeGame.server);
      } else {
        // Replay points to restore standard score / deuce / advantage
        for (const pt of activeGamePoints) {
          if (pt.winner === 'PLAYER') {
            if (setup.scoringFormat === 'no-ad') {
              playerPoints = nextPointScore(playerPoints);
            } else {
              if (isDeuce) {
                if (advantage === 'OPPONENT') {
                  advantage = undefined;
                } else {
                  advantage = 'PLAYER';
                  isDeuce = false;
                }
              } else if (advantage === 'OPPONENT') {
                advantage = undefined;
                isDeuce = true;
              } else {
                playerPoints = nextPointScore(playerPoints);
                if (playerPoints >= 3 && opponentPoints >= 3 && playerPoints === opponentPoints) {
                  isDeuce = true;
                }
              }
            }
          } else {
            if (setup.scoringFormat === 'no-ad') {
              opponentPoints = nextPointScore(opponentPoints);
            } else {
              if (isDeuce) {
                if (advantage === 'PLAYER') {
                  advantage = undefined;
                } else {
                  advantage = 'OPPONENT';
                  isDeuce = false;
                }
              } else if (advantage === 'PLAYER') {
                advantage = undefined;
                isDeuce = true;
              } else {
                opponentPoints = nextPointScore(opponentPoints);
                if (playerPoints >= 3 && opponentPoints >= 3 && playerPoints === opponentPoints) {
                  isDeuce = true;
                }
              }
            }
          }
        }
      }

      const recoveredScore: LiveScore = {
        playerPoints,
        opponentPoints,
        playerGames,
        opponentGames,
        playerSets,
        opponentSets,
        currentServer,
        isTiebreak,
        isMatchTiebreak,
        isDeuce,
        advantage,
        tiebreakFirstServer,
      };

      const courtSide = (isTiebreak || isMatchTiebreak)
        ? tiebreakCourtSide(playerPoints + opponentPoints)
        : standardCourtSide(activeGamePoints.length);

      const pressureContext = detectPressureContext(recoveredScore, setup.format);
      const unsyncedCount = await db.matches.where('synced').equals(0).count();

      const setsToWin = getSetsToWin(setup.format);
      const isFinished = playerSets >= setsToWin || opponentSets >= setsToWin;

      // If match was SUSPENDED, re-mark it as IN_PROGRESS on resume
      if (activeMatch.status === 'SUSPENDED') {
        await db.matches.update(activeMatch.id, { status: 'IN_PROGRESS' });
      }

      set({
        phase: isFinished ? 'FINISHED' : 'PLAYING',
        matchId: activeMatch.id,
        setup,
        score: recoveredScore,
        pendingPointWinner: null,
        pendingClassification: null,
        currentSetId: activeSet.id,
        currentGameId: activeGame.id,
        pointsInGame: activeGamePoints.length,
        setsPlayed: matchSets,
        pendingPointNote: '',
        pendingPointFlags: [],
        pressureContext,
        pressurePromptDismissed: false,
        courtSide,
        showChangeEnds: false,
        changeEndsReason: undefined,
        undoStack: [],
        canUndo: false,
        unsyncedCount,
        isRecovering: false,
      });

      return true;
    } catch (err) {
      console.error('Failed to recover active match:', err);
      set({ isRecovering: false });
      return false;
    }
  },

  /* ---- Display helpers ---- */

  getPointLabel: (side) => {
    const { score } = get();
    const pts = side === 'PLAYER' ? score.playerPoints : score.opponentPoints;

    if (score.isTiebreak || score.isMatchTiebreak) return String(pts);

    if (score.isDeuce && score.playerPoints === score.opponentPoints) return '40';
    if (score.advantage === side) return 'AD';
    if (score.advantage && score.advantage !== side) return '40';

    return pts <= 3 ? POINT_LABELS[pts] : '40';
  },
}));
