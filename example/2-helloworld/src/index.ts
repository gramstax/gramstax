import {join} from "node:path"
import {TemplateManager} from "gramstax"
import {BotCore} from "~/core/bot"

const API_ROOT = process.env.BENCH_API_ROOT ?? `http://127.0.0.1:56660`
const MODE = (process.env.BENCH_MODE ?? `polling`) as `polling` | `webhook`
const QUEUE_ENABLED = process.env.BENCH_QUEUE === `1`
const PORT = Number(process.env.BENCH_BOT_PORT ?? `0`)
const WORKERS = Math.max(1, Number(process.env.BENCH_WORKERS ?? `8`))
const PER_CHAT = Math.max(0, Number(process.env.BENCH_PER_CHAT ?? `1`))

const queue = {
  enabled: QUEUE_ENABLED,
  workerCount: WORKERS,
  perChatConcurrency: PER_CHAT,
  maxQueueSize: 50_000
}

// Queue-off polling carries no `optionsDeploy` at all — that is the shape a freshly
// scaffolded project actually boots with.
const optionsDeploy =
  MODE === `webhook`
    ? {webhook: {url: `http://127.0.0.1:${PORT}/bench-hook`, secretToken: `bench-secret`, ...(QUEUE_ENABLED ? {queue} : {})}}
    : QUEUE_ENABLED
      ? {polling: {queue}}
      : undefined

const bot = new BotCore({
  deploy: MODE,
  token: `bench-token`,
  log: process.env.BENCH_LOG === `1`,
  templateManager: new TemplateManager({path: [join(import.meta.dir, `pages`)]}),
  botConfig: {client: {apiRoot: API_ROOT}},
  ...(optionsDeploy === undefined ? {} : {optionsDeploy})
})

process.stdout.write(`READY ${MODE} queue=${QUEUE_ENABLED ? `on` : `off`}\n`)

const shutdown = async (): Promise<void> => {
  await bot.stop().catch(() => undefined)
  process.exit(0)
}
process.on(`SIGINT`, () => void shutdown())
process.on(`SIGTERM`, () => void shutdown())
