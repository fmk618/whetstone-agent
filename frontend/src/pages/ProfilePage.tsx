import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQueries, useQuery } from '@tanstack/react-query'
import { get } from '../api/client'
import { PageHeader } from '../components/PageHeader'
import { CountUp, Reveal } from '../components/Motion'
import type { LibraryDoc, ProfileClaim } from '../api/types'

/* ------
 * 知识档案页:GET /api/docs → 逐份文档 GET /api/docs/{id}/profile(profile_claims 表)
 * 后端把抽取结果按「文档一行一声明」存,前端按 competency 聚合成能力卡片。
 * 每条声明可回溯到原文出处(文档文件名 + 章节名)。
 * ------ */

type ClaimStrength = ProfileClaim['strength']

interface CompetencyCardData {
  competency: string
  type: ProfileClaim['ctype']
  domain: string
  claims: ProfileClaim[]
  docFilename: string
}

const TYPE_META: Record<ProfileClaim['ctype'], { label: string; badge: string }> = {
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

/** 按 competency 聚合 profile_claims(来源文档作为第一条声明 label 提示) */
function buildCompetencies(
  docs: LibraryDoc[],
  claimByDoc: Map<string, ProfileClaim[] | undefined>,
): CompetencyCardData[] {
  const byName = new Map<string, CompetencyCardData>()
  for (const doc of docs) {
    const claims = claimByDoc.get(doc.id)
    if (!claims) continue
    for (const claim of claims) {
      const key = claim.competency
      const existing = byName.get(key)
      if (existing) {
        existing.claims.push(claim)
      } else {
        byName.set(key, {
          competency: claim.competency,
          type: claim.ctype,
          domain: claim.domain ?? 'general',
          claims: [claim],
          docFilename: doc.filename,
        })
      }
    }
  }
  return [...byName.values()]
}

function EmptyState() {
  return (
    <section className="card p-8 text-center md:p-10">
      <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="var(--fg-subtle)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mx-auto">
        <path d="M3.5 7A2.5 2.5 0 0 1 6 4.5h3.2c.7 0 1.4.3 1.9.9l.9 1.1h6A2.5 2.5 0 0 1 20.5 9v8A2.5 2.5 0 0 1 18 19.5H6A2.5 2.5 0 0 1 3.5 17V7Z" />
        <path d="M7.5 12.5h9M7.5 15.5h6" />
      </svg>
      <h2 className="mt-3 text-base font-semibold">档案还是空的</h2>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
        上传第一份简历或项目文档后,系统会自动抽取能力项生成知识档案。每个能力项都带有可回溯的原文出处。
      </p>
      <Link to="/" className="btn btn-primary mt-4">先上传资料</Link>
    </section>
  )
}

function ErrorState({ onRetry, isRetrying }: { onRetry: () => void; isRetrying: boolean }) {
  return (
    <section className="card p-5 md:p-6">
      <div className="py-4 text-sm" style={{ color: 'var(--danger)' }}>
        读取文档失败:请确认后端已启动(127.0.0.1:8000)。
      </div>
      <button type="button" className="btn btn-ghost" onClick={onRetry} disabled={isRetrying}>
        {isRetrying ? '重试中…' : '重试'}
      </button>
    </section>
  )
}

/** 顶部汇总条:能力总数 / 证据总数 / 弱证据能力数 */
function SummaryStrip({
  competencyCount,
  totalClaims,
  strongClaimCount,
  weakCompetencyCount,
  docCount,
}: {
  competencyCount: number
  totalClaims: number
  strongClaimCount: number
  weakCompetencyCount: number
  docCount: number
}) {
  return (
    <div
      className="mb-8 grid grid-cols-1 sm:grid-cols-3 overflow-hidden rounded-[10px] border"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)' }}
    >
      {[
        { label: '能力项', parsed: competencyCount, hint: `来自 ${docCount} 份文档` },
        { label: '证据声明', parsed: totalClaims, hint: `其中 ${strongClaimCount} 条带量化指标` },
        {
          label: '弱证据能力',
          parsed: weakCompetencyCount,
          hint: '面试时会被验证,优先复习',
          warn: weakCompetencyCount > 0,
        },
      ].map((cell, i) => (
        <div
          key={cell.label}
          className="px-5 py-4"
          style={i > 0 ? { borderLeft: '1px solid var(--border)' } : undefined}
        >
          <CountUp
            className="inline-block text-2xl font-semibold leading-7"
            style={cell.warn ? { color: 'var(--warning)' } : undefined}
            value={cell.parsed}
          />
          <div className="mt-1 text-sm font-medium">{cell.label}</div>
          <div className="mt-0.5 text-xs" style={{ color: 'var(--fg-subtle)' }}>
            {cell.hint}
          </div>
        </div>
      ))}
    </div>
  )
}

