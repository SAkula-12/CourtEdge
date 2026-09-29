import Dexie, { type EntityTable } from 'dexie';

// Flat DB-friendly interfaces (no nested arrays — relations are by foreign key)

export interface DBMatch {
  id: string;
  playerName: string;
  opponentName: string;
  date: string;           // ISO string for IndexedDB compatibility
  surface: string;
  format: 'BEST_OF_1' | 'BEST_OF_3' | 'BEST_OF_5';
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED' | 'SUSPENDED';
  firstServer: 'PLAYER' | 'OPPONENT';
  synced: 0 | 1;          // 0 = pending, 1 = synced (indexable number)
  // Tournament-grade scoring settings (v3)
  tiebreakProcedure?: 'standard' | 'coman' | 'manual';
  thirdSetFormat?: 'full-set' | '10-point-match-tiebreak';
  scoringFormat?: 'ad' | 'no-ad';
}

export interface DBSet {
  id: string;
  matchId: string;
  setNumber: number;
  playerGames: number;
  opponentGames: number;
  tiebreak: boolean;
  winner?: 'PLAYER' | 'OPPONENT';
}

export interface DBGame {
  id: string;
  setId: string;
  matchId: string;
  gameNumber: number;
  server: 'PLAYER' | 'OPPONENT';
  winner?: 'PLAYER' | 'OPPONENT';
  isTiebreak: boolean;
}

export interface DBPoint {
  id: string;
  gameId: string;
  matchId: string;
  pointNumber: number;
  server: 'PLAYER' | 'OPPONENT';
  winner: 'PLAYER' | 'OPPONENT';
  classification: string;   // PointClassification enum value
  shotType?: string;
  note?: string;
  flags?: string;            // JSON-serialised CriticalPointFlagType[] for simple storage
  isCritical: 0 | 1;
  timestamp: string;
}

/** Game / Match-level notes (Section 16) */
export interface DBNote {
  id: string;
  matchId: string;
  scope: 'POINT' | 'GAME' | 'MATCH';
  scopeRefId?: string;     // gameId or pointId depending on scope
  text: string;
  createdAt: string;
}

class CourtEdgeDB extends Dexie {
  matches!: EntityTable<DBMatch, 'id'>;
  sets!: EntityTable<DBSet, 'id'>;
  games!: EntityTable<DBGame, 'id'>;
  points!: EntityTable<DBPoint, 'id'>;
  notes!: EntityTable<DBNote, 'id'>;

  constructor() {
    super('CourtEdgeDB');

    this.version(1).stores({
      matches: 'id, status, synced, date',
      sets:    'id, matchId, setNumber',
      games:   'id, setId, matchId, gameNumber',
      points:  'id, gameId, matchId, pointNumber, isCritical',
    });

    // v2: add notes table, add flags column to points
    this.version(2).stores({
      matches: 'id, status, synced, date',
      sets:    'id, matchId, setNumber',
      games:   'id, setId, matchId, gameNumber',
      points:  'id, gameId, matchId, pointNumber, isCritical',
      notes:   'id, matchId, scope, scopeRefId',
    });
  }
}

export const db = new CourtEdgeDB();
