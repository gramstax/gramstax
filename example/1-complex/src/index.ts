import {env} from "./env"
import {log} from "./utils/log"
import {BotCore} from "./core/bot"
import {IncrementJob} from "./jobs/increment"

log.info(`Starting complex bot...`)

await IncrementJob.launchWorker([5000]) // 5s
new BotCore({
  deploy: env.TELEGRAM_BOT_DEPLOY,
  token: env.TELEGRAM_BOT_TOKEN,
  log: true,
  optionsPage: {
    shortCallbackData: true
  }
})
