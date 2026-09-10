import {LmdbEnv} from "@gramstax/lmdb"
import {UserRepository} from "./repositories/user"
import {UserSchema} from "./schema/user"

export class Db extends LmdbEnv {
  user!: UserRepository

  constructor(storePath: string) {
    super({path: storePath, maxDbs: 10, compression: true, encoding: `msgpack`})
  }

  init() {
    if (this.user) return
    this.user = new UserRepository(this.register(UserSchema))
  }
}
