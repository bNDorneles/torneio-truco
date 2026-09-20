import type { Group, Match, StandingRow } from '../types/tournament'
import { compareStandings, computeStandings } from './standings'
import { isPowerOfTwo } from './singleElim'

export interface QualifiedPair {
  pairId: string
  groupId: string
  groupRank: number
  standing: StandingRow
  tag: string
}

/** Maior potência de 2 que cabe em n (mínimo 2). */
export function largestPowerOfTwo(n: number): number {
  let p = 1
  while (p * 2 <= n) p *= 2
  return Math.max(p, 2)
}

function groupLetter(groupName: string, fallbackIndex: number): string {
  const m = groupName.match(/Grupo\s+([A-Z0-9]+)/i)
  if (m) return m[1].toUpperCase()
  return String.fromCharCode(65 + fallbackIndex)
}

/**
 * Classificados por grupo — igual `seedsFromGroups` do fifa-cup.
 * `advancePerGroup`: quantos sobem de cada grupo (1, 2, 3…).
 * Ordem: todos os 1ºs (melhor→pior), depois 2ºs, etc.
 * Grupo único: usa a tabela até o necessário (mín. 2).
 */
export function qualifyFromGroups(
  groups: Group[],
  matches: Match[],
  advancePerGroup = 2,
): QualifiedPair[] {
  if (!groups.length) {
    throw new Error('Precisa de grupos formados.')
  }
  const advance = Math.min(4, Math.max(1, Math.floor(advancePerGroup)))

  const groupStandings = groups.map((group, gi) => ({
    group,
    letter: groupLetter(group.name, gi),
    standings: computeStandings(
      group.pairIds,
      matches.filter((m) => m.stage === 'group' && m.groupId === group.id),
    ),
  }))

  if (groups.length === 1) {
    const { group, letter, standings } = groupStandings[0]
    const take = Math.max(2, Math.min(advance, standings.length))
    if (standings.length < 2) {
      throw new Error('Precisa de pelo menos 2 duplas classificadas.')
    }
    return standings.slice(0, take).map((row, idx) => ({
      pairId: row.pairId,
      groupId: group.id,
      groupRank: idx + 1,
      standing: row,
      tag: `${letter}${idx + 1}`,
    }))
  }

  const byRank: QualifiedPair[][] = Array.from({ length: advance }, () => [])

  for (const { group, letter, standings } of groupStandings) {
    const take = Math.min(advance, standings.length)
    if (take < 1) {
      throw new Error(`Grupo ${group.name} sem duplas suficientes para classificar.`)
    }
    for (let idx = 0; idx < take; idx += 1) {
      const row = standings[idx]
      byRank[idx].push({
        pairId: row.pairId,
        groupId: group.id,
        groupRank: idx + 1,
        standing: row,
        tag: `${letter}${idx + 1}`,
      })
    }
  }

  const byStanding = (a: QualifiedPair, b: QualifiedPair) =>
    compareStandings(a.standing, b.standing, matches)

  const pool: QualifiedPair[] = []
  for (const bucket of byRank) {
    bucket.sort(byStanding)
    pool.push(...bucket)
  }

  if (pool.length < 2) {
    throw new Error('Precisa de pelo menos 2 duplas classificadas.')
  }
  return pool
}

/**
 * Confrontos 1A×2B (Copa) — só quando advancePerGroup === 2,
 * há ≥2 grupos pares e total classificados é potência de 2.
 */
export function crossGroupMatchups(
  groups: Group[],
  matches: Match[],
  advancePerGroup = 2,
): Array<{ pairAId: string; pairBId: string; label: string }> | null {
  if (advancePerGroup !== 2) return null
  if (groups.length < 2 || groups.length % 2 !== 0) return null

  const ordered = [...groups].sort((a, b) => a.name.localeCompare(b.name))
  const firsts: QualifiedPair[] = []
  const seconds: QualifiedPair[] = []

  ordered.forEach((group, gi) => {
    const letter = groupLetter(group.name, gi)
    const standings = computeStandings(
      group.pairIds,
      matches.filter((m) => m.stage === 'group' && m.groupId === group.id),
    )
    if (standings.length < 2) return
    firsts.push({
      pairId: standings[0].pairId,
      groupId: group.id,
      groupRank: 1,
      standing: standings[0],
      tag: `${letter}1`,
    })
    seconds.push({
      pairId: standings[1].pairId,
      groupId: group.id,
      groupRank: 2,
      standing: standings[1],
      tag: `${letter}2`,
    })
  })

  if (firsts.length !== ordered.length || seconds.length !== ordered.length) {
    return null
  }

  const n = firsts.length * 2
  if (!isPowerOfTwo(n)) return null

  const blocks: Array<{ pairAId: string; pairBId: string; label: string }> = []
  for (let i = 0; i < firsts.length; i += 2) {
    const a = firsts[i]
    const b = firsts[i + 1]
    const a2 = seconds[i]
    const b2 = seconds[i + 1]
    blocks.push({
      pairAId: a.pairId,
      pairBId: b2.pairId,
      label: `${a.tag} × ${b2.tag}`,
    })
    blocks.push({
      pairAId: b.pairId,
      pairBId: a2.pairId,
      label: `${b.tag} × ${a2.tag}`,
    })
  }

  const tops = blocks.filter((_, i) => i % 2 === 0)
  const bots = blocks.filter((_, i) => i % 2 === 1)
  return [...tops, ...bots]
}

export function describeCrossPlan(
  groups: Group[],
  matches: Match[],
  advancePerGroup = 2,
): string | null {
  const m = crossGroupMatchups(groups, matches, advancePerGroup)
  if (!m) return null
  return m.map((x) => x.label).join(' · ')
}
