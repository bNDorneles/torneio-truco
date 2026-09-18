import type { Tournament } from '../types/tournament'
import { getPairName } from '../lib/labels'

interface Props {
  tournament: Tournament
}

function roundTitle(roundIndex: number, totalRounds: number): string {
  const fromEnd = totalRounds - 1 - roundIndex
  if (fromEnd === 0) return 'Final'
  if (fromEnd === 1) return 'Semifinal'
  if (fromEnd === 2) return 'Quartas'
  if (fromEnd === 3) return 'Oitavas'
  return `Rodada ${roundIndex + 1}`
}

export function BracketView({ tournament }: Props) {
  const { bracketRounds, matches } = tournament
  if (!bracketRounds.length) {
    return <p className="empty">Mata-mata ainda não gerado.</p>
  }

  return (
    <div className="bracket">
      {bracketRounds.map((round, ri) => (
        <div className="bracket-round" key={ri}>
          <h4>{roundTitle(ri, bracketRounds.length)}</h4>
          {round.map((slot) => {
            const match = matches.find((m) => m.id === slot.matchId)
            if (!match) return null
            return (
              <div className="match-card" key={match.id}>
                <div>{getPairName(tournament, match.pairAId)}</div>
                <div className="muted">vs</div>
                <div>{getPairName(tournament, match.pairBId)}</div>
                {match.status !== 'pending' && (
                  <span className="badge gold">
                    {match.isBye ? 'BYE' : `${match.setsA}×${match.setsB}`}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      ))}
      {tournament.thirdPlaceMatchId && (
        <div className="bracket-round">
          <h4>3º lugar</h4>
          {(() => {
            const match = matches.find((m) => m.id === tournament.thirdPlaceMatchId)
            if (!match) return null
            return (
              <div className="match-card">
                <div>{getPairName(tournament, match.pairAId)}</div>
                <div className="muted">vs</div>
                <div>{getPairName(tournament, match.pairBId)}</div>
                {match.status !== 'pending' && (
                  <span className="badge gold">
                    {match.setsA}×{match.setsB}
                  </span>
                )}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
