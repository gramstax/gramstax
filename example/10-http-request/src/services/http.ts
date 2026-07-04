export type IHttpMethod = `GET` | `POST` | `PUT` | `DELETE` | `PATCH`

export type IHttpResponse = {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  rawBody: string
  duration: number
  method: string
  contentType: string
}

// Service for making HTTP requests.
export class HttpService {
  // Maximum response body length to display in Telegram.
  static MAX_BODY_LENGTH = 1500

  static METHODS: IHttpMethod[] = [`GET`, `POST`, `PUT`, `DELETE`, `PATCH`]

  // Whether the given HTTP method typically carries a request body.
  static needsBody(method: string): boolean {
    return method === `POST` || method === `PUT` || method === `PATCH`
  }

  // Validates that a URL is well-formed and uses http/https.
  static isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url)
      return parsed.protocol === `http:` || parsed.protocol === `https:`
    } catch {
      return false
    }
  }

  // Pretty-prints a JSON string with 2-space indentation. Returns the original string on parse failure.
  static formatJson(rawBody: string): string {
    try {
      const parsed = JSON.parse(rawBody)
      return JSON.stringify(parsed, null, 2)
    } catch {
      return rawBody
    }
  }

  // Performs an HTTP request with the given method, URL, optional body, and optional extra headers.
  static async request(method: string, url: string, body?: string, extraHeaders?: Record<string, string>): Promise<IHttpResponse> {
    const start = performance.now()

    const reqHeaders: Record<string, string> = {...extraHeaders}

    if (this.needsBody(method) && body) {
      reqHeaders[`Content-Type`] = `application/json`
    }

    const fetchOptions: any = {
      signal: AbortSignal.timeout(15_000),
      headers: Object.keys(reqHeaders).length > 0 ? reqHeaders : undefined
    }

    if (method !== `GET`) {
      fetchOptions.method = method
    }

    if (body) {
      fetchOptions.body = body
    }

    const response = await fetch(url, fetchOptions)
    const duration = Math.round(performance.now() - start)

    const headers: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      headers[key] = value
    })

    const contentType = response.headers.get(`content-type`) || ``

    const rawText = await response.text()

    // Pretty-print JSON responses with indentation
    let prettyBody = rawText
    if (contentType.includes(`application/json`)) {
      prettyBody = this.formatJson(rawText)
    }

    const displayBody = prettyBody.length > this.MAX_BODY_LENGTH ? prettyBody.slice(0, this.MAX_BODY_LENGTH) + `\n\n... [truncated, ${prettyBody.length} total chars]` : prettyBody

    return {
      status: response.status,
      statusText: response.statusText,
      headers,
      body: displayBody,
      rawBody: rawText,
      duration,
      method,
      contentType
    }
  }
}
