import {GuardBase} from "~/base/guard"
import {GeneralStatusPage} from "~/pages/general-status"
import {UserNameNotFoundPage} from "~/pages/username-notfound"

export class UserGuard extends GuardBase {
  async _catch(err: any, func: any, isEdit: boolean) {
    await new GeneralStatusPage(this).berror.show(func, err, isEdit)
    return null
  }

  async ensureUsername(edit: boolean) {
    try {
      if (!this.userName || this.userName.length == 0) {
        await new UserNameNotFoundPage(this).bdefault.show(edit)
        return null
      }
      return {status: true}
    } catch (err) {
      return await this._catch(err, `ensureValid`, edit)
    }
  }
}
