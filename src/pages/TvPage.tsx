import { Link, useParams } from 'react-router-dom'
import { useTournament } from '../hooks/useTournament'
import { getPairName, phaseLabel } from '../lib/labels'
import { LivesBoard } from '../components/LivesBoard'
import { computeStandings } from '../domain/standings'

export function TvPage() {
  const { slug } = useParams()
  const { tournament, loading, error } = useTournament(slug)

  if (loading) {
    return (
      <div className="app-shell tv-page">
        <p>Carregando…</p>
      </div>
    )
  }

  if (error || !tournament) {
    return (
      <div className="app-shell tv-page">
        <div className="alert">{error ?? 'Torneio não encontrado'}</div>
      </div>
    )
  }

  const liveMatches = tournament.matches
    .filter((m) => m.status !== 'pending' || (m.pairAId && m.pairBId))
    .slice()
    .sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return 1
      if (b.status === 'pending' && a.status !== 'pending') return -1
      return 0
    })
    .slice(0, 8)

  return (
    <div className="app-shell tv-page">
      <div className="topbar">
        <div>
          <h1 className="brand">{tournament.name}</h1>
          <p className="subbrand">{phaseLabel(tournament.phase)} · placar ao vivo</p>
        </div>
        <Link className="btn secondary" to={`/t/${tournament.slug}`}>
          Voltar
        </Link>
      </div>

      <div className="tv-grid">
        <div className="panel">
          <h2>Últimos / próximos</h2>
          <div className="stack">
            {liveMatches.map((m) => (
              <div className="match-card" key={m.id}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>
                    {getPairName(tournament, m.pairAId)} vs{' '}
                    {getPairName(tournament, m.pairBId)}
                  </strong>
                  <span className="tv-score">
                    {m.status === 'pending' ? '—' : `${m.setsA}×${m.setsB}`}
                  </span>
                </div>
                {m.status !== 'pending' && m.status !== 'wo' && (m.games?.length ?? 0) > 0 && (
                  <div className="muted">
                    {(m.games ?? []).map((g, i) => (
                      <div key={i}>
                        Partida {i + 1}: {g.pointsA}×{g.pointsB}
                      </div>
                    ))}
                  </div>
                )}
                {m.status !== 'pending' && m.status !== 'wo' && !(m.games?.length) && (
                  <span className="muted">
                    Pontos {m.pointsA}×{m.pointsB}
                  </span>
                )}
              </div>
            ))}
            {!liveMatches.length && <p className="empty">Aguardando partidas.</p>}
          </div>
        </div>

        <div className="panel">
          <h2>
            {tournament.phase === 'knockout' || tournament.phase === 'finished'
              ? '2 vidas'
              : 'Tabelas'}
          </h2>
          {tournament.phase === 'knockout' || tournament.phase === 'finished' ? (
            <LivesBoard tournament={tournament} />
          ) : (
            <div className="stack">
              {tournament.groups.map((g) => {
                const rows = computeStandings(
                  g.pairIds,
                  tournament.matches.filter(
                    (m) => m.stage === 'group' && m.groupId === g.id,
                  ),
                )
                return (
                  <div key={g.id}>
                    <h3>{g.name}</h3>
                    <ol>
                      {rows.map((r) => (
                        <li key={r.pairId}>
                          {getPairName(tournament, r.pairId)} — {r.wins}V
                        </li>
                      ))}
                    </ol>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
