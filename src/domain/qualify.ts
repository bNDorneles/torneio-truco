import type { Group, Match, StandingRow } from '../types/tournament'
import { compareStandings, computeStandings } from './standings'

export interface QualifiedPair {
  pairId: string
  groupId: string
  groupRank: number
  standing: StandingRow
  tag: string
}

export function nextPowerOfTwo(n: number): number {
  let p = 1
  while (p < n) p *= 2
  return p
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

  const totalPairs = groups.reduce((sum, g) => sum + g.pairIds.length, 0)
  let target = nextPowerOfTwo(Math.max(firsts.length, 2))
  if (target > totalPairs) {
    // shrink to largest power of 2 <= totalPairs
    target = 1
    while (target * 2 <= totalPairs) target *= 2
  }
  if (target < 2) target = 2

  const qualified: QualifiedPair[] = [...firsts]
  for (const s of seconds) {
    if (qualified.length >= target) break
    qualified.push(s)
  }
  for (const t of thirds) {
    if (qualified.length >= target) break
    qualified.push(t)
  }

  // If we still have fewer than target but can't fill, use next lower power of 2
  while (qualified.length < target && target > 2) {
    target /= 2
  }
  return qualified.slice(0, target)
}
