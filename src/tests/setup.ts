import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'

// jsdom does not implement SubtleCrypto; fall back to Node's WebCrypto implementation so
// backup checksum/encryption code (which uses crypto.subtle) works under Vitest.
if (!globalThis.crypto?.subtle) {
  const nodeCrypto = await import('node:crypto')
  Object.defineProperty(globalThis, 'crypto', { value: nodeCrypto.webcrypto, configurable: true })
}
