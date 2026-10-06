import type { ReactNode } from 'react'

export interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
}

/**
 * 墨水页眉:宋体标题 + 下贴墨线(--border-ink),章节线以下直接是内容。
 * 副标题句默认不显(方案 A 删掉"描述句夹层");若调用方传入 description,
 * 以稍强的字重作为引导句渲染在标题上、墨线前。
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header
      className="ink-rule mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-3 pb-3"
    >
      <div className="min-w-0">
        <h1
          className="text-[20px] leading-tight"
          style={{
            fontFamily: 'var(--font-serif)',
            fontWeight: 600,
            letterSpacing: '0.01em',
          }}
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 text-[13px] font-medium" style={{ color: 'var(--fg-muted)' }}>
            {description}
          </p>
        ) : null}
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
