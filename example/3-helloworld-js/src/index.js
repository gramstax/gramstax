import {Env} from "./env.js"
import {LogHe} from "./helpers/log.js"
import {BotCore} from "./core/bot.js"

class Index {
  static async run() {
    LogHe.info(`Starting 3-helloworld-js bot...`)

    new BotCore({
      deploy: Env.TELEGRAM_BOT_DEPLOY,
      token: Env.TELEGRAM_BOT_TOKEN,
      log: LogHe
    })
  }
}

Index.run()
