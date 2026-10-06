import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { get, post } from '../api/client'
import { requestWithCloudConfirm } from '../components/CloudConfirmDialog'
import { useToast } from '../components/Toast'
import { PageHeader } from '../components/PageHeader'
import { Reveal } from '../components/Motion'
import { Select } from '../components/Select'
import type {
  AnswerIn,
  AnswerRecord,
  LibraryDoc,
  Provenance,
  Question,
  QuestionsIn,
  QuestionsOut,
  QuizSession,
} from '../api/types'

/* ============================================================
   出题练习页:生成工具条(POST /api/quiz/sessions/{id}/questions)
   + 题卡视觉 + 作答评分(POST /api/quiz/questions/{qid}/answer)。
   后端 generator/evaluator 未接入时该端点返回 501,这里给出可见降级提示。
   ============================================================ */

type Layer = Question['layer']

const QUESTION_BADGE: Record<Layer, { label: string; badge: string }> = {
  core: { label: '通用(基础)', badge: 'badge-neutral' },
  resume: { label: '项目(进阶)', badge: 'badge-accent' },
  domain: { label: '领域(开放)', badge: 'badge-success' },
}

const PACK_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '_core', label: '通用(所有岗位)' },
  { value: 'tech', label: '互联网/IT' },
]

function DifficultyStars({ level }: { level: number }) {
  const clamped = Math.min(5, Math.max(1, Math.round(level || 1)))
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={`难度 ${clamped} / 5`}
      title={`难度 ${clamped} / 5`}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          width="12"
          height="12"
          fill={i < clamped ? 'var(--accent)' : 'none'}
          stroke={i < clamped ? 'var(--accent)' : 'var(--fg-subtle)'}
          strokeWidth="1.5"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m12 3.5 2.47 5.01 5.53.8-4 3.9.94 5.5L12 16.13 7.06 18.7 8 13.22l-4-3.9 5.53-.8L12 3.5Z" />
        </svg>
      ))}
      <span className="tnum ml-1 font-mono text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
        {clamped}/5
      </span>
    </span>
  )
}

/** 出处引用块:provenance resume_evidence / reference(file + section) */
function SourceList({ provenance }: { provenance?: Provenance | null }) {
  if (!provenance) return null
  const entries: Array<{ file?: string; section?: string; text?: string }> = []
  const resume = provenance.resume_evidence as { file?: string; section?: string } | null
  if (resume && resume.file) entries.push({ file: resume.file, section: resume.section })
  const reference = provenance.reference as { file?: string; section?: string } | null
  if (reference && (reference.file || reference.section)) {
    if (reference.file) entries.push({ file: reference.file, section: reference.section })
    else entries.push({ text: '资料外知识' })
  }
  if (!entries.length) return null

  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs" style={{ color: 'var(--fg-subtle)' }}>
        <svg
          viewBox="0 0 24 24"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H9a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5h-4A1.5 1.5 0 0 1 4 16V5.5Z" />
          <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H15a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5h4A1.5 1.5 0 0 0 20 16V5.5Z" />
        </svg>
        题目依据以下资料片段生成
      </div>
      <div className="flex flex-col gap-1.5">
        {entries.map((ref, i) => (
          <blockquote
            key={i}
            className="rounded-md px-3 py-2 text-xs leading-relaxed"
            style={{
              backgroundColor: 'var(--bg-inset)',
              borderLeft: '2px solid var(--accent)',
              color: 'var(--fg-muted)',
            }}
          >
            {ref.file ? (
              <span className="font-mono text-[11px]" style={{ color: 'var(--accent)' }}>
                {ref.file}
              </span>
            ) : null}
            {ref.section ? (
              <span className="tnum mx-1.5 font-mono text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
                {ref.file ? '· ' : ''}{ref.section}
              </span>
            ) : null}
            <div className="mt-0.5">{ref.text ?? '该题标记为「原始资料片段出处」'}</div>
          </blockquote>
        ))}
      </div>
    </div>
  )
}

