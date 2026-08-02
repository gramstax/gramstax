import {BotCore} from "./core/bot"
import {Env} from "./env"
import {LogHe} from "./helpers/log"

class Index {
  static async run() {
    LogHe.info(`Starting 1-complex bot...`)

    new BotCore({
      deploy: Env.TELEGRAM_BOT_DEPLOY,
      token: Env.TELEGRAM_BOT_TOKEN,
      log: LogHe,
      optionsPage: {
        shortCallbackQueryData: true
      }
    })
  }
}

Index.run()
