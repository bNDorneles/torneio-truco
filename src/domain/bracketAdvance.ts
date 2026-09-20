import type { Tournament } from '../types/tournament'
import { isKnockoutStage } from '../types/tournament'
import { advanceFromMatch, matchWinner } from './doubleElim'
import { clearMatchResult } from './matchScore'

/** Push winner/loser from a completed knockout match into the next slots. */
export function applyAfterKnockoutMatch(
  tournament: Tournament,
  matchId: string,
): Tournament {
  const matches = tournament.matches.map((m) => ({ ...m }))
  const match = matches.find((m) => m.id === matchId)
  if (match && match.status !== 'pending') {
    advanceFromMatch(matches, match)
  }

  const final = matches.find((m) => m.stage === 'final')
  const finished = Boolean(final && final.status !== 'pending' && matchWinner(final))
  const hasKo = matches.some((m) => isKnockoutStage(m.stage))

  return {
    ...tournament,
    matches,
    phase: finished ? 'finished' : hasKo ? 'knockout' : tournament.phase,
  }
}

export function clearKnockoutMatch(
  tournament: Tournament,
  matchId: string,
): Tournament {
  const matches = tournament.matches.map((m) =>
    m.id === matchId ? clearMatchResult(m) : { ...m },
  )
  const cleared = matches.find((m) => m.id === matchId)
  if (!cleared) return tournament

  const clearSide = (nextId: string | null | undefined, slot: 'A' | 'B' | null | undefined) => {
    if (!nextId || !slot) return
    const next = matches.find((m) => m.id === nextId)
    if (!next || next.status !== 'pending') return
    if (slot === 'A') next.pairAId = null
    else next.pairBId = null
    Object.assign(next, clearMatchResult(next))
  }

  clearSide(cleared.nextMatchId, cleared.nextSlot)
  clearSide(cleared.loserNextMatchId, cleared.loserNextSlot)

  return {
    ...tournament,
    matches,
    phase: 'knockout',
  }
}
