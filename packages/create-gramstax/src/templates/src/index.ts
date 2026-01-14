import {env} from "./env"
import {logUt} from "./utils/log"
import {BotCore} from "./core/bot"
import {CacheExternal} from "gramstax"

logUt.success(`Bot started..`)

new BotCore({
  token: env.TELEGRAM_BOT_TOKEN,
  deploy: env.TELEGRAM_BOT_DEPLOY,
  cacheSession: new CacheExternal(env.TELEGRAM_CACHE_SESSION, `session`, 24 * 60 * 60 * 1000),
  optionsPage: {
    shortCallbackData: true
  }
})
