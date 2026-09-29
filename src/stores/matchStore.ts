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
  targetGames?: number;
  // Tournament-grade settings
  tiebreakProcedure: TiebreakProcedure;
  thirdSetFormat: ThirdSetFormat;
  scoringFormat: ScoringFormat;
}

/** Which side of the court the server is on */
export type CourtSide = 'DEUCE' | 'AD';

export interface LiveScore {
  playerPoints: number;  // 0-3 index into POINT_LABELS, or raw count in tiebreak
  opponentPoints: number;
  playerGames: number;
  opponentGames: number;
  playerSets: number;
  opponentSets: number;
  currentServer: 'PLAYER' | 'OPPONENT';
  isTiebreak: boolean;
  isMatchTiebreak: boolean;   // 10-point match tiebreak (3rd set format)
  tiebreakTargetPoints?: number; // Target score for tiebreak (e.g., 7, 10, or custom)
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

export type PendingDecisionType = 'SET_TIEBREAK' | 'MATCH_TIEBREAK' | null;

/** Snapshot stored per-point for undo */
interface UndoSnapshot {
  score: LiveScore;
  pointsInGame: number;
  currentSetId: string;
  currentGameId: string;
  setsPlayed: DBSet[];
  phase: MatchState['phase'];
  pendingDecision: PendingDecisionType;
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
  // Role
  role: 'PRIMARY' | 'OBSERVER';

  // State
  phase: 'IDLE' | 'SETUP' | 'PLAYING' | 'POINT_DETAIL' | 'SHOT_DETAIL' | 'FINISHED';
  matchId: string | null;
  setup: MatchSetup | null;
  targetGames: number;
  pendingDecision: PendingDecisionType;
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
  resolveSetTiebreakDecision: (playTiebreak: boolean, targetPoints?: number) => Promise<void>;
  resolveMatchTiebreakDecision: (playMatchTiebreak: boolean, targetPoints?: number) => Promise<void>;
  cancelPointDetail: () => void;
  getPointLabel: (side: 'PLAYER' | 'OPPONENT') => string;
  setRole: (role: 'PRIMARY' | 'OBSERVER') => void;

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
  recoverActiveMatch: (matchIdToRecover?: string) => Promise<boolean>;
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

/**
 * Smart Format Parsing for "Other" Custom Formats
 * - Presets: BEST_OF_1, BEST_OF_3, BEST_OF_5 → target 6 games.
 * - Preset 8-Game Pro Set → target 8 games.
 * - Custom strings (e.g. "12 game pro set", "4 game short set"):
 *   Parses the integer from string and sets targetGames dynamically.
 */
export function parseTargetGames(format: string): number {
  if (!format) return 6;
  const trimmed = format.trim();
  const lower = trimmed.toLowerCase();

  // Standard preset formats
  if (lower === 'best_of_1' || lower === 'best_of_3' || lower === 'best_of_5') {
    return 6;
  }

  // Preset 8-Game Pro Set
  if (
    lower.includes('8-game') ||
    lower.includes('8 game') ||
    lower.includes('8pro') ||
    lower.includes('8 pro') ||
    lower === '8_game_pro_set'
  ) {
    return 8;
  }

  // Smart Parsing for "Other" custom formats (e.g., "12 game pro set", "12-game pro set", "4 game short set")
  const gameMatch = lower.match(/(\d+)\s*(?:-|game|games|pro|short|set)/i);
  if (gameMatch) {
    const parsed = parseInt(gameMatch[1], 10);
    if (parsed > 0) return parsed;
  }

  // Fallback for any single number in custom format if not "best of X"
  if (!lower.includes('best of') && !lower.includes('best_of')) {
    const numberMatch = lower.match(/(\d+)/);
    if (numberMatch) {
      const parsed = parseInt(numberMatch[1], 10);
      if (parsed > 0) return parsed;
    }
  }

  return 6; // Default standard set
}

/* ------------------------------------------------------------------ */
/*  Tiebreak change-of-ends detection                                 */
/* ------------------------------------------------------------------ */

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

function tiebreakServerForPoint(
  totalPoints: number,
  firstServer: 'PLAYER' | 'OPPONENT',
): 'PLAYER' | 'OPPONENT' {
  const other = firstServer === 'PLAYER' ? 'OPPONENT' : 'PLAYER';
  if (totalPoints === 0) return firstServer;
  const groupIndex = Math.floor((totalPoints - 1) / 2);
  return groupIndex % 2 === 0 ? other : firstServer;
}

function tiebreakCourtSide(totalPoints: number): CourtSide {
  return totalPoints % 2 === 0 ? 'DEUCE' : 'AD';
}

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

