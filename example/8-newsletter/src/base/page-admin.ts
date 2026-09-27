import {AdminGuard} from "~/guards/admin"
import {PageBase} from "./page"

export abstract class PageAdminBase extends PageBase {
  async hookBeforeRoute() {
    return AdminGuard.isAdmin(this)
  }
}
