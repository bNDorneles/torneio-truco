import type { Match, Tournament } from '../types/tournament'
import { createId, shuffle } from './ids'

export const STARTING_LIVES = 2

export function computeLives(
  pairIds: string[],
  matches: Match[],
  starting = STARTING_LIVES,
): Record<string, number> {
  const lives: Record<string, number> = {}
  for (const id of pairIds) lives[id] = starting

  for (const match of matches) {
    if (match.stage !== 'knockout') continue
    if (match.status === 'pending' || !match.winnerPairId) continue
    if (!match.pairAId || !match.pairBId) continue
    const loser =
      match.winnerPairId === match.pairAId ? match.pairBId : match.pairAId
    if (loser && lives[loser] !== undefined) {
      lives[loser] = Math.max(0, lives[loser] - 1)
    }
  }

  return lives
}

export function alivePairIds(lives: Record<string, number>): string[] {
  return Object.entries(lives)
    .filter(([, n]) => n > 0)
    .map(([id]) => id)
}

function matchKey(a: string, b: string): string {
  return [a, b].sort().join('|')
}

function playedKeys(matches: Match[]): Set<string> {
  const keys = new Set<string>()
  for (const m of matches) {
    if (m.stage !== 'knockout' || !m.pairAId || !m.pairBId) continue
    keys.add(matchKey(m.pairAId, m.pairBId))
  }
  return keys
}

function busyPairIds(matches: Match[]): Set<string> {
  const busy = new Set<string>()
  for (const m of matches) {
    if (m.stage !== 'knockout' || m.status !== 'pending') continue
    if (m.pairAId) busy.add(m.pairAId)
    if (m.pairBId) busy.add(m.pairBId)
  }
  return busy
}

function tryPair(ids: string[], played: Set<string>): [string, string][] {
  const rest = shuffle(ids)
  const result: [string, string][] = []
  const used = new Set<string>()

  for (let i = 0; i < rest.length; i += 1) {
    if (used.has(rest[i])) continue
    let partner: string | null = null
    for (let j = i + 1; j < rest.length; j += 1) {
      if (used.has(rest[j])) continue
      if (!played.has(matchKey(rest[i], rest[j]))) {
        partner = rest[j]
        break
      }
    }
    if (!partner) {
      for (let j = i + 1; j < rest.length; j += 1) {
        if (!used.has(rest[j])) {
          partner = rest[j]
          break
        }
      }
    }
    if (partner) {
      used.add(rest[i])
      used.add(partner)
      result.push([rest[i], partner])
    }
  }

  return result
}

export function fillLivesMatches(tournament: Tournament): Match[] {
  const lives = computeLives(tournament.pairs.map((p) => p.id), tournament.matches)
  const alive = alivePairIds(lives)
  if (alive.length < 2) return tournament.matches

  const ko = tournament.matches.filter((m) => m.stage === 'knockout')
  const busy = busyPairIds(tournament.matches)
  const free = alive.filter((id) => !busy.has(id))
  if (free.length < 2) return tournament.matches

  const played = playedKeys(ko)
  let best = tryPair(free, played)
  for (let i = 0; i < 12; i += 1) {
    const candidate = tryPair(free, played)
    const rematches = candidate.filter(([a, b]) => played.has(matchKey(a, b))).length
    const bestRematches = best.filter(([a, b]) => played.has(matchKey(a, b))).length
    if (candidate.length > best.length || rematches < bestRematches) {
      best = candidate
    }
  }

  const round =
    ko.reduce((max, m) => Math.max(max, m.round ?? 0), 0) + (busy.size ? 0 : 1)

  const extra: Match[] = best.map(([a, b]) => ({
    id: createId('ko'),
    stage: 'knockout',
    round,
    pairAId: a,
    pairBId: b,
    setsA: 0,
    setsB: 0,
    pointsA: 0,
    pointsB: 0,
    games: [],
    status: 'pending',
  }))

  return [...tournament.matches, ...extra]
}

export function applyLivesAfterMatch(tournament: Tournament): Tournament {
  const matches = fillLivesMatches(tournament)
  const lives = computeLives(
    tournament.pairs.map((p) => p.id),
    matches,
  )
  const alive = alivePairIds(lives)
  const phase = alive.length <= 1 ? 'finished' : 'knockout'
  return { ...tournament, matches, phase }
}

export function startLivesPhase(tournament: Tournament): Tournament {
  const groupMatches = tournament.matches.filter((m) => m.stage === 'group')
  const started: Tournament = {
    ...tournament,
    matches: groupMatches,
    bracketRounds: [],
    thirdPlaceMatchId: null,
    phase: 'knockout',
  }
  return applyLivesAfterMatch(started)
}
