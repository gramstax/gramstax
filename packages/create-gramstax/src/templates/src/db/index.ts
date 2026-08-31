import {LmdbEnv} from "@gramstax/lmdb"
import {UserRepository} from "./repositories/user"
import {UserSchema} from "./schema/user"

export class Db extends LmdbEnv {
  userService!: UserRepository
  private _ready: Promise<void>

  constructor(storePath: string) {
    super({path: storePath, maxDbs: 10, compression: true, encoding: `msgpack`})
    this._ready = this._init()
  }

  private async _init() {
    const users = this.register(UserSchema)
    this.userService = new UserRepository(users)
  }

  async ready() {
    await this._ready
  }
}
