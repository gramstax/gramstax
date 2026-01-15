import {env} from "./env"
import {log} from "./utils/log"
import {BotCore} from "./core/bot"

log.info(`Starting interactive-menu bot...`)

new BotCore({
  deploy: env.TELEGRAM_BOT_DEPLOY,
  token: env.TELEGRAM_BOT_TOKEN,
  log: true,
  optionsPage: {
    // Keep callback payloads short for menus.
    shortCallbackData: true
  }
})
