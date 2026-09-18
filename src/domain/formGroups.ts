import type { Group, Pair } from '../types/tournament'
import { createId, shuffle } from './ids'

/** Prefer groups of 3–4 pairs; balance sizes. */
export function formGroups(pairs: Pair[]): Group[] {
  const n = pairs.length
  if (n < 2) throw new Error('Precisa de pelo menos 2 duplas para formar grupos.')

  const sizes = planGroupSizes(n)
  const shuffled = shuffle(pairs)
  const groups: Group[] = []
  let offset = 0

  sizes.forEach((size, index) => {
    const slice = shuffled.slice(offset, offset + size)
    offset += size
    groups.push({
      id: createId('group'),
      name: `Grupo ${String.fromCharCode(65 + index)}`,
      pairIds: slice.map((p) => p.id),
    })
  })

  return groups
}

export function planGroupSizes(pairCount: number): number[] {
  if (pairCount <= 4) return [pairCount]
  if (pairCount === 5) return [3, 2]
  if (pairCount === 6) return [3, 3]
  if (pairCount === 7) return [4, 3]

  // Prefer 3 and 4
  const maxGroups = Math.ceil(pairCount / 3)
  const minGroups = Math.ceil(pairCount / 4)

  for (let g = minGroups; g <= maxGroups; g += 1) {
    // Solve: 3*a + 4*b = pairCount, a+b = g
    // 3g + b = pairCount => b = pairCount - 3g, a = g - b
    const b = pairCount - 3 * g
    const a = g - b
    if (b >= 0 && a >= 0) {
      return [...Array(a).fill(3), ...Array(b).fill(4)]
    }
  }

  // Fallback: distribute as evenly as possible around 3–4
  let remaining = pairCount
  const sizes: number[] = []
  while (remaining > 0) {
    if (remaining === 5) {
      sizes.push(3, 2)
      break
    }
    if (remaining <= 4) {
      sizes.push(remaining)
      break
    }
    const size = remaining % 3 === 1 ? 4 : 3
    sizes.push(size)
    remaining -= size
  }

  return sizes
}

export function movePairBetweenGroups(
  groups: Group[],
  pairId: string,
  toGroupId: string,
): Group[] {
  return groups.map((g) => {
    const without = g.pairIds.filter((id) => id !== pairId)
    if (g.id === toGroupId) {
      return { ...g, pairIds: [...without, pairId] }
    }
    return { ...g, pairIds: without }
  })
}
