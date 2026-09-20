import type { BestOf, Match } from '../types/tournament'

export function setsToWin(bestOf: BestOf): number {
  return Math.ceil(bestOf / 2)
}

/** Placas de série válidos (ex. melhor de 3: 2×0, 2×1, 0×2, 1×2). */
export function validSeriesScores(bestOf: BestOf): Array<{ setsA: number; setsB: number }> {
  const need = setsToWin(bestOf)
  const scores: Array<{ setsA: number; setsB: number }> = []
  for (let lost = 0; lost < need; lost += 1) {
    scores.push({ setsA: need, setsB: lost })
  }
  for (let lost = 0; lost < need; lost += 1) {
    scores.push({ setsA: lost, setsB: need })
  }
  return scores
}

export function formatSeries(setsA: number, setsB: number): string {
  return `${setsA}×${setsB}`
}

export function applyMatchSets(
  match: Match,
  setsA: number,
  setsB: number,
  bestOf: BestOf,
): Match {
  const need = setsToWin(bestOf)
  const ok = validSeriesScores(bestOf).some((s) => s.setsA === setsA && s.setsB === setsB)
  if (!ok) {
    throw new Error(
      `Placar inválido. Use um resultado de melhor de ${bestOf} (primeiro a ${need}).`,
    )
  }
  if (!match.pairAId || !match.pairBId) {
    throw new Error('Confrontos incompletos.')
  }

  return {
    ...match,
    setsA,
    setsB,
    pointsA: 0,
    pointsB: 0,
    games: [],
    status: 'done',
    winnerPairId: setsA > setsB ? match.pairAId : match.pairBId,
  }
}

export function applyWalkover(match: Match, winnerPairId: string): Match {
  if (winnerPairId !== match.pairAId && winnerPairId !== match.pairBId) {
    throw new Error('Dupla vencedora inválida para W.O.')
  }
  const aWins = winnerPairId === match.pairAId
  const need = 1
  return {
    ...match,
    setsA: aWins ? need : 0,
    setsB: aWins ? 0 : need,
    pointsA: 0,
    pointsB: 0,
    games: [],
    status: 'wo',
    winnerPairId,
  }
}

export function clearMatchResult(match: Match): Match {
  return {
    ...match,
    setsA: 0,
    setsB: 0,
    pointsA: 0,
    pointsB: 0,
    games: [],
    status: 'pending',
    winnerPairId: null,
  }
}
