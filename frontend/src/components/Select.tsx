import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export interface SelectOption {
  value: string
  label: string
  /** 可选:每项右侧的弱说明(如数量、英文名) */
  hint?: string
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  /** 无障碍名称(可见 label 存在时配合 htmlFor 可省) */
  ariaLabel?: string
  id?: string
  disabled?: boolean
  className?: string
}

/**
 * 自绘下拉(替代原生 select:原生 option 弹层在纸底主题里是系统蓝底,
 * 无法注入样式)。视觉与 .input 胶囊一致:36px 高、20px 圆角、
 * 墨褐 chevron;弹层是「书页浮层」:bg-elevated、14px 圆角、双层投影。
 * 键盘:↑↓ 移动高亮、Enter/空格选中、Esc 关闭;type-ahead 按首字跳。
 */
export function Select({
  value,
  onChange,
  options,
  ariaLabel,
  id,
  disabled,
  className,
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()
  const labelId = useId()

  const current = options.find((o) => o.value === value)

  // 打开时高亮当前值
  useEffect(() => {
    if (open) {
      const i = options.findIndex((o) => o.value === value)
      setHighlight(i >= 0 ? i : 0)
    }
  }, [open, options, value])

  // 高亮项滚入视野
  useLayoutEffect(() => {
    if (!open || highlight < 0) return
    listRef.current
      ?.querySelectorAll('[role="option"]')
      [highlight]?.scrollIntoView({ block: 'nearest' })
  }, [highlight, open])

  // 点击外面/Escape 关闭
  useEffect(() => {
    if (!open) return
    const onPointer = (e: Event) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        btnRef.current?.focus()
      }
    }
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('touchstart', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('touchstart', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  function select(i: number) {
    const o = options[i]
    if (!o) return
    onChange(o.value)
    setOpen(false)
    btnRef.current?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      select(highlight)
    } else if (e.key === 'Home') {
      setHighlight(0)
    } else if (e.key === 'End') {
      setHighlight(options.length - 1)
    } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
      // type-ahead:从高亮之后找首字匹配(label 或 value)
      const h = highlight < 0 ? 0 : highlight
      for (let step = 1; step <= options.length; step++) {
        const i = (h + step) % options.length
        const t = options[i].label.toLowerCase()
        if (t.startsWith(e.key.toLowerCase())) {
          e.preventDefault()
          setHighlight(i)
          return
        }
      }
    }
  }

  const cls = `select-root ${className ?? ''}`

  return (
    <div ref={rootRef} className={cls} id={id}>
      <span id={labelId} className="sr-only">{ariaLabel}</span>
      <button
        ref={btnRef}
        type="button"
        className="select-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${labelId} ${listId}`}
        aria-label={ariaLabel}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKeyDown}
      >
        <span className="select-value">{current?.label ?? value}</span>
        <svg
          viewBox="0 0 15 10"
          width="15"
          height="10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="select-chev"
          style={{ transform: open ? 'rotate(180deg)' : undefined }}
        >
          <path d="M2 2.5 7.5 8 13 2.5" />
        </svg>
      </button>

      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="select-menu"
          tabIndex={-1}
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={`select-option ${i === highlight ? 'is-highlighted' : ''} ${
                o.value === value ? 'is-selected' : ''
              }`}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => {
                // mousedown 而不是 click:避免先触发窗口 mousedown 关弹层
                e.preventDefault()
                select(i)
              }}
            >
              <span className="select-option-label">{o.label}</span>
              {o.hint ? <span className="select-option-hint">{o.hint}</span> : null}
              {o.value === value ? (
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="select-option-check"
                >
                  <path d="m5 12.5 4.5 4.5L19 7" />
                </svg>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/** 常见用法包装:field-label + Select */
export function SelectField({
  label,
  htmlFor,
  ...props
}: SelectProps & { label: ReactNode; htmlFor?: string }) {
  return (
    <label className="block" htmlFor={htmlFor}>
      <span className="field-label mb-1 block">{label}</span>
      <Select {...props} />
    </label>
  )
}
