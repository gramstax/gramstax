import {LmdbEnv} from "@gramstax/lmdb"
import {UserRepo} from "./repositories/user"

export class Db extends LmdbEnv {
  user!: UserRepo
  private _ready: Promise<void>

  constructor(storePath: string) {
    super({path: storePath, maxDbs: 10, compression: true, encoding: `json`})
    this._ready = this._init()
  }

  private async _init() {
    this.user = this.register(UserRepo)
  }

  async ready() {
    await this._ready
  }
}
