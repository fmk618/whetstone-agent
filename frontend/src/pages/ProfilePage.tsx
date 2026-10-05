import { PageHeader } from '../components/PageHeader'

/* -----
 * 占位数据,结构对齐后端方案 7.1(profile.py 的 ExtractionResult):
 *   documents 表 + profile_claims 表(competency / ctype / claim_text / strength)
 * 接后端后替换为 /api/profile 的真实返回。
 * ---- */

type EvidenceType = 'task' | 'knowledge' | 'skill' | 'work_style'
type ClaimStrength = 'has_metric' | 'listed_only' | 'none'

interface Claim {
  text: string
  evidence_strength: ClaimStrength
  source: { file: string; section?: string }
}

interface CompetencyProfile {
  competency: string
  type: EvidenceType
  domain: string
  claims: Claim[]
}

interface ProfileDoc {
  id: string
  filename: string
  doc_type: string
  sensitivity: 'local_only' | 'cloud_ok'
  n_chunks: number
}

const TYPE_META: Record<EvidenceType, { label: string; badge: string }> = {
  task: { label: '任务', badge: 'badge-accent' },
  knowledge: { label: '知识', badge: 'badge-neutral' },
  skill: { label: '技能', badge: 'badge-success' },
  work_style: { label: '工作风格', badge: 'badge-warning' },
}

/* 徽章色分三档:has_metric 有量化 → 实证;listed_only 仅罗列 → 待验证;none 无证 → 空缺 */
const STRENGTH_META: Record<ClaimStrength, { label: string; badge: string }> = {
  has_metric: { label: '有量化', badge: 'badge-success' },
  listed_only: { label: '仅罗列', badge: 'badge-warning' },
  none: { label: '无证据', badge: 'badge-danger' },
}

export const DOCS: ProfileDoc[] = [
  { id: 'a3f9', filename: '张伟-高级后端工程师-简历.md', doc_type: 'resume', sensitivity: 'local_only', n_chunks: 34 },
  { id: 'b7c1', filename: '风控研发外包平台-项目复盘.md', doc_type: 'project', sensitivity: 'local_only', n_chunks: 21 },
  { id: 'c2d8', filename: 'Redis 沉浸式学习笔记.md', doc_type: 'notes', sensitivity: 'local_only', n_chunks: 57 },
]

const COMPETENCIES: CompetencyProfile[] = [
  {
    competency: '系统设计',
    type: 'task',
    domain: 'tech',
    claims: [
      {
        text: '主导风控研发外包平台架构,将日均 200 万事件的规则引擎改造为规则 + 机器学习双通道,平均处理延迟降至 80ms。',
        evidence_strength: 'has_metric',
        source: { file: '张伟-高级后端工程师-简历.md', section: '项目经历 · 风控平台' },
      },
      {
        text: '负责网关层限流方案设计,采用滑动窗口 + 令牌桶双策略。',
        evidence_strength: 'listed_only',
        source: { file: '风控研发外包平台-项目复盘.md', section: '架构决策' },
      },
    ],
  },
  {
    competency: '数据库与缓存',
    type: 'knowledge',
    domain: 'tech',
    claims: [
      {
        text: '用 Redis Stream 替换 Kafka 解决百人团队运维成本问题,QPS 1.2 万下消息零积压。',
        evidence_strength: 'has_metric',
        source: { file: 'Redis 沉浸式学习笔记.md', section: '生产实践' },
      },
      {
        text: '熟悉 MySQL 索引原理与慢查询优化。',
        evidence_strength: 'listed_only',
        source: { file: '张伟-高级后端工程师-简历.md', section: '技能清单' },
      },
      {
        text: '了解 LSM-Tree 与 B+Tree 的选型差异。',
        evidence_strength: 'none',
        source: { file: 'Redis 沉浸式学习笔记.md', section: '存储引擎' },
      },
    ],
  },
  {
    competency: '问题排查',
    type: 'skill',
    domain: 'tech',
    claims: [
      {
        text: '通过火焰图定位 GC 停顿尖刺,将服务 P99 从 850ms 降到 120ms。',
        evidence_strength: 'has_metric',
        source: { file: '风控研发外包平台-项目复盘.md', section: '性能优化' },
      },
      {
        text: '多次担任on-call首选,处理过生产环境 OOM 与死锁事故。',
        evidence_strength: 'listed_only',
        source: { file: '张伟-高级后端工程师-简历.md', section: '工作经历' },
      },
    ],
  },
  {
    competency: '团队协作',
    type: 'work_style',
    domain: 'general',
    claims: [
      {
        text: '跨 3 个团队协调数据中台接口规范,推动两个部门统一发布窗口。',
        evidence_strength: 'listed_only',
        source: { file: '风控研发外包平台-项目复盘.md', section: '协作' },
      },
    ],
  },
  {
    competency: '编程语言与框架',
    type: 'knowledge',
    domain: 'tech',
    claims: [
      {
        text: '熟悉 Python / Go / Java,生产环境以 Go 为主(近三年)。',
        evidence_strength: 'listed_only',
        source: { file: '张伟-高级后端工程师-简历.md', section: '技能清单' },
      },
      {
        text: '读过 netpoll 源码并实现过小规模 EventLoop。',
        evidence_strength: 'none',
        source: { file: 'Redis 沉浸式学习笔记.md' },
      },
    ],
  },
  {
    competency: '表达结构',
    type: 'skill',
    domain: 'general',
    claims: [
      {
        text: '在风控平台复盘材料中使用 STAR 结构陈述,被主管评价为“清晰、可复述”。',
        evidence_strength: 'listed_only',
        source: { file: '风控研发外包平台-项目复盘.md', section: '复盘结论' },
      },
    ],
  },
]

