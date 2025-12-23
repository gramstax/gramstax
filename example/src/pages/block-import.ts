import { PageBase } from "~/base/page"
import { StartPage } from "./start"

export class BlockImportPage extends PageBase {
  public kb() {
    return this.inlineKeyboard((kb, arr) => {
      return kb.text(arr[0]!, StartPage.data.callbackData())
    })
  }

  public async callback() {
    await this.edit(this.kb())
  }

  public static template = /*jsx*/ `
    <base>
      <import src="start" base="ikb-back" block="keyboard" section="all" />
      <import src="start" base="msg-block-import" block="message" section="all" />
    </base>
  `
}
