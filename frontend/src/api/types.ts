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

/** 联调核对:routes_docs.upload 的 DocType(五类);GET /api/docs 即 documents 表整行 */
export type DocType = 'resume' | 'project' | 'notes' | 'jd' | 'reference'
// 页面占位数据还使用了 interview_exp(面经)/note(笔记简称)两种宽松值,
// OCR 修正 TODO:后端 doc_type 收窄后统一,目前页面对 'note' 兼容展示为笔记
export type DocTypeLoose = DocType | 'interview_exp' | 'note'

export type Sensitivity = 'local_only' | 'cloud_ok'

/** GET /api/docs 的单行(documents 表:只回已知字段,其余算 string 兜底) */
export interface LibraryDoc {
  id: string
  filename: string
  doc_type: DocType
  sensitivity: Sensitivity
  /** 敏感命中 JSON {"phone": 2, ...}(空 {} 时不显示徽章) */
  sens_hits?: Record<string, number> | null
  n_chunks: number
  /** 绑定的嵌入模型信息 {"provider","model","dim"} */
  embedded?: { provider: string; model: string; dim: number } | null
  created_at?: string | null
}

/** POST /api/docs/upload 响应(FastAPI multipart: fields file/doc_type + query confirm_cloud) */
export interface UploadDocResponse {
  doc_id: string
  filename: string
  n_chunks: number
  sensitivity: Sensitivity
  sens_hits: Record<string, number>
  /** 仅 pdf 上传时可能有值(扫描件提示) */
  scanned: boolean | null
  /** 同 hash 同 mtime 命中增量逻辑,若为 true 表示跳过重复入库 */
  skipped: boolean
}

/** POST /api/docs/reindex 响应 */
export interface ReindexResponse {
  /** 需重建的集合名(personal / reference) */
  rebuilt: string[]
  /** 处理的文档数 */
  docs: number
  /** 重嵌入总块数 */
  n_chunks: number
}

/* ---------- 知识档案 /docs/{id}/profile ---------- */

/** GET /api/docs/{id}/profile 单行(profile_claims 表) */
export interface ProfileClaim {
  id: number
  doc_id: string
  competency: string
  ctype: 'task' | 'knowledge' | 'skill' | 'work_style'
  domain?: string | null
  claim_text: string
  strength: 'has_metric' | 'listed_only' | 'none'
  source_file?: string | null
  source_section?: string | null
}

/* ---------- 出题练习 /quiz ---------- */

export interface QuizSession {
  id: number
  kind: 'quiz' | 'interview'
  title?: string | null
  created_at?: string | null
  /** 列表接口按 GROUP BY s.id 统计 */
  n_questions?: number
  /** 详情接口 _session_detail 附带 */
  questions?: QuizQuestion[]
}

export interface QuizSessionIn {
  kind: 'quiz' | 'interview'
  title?: string | null
}

/** 题目出处(prompt 契约:file + section) */
export interface Provenance {
  jd_requirement?: string | null
  resume_evidence?: { file: string; section?: string } | null
  reference?: { file: string; section?: string } | { [key: string]: unknown } | null
}

/** 出题本体。层/包/难度/原文与后端 questions 表一致 */
export interface QuizQuestion {
  id: number
  session_id: number
  layer: 'core' | 'resume' | 'domain'
  pack?: string | null
  difficulty: number
  question: string
  reference_answer: string
  key_points?: string[] | null
  provenance?: Provenance | null
  created_at?: string | null
  answers?: AnswerRecord[]
}

/** 列表/详情页可直接用 Question 别名 */
export type Question = QuizQuestion

/** POST /api/quiz/sessions/{id}/questions 请求体(契约以 routes_quiz.QuestionsIn 为准) */
export interface QuestionsIn {
  layer: 'core' | 'resume' | 'domain'
  pack?: string | null
  /** 各能力项的题数 {"task": 2, ...},总和才是本次想生成的总题数 */
  counts?: Record<string, number> | null
}

/** POST /api/quiz/questions/{qid}/answer 请求体 */
export interface AnswerIn {
  answer_text: string
}

/** 一次作答的评分结果(answers 表一行) */
export interface AnswerRecord {
  id: number
  question_id: number
  session_id?: number
  answer_text: string
  /** 0-100 */
  score: number | null
  /** {维度名: 分数} */
  dim_scores?: Record<string, number> | null
  feedback?: string | null
  competency?: string | null
  /** 出题评分的遗漏点列表(esome 版答錯/缺失要点,评分 Evaluator 返回) */
  missed_points?: string[] | null
  created_at?: string | null
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
