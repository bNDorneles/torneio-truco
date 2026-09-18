import type { Match, StandingRow } from '../types/tournament'

function emptyRow(pairId: string): StandingRow {
  return {
    pairId,
    played: 0,
    wins: 0,
    losses: 0,
    setsFor: 0,
    setsAgainst: 0,
    setDiff: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    pointDiff: 0,
    rank: 0,
  }
}

export function computeStandings(
  pairIds: string[],
  matches: Match[],
): StandingRow[] {
  const map = new Map(pairIds.map((id) => [id, emptyRow(id)]))

  for (const match of matches) {
    if (match.status === 'pending' || !match.pairAId || !match.pairBId) continue
    if (!match.winnerPairId) continue

    const a = map.get(match.pairAId)
    const b = map.get(match.pairBId)
    if (!a || !b) continue

    a.played += 1
    b.played += 1
    a.setsFor += match.setsA
    a.setsAgainst += match.setsB
    b.setsFor += match.setsB
    b.setsAgainst += match.setsA
    a.pointsFor += match.pointsA
    a.pointsAgainst += match.pointsB
    b.pointsFor += match.pointsB
    b.pointsAgainst += match.pointsA

    if (match.winnerPairId === match.pairAId) {
      a.wins += 1
      b.losses += 1
    } else {
      b.wins += 1
      a.losses += 1
    }
  }

  const rows = [...map.values()].map((r) => ({
    ...r,
    setDiff: r.setsFor - r.setsAgainst,
    pointDiff: r.pointsFor - r.pointsAgainst,
  }))

  rows.sort((x, y) => compareStandings(x, y, matches))

  rows.forEach((row, index) => {
    row.rank = index + 1
  })

  return rows
}

/** vitórias → saldo sets → confronto direto → saldo rounds */
export function compareStandings(
  a: StandingRow,
  b: StandingRow,
  matches: Match[],
): number {
  if (b.wins !== a.wins) return b.wins - a.wins
  if (b.setDiff !== a.setDiff) return b.setDiff - a.setDiff

  const h2h = headToHead(a.pairId, b.pairId, matches)
  if (h2h !== 0) return h2h

  if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff
  if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor
  return a.pairId.localeCompare(b.pairId)
}

function headToHead(pairA: string, pairB: string, matches: Match[]): number {
  const m = matches.find(
    (match) =>
      match.status !== 'pending' &&
      match.winnerPairId &&
      ((match.pairAId === pairA && match.pairBId === pairB) ||
        (match.pairAId === pairB && match.pairBId === pairA)),
  )
  if (!m || !m.winnerPairId) return 0
  if (m.winnerPairId === pairA) return -1
  if (m.winnerPairId === pairB) return 1
  return 0
}
