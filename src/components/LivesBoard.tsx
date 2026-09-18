import type { Tournament } from '../types/tournament'
import { computeLives, STARTING_LIVES, alivePairIds } from '../domain/lives'
import { getPairName } from '../lib/labels'

export function LivesBoard({ tournament }: { tournament: Tournament }) {
  const lives = computeLives(
    tournament.pairs.map((p) => p.id),
    tournament.matches,
  )
  const alive = new Set(alivePairIds(lives))
  const rows = [...tournament.pairs].sort((a, b) => (lives[b.id] ?? 0) - (lives[a.id] ?? 0))
  const champion = alive.size === 1 ? [...alive][0] : null

  return (
    <div>
      {champion && (
        <p className="badge gold" style={{ marginBottom: '0.75rem' }}>
          Campeã: {getPairName(tournament, champion)}
        </p>
      )}
      <ul className="list">
        {rows.map((pair) => {
          const n = lives[pair.id] ?? 0
          return (
            <li key={pair.id}>
              <span>{pair.label ?? getPairName(tournament, pair.id)}</span>
              <span className={n === 0 ? 'muted' : ''}>
                {n === 0 ? 'Eliminada' : '♥ '.repeat(n).trim() || `${n} vida(s)`}
                <span className="muted"> ({n}/{STARTING_LIVES})</span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
