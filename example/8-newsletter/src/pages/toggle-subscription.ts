import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class ToggleSubscriptionPage extends PageBase {
  async callback() {
    const subscribed = await this.db.isSubscribed(this.userId)
    if (subscribed) {
      await this.db.unsubscribe(this.userId)
    } else {
      await this.db.subscribe(this.userId, {
        userName: this.userName,
        fullName: this.userFullName,
        language: this.userLanguage
      })
    }

    await new StartPage(this).show(true)
  }
}
