import { useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { WipPlaceholder } from '../components/PageHeader'
import { Reveal } from '../components/Motion'
import { Select } from '../components/Select'

/* -----
 * 占位数据,结构对齐后端方案 7.2:
 *   OccupationMatch(mapper.py: 标准岗位名 + 置信度)
 *   CompetencyItem(competency.py: name / weight 0-1)
 *   match_resume() → A|B|C(D 类已过滤,不出题)
 * 接后端后替换为 /api/jd + /api/occupation/match + /api/quiz/matrix 的真实返回。
 * ---- */

type MatchCategory = 'A' | 'B' | 'C' | 'D'

interface OccupationMatch {
  standard: string
  industry_pack: string
  confidence: number
  candidates: string[]
}

interface MatrixItem {
  name: string
  weight: number
  category: MatchCategory
}

const SAMPLE_JD = `岗位:资深后端开发工程师(P7)

职责:
1. 负责风控核心链路的设计与演进,日均千万级事件处理;
2. 参与机器学习服务化改造,推动在线推理与规则引擎融合;
3. 主导团队技术方案评审,培养初级工程师。

要求:
- 5 年以上服务端开发经验,精通 Go 或 Java;
- 熟悉 MySQL、Redis、Kafka 等中间件,理解其适用场景与瓶颈;
- 有高并发、高可用系统设计经验,熟悉限流、熔断、降级策略;
- 有机器学习平台或推荐系统背景者优先,数据分析能力加分。`

const MATCH: OccupationMatch = {
  standard: '软件开发工程师',
  industry_pack: '互联网 / IT(tech)',
  confidence: 0.8,
  candidates: ['软件开发工程师', '算法工程师', '数据工程师'],
}

/* 矩阵按权重降序;D 类(JD 不要求、不出题)也展示,只置灰 */
const MATRIX: MatrixItem[] = [
  { name: '系统设计', weight: 0.92, category: 'A' },
  { name: '问题排查', weight: 0.78, category: 'A' },
  { name: '数据库', weight: 0.74, category: 'A' },
  { name: '编程语言与框架', weight: 0.68, category: 'B' },
  { name: '工程实践', weight: 0.55, category: 'B' },
  { name: '计算机基础', weight: 0.4, category: 'C' },
  { name: '数据分析', weight: 0.24, category: 'C' },
  { name: '项目管理', weight: 0.08, category: 'D' },
]

const CATEGORY_META: Record<
  MatchCategory,
  { label: string; badge: string; desc: string }
> = {
  A: { label: 'A 深挖', badge: 'badge-success', desc: 'JD 要求,简历有强证据,走追问链' },
  B: { label: 'B 验证', badge: 'badge-warning', desc: 'JD 要求,简历仅罗列,验证真伪' },
  C: { label: 'C 补短', badge: 'badge-accent', desc: 'JD 要求,简历没有,考察基础与学习能力' },
  D: { label: 'D 不出题', badge: 'badge-neutral', desc: 'JD 不要求,基本不问' },
}

function JdEditor() {
  const [jd, setJd] = useState(SAMPLE_JD)
  const [parsed, setParsed] = useState(true)
  const [standard, setStandard] = useState(MATCH.standard)

  const pct = Math.round(MATCH.confidence * 100)

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <section className="card">
        <h2 className="mb-3 text-base font-semibold">岗位描述</h2>

        <label className="sr-only" htmlFor="jd-text">
          岗位描述原文
        </label>
        <textarea
          id="jd-text"
          className="input w-full min-h-[240px] resize-y leading-relaxed"
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          placeholder="粘贴岗位 JD 原文……"
        />

        <div className="mt-3 flex items-center justify-between">
          <span className="tnum text-xs" style={{ color: 'var(--fg-subtle)' }}>
            {jd.length} 字
          </span>
          <button className="btn btn-primary" onClick={() => setParsed(true)}>
            解析岗位
          </button>
        </div>
      </section>

      <section className="card flex flex-col">
        <h2 className="mb-3 text-base font-semibold">岗位映射</h2>

        {parsed ? (
          <div className="flex flex-1 flex-col gap-4">
            <div>
              <span className="field-label mb-1.5 block">标准职业名</span>
              <Select
                value={standard}
                onChange={setStandard}
                options={MATCH.candidates.map((name) => ({ value: name, label: name }))}
                ariaLabel="标准职业名"
              />
            </div>

            <div className="rounded-lg px-3.5 py-3" style={{ backgroundColor: 'var(--bg-inset)' }}>
              <div className="flex items-baseline justify-between">
                <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                  匹配置信度
                </span>
                <span className="tnum text-sm font-semibold">{pct}%</span>
              </div>
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full"
                style={{ backgroundColor: 'var(--bg)' }}
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="岗位映射置信度"
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: 'var(--accent)' }}
                />
              </div>
            </div>

            <WipPlaceholder
              label="行业包选择 / 能力矩阵持久化(/api/jd)"
              phase="P2"
            />
          </div>
        ) : (
          <p className="flex flex-1 items-center text-sm" style={{ color: 'var(--fg-muted)' }}>
            尚未解析。粘贴 JD 后点「解析岗位」,得到标准职业名与能力矩阵。
          </p>
        )}
      </section>
    </div>
  )
}

function CategoryLegend() {
  return (
    <ul className="flex flex-wrap items-end gap-x-2 gap-y-1.5">
      {(['A', 'B', 'C', 'D'] as MatchCategory[]).map((k) => (
        <li key={k}>
          <span className={`badge ${CATEGORY_META[k].badge}`}>{CATEGORY_META[k].label}</span>
        </li>
      ))}
    </ul>
  )
}

function MatrixTable() {
  return (
    <section className="card">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">能力矩阵</h2>
        <CategoryLegend />
      </header>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs" style={{ borderColor: 'var(--border)', color: 'var(--fg-subtle)' }}>
            <th className="py-2 pr-4 font-medium">能力项</th>
            <th className="py-2 pr-4 font-medium" style={{ width: '40%' }}>权重</th>
            <th className="py-2 font-medium">类别</th>
          </tr>
        </thead>
        <tbody>
          {MATRIX.map((m, i) => {
            const meta = CATEGORY_META[m.category]
            const pct = Math.round(m.weight * 100)
            return (
              <Reveal
                key={m.name}
                index={i}
                as="tr"
                className="border-b last:border-b-0"
                style={{ ...(m.category === 'D' ? { opacity: 0.55 } : undefined), borderColor: 'var(--border)' }}
              >
                <td className="py-2.5 pr-4">{m.name}</td>
                <td className="py-2.5 pr-4">
                  <div className="flex items-center gap-2.5">
                    <div className="bar-grow h-1.5 min-w-16 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--bg-inset)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(pct, 2)}%`,
                          backgroundColor: m.category === 'D' ? 'var(--border-strong)' : 'var(--accent)',
                        }}
                      />
                    </div>
                    <span className="tnum w-9 text-right text-xs" style={{ color: 'var(--fg-muted)' }}>
                      {pct}%
                    </span>
                  </div>
                </td>
                <td className="py-2.5">
                  <span className={`badge ${meta.badge}`}>{meta.label}</span>
                </td>
              </Reveal>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}

export default function JobPage() {
  return (
    <div>
      <PageHeader title="目标岗位" />
      <div className="flex flex-col gap-6 lg:gap-8">
        <JdEditor />
        <MatrixTable />
      </div>
    </div>
  )
}
