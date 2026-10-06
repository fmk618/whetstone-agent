import { useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { Reveal } from '../components/Motion'

/* ============================================================
   出题练习页:生成工具条 + 题卡视觉形态(占位数据)
   后续接入 POST /api/quiz/sessions 后,把 MOCK_QUESTIONS
   换成接口返回的题目数组即可,视觉结构不变。
   ============================================================ */

type Difficulty = 1 | 2 | 3 | 4 | 5

/** 题目结构(与后端 quiz 域字段对齐的占位形态) */
interface QuizQuestion {
  id: string
  question_type: 'concept' | 'coding' | 'system_design' | 'behavioral'
  difficulty: Difficulty
  layer: '基础' | '进阶' | '项目' | '开放'
  stem: string
  reference_answer: string
  source_refs: Array<{ filename: string; chunk_index: number; snippet: string }>
}

const MOCK_QUESTIONS: QuizQuestion[] = [
  {
    id: 'q_01jb9x',
    question_type: 'concept',
    difficulty: 3,
    layer: '基础',
    stem: '解释 Kafka 中「消费者组(Consumer Group)」的 rebalance 触发条件,以及 rebalance 期间消费会发生了什么。',
    reference_answer:
      'rebalance 的常见触发条件:1) 组成员变化——消费者加入或离开(进程崩溃、心跳超时 session.timeout.ms 未续约);2) 订阅的 topic 分区数变化;3) 订阅关系(正则订阅匹配到新 topic)变化。\n\nrebalance 期间:整个消费者组进入 STABLE → PREPARING_REBALANCE 状态,所有成员放弃已分配分区并停止消费(老协议下会 stop-the-world), coordinator 重新分配分区后各消费者重新提交/恢复 offset。频繁 rebalance 通常由消费处理时间超过 max.poll.interval.ms 引起。',
    source_refs: [
      {
        filename: '笔记_Kafka核心机制.md',
        chunk_index: 12,
        snippet: '……当 group 下任一成员心跳超时,coordinator 将触发 rebalance,组内所有消费者暂停拉取……',
      },
      {
        filename: '面经_2025秋招_Golang合集.md',
        chunk_index: 7,
        snippet: '……面试官追问:rebalance 时为什么不能用抢占式分配?提示 CooperativeStickyAssignor……',
      },
    ],
  },
  {
    id: 'q_01jba2',
    question_type: 'system_design',
    difficulty: 4,
    layer: '项目',
    stem: '你的简历项目里写了「日志采集服务峰值 5 万条/秒」。请设计该服务的背压(backpressure)策略:当下游写入 Elasticsearch 变慢时,如何避免内存暴涨与数据丢失?',
    reference_answer:
      '可分层回答:1) 入口限流:按下游健康度动态调整采集端批量大小与并发;2) 有界队列 + 丢弃策略:内存队列设上界,超界按「可丢日志优先丢弃、审计日志落盘」分级处理;3) 批量写 ES 时用 bulk + 重试队列,429 时指数退避;4) 优雅降级:下游不可用时临时落盘(本地 WAL),恢复后回放。强调不丢数据与内存安全之间的取舍是面试考察点。',
    source_refs: [
      {
        filename: '张三_后端工程师_简历.pdf',
        chunk_index: 3,
        snippet: '……主导日志采集链路优化,峰值 5 万条/秒,P99 延迟低于 800ms……',
      },
    ],
  },
  {
    id: 'q_01jba6',
    question_type: 'coding',
    difficulty: 2,
    layer: '基础',
    stem: '用 Go 实现一个带过期时间的并发安全 LRU 缓存:Get(key) 与 Set(key, value, ttl),过期项在读取时应被视为不存在。',
    reference_answer:
      '核心结构:sync.Mutex(或分片锁降低争用)+ map[key]*list.Element + container/list 维护访问顺序。Get:查 map,命中后检查过期时间(存 absolute deadline),过期则惰性删除并返回 miss,未过期则 MoveToFront。Set:存在则更新值与 deadline 并 MoveToFront,不存在则 PushFront,超容量时 RemoveBack。可补充:后台协程定期清理惰性删除遗漏的尾部过期项。',
    source_refs: [
      {
        filename: '面经_2025秋招_Golang合集.md',
        chunk_index: 15,
        snippet: '……手写题:实现带 TTL 的 LRU,考察 map + 双向链表 + 锁粒度设计……',
      },
    ],
  },
]

const QUESTION_TYPE_META: Record<QuizQuestion['question_type'], { label: string; badge: string }> = {
  concept: { label: '概念题', badge: 'badge-neutral' },
  coding: { label: '编码题', badge: 'badge-accent' },
  system_design: { label: '系统设计', badge: 'badge-success' },
  behavioral: { label: '行为面', badge: 'badge-warning' },
}

const LAYER_BADGE: Record<QuizQuestion['layer'], string> = {
  基础: 'badge-neutral',
  进阶: 'badge-accent',
  项目: 'badge-success',
  开放: 'badge-warning',
}

/** 难度星:实心 = 难度,空心 = 剩余 */
function DifficultyStars({ level }: { level: Difficulty }) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={`难度 ${level} / 5`}
      title={`难度 ${level} / 5`}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          width="12"
          height="12"
          fill={i < level ? 'var(--accent)' : 'none'}
          stroke={i < level ? 'var(--accent)' : 'var(--fg-subtle)'}
          strokeWidth="1.5"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m12 3.5 2.47 5.01 5.53.8-4 3.9.94 5.5L12 16.13 7.06 18.7 8 13.22l-4-3.9 5.53-.8L12 3.5Z" />
        </svg>
      ))}
      <span className="tnum ml-1 font-mono text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
        {level}/5
      </span>
    </span>
  )
}

