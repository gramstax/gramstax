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
  // Build method-selection inline keyboard: GET | POST | PUT / DELETE | PATCH | Cancel
  static buildMethodKeyboard(ctx: HttpRequestPage) {
    return ctx.inlineKeyboardT(
      [
        HttpRequestPage.data.callbackData(`GET`),
        HttpRequestPage.data.callbackData(`POST`),
        HttpRequestPage.data.callbackData(`PUT`),
        HttpRequestPage.data.callbackData(`DELETE`),
        HttpRequestPage.data.callbackData(`PATCH`),
        StartPage.data.callbackData() // Cancel → StartPage (clears session)
      ],
      `3`,
      Base.method
    )
  }

  // Build URL-input inline keyboard: ⬅️ Back | ✖️ Cancel
  static buildUrlKeyboard(ctx: HttpRequestPage) {
    return ctx.inlineKeyboardT([HttpRequestPage.data.callbackData(`_back`), StartPage.data.callbackData()], `2`, Base.url)
  }

  // Build body-input inline keyboard: ⬅️ Back | ✖️ Cancel
  static buildBodyKeyboard(ctx: HttpRequestPage) {
    return ctx.inlineKeyboardT([HttpRequestPage.data.callbackData(`_back`), StartPage.data.callbackData()], `2`, Base.body)
  }

  // Build token-input inline keyboard: ⏭️ Skip | ✖️ Cancel
  static buildTokenKeyboard(ctx: HttpRequestPage) {
    return ctx.inlineKeyboardT([HttpRequestPage.data.callbackData(`skip_token`), StartPage.data.callbackData()], `2`, Base.token)
  }

  // Build inline keyboard for result pages: single Home button
  static buildHomeKeyboard(ctx: HttpRequestPage) {
    return ctx.inlineKeyboardT([StartPage], `1`, Base.warnNetwork)
  }

  // Build inline keyboard for result pages: toggle view + Home
  static buildSuccessKeyboard(ctx: HttpRequestPage, viewMode: string) {
    const toggleLabel = viewMode === `formatted` ? `🔁 Raw` : `🔁 Formatted`
    return ctx.inlineKeyboardT([HttpRequestPage.data.callbackData(`toggle_view`), StartPage], `2`, Base.success, {toggleLabel})
  }

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

  // Truncate body and HTML-escape it for safe Telegram rendering.
  static formatBody(body: string): string {
    const truncated = body.length > 200 ? body.slice(0, 200) + `\n... [${body.length} total chars]` : body
    return Helper.escapeHtml(truncated)
  }

  // Prepare body text according to view mode.
  static renderBody(result: IHttpResponse, viewMode: string): string {
    if (viewMode === `raw`) {
      return Helper.formatBody(result.rawBody)
    }
    // formatted: re-pretty-print from rawBody, then format for display
    const prettyBody = result.contentType.includes(`application/json`) ? HttpService.formatJson(result.rawBody) : result.rawBody
    return Helper.formatBody(prettyBody)
  }
}

class Main {
  static async showMethodForm(ctx: HttpRequestPage) {
    const kb = Helper.buildMethodKeyboard(ctx)
    await ctx.edit(kb, {}, Base.method)
  }

  static async showUrlForm(ctx: HttpRequestPage, method: string) {
    await ctx.setSessionFreeText({httpStep: `url`, httpMethod: method})
    const kb = Helper.buildUrlKeyboard(ctx)
    await ctx.edit(kb, {method}, Base.url)
  }

  static async showTokenForm(ctx: HttpRequestPage, method: string, url: string) {
    await ctx.setSessionFreeText({httpStep: `token`, httpMethod: method, httpUrl: url})
    const kb = Helper.buildTokenKeyboard(ctx)
    await ctx.edit(kb, {method, url: Helper.escapeHtml(url)}, Base.token)
  }

  static async proceedFromToken(ctx: HttpRequestPage, token: string | null) {
    const session = await ctx.getSession()
    const method = session?.params?.httpMethod as string
    const url = session?.params?.httpUrl as string
    if (!method || !url) {
      await ctx.clearSession()
      await Main.showMethodForm(ctx)
      return
    }

    if (HttpService.needsBody(method)) {
      await ctx.setSessionFreeText({httpStep: `body`, httpMethod: method, httpUrl: url, httpToken: token})
      await Main.showBodyForm(ctx, method, url)
    } else {
      const headers: Record<string, string> = {}
      if (token) headers[`Authorization`] = `Bearer ${token}`
      try {
        const result = await HttpService.request(method, url, undefined, headers)
        await ctx.setSessionFreeText({httpStep: `done`, httpResult: result, httpViewMode: `formatted`})
        await Main.showSuccess(ctx, result, `formatted`, true)
      } catch (error) {
        await ctx.clearSession()
        const msg = error instanceof Error ? error.message : String(error)
        await Main.showWarnNetwork(ctx, url, msg, true)
      }
    }
  }

  static async showBodyForm(ctx: HttpRequestPage, method: string, url: string) {
    await ctx.setSessionFreeText({httpStep: `body`, httpMethod: method, httpUrl: url})
    const kb = Helper.buildBodyKeyboard(ctx)
    await ctx.edit(kb, {method, url: Helper.escapeHtml(url)}, Base.body)
  }

