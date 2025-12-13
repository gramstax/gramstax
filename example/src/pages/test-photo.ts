import { PageBase } from "../base/page"
import { StartPage } from "./start"

export class TestPhotoPage extends PageBase {
  public kb() {
    return this.inlineKeyboard((kb, arr) => {
      return kb.text(arr[0]!, StartPage.data.callbackData(`3`))
    })
  }

  public async callback() {
    await this.editPhoto(this.kb())
  }

  public static template = /*jsx*/ `
    <base>
      <keyboard type="inline">Back</keyboard>
      <keyboard lang="en" type="inline">Back</keyboard>
      <keyboard lang="id" type="inline">Kembali</keyboard>

      <media type="photo" src="https://www.w3schools.com/html/img_girl.jpg">
        This is a caption text for media <b>photo</b>
      </media>

      <media lang="en" type="photo" src="https://www.w3schools.com/html/img_girl.jpg">
        This is a caption text for media <b>photo</b>
      </media>

      <media lang="id" type="photo" src="https://www.w3schools.com/html/img_girl.jpg">
        Ini adalah caption text untuk media <b>foto</b>
      </media>
    </base>
  `
}
