import {join} from "node:path"

export class Env {
  static DB_PATH = join(import.meta.dir, `../data`) as string
  static TELEGRAM_ADMIN_IDS = JSON.parse(`[840754970]`) as number[]
}
