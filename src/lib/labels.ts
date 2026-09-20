import type { Pair, Player, Tournament, TournamentFormat } from '../types/tournament'
import { getTournamentFormat } from '../types/tournament'
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

export function formatLabel(format: TournamentFormat | undefined): string {
  if (format === 'double_elim') return '2 vidas (chave alta/baixa)'
  return 'Grupos + mata-mata'
}

export function formatLabelOf(tournament: Tournament): string {
  return formatLabel(getTournamentFormat(tournament))
}

export function findPair(tournament: Tournament, pairId: string): Pair | undefined {
  return tournament.pairs.find((p) => p.id === pairId)
}

export function playerName(players: Player[], id: string): string {
  return players.find((p) => p.id === id)?.name ?? '?'
}
