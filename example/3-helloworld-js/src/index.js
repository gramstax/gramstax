import {env} from "./env"
import {log} from "./utils/log"
import {BotCore} from "./core/bot"

log.info(`Starting helloworld-js bot...`)

new BotCore({
  deploy: env.TELEGRAM_BOT_DEPLOY,
  token: env.TELEGRAM_BOT_TOKEN,
  log: true
})
