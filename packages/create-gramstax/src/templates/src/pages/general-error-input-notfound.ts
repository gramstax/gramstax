import { PageBase } from "~/base/page"
import { StartPage } from "./start"

export class GeneralErrorInputNotFoundPage extends PageBase {
  public kb() {
    return this.inlineKeyboard((kb, arr) => {
      return kb.text(arr[0]!, StartPage.data.callbackData())
    })
  }

  public async transition() {
    await this.edit(this.kb())
  }

  public static template = /*jsx*/ `
    <base>
      <import src="start" base="ikb-home" />

      <message><b>❌ Not Found</b></message>
      <message lang="it"><b>❌ Non Trovato</b></message>
      <message lang="id"><b>❌ Tidak Ditemukan</b></message>
    </base>
  `
}
