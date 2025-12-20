import { env } from "./env"
import { BotCore } from "./core"
import { MainThread } from "./thread"

new MainThread(() => {
  new BotCore({
    deploy: env.TELEGRAM_BOT_DEPLOY,
    token: env.TELEGRAM_BOT_TOKEN,
    log: true
  })
})
