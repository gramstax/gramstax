import { PageBase } from "~/base/page"
import { StartPage } from "./start"

export class BlockImportPage extends PageBase {
  public kb() {
    return this.inlineKeyboard((kb, arr) => {
      return kb.text(arr[0]!, StartPage.data.callbackData())
    })
  }

  public async callback() {
    await this.edit(this.kb(), {
      number: Math.random()
    })
  }

  public static template = /*jsx*/ `
    <base>
      <import src="start" base="for-block-import" />
    </base>
  `
}
