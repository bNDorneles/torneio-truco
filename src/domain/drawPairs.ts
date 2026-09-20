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

/** Cadastra uma dupla manual (2 nomes) e cria os jogadores. */
export function createManualPair(
  players: Player[],
  nameA: string,
  nameB: string,
): { players: Player[]; pair: Pair } {
  const a = nameA.trim()
  const b = nameB.trim()
  if (!a || !b) throw new Error('Informe os dois nomes da dupla.')
  if (a.toLowerCase() === b.toLowerCase()) {
    throw new Error('Os dois jogadores precisam ser pessoas diferentes.')
  }

  const playerA: Player = { id: createId('pl'), name: a }
  const playerB: Player = { id: createId('pl'), name: b }
  const pair: Pair = {
    id: createId('pair'),
    playerIds: [playerA.id, playerB.id],
    label: `${a} / ${b}`,
  }
  return {
    players: [...players, playerA, playerB],
    pair,
  }
}

/** Atualiza os nomes dos dois jogadores de uma dupla e o label. */
export function updatePairNames(
  players: Player[],
  pairs: Pair[],
  pairId: string,
  nameA: string,
  nameB: string,
): { players: Player[]; pairs: Pair[] } {
  const a = nameA.trim()
  const b = nameB.trim()
  if (!a || !b) throw new Error('Informe os dois nomes da dupla.')

  const pair = pairs.find((p) => p.id === pairId)
  if (!pair) throw new Error('Dupla não encontrada.')

  const nextPlayers = players.map((p) => {
    if (p.id === pair.playerIds[0]) return { ...p, name: a }
    if (p.id === pair.playerIds[1]) return { ...p, name: b }
    return p
  })

  const nextPairs = pairs.map((p) =>
    p.id === pairId ? { ...p, label: `${a} / ${b}` } : p,
  )

  return { players: nextPlayers, pairs: nextPairs }
}

/** Remove a dupla e os dois jogadores dela. */
export function removePair(
  players: Player[],
  pairs: Pair[],
  pairId: string,
): { players: Player[]; pairs: Pair[] } {
  const pair = pairs.find((p) => p.id === pairId)
  if (!pair) throw new Error('Dupla não encontrada.')
  const drop = new Set(pair.playerIds)
  return {
    players: players.filter((p) => !drop.has(p.id)),
    pairs: pairs.filter((p) => p.id !== pairId),
  }
}
