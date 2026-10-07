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

/** JSON 请求体的宽松形状(interface 默认不带索引签名,这里转一次) */
type JsonBody = object

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
  options: RequestOptions & { body?: BodyInit | JsonBody },
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

export interface UploadProgress {
  loaded: number
  total: number | null
}

/** FormData 上传，使用 XHR 暴露浏览器真实的已发送字节数。 */
export function postFormDataWithProgress<T>(
  path: string,
  body: FormData,
  options: RequestOptions & { onProgress?: (progress: UploadProgress) => void } = {},
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', buildUrl(path, options.query))
    xhr.responseType = 'text'
    xhr.upload.onprogress = (event) => {
      options.onProgress?.({ loaded: event.loaded, total: event.lengthComputable ? event.total : null })
    }
    xhr.onerror = () => reject(new Error('网络连接失败，请检查后端是否已启动。'))
    xhr.onabort = () => reject(new Error('上传已取消。'))
    xhr.onload = () => {
      let response: unknown = undefined
      if (xhr.responseText) {
        try {
          response = JSON.parse(xhr.responseText)
        } catch {
          response = xhr.responseText
        }
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new ApiError(xhr.status, response))
        return
      }
      resolve(response as T)
    }
    if (options.signal) {
      options.signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }
    xhr.send(body)
  })
}

/** GET 请求 */
export function get<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return request<T>('GET', path, options)
}

/** POST 请求(JSON 或 FormData 自动区分) */
export function post<T>(
  path: string,
  body?: BodyInit | JsonBody,
  options: RequestOptions = {},
): Promise<T> {
  return request<T>('POST', path, { ...options, body })
}

/** PUT 请求 */
export function put<T>(
  path: string,
  body?: BodyInit | JsonBody,
  options: RequestOptions = {},
): Promise<T> {
  return request<T>('PUT', path, { ...options, body })
}

/** DELETE 请求 */
export function del<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return request<T>('DELETE', path, options)
}