/** 错误展示:把后端 400/409 的 detail 拿出来当 UI 文本 */
function detailOf(err: unknown, fallback: string): string {
  const body = (err as { body?: { detail?: string } }).body
  return body?.detail ?? (err instanceof Error ? err.message : fallback)
}

/** 作答区:textarea + 提交评分;评分保存在 <AnswerRecord> 展示 */
function AnswerPanel({ question, onToast }: { question: Question; onToast: (text: string, kind?: 'success' | 'error' | 'info') => void }) {
  const [text, setText] = useState('')
  const [touched, setTouched] = useState(false)
  const queryClient = useQueryClient()
  const [answered, setAnswered] = useState<AnswerRecord | null>(null)

  const submitMutation = useMutation({
    mutationFn: async () => {
      const body: AnswerIn = { answer_text: text }
      const send = (opts: { confirmCloud: boolean }) =>
        post<AnswerRecord>(`/api/quiz/questions/${question.id}/answer`, {
          ...body,
          confirm_cloud: opts.confirmCloud,
        })
      try {
        return await send({ confirmCloud: false })
      } catch (err) {
        return await requestWithCloudConfirm(send, err)
      }
    },
    onSuccess: (result) => {
      setAnswered(result)
      queryClient.invalidateQueries({ queryKey: ['quiz', 'sessions'] })
      onToast(
        result.score != null
          ? `评分 ${result.score}/100,${(result.feedback ?? '').slice(0, 24)}…`
          : '已提交,但尚未返回评分',
        result.score != null && result.score >= 60 ? 'success' : 'info',
      )
    },
    onError: (err) => onToast(detailOf(err, '提交失败'), 'error'),
  })

  const hasScored = answered?.score != null

  return (
    <div className="mt-3 rounded-md border p-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-inset)' }}>
      {hasScored ? (
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <span className="text-2xl font-semibold" style={{ color: (answered!.score ?? 0) >= 60 ? 'var(--success)' : 'var(--warning)' }}>
              {answered!.score}
              <span className="ml-1 text-sm" style={{ color: 'var(--fg-subtle)' }}>/ 100</span>
            </span>
            {answered?.dim_scores && Object.keys(answered.dim_scores).length > 0 ? (
              Object.entries(answered.dim_scores).map(([dim, v]) => (
                <span key={dim} className="badge badge-neutral">
                  {dim} {v}
                </span>
              ))
            ) : null}
          </div>
          {answered?.missed_points && answered.missed_points.length > 0 ? (
            <div className="px-3 py-2 rounded-md" style={{ backgroundColor: 'var(--warning-soft)', color: 'var(--warning)' }}>
              <div className="text-xs font-medium mb-1">遗漏要点</div>
              <ul className="m-0 list-disc pl-5 text-[13px]" style={{ color: 'var(--fg-muted)' }}>
                {answered.missed_points.map((p: string, i: number) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {answered?.feedback ? (
            <p className="text-[13px] leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
              {answered.feedback}
            </p>
          ) : null}
          <details className="answer-fold">
            <summary>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="chev">
                <path d="m9 6 6 6-6 6" />
              </svg>
              我的回答
            </summary>
            <div className="answer-fold-body whitespace-pre-wrap">{answered?.answer_text}</div>
          </details>
          <button
            type="button"
            className="btn btn-ghost self-start"
            onClick={() => {
              setAnswered(null)
              setText('')
            }}
          >
            再答一遍
          </button>
        </div>
      ) : (
        <div>
          <label className="field-label mb-1 block" htmlFor={`q-${question.id}-answer`}>
            作答(对照后端 evaluate 角色评分)
          </label>
          <label className="field-label mb-1" htmlFor={`q-${question.id}-answer`}>
            作答
          </label>
          <textarea
            id={`q-${question.id}-answer`}
            className="input w-full"
            rows={4}
            value={text}
            placeholder="用自己的话作答,提交后按维度评分"
            onChange={(e) => {
              setText(e.target.value)
              setTouched(true)
            }}
            disabled={submitMutation.isPending}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!touched || !text.trim() || submitMutation.isPending}
              onClick={() => submitMutation.mutate()}
            >
              {submitMutation.isPending ? '评分中…(大模型回复可能需几秒)' : '提交评分'}
            </button>
            {submitMutation.isError ? (
              <span className="text-xs" style={{ color: 'var(--danger)' }}>
                {detailOf(submitMutation.error, '提交失败')}
              </span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

/** 单张题卡:题面 / 难度 / layer / 参考答案折叠 / 出处引用块 + 作答区 */
function QuestionCard({
  question,
  index,
  onToast,
}: {
  question: Question
  index: number
  onToast: (text: string, kind?: 'success' | 'error' | 'info') => void
}) {
  const [revealed, setRevealed] = useState(false)
  const meta = QUESTION_BADGE[question.layer] ?? { label: question.layer, badge: 'badge-neutral' }
  const reference = question.reference_answer ?? ''

  return (
    <Reveal index={index} as="article" className="card card-raised mb-6">
      {/* 题头:序号 + layer 徽章 + pack + 难度星 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className="tnum flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-mono text-xs font-semibold"
          style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}
          aria-hidden="true"
        >
          {index + 1}
        </span>
        <span className={`badge ${meta.badge}`}>{meta.label}</span>
        {question.pack ? (
          <span className="badge badge-neutral">
            {PACK_OPTIONS.find((p) => p.value === question.pack)?.label ?? question.pack}
          </span>
        ) : null}
        <span className="ml-auto">
          <DifficultyStars level={question.difficulty ?? 1} />
        </span>
      </div>

      {/* 题面 */}
      <p className="text-[15px] font-medium leading-relaxed whitespace-pre-wrap">{question.question}</p>

      {/* 参考答案(折叠) */}
      {reference ? (
        <details
          className="answer-fold"
          open={revealed}
          onToggle={(e) => setRevealed((e.target as HTMLDetailsElement).open)}
        >
          <summary>
            <svg
              viewBox="0 0 24 24"
              width="13"
              height="13"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="chev"
            >
              <path d="m9 6 6 6-6 6" />
            </svg>
            {revealed ? '收起参考答案' : '查看参考答案'}
            <span className="ml-1 font-normal" style={{ color: 'var(--fg-subtle)' }}>
              (先自己作答再看,记忆效果更好)
            </span>
          </summary>
          <div className="answer-fold-body">
            {reference.split('\n\n').map((para, i) => (
              <p key={i} className={i > 0 ? 'mt-2.5' : undefined}>
                {para}
              </p>
            ))}
          </div>
        </details>
      ) : null}

      {/* 出处引用块 */}
      <SourceList provenance={question.provenance} />

      <AnswerPanel question={question} onToast={onToast} />
    </Reveal>
  )
}

/** 错误提示条:把 4xx/5xx/网络失败改为可见文案 */
function ErrorBar({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      className="rounded-md border px-4 py-3 text-sm"
      style={{ borderColor: 'var(--danger)', backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' }}
    >
      {message}
      <button type="button" className="btn btn-ghost btn-sm ml-3" onClick={onRetry}>
        重试
      </button>
    </div>
  )
}

/** 生成题目工具条:层 / pack / 题数;点击「生成题目」→ 创建会话 + 拉题 */
function GenerateToolbar({
  onToast,
}: {
  onToast: (text: string, kind?: 'success' | 'error' | 'info') => void
}) {
  const queryClient = useQueryClient()
  const [layer, setLayer] = useState<Layer>('resume')
  const [pack, setPack] = useState('tech')
  const [total, setTotal] = useState(3)
  const [formError, setFormError] = useState<string | null>(null)

  const sessionsQuery = useQuery({
    queryKey: ['quiz', 'sessions'],
    queryFn: () => get<QuizSession[]>('/api/quiz/sessions'),
  })

  const latestSession = sessionsQuery.data?.[0]

  const generateMutation = useMutation({
    mutationFn: async (opts: { reuse: boolean; confirmCloud: boolean }) => {
      // 1. 无复用会话就先创建一个(kind=quiz)
      let sessionId: number
      if (opts.reuse && latestSession) {
        sessionId = latestSession.id
      } else {
        const studio = await post<QuizSession>('/api/quiz/sessions', {
          kind: 'quiz',
          title: `练习 ${new Date().toLocaleString('zh-CN', { hour12: false })}`,
        })
        sessionId = studio.id
      }
      // 2. 出题:契约以 routes_quiz.QuestionsIn 为准 {layer, pack_id, total,
      //    confirm_cloud}(confirm_cloud 在 JSON body,不是 query)。
      const body: QuestionsIn = {
        layer,
        pack_id: layer === 'core' ? undefined : pack,
        total,
      }
      const send = (o: { confirmCloud: boolean }) =>
        post<QuestionsOut>(`/api/quiz/sessions/${sessionId}/questions`, {
          ...body,
          confirm_cloud: o.confirmCloud,
        })
      try {
        return { sessionId, out: await send({ confirmCloud: false }) }
      } catch (err) {
        const out = await requestWithCloudConfirm(send, err)
        return { sessionId, out }
      }
    },
    onSuccess: ({ out, sessionId }) => {
      queryClient.invalidateQueries({ queryKey: ['quiz', 'sessions'] })
      queryClient.invalidateQueries({ queryKey: ['quiz', 'latest-session'] })
      setFormError(null)
      // 生成为 0 时后端附 message 解释(如检索不到资料片段)
      if (out.message) onToast(out.message, 'info')
      else onToast(`生成完成:${out.generated} 题(会话 ${sessionId} 已保留)`, 'success')
      // 本轮可能落在旧会话上;立即把详情拉到最新
      void queryClient.fetchQuery({
        queryKey: ['quiz', 'latest-session'],
        queryFn: async () => await get<QuizSession>(`/api/quiz/sessions/${sessionId}`),
      })
    },
    onError: (err) => {
      setFormError(detailOf(err, '生成失败,请稍后重试'))
    },
  })

  const submittable =
    !generateMutation.isPending && !sessionsQuery.isLoading

  // 生成的题目从“最新会话”拉;在 QueryClient 缓存里挑出本轮 session 的题
  const generatedQuestions = latestSession?.questions ?? []

  function submit() {
    setFormError(null)
    generateMutation.mutate({ reuse: false, confirmCloud: false })
  }

  return (
    <section className="card card-raised mb-8">
      <h2 className="mb-3 text-base font-semibold">生成题目</h2>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[150px]">
          <span className="field-label mb-1 block" id="quiz-layer-label">层级(出题范围)</span>
          <Select
            value={layer}
            onChange={(v) => setLayer(v as Layer)}
            options={[
              { value: 'core', label: '基础(通用能力)' },
              { value: 'resume', label: '项目(简历深挖)' },
              { value: 'domain', label: '领域(知识点)' },
            ]}
            ariaLabel="层级(出题范围)"
          />
        </div>

        <div className="min-w-[160px]">
          <span className="field-label mb-1 block">行业包</span>
          <Select
            value={pack}
            onChange={setPack}
            options={PACK_OPTIONS}
            ariaLabel="行业包"
          />
        </div>

        <div className="min-w-[110px]">
          <span className="field-label mb-1 block">题目数量</span>
          <Select
            value={String(total)}
            onChange={(v) => setTotal(Number(v))}
            options={[
              { value: '1', label: '1 题' },
              { value: '3', label: '3 题' },
              { value: '5', label: '5 题' },
              { value: '10', label: '10 题' },
            ]}
            ariaLabel="题目数量"
          />
        </div>

        <button
          type="button"
          className="btn btn-primary"
          disabled={!submittable}
          onClick={submit}
        >
          {generateMutation.isPending ? '生成中…(检索+LLM 出题)' : '生成题目'}
        </button>
      </div>

      {formError ? (
        <div className="mt-3">
          <ErrorBar message={formError} onRetry={() => generateMutation.mutate({ reuse: false, confirmCloud: false })} />
        </div>
      ) : null}

      {generateMutation.isSuccess ? (
        <p className="mt-3 text-xs" style={{ color: 'var(--success)' }}>
          已生成 {generatedQuestions.length} 题,见下方题卡。
        </p>
      ) : null}
    </section>
  )
}

/** 题目列表:拉 sessions 明细里最新会话的题 */
function QuestionList({
  latestSession,
  onToast,
}: {
  latestSession: QuizSession | null | undefined
  onToast: (text: string, kind?: 'success' | 'error' | 'info') => void
}) {
  const questions = latestSession?.questions ?? []
  if (!questions.length) return null

  return (
    <div>
      {questions.map((q, i) => (
        <QuestionCard key={q.id} question={q} index={i} onToast={onToast} />
      ))}
    </div>
  )
}

/** 空态:还没有出过题 */
function EmptyQuestionList() {
  return (
    <section className="rounded-[10px] border border-dashed px-6 py-10 text-center" style={{ borderColor: 'var(--border)' }}>
      <svg
        viewBox="0 0 24 24"
        width="34"
        height="34"
        fill="none"
        stroke="var(--fg-subtle)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="mx-auto"
      >
        <path d="M5 4.5h11a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 16 19.5H5A1.5 1.5 0 0 1 3.5 18V6A1.5 1.5 0 0 1 5 4.5Z" />
        <path d="M7.5 8.5h7M7.5 12h7M7.5 15.5h4" />
        <path d="m17.5 14.5 3-3M20.5 11.5l1.5 1.5-3.5 3.5-2 .5.5-2Z" />
      </svg>
      <h2 className="mt-3 text-base font-semibold">还没有生成过题目</h2>
      <p className="mt-2 text-xs" style={{ color: 'var(--fg-subtle)' }}>
        没资料?先到 <Link to="/" className="underline" style={{ color: 'var(--accent)' }}>资料库</Link> 上传一份简历或笔记。
      </p>
    </section>
  )
}

export default function QuizPage() {
  const { toast, show } = useToast()

  // 会话列表:GET /api/quiz/sessions(附 n_questions 但不含题目本体)
  // 最新一次会话详情:GET /api/quiz/sessions/{id}(内含 questions + answers),用于渲染题卡
  const detailQuery = useQuery({
    queryKey: ['quiz', 'latest-session'],
    queryFn: async () => {
      const sessions = await get<QuizSession[]>('/api/quiz/sessions')
      if (!sessions.length) return null
      return await get<QuizSession>(`/api/quiz/sessions/${sessions[0].id}`)
    },
  })

  const docsQuery = useQuery({
    queryKey: ['docs'],
    queryFn: () => get<LibraryDoc[]>('/api/docs'),
  })
  const docCount = docsQuery.data?.length ?? 0

  return (
    <div>
      {toast}
      <PageHeader
        title="出题练习"
        actions={
          <span className="tnum text-xs" style={{ color: 'var(--fg-subtle)' }}>
            资料库 {docCount} 份 · 已答 {detailQuery.data?.questions?.filter((q) => (q.answers?.length ?? 0) > 0).length ?? 0} 题
          </span>
        }
      />

      {detailQuery.isError ? (
        <div className="mb-6">
          <ErrorBar
            message={`读取会话失败:请确认后端已启动(127.0.0.1:8000)。${(detailQuery.error as Error)?.message ?? ''}`}
            onRetry={() => void detailQuery.refetch()}
          />
          <div className="mt-4">
            <GenerateToolbar onToast={show} />
          </div>
        </div>
      ) : (
        <>
          <GenerateToolbar onToast={show} />
          <QuestionList latestSession={detailQuery.data} onToast={show} />
          {!detailQuery.isLoading && !detailQuery.data?.questions?.length ? <EmptyQuestionList /> : null}
        </>
      )}
    </div>
  )
}
