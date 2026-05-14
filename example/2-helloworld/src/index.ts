import {Env} from "./env"
import {LogHe} from "./helpers/log"
import {BotCore} from "./core/bot"
// import {MockTelegramServer} from "gramstax"

class Index {
  static async run() {
    LogHe.info(`Starting 2-helloworld bot...`)

    // const mockServer = new MockTelegramServer({token: Env.TELEGRAM_BOT_TOKEN})
    // await mockServer.start()

    new BotCore({
      deploy: Env.TELEGRAM_BOT_DEPLOY,
      token: Env.TELEGRAM_BOT_TOKEN, // test token bot, its already revoke
      log: LogHe
      // botConfig: {
      //   client: {
      //     apiRoot: mockServer.apiRoot
      //   }
      // }
    })
  }
}

Index.run()
