import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class TestDocumentPage extends PageBase {
  kb() {
    return this.ikb((k, a) => {
      return k.text(a[0]!, StartPage.data.callback(`3`))
    })
  }

  async callback() {
    await this.editDocument(this.kb())
  }

  static template = `
    <base>
      ${this.kbk.back()}
      <media type="document" src="https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf">Caption text for media <b>document</b></media>
      <media lang="id" type="document" src="https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf">Caption text untuk media <b>dokumen</b></media>
    </base>
  `
}
