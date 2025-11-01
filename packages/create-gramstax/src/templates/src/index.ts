import { log } from "./utils/log"
import { BotCore } from "./core/bot"
import { MainThread } from "./threads/main"
import { CacheExternal } from "gramstax"

new MainThread(() => {
  log.success(`Bot started..`)

  const token = process.env.BOT_TOKEN as string
  const deploy = process.env.BOT_DEPLOY as string
  const cache = process.env.CACHE_SESSION as string
  new BotCore({
    token,
    deploy,
    cacheSession: new CacheExternal(cache, `session`, 24 * 60 * 60 * 1000)
  })
})
