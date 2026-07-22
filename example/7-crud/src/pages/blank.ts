import {PageBase} from "~/base/page"

export class BlankPage extends PageBase {
  async handleCallbackQueryData() {
    await this.answerCallbackQuery()
  }

  static template = ``
}
