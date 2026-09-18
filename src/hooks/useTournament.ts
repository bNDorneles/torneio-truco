import { useCallback, useEffect, useState } from 'react'
import type { Tournament } from '../types/tournament'
import { saveTournament, subscribeTournamentBySlug } from '../lib/storage'

export function useTournament(slug: string | undefined) {
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) {
      setTournament(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const unsub = subscribeTournamentBySlug(slug, (data) => {
      setTournament(data)
      setLoading(false)
      if (!data) setError('Torneio não encontrado.')
    })
    return unsub
  }, [slug])

  const update = useCallback(async (next: Tournament) => {
    setTournament(next)
    await saveTournament(next)
  }, [])

  return { tournament, loading, error, update, setTournament }
}
