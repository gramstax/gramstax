import {Ctx} from "gramstax"
import type {Db} from "~/db/db"

// Shared context for CRUD pages.
export class CtxCore extends Ctx {
  db: Db

  constructor(params: ConstructorParameters<typeof Ctx>[0] & {db: Db}) {
    super({...params})
    this.db = params.db
  }
}
