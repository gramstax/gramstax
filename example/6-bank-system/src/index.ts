import {log} from "gramstax"
import {env} from "./env"
import {BotCore} from "./core/bot"

// Entry point for the Bank System bot.
log.info(`Starting bank-system bot...`)

new BotCore({
  deploy: env.TELEGRAM_BOT_DEPLOY,
  token: env.TELEGRAM_BOT_TOKEN,
  log: true
})
