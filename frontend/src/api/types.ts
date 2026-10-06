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

/** POST /api/quiz/sessions/{id}/questions 请求体(契约以 routes_quiz.QuestionsIn 为准;
 * confirm_cloud 放 JSON body,不是 query) */
export interface QuestionsIn {
  layer: 'core' | 'resume' | 'domain'
  /** 行业包;layer=core 时后端固定用 _core */
  pack_id?: string | null
  /** 旧字段名兼容(pack_id 别名),新代码请用 pack_id */
  pack?: string | null
  /** 本次生成总题数,1-30,后端默认 8 */
  total?: number
  /** 岗位描述原文;domain/resume 有 JD 则据此加权 */
  jd?: string | null
  /** 知情确认:允许 local_only 原文发给云端 */
  confirm_cloud?: boolean
}

/** 生成题目响应(routes_quiz.create_questions):不再是平铺数组 */
export interface QuestionsOut {
  session_id: number
  layer: QuestionsIn['layer']
  pack: string
  generated: number
  questions: QuizQuestion[]
  /** 生成为 0 时后端附带的解释文案 */
  message?: string
}

/** POST /api/quiz/questions/{qid}/answer 请求体(confirm_cloud 在 body) */
export interface AnswerIn {
  answer_text: string
  confirm_cloud?: boolean
}

/** 作答评分响应(answers 表一行 + review 排期) */
export interface AnswerRecord {
  answer_id: number
  question_id: number
  session_id?: number
  answer_text?: string
  /** 0-100 */
  score: number | null
  /** {维度名: 分数} */
  dim_scores?: Record<string, number> | null
  feedback?: string | null
  competency?: string | null
  /** 出题评分的遗漏点列表(评分 Evaluator 返回) */
  missed_points?: string[] | null
  created_at?: string | null
  /** 复习排期(score 决定间隔天数) */
  review?: { due_days: number[]; done: boolean } | null
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

/** GET /api/quiz/review/today 返回的到期复习记录 */
export interface ReviewQueueItem {
  review_id: number
  competency?: string | null
  due_on: string
  done: boolean
  question_id: number
  session_id: number
  layer: QuizQuestion['layer']
  pack?: string | null
  difficulty: number
  question: string
  reference_answer?: string | null
  key_points?: string[] | null
  provenance?: Provenance | null
}

/** 兼容旧的汇总响应形状 */
export interface ReviewToday {
  due_count: number
  items?: ReviewQueueItem[]
}
