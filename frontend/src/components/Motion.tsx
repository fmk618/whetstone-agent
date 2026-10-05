import { useEffect, useRef, useState, type ReactNode } from 'react'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(REDUCED_MOTION_QUERY).matches
}

/** 数字滚动:进页面时从 0 计数到目标值(rAF 实现,不引库;reduced-motion 时直接显示终值) */
export function CountUp({
  value,
  duration = 550,
  suffix = '',
  className,
  style,
}: {
  value: number
  duration?: number
  suffix?: string
  className?: string
  style?: React.CSSProperties
}) {
  const [display, setDisplay] = useState(() => (prefersReducedMotion() ? value : 0))
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value)
      return
    }
    const start = performance.now()
    const from = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      // ease-out:cubic-bezier 近似
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(from + (value - from) * eased))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value, duration])

  return (
    <span className={className} style={style} role="text" aria-label={String(value) + suffix}>
      <span aria-hidden="true" className="tnum">
        {display}
        {suffix}
      </span>
    </span>
  )
}

/**
 * 进场淡入容器(页面路由级:fade + 轻微上移)。
 * key 由调用方传路由名,路由变化时重新触发一次。
 */
export function PageEnter({ pkey, children }: { pkey: string; children: ReactNode }) {
  return (
    <div key={pkey} className="page-enter">
      {children}
    </div>
  )
}

/**
 * 列表项依次淡入:每项延迟 35ms,只做首屏前 10 项,之后的直接显示。
 * 用法:<Reveal index={i} as="li" className="...">…</Reveal>
 */
export function Reveal({
  index,
  as: Tag = 'div',
  className = '',
  children,
  ...rest
}: {
  index: number
  as?: keyof React.JSX.IntrinsicElements
  className?: string
  children: ReactNode
} & Record<string, unknown>) {
  const TagEl = Tag as React.ElementType
  const delay = index < 10 ? { '--i': index } : undefined
  return (
    <TagEl
      className={(index < 10 ? `reveal ${className}` : className).trim()}
      style={{ ...(delay as React.CSSProperties), ...((rest.style as object) ?? {}) }}
      {...rest}
    >
      {children}
    </TagEl>
  )
}
