import {env} from "./env"
import {logUt} from "./utils/log"
import {BotCore} from "./core/bot"
import {CacheExternal} from "gramstax"

logUt.success(`Bot started..`)

new BotCore({
  token: env.BOT_TOKEN,
  deploy: env.BOT_DEPLOY,
  cacheSession: new CacheExternal(env.CACHE_SESSION, `session`, 24 * 60 * 60 * 1000)
})
