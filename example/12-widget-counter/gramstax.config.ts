import type {GramstaxConfig} from "gramstax"

const ttlMs = Number(process.env.CACHE_SESSION_TTL)

const config: GramstaxConfig = {
  token: process.env.BOT_TOKEN,
  deploy: process.env.BOT_DEPLOY ?? `polling`,
  cacheSession: {
    store: process.env.CACHE_SESSION_STORE ?? `memory`,
    ttlMs: Number.isFinite(ttlMs) && ttlMs >= 0 ? ttlMs : 4 * 60 * 60 * 1000,
    namespace: process.env.CACHE_SESSION_NAMESPACE ?? `s`
  },
  log: true,
  optionsPage: undefined,
  optionsDeploy: {polling: {maxRetries: undefined, queue: undefined}},
  mediaRoots: undefined,
  botConfig: undefined,
  autoRetry: undefined,
  autoRetryOptions: undefined,
  rateLimit: undefined,
  throttle: undefined,
  updateTimeoutMs: undefined,
  skipDuplicateUpdate: undefined,
  maxTextLength: undefined,
  statusServerPort: undefined,
  statusServerHostname: undefined,
  cacheKeyboard: undefined,
  templateManager: undefined,
  sessionLock: undefined
}

export default config
