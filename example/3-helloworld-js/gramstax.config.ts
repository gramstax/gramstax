import type {GramstaxConfig} from "gramstax"

const config: GramstaxConfig = {
  token: process.env.BOT_TOKEN,
  deploy: process.env.BOT_DEPLOY ?? `polling`,
  cacheSession: {
    store: process.env.CACHE_SESSION_STORE ?? `memory`,
    ttlMs: Number(process.env.CACHE_SESSION_TTL) ?? 4 * 60 * 60 * 1000,
    namespace: process.env.CACHE_SESSION_NAMESPACE ?? `s`
  },
  log: true,
  optionsPage: undefined,
  optionsDeploy: {polling: {}},
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
