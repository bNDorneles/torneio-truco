import type { Pair, Player, Tournament } from '../types/tournament'
import { pairLabel } from '../domain/drawPairs'

export function getPairName(tournament: Tournament, pairId: string | null | undefined): string {
  if (!pairId) return 'A definir'
  const pair = tournament.pairs.find((p) => p.id === pairId)
  if (!pair) return '—'
  return pairLabel(pair, tournament.players)
}

export function phaseLabel(phase: Tournament['phase']): string {
  const map: Record<Tournament['phase'], string> = {
    setup: 'Cadastro',
    pairs: 'Duplas',
    groups: 'Grupos',
    knockout: 'Mata-mata',
    finished: 'Finalizado',
  }
  return map[phase]
}

export function findPair(tournament: Tournament, pairId: string): Pair | undefined {
  return tournament.pairs.find((p) => p.id === pairId)
}

export function playerName(players: Player[], id: string): string {
  return players.find((p) => p.id === id)?.name ?? '?'
}
