import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'

/** /404:磨刀石的「钝刀」隐喻 —— 页面还没开刃,回资料库重新来 */
export default function NotFoundPage() {
  return (
    <div>
      <PageHeader title="这段路还没开刃" />

      <section className="card flex flex-col items-center gap-6 py-14 text-center">
        <div className="flex items-baseline gap-1" aria-hidden>
          <span
            className="tnum text-[72px] font-semibold leading-none tracking-tight"
            style={{ color: 'var(--border-strong)' }}
          >
            4
          </span>
          <span
            className="tnum text-[72px] font-semibold leading-none tracking-tight"
            style={{ color: 'var(--accent)', opacity: 0.55 }}
          >
            0
          </span>
          <span
            className="tnum text-[72px] font-semibold leading-none tracking-tight"
            style={{ color: 'var(--border-strong)' }}
          >
            4
          </span>
        </div>

        <div className="max-w-md">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
            刀还在,刃还没磨——这一页要么是敲错的地址,要么还在施工序列里。
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link to="/" className="btn btn-primary">
            回资料库
          </Link>
          <Link to="/profile" className="btn btn-ghost">
            看看知识档案
          </Link>
        </div>
      </section>
    </div>
  )
}
