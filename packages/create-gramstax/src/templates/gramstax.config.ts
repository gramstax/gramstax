import type {GramstaxConfig} from "gramstax"

const config: GramstaxConfig = {
  // real value lives in .env — never commit a real token here
  token: process.env.TELEGRAM_BOT_TOKEN ?? ``,
  deploy: process.env.TELEGRAM_BOT_DEPLOY ?? `polling`,
  cacheSession: {store: process.env.TELEGRAM_CACHE_SESSION ?? `memory`, ttlMs: 4 * 60 * 60 * 1000, namespace: `s`},
  log: {module: `./src/helpers/log.ts`, export: `LogHe`},
  optionsPage: {shortCallbackQueryData: true},
  optionsDeploy: {adapter: undefined, name: undefined, url: undefined},
  mediaRoots: undefined,
  botConfig: undefined,
  webhookQueue: undefined,
  autoRetry: undefined,
  autoRetryOptions: undefined,
  rateLimit: undefined,
  throttle: undefined,
  updateTimeoutMs: undefined,
  skipDuplicateUpdate: undefined,
  webhookSecretToken: undefined,
  maxTextLength: undefined,
  statusServerPort: undefined,
  statusServerHostname: undefined,
  pollingMaxRetries: undefined,
  cacheKeyboard: undefined,
  templateManager: undefined,
  sessionLock: undefined
}

export default config
