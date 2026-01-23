import {Ctx} from "gramstax"
import type {CrudStore} from "~/store/crud"

// Shared context for CRUD pages.
export class CtxCore extends Ctx {
  crudStore: CrudStore

  constructor(params: ConstructorParameters<typeof Ctx>[0] & {crudStore: CrudStore}) {
    super({...params})
    this.crudStore = params.crudStore
  }
}
