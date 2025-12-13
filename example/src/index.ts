import { env } from "./env"
import { BotCore } from "./core/bot"
import { MainThread } from "./thread/main"

new MainThread(() => {
  new BotCore({
    deploy: env.TELEGRAM_BOT_DEPLOY,
    token: env.TELEGRAM_BOT_TOKEN,
    log: true
  })
})
