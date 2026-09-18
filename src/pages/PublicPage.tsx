import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTournament } from '../hooks/useTournament'
import { phaseLabel, getPairName } from '../lib/labels'
import { computeStandings } from '../domain/standings'
import { StandingsTable } from '../components/StandingsTable'
import { LivesBoard } from '../components/LivesBoard'
import { MatchEditor } from '../components/MatchEditor'

type Tab = 'pairs' | 'groups' | 'results' | 'knockout'

export function PublicPage() {
  const { slug } = useParams()
  const { tournament, loading, error } = useTournament(slug)
  const [tab, setTab] = useState<Tab>('results')

  if (loading) {
    return (
      <div className="app-shell">
        <p>Carregando…</p>
      </div>
    )
  }

  if (error || !tournament) {
    return (
      <div className="app-shell">
        <div className="alert">{error ?? 'Torneio não encontrado'}</div>
        <Link to="/">Voltar</Link>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <div className="topbar">
        <div>
          <h1 className="brand" style={{ fontSize: '2.6rem' }}>
            {tournament.name}
          </h1>
          <p className="muted" style={{ margin: '0.25rem 0 0' }}>
            Acompanhe ao vivo · {phaseLabel(tournament.phase)}
          </p>
        </div>
        <nav>
          <Link className="btn secondary" to={`/t/${tournament.slug}/tv`}>
            Tela TV
          </Link>
          <Link className="btn secondary" to={`/t/${tournament.slug}/admin`}>
            Organizador
          </Link>
        </nav>
      </div>

      <div className="tabs">
        {(
          [
            ['pairs', 'Duplas'],
            ['groups', 'Grupos'],
            ['results', 'Resultados'],
            ['knockout', '2 vidas'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'active' : ''}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'pairs' && (
        <div className="panel fade-in">
          <h2>Duplas</h2>
          <ul className="list">
            {tournament.pairs.map((p, i) => (
              <li key={p.id}>
                <span>
                  Dupla {i + 1}: {p.label}
                </span>
              </li>
            ))}
          </ul>
          {!tournament.pairs.length && <p className="empty">Aguardando sorteio.</p>}
        </div>
      )}

      {tab === 'groups' && (
        <div className="grid-2 fade-in">
          {tournament.groups.map((g) => (
            <div className="panel" key={g.id}>
              <h2>{g.name}</h2>
              <ul className="list">
                {g.pairIds.map((id) => (
                  <li key={id}>
                    <span>{getPairName(tournament, id)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {!tournament.groups.length && (
            <div className="panel">
              <p className="empty">Grupos ainda não formados.</p>
            </div>
          )}
        </div>
      )}

      {tab === 'results' && (
        <div className="stack fade-in">
          {tournament.groups.map((group) => {
            const matches = tournament.matches.filter(
              (m) => m.stage === 'group' && m.groupId === group.id,
            )
            const standings = computeStandings(group.pairIds, matches)
            return (
              <div className="panel" key={group.id}>
                <h2>{group.name}</h2>
                <StandingsTable tournament={tournament} rows={standings} />
                <h3>Partidas</h3>
                <div className="stack">
                  {matches.map((m) => (
                    <MatchEditor
                      key={m.id}
                      tournament={tournament}
                      match={m}
                      canEdit={false}
                      onSave={async () => undefined}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'knockout' && (
        <div className="stack fade-in">
          <div className="panel">
            <h2>2 vidas</h2>
            <LivesBoard tournament={tournament} />
          </div>
          <div className="panel">
            <h3>Confrontos</h3>
            <div className="stack">
              {tournament.matches
                .filter((m) => m.stage === 'knockout')
                .map((m) => (
                  <MatchEditor
                    key={m.id}
                    tournament={tournament}
                    match={m}
                    canEdit={false}
                    onSave={async () => undefined}
                  />
                ))}
              {!tournament.matches.some((m) => m.stage === 'knockout') && (
                <p className="empty">Aguardando a fase de 2 vidas.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
