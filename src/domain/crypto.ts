async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  return sha256Hex(`${salt}:${password}`)
}

export async function createPasswordHash(password: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.randomUUID().replace(/-/g, '')
  const hash = await hashPassword(password, salt)
  return { hash, salt }
}

export async function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string,
): Promise<boolean> {
  const hash = await hashPassword(password, salt)
  return hash === expectedHash
}
