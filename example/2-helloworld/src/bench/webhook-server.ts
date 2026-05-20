import {Env} from "../env"
import {LogHe} from "../helpers/log"
import {BotCore} from "../core/bot"
import {MockTelegramServer} from "gramstax"

const queueEnabled = process.env.WEBHOOK_QUEUE === `1` || process.env.WEBHOOK_QUEUE === `true`
const maxQueueSize = Number(process.env.WEBHOOK_QUEUE_SIZE ?? `5000`)
const workerCount = Number(process.env.WEBHOOK_WORKERS ?? `8`)
const perChatConcurrency = Number(process.env.WEBHOOK_CHAT_CONCURRENCY ?? `1`)

const run = async () => {
  const mockServer = new MockTelegramServer()
  await mockServer.start()

  const botCore = new BotCore({
    deploy: `webhook:http://127.0.0.1:3000/webhook/${Math.round(Math.random() * 10 ** 10)}`,
    token: Env.TELEGRAM_BOT_TOKEN,
    log: true,
    botConfig: {
      client: {
        apiRoot: mockServer.apiRoot
      }
    },
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

  const res1 = await mockServer.sendText(`/start`)
  LogHe.info(`Mock Telegram /start (commandText) response:`)
  console.log(res1)

  const res2 = await mockServer.sendCallbackQuery(`start`)
  LogHe.info(`Mock Telegram start (callbackQueryData) response.`)
  console.log(res2[0]?.body?.reply_markup?.inline_keyboard)

  await botCore.stop()
  await mockServer.stop()
}

run()
