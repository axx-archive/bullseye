import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { existsSync, readFileSync, appendFileSync, writeFileSync } from 'fs'
import path from 'path'

const ALGORITHM = 'aes-256-gcm'

function generateAndPersistKey(): string {
  const key = randomBytes(32).toString('hex')
  const envLocalPath = path.resolve(process.cwd(), '.env.local')

  if (existsSync(envLocalPath)) {
    const contents = readFileSync(envLocalPath, 'utf8')
    if (!contents.includes('ENCRYPTION_KEY=')) {
      appendFileSync(envLocalPath, `\nENCRYPTION_KEY=${key}\n`)
    }
  } else {
    writeFileSync(envLocalPath, `ENCRYPTION_KEY=${key}\n`)
  }

  process.env.ENCRYPTION_KEY = key
  console.log('Generated ENCRYPTION_KEY and saved to .env.local')
  return key
}

function getEncryptionKey(): Buffer {
  let key = process.env.ENCRYPTION_KEY

  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY must be set in production environment')
    }

    // Check if .env.local already has a key (process might not have loaded it)
    const envLocalPath = path.resolve(process.cwd(), '.env.local')
    if (existsSync(envLocalPath)) {
      const contents = readFileSync(envLocalPath, 'utf8')
      const match = contents.match(/^ENCRYPTION_KEY=(.+)$/m)
      if (match) {
        key = match[1].trim()
        process.env.ENCRYPTION_KEY = key
      }
    }

    // Still no key — generate one
    if (!key) {
      key = generateAndPersistKey()
    }
  }

  const buffer = Buffer.from(key, 'hex')
  if (buffer.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 32-byte hex string (64 hex characters)')
  }
  return buffer
}

export function encrypt(plaintext: string): { ciphertext: string; iv: string } {
  const key = getEncryptionKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')

  return {
    ciphertext: encrypted + ':' + authTag,
    iv: iv.toString('hex'),
  }
}

export function decrypt(ciphertext: string, iv: string): string {
  const key = getEncryptionKey()
  const [encrypted, authTag] = ciphertext.split(':')
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'))
  decipher.setAuthTag(Buffer.from(authTag, 'hex'))

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
