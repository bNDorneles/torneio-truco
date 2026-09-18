import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { BestOf, TournamentListItem } from '../types/tournament'
import { createTournament } from '../lib/createTournament'
import { listTournaments } from '../lib/storage'
import { setOrganizerSession } from '../lib/session'
import { isFirebaseConfigured } from '../lib/firebase'
import { phaseLabel } from '../lib/labels'

export function HomePage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<TournamentListItem[]>([])
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [bestOf, setBestOf] = useState<BestOf>(3)
  const [pointsTarget, setPointsTarget] = useState(12)
  const [thirdPlace, setThirdPlace] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void listTournaments().then(setItems)
  }, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim() || !password.trim()) {
      setError('Informe nome e senha do organizador.')
      return
    }
    setBusy(true)
    try {
      const t = await createTournament({
        name,
        password,
        bestOf,
        pointsTarget,
        thirdPlaceEnabled: thirdPlace,
      })
      setOrganizerSession(t.id)
      navigate(`/t/${t.slug}/admin`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-shell">
      <section className="hero-home">
        <p className="badge gold" style={{ width: 'fit-content' }}>
          {isFirebaseConfigured ? 'Online · Firebase' : 'Modo local · configure o Firebase depois'}
        </p>
        <h1 className="brand">Torneio de Truco</h1>
        <p className="subbrand">
          Cadastre jogadores, sorteie duplas, monte grupos, lance placares e compartilhe o
          link para quem estiver fora acompanhar ao vivo.
        </p>
      </section>

      <div className="grid-2">
        <form className="panel" onSubmit={handleCreate}>
          <h2>Novo torneio</h2>
          <div className="stack">
            <label>
              Nome do torneio
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Truco do Churrasco" />
            </label>
            <label>
              Senha do organizador
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Só quem organiza"
              />
            </label>
            <div className="row">
              <label style={{ flex: 1 }}>
                Formato
                <select
                  value={bestOf}
                  onChange={(e) => setBestOf(Number(e.target.value) as BestOf)}
                >
                  <option value={1}>Melhor de 1</option>
                  <option value={3}>Melhor de 3</option>
                  <option value={5}>Melhor de 5</option>
                </select>
              </label>
              <label style={{ flex: 1 }}>
                Meta de pontos (round)
                <input
                  type="number"
                  min={1}
                  value={pointsTarget}
                  onChange={(e) => setPointsTarget(Number(e.target.value) || 12)}
                />
              </label>
            </div>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                checked={thirdPlace}
                onChange={(e) => setThirdPlace(e.target.checked)}
              />
              Disputa de 3º lugar
            </label>
            {error && <div className="alert">{error}</div>}
            <button type="submit" disabled={busy}>
              {busy ? 'Criando…' : 'Criar torneio'}
            </button>
          </div>
        </form>

        <div className="panel">
          <h2>Torneios salvos</h2>
          {items.length === 0 ? (
            <p className="empty">Nenhum torneio ainda.</p>
          ) : (
            <ul className="list tour-list">
              {items.map((t) => (
                <li key={t.id}>
                  <div>
                    <Link to={`/t/${t.slug}`}>{t.name}</Link>
                    <div className="muted" style={{ fontSize: '0.85rem' }}>
                      {phaseLabel(t.phase)} · /{t.slug}
                    </div>
                  </div>
                  <Link className="btn secondary" to={`/t/${t.slug}/admin`}>
                    Admin
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
