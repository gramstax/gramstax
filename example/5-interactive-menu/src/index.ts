import {log} from "gramstax"
import {env} from "./env"
import {BotCore} from "./core/bot"

// Entry point for the interactive menu bot.
log.info(`Starting Interactive Menu bot...`)

new BotCore({
  deploy: env.TELEGRAM_BOT_DEPLOY,
  token: env.TELEGRAM_BOT_TOKEN,
  log: true,
  optionsPage: {
    // Keep callback payloads short for menus.
    shortCallbackData: true
  }
})
