import type { Match, Tournament } from '../types/tournament'
import { getPairName } from '../lib/labels'
import { matchWinner } from '../domain/doubleElim'

interface Props {
  tournament: Tournament
  title?: string
  /** Filter: which matches to show in this tree */
  matches: Match[]
}

function roundTitle(roundIndex: number, totalRounds: number, stageHint?: string): string {
  if (stageHint === 'prelim') return 'Fase preliminar'
  const fromEnd = totalRounds - 1 - roundIndex
  if (fromEnd === 0) return 'Final'
  if (fromEnd === 1) return 'Semifinais'
  if (fromEnd === 2) return 'Quartas de Final'
  if (fromEnd === 3) return 'Oitavas de Final'
  return `Rodada ${roundIndex + 1}`
}

function pairCrest(tournament: Tournament, pairId: string | null): string {
  if (!pairId) return '?'
  const pair = tournament.pairs.find((p) => p.id === pairId)
  if (!pair) return '?'
  const names = pair.playerIds.map(
    (id) => tournament.players.find((p) => p.id === id)?.name ?? '?',
  )
  return names
    .map((n) => n.trim().charAt(0).toUpperCase())
    .join('')
    .slice(0, 2)
}

function buildColumns(matches: Match[]): { title: string; matches: Match[] }[] {
  const prelim = matches.filter((m) => m.stage === 'prelim')
  const main = matches.filter(
    (m) =>
      m.stage === 'knockout' ||
      m.stage === 'final' ||
      m.stage === 'upper' ||
      m.stage === 'lower' ||
      m.stage === 'third',
  )

  const byRound = (list: Match[]) => {
    const maxRound = Math.max(0, ...list.map((m) => m.round ?? 0))
    const cols: { title: string; matches: Match[] }[] = []
    for (let r = 0; r <= maxRound; r += 1) {
      const roundMatches = list
        .filter((m) => (m.round ?? 0) === r)
        .sort((a, b) => (a.bracketSlot ?? 0) - (b.bracketSlot ?? 0))
      if (roundMatches.length) {
        cols.push({
          title: roundTitle(r, maxRound + 1),
          matches: roundMatches,
        })
      }
    }
    return cols
  }

  const cols: { title: string; matches: Match[] }[] = []
  if (prelim.length) {
    cols.push({ title: 'Fase preliminar', matches: prelim })
  }

  // Separate upper / lower / knockout / final when mixed
  const upper = main.filter((m) => m.stage === 'upper')
  const lower = main.filter((m) => m.stage === 'lower')
  const third = main.filter((m) => m.stage === 'third')
  const single = main.filter(
    (m) => m.stage === 'knockout' || m.stage === 'final',
  )

  if (upper.length) {
    for (const col of byRound(upper)) {
      cols.push({ title: `Alta · ${col.title}`, matches: col.matches })
    }
  }
  if (lower.length) {
    for (const col of byRound(lower)) {
      cols.push({ title: `Baixa · ${col.title}`, matches: col.matches })
    }
  }
  if (single.length && !upper.length) {
    cols.push(...byRound(single))
  } else if (single.some((m) => m.stage === 'final') && upper.length) {
    const finals = single.filter((m) => m.stage === 'final')
    if (finals.length) cols.push({ title: 'Final', matches: finals })
  }
  if (third.length) {
    cols.push({ title: '3º lugar', matches: third })
  }

  return cols
}

function ConfrontoCard({
  tournament,
  match,
}: {
  tournament: Tournament
  match: Match
}) {
  const winner = matchWinner(match)
  const nameA = getPairName(tournament, match.pairAId)
  const nameB = getPairName(tournament, match.pairBId)

  return (
    <div className="lb-match">
      <div className={`lb-row ${winner && winner === match.pairAId ? 'lb-winner' : ''}`}>
        <span className="lb-crest">{pairCrest(tournament, match.pairAId)}</span>
        <span className="lb-name">{nameA}</span>
        <span className="lb-score">
          {match.status !== 'pending' ? match.setsA : ''}
        </span>
      </div>
      <div className={`lb-row ${winner && winner === match.pairBId ? 'lb-winner' : ''}`}>
        <span className="lb-crest">{pairCrest(tournament, match.pairBId)}</span>
        <span className="lb-name">{nameB}</span>
        <span className="lb-score">
          {match.status !== 'pending' ? match.setsB : ''}
        </span>
      </div>
      <div className="lb-footer">
        {match.status === 'pending'
          ? match.pairAId && match.pairBId
            ? 'Aguardando'
            : 'A definir'
          : match.status === 'wo'
            ? `W.O. · ${match.setsA}×${match.setsB}`
            : `${match.setsA}×${match.setsB}`}
      </div>
    </div>
  )
}

export function BracketView({ tournament, matches, title }: Props) {
  const columns = buildColumns(matches)

  if (!columns.length) {
    return <p className="empty">Mata-mata ainda não gerado.</p>
  }

  return (
    <div className="lb-section fade-in">
      <div className="lb-header">
        <div>
          <h2 className="lb-title">{title ?? tournament.name}</h2>
          <p className="lb-sub">Fase de mata-mata</p>
        </div>
        <div className="lb-badge">
          <div className="lb-trophy-mark" aria-hidden />
          MATA-MATA
        </div>
      </div>
      <div className="lb-scroll">
        <div
          className="lb-tree"
          style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(200px, 1fr))` }}
        >
          {columns.map((col) => (
            <div className="lb-round" key={col.title}>
              <h3 className="lb-round-title">{col.title}</h3>
              <div className="lb-round-matches">
                {col.matches.map((m) => (
                  <div className="lb-slot" key={m.id}>
                    <ConfrontoCard tournament={tournament} match={m} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="lb-footnote">* Placar atualizado pelo organizador</p>
    </div>
  )
}

/** Full knockout display for a tournament (handles double-elim sections). */
export function KnockoutBracket({ tournament }: { tournament: Tournament }) {
  const ko = tournament.matches.filter((m) => m.stage !== 'group')
  if (!ko.length) {
    return <p className="empty">Mata-mata ainda não gerado.</p>
  }

  const upper = ko.filter((m) => m.stage === 'upper')
  const lower = ko.filter((m) => m.stage === 'lower')
  const rest = ko.filter(
    (m) =>
      m.stage === 'knockout' ||
      m.stage === 'prelim' ||
      m.stage === 'final' ||
      m.stage === 'third',
  )

  if (upper.length) {
    return (
      <div className="stack">
        <BracketView tournament={tournament} matches={upper} title="Chave alta" />
        {lower.length > 0 && (
          <BracketView tournament={tournament} matches={lower} title="Chave baixa" />
        )}
        <BracketView
          tournament={tournament}
          matches={ko.filter((m) => m.stage === 'final')}
          title="Final"
        />
      </div>
    )
  }

  return (
    <BracketView tournament={tournament} matches={rest} title={tournament.name} />
  )
}
