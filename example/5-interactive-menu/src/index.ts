import {Env} from "./env"
import {LogHe} from "./helpers/log"
import {BotCore} from "./core/bot"

class Index {
  static async run() {
    LogHe.info(`Starting 5-interactive-menu bot...`)

    new BotCore({
      deploy: Env.TELEGRAM_BOT_DEPLOY,
      token: Env.TELEGRAM_BOT_TOKEN,
      log: LogHe,
      optionsPage: {
        // Keep callback data intent short for menus.
        shortCallbackQueryData: true
      }
    })
  }
}

Index.run()
