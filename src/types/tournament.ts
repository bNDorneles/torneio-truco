export type TournamentPhase =
  | 'setup'
  | 'pairs'
  | 'groups'
  | 'knockout'
  | 'finished'

export type TournamentFormat = 'groups_knockout' | 'double_elim'

export type MatchStage =
  | 'group'
  | 'knockout'
  | 'prelim'
  | 'upper'
  | 'lower'
  | 'final'
  | 'third'

export type MatchStatus = 'pending' | 'done' | 'wo'

export type BestOf = 1 | 3 | 5

export type BracketSlotSide = 'A' | 'B'

export interface Player {
  id: string
  name: string
}

export interface Pair {
  id: string
  playerIds: [string, string]
  label?: string
}

export interface Group {
  id: string
  name: string
  pairIds: string[]
}

export interface GameScore {
  pointsA: number
  pointsB: number
}

export interface Match {
  id: string
  stage: MatchStage
  groupId?: string
  round?: number
  bracketSlot?: number
  pairAId: string | null
  pairBId: string | null
  setsA: number
  setsB: number
  pointsA: number
  pointsB: number
  /** Placar de cada partida/jogo (ex.: 24×12, 12×24, 24×12) */
  games: GameScore[]
  status: MatchStatus
  winnerPairId?: string | null
  isBye?: boolean
  nextMatchId?: string | null
  nextSlot?: BracketSlotSide | null
  loserNextMatchId?: string | null
  loserNextSlot?: BracketSlotSide | null
}

export interface BracketSlot {
  matchId: string | null
  pairId: string | null
  sourceMatchIds?: [string, string]
}

export interface TournamentSettings {
  bestOf: BestOf
  pointsTarget: number
  thirdPlaceEnabled: boolean
  /** Quantas duplas classificam por grupo (estilo FIFA). Default 2. */
  advancePerGroup?: number
}

export interface Tournament {
  id: string
  name: string
  slug: string
  createdAt: string
  updatedAt: string
  phase: TournamentPhase
  /** Default groups_knockout for tournaments created before formats existed */
  format?: TournamentFormat
  settings: TournamentSettings
  passwordHash: string
  salt: string
  players: Player[]
  pairs: Pair[]
  groups: Group[]
  matches: Match[]
  bracketRounds: BracketSlot[][]
  thirdPlaceMatchId?: string | null
}

export interface TournamentListItem {
  id: string
  name: string
  slug: string
  createdAt: string
  phase: TournamentPhase
}

export interface StandingRow {
  pairId: string
  played: number
  wins: number
  losses: number
  setsFor: number
  setsAgainst: number
  setDiff: number
  pointsFor: number
  pointsAgainst: number
  pointDiff: number
  rank: number
}

export function getTournamentFormat(t: Tournament): TournamentFormat {
  return t.format ?? 'groups_knockout'
}

export function getAdvancePerGroup(t: Tournament): number {
  const n = t.settings.advancePerGroup ?? 2
  return Math.min(4, Math.max(1, Math.floor(n)))
}

export function isKnockoutStage(stage: MatchStage): boolean {
  return stage !== 'group'
}
