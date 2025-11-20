import { CtxCore } from "../core/ctx"
import { StartPage } from "./start"

export class TestPhotoPage extends CtxCore {
  public kb() {
    return this.buildInlineKeyboard((kb, arr) => {
      return (
        kb
          //
          .text(arr[0], StartPage.data.callbackData(`3`))
      )
    })
  }

  public async callback() {
    const kb = this.kb()
    await this.editPhoto(kb)
  }

  public static template = `
    <base>
      <keyboard lang="en" type="inline">Back</keyboard>
      <keyboard lang="id" type="inline">Kembali</keyboard>

      <media lang="en" type="photo" src="https://damar.sbs/_next/image?url=%2Fprofile.png&w=1920&q=100">
        This is a caption text for media <b>photo</b>
      </media>

      <media lang="id" type="photo" src="https://damar.sbs/_next/image?url=%2Fprofile.png&w=1920&q=100">
        This is a caption text for media <b>photo</b>
      </media>
    </base>
  `
}
