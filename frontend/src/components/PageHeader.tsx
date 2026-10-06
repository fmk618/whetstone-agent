import type { ReactNode } from 'react'

export interface PageHeaderProps {
  title: string
  description: string
  actions?: ReactNode
}

/** 页面统一页头:大标题 + 一句副标题 + 右侧主操作区 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="mb-7 flex flex-wrap items-start justify-between gap-x-6 gap-y-3 md:mb-8">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold leading-tight tracking-wide">{title}</h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
          {description}
        </p>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2 pt-1">{actions}</div> : null}
    </header>
  )
}

/** 占位块:标明该区块属于哪期施工 */
export function WipPlaceholder({ label, phase = '后续迭代' }: { label: string; phase?: string }) {
  return (
    <div
      className="rounded-md border border-dashed px-4 py-5 text-center text-sm"
      style={{ borderColor: 'var(--border)', color: 'var(--fg-muted)' }}
    >
      {label} · <span className="font-medium">施工中</span>({phase})
    </div>
  )
}
