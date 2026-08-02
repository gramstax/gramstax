import {CacheExternal} from "gramstax"
import {BotCore} from "./core/bot"
import {Env} from "./env"
import {LogHe} from "./helpers/log"

class Index {
  static async run() {
    LogHe.info(`Bot started..`)

    new BotCore({
      log: LogHe,
      token: Env.TELEGRAM_BOT_TOKEN,
      deploy: Env.TELEGRAM_BOT_DEPLOY,
      cacheSession: new CacheExternal(Env.TELEGRAM_CACHE_SESSION, 4 * 60 * 60 * 1000, `s`), // 4 hours
      optionsPage: {
        shortCallbackQueryData: true
      }
    })
  }
}

Index.run()
