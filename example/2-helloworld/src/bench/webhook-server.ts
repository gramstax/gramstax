import {log, MockTelegramServer} from "gramstax"
import {BotCore} from "../core/bot"

const queueEnabled = process.env.WEBHOOK_QUEUE === `1` || process.env.WEBHOOK_QUEUE === `true`
const maxQueueSize = Number(process.env.WEBHOOK_QUEUE_SIZE ?? `5000`)
const workerCount = Number(process.env.WEBHOOK_WORKERS ?? `8`)
const perChatConcurrency = Number(process.env.WEBHOOK_CHAT_CONCURRENCY ?? `1`)

const run = async () => {
  const mockServer = new MockTelegramServer()
  await mockServer.start()

  const botCore = new BotCore({
    deploy: `webhook`,
    optionsDeploy: {
      webhook: {
        url: `http://127.0.0.1:3000/webhook/${Math.round(Math.random() * 10 ** 10)}`,
        queue: queueEnabled
          ? {
              enabled: true,
              maxQueueSize,
              workerCount,
              perChatConcurrency,
              blockWhenFull: true
            }
          : {enabled: false}
      }
    },
    // Test-only Telegram bot token. It has already been revoked through
    // @BotFather and grants access to nothing — it is here so this bench server
    // can boot without a local .env. Set BOT_TOKEN to your own token before
    // pointing this at the real Bot API; never commit a live credential here.
    token: process.env.BOT_TOKEN ?? `7815352851:AAGdLYBm8GKF7f26zi7cUmxsKM2jZseqgfI`,
    log: true,
    botConfig: {
      client: {
        apiRoot: mockServer.apiRoot
      }
    }
  })

  const res1 = await mockServer.sendText(`/start`)
  log.info(`Mock Telegram /start (commandText) response:`)
  console.log(res1)

  const res2 = await mockServer.sendCallbackQuery(`start`)
  log.info(`Mock Telegram start (callbackQueryData) response.`)
  const replyMarkup = (res2[0]?.body as {reply_markup?: {inline_keyboard?: unknown}} | undefined)?.reply_markup
  console.log(replyMarkup?.inline_keyboard)

  await botCore.stop()
  await mockServer.stop()
}

run()