    const playerCanWinGame =
      (pp >= 3 && pp > op) ||
      pp >= 4;

    const opponentCanWinGame =
      (op >= 3 && op > pp) ||
      op >= 4;

    const playerOnSetPoint = (score.playerGames >= 5 && score.playerGames > score.opponentGames) && playerCanWinGame;
    const opponentOnSetPoint = (score.opponentGames >= 5 && score.opponentGames > score.playerGames) && opponentCanWinGame;

    const playerOnMatchPoint = playerOnSetPoint && (score.playerSets + 1 >= setsToWin);
    const opponentOnMatchPoint = opponentOnSetPoint && (score.opponentSets + 1 >= setsToWin);

    if (playerOnMatchPoint || opponentOnMatchPoint) return 'MATCH_POINT';
    if (playerOnSetPoint || opponentOnSetPoint) return 'SET_POINT';

    if (isReceiverPlayer && playerCanWinGame) return 'BREAK_POINT';
    if (isReceiverOpponent && opponentCanWinGame) return 'BREAK_POINT_AGAINST';
  } else {
    const pp = score.playerPoints;
    const op = score.opponentPoints;

    const tbTarget = score.tiebreakTargetPoints || (score.isMatchTiebreak ? 10 : 7);
    const playerOnTBPoint = pp >= (tbTarget - 1) && pp > op;
    const opponentOnTBPoint = op >= (tbTarget - 1) && op > pp;

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
  role: 'PRIMARY',
  setRole: (role) => set({ role }),
  phase: 'IDLE',
  matchId: null,
  setup: null,
  targetGames: 6,
  pendingDecision: null,
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

    const targetGames = setup.targetGames ?? parseTargetGames(setup.format);
    const fullSetup: MatchSetup = { ...setup, targetGames };

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

    const unsyncedCount = await db.matches.where('synced').equals(0).count();

    set({
      phase: 'PLAYING',
      matchId,
      setup: fullSetup,
      targetGames,
      pendingDecision: null,
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

  /* ---- Point flow ---- */

  selectPointWinner: (winner) =>
    set({ pendingPointWinner: winner, pendingClassification: null, phase: 'POINT_DETAIL' }),

  selectClassification: (classification) => {
    if (classification === PointClassification.WINNER || classification === PointClassification.OPPONENT_WINNER) {
      set({ pendingClassification: classification, phase: 'SHOT_DETAIL' });
    } else {
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
    
    if (state.role === 'OBSERVER' && state.matchId) {
      const bc = new BroadcastChannel(`courtedge-live-score-${state.matchId}`);
      bc.postMessage({
        type: 'OBSERVER_OBSERVATION',
        payload: {
          classification,
          shotType,
          note: state.pendingPointNote,
          flags: state.pendingPointFlags,
          timestamp: new Date().toISOString(),
        }
      });
      bc.close();
      
      set({
        phase: 'PLAYING',
        pendingPointWinner: null,
        pendingClassification: null,
        pendingPointNote: '',
        pendingPointFlags: [],
      });
      return;
    }

    const winner = state.pendingPointWinner!;
    const { score, matchId, currentSetId, currentGameId, pointsInGame, setup } = state;

    const scoringFormat: ScoringFormat = setup?.scoringFormat ?? 'ad';
    const tiebreakProcedure: TiebreakProcedure = setup?.tiebreakProcedure ?? 'standard';

    const undoSnapshot: UndoSnapshot = {
      score: { ...score },
      pointsInGame,
      currentSetId: currentSetId!,
      currentGameId: currentGameId!,
      setsPlayed: [...state.setsPlayed],
      phase: 'PLAYING',
      pendingDecision: state.pendingDecision,
      showChangeEnds: state.showChangeEnds,
      changeEndsReason: state.changeEndsReason,
      pointId: '',
    };

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

    const newScore = { ...score };
    let gameWon = false;
    let gameWinner: 'PLAYER' | 'OPPONENT' | null = null;
    let triggerChangeEnds = false;
    let changeEndsMsg: string | undefined = undefined;

    if (score.isTiebreak || score.isMatchTiebreak) {
      if (winner === 'PLAYER') newScore.playerPoints++;
      else newScore.opponentPoints++;

      const p = newScore.playerPoints;
      const o = newScore.opponentPoints;
      const tbTarget = score.tiebreakTargetPoints || (score.isMatchTiebreak ? 10 : 7);

      if ((p >= tbTarget || o >= tbTarget) && Math.abs(p - o) >= 2) {
        gameWon = true;
        gameWinner = p > o ? 'PLAYER' : 'OPPONENT';
      }

      const totalTBPointsAfter = newScore.playerPoints + newScore.opponentPoints;
      const firstServer = score.tiebreakFirstServer ?? score.currentServer;
      newScore.currentServer = tiebreakServerForPoint(totalTBPointsAfter, firstServer);
      newScore.tiebreakFirstServer = firstServer;

      if (tiebreakProcedure !== 'manual') {
        triggerChangeEnds = shouldChangeEnds(totalTBPointsAfter, tiebreakProcedure);
        if (triggerChangeEnds) {
          changeEndsMsg = tiebreakProcedure === 'coman'
            ? `Coman changeover (point ${totalTBPointsAfter}) — switch sides`
            : `Tiebreak changeover (${totalTBPointsAfter} points) — switch sides`;
        }
      }
    } else {
      if (winner === 'PLAYER') newScore.playerPoints = nextPointScore(score.playerPoints);
      else newScore.opponentPoints = nextPointScore(score.opponentPoints);

      const p = newScore.playerPoints;
      const o = newScore.opponentPoints;

      if (p >= 3 && o >= 3) {
        if (scoringFormat === 'no-ad') {
          if (p === o) {
            newScore.isDeuce = true;
            newScore.advantage = undefined;
          } else {
            gameWon = true;
            gameWinner = p > o ? 'PLAYER' : 'OPPONENT';
          }
        } else {
          if (p === o) {
            newScore.isDeuce = true;
            newScore.advantage = undefined;
          } else if (Math.abs(p - o) === 1) {
            newScore.isDeuce = false;
            newScore.advantage = p > o ? 'PLAYER' : 'OPPONENT';
          } else {
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
      const totalPointsInGame = pointsInGame + 1;
      const nextCourtSide = (score.isTiebreak || score.isMatchTiebreak)
        ? tiebreakCourtSide(newScore.playerPoints + newScore.opponentPoints)
        : standardCourtSide(totalPointsInGame);

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

    // Game won — update DB game record
    undoSnapshot.previousGameId = currentGameId!;
    undoSnapshot.previousGameWinner = undefined;
    await db.games.update(currentGameId!, { winner: gameWinner as 'PLAYER' | 'OPPONENT' });

    if (gameWinner === 'PLAYER') newScore.playerGames++;
    else newScore.opponentGames++;

    const pg = newScore.playerGames;
    const og = newScore.opponentGames;
    const targetGames = state.targetGames || parseTargetGames(state.setup?.format || '');

    let setWon = false;
    let setWinner: 'PLAYER' | 'OPPONENT' | null = null;

    if (score.isTiebreak || score.isMatchTiebreak) {
      setWon = true;
      setWinner = gameWinner;
    } else if ((pg >= targetGames || og >= targetGames) && Math.abs(pg - og) >= 2) {
      setWon = true;
      setWinner = pg > og ? 'PLAYER' : 'OPPONENT';
    }

    newScore.playerPoints = 0;
    newScore.opponentPoints = 0;
    newScore.isDeuce = false;
    newScore.advantage = undefined;

    if (!score.isTiebreak && !score.isMatchTiebreak) {
      newScore.currentServer = score.currentServer === 'PLAYER' ? 'OPPONENT' : 'PLAYER';
    } else {
      const tbFirst = score.tiebreakFirstServer ?? score.currentServer;
      newScore.currentServer = tbFirst === 'PLAYER' ? 'OPPONENT' : 'PLAYER';
      newScore.tiebreakFirstServer = undefined;
    }

    if (!setWon) {
      // Dynamic In-Set Tiebreak Trigger Check:
      // When score is tied at targetGames - 1 (e.g. 5-5) or targetGames (e.g. 6-6)
      const isTiedAtTrigger = (pg === og) && (pg === targetGames - 1 || pg === targetGames) && !score.isTiebreak;

      if (isTiedAtTrigger) {
        const pressure = detectPressureContext(newScore, state.setup!.format);
        const newUndoStack = [...state.undoStack, undoSnapshot];

        set({
          score: newScore,
          pendingPointWinner: null,
          pendingPointNote: '',
          pendingPointFlags: [],
          pointsInGame: 0,
          phase: 'PLAYING',
          pendingDecision: 'SET_TIEBREAK',
          pressureContext: pressure,
          pressurePromptDismissed: false,
          courtSide: 'DEUCE',
          showChangeEnds: false,
          undoStack: newUndoStack,
          canUndo: true,
        });
        return;
      }

      // Standard continuation game
      const newGameId = uid();
      const nextGameNum = pg + og + 1;
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
        pendingDecision: null,
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

    // Set won
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

    newScore.isTiebreak = false;
    newScore.isMatchTiebreak = false;
    newScore.tiebreakTargetPoints = undefined;

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
        pendingDecision: null,
        pressureContext: null,
        showChangeEnds: false,
        undoStack: newUndoStack,
        canUndo: true,
      });
      return;
    }

    // Check if this is the deciding set (e.g. 1-1 in Best of 3, 2-2 in Best of 5)
    const totalSetsPlayed = newScore.playerSets + newScore.opponentSets;
    const isDecidingSet = (newScore.playerSets === newScore.opponentSets) && (newScore.playerSets + 1 === setsToWin);

    newScore.playerGames = 0;
    newScore.opponentGames = 0;

    if (isDecidingSet) {
      const pressure = detectPressureContext(newScore, state.setup!.format);
      const newUndoStack = [...state.undoStack, undoSnapshot];

      set({
        score: newScore,
        pendingPointWinner: null,
        pendingPointNote: '',
        pendingPointFlags: [],
        pointsInGame: 0,
        phase: 'PLAYING',
        pendingDecision: 'MATCH_TIEBREAK',
        pressureContext: pressure,
        pressurePromptDismissed: false,
        courtSide: 'DEUCE',
        showChangeEnds: false,
        undoStack: newUndoStack,
        canUndo: true,
      });
      return;
    }

    // Start normal new set
    const previousSetCompletedGames = score.playerGames + score.opponentGames + 1;
    const isOddSetChange = previousSetCompletedGames % 2 !== 0;

    const newSetId = uid();
    const setNum = totalSetsPlayed + 1;
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
      pendingDecision: null,
      pressureContext: pressure,
      pressurePromptDismissed: false,
      courtSide: tiebreakProcedure !== 'manual' && isOddSetChange ? 'DEUCE' : 'DEUCE',
      showChangeEnds: tiebreakProcedure !== 'manual' && isOddSetChange,
      changeEndsReason: (tiebreakProcedure !== 'manual' && isOddSetChange)
        ? `End of set (${previousSetCompletedGames} games, odd) — switch sides`
        : undefined,
      undoStack: newUndoStack,
      canUndo: true,
    });
  },

  /* ---- Interactive Tiebreak Decision Resolvers ---- */

  resolveSetTiebreakDecision: async (playTiebreak, targetPoints = 7) => {
    const state = get();
    if (state.pendingDecision !== 'SET_TIEBREAK') return;

    const newScore = { ...state.score };
    const { currentSetId, matchId, score } = state;
    const nextGameNum = score.playerGames + score.opponentGames + 1;
    const newGameId = uid();

    const newGame: DBGame = {
      id: newGameId,
      setId: currentSetId!,
      matchId: matchId!,
      gameNumber: nextGameNum,
      server: newScore.currentServer,
      isTiebreak: playTiebreak,
    };
    await db.games.add(newGame);

    if (playTiebreak) {
      newScore.isTiebreak = true;
      newScore.tiebreakTargetPoints = targetPoints;
      newScore.tiebreakFirstServer = newScore.currentServer;
    } else {
      newScore.isTiebreak = false;
      newScore.tiebreakTargetPoints = undefined;
    }

    set({
      score: newScore,
      currentGameId: newGameId,
      pointsInGame: 0,
      pendingDecision: null,
      phase: 'PLAYING',
    });
  },

  resolveMatchTiebreakDecision: async (playMatchTiebreak, targetPoints = 10) => {
    const state = get();
    if (state.pendingDecision !== 'MATCH_TIEBREAK') return;

    const newScore = { ...state.score };
    const { matchId } = state;
    const totalSetsPlayed = newScore.playerSets + newScore.opponentSets;
    const setNum = totalSetsPlayed + 1;
    const newSetId = uid();

    const newSet: DBSet = {
      id: newSetId,
      matchId: matchId!,
      setNumber: setNum,
      playerGames: 0,
      opponentGames: 0,
      tiebreak: playMatchTiebreak,
    };
    await db.sets.add(newSet);

    const newGameId = uid();
    const newGame: DBGame = {
      id: newGameId,
      setId: newSetId,
      matchId: matchId!,
      gameNumber: 1,
      server: newScore.currentServer,
      isTiebreak: playMatchTiebreak,
    };
    await db.games.add(newGame);

    if (playMatchTiebreak) {
      newScore.isMatchTiebreak = true;
      newScore.isTiebreak = true;
      newScore.tiebreakTargetPoints = targetPoints;
      newScore.tiebreakFirstServer = newScore.currentServer;
    } else {
      newScore.isMatchTiebreak = false;
      newScore.isTiebreak = false;
      newScore.tiebreakTargetPoints = undefined;
    }

    set({
      score: newScore,
      currentSetId: newSetId,
      currentGameId: newGameId,
      pointsInGame: 0,
      setsPlayed: [...state.setsPlayed, newSet],
      pendingDecision: null,
      phase: 'PLAYING',
    });
  },

  /* ---- Point metadata ---- */

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

  /* ---- Undo ---- */

  undoLastPoint: async () => {
    const state = get();

    if (state.role === 'OBSERVER' && state.matchId) {
      const bc = new BroadcastChannel(`courtedge-live-score-${state.matchId}`);
      bc.postMessage({
        type: 'OBSERVER_UNDO_POINT',
        timestamp: new Date().toISOString(),
      });
      bc.close();
      return;
    }

    if (state.undoStack.length === 0) return;

    const snapshot = state.undoStack[state.undoStack.length - 1];
    const newStack = state.undoStack.slice(0, -1);

    await db.points.delete(snapshot.pointId);

    if (snapshot.createdGameId) {
      await db.games.delete(snapshot.createdGameId);
    }

    if (snapshot.createdSetId) {
      await db.sets.delete(snapshot.createdSetId);
    }

    if (snapshot.previousGameId) {
      await db.games.update(snapshot.previousGameId, { winner: snapshot.previousGameWinner as 'PLAYER' | 'OPPONENT' | undefined });
    }

    if (snapshot.previousSetId && snapshot.previousSetData) {
      await db.sets.update(snapshot.previousSetId, snapshot.previousSetData);
    }

    if (snapshot.previousMatchStatus && state.matchId) {
      await db.matches.update(state.matchId, { status: snapshot.previousMatchStatus });
    }

    const pressure = state.setup
      ? detectPressureContext(snapshot.score, state.setup.format)
      : null;

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
      pendingDecision: snapshot.pendingDecision ?? null,
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

    set({ phase: 'FINISHED', score: newScore, pendingDecision: null });
  },

  resetMatch: () => {
    set({
      phase: 'SETUP',
      matchId: null,
      setup: null,
      targetGames: 6,
      pendingDecision: null,
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

    await db.matches.update(state.matchId, { status: 'SUSPENDED' });

    set({
      phase: 'IDLE',
      matchId: null,
      setup: null,
      targetGames: 6,
      pendingDecision: null,
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

  /* ---- Notes ---- */

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

  /* ---- Sync status ---- */

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

  recoverActiveMatch: async (matchIdToRecover?: string) => {
    const current = get();
    if (current.phase !== 'IDLE' && current.matchId && !matchIdToRecover) {
      return true;
    }

    set({ isRecovering: true });

    try {
      const allMatchesInDb = await db.matches.toArray();
      for (const m of allMatchesInDb) {
        const st = (m.status || '').toLowerCase();
        if (st === 'in_progress' || st === 'in-progress') {
          const ptCount = await db.points.where('matchId').equals(m.id).count();
          if (ptCount === 0) {
            await db.matches.update(m.id, { status: 'ABANDONED' });
          }
        }
      }

      let activeMatch: DBMatch | undefined = undefined;

      if (matchIdToRecover) {
        activeMatch = await db.matches.get(matchIdToRecover);
      } else {
        const activeCandidates = (await db.matches.toArray())
          .filter((m) => {
            const st = (m.status || '').toLowerCase();
            return st === 'in_progress' || st === 'in-progress' || st === 'suspended';
          })
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        for (const candidate of activeCandidates) {
          const ptCount = await db.points.where('matchId').equals(candidate.id).count();
          if (ptCount > 0) {
            activeMatch = candidate;
            break;
          }
        }
      }

      if (!activeMatch) {
        set({ isRecovering: false, phase: 'SETUP' });
        return false;
      }

      const targetGames = parseTargetGames(activeMatch.format);

      const setup: MatchSetup = {
        playerName: activeMatch.playerName,
        opponentName: activeMatch.opponentName,
        format: activeMatch.format,
        surface: activeMatch.surface,
        firstServer: activeMatch.firstServer,
        targetGames,
        tiebreakProcedure: activeMatch.tiebreakProcedure || 'standard',
        thirdSetFormat: activeMatch.thirdSetFormat || 'full-set',
        scoringFormat: activeMatch.scoringFormat || 'ad',
      };

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

      const activeSet = matchSets.find((s) => !s.winner) || matchSets[matchSets.length - 1];

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

      const allMatchPoints = await db.points
        .where('matchId')
        .equals(activeMatch.id)
        .sortBy('pointNumber');

      const activeGamePoints = allMatchPoints.filter((p) => p.gameId === activeGame.id);

      const playerSets = matchSets.filter((s) => s.winner === 'PLAYER').length;
      const opponentSets = matchSets.filter((s) => s.winner === 'OPPONENT').length;

      const playerGames = activeSet.playerGames;
      const opponentGames = activeSet.opponentGames;

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
        tiebreakTargetPoints: isMatchTiebreak ? 10 : (isTiebreak ? 7 : undefined),
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

      if (activeMatch.status === 'SUSPENDED') {
        await db.matches.update(activeMatch.id, { status: 'IN_PROGRESS' });
      }

      set({
        phase: isFinished ? 'FINISHED' : 'PLAYING',
        matchId: activeMatch.id,
        setup,
        targetGames,
        pendingDecision: null,
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
