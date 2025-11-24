import { env } from "./env"
import { log } from "./utils/log"
import { BotCore } from "./core/bot"
import { MainThread } from "./threads/main"
import { CacheExternal } from "gramstax"

new MainThread(() => {
  log.success(`Bot started..`)

  new BotCore({
    token: env.BOT_TOKEN,
    deploy: env.BOT_DEPLOY,
    cacheSession: new CacheExternal(env.CACHE_SESSION, `session`, 24 * 60 * 60 * 1000)
  })
})
