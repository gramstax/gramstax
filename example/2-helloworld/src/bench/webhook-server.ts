import {Env} from "../env"
import {LogHe} from "../helpers/log"
import {BotCore} from "../core/bot"
import {MockTelegramServer} from "gramstax"

const queueEnabled = process.env.WEBHOOK_QUEUE === `1` || process.env.WEBHOOK_QUEUE === `true`
const maxQueueSize = Number(process.env.WEBHOOK_QUEUE_SIZE ?? `5000`)
const workerCount = Number(process.env.WEBHOOK_WORKERS ?? `8`)
const perChatConcurrency = Number(process.env.WEBHOOK_CHAT_CONCURRENCY ?? `1`)

const webhookUrl = `http://127.0.0.1:3000/webhook`

const mockServer = new MockTelegramServer({token: Env.TELEGRAM_BOT_TOKEN})
await mockServer.start()
process.once(`SIGINT`, () => mockServer.stop())
process.once(`SIGTERM`, () => mockServer.stop())

LogHe.info(`Starting webhook benchmark server...`)
LogHe.info(`Webhook URL: ${webhookUrl}`)
LogHe.info(`Queue enabled: ${queueEnabled}`)

new BotCore({
  deploy: `webhook:${webhookUrl}`,
  token: Env.TELEGRAM_BOT_TOKEN,
  log: true,
  botConfig: {client: {apiRoot: mockServer.apiRoot}},
  webhookQueue: queueEnabled
    ? {
        enabled: true,
        maxQueueSize,
        workerCount,
        perChatConcurrency,
        blockWhenFull: true
      }
    : {enabled: false}
})
