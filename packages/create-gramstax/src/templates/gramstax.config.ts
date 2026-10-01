import type {GramstaxConfig} from "gramstax"

const config: GramstaxConfig = {
  // real value lives in .env — never commit a real token here
  token: process.env.BOT_TOKEN ?? ``,
  deploy: process.env.BOT_DEPLOY ?? `polling`,
  cacheSession: {
    store: process.env.CACHE_SESSION ?? `memory`, 
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
  // deploy branch options — only the branch matching `deploy` may carry values.
  // webhook/serverless secrets come ONLY from the BOT_WEBHOOK_SECRET runtime binding
  // (set via `wrangler secret put BOT_WEBHOOK_SECRET`), never as literals in this file
  optionsDeploy: {
    // polling: local dev (maxRetries: -1 = infinite)
    polling: {maxRetries: undefined},
    // webhook: production (url required; secretToken via BOT_WEBHOOK_SECRET env, never a literal — config value sets the webhook)
    webhook: {url: undefined, secretToken: undefined, queue: undefined},
    // serverless: edge (adapter + url required; secretToken via BOT_WEBHOOK_SECRET env, never a literal — config value sets the webhook, edge reads the binding)
    serverless: {adapter: undefined, name: undefined, url: undefined, secretToken: undefined},
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
