import FingerprintJS from '@fingerprintjs/fingerprintjs'

let cachedFingerprint: string | null = null

export async function getBrowserFingerprint(): Promise<string> {
  if (cachedFingerprint) {
    return cachedFingerprint
  }

  // Initialize an agent at application startup
  const fp = await FingerprintJS.load()

  // Get the visitor identifier
  const result = await fp.get()

  // Use the fingerprint as a visitor identifier
  cachedFingerprint = result.visitorId

  return cachedFingerprint
} 