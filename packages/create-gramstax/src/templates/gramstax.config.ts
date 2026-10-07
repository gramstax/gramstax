import type {GramstaxConfig} from "gramstax"

const config: GramstaxConfig = {
  token: process.env.BOT_TOKEN ?? ``,
  deploy: process.env.BOT_DEPLOY ?? `polling`,
  cacheSession: {
    store: process.env.CACHE_SESSION_STORE ?? `memory`,
    ttlMs: Number(process.env.CACHE_SESSION_TTL) ?? 4 * 60 * 60 * 1000,
    namespace: process.env.CACHE_SESSION_NAMESPACE ?? `s`
  },
  log: {
    override: {
      module: `./src/helpers/log.ts`, 
      export: `LogHe`
    }
  },
  optionsPage: {
    shortCallbackQueryData: true
  },
  // webhook/serverless secrets come ONLY from the BOT_WEBHOOK_SECRET runtime binding
  // (set via `wrangler secret put BOT_WEBHOOK_SECRET`), never as literals in this file
  optionsDeploy: {
    polling: {maxRetries: undefined},
    webhook: {url: undefined, secretToken: undefined, queue: undefined},
    serverless: undefined,
    raw: undefined,
    test: undefined
  },
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
