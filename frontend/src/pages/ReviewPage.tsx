import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { get } from '../api/client'
import { PageHeader } from '../components/PageHeader'
import { Reveal } from '../components/Motion'
import type { ReviewQueueItem } from '../api/types'

function EmptyState() {
  return (
    <section className="card p-8 text-center md:p-10">
      <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="var(--fg-subtle)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mx-auto">
        <path d="M5 4.5h11a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 16 19.5H5A1.5 1.5 0 0 1 3.5 18V6A1.5 1.5 0 0 1 5 4.5Z" />
        <path d="M7.5 8.5h7M7.5 12h7M7.5 15.5h4" />
      </svg>
      <h2 className="mt-3 text-base font-semibold">暂无待复习内容</h2>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
        完成题目并产生复习排期后，到期内容会出现在这里。
      </p>
    </section>
  )
}

function ErrorState({ onRetry, isRetrying }: { onRetry: () => void; isRetrying: boolean }) {
  return (
    <section className="card p-5 md:p-6">
      <p className="py-4 text-sm" style={{ color: 'var(--danger)' }}>
        读取复习队列失败，请确认后端已启动。
      </p>
      <button type="button" className="btn btn-ghost" onClick={onRetry} disabled={isRetrying}>
        {isRetrying ? '重试中…' : '重试'}
      </button>
    </section>
  )
}

function StatCards({ dueCount }: { dueCount: number }) {
  const cells = [
    { label: '今日待复习', value: String(dueCount), detail: '来自后端复习队列', accent: true },
    { label: '薄弱能力', value: '暂无数据', detail: '后端尚未返回能力统计', accent: false },
    { label: '7 日正确率', value: '暂无数据', detail: '后端尚未返回历史统计', accent: false },
  ]

  return (
    <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cells.map((cell) => (
        <div key={cell.label} className="card card-raised px-5 py-5">
          <div className="text-xs" style={{ color: 'var(--fg-muted)' }}>{cell.label}</div>
          <div className="mt-1.5 text-2xl font-semibold leading-9" style={cell.accent ? { color: 'var(--accent)' } : undefined}>
            {cell.value}
          </div>
          <div className="mt-1 text-xs" style={{ color: 'var(--fg-subtle)' }}>{cell.detail}</div>
        </div>
      ))}
    </div>
  )
}

function QueueList({ queue }: { queue: ReviewQueueItem[] }) {
  const today = new Date().toISOString().slice(0, 10)
  return (
    <section className="card">
      <header className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">今日复习队列</h2>
        <span className="text-xs" style={{ color: 'var(--fg-subtle)' }}>来自后端到期记录</span>
      </header>
      <ul className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
        {queue.map((item, index) => {
          const overdue = item.due_on < today
          return (
            <Reveal key={item.review_id} index={index} as="li" className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center" style={{ borderColor: 'var(--border)' }}>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-relaxed">{item.question}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
                  {item.competency ? <span className="badge badge-neutral">{item.competency}</span> : null}
                  <span>到期 {item.due_on.slice(5)}{overdue ? ' · 已逾期' : ''}</span>
                </div>
              </div>
              <Link to="/quiz" className="btn btn-ghost btn-sm shrink-0 sm:ml-4">
                前往练习
              </Link>
            </Reveal>
          )
        })}
      </ul>
    </section>
  )
}

function WeakRankEmpty() {
  return (
    <section className="card">
      <header className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">薄弱点排行</h2>
      </header>
      <p className="py-8 text-center text-sm" style={{ color: 'var(--fg-muted)' }}>
        暂无薄弱能力统计，完成作答后再来查看。
      </p>
    </section>
  )
}

export default function ReviewPage() {
  const reviewQuery = useQuery({
    queryKey: ['quiz', 'review', 'today'],
    queryFn: () => get<ReviewQueueItem[]>('/api/quiz/review/today'),
  })
  const queue = reviewQuery.data ?? []

  return (
    <div>
      <PageHeader
        title="复习看板"
        actions={
          <button type="button" className="btn btn-ghost" onClick={() => void reviewQuery.refetch()} disabled={reviewQuery.isFetching}>
            {reviewQuery.isFetching ? '刷新中…' : '刷新'}
          </button>
        }
      />
      {reviewQuery.isLoading ? (
        <section className="card p-5 md:p-6"><p className="py-4 text-sm" style={{ color: 'var(--fg-muted)' }}>加载中…</p></section>
      ) : reviewQuery.isError ? (
        <ErrorState onRetry={() => void reviewQuery.refetch()} isRetrying={reviewQuery.isFetching} />
      ) : (
        <>
          <StatCards dueCount={queue.length} />
          {queue.length ? (
            <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <QueueList queue={queue} />
              <WeakRankEmpty />
            </div>
          ) : <EmptyState />}
        </>
      )}
    </div>
  )
}
