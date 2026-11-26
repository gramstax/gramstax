import {PageBase} from "~/base/page"

export class BlankPage extends PageBase {
  static data = this.buildData()

  async handleCallbackQueryData() {
    await this.answerCallbackQuery()
  }

  static template = ``
}
