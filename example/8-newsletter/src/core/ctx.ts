import {Ctx} from "gramstax"
import type {MainDb} from "~/db/main"

export class CtxCore extends Ctx {
  db: MainDb

  constructor(params: ConstructorParameters<typeof Ctx>[0] & {db: MainDb}) {
    super({...params})
    this.db = params.db
  }
}
