import type {GramstaxConfig} from "gramstax"

const ttlMs = Number(process.env.CACHE_SESSION_TTL)
const deploy = process.env.BOT_DEPLOY ?? `polling`

const config: GramstaxConfig = {
  // real value lives in .env — never commit a real token here
  token: process.env.BOT_TOKEN,
  deploy,
  cacheSession: {
    store: process.env.CACHE_SESSION_STORE ?? `memory`,
    ttlMs: Number.isFinite(ttlMs) && ttlMs >= 0 ? ttlMs : 4 * 60 * 60 * 1000,
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
  // serverless secret duality — config value sets the webhook + local start, edge reads the BOT_WEBHOOK_SECRET binding (set via `wrangler secret put BOT_WEBHOOK_SECRET`, same value both sides), never a literal here
  // The serverless branch only exists when this project actually deploys
  // serverless: a declared serverless branch is a declaration of intent,
  // so its url + secretToken are validated on every config load. Gating it
  // on BOT_DEPLOY keeps a plain local build/start working with no secrets
  // in the environment, while a serverless deploy without them still fails
  // loudly on the missing url/secretToken.
  optionsDeploy: {
    ...(deploy === `serverless`
      ? {
          serverless: {
            "cloudflare-mod": {
              name: process.env.BOT_DEPLOY_NAME,
              url: process.env.BOT_DEPLOY_URL,
              secretToken: process.env.BOT_WEBHOOK_SECRET ?? ``
            }
          }
        }
      : {})
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
