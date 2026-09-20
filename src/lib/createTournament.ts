import type { BestOf, Tournament, TournamentFormat } from '../types/tournament'
import { createPasswordHash } from '../domain/crypto'
import { createId, slugify } from '../domain/ids'
import { saveTournament, getTournamentBySlug } from './storage'

export async function createTournament(input: {
  name: string
  password: string
  bestOf?: BestOf
  pointsTarget?: number
  thirdPlaceEnabled?: boolean
  advancePerGroup?: number
  format?: TournamentFormat
}): Promise<Tournament> {
  const baseSlug = slugify(input.name) || 'torneio'
  let slug = baseSlug
  let attempt = 1
  while (await getTournamentBySlug(slug)) {
    attempt += 1
    slug = `${baseSlug}-${attempt}`
  }

  const advance = Math.min(4, Math.max(1, Math.floor(input.advancePerGroup ?? 2)))

  const { hash, salt } = await createPasswordHash(input.password)
  const now = new Date().toISOString()
  const tournament: Tournament = {
    id: createId('trn'),
    name: input.name.trim(),
    slug,
    createdAt: now,
    updatedAt: now,
    phase: 'setup',
    format: input.format ?? 'groups_knockout',
    settings: {
      bestOf: input.bestOf ?? 3,
      pointsTarget: input.pointsTarget ?? 12,
      thirdPlaceEnabled: input.thirdPlaceEnabled ?? true,
      advancePerGroup: advance,
    },
    passwordHash: hash,
    salt,
    players: [],
    pairs: [],
    groups: [],
    matches: [],
    bracketRounds: [],
    thirdPlaceMatchId: null,
  }

  await saveTournament(tournament)
  return tournament
}
