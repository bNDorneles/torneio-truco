import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore'
import type { Tournament, TournamentListItem } from '../types/tournament'
import { getDb, isFirebaseConfigured } from './firebase'

const LOCAL_KEY = 'torneio-truco:tournaments'
const LOCAL_INDEX = 'torneio-truco:index'

function readLocalAll(): Record<string, Tournament> {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '{}') as Record<
      string,
      Tournament
    >
  } catch {
    return {}
  }
}

function writeLocalAll(data: Record<string, Tournament>) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(data))
  const index: TournamentListItem[] = Object.values(data).map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    createdAt: t.createdAt,
    phase: t.phase,
  }))
  localStorage.setItem(LOCAL_INDEX, JSON.stringify(index))
}

export async function listTournaments(): Promise<TournamentListItem[]> {
  if (isFirebaseConfigured) {
    const db = getDb()
    if (!db) return listLocal()
    const snap = await getDocs(collection(db, 'tournaments'))
    return snap.docs
      .map((d) => {
        const t = d.data() as Tournament
        return {
          id: t.id,
          name: t.name,
          slug: t.slug,
          createdAt: t.createdAt,
          phase: t.phase,
        }
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
  return listLocal()
}

function listLocal(): TournamentListItem[] {
  try {
    const index = JSON.parse(
      localStorage.getItem(LOCAL_INDEX) ?? '[]',
    ) as TournamentListItem[]
    return index.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  } catch {
    return Object.values(readLocalAll())
      .map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        createdAt: t.createdAt,
        phase: t.phase,
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
}

export async function getTournamentBySlug(
  slug: string,
): Promise<Tournament | null> {
  if (isFirebaseConfigured) {
    const db = getDb()
    if (!db) return getLocalBySlug(slug)
    const q = query(collection(db, 'tournaments'), where('slug', '==', slug))
    const snap = await getDocs(q)
    if (snap.empty) return null
    return snap.docs[0].data() as Tournament
  }
  return getLocalBySlug(slug)
}

function getLocalBySlug(slug: string): Tournament | null {
  const all = readLocalAll()
  return Object.values(all).find((t) => t.slug === slug) ?? null
}

export async function getTournamentById(
  id: string,
): Promise<Tournament | null> {
  if (isFirebaseConfigured) {
    const db = getDb()
    if (!db) return readLocalAll()[id] ?? null
    const snap = await getDoc(doc(db, 'tournaments', id))
    return snap.exists() ? (snap.data() as Tournament) : null
  }
  return readLocalAll()[id] ?? null
}

export async function saveTournament(tournament: Tournament): Promise<void> {
  const updated = { ...tournament, updatedAt: new Date().toISOString() }

  // Always mirror locally for backup / offline
  const all = readLocalAll()
  all[updated.id] = updated
  writeLocalAll(all)

  if (isFirebaseConfigured) {
    const db = getDb()
    if (db) {
      await setDoc(doc(db, 'tournaments', updated.id), updated)
    }
  }
}

export function subscribeTournamentBySlug(
  slug: string,
  onData: (tournament: Tournament | null) => void,
): Unsubscribe {
  if (isFirebaseConfigured) {
    const db = getDb()
    if (db) {
      const q = query(collection(db, 'tournaments'), where('slug', '==', slug))
      return onSnapshot(q, (snap) => {
        if (snap.empty) {
          onData(null)
          return
        }
        onData(snap.docs[0].data() as Tournament)
      })
    }
  }

  // Local polling fallback
  let active = true
  const tick = () => {
    if (!active) return
    onData(getLocalBySlug(slug))
  }
  tick()
  const id = window.setInterval(tick, 800)
  window.addEventListener('storage', tick)
  return () => {
    active = false
    window.clearInterval(id)
    window.removeEventListener('storage', tick)
  }
}

export function exportTournamentJson(tournament: Tournament): string {
  return JSON.stringify(tournament, null, 2)
}

export async function importTournamentJson(raw: string): Promise<Tournament> {
  const data = JSON.parse(raw) as Tournament
  if (!data.id || !data.slug || !data.name) {
    throw new Error('JSON de torneio inválido.')
  }
  await saveTournament(data)
  return data
}
