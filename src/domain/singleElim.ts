import type { Match } from '../types/tournament'
import { createId } from './ids'

export function isPowerOfTwo(n: number): boolean {
  return n >= 2 && (n & (n - 1)) === 0
}

export function nextPowerOfTwo(n: number): number {
  let p = 1
  while (p < n) p *= 2
  return Math.max(p, 2)
}

/**
 * Se N não é potência de 2: preliminares (confrontos reais) + chave principal.
 * Sem bye: os extras jogam a vaga; seeds diretos entram na 1ª rodada principal.
 * Ex.: 12 → 4 prelim + chave de 8.
 */
export function planSingleElimStructure(pairCount: number): {
  mainSize: number
  prelimMatches: number
  directSeeds: number
} {
  if (pairCount < 2) throw new Error('É preciso pelo menos 2 duplas na chave')
  if (isPowerOfTwo(pairCount)) {
    return { mainSize: pairCount, prelimMatches: 0, directSeeds: pairCount }
  }
  const mainSize = nextPowerOfTwo(pairCount) / 2
  const prelimMatches = pairCount - mainSize
  const directSeeds = mainSize - prelimMatches
  return { mainSize, prelimMatches, directSeeds }
}

function pairClassic(seeds: (string | null)[]): Array<[string | null, string | null]> {
  const n = seeds.length
  const result: Array<[string | null, string | null]> = []
  for (let i = 0; i < n / 2; i += 1) {
    result.push([seeds[i], seeds[n - 1 - i]])
  }
  return result
}

function emptyMatch(
  stage: Match['stage'],
  round: number,
  slot: number,
): Match {
  return {
    id: createId('ko'),
    stage,
    round,
    bracketSlot: slot,
    pairAId: null,
    pairBId: null,
    setsA: 0,
    setsB: 0,
    pointsA: 0,
    pointsB: 0,
    games: [],
    status: 'pending',
  }
}

function createEmptyPowerBracket(size: number): { rounds: Match[][]; all: Match[] } {
  const roundsCount = Math.log2(size)
  const rounds: Match[][] = []
  const all: Match[] = []

  for (let r = 0; r < roundsCount; r += 1) {
    const count = size / Math.pow(2, r + 1)
    const roundMatches: Match[] = []
    for (let i = 0; i < count; i += 1) {
      const stage = r === roundsCount - 1 ? 'final' : 'knockout'
      const m = emptyMatch(stage, r, i)
      roundMatches.push(m)
      all.push(m)
    }
    rounds.push(roundMatches)
  }

  for (let r = 0; r < roundsCount - 1; r += 1) {
    for (let i = 0; i < rounds[r].length; i += 1) {
      const next = rounds[r + 1][Math.floor(i / 2)]
      rounds[r][i].nextMatchId = next.id
      rounds[r][i].nextSlot = i % 2 === 0 ? 'A' : 'B'
    }
  }

  return { rounds, all }
}

export interface SingleElimBuild {
  matches: Match[]
  thirdPlaceMatchId: string | null
}

function attachThirdPlace(
  mainRounds: Match[][],
  mainSize: number,
  all: Match[],
  thirdPlaceEnabled: boolean,
): string | null {
  if (!thirdPlaceEnabled || mainSize < 4) return null
  const roundsCount = Math.log2(mainSize)
  const semis = mainRounds[roundsCount - 2]
  if (!semis || semis.length < 2) return null
  const third = emptyMatch('third', 0, 0)
  semis[0].loserNextMatchId = third.id
  semis[0].loserNextSlot = 'A'
  semis[1].loserNextMatchId = third.id
  semis[1].loserNextSlot = 'B'
  all.push(third)
  return third.id
}

/**
 * Chave a partir de confrontos já definidos (ex.: 1A×2B, 1B×2A…).
 * Quantidade de jogos da 1ª rodada deve ser potência de 2 / 2.
 */
