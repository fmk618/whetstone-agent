import { PageHeader } from '../components/PageHeader'
import { CountUp, Reveal } from '../components/Motion'

/* -----
 * 占位数据,结构对齐后端方案 7.8(review_queue 表:competency / due_on / done,
 * 按 1 / 3 / 7 天间隔重复;正确率按 views 的 answers.score 聚合)。
 * 接后端后替换为 /api/quiz/review/today 的真实返回。
 * ---- */

interface ReviewItem {
  question_id: number
  question: string
  competency: string
  due_on: string
  last_score: number | null
}

interface WeakItem {
  competency: string
  accuracy: number // 0-100
  attempts: number
}

const DUE_COUNT = 6

const QUEUE: ReviewItem[] = [
  {
    question_id: 41,
    question: 'Redis Stream 与 Kafka 在消费端 exactly-once 语义上的差异是什么?你在项目里怎么取舍?',
    competency: '数据库与缓存',
    due_on: '2026-10-05',
    last_score: 52,
  },
  {
    question_id: 37,
    question: '网关限流:滑动窗口和令牌桶分别在什么场景失效?你的双策略怎么组合?',
    competency: '系统设计',
    due_on: '2026-10-05',
    last_score: 60,
  },
  {
    question_id: 29,
    question: 'P99 从 850ms 降到 120ms,火焰图定位的前三步是什么?哪一步最容易误判?',
    competency: '问题排查',
    due_on: '2026-10-05',
    last_score: null,
  },
  {
    question_id: 24,
    question: 'MySQL 联合索引的最左前缀,在覆盖索引场景下会怎么变化?',
    competency: '数据库与缓存',
    due_on: '2026-10-03',
    last_score: 45,
  },
  {
    question_id: 19,
    question: 'Go 的调度器 GMP 模型中,什么情况下会发生 work-stealing?',
    competency: '编程语言与框架',
    due_on: '2026-10-01',
    last_score: 58,
  },
  {
    question_id: 12,
    question: '讲一个你推动跨团队接口规范的具体过程,冲突怎么处理?',
    competency: '团队协作',
    due_on: '2026-09-28',
    last_score: null,
  },
]

const WEAK: WeakItem[] = [
  { competency: '数据库与缓存', accuracy: 46, attempts: 13 },
  { competency: '编程语言与框架', accuracy: 54, attempts: 11 },
  { competency: '项目管理', accuracy: 62, attempts: 6 },
  { competency: '团队协作', accuracy: 71, attempts: 4 },
  { competency: '系统设计', accuracy: 78, attempts: 9 },
]

const WEEKLY_ACCURACY = 66

function StatCards() {
  const cells = [
    {
      label: '今日待复习',
      parsed: DUE_COUNT,
      suffix: '',
      detail: '1 / 3 / 7 天间隔到期',
      accent: true,
    },
    {
      label: '薄弱能力',
      parsed: WEAK.length,
      suffix: '',
      detail: '正确率低于 75% 的能力项',
      accent: false,
    },
    {
      label: '7 日正确率',
      parsed: WEEKLY_ACCURACY,
      suffix: '%',
      detail: '近一周作答的平均分(0-100 折算)',
      accent: false,
    },
  ]
  return (
    <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cells.map((c) => (
        <div key={c.label} className="card card-raised px-5 py-5">
          <div className="text-xs" style={{ color: 'var(--fg-muted)' }}>
            {c.label}
          </div>
          <CountUp
            className="mt-1.5 inline-block text-3xl font-semibold leading-9"
            style={c.accent ? { color: 'var(--accent)' } : undefined}
            value={c.parsed}
            suffix={c.suffix}
          />
          <div className="mt-1 text-xs" style={{ color: 'var(--fg-subtle)' }}>
            {c.detail}
          </div>
        </div>
      ))}
    </div>
  )
}

function QueueList() {
  return (
    <section className="card">
      <header className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">今日复习队列</h2>
        <span className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
          低分与未作答题优先
        </span>
      </header>

      <ul className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
        {QUEUE.map((q, i) => {
          const overdue = q.due_on < '2026-10-05'
          return (
            <Reveal key={q.question_id} index={i} as="li" className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center" style={{ borderColor: 'var(--border)' }}>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-relaxed">{q.question}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
                  <span className="badge badge-neutral">{q.competency}</span>
                  <span>
                    到期 {q.due_on.slice(5)}
                    {overdue ? ' · 已逾期' : ''}
                  </span>
                  {q.last_score !== null ? (
                    <span className="tnum">上次得分 {q.last_score}</span>
                  ) : (
                    <span>上次未作答</span>
                  )}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm shrink-0 sm:ml-4">开始复习</button>
            </Reveal>
          )
        })}
      </ul>
    </section>
  )
}

function WeakRank() {
  return (
    <section className="card">
      <header className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">薄弱点排行</h2>
        <span className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
          按正确率升序
        </span>
      </header>

      <ul className="flex flex-col gap-4">
        {WEAK.map((w, i) => {
          const pct = Math.round(w.accuracy)
          return (
            <Reveal key={w.competency} index={i} as="li">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{w.competency}</span>
                <span className="tnum text-xs" style={{ color: 'var(--fg-muted)' }}>
                  {pct}% · {w.attempts} 次作答
                </span>
              </div>
              <div
                className="bar-grow mt-1.5 h-1.5 overflow-hidden rounded-full"
                style={{ backgroundColor: 'var(--bg-inset)' }}
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${w.competency} 正确率`}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(pct, 2)}%`,
                    backgroundColor: pct < 55 ? 'var(--danger)' : pct < 75 ? 'var(--warning)' : 'var(--success)',
                  }}
                />
              </div>
            </Reveal>
          )
        })}
      </ul>
    </section>
  )
}

export default function ReviewPage() {
  return (
    <div>
      <PageHeader title="复习看板" />
      <StatCards />
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <QueueList />
        <WeakRank />
      </div>
    </div>
  )
}