function CompetencyCard({ c, revealIndex }: { c: CompetencyCardData; revealIndex: number }) {
  const type = TYPE_META[c.type]
  return (
    <Reveal index={revealIndex} as="article" className="card card-raised flex flex-col">
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
        {c.claims.map((claim) => {
          const st = STRENGTH_META[claim.strength]
          return (
            <li key={claim.id} className="text-[13px] leading-relaxed">
              <div className="flex items-start gap-2">
                <span className={`badge shrink-0 ${st.badge}`} style={{ marginTop: 2 }}>
                  {st.label}
                </span>
                <p className="min-w-0">{claim.claim_text}</p>
              </div>
              <div className="mt-1 pl-[52px] text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
                出自 {claim.source_file || c.docFilename}
                {claim.source_section ? ` · ${claim.source_section}` : ''}
              </div>
            </li>
          )
        })}
      </ul>
    </Reveal>
  )
}

export default function ProfilePage() {
  const docsQuery = useQuery({
    queryKey: ['docs'],
    queryFn: () => get<LibraryDoc[]>('/api/docs'),
  })

  const docs = useMemo(() => docsQuery.data ?? [], [docsQuery.data])

  // 每份文档对应一次 /profile 请求(数量可控,后端单表索引按 doc_id 命中)
  const profileQueries = useQueries({
    queries: docs.map((doc) => ({
      queryKey: ['profile', doc.id],
      queryFn: () => get<ProfileClaim[]>(`/api/docs/${doc.id}/profile`),
      enabled: Boolean(doc.id),
    })),
  })

  const claimByDoc = useMemo(() => {
    const m = new Map<string, ProfileClaim[] | undefined>()
    for (let i = 0; i < docs.length; i++) {
      m.set(docs[i].id, profileQueries[i]?.data)
    }
    return m
  }, [docs, profileQueries])

  const competencies = useMemo(() => buildCompetencies(docs, claimByDoc), [docs, claimByDoc])

  const totalClaims = competencies.reduce((n, c) => n + c.claims.length, 0)
  const strongClaimCount = competencies.reduce(
    (n, c) => n + c.claims.filter((x) => x.strength === 'has_metric').length,
    0,
  )
  const weakCompetencyCount = competencies.filter(
    (c) => !c.claims.some((x) => x.strength === 'has_metric'),
  ).length

  const hasNoDoc = !docsQuery.isError && !docsQuery.isLoading && docs.length === 0

  return (
    <div>
      <PageHeader
        title="知识档案"
        description="能力项由资料库提取整理而来,每条声明都可回溯到原文出处"
        actions={
          <button className="btn btn-ghost" onClick={() => docsQuery.refetch()} disabled={docsQuery.isFetching || profileQueries.some((q) => q.isFetching)}>
            {docsQuery.isFetching ? '刷新中…' : '重新提取档案'}
          </button>
        }
      />

      {docsQuery.isLoading ? (
        <section className="card p-5 md:p-6">
          <p className="py-4 text-sm" style={{ color: 'var(--fg-muted)' }}>加载中…</p>
        </section>
      ) : docsQuery.isError ? (
        <ErrorState onRetry={() => void docsQuery.refetch()} isRetrying={docsQuery.isFetching} />
      ) : hasNoDoc ? (
        <EmptyState />
      ) : totalClaims === 0 ? (
        <EmptyStateWithDocs />
      ) : (
        <>
          <SummaryStrip
            competencyCount={competencies.length}
            totalClaims={totalClaims}
            strongClaimCount={strongClaimCount}
            weakCompetencyCount={weakCompetencyCount}
            docCount={docs.length}
          />
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {competencies.map((c, i) => (
              <CompetencyCard key={`${c.competency}-${c.docFilename}`} c={c} revealIndex={i} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/** 有文档但抽取还是空(后端能力抽取还没跑)的另一种空态 */
function EmptyStateWithDocs() {
  return (
    <section className="card p-8 text-center md:p-10">
      <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="var(--fg-subtle)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mx-auto">
        <rect x="6.5" y="3" width="11" height="18" rx="1.5" />
        <path d="M10 8h5M10 12h5M10 16h3" />
      </svg>
      <h2 className="mt-3 text-base font-semibold">还没有抽取记录</h2>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
        后端已收到文档,但能力抽取尚未运行。重新上传或点击上方「重新提取档案」可触发再次抽取。
      </p>
    </section>
  )
}
