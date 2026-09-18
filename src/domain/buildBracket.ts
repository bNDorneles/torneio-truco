import type { BracketSlot, Match } from '../types/tournament'
import type { QualifiedPair } from './qualify'
import { createId } from './ids'

export interface BracketBuildResult {
  matches: Match[]
  rounds: BracketSlot[][]
  thirdPlaceMatch?: Match
}

/**
 * Seeds: cross 1st vs 2nd from other groups when possible.
 * Byes go to top overall seeds.
 */
export function buildBracket(
  qualified: QualifiedPair[],
  thirdPlaceEnabled: boolean,
): BracketBuildResult {
  const n = qualified.length
  if (n < 2) throw new Error('Precisa de pelo menos 2 classificados.')

  // Order: best firsts first, then rest already ordered by qualify
  const seeded = [...qualified]
  const size = n
  const roundsCount = Math.log2(size)

  // Classic bracket seeding positions for power of 2
  const positions = seedPositions(size)
  const slotPairs: (QualifiedPair | null)[] = Array(size).fill(null)
  seeded.forEach((q, i) => {
    slotPairs[positions[i]] = q
  })

  const allMatches: Match[] = []
  const rounds: BracketSlot[][] = []

  // Round 0 matches
  const round0: BracketSlot[] = []
  const round0Matches: Match[] = []

  for (let i = 0; i < size; i += 2) {
    const a = slotPairs[i]
    const b = slotPairs[i + 1]
    const match: Match = {
      id: createId('ko'),
      stage: 'knockout',
      round: 0,
      bracketSlot: i / 2,
      pairAId: a?.pairId ?? null,
      pairBId: b?.pairId ?? null,
      setsA: 0,
      setsB: 0,
      pointsA: 0,
      pointsB: 0,
      games: [],
      status: 'pending',
      isBye: !a || !b,
    }

    if (a && !b) {
      match.status = 'done'
      match.winnerPairId = a.pairId
      match.isBye = true
    } else if (b && !a) {
      match.status = 'done'
      match.winnerPairId = b.pairId
      match.isBye = true
    }

    round0Matches.push(match)
    allMatches.push(match)
    round0.push({
      matchId: match.id,
      pairId: null,
    })
  }
  rounds.push(round0)

  let prevMatches = round0Matches
  for (let r = 1; r < roundsCount; r += 1) {
    const roundSlots: BracketSlot[] = []
    const roundMatches: Match[] = []
    for (let i = 0; i < prevMatches.length; i += 2) {
      const m1 = prevMatches[i]
      const m2 = prevMatches[i + 1]
      const match: Match = {
        id: createId('ko'),
        stage: 'knockout',
        round: r,
        bracketSlot: i / 2,
        pairAId: m1.winnerPairId ?? null,
        pairBId: m2.winnerPairId ?? null,
        setsA: 0,
        setsB: 0,
        pointsA: 0,
        pointsB: 0,
        games: [],
        status: 'pending',
      }
      roundMatches.push(match)
      allMatches.push(match)
      roundSlots.push({
        matchId: match.id,
        pairId: null,
        sourceMatchIds: [m1.id, m2.id],
      })
    }
    rounds.push(roundSlots)
    prevMatches = roundMatches
  }

  let thirdPlaceMatch: Match | undefined
  if (thirdPlaceEnabled && size >= 4) {
    const semiRound = roundsCount - 2
    const semis = allMatches.filter((m) => m.round === semiRound)
    if (semis.length >= 2) {
      thirdPlaceMatch = {
        id: createId('third'),
        stage: 'third',
        round: 0,
        pairAId: null,
        pairBId: null,
        setsA: 0,
        setsB: 0,
        pointsA: 0,
        pointsB: 0,
        games: [],
        status: 'pending',
      }
      allMatches.push(thirdPlaceMatch)
    }
  }

  return { matches: allMatches, rounds, thirdPlaceMatch }
}

/** Standard tournament seeding order into bracket slots */
function seedPositions(n: number): number[] {
  let positions = [0, 1]
  while (positions.length < n) {
    const next: number[] = []
    const size = positions.length * 2
    for (const p of positions) {
      next.push(p)
      next.push(size - 1 - p)
    }
    positions = next
  }
  return positions
}

export function advanceBracketWinners(
  knockoutMatches: Match[],
  rounds: BracketSlot[][],
  thirdPlaceMatchId?: string | null,
): Match[] {
  const byId = new Map(knockoutMatches.map((m) => [m.id, { ...m }]))

  for (let r = 1; r < rounds.length; r += 1) {
    for (const slot of rounds[r]) {
      if (!slot.matchId || !slot.sourceMatchIds) continue
      const match = byId.get(slot.matchId)
      const srcA = byId.get(slot.sourceMatchIds[0])
      const srcB = byId.get(slot.sourceMatchIds[1])
      if (!match || !srcA || !srcB) continue

      const nextA = srcA.winnerPairId ?? null
      const nextB = srcB.winnerPairId ?? null
      if (match.pairAId !== nextA || match.pairBId !== nextB) {
        // Reset score if participants changed
        if (match.status === 'done' || match.status === 'wo') {
          match.status = 'pending'
          match.setsA = 0
          match.setsB = 0
          match.pointsA = 0
          match.pointsB = 0
          match.games = []
          match.winnerPairId = null
        }
        match.pairAId = nextA
        match.pairBId = nextB
      }
    }
  }

  // Third place: losers of semis
  if (thirdPlaceMatchId) {
    const third = byId.get(thirdPlaceMatchId)
    const finalRound = rounds.length - 1
    const semiRound = finalRound - 1
    if (third && semiRound >= 0) {
      const semis = rounds[semiRound]
        .map((s) => (s.matchId ? byId.get(s.matchId) : undefined))
        .filter(Boolean) as Match[]
      if (semis.length >= 2 && semis.every((m) => m.winnerPairId)) {
        const losers = semis.map((m) =>
          m.winnerPairId === m.pairAId ? m.pairBId : m.pairAId,
        )
        third.pairAId = losers[0] ?? null
        third.pairBId = losers[1] ?? null
      }
    }
  }

  return [...byId.values()]
}

export function swapBracketPairs(
  matches: Match[],
  matchId: string,
  side: 'A' | 'B',
  newPairId: string | null,
): Match[] {
  return matches.map((m) => {
    if (m.id !== matchId) return m
    if (side === 'A') {
      return {
        ...m,
        pairAId: newPairId,
        status: 'pending',
        winnerPairId: null,
        setsA: 0,
        setsB: 0,
        pointsA: 0,
        pointsB: 0,
        games: [],
      }
    }
    return {
      ...m,
      pairBId: newPairId,
      status: 'pending',
      winnerPairId: null,
      setsA: 0,
      setsB: 0,
      pointsA: 0,
      pointsB: 0,
      games: [],
    }
  })
}
