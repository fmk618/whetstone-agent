// 轻量 toast:useToast() 提供 { toast: 渲染节点, show(text, kind) }
// 页面在根部渲染 {toast} 即可;自动 2.6s 消失。零依赖,样式走 index.css token。
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useRef, useState } from 'react'

type ToastKind = 'success' | 'error' | 'info'

interface ToastState {
  id: number
  text: string
  kind: ToastKind
}

const KIND_STYLE: Record<ToastKind, { bg: string; fg: string }> = {
  success: { bg: 'var(--success-soft, rgba(47,107,71,.12))', fg: 'var(--success)' },
  error: { bg: 'var(--danger-soft, rgba(156,63,44,.12))', fg: 'var(--danger)' },
  info: { bg: 'var(--bg-elevated)', fg: 'var(--fg)' },
}

export function useToast(): {
  toast: React.ReactNode
  show: (text: string, kind?: ToastKind) => void
} {
  const [item, setItem] = useState<ToastState | null>(null)
  const timer = useRef<number | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [])

  const show = useCallback((text: string, kind: ToastKind = 'info') => {
    if (!mounted.current) return
    if (timer.current) window.clearTimeout(timer.current)
    setItem({ id: Date.now(), text, kind })
    // 自动消失(error 留久一点)
    timer.current = window.setTimeout(
      () => {
        if (mounted.current) setItem(null)
      },
      kind === 'error' ? 4200 : 2600,
    )
  }, [])

  const toastContent = item ? (
    <div
      key={item.id}
      className="toast-container toast-enter"
      role="status"
      aria-live="polite"
      style={{
        maxWidth: 'min(90vw, 480px)',
        padding: '10px 16px',
        borderRadius: '8px',
        fontSize: '13px',
        lineHeight: 1.5,
        wordBreak: 'break-word',
        boxShadow: '0 2px 6px rgba(0,0,0,.10), 0 10px 28px rgba(0,0,0,0.08)',
        ...KIND_STYLE[item.kind],
      }}
    >
      {item.text}
    </div>
  ) : null

  return {
    toast: toastContent && typeof document !== 'undefined'
      ? createPortal(toastContent, document.body)
      : null,
    show,
  }
}
