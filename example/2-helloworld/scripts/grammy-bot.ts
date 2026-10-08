import {Bot} from "grammy"

const API_ROOT = process.env.BENCH_API_ROOT ?? `http://127.0.0.1:56660`
const MODE = (process.env.BENCH_MODE ?? `polling`) as `polling` | `webhook`
const PORT = Number(process.env.BENCH_BOT_PORT ?? `0`)

const bot = new Bot(`bench-token`, {client: {apiRoot: API_ROOT}})

// Mirrors StartPage in src/pages/start.ts: one reply carrying an inline keyboard.
bot.command(`start`, async (ctx) => {
  await ctx.reply(`Hello World!\nTime now: ${new Date().toString()}`, {
    reply_markup: {inline_keyboard: [[{text: `Refresh`, callback_data: `1`}]]}
  })
})

if (MODE === `webhook`) {
  await bot.init()
  const url = `http://127.0.0.1:${PORT}/bench-hook`
  await bot.api.setWebhook(url)

  Bun.serve({
    port: PORT,
    fetch: async (request) => {
      const {pathname} = new URL(request.url)
      if (request.method === `GET` && pathname === `/health`) {
        return new Response(`ok`)
      }
      if (request.method !== `POST` || pathname !== `/bench-hook`) {
        return new Response(`not found`, {status: 404})
      }
      await bot.handleUpdate(await request.json())
      return new Response(`ok`)
    }
  })
} else {
  await bot.start({drop_pending_updates: false})
}

process.stdout.write(`READY ${MODE} queue=off\n`)

const shutdown = async (): Promise<void> => {
  await bot.stop().catch(() => undefined)
  process.exit(0)
}
process.on(`SIGINT`, () => void shutdown())
process.on(`SIGTERM`, () => void shutdown())