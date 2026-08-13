import {GuardBase} from "~/base/guard"
import {StatusPage} from "~/pages/status"
import {UserNameNotFoundPage} from "~/pages/username-notfound"

export class UserGuard extends GuardBase {
  async _catch(err: Error | unknown, func: string) {
    await new StatusPage(this).berror.show(func, err)
    return null
  }

  async ensureUsername() {
    try {
      if (!this.from?.username || this.from?.username.length === 0) {
        await new UserNameNotFoundPage(this).bdefault.show()
        return null
      }
      return {status: true}
    } catch (err) {
      return await this._catch(err, `ensureValid`)
    }
  }
}
