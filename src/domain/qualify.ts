import type { Group, Match, StandingRow } from '../types/tournament'
import { compareStandings, computeStandings } from './standings'

export interface QualifiedPair {
  pairId: string
  groupId: string
  groupRank: number
  standing: StandingRow
  tag: string
}

/** Maior potência de 2 que cabe em n (mínimo 2). Sem pad / bye. */
export function largestPowerOfTwo(n: number): number {
  let p = 1
  while (p * 2 <= n) p *= 2
  return Math.max(p, 2)
}

export function qualifyFromGroups(
  groups: Group[],
  matches: Match[],
): QualifiedPair[] {
  const groupStandings = groups.map((group) => ({
    group,
    standings: computeStandings(
      group.pairIds,
      matches.filter((m) => m.stage === 'group' && m.groupId === group.id),
    ),
  }))

  const firsts: QualifiedPair[] = []
  const seconds: QualifiedPair[] = []
  const thirds: QualifiedPair[] = []

  for (const { group, standings } of groupStandings) {
    standings.forEach((row, idx) => {
      const entry: QualifiedPair = {
        pairId: row.pairId,
        groupId: group.id,
        groupRank: idx + 1,
        standing: row,
        tag: `${group.name.replace('Grupo ', '')}${idx + 1}`,
      }
      if (idx === 0) firsts.push(entry)
      else if (idx === 1) seconds.push(entry)
      else if (idx === 2) thirds.push(entry)
    })
  }

  seconds.sort((a, b) => compareStandings(a.standing, b.standing, matches))
  thirds.sort((a, b) => compareStandings(a.standing, b.standing, matches))
  firsts.sort((a, b) => compareStandings(a.standing, b.standing, matches))

  const pool: QualifiedPair[] = [...firsts, ...seconds, ...thirds]
  if (pool.length < 2) {
    throw new Error('Precisa de pelo menos 2 duplas classificadas.')
  }

  const target = largestPowerOfTwo(pool.length)
  return pool.slice(0, target)
}
