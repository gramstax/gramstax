import { BasePage } from "./page"
import type { Ctx } from "../core/ctx"

export abstract class BaseGuard extends BasePage {
  public pageData: { name: string; callbackData: (...args: any) => string | any } // because Guard not have static data like Page and public data so we assign to new property
  public constructor(page: { ctx: Ctx; data?: any }) {
    super(page.ctx)
    this.pageData = page.data
  }
}
