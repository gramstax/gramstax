import {log} from "gramstax"
import {BotCore} from "./core/bot"
import {Env} from "./env"

class Index {
  static async run() {
    // Entry point for the Bank System bot.
    log.info(`Starting 6-bank-system bot...`)

    new BotCore({
      deploy: Env.TELEGRAM_BOT_DEPLOY,
      token: Env.TELEGRAM_BOT_TOKEN,
      log: log
    })
  }
}

Index.run()
