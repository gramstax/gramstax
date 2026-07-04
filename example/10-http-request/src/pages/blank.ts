import {PageBase} from "~/base/page"

export class BlankPage extends PageBase {
  async handleCallbackData() {
    await this.callbackQueryAnswer()
  }

  static template = ``
}
