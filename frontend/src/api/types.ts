/**
 * 手写的最小 API 类型定义。
 *
 * TODO(P2): 后端 FastAPI 提供 OpenAPI schema,后续用
 *   npx openapi-typescript http://127.0.0.1:8000/openapi.json -o src/api/schema.d.ts
 * 生成并替换本文件,保证类型与后端契约一致。
 */

/* ---------- 通用 ---------- */

/** local_only 隐私拦截:后端返回 409 {detail, provider_id},需用户确认后带 confirm_cloud=true 重发 */
export interface CloudConfirmError {
  detail: string
  provider_id: string
}

/* ---------- 资料库 /docs ---------- */

export interface LibraryDoc {
  id: string
  filename: string
  size?: number
  doc_type?: string
  uploaded_at?: string
}

/* ---------- 出题练习 /quiz ---------- */

export interface QuizSession {
  id: string
  status: 'draft' | 'in_progress' | 'finished'
  question_count?: number
  created_at?: string
}

/* ---------- 设置 /settings ---------- */

export interface ProviderInfo {
  id: string
  name: string
  /** 该 provider 从哪个环境变量读 API Key */
  api_key_env: string
  /** 是否为 local_only(本机推理,数据不出本机) */
  local_only?: boolean
  enabled?: boolean
  /** API Key 是否已在环境中配置(字段名待后端契约定型,先兼容两种写法) */
  api_key_set?: boolean
  configured?: boolean
}

/* ---------- 复习 /quiz/review ---------- */

export interface ReviewToday {
  due_count: number
  items?: unknown[]
}
