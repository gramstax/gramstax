import {BotCore} from "./core/bot"
import {Env} from "./env"
import {LogHe} from "./helpers/log"

// Entry point for the Echo bot.
class Index {
  static async run() {
    LogHe.info(`Starting 4-echo bot...`)

    new BotCore({
      deploy: Env.TELEGRAM_BOT_DEPLOY,
      token: Env.TELEGRAM_BOT_TOKEN,
      log: LogHe
    })
  }
}

Index.run()