  static async processUrl(ctx: HttpRequestPage, url: string, method: string, showToken = false) {
    if (!HttpService.isValidUrl(url)) {
      await ctx.edit(Helper.buildUrlKeyboard(ctx), {url: Helper.escapeHtml(url)}, Base.warnInvalid)
      return
    }

    if (showToken) {
      await Main.showTokenForm(ctx, method, url)
    } else if (HttpService.needsBody(method)) {
      await Main.showBodyForm(ctx, method, url)
    } else {
      try {
        const result = await HttpService.request(method, url)
        await ctx.setSessionFreeText({httpStep: `done`, httpResult: result, httpViewMode: `formatted`})
        await Main.showSuccess(ctx, result, `formatted`)
      } catch (error) {
        await ctx.clearSession()
        const message = error instanceof Error ? error.message : String(error)
        await Main.showWarnNetwork(ctx, url, message)
      }
    }
  }

  static async processBody(ctx: HttpRequestPage, body: string, session: any) {
    const method = session.params?.httpMethod as string
    const url = session.params?.httpUrl as string
    const token = session.params?.httpToken as string | undefined
    if (!url) {
      await ctx.clearSession()
      await Main.showMethodForm(ctx)
      return
    }
    const headers: Record<string, string> = {}
    if (token) headers[`Authorization`] = `Bearer ${token}`
    try {
      const result = await HttpService.request(method, url, body, headers)
      await ctx.setSessionFreeText({httpStep: `done`, httpResult: result, httpViewMode: `formatted`})
      await Main.showSuccess(ctx, result, `formatted`)
    } catch (error) {
      await ctx.clearSession()
      const message = error instanceof Error ? error.message : String(error)
      await Main.showWarnNetwork(ctx, url, message)
    }
  }

  static async showSuccess(ctx: HttpRequestPage, result: IHttpResponse, viewMode: string = `formatted`, edit = false) {
    const kb = Helper.buildSuccessKeyboard(ctx, viewMode)
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
    if (edit) {
      await ctx.edit(kb, da, Base.success)
    } else {
      await ctx.reply(kb, da, Base.success)
    }
  }

  static async showWarnNetwork(ctx: HttpRequestPage, url: string, errorMessage: string, edit = false) {
    const kb = Helper.buildHomeKeyboard(ctx)
    const da = {url: Helper.escapeHtml(url), errorMessage: Helper.escapeHtml(errorMessage)}
    if (edit) {
      await ctx.edit(kb, da, Base.warnNetwork)
    } else {
      await ctx.reply(kb, da, Base.warnNetwork)
    }
  }
}

// HTTP Request page with multi-step flow: method selection → URL input → body input (if needed) → result.
export class HttpRequestPage extends PageBase {
  static data = this.buildData((action: string) => [action])

  async handleCallbackData() {
    // User clicked "🌐 New Request" from StartPage or re-entered via external callback
    await this.clearSession()
    await Main.showMethodForm(this)
  }

  async handleArgsCallbackData() {
    const args = this.callbackDataArgs
    const action = args[0]
    if (!action) return

    if (action === `_back`) {
      await this.clearSession()
      await Main.showMethodForm(this)
      return
    }

    if (action === `skip_token`) {
      await Main.proceedFromToken(this, null)
      return
    }

    if (action === `toggle_view`) {
      const session = await this.getSession()
      const result = session?.params?.httpResult as IHttpResponse | undefined
      if (!result) return
      const currentView = (session?.params?.httpViewMode as string) || `formatted`
      const newView = currentView === `formatted` ? `raw` : `formatted`
      await this.setSessionFreeText({...session?.params, httpViewMode: newView})
      const kb = Helper.buildSuccessKeyboard(this, newView)
      const emoji = result.status >= 200 && result.status < 300 ? `✅` : result.status >= 400 ? `❌` : `⚠️`
      const headersText = Helper.formatHeaders(result.headers)
      const bodyPreview = Helper.renderBody(result, newView)
      await this.edit(
        kb,
        {
          status: result.status,
          statusText: result.statusText,
          duration: result.duration,
          method: result.method,
          emoji,
          headersText,
          bodyPreview
        },
        Base.success
      )
      return
    }

    // HTTP method was selected (GET / POST / PUT / DELETE / PATCH)
    await Main.showUrlForm(this, action)
  }

  async handleFreeText() {
    const input = this.msgText.trim()
    const session = await this.getSession()

    const step = session?.params?.httpStep as string | undefined
    if (!step || step === `method` || step === `done`) {
      await Main.processUrl(this, input, `GET`)
      return
    }

    if (step === `url`) {
      await Main.processUrl(this, input, session.params?.httpMethod as string, true)
    } else if (step === `token`) {
      await Main.proceedFromToken(this, input)
    } else if (step === `body`) {
      await Main.processBody(this, input, session)
    }
  }

  static template = `
    <g-base id="${Base.method}">
      <g-keyboard type="inline">GET, POST, PUT, DELETE, PATCH, ✖️ Cancel</g-keyboard>
      <g-keyboard lang="id" type="inline">GET, POST, PUT, DELETE, PATCH, ✖️ Batal</g-keyboard>
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
      <g-keyboard lang="id" type="inline">⬅️ Kembali, ✖️ Batal</g-keyboard>
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
      <g-keyboard lang="id" type="inline">⏭️ Lewati, ✖️ Batal</g-keyboard>
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
      <g-keyboard lang="id" type="inline">⬅️ Kembali, ✖️ Batal</g-keyboard>
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
      <g-keyboard lang="id" type="inline">{{toggleLabel}}, 🏠 Beranda</g-keyboard>
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
      <g-keyboard lang="id" type="inline">⬅️ Kembali, ✖️ Batal</g-keyboard>
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
