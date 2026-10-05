import type { ReactNode } from 'react'

export interface PageHeaderProps {
  title: string
  description: string
  actions?: ReactNode
}

/** 页面统一页头:标题 + 一句话说明 + 右侧动作区 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--fg-muted)' }}>
          {description}
        </p>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  )
}

/** 占位块:标明该区块属于哪期施工 */
export function WipPlaceholder({ label, phase = '后续迭代' }: { label: string; phase?: string }) {
  return (
    <div
      className="rounded-md border border-dashed px-4 py-6 text-center text-sm"
      style={{ borderColor: 'var(--border)', color: 'var(--fg-muted)' }}
    >
      {label} · <span className="font-medium">施工中</span>({phase})
    </div>
  )
}
