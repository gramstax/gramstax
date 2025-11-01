import { GuardBase } from "../base/guard"
import { GeneralErrorPage } from "../pages/general-error"
import { UserNameNotFoundPage } from "../pages/username-notfound"

export class UserGuard extends GuardBase {
  public async ensureValid(isEdit: boolean) {
    try {
      if (!this.username || this.username.length == 0) {
        await new UserNameNotFoundPage(this).transition(isEdit)
        return null
      }

      return { status: true }
    } catch (err) {
      await new GeneralErrorPage(this).transition(this.constructor.name, `ensureValid`, err, isEdit)
      return null
    }
  }
}
