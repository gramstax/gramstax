import type {GramstaxConfig} from "gramstax"

const config: GramstaxConfig = {
  token: process.env.TELEGRAM_BOT_TOKEN ?? `7815352851:AAGdLYBm8GKF7f26zi7cUmxsKM2jZseqgfI`,
  deploy: `polling`,
  cacheSession: undefined,
  log: true,
  optionsPage: undefined,
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
