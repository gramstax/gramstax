import {log} from "gramstax"
import {env} from "./env"
import {BotCore} from "./core/bot"

// Entry point for the Echo bot.
log.info(`Starting Echo bot...`)

new BotCore({
  deploy: env.TELEGRAM_BOT_DEPLOY,
  token: env.TELEGRAM_BOT_TOKEN,
  log: true
})
