import type {GramstaxConfig} from "gramstax"

const config: GramstaxConfig = {
  // real value lives in .env — never commit a real token here
  token: process.env.TELEGRAM_BOT_TOKEN,
  deploy: process.env.TELEGRAM_BOT_DEPLOY ?? `polling`,
  cacheSession: {
    store: process.env.TELEGRAM_CACHE_SESSION ?? `memory`,
    ttlMs: 4 * 60 * 60 * 1000,
    namespace: `s`
  },
  log: {
    module: `./src/helpers/log.ts`,
    export: `LogHe`
  },
  optionsPage: {
    shortCallbackQueryData: true
  },
  // serverless secret duality — config value sets the webhook + local start, edge reads the TELEGRAM_WEBHOOK_SECRET binding (set via `wrangler secret put TELEGRAM_WEBHOOK_SECRET`, same value both sides), never a literal here
  optionsDeploy: {
    serverless: {
      adapter: process.env.TELEGRAM_BOT_DEPLOY_ADAPTER,
      name: process.env.TELEGRAM_BOT_DEPLOY_NAME,
      url: process.env.TELEGRAM_BOT_DEPLOY_URL,
      secretToken: process.env.TELEGRAM_WEBHOOK_SECRET ?? ``
    }
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
