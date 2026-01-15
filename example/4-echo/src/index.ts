import {env} from "./env"
import {log} from "./utils/log"
import {BotCore} from "./core/bot"

// Entry point for the Echo bot.
log.info(`Starting echo bot...`)

new BotCore({
  deploy: env.TELEGRAM_BOT_DEPLOY,
  token: env.TELEGRAM_BOT_TOKEN,
  log: true
})
