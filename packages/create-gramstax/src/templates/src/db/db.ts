import {LmdbEnv, LmdbEnvSub} from "@gramstax/lmdb"
import {UserSchema, UserService} from "./repositories/user"

export class Db extends LmdbEnv {
  userService!: UserService
  private _ready: Promise<void>

  constructor(storePath: string) {
    super({path: storePath, maxDbs: 10, compression: true, encoding: `json`})
    this._ready = this._init()
  }

  private async _init() {
    const users: LmdbEnvSub<typeof UserSchema> = this.register(UserSchema)
    this.userService = new UserService(users)
  }

  async ready() {
    await this._ready
  }
}
