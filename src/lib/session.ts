const SESSION_PREFIX = 'torneio-truco:org:'

export function setOrganizerSession(tournamentId: string) {
  sessionStorage.setItem(`${SESSION_PREFIX}${tournamentId}`, '1')
}

export function clearOrganizerSession(tournamentId: string) {
  sessionStorage.removeItem(`${SESSION_PREFIX}${tournamentId}`)
}

export function isOrganizerSession(tournamentId: string): boolean {
  return sessionStorage.getItem(`${SESSION_PREFIX}${tournamentId}`) === '1'
}