const totalClaims = COMPETENCIES.reduce((n, c) => n + c.claims.length, 0)
const strongClaimCount = COMPETENCIES.reduce(
  (n, c) => n + c.claims.filter((x) => x.evidence_strength === 'has_metric').length,
  0,
)
const weakCompetencyCount = COMPETENCIES.filter(
  (c) => !c.claims.some((x) => x.evidence_strength === 'has_metric'),
).length

/** 顶部汇总条:能力总数 / 证据总数 / 弱证据能力数 */
function SummaryStrip() {
  return (
    <div
      className="mb-5 grid grid-cols-3 overflow-hidden rounded-[10px] border"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)' }}
    >
      {[
        { label: '能力项', value: String(COMPETENCIES.length), hint: '来自 3 份文档' },
        { label: '证据声明', value: String(totalClaims), hint: `其中 ${strongClaimCount} 条带量化指标` },
        {
          label: '弱证据能力',
          value: String(weakCompetencyCount),
          hint: '面试时会被验证,优先复习',
          warn: weakCompetencyCount > 0,
        },
      ].map((cell, i) => (
        <div
          key={cell.label}
          className="px-5 py-4"
          style={i > 0 ? { borderLeft: '1px solid var(--border)' } : undefined}
        >
          <div
            className="tnum text-2xl font-semibold leading-7"
            style={cell.warn ? { color: 'var(--warning)' } : undefined}
          >
            {cell.value}
          </div>
          <div className="mt-1 text-sm font-medium">{cell.label}</div>
          <div className="mt-0.5 text-xs" style={{ color: 'var(--fg-subtle)' }}>
            {cell.hint}
          </div>
        </div>
      ))}
    </div>
  )
}

function CompetencyCard({ c }: { c: CompetencyProfile }) {
  const type = TYPE_META[c.type]
  return (
    <article className="card flex flex-col">
      <header className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-snug">{c.competency}</h2>
          <div className="mt-1 text-xs" style={{ color: 'var(--fg-subtle)' }}>
            {c.domain === 'general' ? '通用能力' : `${c.domain} 方向`}
          </div>
        </div>
        <span className={`badge shrink-0 ${type.badge}`}>{type.label}</span>
      </header>

      <ul className="flex flex-col gap-2.5">
        {c.claims.map((claim, i) => {
          const st = STRENGTH_META[claim.evidence_strength]
          return (
            <li key={i} className="text-[13px] leading-relaxed">
              <div className="flex items-start gap-2">
                <span className={`badge shrink-0 ${st.badge}`} style={{ marginTop: 2 }}>
                  {st.label}
                </span>
                <p className="min-w-0">{claim.text}</p>
              </div>
              <div className="mt-1 pl-[52px] text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
                出自 {claim.source.file}
                {claim.source.section ? ` · ${claim.source.section}` : ''}
              </div>
            </li>
          )
        })}
      </ul>
    </article>
  )
}

export default function ProfilePage() {
  return (
    <div>
      <PageHeader
        title="知识档案"
        description="能力项由资料库提取整理而来,每条声明都可回溯到原文出处"
        actions={
          <button className="btn btn-ghost">
            重新提取档案
          </button>
        }
      />

      <SummaryStrip />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {COMPETENCIES.map((c) => (
          <CompetencyCard key={c.competency} c={c} />
        ))}
      </div>
    </div>
  )
}
