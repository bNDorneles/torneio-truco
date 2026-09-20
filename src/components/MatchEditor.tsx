import { useState } from 'react'
import type { Match, Tournament } from '../types/tournament'
import { isKnockoutStage } from '../types/tournament'
import {
  applyMatchSets,
  applyWalkover,
  clearMatchResult,
  formatSeries,
  setsToWin,
  validSeriesScores,
} from '../domain/matchScore'
import {
  applyAfterKnockoutMatch,
  clearKnockoutMatch,
} from '../domain/bracketAdvance'
import { getPairName } from '../lib/labels'

interface Props {
  tournament: Tournament
  match: Match
  canEdit: boolean
  onSave: (next: Tournament) => Promise<void>
  compact?: boolean
}

export function MatchEditor({
  tournament,
  match,
  canEdit,
  onSave,
  compact = false,
}: Props) {
  const bestOf = tournament.settings.bestOf
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const nameA = getPairName(tournament, match.pairAId)
  const nameB = getPairName(tournament, match.pairBId)
  const need = setsToWin(bestOf)
  const scores = validSeriesScores(bestOf)

  async function persist(updatedMatch: Match, clearing = false) {
    setBusy(true)
    setError(null)
    try {
      const matches = tournament.matches.map((m) =>
        m.id === updatedMatch.id ? updatedMatch : m,
      )
      let next: Tournament = { ...tournament, matches }

      if (isKnockoutStage(updatedMatch.stage)) {
        next = clearing
          ? clearKnockoutMatch({ ...tournament, matches }, updatedMatch.id)
          : applyAfterKnockoutMatch({ ...tournament, matches }, updatedMatch.id)
      }

      await onSave(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setBusy(false)
    }
  }

  async function handleScore(setsA: number, setsB: number) {
    try {
      const updated = applyMatchSets(match, setsA, setsB, bestOf)
      await persist(updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    }
  }

  async function handleWo(winnerId: string) {
    await persist(applyWalkover(match, winnerId))
  }

  async function handleClear() {
    await persist(clearMatchResult(match), true)
  }

  const scoreButtons = (
    <div className="score-picks">
      {scores.map((s) => {
        const label = formatSeries(s.setsA, s.setsB)
        const active =
          match.status !== 'pending' &&
          match.setsA === s.setsA &&
          match.setsB === s.setsB
        return (
          <button
            key={label}
            type="button"
            className={active ? 'score-pick active' : 'score-pick'}
            disabled={busy || !canEdit}
            onClick={() => handleScore(s.setsA, s.setsB)}
          >
            {label}
          </button>
        )
      })}
    </div>
  )

  if (compact) {
    return (
      <div className="lb-edit">
        {canEdit && match.pairAId && match.pairBId ? scoreButtons : null}
        {!canEdit && match.status !== 'pending' && (
          <span>{formatSeries(match.setsA, match.setsB)}</span>
        )}
        {canEdit && match.status !== 'pending' && (
          <button type="button" className="ghost" disabled={busy} onClick={handleClear}>
            limpar
          </button>
        )}
        {error && <div className="lb-error">{error}</div>}
      </div>
    )
  }

  return (
    <div className={`match-card ${match.status !== 'pending' ? 'done' : ''} fade-in`}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong>
          {nameA} <span className="muted">vs</span> {nameB}
        </strong>
        <span className={`badge ${match.status === 'pending' ? '' : 'ok'}`}>
          {match.status === 'wo'
            ? 'W.O.'
            : match.status === 'done'
              ? formatSeries(match.setsA, match.setsB)
              : 'Pendente'}
        </span>
      </div>

      {canEdit && match.pairAId && match.pairBId && (
        <>
          <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
            Melhor de {bestOf} (primeiro a {need}). Escolha o placar da série:
          </p>
          {scoreButtons}
          <div className="row">
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => handleWo(match.pairAId!)}
            >
              W.O. {nameA.split(' / ')[0]}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => handleWo(match.pairBId!)}
            >
              W.O. {nameB.split(' / ')[0]}
            </button>
            {match.status !== 'pending' && (
              <button type="button" className="ghost" disabled={busy} onClick={handleClear}>
                Limpar
              </button>
            )}
          </div>
        </>
      )}

      {!canEdit && (
        <p className="muted" style={{ margin: 0 }}>
          {match.status === 'pending'
            ? 'Aguardando placar'
            : `${formatSeries(match.setsA, match.setsB)}${
                match.winnerPairId
                  ? ` · Venceu: ${getPairName(tournament, match.winnerPairId)}`
                  : ''
              }`}
        </p>
      )}

      {error && <div className="alert">{error}</div>}
    </div>
  )
}
