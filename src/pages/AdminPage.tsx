import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTournament } from '../hooks/useTournament'
import { verifyPassword } from '../domain/crypto'
import { isOrganizerSession, setOrganizerSession } from '../lib/session'
import { phaseLabel } from '../lib/labels'
import { createId } from '../domain/ids'
import { drawPairs } from '../domain/drawPairs'
import { formGroups, movePairBetweenGroups } from '../domain/formGroups'
import { generateRoundRobin } from '../domain/roundRobin'
import { computeStandings } from '../domain/standings'
import { qualifyFromGroups } from '../domain/qualify'
import { buildBracket, swapBracketPairs } from '../domain/buildBracket'
import { MatchEditor } from '../components/MatchEditor'
import { StandingsTable } from '../components/StandingsTable'
import { BracketView } from '../components/BracketView'
import {
  exportTournamentJson,
  importTournamentJson,
} from '../lib/storage'
import type { BestOf, Tournament } from '../types/tournament'

type Tab =
  | 'players'
  | 'pairs'
  | 'groups'
  | 'results'
  | 'knockout'
  | 'config'

export function AdminPage() {
  const { slug } = useParams()
  const { tournament, loading, error, update } = useTournament(slug)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authed, setAuthed] = useState(false)
  const [tab, setTab] = useState<Tab>('players')
  const [playerName, setPlayerName] = useState('')
  const [manualMode, setManualMode] = useState(false)

  useEffect(() => {
    if (tournament && isOrganizerSession(tournament.id)) {
      setAuthed(true)
    }
  }, [tournament])

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    if (!tournament) return
    const ok = await verifyPassword(password, tournament.salt, tournament.passwordHash)
    if (!ok) {
      setAuthError('Senha incorreta.')
      return
    }
    setOrganizerSession(tournament.id)
    setAuthed(true)
    setAuthError(null)
  }

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

  if (!authed) {
    return (
      <div className="app-shell">
        <div className="topbar">
          <Link to={`/t/${tournament.slug}`}>{tournament.name}</Link>
        </div>
        <form className="panel" onSubmit={handleLogin} style={{ maxWidth: 420 }}>
          <h2>Área do organizador</h2>
          <label>
            Senha
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {authError && <div className="alert">{authError}</div>}
          <button type="submit" style={{ marginTop: '0.75rem' }}>
            Entrar
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <div className="topbar">
        <div>
          <h1 className="brand" style={{ fontSize: '2.4rem' }}>
            {tournament.name}
          </h1>
          <p className="muted" style={{ margin: '0.25rem 0 0' }}>
            {phaseLabel(tournament.phase)} · melhor de {tournament.settings.bestOf} · meta{' '}
            {tournament.settings.pointsTarget}
          </p>
        </div>
        <nav>
          <Link className="btn secondary" to={`/t/${tournament.slug}`}>
            Ver público
          </Link>
          <Link className="btn secondary" to={`/t/${tournament.slug}/tv`}>
            Tela TV
          </Link>
          <Link className="btn secondary" to="/">
            Início
          </Link>
        </nav>
      </div>

      <div className="tabs">
        {(
          [
            ['players', 'Jogadores'],
            ['pairs', 'Sorteio'],
            ['groups', 'Grupos'],
            ['results', 'Resultados'],
            ['knockout', 'Mata-mata'],
            ['config', 'Config'],
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

      {tab === 'players' && (
        <PlayersTab
          tournament={tournament}
          playerName={playerName}
          setPlayerName={setPlayerName}
          onSave={update}
        />
      )}
      {tab === 'pairs' && <PairsTab tournament={tournament} onSave={update} />}
      {tab === 'groups' && <GroupsTab tournament={tournament} onSave={update} />}
      {tab === 'results' && <ResultsTab tournament={tournament} onSave={update} />}
      {tab === 'knockout' && (
        <KnockoutTab
          tournament={tournament}
          onSave={update}
          manualMode={manualMode}
          setManualMode={setManualMode}
        />
      )}
      {tab === 'config' && <ConfigTab tournament={tournament} onSave={update} />}
    </div>
  )
}

function PlayersTab({
  tournament,
  playerName,
  setPlayerName,
  onSave,
}: {
  tournament: Tournament
  playerName: string
  setPlayerName: (v: string) => void
  onSave: (t: Tournament) => Promise<void>
}) {
  async function addPlayer(e: FormEvent) {
    e.preventDefault()
    const name = playerName.trim()
    if (!name) return
    const players = [...tournament.players, { id: createId('pl'), name }]
    await onSave({ ...tournament, players, phase: 'setup' })
    setPlayerName('')
  }

  async function removePlayer(id: string) {
    await onSave({
      ...tournament,
      players: tournament.players.filter((p) => p.id !== id),
    })
  }

  return (
    <div className="panel fade-in">
      <h2>Jogadores ({tournament.players.length})</h2>
      <p className="muted">Quantidade par. Mínimo 4 para um torneio com grupos.</p>
      <form className="row" onSubmit={addPlayer}>
        <input
          style={{ flex: 1 }}
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="Nome do jogador"
        />
        <button type="submit">Adicionar</button>
      </form>
      <ul className="list" style={{ marginTop: '1rem' }}>
        {tournament.players.map((p) => (
          <li key={p.id}>
            <span>{p.name}</span>
            <button type="button" className="ghost" onClick={() => removePlayer(p.id)}>
              Remover
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function PairsTab({
  tournament,
  onSave,
}: {
  tournament: Tournament
  onSave: (t: Tournament) => Promise<void>
}) {
  const [error, setError] = useState<string | null>(null)
  const alreadyDrawn = tournament.pairs.length > 0

  async function handleDraw() {
    try {
      setError(null)
      if (alreadyDrawn) {
        setError('O sorteio já foi feito. Só é permitido uma vez.')
        return
      }
      const pairs = drawPairs(tournament.players)
      await onSave({
        ...tournament,
        pairs,
        groups: [],
        matches: [],
        bracketRounds: [],
        phase: 'pairs',
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro no sorteio')
    }
  }

  return (
    <div className="panel fade-in">
      <h2>Sorteio de duplas</h2>
      <div className="row">
        <button type="button" onClick={handleDraw} disabled={alreadyDrawn}>
          {alreadyDrawn ? 'Sorteio concluído' : 'Sortear duplas'}
        </button>
      </div>
      {alreadyDrawn && (
        <p className="muted">Duplas sorteadas uma vez — sem alterações manuais.</p>
      )}
      {error && <div className="alert">{error}</div>}
      <ul className="list" style={{ marginTop: '1rem' }}>
        {tournament.pairs.map((pair, idx) => (
          <li key={pair.id}>
            <span>
              <strong>Dupla {idx + 1}:</strong> {pair.label}
            </span>
          </li>
        ))}
      </ul>
      {tournament.pairs.length === 0 && (
        <p className="empty">Cadastre jogadores e sorteie as duplas.</p>
      )}
    </div>
  )
}

function GroupsTab({
  tournament,
  onSave,
}: {
  tournament: Tournament
  onSave: (t: Tournament) => Promise<void>
}) {
  const [error, setError] = useState<string | null>(null)

  async function handleFormGroups() {
    try {
      setError(null)
      if (tournament.pairs.length < 2) throw new Error('Sorteie as duplas antes.')
      const groups = formGroups(tournament.pairs)
      await onSave({
        ...tournament,
        groups,
        matches: [],
        bracketRounds: [],
        phase: 'groups',
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    }
  }

  async function handleGenerateMatches() {
    const matches = generateRoundRobin(tournament.groups)
    await onSave({
      ...tournament,
      matches: [...matches, ...tournament.matches.filter((m) => m.stage !== 'group')],
      phase: 'groups',
    })
  }

  async function movePair(pairId: string, toGroupId: string) {
    const groups = movePairBetweenGroups(tournament.groups, pairId, toGroupId)
    await onSave({
      ...tournament,
      groups,
      matches: tournament.matches.filter((m) => m.stage !== 'group'),
    })
  }

  return (
    <div className="panel fade-in">
      <h2>Grupos</h2>
      <div className="row">
        <button type="button" onClick={handleFormGroups}>
          Sortear grupos
        </button>
        <button
          type="button"
          className="secondary"
          disabled={!tournament.groups.length}
          onClick={handleGenerateMatches}
        >
          Gerar confrontos (todos vs todos)
        </button>
      </div>
      {error && <div className="alert">{error}</div>}
      <div className="grid-2" style={{ marginTop: '1rem' }}>
        {tournament.groups.map((g) => (
          <div key={g.id} className="match-card">
            <h3 style={{ margin: 0 }}>{g.name}</h3>
            <ul className="list">
              {g.pairIds.map((pid) => {
                const pair = tournament.pairs.find((p) => p.id === pid)
                return (
                  <li key={pid}>
                    <span>{pair?.label ?? pid}</span>
                    <select
                      defaultValue={g.id}
                      onChange={(e) => {
                        if (e.target.value !== g.id) void movePair(pid, e.target.value)
                      }}
                    >
                      {tournament.groups.map((og) => (
                        <option key={og.id} value={og.id}>
                          {og.name}
                        </option>
                      ))}
                    </select>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

function ResultsTab({
  tournament,
  onSave,
}: {
  tournament: Tournament
  onSave: (t: Tournament) => Promise<void>
}) {
  const groupMatches = tournament.matches.filter((m) => m.stage === 'group')

  return (
    <div className="stack fade-in">
      {tournament.groups.map((group) => {
        const matches = groupMatches.filter((m) => m.groupId === group.id)
        const standings = computeStandings(group.pairIds, matches)
        return (
          <div className="panel" key={group.id}>
            <h2>{group.name}</h2>
            <StandingsTable tournament={tournament} rows={standings} />
            <h3>Confrontos</h3>
            <div className="stack">
              {matches.map((m) => (
                <MatchEditor
                  key={m.id}
                  tournament={tournament}
                  match={m}
                  canEdit
                  onSave={onSave}
                />
              ))}
            </div>
          </div>
        )
      })}
      {!tournament.groups.length && (
        <div className="panel">
          <p className="empty">Gere os grupos e confrontos primeiro.</p>
        </div>
      )}
    </div>
  )
}

function KnockoutTab({
  tournament,
  onSave,
  manualMode,
  setManualMode,
}: {
  tournament: Tournament
  onSave: (t: Tournament) => Promise<void>
  manualMode: boolean
  setManualMode: (v: boolean) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const koMatches = tournament.matches.filter(
    (m) => m.stage === 'knockout' || m.stage === 'third',
  )

  async function generate() {
    try {
      setError(null)
      const qualified = qualifyFromGroups(tournament.groups, tournament.matches)
      const built = buildBracket(qualified, tournament.settings.thirdPlaceEnabled)
      const groupMatches = tournament.matches.filter((m) => m.stage === 'group')
      await onSave({
        ...tournament,
        matches: [...groupMatches, ...built.matches],
        bracketRounds: built.rounds,
        thirdPlaceMatchId: built.thirdPlaceMatch?.id ?? null,
        phase: 'knockout',
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar chave')
    }
  }

  async function manualSwap(matchId: string, side: 'A' | 'B', pairId: string) {
    const ko = swapBracketPairs(koMatches, matchId, side, pairId || null)
    await onSave({
      ...tournament,
      matches: [...tournament.matches.filter((m) => m.stage === 'group'), ...ko],
    })
  }

  return (
    <div className="stack fade-in">
      <div className="panel">
        <h2>Mata-mata</h2>
        <div className="row">
          <button type="button" onClick={generate}>
            Gerar chaveamento
          </button>
          <button
            type="button"
            className={manualMode ? '' : 'secondary'}
            onClick={() => setManualMode(!manualMode)}
          >
            {manualMode ? 'Modo manual ativo' : 'Ativar modo manual'}
          </button>
        </div>
        <p className="muted">
          Padrão: 1º de um grupo × 2º de outro. Completa com melhores 2ºs. Byes para os
          melhores.
        </p>
        {error && <div className="alert">{error}</div>}
        <BracketView tournament={tournament} />
      </div>

      {manualMode && (
        <div className="panel">
          <h3>Ajuste manual (1ª rodada)</h3>
          {koMatches
            .filter((m) => m.stage === 'knockout' && m.round === 0)
            .map((m) => (
              <div className="row" key={m.id} style={{ marginBottom: '0.5rem' }}>
                <select
                  value={m.pairAId ?? ''}
                  onChange={(e) => void manualSwap(m.id, 'A', e.target.value)}
                >
                  <option value="">—</option>
                  {tournament.pairs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <span>vs</span>
                <select
                  value={m.pairBId ?? ''}
                  onChange={(e) => void manualSwap(m.id, 'B', e.target.value)}
                >
                  <option value="">—</option>
                  {tournament.pairs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
        </div>
      )}

      <div className="panel">
        <h3>Placares do mata-mata</h3>
        <div className="stack">
          {koMatches.map((m) => (
            <MatchEditor
              key={m.id}
              tournament={tournament}
              match={m}
              canEdit
              onSave={onSave}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function ConfigTab({
  tournament,
  onSave,
}: {
  tournament: Tournament
  onSave: (t: Tournament) => Promise<void>
}) {
  const [msg, setMsg] = useState<string | null>(null)

  function download() {
    const blob = new Blob([exportTournamentJson(tournament)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${tournament.slug}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function onImport(file: File) {
    const text = await file.text()
    const data = await importTournamentJson(text)
    setMsg(`Importado: ${data.name}`)
  }

  return (
    <div className="panel fade-in">
      <h2>Configurações</h2>
      <div className="stack">
        <label>
          Formato (melhor de)
          <select
            value={tournament.settings.bestOf}
            onChange={(e) =>
              void onSave({
                ...tournament,
                settings: {
                  ...tournament.settings,
                  bestOf: Number(e.target.value) as BestOf,
                },
              })
            }
          >
            <option value={1}>1</option>
            <option value={3}>3</option>
            <option value={5}>5</option>
          </select>
        </label>
        <label>
          Meta de pontos do round
          <input
            type="number"
            value={tournament.settings.pointsTarget}
            onChange={(e) =>
              void onSave({
                ...tournament,
                settings: {
                  ...tournament.settings,
                  pointsTarget: Number(e.target.value) || 12,
                },
              })
            }
          />
        </label>
        <label style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="checkbox"
            checked={tournament.settings.thirdPlaceEnabled}
            onChange={(e) =>
              void onSave({
                ...tournament,
                settings: {
                  ...tournament.settings,
                  thirdPlaceEnabled: e.target.checked,
                },
              })
            }
          />
          Disputa de 3º lugar
        </label>
        <div className="row">
          <button type="button" onClick={download}>
            Exportar JSON
          </button>
          <label className="btn secondary" style={{ cursor: 'pointer' }}>
            Importar JSON
            <input
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onImport(f)
              }}
            />
          </label>
        </div>
        <p className="muted">
          Link público:{' '}
          <code>
            {typeof window !== 'undefined'
              ? `${window.location.origin}/t/${tournament.slug}`
              : `/t/${tournament.slug}`}
          </code>
        </p>
        {msg && <div className="alert info">{msg}</div>}
      </div>
    </div>
  )
}
