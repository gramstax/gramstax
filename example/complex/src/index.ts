import {env} from "./env"
import {BotCore} from "./core/bot"
import {IncrementJob} from "./jobs/increment"

await IncrementJob.launchWorker([5000]) // 5s
new BotCore({
  deploy: env.TELEGRAM_BOT_DEPLOY,
  token: env.TELEGRAM_BOT_TOKEN,
  log: true
})
