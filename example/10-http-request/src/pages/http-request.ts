import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import {HttpService} from "~/services/http"
import type {IHttpResponse} from "~/services/http"

class Base {
  static method = `s-method`
  static url = `s-url`
  static token = `s-token`
  static body = `s-body`
  static success = `s-success`
  static warnInvalid = `w-invalid`
  static warnNetwork = `w-network`
}

class Helper {
  static escapeHtml(text: string): string {
    return text.replace(/&/g, `&amp;`).replace(/</g, `&lt;`).replace(/>/g, `&gt;`)
  }

  static formatHeaders(headers: Record<string, string>, limit = 10): string {
    const entries = Object.entries(headers)
    const shown = entries.slice(0, limit)
    const lines = shown.map(([key, value]) => `  <code>${Helper.escapeHtml(key)}: ${Helper.escapeHtml(value)}</code>`)
    if (entries.length > limit) {
      lines.push(`  ... and ${entries.length - limit} more`)
    }
    return lines.join(`\n`)
  }

  static formatBody(body: string): string {
    const truncated = body.length > 200 ? body.slice(0, 200) + `\n... [${body.length} total chars]` : body
    return Helper.escapeHtml(truncated)
  }

  static renderBody(result: IHttpResponse, viewMode: string): string {
    if (viewMode === `raw`) {
      return Helper.formatBody(result.rawBody)
    }
    const prettyBody = result.contentType.includes(`application/json`) ? HttpService.formatJson(result.rawBody) : result.rawBody
    return Helper.formatBody(prettyBody)
  }

  static buildMethodKeyboard(ctx: HttpRequestPage) {
    return ctx.inlineKeyboardT(
      [
        HttpRequestPage.data.callbackData(`GET`),
        HttpRequestPage.data.callbackData(`POST`),
        HttpRequestPage.data.callbackData(`PUT`),
        HttpRequestPage.data.callbackData(`DELETE`),
        HttpRequestPage.data.callbackData(`PATCH`),
        StartPage.data.callbackData()
      ],
      `3`,
      Base.method
    )
  }

  static buildUrlKeyboard(ctx: HttpRequestPage) {
    return ctx.inlineKeyboardT([HttpRequestPage.data.callbackData(`_back`), StartPage.data.callbackData()], `2`, Base.url)
  }

  static buildBodyKeyboard(ctx: HttpRequestPage) {
    return ctx.inlineKeyboardT([HttpRequestPage.data.callbackData(`_back`), StartPage.data.callbackData()], `2`, Base.body)
  }

  static buildTokenKeyboard(ctx: HttpRequestPage) {
    return ctx.inlineKeyboardT([HttpRequestPage.data.callbackData(`skip_token`), StartPage.data.callbackData()], `2`, Base.token)
  }

  static buildHomeKeyboard(ctx: HttpRequestPage) {
    return ctx.inlineKeyboardT([StartPage], `1`, Base.warnNetwork)
  }

  static buildSuccessKeyboard(ctx: HttpRequestPage, viewMode: string) {
    const toggleLabel = viewMode === `formatted` ? `🔁 Raw` : `🔁 Formatted`
    return ctx.inlineKeyboardT([HttpRequestPage.data.callbackData(`toggle_view`), StartPage], `2`, Base.success, {toggleLabel})
  }
}

// HTTP Request page with multi-step flow: method selection → URL input → body input (if needed) → result.
export class HttpRequestPage extends PageBase {
  static data = this.buildData((action: string) => [action])

  async handleCallbackData() {
    await this.bmethod.show()
  }

  async handleArgsCallbackData() {
    const args = this.callbackDataArgs
    const action = args[0]
    if (!action) return
    if (action === `_back`) {
      await this.bmethod.show()
    } else if (action === `skip_token`) {
      await this.btoken.process(null)
    } else if (action === `toggle_view`) {
      await this.bsuccess.process()
    } else {
      await this.burl.show(action)
    }
  }

  async handleFreeText() {
    const input = this.msgText.trim()
    const session = await this.getSession()
    const step = session?.params?.httpStep as string | undefined
    if (!step || step === `method` || step === `done`) {
      await this.burl.process(input, `GET`)
    } else if (step === `url`) {
      await this.burl.process(input, session.params?.httpMethod as string, true)
    } else if (step === `token`) {
      await this.btoken.process(input)
    } else if (step === `body`) {
      await this.bbody.process(input)
    }
  }

  bmethod = {
    show: async () => {
      await this.clearSession()
      await this.edit(Helper.buildMethodKeyboard(this), {}, Base.method)
    }
  }

