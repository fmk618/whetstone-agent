import { useRef, useState } from 'react'
import { PageHeader } from '../components/PageHeader'

/* -----
 * 占位:多轮对话式模拟面试(方案 7.6,后端 routes_interview.py,接 SSE 流式)。
 * 会话轮数等接后端后由 /api/interview/sessions 驱动。
 * ---- */

interface Turn {
  role: 'interviewer' | 'user'
  text: string
}

const INITIAL_TURNS: Turn[] = [
  {
    role: 'interviewer',
    text: '你好,先做个自我介绍吧。结合你简历里最想让我记住的一两个项目讲,不用面面俱到。',
  },
  {
    role: 'user',
    text: '面试官好,我是张伟,做了五年多服务端,近三年主要在 Go 技术栈上。简历里最想让您记住的是风控研发外包平台:我把日均两百万事件的规则引擎改造成了规则加机器学习的双通道,平均延迟从三百毫秒压到八十毫秒。这个项目里我主导架构,也带队评审技术方案。',
  },
  {
    role: 'interviewer',
    text: '八十毫秒这个口径我追问一下:是 P99 还是均值?压到八十毫秒,高峰时段大约扛了多少峰值并发?',
  },
  {
    role: 'user',
    text: '是 P99,均值大概四十五毫秒。高峰时段峰值并发是平时的三倍,大约一万五 QPS,当时通过网关层做了双策略限流来保住 P99。',
  },
  {
    role: 'interviewer',
    text: '好。那为什么选 Redis Stream 替换 Kafka?百人团队滑雪运维成本,你做过什么具体的取舍?',
  },
]

const TOTAL_ROUNDS = 8
/** 面试官气泡数即已完成的轮次 */
const doneRounds = Math.floor(INITIAL_TURNS.filter((t) => t.role === 'interviewer').length)
const roundClamp = Math.min(TOTAL_ROUNDS, Math.max(0, doneRounds))

function Bubble({ turn }: { turn: Turn }) {
  if (turn.role === 'interviewer') {
    return (
      <div className="flex max-w-[85%] flex-col gap-1 self-start">
        <div className="card px-4 py-3 text-sm leading-relaxed" style={{ borderRadius: 12 }}>
          {turn.text}
        </div>
        <span className="text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
          面试官
        </span>
      </div>
    )
  }
  return (
    <div className="flex max-w-[85%] flex-col items-end gap-1 self-end">
      <div
        className="card px-4 py-3 text-sm leading-relaxed"
        style={{ borderRadius: 12, backgroundColor: 'var(--bg-inset)' }}
      >
        {turn.text}
      </div>
      <span className="text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
        我
      </span>
    </div>
  )
}

export default function InterviewPage() {
  const [turns, setTurns] = useState<Turn[]>(INITIAL_TURNS)
  const [draft, setDraft] = useState('')
  const [round, setRound] = useState(roundClamp)
  const scrollRef = useRef<HTMLDivElement>(null)

  async function send() {
    const text = draft.trim()
    if (!text) return
    setTurns((prev) => [...prev, { role: 'user', text }])
    setDraft('')
    // 占位:接后端后由 SSE 流式返回追问;此处回一条确认占位。
    const nextRound = Math.min(TOTAL_ROUNDS, round + 1)
    setTimeout(() => {
      setTurns((prev) => [
        ...prev,
        {
          role: 'interviewer',
          text: `(占位反馈)收到。接后端后这里会根据你的回答流式生成追问,并逐轮计入评分维度。`,
        },
      ])
      setRound(nextRound)
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }, 400)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter 发送,Shift+Enter 换行
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="模拟面试"
        description="多轮追问式面试对话,结束后按评分维度生成总结报告"
        actions={
          <>
            <span
              className="tnum badge badge-neutral"
              aria-live="polite"
            >
              第 {round} / {TOTAL_ROUNDS} 轮
            </span>
            <button className="btn btn-primary">结束并生成报告</button>
          </>
        }
      />

      {/* 对话区。min-h-0 允许 flex 子项在竖向上触发滚动,避免整页塌陷 */}
      <div
        ref={scrollRef}
        className="card flex flex-1 flex-col gap-4 overflow-y-auto py-5"
        style={{ minHeight: 0 }}
        aria-label="面试对话区"
      >
        <div
          className="mx-auto rounded-full px-3 py-1 text-xs"
          style={{ backgroundColor: 'var(--bg-inset)', color: 'var(--fg-muted)' }}
        >
          会话开始 · 岗位:软件开发工程师 · 行业包:互联网 / IT
        </div>
        {turns.map((t, i) => (
          <Bubble key={i} turn={t} />
        ))}
      </div>

      {/* 输入区 */}
      <footer className="mt-3 flex items-end gap-2">
        <label className="sr-only" htmlFor="answer-input">
          输入回答
        </label>
        <textarea
          id="answer-input"
          className="input flex-1 resize-none leading-relaxed"
          style={{ minHeight: 44 }}
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="输入回答……Enter 发送,Shift+Enter 换行"
        />
        <button className="btn btn-primary" onClick={() => void send()} disabled={!draft.trim()}>
          发送
        </button>
      </footer>
    </div>
  )
}
