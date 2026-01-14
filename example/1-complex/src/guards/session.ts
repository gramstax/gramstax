import {GuardBase} from "~/base/guard"

export class SessionGuard extends GuardBase {
  async ensureTextFree() {
    try {
      const {method, params} = this.session
      if (this.validateSessionTextFree(method, this.temp.data.name) === false) {
        return null
      }
      return params
    } catch {
      return null
    }
  }
}
