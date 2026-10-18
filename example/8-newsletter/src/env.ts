import {join} from "node:path"

export class Env {
  static DB_PATH = join(import.meta.dir, `../data`) as string
  // The default admin id below is a real Telegram user id that has been public since
  // this file was committed, and it is kept only so the example boots out of the box.
  // It grants nothing: replace it with your own id from @userinfobot, or export
  // BOT_ADMIN_IDS, before running this against a real bot.
  static BOT_ADMIN_IDS = JSON.parse(`[840754970]`) as number[]
}
