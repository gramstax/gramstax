import {log} from "gramstax"
import {BotCore} from "./core/bot"
import {Env} from "./env"

class Index {
  static async run() {
    log.info(`Starting 8-newsletter bot...`)

    new BotCore({
      deploy: Env.TELEGRAM_BOT_DEPLOY,
      token: Env.TELEGRAM_BOT_TOKEN,
      log: log
    })
  }
}

Index.run()
