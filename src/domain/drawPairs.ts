import type { Pair, Player } from '../types/tournament'
import { createId, shuffle } from './ids'

export function drawPairs(players: Player[]): Pair[] {
  if (players.length < 2 || players.length % 2 !== 0) {
    throw new Error('Precisa de quantidade par de jogadores (mínimo 2).')
  }

  const shuffled = shuffle(players)
  const pairs: Pair[] = []

  for (let i = 0; i < shuffled.length; i += 2) {
    const a = shuffled[i]
    const b = shuffled[i + 1]
    pairs.push({
      id: createId('pair'),
      playerIds: [a.id, b.id],
      label: `${a.name} / ${b.name}`,
    })
  }

  return pairs
}

export function pairLabel(pair: Pair, players: Player[]): string {
  if (pair.label) return pair.label
  const names = pair.playerIds.map(
    (id) => players.find((p) => p.id === id)?.name ?? '?',
  )
  return names.join(' / ')
}

export function rebuildPairLabels(pairs: Pair[], players: Player[]): Pair[] {
  return pairs.map((pair) => ({
    ...pair,
    label: pairLabel(pair, players),
  }))
}
