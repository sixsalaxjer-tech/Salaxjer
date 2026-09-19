// Optional password-based backup encryption (spec section 18: "Backup ที่มีข้อมูลส่วนบุคคลควรมี
// ตัวเลือกเข้ารหัสด้วยรหัสผ่าน"). AES-GCM with a PBKDF2-derived key; nothing here is persisted —
// the password only ever lives in memory for the duration of the export/import call.

const PBKDF2_ITERATIONS = 210_000

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export interface EncryptedPayload {
  salt: string
  iv: string
  ciphertext: string
}

export async function encryptWithPassword(plaintext: string, password: string): Promise<EncryptedPayload> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    new TextEncoder().encode(plaintext)
  )
  return {
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertextBuffer))
  }
}

export async function decryptWithPassword(payload: EncryptedPayload, password: string): Promise<string> {
  const salt = fromBase64(payload.salt)
  const iv = fromBase64(payload.iv)
  const key = await deriveKey(password, salt)
  try {
    const plainBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      fromBase64(payload.ciphertext) as BufferSource
    )
    return new TextDecoder().decode(plainBuffer)
  } catch {
    throw new Error('DECRYPTION_FAILED')
  }
}