export function buildSingleEliminationFromMatchups(
  matchups: Array<{ pairAId: string; pairBId: string }>,
  thirdPlaceEnabled: boolean,
): SingleElimBuild {
  const r0Count = matchups.length
  const mainSize = r0Count * 2
  if (r0Count < 1 || !isPowerOfTwo(mainSize)) {
    throw new Error('Cruzamentos inválidos para montar a chave.')
  }
  for (const m of matchups) {
    if (!m.pairAId || !m.pairBId || m.pairAId === m.pairBId) {
      throw new Error('Cada confronto precisa de duas duplas diferentes.')
    }
  }

  const { rounds: mainRounds, all } = createEmptyPowerBracket(mainSize)
  matchups.forEach((mu, i) => {
    mainRounds[0][i].pairAId = mu.pairAId
    mainRounds[0][i].pairBId = mu.pairBId
  })

  const thirdPlaceMatchId = attachThirdPlace(
    mainRounds,
    mainSize,
    all,
    thirdPlaceEnabled,
  )
  return { matches: all, thirdPlaceMatchId }
}

/** Chave single-elim a partir de seeds ordenados (melhor primeiro) — estilo fifa pairClassic. */
export function buildSingleElimination(
  seeds: string[],
  thirdPlaceEnabled: boolean,
): SingleElimBuild {
  if (seeds.length < 2) throw new Error('É preciso pelo menos 2 duplas na chave')

  const { mainSize, prelimMatches, directSeeds } = planSingleElimStructure(seeds.length)
  const { rounds: mainRounds, all: mainAll } = createEmptyPowerBracket(mainSize)

  let all: Match[]

  if (prelimMatches === 0) {
    const pairs = pairClassic(seeds)
    pairs.forEach((pair, i) => {
      mainRounds[0][i].pairAId = pair[0]
      mainRounds[0][i].pairBId = pair[1]
    })
    all = [...mainAll]
  } else {
    const directs = seeds.slice(0, directSeeds)
    const playIns = seeds.slice(directSeeds)
    const r0 = mainRounds[0]

    type Slot =
      | { kind: 'direct'; pairId: string }
      | { kind: 'prelim'; index: number }
    const slots: Slot[] = []
    let dIdx = 0
    let pIdx = 0
    for (let i = 0; i < mainSize; i += 1) {
      const preferPrelim = i % 2 === 1
      if (preferPrelim && pIdx < prelimMatches) {
        slots.push({ kind: 'prelim', index: pIdx++ })
      } else if (dIdx < directs.length) {
        slots.push({ kind: 'direct', pairId: directs[dIdx++] })
      } else {
        slots.push({ kind: 'prelim', index: pIdx++ })
      }
    }

    const feeder: Array<{ matchId: string; slot: 'A' | 'B' } | null> = Array(
      prelimMatches,
    ).fill(null)

    for (let i = 0; i < r0.length; i += 1) {
      const homeSlot = slots[i * 2]
      const awaySlot = slots[i * 2 + 1]
      if (homeSlot.kind === 'direct') r0[i].pairAId = homeSlot.pairId
      else feeder[homeSlot.index] = { matchId: r0[i].id, slot: 'A' }
      if (awaySlot.kind === 'direct') r0[i].pairBId = awaySlot.pairId
      else feeder[awaySlot.index] = { matchId: r0[i].id, slot: 'B' }
    }

    const prelimRound: Match[] = []
    for (let i = 0; i < prelimMatches; i += 1) {
      const dest = feeder[i]
      if (!dest) throw new Error('Falha ao montar fase preliminar')
      const a = playIns[i * 2]
      const b = playIns[i * 2 + 1]
      if (!a || !b) throw new Error('Preliminar incompleta — sem bye permitido')
      const m = emptyMatch('prelim', 0, i)
      m.pairAId = a
      m.pairBId = b
      m.nextMatchId = dest.matchId
      m.nextSlot = dest.slot
      prelimRound.push(m)
    }
    all = [...prelimRound, ...mainAll]
  }

  const thirdPlaceMatchId = attachThirdPlace(
    mainRounds,
    mainSize,
    all,
    thirdPlaceEnabled,
  )

  return { matches: all, thirdPlaceMatchId }
}
