import type { Group, Match } from '../types/tournament'
import { createId } from './ids'

export function generateRoundRobin(groups: Group[]): Match[] {
  const matches: Match[] = []

  for (const group of groups) {
    const ids = group.pairIds
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        matches.push({
          id: createId('match'),
          stage: 'group',
          groupId: group.id,
          pairAId: ids[i],
          pairBId: ids[j],
          setsA: 0,
          setsB: 0,
          pointsA: 0,
          pointsB: 0,
          games: [],
          status: 'pending',
        })
      }
    }
  }

  return matches
}
