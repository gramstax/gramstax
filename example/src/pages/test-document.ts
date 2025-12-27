import { PageBase } from "~/base/page"
import { StartPage } from "./start"

export class TestDocumentPage extends PageBase {
  public kb() {
    return this.inlineKeyboard((kb, arr) => {
      return kb.text(arr[0]!, StartPage.data.callbackData(`3`))
    })
  }

  public async callback() {
    await this.editDocument(this.kb())
  }

  public static template = /*jsx*/ `
    <base>
      ${this.KbCom.back()}
      <media type="document" src="https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf">Caption text for media <b>document</b></media>
      <media lang="id" type="document" src="https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf">Caption text untuk media <b>dokumen</b></media>
    </base>
  `
}
