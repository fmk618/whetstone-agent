/** 请求失败时抛出的错误:HTTP 状态码 + 后端返回体 */
export class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, body: unknown) {
    super(`API 请求失败: HTTP ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

/** 判断错误体是否为隐私 409 确认({detail, provider_id}) */
export function isCloudConfirmError(body: unknown): body is { detail: string; provider_id: string } {
  return (
    typeof body === 'object' &&
    body !== null &&
    'detail' in body &&
    'provider_id' in body &&
    typeof (body as { detail: unknown }).detail === 'string' &&
    typeof (body as { provider_id: unknown }).provider_id === 'string'
  )
}

interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>
  signal?: AbortSignal
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  if (!query) return path
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

/** 统一解析后端响应;非 2xx 时抛 ApiError({status, body}) */
async function parseResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let body: unknown
    try {
      body = await res.json()
    } catch {
      body = await res.text().catch(() => null)
    }
    throw new ApiError(res.status, body)
  }
  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

async function request<T>(
  method: string,
  path: string,
  options: RequestOptions & { body?: BodyInit | Record<string, unknown> },
): Promise<T> {
  const headers: Record<string, string> = {}
  let body: BodyInit | undefined

  if (options.body !== undefined) {
    if (
      typeof options.body === 'object' &&
      !(options.body instanceof FormData) &&
      !(options.body instanceof Blob) &&
      !(options.body instanceof ArrayBuffer)
    ) {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(options.body)
    } else {
      body = options.body as BodyInit
    }
  }

  const res = await fetch(buildUrl(path, options.query), {
    method,
    headers,
    body,
    signal: options.signal,
  })
  return parseResponse<T>(res)
}

/** GET 请求 */
export function get<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return request<T>('GET', path, options)
}

/** POST 请求(JSON 或 FormData 自动区分) */
export function post<T>(
  path: string,
  body?: BodyInit | Record<string, unknown>,
  options: RequestOptions = {},
): Promise<T> {
  return request<T>('POST', path, { ...options, body })
}

/** PUT 请求 */
export function put<T>(
  path: string,
  body?: BodyInit | Record<string, unknown>,
  options: RequestOptions = {},
): Promise<T> {
  return request<T>('PUT', path, { ...options, body })
}

/** DELETE 请求 */
export function del<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return request<T>('DELETE', path, options)
}
