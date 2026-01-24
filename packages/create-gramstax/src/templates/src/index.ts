import {env} from "./env"
import {log} from "./utils/log"
import {BotCore} from "./core/bot"
import {CacheExternal} from "gramstax"

log.success(`Bot started..`)

const run = () => {
  new BotCore({
    token: env.TELEGRAM_BOT_TOKEN,
    deploy: env.TELEGRAM_BOT_DEPLOY,
    cacheSession: new CacheExternal(env.TELEGRAM_CACHE_SESSION, 4 * 60 * 60 * 1000, `s`), // 4 hours
    optionsPage: {
      shortCallbackData: true
    }
  })
}

run()
