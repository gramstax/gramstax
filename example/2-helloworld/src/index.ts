import {BotCore} from "./core/bot"
import {Env} from "./env"
import {LogHe} from "./helpers/log"

class Index {
  static async run() {
    LogHe.info(`Starting 2-helloworld bot...`)

    new BotCore({
      deploy: Env.TELEGRAM_BOT_DEPLOY,
      token: Env.TELEGRAM_BOT_TOKEN, // test token bot, its already revoke
      log: LogHe
    })
  }
}

Index.run()
