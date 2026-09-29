/* ------------------------------------------------------------------ */
/*  Tournament-grade scoring configuration types                       */
/* ------------------------------------------------------------------ */

/** Standard = change ends every 6 pts; Coman = change after 1st then every 4 */
export type TiebreakProcedure = 'standard' | 'coman';

/** full-set = play a normal third set; 10-point-match-tiebreak = super tiebreak */
export type ThirdSetFormat = 'full-set' | '10-point-match-tiebreak';

/** ad = advantage scoring; no-ad = sudden death at 40-40 */
export type ScoringFormat = 'ad' | 'no-ad';

/* ------------------------------------------------------------------ */
/*  Core domain types                                                  */
/* ------------------------------------------------------------------ */

export interface User {
  id: string;
  email: string;
  role: 'PLAYER' | 'PARENT' | 'COACH' | 'ADMIN';
  createdAt: Date;
}

export interface PlayerProfile {
  id: string;
  userId: string;
  name: string;
  age?: number;
  utr?: number;
  dominantHand?: 'LEFT' | 'RIGHT';
  backhandType?: 'ONE_HANDED' | 'TWO_HANDED';
  location?: string;
  competitiveStatus?: 'COMPETITIVE' | 'RECREATIONAL';
  createdAt: Date;
}

export interface Match {
  id: string;
  playerId: string;
  opponentId?: string;
  opponentName?: string;
  date: Date;
  location?: string;
  surface?: 'HARD' | 'CLAY' | 'GRASS' | 'CARPET' | 'OTHER';
  indoor: boolean;
  format?: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';
  sets: Set[];
}

export interface Set {
  id: string;
  matchId: string;
  setNumber: number;
  playerScore: number;
  opponentScore: number;
  games: Game[];
}

export interface Game {
  id: string;
  setId: string;
  gameNumber: number;
  server: 'PLAYER' | 'OPPONENT';
  playerScore: number; 
  opponentScore: number;
  points: Point[];
}

export interface Point {
  id: string;
  gameId: string;
  pointNumber: number;
  server: 'PLAYER' | 'OPPONENT';
  winner: 'PLAYER' | 'OPPONENT';
  classification?: PointClassification;
  shotType?: 'FOREHAND' | 'BACKHAND' | 'SERVE' | 'VOLLEY' | 'SLICE' | 'OTHER';
  observations: Observation[];
  flags: CriticalPointFlag[];
  note?: string;
}

export enum PointClassification {
  ACE = 'ACE',
  WINNER = 'WINNER',
  FORCED_ERROR = 'FORCED_ERROR',
  UNFORCED_ERROR = 'UNFORCED_ERROR',
  DOUBLE_FAULT = 'DOUBLE_FAULT',
  OPPONENT_WINNER = 'OPPONENT_WINNER',
  OPPONENT_FORCED_ERROR = 'OPPONENT_FORCED_ERROR'
}

export type CriticalPointFlagType = 'IMPORTANT' | 'CRITICAL' | 'WORTH_REVIEWING' | 'SYSTEM_DETECTED';

export interface Observer {
  id: string;
  name: string;
  role: 'PARENT' | 'COACH' | 'FRIEND' | 'TEAMMATE' | 'SPECTATOR' | 'OTHER';
}

export interface Observation {
  id: string;
  pointId?: string;
  matchId?: string;
  observerId: string;
  note: string;
  timestamp: Date;
}

export interface CriticalPointFlag {
  id: string;
  pointId: string;
  observerId: string;
  type: CriticalPointFlagType;
  timestamp: Date;
}

/** Broader notes attached at game or match level (Section 16) */
export type NoteScopeLevel = 'POINT' | 'GAME' | 'MATCH';

export interface MatchNote {
  id: string;
  matchId: string;
  scope: NoteScopeLevel;
  /** References: gameId for GAME-level, or undefined for MATCH-level */
  scopeRefId?: string;
  text: string;
  createdAt: string;
}
