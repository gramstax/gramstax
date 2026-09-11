import {log} from "gramstax"
import {BotCore} from "./core/bot"
import {Env} from "./env"

// Entry point for the Echo bot.
class Index {
  static async run() {
    log.info(`Starting 4-echo bot...`)

    new BotCore({
      deploy: Env.TELEGRAM_BOT_DEPLOY,
      token: Env.TELEGRAM_BOT_TOKEN,
      log: log
    })
  }
}

Index.run()
