import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { get, post } from '../api/client'
import { PageHeader } from '../components/PageHeader'
import type { AnswerRecord, QuizSession } from '../api/types'

function SessionEmptyState({ onCreate, isCreating }: { onCreate: () => void; isCreating: boolean }) {
  return (
    <section className="card p-8 text-center md:p-10">
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
        <path d="M4.5 5.5A2 2 0 0 1 6.5 3.5h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-7l-4.5 3v-3.5h-.5a2 2 0 0 1-2-2v-9.5Z" />
        <path d="M8 9h8M8 12.5h5" />
      </svg>
      <h2 className="mt-3 text-base font-semibold">暂无面试会话</h2>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
        还没有后端保存的面试记录。创建一个会话后，页面会展示真实的题目和回答。
      </p>
      <button type="button" className="btn btn-primary mt-4" onClick={onCreate} disabled={isCreating}>
        {isCreating ? '创建中…' : '创建面试会话'}
      </button>
    </section>
  )
}

function ErrorState({ message, onRetry, isRetrying }: { message: string; onRetry: () => void; isRetrying: boolean }) {
  return (
    <section className="card p-5 md:p-6">
      <p className="py-4 text-sm" style={{ color: 'var(--danger)' }}>
        {message}
      </p>
      <button type="button" className="btn btn-ghost" onClick={onRetry} disabled={isRetrying}>
        {isRetrying ? '重试中…' : '重试'}
      </button>
    </section>
  )
}

function Bubble({ role, text }: { role: 'interviewer' | 'user'; text: string }) {
  if (role === 'interviewer') {
    return (
      <div className="flex max-w-[85%] flex-col gap-1 self-start">
        <div className="card px-4 py-3 text-sm leading-relaxed" style={{ borderRadius: 12 }}>
          {text}
        </div>
        <span className="text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
          面试官
        </span>
      </div>
    )
  }
  return (
    <div className="flex max-w-[85%] flex-col items-end gap-1 self-end">
      <div className="card px-4 py-3 text-sm leading-relaxed" style={{ borderRadius: 12, backgroundColor: 'var(--bg-inset)' }}>
        {text}
      </div>
      <span className="text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
        我
      </span>
    </div>
  )
}

function SessionTranscript({ session }: { session: QuizSession }) {
  const questions = session.questions ?? []
  if (!questions.length) {
    return (
      <section className="card p-8 text-center md:p-10">
        <h2 className="text-base font-semibold">该会话暂无题目</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
          面试追问接口尚未返回题目，当前不会显示任何模拟对话。
        </p>
      </section>
    )
  }

  return (
    <section className="card flex flex-col gap-5 px-5 py-6 md:px-6" aria-label="面试对话区">
      {questions.map((question) => {
        const answers = question.answers ?? []
        return (
          <div key={question.id} className="contents">
            <Bubble role="interviewer" text={question.question} />
            {answers.map((answer: AnswerRecord) =>
              answer.answer_text ? <Bubble key={answer.answer_id} role="user" text={answer.answer_text} /> : null,
            )}
          </div>
        )
      })}
    </section>
  )
}

export default function InterviewPage() {
  const queryClient = useQueryClient()
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null)

  const sessionsQuery = useQuery({
    queryKey: ['quiz', 'sessions'],
    queryFn: () => get<QuizSession[]>('/api/quiz/sessions'),
  })

  const interviewSessions = useMemo(
    () => (sessionsQuery.data ?? []).filter((session) => session.kind === 'interview'),
    [sessionsQuery.data],
  )
  const selectedSessionId = activeSessionId ?? interviewSessions[0]?.id ?? null
  const sessionQuery = useQuery({
    queryKey: ['quiz', 'interview-session', selectedSessionId],
    queryFn: () => get<QuizSession>(`/api/quiz/sessions/${selectedSessionId}`),
    enabled: selectedSessionId !== null,
  })

  const createMutation = useMutation({
    mutationFn: () => post<QuizSession>('/api/quiz/sessions', { kind: 'interview' }),
    onSuccess: (session) => {
      setActiveSessionId(session.id)
      queryClient.invalidateQueries({ queryKey: ['quiz', 'sessions'] })
    },
  })

  const sessionsError = sessionsQuery.error instanceof Error ? sessionsQuery.error.message : ''

  return (
    <div>
      <PageHeader
        title="模拟面试"
        actions={
          interviewSessions.length > 0 ? (
            <button type="button" className="btn btn-primary" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? '创建中…' : '创建面试会话'}
            </button>
          ) : null
        }
      />

      {sessionsQuery.isLoading ? (
        <section className="card p-5 md:p-6">
          <p className="py-4 text-sm" style={{ color: 'var(--fg-muted)' }}>加载中…</p>
        </section>
      ) : sessionsQuery.isError ? (
        <ErrorState
          message={`读取面试会话失败，请确认后端已启动。${sessionsError}`}
          onRetry={() => void sessionsQuery.refetch()}
          isRetrying={sessionsQuery.isFetching}
        />
      ) : interviewSessions.length === 0 ? (
        <SessionEmptyState onCreate={() => createMutation.mutate()} isCreating={createMutation.isPending} />
      ) : sessionQuery.isLoading ? (
        <section className="card p-5 md:p-6">
          <p className="py-4 text-sm" style={{ color: 'var(--fg-muted)' }}>加载会话内容…</p>
        </section>
      ) : sessionQuery.isError ? (
        <ErrorState
          message="读取面试内容失败，请稍后重试。"
          onRetry={() => void sessionQuery.refetch()}
          isRetrying={sessionQuery.isFetching}
        />
      ) : (
        <>
          {interviewSessions.length > 1 ? (
            <label className="mb-4 block max-w-sm text-sm">
              <span className="field-label mb-1 block">选择面试会话</span>
              <select
                className="input w-full"
                value={selectedSessionId ?? ''}
                onChange={(event) => setActiveSessionId(Number(event.target.value))}
              >
                {interviewSessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.title || `会话 ${session.id}`}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {sessionQuery.data ? <SessionTranscript session={sessionQuery.data} /> : null}
        </>
      )}

      {createMutation.isError ? (
        <p className="mt-3 text-sm" style={{ color: 'var(--danger)' }}>
          创建面试会话失败，请稍后重试。
        </p>
      ) : null}
    </div>
  )
}
