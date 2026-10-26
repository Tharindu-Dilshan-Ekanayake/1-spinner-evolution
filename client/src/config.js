/**
 * Where the Colyseus game server lives.
 *
 * - VITE_SERVER_URL wins when set (see .env.example).
 * - In dev, the server runs next to Vite on port 3000.
 * - In production the server also serves the built client, so it's the same origin.
 */
export const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.DEV
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : window.location.origin)

/** `?debug` in the URL exposes window.__game for the perf probe and console poking. */
export const DEBUG = import.meta.env.DEV || new URLSearchParams(window.location.search).has('debug')
