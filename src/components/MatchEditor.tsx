import { useEffect, useMemo, useState } from 'react'
import type { GameScore, Match, Tournament } from '../types/tournament'
import {
  applyMatchFromGames,
  applyWalkover,
  clearMatchResult,
  setsToWin,
} from '../domain/matchScore'
import { advanceBracketWinners } from '../domain/buildBracket'
import { getPairName } from '../lib/labels'

interface Props {
  tournament: Tournament
  match: Match
  canEdit: boolean
  onSave: (next: Tournament) => Promise<void>
}

type ScoreRow = { a: number; b: number }

function gamesToForm(games: GameScore[] | undefined, bestOf: number): ScoreRow[] {
  return Array.from({ length: bestOf }, (_, i) => {
    const g = games?.[i]
    if (!g) return { a: 0, b: 0 }
    return { a: g.pointsA, b: g.pointsB }
  })
}

function scoreOptions(max: number): number[] {
  return Array.from({ length: max + 1 }, (_, i) => i)
}

export function MatchEditor({ tournament, match, canEdit, onSave }: Props) {
  const bestOf = tournament.settings.bestOf
  const pointsTarget = tournament.settings.pointsTarget
  const [rows, setRows] = useState<ScoreRow[]>(() => gamesToForm(match.games, bestOf))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setRows(gamesToForm(match.games, bestOf))
  }, [match.id, match.status, match.games, bestOf])

  const nameA = getPairName(tournament, match.pairAId)
  const nameB = getPairName(tournament, match.pairBId)
  const need = setsToWin(bestOf)
  const options = useMemo(() => scoreOptions(pointsTarget), [pointsTarget])

  async function persist(updatedMatch: Match) {
    setBusy(true)
    setError(null)
    try {
      let matches = tournament.matches.map((m) =>
        m.id === updatedMatch.id ? updatedMatch : m,
      )

      if (updatedMatch.stage === 'knockout' || updatedMatch.stage === 'third') {
        const advanced = advanceBracketWinners(
          matches.filter((m) => m.stage === 'knockout' || m.stage === 'third'),
          tournament.bracketRounds,
          tournament.thirdPlaceMatchId,
        )
        matches = [...matches.filter((m) => m.stage === 'group'), ...advanced]
      }

      const next: Tournament = { ...tournament, matches }
      const finalRound = next.bracketRounds.length - 1
      const finals = next.matches.filter(
        (m) => m.stage === 'knockout' && m.round === finalRound,
      )
      if (finals.length === 1 && finals[0].status !== 'pending') {
        next.phase = 'finished'
      }

      await onSave(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setBusy(false)
    }
  }

  function updateRow(index: number, side: 'a' | 'b', value: number) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [side]: value } : row)),
    )
  }

  async function handleSave() {
    try {
      if (!match.pairAId || !match.pairBId) {
        setError('Confrontos incompletos.')
        return
      }

      const games: GameScore[] = []
      for (const row of rows) {
        if (row.a === 0 && row.b === 0) break
        games.push({ pointsA: row.a, pointsB: row.b })
      }

      const updated = applyMatchFromGames(match, games, bestOf, pointsTarget)
      await persist(updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    }
  }

  async function handleWo(winnerId: string) {
    await persist(applyWalkover(match, winnerId))
  }

  async function handleClear() {
    await persist(clearMatchResult(match))
    setRows(gamesToForm([], bestOf))
  }

  return (
    <div className={`match-card ${match.status !== 'pending' ? 'done' : ''} fade-in`}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong>
          {nameA} <span className="muted">vs</span> {nameB}
        </strong>
        <span className={`badge ${match.status === 'pending' ? '' : 'ok'}`}>
          {match.isBye
            ? 'BYE'
            : match.status === 'wo'
              ? 'W.O.'
              : match.status === 'done'
                ? `${match.setsA}×${match.setsB}`
                : 'Pendente'}
        </span>
      </div>

      {canEdit && !match.isBye && match.pairAId && match.pairBId && (
        <>
          <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
            Melhor de {bestOf} (primeiro a {need}). Começa em 0 — selecione o placar
            final de cada partida (até {pointsTarget}).
          </p>
          <div className="stack">
            {rows.map((row, index) => (
              <div key={index} className="partida-row">
                <div className="partida-label">Partida {index + 1}</div>
                <div className="score-inputs">
                  <label>
                    {nameA}
                    <select
                      value={row.a}
                      onChange={(e) => updateRow(index, 'a', Number(e.target.value))}
                    >
                      {options.map((n) => (
                        <option key={`a-${n}`} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span style={{ textAlign: 'center', paddingBottom: '0.5rem' }}>×</span>
                  <label>
                    {nameB}
                    <select
                      value={row.b}
                      onChange={(e) => updateRow(index, 'b', Number(e.target.value))}
                    >
                      {options.map((n) => (
                        <option key={`b-${n}`} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            ))}
          </div>
          <div className="row">
            <button type="button" disabled={busy} onClick={handleSave}>
              Salvar placar
            </button>
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
        <div className="stack" style={{ gap: '0.35rem' }}>
          {(match.games ?? []).map((g, i) => (
            <p key={i} style={{ margin: 0 }}>
              Partida {i + 1}: {nameA}{' '}
              <strong>
                {g.pointsA}×{g.pointsB}
              </strong>{' '}
              {nameB}
            </p>
          ))}
          {match.status !== 'pending' && (
            <p className="muted" style={{ margin: 0 }}>
              Série {match.setsA}×{match.setsB}
              {match.winnerPairId &&
                ` · Venceu: ${getPairName(tournament, match.winnerPairId)}`}
            </p>
          )}
          {match.status === 'pending' && !(match.games?.length) && (
            <p className="muted" style={{ margin: 0 }}>
              Aguardando placar
            </p>
          )}
        </div>
      )}

      {canEdit && match.status === 'done' && (match.games?.length ?? 0) > 0 && (
        <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
          Série {match.setsA}×{match.setsB} · total pontos {match.pointsA}×{match.pointsB}
        </p>
      )}

      {error && <div className="alert">{error}</div>}
    </div>
  )
}
