import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'

const SECRET  = new TextEncoder().encode(process.env.JWT_SECRET!)
const COOKIE  = 'passion_session'
const MAX_AGE = 60 * 60 * 8 // 8 hours

export type Session = { username: string }

/**
 * Verify credentials against ADMIN1_USERNAME/ADMIN1_PASSWORD env vars.
 * Add ADMIN2_USERNAME/ADMIN2_PASSWORD etc. for more admins.
 * Passwords are compared with bcrypt if the env value looks like a hash,
 * or plain-text compared otherwise (useful for quick dev setup).
 */
export async function login(username: string, password: string): Promise<boolean> {
  let i = 1
  while (true) {
    const envUser = process.env[`ADMIN${i}_USERNAME`]
    const envPass = process.env[`ADMIN${i}_PASSWORD`]
    if (!envUser || !envPass) break

    if (envUser === username) {
      // Support both bcrypt hashes ($2b$...) and plain-text passwords
      const valid = envPass.startsWith('$2b$') || envPass.startsWith('$2a$')
        ? await bcrypt.compare(password, envPass)
        : envPass === password
      if (!valid) return false

      const token = await new SignJWT({ username })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('8h')
        .sign(SECRET)

      ;(await cookies()).set(COOKIE, token, {
        httpOnly: true,   // JS cannot read this cookie
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: MAX_AGE,
      })

      return true
    }
    i++
  }
  return false
}

/** Read and cryptographically verify the session JWT */
export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return { username: payload.username as string }
  } catch {
    return null
  }
}

/** Clear the session cookie */
export async function logout() {
  ;(await cookies()).set(COOKIE, '', { maxAge: 0 })
}
