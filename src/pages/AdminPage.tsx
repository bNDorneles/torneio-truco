import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTournament } from '../hooks/useTournament'
import { verifyPassword } from '../domain/crypto'
import { isOrganizerSession, setOrganizerSession } from '../lib/session'
import { formatLabelOf, phaseLabel } from '../lib/labels'
import { createId } from '../domain/ids'
import { drawPairs, createManualPair, updatePairNames, removePair } from '../domain/drawPairs'
import { formGroups, movePairBetweenGroups } from '../domain/formGroups'
import { generateRoundRobin } from '../domain/roundRobin'
import { computeStandings } from '../domain/standings'
import {
  describeKnockoutPlan,
  generateBracket,
  groupsComplete,
  hasGroupScores,
  hasKnockoutScores,
} from '../domain/generateBracket'
import { MatchEditor } from '../components/MatchEditor'
import { StandingsTable } from '../components/StandingsTable'
import { KnockoutBracket } from '../components/BracketView'
import {
  exportTournamentJson,
  importTournamentJson,
} from '../lib/storage'
import {
  getAdvancePerGroup,
  getTournamentFormat,
  isKnockoutStage,
  type Pair,
  type Tournament,
} from '../types/tournament'

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

  const format = getTournamentFormat(tournament)
  const showGroups = format === 'groups_knockout'

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

  const tabs: [Tab, string][] = [
    ['players', 'Jogadores'],
    ['pairs', 'Sorteio'],
    ...(showGroups
      ? ([
          ['groups', 'Grupos'],
          ['results', 'Resultados'],
        ] as [Tab, string][])
      : []),
    ['knockout', 'Mata-mata'],
    ['config', 'Backup'],
  ]

  return (
    <div className="app-shell app-shell-wide">
      <div className="topbar">
        <div>
          <h1 className="brand" style={{ fontSize: '2.4rem' }}>
            {tournament.name}
          </h1>
          <p className="muted" style={{ margin: '0.25rem 0 0' }}>
            {phaseLabel(tournament.phase)} · {formatLabelOf(tournament)} · melhor de{' '}
            {tournament.settings.bestOf}
            {getTournamentFormat(tournament) === 'groups_knockout'
              ? ` · sobe ${getAdvancePerGroup(tournament)}/grupo`
              : ''}
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
        {tabs.map(([id, label]) => (
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
      {tab === 'groups' && showGroups && (
        <GroupsTab tournament={tournament} onSave={update} />
      )}
      {tab === 'results' && showGroups && (
        <ResultsTab tournament={tournament} onSave={update} />
      )}
      {tab === 'knockout' && <KnockoutTab tournament={tournament} onSave={update} />}
      {tab === 'config' && <ConfigTab tournament={tournament} onSave={update} />}
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

  async function addPlayer(e: FormEvent) {
    e.preventDefault()
    const name = playerName.trim()
    if (!name) return
    if (tournament.pairs.length > 0) {
      if (
        !confirm(
          'Já existem duplas sorteadas. Adicionar jogador exige novo sorteio depois. Continuar?',
        )
      ) {
        return
      }
    }
    const players = [...tournament.players, { id: createId('pl'), name }]
    await onSave({
      ...tournament,
      players,
      pairs: [],
      groups: [],
      matches: [],
      bracketRounds: [],
      thirdPlaceMatchId: null,
      phase: 'setup',
    })
    setPlayerName('')
  }

  async function removePlayer(id: string) {
    if (tournament.pairs.length > 0) {
      if (!confirm('Remover jogador zera duplas, grupos e chave. Continuar?')) return
    }
    await onSave({
      ...tournament,
      players: tournament.players.filter((p) => p.id !== id),
      pairs: [],
      groups: [],
      matches: [],
      bracketRounds: [],
      thirdPlaceMatchId: null,
      phase: 'setup',
    })
  }

  return (
    <div className="panel fade-in">
      <h2>Jogadores ({tournament.players.length})</h2>
      <p className="muted">
        Cadastre cada pessoa pelo nome. As <strong>duplas não se cadastram</strong> — o sorteio
        forma elas. Precisa de quantidade par (mínimo 2).
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
        <button type="button" onClick={onGoToDraw} disabled={!even}>
          {even
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
  const [newA, setNewA] = useState('')
  const [newB, setNewB] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editA, setEditA] = useState('')
  const [editB, setEditB] = useState('')
  const hasPairs = tournament.pairs.length > 0 && !drawing
  const format = getTournamentFormat(tournament)

  function confirmClearDownstream(message: string): boolean {
    const hasDownstream =
      tournament.groups.length > 0 ||
      tournament.matches.some((m) => isKnockoutStage(m.stage)) ||
      hasKnockoutScores(tournament) ||
      hasGroupScores(tournament)
    if (!hasDownstream) return true
    return confirm(message)
  }

  function stripDownstream(base: Tournament): Tournament {
    return {
      ...base,
      groups: [],
      matches: [],
      bracketRounds: [],
      thirdPlaceMatchId: null,
      phase: 'pairs',
    }
  }

  async function handleDraw() {
    try {
      setError(null)
      if (drawing) return
      if (hasPairs) {
        if (
          !confirmClearDownstream(
            'Sortear de novo zera grupos, placares e chave. Continuar?',
          )
        ) {
          return
        }
      }
      if (tournament.players.length < 2 || tournament.players.length % 2 !== 0) {
        throw new Error('Cadastre quantidade par de jogadores (aba Jogadores) ou use “Cadastrar dupla”.')
      }
      const allPairs = drawPairs(tournament.players)
      setDrawing(true)
      const base = stripDownstream(tournament)
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

  async function handleAddPair(e: FormEvent) {
    e.preventDefault()
    try {
      setError(null)
      if (
        !confirmClearDownstream(
          'Cadastrar uma dupla a mais zera a chave (e grupos, se houver) para remontar. Continuar?',
        )
      ) {
        return
      }
      const { players, pair } = createManualPair(tournament.players, newA, newB)
      const next = stripDownstream({
        ...tournament,
        players,
        pairs: [...tournament.pairs, pair],
      })
      await onSave(next)
      setNewA('')
      setNewB('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar')
    }
  }

  function startEdit(pair: Pair) {
    const p0 = tournament.players.find((p) => p.id === pair.playerIds[0])
    const p1 = tournament.players.find((p) => p.id === pair.playerIds[1])
    setEditingId(pair.id)
    setEditA(p0?.name ?? '')
    setEditB(p1?.name ?? '')
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault()
    if (!editingId) return
    try {
      setError(null)
      const { players, pairs } = updatePairNames(
        tournament.players,
        tournament.pairs,
        editingId,
        editA,
        editB,
      )
      await onSave({ ...tournament, players, pairs })
      setEditingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao editar')
    }
  }

  async function handleRemove(pairId: string) {
    if (
      !confirmClearDownstream(
        'Remover a dupla zera a chave (e grupos). Continuar?',
      )
    ) {
      return
    }
    if (!confirm('Remover esta dupla de vez?')) return
    try {
      const { players, pairs } = removePair(
        tournament.players,
        tournament.pairs,
        pairId,
      )
      await onSave(stripDownstream({ ...tournament, players, pairs }))
      if (editingId === pairId) setEditingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover')
    }
  }

  return (
    <div className="stack fade-in">
      <div className="panel">
        <h2>Sorteio de duplas</h2>
        <p className="muted">
          Sorteie pelos jogadores cadastrados, ou cadastre/edite uma dupla manualmente
          (útil se o torneio já começou).
        </p>
        {format === 'double_elim' && tournament.pairs.length > 0 && (
          <p className="muted" style={{ marginTop: 0 }}>
            Com <strong>{tournament.pairs.length} duplas</strong> no 2 vidas:{' '}
            {describeKnockoutPlan(tournament)}.
            {tournament.pairs.length === 7 && (
              <>
                {' '}
                Na prática: <strong>3 preliminares</strong> (6 duplas jogam a vaga),{' '}
                <strong>1 entra direto</strong> na chave de 4, depois chave alta + baixa
                até a final.
              </>
            )}
          </p>
        )}
        <div className="row">
          <button type="button" onClick={handleDraw} disabled={drawing}>
            {drawing
              ? 'Sorteando…'
              : hasPairs
                ? 'Sortear duplas novamente'
                : 'Sortear duplas'}
          </button>
        </div>
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
      </div>

      <div className="panel">
        <h3>Cadastrar dupla a mais</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Informe os dois nomes. A chave precisa ser gerada de novo depois.
        </p>
        <form className="row" onSubmit={handleAddPair}>
          <input
            style={{ flex: 1 }}
            value={newA}
            onChange={(e) => setNewA(e.target.value)}
            placeholder="Jogador 1"
            disabled={drawing}
          />
          <input
            style={{ flex: 1 }}
            value={newB}
            onChange={(e) => setNewB(e.target.value)}
            placeholder="Jogador 2"
            disabled={drawing}
          />
          <button type="submit" disabled={drawing}>
            Adicionar dupla
          </button>
        </form>
      </div>

      <div className="panel">
        <h3>Duplas ({tournament.pairs.length})</h3>
        <ul className="list">
          {tournament.pairs.map((pair, idx) => (
            <li
              key={pair.id}
              className={idx === tournament.pairs.length - 1 && drawing ? 'pair-just-in' : ''}
              style={{ flexWrap: 'wrap', gap: '0.5rem' }}
            >
              {editingId === pair.id ? (
                <form className="row" style={{ flex: 1, width: '100%' }} onSubmit={saveEdit}>
                  <input
                    style={{ flex: 1 }}
                    value={editA}
                    onChange={(e) => setEditA(e.target.value)}
                  />
                  <input
                    style={{ flex: 1 }}
                    value={editB}
                    onChange={(e) => setEditB(e.target.value)}
                  />
                  <button type="submit">Salvar</button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => setEditingId(null)}
                  >
                    Cancelar
                  </button>
                </form>
              ) : (
                <>
                  <span style={{ flex: 1 }}>
                    <strong>Dupla {idx + 1}:</strong> {pair.label}
                  </span>
                  <button
                    type="button"
                    className="secondary"
                    disabled={drawing}
                    onClick={() => startEdit(pair)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    disabled={drawing}
                    onClick={() => void handleRemove(pair.id)}
                  >
                    Remover
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
        {tournament.pairs.length === 0 && !drawing && (
          <p className="empty">
            Cadastre jogadores e sorteie, ou adicione uma dupla manualmente acima.
          </p>
        )}
      </div>
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
      if (tournament.groups.length > 0 || hasGroupScores(tournament) || hasKnockoutScores(tournament)) {
        if (
          !confirm(
            'Sortear grupos de novo zera placares de grupo e a chave. Continuar?',
          )
        ) {
          return
        }
      }
      const groups = formGroups(tournament.pairs)
      const matches = generateRoundRobin(groups)
      await onSave({
        ...tournament,
        groups,
        matches,
        bracketRounds: [],
        thirdPlaceMatchId: null,
        phase: 'groups',
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro')
    }
  }

  async function movePair(pairId: string, toGroupId: string) {
    if (hasGroupScores(tournament) || hasKnockoutScores(tournament)) {
      if (!confirm('Mover dupla remonta os confrontos do grupo e zera placares/chave. Continuar?')) {
        return
      }
    }
    const groups = movePairBetweenGroups(tournament.groups, pairId, toGroupId)
    const matches = generateRoundRobin(groups)
    await onSave({
      ...tournament,
      groups,
      matches,
      bracketRounds: [],
      thirdPlaceMatchId: null,
      phase: 'groups',
    })
  }

  return (
    <div className="panel fade-in">
      <h2>Grupos</h2>
      <p className="muted">Sorteie os grupos (pode repetir). Confrontos todos vs todos são gerados junto.</p>
      <div className="row">
        <button type="button" onClick={handleFormGroups}>
          {tournament.groups.length ? 'Sortear grupos novamente' : 'Sortear grupos'}
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
                      value={g.id}
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
          <p className="empty">Gere os grupos primeiro.</p>
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
  const format = getTournamentFormat(tournament)
  const koMatches = tournament.matches.filter((m) => isKnockoutStage(m.stage))
  const pending = koMatches.filter(
    (m) => m.status === 'pending' && m.pairAId && m.pairBId,
  )
  const started = koMatches.length > 0
  const canGenerate =
    format === 'double_elim'
      ? tournament.pairs.length >= 2
      : groupsComplete(tournament)

  async function startOrRegen() {
    try {
      setError(null)
      if (started && hasKnockoutScores(tournament)) {
        if (!confirm('Gerar a chave de novo apaga placares do mata-mata. Continuar?')) {
          return
        }
      } else if (started) {
        if (!confirm('Gerar a chave novamente?')) return
      }
      await onSave(generateBracket(tournament))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar chave')
    }
  }

  return (
    <div className="stack fade-in">
      <div className="panel">
        <h2>Mata-mata</h2>
        <p className="muted">
          {format === 'double_elim'
            ? '2 vidas (estilo Farroupilha): chave alta + chave baixa. Sem bye — preliminar se N não for 4/8/16.'
            : `Classificados: ${getAdvancePerGroup(tournament)} por grupo. Cruzamento 1A×2B quando sobe 2. Sem bye.`}
        </p>
        <p className="muted">{describeKnockoutPlan(tournament)}</p>
        <div className="row">
          <button type="button" onClick={startOrRegen} disabled={!canGenerate && !started}>
            {started ? 'Gerar chave novamente' : 'Gerar chave'}
          </button>
        </div>
        {!canGenerate && !started && format === 'groups_knockout' && (
          <p className="muted">Finalize todos os jogos dos grupos para liberar a chave.</p>
        )}
        {error && <div className="alert">{error}</div>}
      </div>

      {started && <KnockoutBracket tournament={tournament} />}

      {pending.length > 0 && (
        <div className="panel">
          <h3>Lançar placares</h3>
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

      {koMatches.some((m) => m.status !== 'pending') && (
        <div className="panel">
          <h3>Jogos encerrados</h3>
          <div className="stack">
            {koMatches
              .filter((m) => m.status !== 'pending')
              .map((m) => (
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

function ConfigTab({
  tournament,
  onSave,
}: {
  tournament: Tournament
  onSave: (t: Tournament) => Promise<void>
}) {
  const [msg, setMsg] = useState<string | null>(null)
  const format = getTournamentFormat(tournament)
  const advance = getAdvancePerGroup(tournament)

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

  async function setAdvance(n: number) {
    if (hasKnockoutScores(tournament) || tournament.matches.some((m) => isKnockoutStage(m.stage))) {
      if (
        !confirm(
          'Alterar classificados por grupo exige gerar a chave de novo. Continuar?',
        )
      ) {
        return
      }
    }
    await onSave({
      ...tournament,
      settings: { ...tournament.settings, advancePerGroup: n },
      matches: tournament.matches.filter((m) => !isKnockoutStage(m.stage)),
      bracketRounds: [],
      thirdPlaceMatchId: null,
      phase: tournament.groups.length ? 'groups' : tournament.phase,
    })
    setMsg(`Agora sobem ${n} por grupo.`)
  }

  return (
    <div className="panel fade-in">
      <h2>Configuração e backup</h2>
      <p className="muted">
        Formato: {formatLabelOf(tournament)} · melhor de {tournament.settings.bestOf}
        {format === 'groups_knockout' ? ` · sobe ${advance}/grupo` : ' · 2 vidas'}.
      </p>

      {format === 'groups_knockout' && (
        <label style={{ marginBottom: '1rem' }}>
          Classificados por grupo
          <select
            value={advance}
            onChange={(e) => void setAdvance(Number(e.target.value))}
          >
            <option value={1}>1º lugar (1 por grupo)</option>
            <option value={2}>1º e 2º (2 por grupo)</option>
            <option value={3}>1º, 2º e 3º (3 por grupo)</option>
          </select>
        </label>
      )}

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