  burl = {
    show: async (method: string) => {
      await this.setSessionFreeText({httpStep: `url`, httpMethod: method})
      await this.edit(Helper.buildUrlKeyboard(this), {method}, Base.url)
    },
    process: async (input: string, method: string, showToken = false) => {
      if (!HttpService.isValidUrl(input)) {
        await this.edit(Helper.buildUrlKeyboard(this), {url: Helper.escapeHtml(input)}, Base.warnInvalid)
        return
      }

      if (showToken) {
        await this.btoken.show(method, input)
      } else if (HttpService.needsBody(method)) {
        await this.bbody.show(method, input)
      } else {
        try {
          const result = await HttpService.request(method, input)
          await this.setSessionFreeText({httpStep: `done`, httpResult: result, httpViewMode: `formatted`})
          await this.bsuccess.show(result, `formatted`)
        } catch (error) {
          await this.clearSession()
          const message = error instanceof Error ? error.message : String(error)
          await this.bwarnNetwork.show(input, message)
        }
      }
    }
  }

  btoken = {
    show: async (method: string, url: string) => {
      await this.setSessionFreeText({httpStep: `token`, httpMethod: method, httpUrl: url})
      await this.edit(Helper.buildTokenKeyboard(this), {method, url: Helper.escapeHtml(url)}, Base.token)
    },
    process: async (token: string | null) => {
      const session = await this.getSession()
      const method = session?.params?.httpMethod as string
      const url = session?.params?.httpUrl as string
      if (!method || !url) {
        await this.clearSession()
        return await this.bmethod.show()
      }

      if (HttpService.needsBody(method)) {
        await this.setSessionFreeText({httpStep: `body`, httpMethod: method, httpUrl: url, httpToken: token})
        await this.bbody.show(method, url)
      } else {
        const headers: Record<string, string> = {}
        if (token) {
          headers[`Authorization`] = `Bearer ${token}`
        }
        try {
          const result = await HttpService.request(method, url, undefined, headers)
          await this.setSessionFreeText({httpStep: `done`, httpResult: result, httpViewMode: `formatted`})
          await this.bsuccess.show(result, `formatted`, true)
        } catch (error) {
          await this.clearSession()
          const msg = error instanceof Error ? error.message : String(error)
          await this.bwarnNetwork.show(url, msg, true)
        }
      }
    }
  }

  bbody = {
    show: async (method: string, url: string) => {
      await this.setSessionFreeText({httpStep: `body`, httpMethod: method, httpUrl: url})
      const da = {method, url: Helper.escapeHtml(url)}
      await this.edit(Helper.buildBodyKeyboard(this), da, Base.body)
    },
    process: async (body: string) => {
      const session = await this.getSession()
      const method = session?.params?.httpMethod as string
      const url = session?.params?.httpUrl as string
      const token = session?.params?.httpToken as string | undefined
      if (!url) {
        await this.clearSession()
        return await this.bmethod.show()
      }

      const headers: Record<string, string> = {}
      if (token) headers[`Authorization`] = `Bearer ${token}`
      try {
        const result = await HttpService.request(method, url, body, headers)
        await this.setSessionFreeText({httpStep: `done`, httpResult: result, httpViewMode: `formatted`})
        await this.bsuccess.show(result, `formatted`)
      } catch (error) {
        await this.clearSession()
        const message = error instanceof Error ? error.message : String(error)
        await this.bwarnNetwork.show(url, message)
      }
    }
  }

  bsuccess = {
    show: async (result: IHttpResponse, viewMode = `formatted`, isEdit = false) => {
      const kb = Helper.buildSuccessKeyboard(this, viewMode)
      const emoji = result.status >= 200 && result.status < 300 ? `✅` : result.status >= 400 ? `❌` : `⚠️`
      const headersText = Helper.formatHeaders(result.headers)
      const bodyPreview = Helper.renderBody(result, viewMode)
      const da = {
        status: result.status,
        statusText: result.statusText,
        duration: result.duration,
        method: result.method,
        emoji,
        headersText,
        bodyPreview
      }
      if (isEdit) {
        await this.edit(kb, da, Base.success)
      } else {
        await this.reply(kb, da, Base.success)
      }
    },
    process: async () => {
      const session = await this.getSession()
      const result = session?.params?.httpResult as IHttpResponse | undefined
      if (!result) return
      const currentView = (session?.params?.httpViewMode as string) || `formatted`
      const newView = currentView === `formatted` ? `raw` : `formatted`
      await this.setSessionFreeText({...session?.params, httpViewMode: newView})
      await this.bsuccess.show(result, newView, true)
    }
  }

  bwarnInvalid = {
    show: async (url: string) => {
      await this.edit(Helper.buildUrlKeyboard(this), {url: Helper.escapeHtml(url)}, Base.warnInvalid)
    }
  }

  bwarnNetwork = {
    show: async (url: string, errorMessage: string, edit = false) => {
      const kb = Helper.buildHomeKeyboard(this)
      const da = {url: Helper.escapeHtml(url), errorMessage: Helper.escapeHtml(errorMessage)}
      if (edit) {
        await this.edit(kb, da, Base.warnNetwork)
      } else {
        await this.reply(kb, da, Base.warnNetwork)
      }
    }
  }

