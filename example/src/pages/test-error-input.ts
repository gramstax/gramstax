import { PageBase } from "~/base"
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
      <keyboard type="inline">Cancel</keyboard>
      <keyboard lang="en" type="inline">Cancel</keyboard>
      <keyboard lang="id" type="inline">Batal</keyboard>

      <message>
        Please input text (will error because not have session)
      </message>

      <message lang="en">
        Please input text (will error because not have session)
      </message>

      <message lang="id">
        Tolong masukan text (akan menerima kesalahan karena tidak ada sesi)
      </message>
    </base>
  `
}
