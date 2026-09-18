import type { StandingRow, Tournament } from '../types/tournament'
import { getPairName } from '../lib/labels'

interface Props {
  tournament: Tournament
  rows: StandingRow[]
}

export function StandingsTable({ tournament, rows }: Props) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Dupla</th>
            <th>J</th>
            <th>V</th>
            <th>D</th>
            <th>Sets</th>
            <th>Saldo</th>
            <th>Rounds</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.pairId}>
              <td>{row.rank}</td>
              <td>{getPairName(tournament, row.pairId)}</td>
              <td>{row.played}</td>
              <td>{row.wins}</td>
              <td>{row.losses}</td>
              <td>
                {row.setsFor}×{row.setsAgainst}
              </td>
              <td>{row.setDiff > 0 ? `+${row.setDiff}` : row.setDiff}</td>
              <td>
                {row.pointsFor}×{row.pointsAgainst}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
