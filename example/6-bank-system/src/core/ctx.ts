import {Ctx} from "gramstax"
import type {BankStore} from "./store"

// Shared context for bank-system pages.
export class CtxCore extends Ctx {
  bankStore: BankStore

  constructor(params: ConstructorParameters<typeof Ctx>[0] & {bankStore: BankStore}) {
    super({...params})
    this.bankStore = params.bankStore ?? (params as any).ct?.bankStore
  }
}