/** 单张题卡:题面 / 难度 / layer / 参考答案折叠 / 出处引用块 */
function QuestionCard({ question, index }: { question: QuizQuestion; index: number }) {
  const [revealed, setRevealed] = useState(false)
  const typeMeta = QUESTION_TYPE_META[question.question_type]

  return (
    <Reveal index={index} as="article" className="card card-raised mb-6">
      {/* 题头:序号 + 类型徽章 + layer 徽章 + 难度星 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className="tnum flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-mono text-xs font-semibold"
          style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}
          aria-hidden="true"
        >
          {index + 1}
        </span>
        <span className={`badge ${typeMeta.badge}`}>{typeMeta.label}</span>
        <span className={`badge ${LAYER_BADGE[question.layer]}`}>{question.layer}</span>
        <span className="ml-auto">
          <DifficultyStars level={question.difficulty} />
        </span>
      </div>

      {/* 题面 */}
      <p className="text-[15px] font-medium leading-relaxed">{question.stem}</p>

      {/* 参考答案(折叠) */}
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
          {question.reference_answer.split('\n\n').map((para, i) => (
            <p key={i} className={i > 0 ? 'mt-2.5' : undefined}>
              {para}
            </p>
          ))}
        </div>
      </details>

      {/* 出处引用块 */}
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
          {question.source_refs.map((ref, i) => (
            <blockquote
              key={i}
              className="rounded-md px-3 py-2 text-xs leading-relaxed"
              style={{
                backgroundColor: 'var(--bg-inset)',
                borderLeft: '2px solid var(--accent)',
                color: 'var(--fg-muted)',
              }}
            >
              <span className="font-mono text-[11px]" style={{ color: 'var(--accent)' }}>
                {ref.filename}
              </span>
              <span className="tnum mx-1.5 font-mono text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
                · block #{ref.chunk_index}
              </span>
              <div className="mt-0.5">{ref.snippet}</div>
            </blockquote>
          ))}
        </div>
      </div>
    </Reveal>
  )
}

/** 生成题目工具条:题型 / 难度 / 范围选择器(样式占位) */
function GenerateToolbar() {
  return (
    <section className="card card-raised mb-8">
      <h2 className="mb-3 text-base font-semibold">生成题目</h2>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[130px]">
          <label className="field-label mb-1" htmlFor="quiz-type">
            题型
          </label>
          <select id="quiz-type" className="input">
            <option>全部题型</option>
            <option>概念题</option>
            <option>编码题</option>
            <option>系统设计</option>
            <option>行为面</option>
          </select>
        </div>

        <div className="min-w-[110px]">
          <label className="field-label mb-1" htmlFor="quiz-difficulty">
            难度
          </label>
          <select id="quiz-difficulty" className="input" defaultValue="3">
            <option value="1">★☆☆☆☆ 入门</option>
            <option value="2">★★☆☆☆ 简单</option>
            <option value="3">★★★☆☆ 中等</option>
            <option value="4">★★★★☆ 较难</option>
            <option value="5">★★★★★ 硬核</option>
          </select>
        </div>

        <div className="min-w-[180px]">
          <label className="field-label mb-1" htmlFor="quiz-scope">
            出题范围
          </label>
          <select id="quiz-scope" className="input">
            <option>全部资料库</option>
            <option>简历 + 当前目标岗位</option>
            <option>仅面经文档</option>
            <option>仅笔记文档</option>
          </select>
        </div>

        <div className="min-w-[100px]">
          <label className="field-label mb-1" htmlFor="quiz-count">
            题目数量
          </label>
          <select id="quiz-count" className="input" defaultValue="5">
            <option value="3">3 题</option>
            <option value="5">5 题</option>
            <option value="10">10 题</option>
          </select>
        </div>

        <button type="button" className="btn btn-primary h-[32px]" disabled>
          生成题目
        </button>
      </div>
      <p className="mt-2.5 text-xs" style={{ color: 'var(--fg-subtle)' }}>
        出题仅使用标记为「仅本机」的模型时,资料内容不会离开本机;每道题都会附上来源片段,便于回查原文。
      </p>
    </section>
  )
}

/** /quiz 出题练习:生成工具条 + 题卡列表(占位数据展示完整视觉形态) */
export default function QuizPage() {
  return (
    <div>
      <PageHeader
        title="出题练习"
        description="基于资料库与目标岗位生成练习题并作答"
        actions={
          <span className="tnum text-xs" style={{ color: 'var(--fg-subtle)' }}>
            本组 3 题 · 已答 0
          </span>
        }
      />
      <GenerateToolbar />
      {MOCK_QUESTIONS.map((q, i) => (
        <QuestionCard key={q.id} question={q} index={i} />
      ))}
    </div>
  )
}
