import {PageBase} from "~/base/page"

export class StartBlankPage extends PageBase {
  async handleCallbackQueryData() {
    await this.answerCallbackQuery()
  }

  static template = ``
}
