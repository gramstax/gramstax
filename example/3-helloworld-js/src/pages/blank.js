import {PageBase} from "../base/page.js"

export class BlankPage extends PageBase {
  async handleCallbackQueryData() {
    await this.answerCallbackQuery()
  }

  static template = ``
}
