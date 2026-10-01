import type {GramstaxConfig} from "gramstax"

const config: GramstaxConfig = {
  token: process.env.BOT_TOKEN,
  deploy: process.env.BOT_DEPLOY ?? `polling`,
  cacheSession: process.env.CACHE_SESSION ?? `memory`,
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
