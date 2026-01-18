import {env} from "./env"
import {log} from "./utils/log"
import {BotCore} from "./core/bot"

// Entry point for the Bank System bot.
log.info(`Starting 6-bank-system bot...`)

new BotCore({
  deploy: env.TELEGRAM_BOT_DEPLOY,
  token: env.TELEGRAM_BOT_TOKEN,
  log: true
})
