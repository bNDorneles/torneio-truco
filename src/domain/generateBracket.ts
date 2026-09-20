import type { Tournament } from '../types/tournament'
import {
  getAdvancePerGroup,
  getTournamentFormat,
  isKnockoutStage,
} from '../types/tournament'
import { buildDoubleElimination } from './doubleElim'
import {
  crossGroupMatchups,
  describeCrossPlan,
  qualifyFromGroups,
} from './qualify'
import {
  buildSingleElimination,
  buildSingleEliminationFromMatchups,
  planSingleElimStructure,
} from './singleElim'

export function groupsComplete(tournament: Tournament): boolean {
  const groupMatches = tournament.matches.filter((m) => m.stage === 'group')
  if (groupMatches.length === 0) return false
  return groupMatches.every((m) => m.status === 'done' || m.status === 'wo')
}

export function describeKnockoutPlan(tournament: Tournament): string {
  const format = getTournamentFormat(tournament)
  if (format === 'double_elim') {
    const n = tournament.pairs.length
    const plan = planSingleElimStructure(n)
    if (plan.prelimMatches === 0) {
      return `${n} dupla(s) · 2 vidas (chave alta + baixa), sem bye`
    }
    return `${n} dupla(s) · ${plan.prelimMatches} prelim + 2 vidas (chave de ${plan.mainSize})`
  }
  const advance = getAdvancePerGroup(tournament)
  try {
    const cross = describeCrossPlan(
      tournament.groups,
      tournament.matches,
      advance,
    )
    if (cross) {
      return `Sobe ${advance}/grupo · Cruzamento Copa: ${cross}`
    }
    const qualified = qualifyFromGroups(
      tournament.groups,
      tournament.matches,
      advance,
    )
    const plan = planSingleElimStructure(qualified.length)
    if (plan.prelimMatches === 0) {
      return `Sobe ${advance}/grupo · ${qualified.length} na chave (melhor × pior)`
    }
    return `Sobe ${advance}/grupo · ${qualified.length} classificadas · ${plan.prelimMatches} prelim + chave de ${plan.mainSize}`
  } catch {
    return `Sobe ${advance} por grupo · complete os jogos para gerar a chave`
  }
}

function stripKnockout(tournament: Tournament): Tournament {
  return {
    ...tournament,
    matches: tournament.matches.filter((m) => !isKnockoutStage(m.stage)),
    bracketRounds: [],
    thirdPlaceMatchId: null,
  }
}

/** Gera (ou regenera) a chave conforme o formato do torneio. */
export function generateBracket(tournament: Tournament): Tournament {
  const format = getTournamentFormat(tournament)
  const base = stripKnockout(tournament)

  if (format === 'double_elim') {
    if (tournament.pairs.length < 2) {
      throw new Error('Sorteie as duplas antes de gerar a chave.')
    }
    const { matches } = buildDoubleElimination(tournament.pairs.map((p) => p.id))
    return {
      ...base,
      matches: [...base.matches, ...matches],
      phase: 'knockout',
      thirdPlaceMatchId: null,
    }
  }

  if (!tournament.groups.length) {
    throw new Error('Forme os grupos antes de gerar a chave.')
  }
  if (!groupsComplete(tournament)) {
    throw new Error('Finalize todos os jogos dos grupos antes de gerar a chave.')
  }

  const advance = getAdvancePerGroup(tournament)
  const third = tournament.settings.thirdPlaceEnabled
  const cross = crossGroupMatchups(tournament.groups, tournament.matches, advance)

  const built = cross
    ? buildSingleEliminationFromMatchups(cross, third)
    : buildSingleElimination(
        qualifyFromGroups(tournament.groups, tournament.matches, advance).map(
          (q) => q.pairId,
        ),
        third,
      )

  return {
    ...base,
    matches: [...base.matches, ...built.matches],
    phase: 'knockout',
    thirdPlaceMatchId: built.thirdPlaceMatchId,
  }
}

export function hasKnockoutScores(tournament: Tournament): boolean {
  return tournament.matches.some(
    (m) => isKnockoutStage(m.stage) && m.status !== 'pending',
  )
}

export function hasGroupScores(tournament: Tournament): boolean {
  return tournament.matches.some((m) => m.stage === 'group' && m.status !== 'pending')
}
