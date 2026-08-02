import {BotCore} from "./core/bot"
import {Env} from "./env"
import {LogHe} from "./helpers/log"

// Entry point for the HTTP Request bot.
class Index {
  static async run() {
    LogHe.info(`Starting 10-http-request bot...`)

    new BotCore({
      deploy: Env.TELEGRAM_BOT_DEPLOY,
      token: Env.TELEGRAM_BOT_TOKEN,
      log: LogHe
    })
  }
}

Index.run()
