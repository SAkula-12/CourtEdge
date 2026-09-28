import { create } from 'zustand';
import { db } from '@/lib/db';
import type { DBMatch, DBSet, DBGame, DBPoint } from '@/lib/db';
import { PointClassification } from '@/models/types';

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

  // Actions
  startSetup: () => void;
  confirmSetup: (setup: MatchSetup) => Promise<void>;
  selectPointWinner: (winner: 'PLAYER' | 'OPPONENT') => void;
  selectClassification: (classification: PointClassification) => void;
  confirmShotType: (shotType: string) => Promise<void>;
  confirmPoint: (classification: PointClassification, shotType?: string) => Promise<void>;
  cancelPointDetail: () => void;
  getPointLabel: (side: 'PLAYER' | 'OPPONENT') => string;
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
      format: setup.format,
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

    set({
      phase: 'PLAYING',
      matchId,
      setup,
      currentSetId: setId,
      currentGameId: gameId,
      pointsInGame: 0,
      setsPlayed: [dbSet],
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

    // 1. Persist the point
    const dbPoint: DBPoint = {
      id: uid(),
      gameId: currentGameId!,
      matchId: matchId!,
      pointNumber: pointsInGame + 1,
      server: score.currentServer,
      winner,
      classification,
      shotType,
      isCritical: 0,
      timestamp: new Date().toISOString(),
    };
    await db.points.add(dbPoint);

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
      set({
        score: newScore,
        pendingPointWinner: null,
        pointsInGame: pointsInGame + 1,
        phase: 'PLAYING',
      });
      return;
    }

    // 3. Game won — update DB game record
    await db.games.update(currentGameId!, { winner: gameWinner });

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

      set({
        score: newScore,
        pendingPointWinner: null,
        currentGameId: newGameId,
        pointsInGame: 0,
        phase: 'PLAYING',
      });
      return;
    }

    // 4. Set won
    await db.sets.update(currentSetId!, {
      playerGames: newScore.playerGames,
      opponentGames: newScore.opponentGames,
      winner: setWinner,
      tiebreak: score.isTiebreak,
    });

    if (setWinner === 'PLAYER') newScore.playerSets++;
    else newScore.opponentSets++;

    // Check match won
    const setsToWin = getSetsToWin(state.setup!.format);
    if (newScore.playerSets >= setsToWin || newScore.opponentSets >= setsToWin) {
      await db.matches.update(matchId!, { status: 'COMPLETED' });
      set({
        score: newScore,
        pendingPointWinner: null,
        phase: 'FINISHED',
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

    set({
      score: newScore,
      pendingPointWinner: null,
      currentSetId: newSetId,
      currentGameId: newGameId,
      pointsInGame: 0,
      setsPlayed: [...state.setsPlayed, newSet],
      phase: 'PLAYING',
    });
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
