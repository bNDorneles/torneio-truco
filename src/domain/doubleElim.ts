import type { Match } from '../types/tournament'
import { createId, shuffle } from './ids'
import { isPowerOfTwo, planSingleElimStructure } from './singleElim'

function emptyMatch(stage: Match['stage'], round: number, slot: number): Match {
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

function pairClassic(seeds: string[]): Array<[string, string]> {
  const n = seeds.length
  const result: Array<[string, string]> = []
  for (let i = 0; i < n / 2; i += 1) {
    result.push([seeds[i], seeds[n - 1 - i]])
  }
  return result
}

function placePair(match: Match, slot: 'A' | 'B', pairId: string | null): void {
  if (slot === 'A') match.pairAId = pairId
  else match.pairBId = pairId
}

export function matchWinner(m: Match): string | null {
  if (m.status === 'pending' || !m.winnerPairId) return null
  return m.winnerPairId
}

export function matchLoser(m: Match): string | null {
  if (m.status === 'pending' || !m.winnerPairId) return null
  if (!m.pairAId || !m.pairBId) return null
  return m.winnerPairId === m.pairAId ? m.pairBId : m.pairAId
}

export function advanceFromMatch(all: Match[], match: Match): void {
  const winner = matchWinner(match)
  if (winner && match.nextMatchId && match.nextSlot) {
    const next = all.find((x) => x.id === match.nextMatchId)
    if (next) placePair(next, match.nextSlot, winner)
  }
  const loser = matchLoser(match)
  if (loser && match.loserNextMatchId && match.loserNextSlot) {
    const next = all.find((x) => x.id === match.loserNextMatchId)
    if (next) placePair(next, match.loserNextSlot, loser)
  }
}

/**
 * Monta upper + lower + final para um tamanho potência de 2 (todas as vagas preenchidas
 * na 1ª rodada da chave alta, sem bye).
 */
function buildPowerDoubleElim(seeds: string[]): Match[] {
  if (!isPowerOfTwo(seeds.length)) {
    throw new Error('Chave principal precisa de potência de 2.')
  }
  if (seeds.length < 2) throw new Error('É preciso pelo menos 2 duplas')

  const size = seeds.length

  if (size === 2) {
    const finalMatch = emptyMatch('final', 0, 0)
    finalMatch.pairAId = seeds[0]
    finalMatch.pairBId = seeds[1]
    return [finalMatch]
  }

  const upperRounds = Math.log2(size)
  const upper: Match[][] = []
  const all: Match[] = []

  for (let r = 0; r < upperRounds; r += 1) {
    const count = size / Math.pow(2, r + 1)
    const round: Match[] = []
    for (let i = 0; i < count; i += 1) {
      const m = emptyMatch('upper', r, i)
      round.push(m)
      all.push(m)
    }
    upper.push(round)
  }

  for (let r = 0; r < upperRounds - 1; r += 1) {
    for (let i = 0; i < upper[r].length; i += 1) {
      const next = upper[r + 1][Math.floor(i / 2)]
      upper[r][i].nextMatchId = next.id
      upper[r][i].nextSlot = i % 2 === 0 ? 'A' : 'B'
    }
  }

  const lower: Match[][] = []
  for (let r = 0; r < upperRounds; r += 1) {
    const lowerCount = r === 0 ? size / 4 : size / Math.pow(2, r + 2)
    const actual = Math.max(1, lowerCount)
    const round: Match[] = []
    for (let i = 0; i < actual; i += 1) {
      const m = emptyMatch('lower', r, i)
      round.push(m)
      all.push(m)
    }
    lower.push(round)
  }

  for (let i = 0; i < upper[0].length; i += 1) {
    const lm = lower[0][Math.floor(i / 2)]
    if (!lm) continue
    upper[0][i].loserNextMatchId = lm.id
    upper[0][i].loserNextSlot = i % 2 === 0 ? 'A' : 'B'
  }

  for (let r = 1; r < upperRounds; r += 1) {
    for (let i = 0; i < upper[r].length; i += 1) {
      const lm = lower[r]?.[i]
      if (!lm) continue
      upper[r][i].loserNextMatchId = lm.id
      upper[r][i].loserNextSlot = 'A'
    }
    if (lower[r - 1] && lower[r]) {
      for (let i = 0; i < lower[r - 1].length; i += 1) {
        const dest = lower[r][Math.min(i, lower[r].length - 1)]
        lower[r - 1][i].nextMatchId = dest.id
        lower[r - 1][i].nextSlot = 'B'
      }
    }
  }

  const finalMatch = emptyMatch('final', 0, 0)
  all.push(finalMatch)

  upper[upper.length - 1][0].nextMatchId = finalMatch.id
  upper[upper.length - 1][0].nextSlot = 'A'
  lower[lower.length - 1][0].nextMatchId = finalMatch.id
  lower[lower.length - 1][0].nextSlot = 'B'

  const pairs = pairClassic(seeds)
  pairs.forEach((pair, i) => {
    upper[0][i].pairAId = pair[0]
    upper[0][i].pairBId = pair[1]
  })

  return all
}

/**
 * Double-elim sem BYE.
 * Se N não é potência de 2: fase preliminar (confrontos reais) reduz até a potência
 * de 2 seguinte para baixo; vencedores entram na chave alta com os seeds diretos.
 * Perdedores da prelim ficam fora (disputa de vaga). Depois disso, 2 vidas na chave.
 */
export function buildDoubleElimination(pairIds: string[]): { matches: Match[] } {
  if (pairIds.length < 2) throw new Error('É preciso pelo menos 2 duplas')

  const seeds = shuffle(pairIds)
  const { mainSize, prelimMatches, directSeeds } = planSingleElimStructure(seeds.length)

  if (prelimMatches === 0) {
    return { matches: buildPowerDoubleElim(seeds) }
  }

  const directs = seeds.slice(0, directSeeds)
  const playIns = seeds.slice(directSeeds)
  if (playIns.length !== prelimMatches * 2) {
    throw new Error('Falha ao montar preliminares sem bye.')
  }

  // Caso especial: chave principal de 2 (ex.: 3 duplas → 1 prelim + final)
  if (mainSize === 2) {
    const finalMatch = emptyMatch('final', 0, 0)
    const prelimRound: Match[] = []

    if (directSeeds === 1 && prelimMatches === 1) {
      const prelim = emptyMatch('prelim', 0, 0)
      prelim.pairAId = playIns[0]
      prelim.pairBId = playIns[1]
      if (!prelim.pairAId || !prelim.pairBId) {
        throw new Error('Preliminar incompleta — sem bye permitido')
      }
      prelim.nextMatchId = finalMatch.id
      prelim.nextSlot = 'B'
      finalMatch.pairAId = directs[0]
      prelimRound.push(prelim)
    } else if (directSeeds === 0 && prelimMatches === 1) {
      // 2 pairs only goes through power path; 3+ with 0 directs shouldn't happen
      throw new Error('Estrutura de prelim inválida.')
    } else {
      // 2 prelims into final? mainSize 2 with more prelims — e.g. shouldn't for plan
      throw new Error('Estrutura de prelim inválida para final.')
    }

    return { matches: [...prelimRound, finalMatch] }
  }

  // Chave principal vazia (potência de 2); slots da 1ª rodada alimentados por diretos + prelim
  const mainSeedPlaceholders = Array.from({ length: mainSize }, (_, i) => `__slot_${i}`)
  const mainMatches = buildPowerDoubleElim(mainSeedPlaceholders)
  const upperR0 = mainMatches
    .filter((m) => m.stage === 'upper' && (m.round ?? 0) === 0)
    .sort((a, b) => (a.bracketSlot ?? 0) - (b.bracketSlot ?? 0))

  // Limpar placeholders — vamos preencher com IDs reais / feeders
  for (const m of upperR0) {
    m.pairAId = null
    m.pairBId = null
  }

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

  for (let i = 0; i < upperR0.length; i += 1) {
    const homeSlot = slots[i * 2]
    const awaySlot = slots[i * 2 + 1]
    if (homeSlot.kind === 'direct') upperR0[i].pairAId = homeSlot.pairId
    else feeder[homeSlot.index] = { matchId: upperR0[i].id, slot: 'A' }
    if (awaySlot.kind === 'direct') upperR0[i].pairBId = awaySlot.pairId
    else feeder[awaySlot.index] = { matchId: upperR0[i].id, slot: 'B' }
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

  assertNoOpenFirstRound([...prelimRound, ...upperR0])

  return { matches: [...prelimRound, ...mainMatches] }
}

/** Garante que todo jogo da 1ª onda tem dois lados OU espera feeder (não bye). */
function assertNoOpenFirstRound(matches: Match[]): void {
  for (const m of matches) {
    if (m.stage === 'prelim') {
      if (!m.pairAId || !m.pairBId) {
        throw new Error('Preliminar sem confronto completo (bye proibido).')
      }
    }
  }
  // Upper R0: cada lado é direto OU vem de prelim — nunca um lado vazio sem feeder
  const feeders = matches.filter((m) => m.stage === 'prelim')
  for (const m of matches) {
    if (m.stage !== 'upper' || (m.round ?? 0) !== 0) continue
    const fedA = feeders.some((f) => f.nextMatchId === m.id && f.nextSlot === 'A')
    const fedB = feeders.some((f) => f.nextMatchId === m.id && f.nextSlot === 'B')
    if (!m.pairAId && !fedA) {
      throw new Error('Chave com vaga vazia (bye). Use preliminar.')
    }
    if (!m.pairBId && !fedB) {
      throw new Error('Chave com vaga vazia (bye). Use preliminar.')
    }
  }
}
