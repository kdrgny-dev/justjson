// Publish providers — each deploys the rendered static site to the user's own
// hosting account, browser-only, storing nothing on our side. Netlify uses an
// implicit-OAuth popup; the rest take a pasted API token (no secret-less OAuth
// exists for them). Cloudflare Pages is intentionally absent: its API blocks
// browser CORS, so it can't be reached without a backend proxy.
import { github } from './github'
import { netlify } from './netlify'
import { vercel } from './vercel'

export interface PublishResult {
  url: string
  /** stable handle to republish the SAME site (site id, project id, or owner/repo) */
  siteId: string
}

// Thrown when a globally-unique address is already taken (Netlify subdomains).
// The UI catches this and asks for another name — no silent random suffix.
export class NameTakenError extends Error {
  constructor(public readonly takenName: string) {
    super(`name taken: ${takenName}`)
    this.name = 'NameTakenError'
  }
}

export type Auth =
  | { kind: 'oauth'; connect: () => Promise<string> }
  | { kind: 'token'; tokenUrl: string; help: string }

export interface Provider {
  id: string
  name: string
  auth: Auth
  /** shown after the address field, e.g. ".netlify.app" or ".vercel.app" */
  suffix?: string
  publish(
    files: Record<string, string>,
    siteName: string,
    token: string,
    existingSiteId?: string,
  ): Promise<PublishResult>
}

export const PROVIDERS: Provider[] = [netlify, vercel, github]

export function getProvider(id: string): Provider {
  return PROVIDERS.find((p) => p.id === id) ?? netlify
}

// Pasted tokens live in sessionStorage (cleared on tab close) — same lifetime
// as the Netlify OAuth token. We never persist them.
const tokenKey = (id: string) => `pub_token_${id}`
export const getToken = (id: string) => sessionStorage.getItem(tokenKey(id)) || ''
export const setToken = (id: string, t: string) => sessionStorage.setItem(tokenKey(id), t.trim())
export const clearToken = (id: string) => sessionStorage.removeItem(tokenKey(id))
