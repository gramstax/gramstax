import {BotCore} from "./core/bot"
import {Env} from "./env"
import {LogHe} from "./helpers/log"

class Index {
  static async run() {
    LogHe.info(`Starting 7-crud bot...`)

    new BotCore({
      deploy: Env.TELEGRAM_BOT_DEPLOY,
      token: Env.TELEGRAM_BOT_TOKEN,
      log: LogHe
    })
  }
}

Index.run()
