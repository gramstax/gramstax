import {Env} from "./env"
import {LogHe} from "./helpers/log"
import {BotCore} from "./core/bot"
import {MockTelegramServer} from "gramstax"

LogHe.info(`Starting 2-helloworld bot...`)

const mockServer = new MockTelegramServer({token: Env.TELEGRAM_BOT_TOKEN})
await mockServer.start()
process.once(`SIGINT`, () => mockServer.stop())
process.once(`SIGTERM`, () => mockServer.stop())

new BotCore({
  deploy: Env.TELEGRAM_BOT_DEPLOY,
  token: Env.TELEGRAM_BOT_TOKEN, // test token bot, its already revoke
  log: true,
  botConfig: {client: {apiRoot: mockServer.apiRoot}}
})
