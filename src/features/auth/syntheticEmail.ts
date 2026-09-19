import { APP_CONFIG } from '@/shared/constants/config'

/**
 * Supabase Auth requires an email-shaped identifier, but this app only wants a username +
 * password (no real inbox, no confirmation email, no email-sending rate limits — see
 * docs/CLOUD_SYNC.md). This derives a stable, syntactically-valid email from a username by
 * appending a fixed domain; Supabase never sends anything there as long as "Confirm email" is
 * off, so the domain does not need to exist or receive mail.
 */
export function toSyntheticEmail(username: string): string {
  const normalized = username
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._-]/g, '')
  return `${normalized}@${APP_CONFIG.authUsernameDomain}`
}
