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
import { startLivesPhase } from '../domain/lives'
import { MatchEditor } from '../components/MatchEditor'
import { StandingsTable } from '../components/StandingsTable'
import { LivesBoard } from '../components/LivesBoard'
import {
  exportTournamentJson,
  importTournamentJson,
} from '../lib/storage'
import type { Pair, Tournament } from '../types/tournament'

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
            ['knockout', '2 vidas'],
            ['config', 'Backup'],
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
          onGoToDraw={() => setTab('pairs')}
        />
      )}
      {tab === 'pairs' && <PairsTab tournament={tournament} onSave={update} />}
      {tab === 'groups' && <GroupsTab tournament={tournament} onSave={update} />}
      {tab === 'results' && <ResultsTab tournament={tournament} onSave={update} />}
      {tab === 'knockout' && <KnockoutTab tournament={tournament} onSave={update} />}
      {tab === 'config' && <ConfigTab tournament={tournament} />}
    </div>
  )
}

function PlayersTab({
  tournament,
  playerName,
  setPlayerName,
  onSave,
  onGoToDraw,
}: {
  tournament: Tournament
  playerName: string
  setPlayerName: (v: string) => void
  onSave: (t: Tournament) => Promise<void>
  onGoToDraw: () => void
}) {
  const even = tournament.players.length >= 2 && tournament.players.length % 2 === 0
  const alreadyDrawn = tournament.pairs.length > 0

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
      <p className="muted">
        Cadastre cada pessoa pelo nome. As <strong>duplas não se cadastram</strong> — o sorteio
        forma elas. Precisa de quantidade par (mínimo 4 para grupos).
      </p>
      <form className="row" onSubmit={addPlayer}>
        <input
          style={{ flex: 1 }}
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="Nome do jogador"
        />
        <button type="submit">Adicionar jogador</button>
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
      <div className="row" style={{ marginTop: '1rem' }}>
        <button type="button" onClick={onGoToDraw} disabled={!even || alreadyDrawn}>
          {alreadyDrawn
            ? 'Duplas já sorteadas'
            : even
              ? 'Ir para o sorteio das duplas'
              : `Falta ${tournament.players.length % 2 === 1 ? '1 jogador' : 'jogadores'} para sortear`}
        </button>
      </div>
    </div>
  )
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function PairsTab({
  tournament,
  onSave,
}: {
  tournament: Tournament
  onSave: (t: Tournament) => Promise<void>
}) {
  const [error, setError] = useState<string | null>(null)
  const [drawing, setDrawing] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [pendingLabel, setPendingLabel] = useState<string | null>(null)
  const alreadyDrawn = tournament.pairs.length > 0 && !drawing

  async function handleDraw() {
    try {
      setError(null)
      if (tournament.pairs.length > 0 || drawing) {
        setError('O sorteio já foi feito. Só é permitido uma vez.')
        return
      }
      const allPairs = drawPairs(tournament.players)
      setDrawing(true)
      const base = {
        ...tournament,
        groups: [] as Tournament['groups'],
        matches: [] as Tournament['matches'],
        bracketRounds: [] as Tournament['bracketRounds'],
        phase: 'pairs' as const,
      }
      await onSave({ ...base, pairs: [] })

      const revealed: Pair[] = []
      for (let i = 0; i < allPairs.length; i += 1) {
        setPendingLabel(`Dupla ${i + 1}`)
        for (const n of [3, 2, 1]) {
          setCountdown(n)
          await sleep(750)
        }
        setCountdown(null)
        revealed.push(allPairs[i])
        await onSave({ ...base, pairs: [...revealed] })
        await sleep(1100)
      }
      setPendingLabel(null)
      setDrawing(false)
    } catch (e) {
      setDrawing(false)
      setCountdown(null)
      setPendingLabel(null)
      setError(e instanceof Error ? e.message : 'Erro no sorteio')
    }
  }

  return (
    <div className="panel fade-in">
      <h2>Sorteio de duplas</h2>
      <p className="muted">
        Primeiro cadastre os jogadores. Depois clique em sortear: cada dupla aparece com
        contagem 3, 2, 1.
      </p>
      <div className="row">
        <button type="button" onClick={handleDraw} disabled={alreadyDrawn || drawing}>
          {drawing
            ? 'Sorteando…'
            : alreadyDrawn
              ? 'Sorteio concluído'
              : 'Sortear duplas'}
        </button>
      </div>
      {alreadyDrawn && !drawing && (
        <p className="muted">Duplas sorteadas uma vez — sem alterações manuais.</p>
      )}
      {error && <div className="alert">{error}</div>}

      {drawing && (
        <div className="draw-stage">
          {countdown !== null ? (
            <>
              <p className="draw-next">{pendingLabel}</p>
              <div key={countdown} className="countdown-number">
                {countdown}
              </div>
            </>
          ) : (
            <p className="draw-reveal">Dupla revelada!</p>
          )}
        </div>
      )}

      <ul className="list" style={{ marginTop: '1rem' }}>
        {tournament.pairs.map((pair, idx) => (
          <li
            key={pair.id}
            className={idx === tournament.pairs.length - 1 && drawing ? 'pair-just-in' : ''}
          >
            <span>
              <strong>Dupla {idx + 1}:</strong> {pair.label}
            </span>
          </li>
        ))}
      </ul>
      {tournament.pairs.length === 0 && !drawing && (
        <p className="empty">Cadastre os jogadores na aba Jogadores e depois sorteie aqui.</p>
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
}: {
  tournament: Tournament
  onSave: (t: Tournament) => Promise<void>
}) {
  const [error, setError] = useState<string | null>(null)
  const koMatches = tournament.matches.filter((m) => m.stage === 'knockout')
  const pending = koMatches.filter((m) => m.status === 'pending')
  const done = koMatches.filter((m) => m.status !== 'pending')
  const started = koMatches.length > 0

  async function start() {
    try {
      setError(null)
      if (tournament.pairs.length < 2) {
        throw new Error('Precisa das duplas sorteadas.')
      }
      await onSave(startLivesPhase(tournament))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao iniciar')
    }
  }

  return (
    <div className="stack fade-in">
      <div className="panel">
        <h2>Fase de 2 vidas</h2>
        <p className="muted">
          Todas as duplas entram com 2 vidas. Quem perde o confronto perde 1 vida. Quem
          perde as duas está fora. Os jogos vão sendo montados até sobrar uma campeã.
        </p>
        <div className="row">
          <button type="button" onClick={start} disabled={started}>
            {started ? 'Fase já iniciada' : 'Iniciar 2 vidas'}
          </button>
        </div>
        {error && <div className="alert">{error}</div>}
        {started && <LivesBoard tournament={tournament} />}
      </div>

      {pending.length > 0 && (
        <div className="panel">
          <h3>Jogos da vez</h3>
          <div className="stack">
            {pending.map((m) => (
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
      )}

      {done.length > 0 && (
        <div className="panel">
          <h3>Jogos encerrados</h3>
          <div className="stack">
            {done.map((m) => (
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
      )}
    </div>
  )
}

function ConfigTab({ tournament }: { tournament: Tournament }) {
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
      <h2>Backup</h2>
      <p className="muted">
        O formato do torneio (melhor de {tournament.settings.bestOf}, meta{' '}
        {tournament.settings.pointsTarget}) fica o que foi definido na criação. Depois dos
        grupos, todas as duplas jogam a fase de 2 vidas.
      </p>
      <div className="stack">
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
