import {log} from "gramstax"
import {BotCore} from "./core/bot.js"
import {Env} from "./env.js"

class Index {
  static async run() {
    log.info(`Starting 3-helloworld-js bot...`)

    new BotCore({
      deploy: Env.TELEGRAM_BOT_DEPLOY,
      token: Env.TELEGRAM_BOT_TOKEN,
      log: log
    })
  }
}

Index.run()
