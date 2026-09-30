import {join} from "node:path"

export class Env {
  static DB_PATH = join(import.meta.dir, `../data`) as string
}