  static template = `
    <g-base id="${Base.method}">
      <g-keyboard type="inline">GET, POST, PUT, DELETE, PATCH, ✖️ Cancel</g-keyboard>
      <g-keyboard type="inline" lang="id">GET, POST, PUT, DELETE, PATCH, ✖️ Batal</g-keyboard>
      <g-message>
        🌐 New HTTP Request

        Select an HTTP method:
      </g-message>
      <g-message lang="id">
        🌐 Permintaan HTTP Baru

        Pilih metode HTTP:
      </g-message>
    </g-base>
    <g-base id="${Base.url}">
      <g-keyboard type="inline">⬅️ Back, ✖️ Cancel</g-keyboard>
      <g-keyboard type="inline" lang="id">⬅️ Kembali, ✖️ Batal</g-keyboard>
      <g-message>
        🌐 {{method}} Request

        Send me a valid URL (starting with http:// or https://) and I will fetch it.

        Example: https://jsonplaceholder.typicode.com/posts/1
      </g-message>
      <g-message lang="id">
        🌐 Permintaan {{method}}

        Kirim URL yang valid (diawali dengan http:// atau https://) dan saya akan mengambilnya.

        Contoh: https://jsonplaceholder.typicode.com/posts/1
      </g-message>
    </g-base>
    <g-base id="${Base.token}">
      <g-keyboard type="inline">⏭️ Skip, ✖️ Cancel</g-keyboard>
      <g-keyboard type="inline" lang="id">⏭️ Lewati, ✖️ Batal</g-keyboard>
      <g-message>
        🔑 Bearer Token (optional)

        Method: {{method}}
        URL: <code>{{url}}</code>

        Send me a Bearer token, or tap Skip to continue without one.
      </g-message>
      <g-message lang="id">
        🔑 Token Bearer (opsional)

        Metode: {{method}}
        URL: <code>{{url}}</code>

        Kirim token Bearer, atau ketuk Lewati untuk melanjutkan tanpa token.
      </g-message>
    </g-base>
    <g-base id="${Base.body}">
      <g-keyboard type="inline">⬅️ Back, ✖️ Cancel</g-keyboard>
      <g-keyboard type="inline" lang="id">⬅️ Kembali, ✖️ Batal</g-keyboard>
      <g-message>
        📝 {{method}} Request Body

        URL: <code>{{url}}</code>

        Send me the request body as JSON:
      </g-message>
      <g-message lang="id">
        📝 Isi Permintaan {{method}}

        URL: <code>{{url}}</code>

        Kirim isi permintaan sebagai JSON:
      </g-message>
    </g-base>
    <g-base id="${Base.success}">
      <g-keyboard type="inline">{{toggleLabel}}, 🏠 Home</g-keyboard>
      <g-keyboard type="inline" lang="id">{{toggleLabel}}, 🏠 Beranda</g-keyboard>
      <g-message>
        {{emoji}} [{{method}}] {{status}} {{statusText}}

        ⏱ {{duration}}ms

        📋 Headers:
        {{headersText}}

        📄 Body:
        <pre>{{bodyPreview}}</pre>
      </g-message>
      <g-message lang="id">
        {{emoji}} [{{method}}] {{status}} {{statusText}}

        ⏱ {{duration}}ms

        📋 Header:
        {{headersText}}

        📄 Isi:
        <pre>{{bodyPreview}}</pre>
      </g-message>
    </g-base>
    <g-base id="${Base.warnInvalid}">
      <g-keyboard type="inline">⬅️ Back, ✖️ Cancel</g-keyboard>
      <g-keyboard type="inline" lang="id">⬅️ Kembali, ✖️ Batal</g-keyboard>
      <g-message>
        ⚠️ Invalid URL

        The URL you sent does not appear to be valid. Make sure it starts with http:// or https://.

        You sent: <code>{{url}}</code>
      </g-message>
      <g-message lang="id">
        ⚠️ URL Tidak Valid

        URL yang Anda kirim tampaknya tidak valid. Pastikan diawali dengan http:// atau https://.

        Anda mengirim: <code>{{url}}</code>
      </g-message>
    </g-base>
    <g-base id="${Base.warnNetwork}">
      ${this.kbk.home()}
      <g-message>
        ❌ Request Failed

        Could not reach the URL. Please check the address and try again.

        URL: <code>{{url}}</code>

        Error: {{errorMessage}}
      </g-message>
      <g-message lang="id">
        ❌ Permintaan Gagal

        Tidak dapat menjangkau URL. Periksa alamat dan coba lagi.

        URL: <code>{{url}}</code>

        Galat: {{errorMessage}}
      </g-message>
    </g-base>
  `
}
