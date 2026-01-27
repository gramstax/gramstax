import {env} from "./env"
import {log} from "./utils/log"
import {BotCore} from "./core/bot"
import {createMockTelegramServer} from "./telegram-mock-server"

log.info(`Starting 2-helloworld bot...`)

const {apiRoot, close} = createMockTelegramServer(env.TELEGRAM_BOT_TOKEN)
process.once(`SIGINT`, () => close())
process.once(`SIGTERM`, () => close())

new BotCore({
  deploy: env.TELEGRAM_BOT_DEPLOY,
  token: env.TELEGRAM_BOT_TOKEN, // test token bot, its already revoke
  log: true,
  botConfig: {client: {apiRoot}}
})
