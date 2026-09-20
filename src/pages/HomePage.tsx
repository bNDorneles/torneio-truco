import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { BestOf, TournamentFormat, TournamentListItem } from '../types/tournament'
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
  const [thirdPlace, setThirdPlace] = useState(true)
  const [advancePerGroup, setAdvancePerGroup] = useState(2)
  const [format, setFormat] = useState<TournamentFormat>('groups_knockout')
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
        thirdPlaceEnabled: format === 'groups_knockout' ? thirdPlace : false,
        advancePerGroup: format === 'groups_knockout' ? advancePerGroup : 2,
        format,
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
          Cadastre jogadores, sorteie duplas, monte grupos ou double elimination, lance
          placares e compartilhe o link.
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
            <label>
              Formato do torneio
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as TournamentFormat)}
              >
                <option value="groups_knockout">Grupos + mata-mata</option>
                <option value="double_elim">Double elimination (2 vidas)</option>
              </select>
            </label>
            <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
              {format === 'groups_knockout'
                ? 'Fase de grupos e depois mata-mata (cruzamento 1A×2B quando sobe 2). Sem bye.'
                : '2 vidas como na chave Farroupilha: chave alta + chave baixa. Sem bye.'}
            </p>
            <div className="row">
              <label style={{ flex: 1 }}>
                Séries
                <select
                  value={bestOf}
                  onChange={(e) => setBestOf(Number(e.target.value) as BestOf)}
                >
                  <option value={1}>Melhor de 1 (1×0)</option>
                  <option value={3}>Melhor de 3 (2×0 / 2×1)</option>
                  <option value={5}>Melhor de 5 (3×0 / 3×1 / 3×2)</option>
                </select>
              </label>
            </div>
            {format === 'groups_knockout' && (
              <>
                <label>
                  Classificados por grupo
                  <select
                    value={advancePerGroup}
                    onChange={(e) => setAdvancePerGroup(Number(e.target.value))}
                  >
                    <option value={1}>1º lugar (1 por grupo)</option>
                    <option value={2}>1º e 2º (2 por grupo)</option>
                    <option value={3}>1º, 2º e 3º (3 por grupo)</option>
                  </select>
                </label>
                <label style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={thirdPlace}
                    onChange={(e) => setThirdPlace(e.target.checked)}
                  />
                  Disputa de 3º lugar
                </label>
              </>
            )}
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
