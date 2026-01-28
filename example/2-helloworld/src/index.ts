import {env} from "./env"
import {log} from "./utils/log"
import {BotCore} from "./core/bot"
import {MockTelegramServer} from "gramstax"

log.info(`Starting 2-helloworld bot...`)

const mockServer = new MockTelegramServer({token: env.TELEGRAM_BOT_TOKEN})
await mockServer.start()
process.once(`SIGINT`, () => mockServer.stop())
process.once(`SIGTERM`, () => mockServer.stop())

new BotCore({
  deploy: env.TELEGRAM_BOT_DEPLOY,
  token: env.TELEGRAM_BOT_TOKEN, // test token bot, its already revoke
  log: true,
  botConfig: {client: {apiRoot: mockServer.apiRoot}}
})
