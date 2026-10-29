import { getSDK, safeCall, toUnsubscribe } from './sdk'

/**
 * Which Boxity environment (prod, stage or local) the game is running in, as the
 * PLATFORM tells it - never worked out from our own hostname, the referrer or a build
 * flag, so one build runs unchanged everywhere.
 *
 * Every Boxity URL in the client is built from this. The SDK knows the answer once it
 * has loaded (from window.BLOXITY_ENV, which Boxity injects into the pages it serves,
 * or from the portal handshake when embedded); before that, window.BLOXITY_ENV is read
 * directly. Nothing told means prod.
 */

/** The only place the production URLs are written down: the fallback when nothing was told. */
const PROD = Object.freeze({
  env: 'prod',
  apiUrl: 'https://api.bloxity.io',
  playUrl: 'https://play.bloxity.io',
  portalUrl: 'https://bloxity.io',
  staticUrl: 'https://static.bloxity.io',
})

const KEYS = ['apiUrl', 'playUrl', 'portalUrl', 'staticUrl']

/** A told environment, if it is complete; null otherwise. */
function told(value) {
  if (!value || typeof value !== 'object') return null
  if (!KEYS.every((k) => typeof value[k] === 'string' && value[k])) return null
  const out = { env: typeof value.env === 'string' ? value.env : 'prod' }
  for (const k of KEYS) out[k] = value[k].replace(/\/+$/, '')
  return out
}

/** @returns {{ env: 'prod'|'stage'|'local', apiUrl: string, playUrl: string, portalUrl: string, staticUrl: string }} */
export function bloxityEnv() {
  const sdk = getSDK()
  const fromSdk = sdk && typeof sdk.environment === 'function' ? told(safeCall(sdk.environment.bind(sdk))) : null
  return fromSdk || told(typeof window !== 'undefined' ? window.BLOXITY_ENV : null) || PROD
}

/** Calls `fn` when the portal handshake tells the SDK a different environment after init. */
export function onEnvironmentChanged(sdk, fn) {
  return toUnsubscribe(safeCall(sdk?.onEnvironmentChanged?.bind(sdk), fn))
}
