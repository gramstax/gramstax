import {Env} from "./env"
import {LogHe} from "./helpers/log"
import {BotCore} from "./core/bot"
import {IncrementJob} from "./jobs/increment"

class Index {
  static async run() {
    LogHe.info(`Starting 1-complex bot...`)

    await IncrementJob.launchWorker([5000]) // 5s
    new BotCore({
      deploy: Env.TELEGRAM_BOT_DEPLOY,
      token: Env.TELEGRAM_BOT_TOKEN,
      log: LogHe,
      optionsPage: {
        shortCallbackData: true
      }
    })
  }
}

Index.run()
