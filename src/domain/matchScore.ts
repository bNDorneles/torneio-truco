import type { BestOf, GameScore, Match } from '../types/tournament'

export function setsToWin(bestOf: BestOf): number {
  return Math.ceil(bestOf / 2)
}

export function applyMatchFromGames(
  match: Match,
  gamesInput: GameScore[],
  bestOf: BestOf,
  pointsTarget?: number,
): Match {
  const need = setsToWin(bestOf)
  const games = gamesInput.filter(
    (g) =>
      Number.isFinite(g.pointsA) &&
      Number.isFinite(g.pointsB) &&
      (g.pointsA > 0 || g.pointsB > 0),
  )

  if (games.length === 0) {
    throw new Error('Selecione o placar de pelo menos uma partida (diferente de 0×0).')
  }
  if (games.length > bestOf) {
    throw new Error(`No máximo ${bestOf} partida(s) (melhor de ${bestOf}).`)
  }

  let setsA = 0
  let setsB = 0
  let pointsA = 0
  let pointsB = 0
  const target = pointsTarget ?? 0

  for (let i = 0; i < games.length; i += 1) {
    const g = games[i]
    if (g.pointsA === g.pointsB) {
      throw new Error(`Partida ${i + 1}: não pode empatar.`)
    }
    if (g.pointsA < 0 || g.pointsB < 0) {
      throw new Error('Pontos inválidos.')
    }
    if (target > 0 && Math.max(g.pointsA, g.pointsB) < target) {
      throw new Error(
        `Partida ${i + 1}: alguém precisa chegar a ${target} para terminar.`,
      )
    }
    if (setsA === need || setsB === need) {
      throw new Error('Há partidas a mais — a série já tinha acabado.')
    }
    pointsA += g.pointsA
    pointsB += g.pointsB
    if (g.pointsA > g.pointsB) setsA += 1
    else setsB += 1
  }

  if (setsA === setsB) {
    throw new Error('A série não pode empatar — complete as partidas.')
  }
  if (setsA !== need && setsB !== need) {
    throw new Error(`Alguém precisa vencer ${need} partida(s) (melhor de ${bestOf}).`)
  }

  const winnerPairId = setsA > setsB ? match.pairAId : match.pairBId

  return {
    ...match,
    games,
    setsA,
    setsB,
    pointsA,
    pointsB,
    status: 'done',
    winnerPairId,
  }
}

export function applyWalkover(match: Match, winnerPairId: string): Match {
  if (winnerPairId !== match.pairAId && winnerPairId !== match.pairBId) {
    throw new Error('Dupla vencedora inválida para W.O.')
  }
  const aWins = winnerPairId === match.pairAId
  return {
    ...match,
    setsA: aWins ? 1 : 0,
    setsB: aWins ? 0 : 1,
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
