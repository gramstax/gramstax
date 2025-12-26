import { PageBase } from "~/base/page"
import { StartPage } from "./start"

export class TestErrorInputPage extends PageBase {
  public kb() {
    return this.inlineKeyboard((kb, arr) => {
      return kb.text(arr[0]!, StartPage.data.callbackData())
    })
  }

  public async callback() {
    await this.edit(this.kb())
  }

  public async textFree() {
    // will not call this function because there is no session and will give an error automatically thrown to GeneralErrorInputNotFoundPage
  }

  public static template = /*jsx*/ `
    <base>
      <import src="start" base="ikb-cancel" />

      <message>Please input text (will error because not have session)</message>
      <message lang="id">Tolong masukan text (akan menerima kesalahan karena tidak ada sesi)</message>
    </base>
  `
}
