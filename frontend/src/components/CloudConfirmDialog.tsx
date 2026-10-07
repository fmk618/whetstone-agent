import { createPortal } from 'react-dom'
import { useSyncExternalStore } from 'react'
import { isCloudConfirmError } from '../api/client'

/**
 * 隐私知情确认流程(后端约定):
 * 1. 前端正常发请求;若涉及 local_only 内容发云端,后端返回
 *    409 { detail, provider_id }。
 * 2. 前端弹出本对话框,向用户说明后果。
 * 3. 用户确认后,前端带 confirm_cloud=true 重新发送同一请求。
 *
 * 用法(任意调用处,Promise 风格):
 *   try {
 *     return await post('/api/quiz/sessions', payload)
 *   } catch (err) {
 *     return await requestWithCloudConfirm(
 *       (opts) => post('/api/quiz/sessions', { ...payload, confirm_cloud: opts.confirmCloud }),
 *       err,
 *     )
 *   }
 */

interface ConfirmState {
  detail: string
  providerId: string
  resolve: (confirmed: boolean) => void
}

let currentConfirm: ConfirmState | null = null
const listeners = new Set<() => void>()

function emitChange() {
  listeners.forEach((fn) => fn())
}

/** useSyncExternalStore 订阅端 */
function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** useSyncExternalStore 快照端(引用稳定,直到状态变化) */
function getSnapshot(): ConfirmState | null {
  return currentConfirm
}

function askCloudConfirm(detail: string, providerId: string): Promise<boolean> {
  return new Promise((resolve) => {
    currentConfirm = { detail, providerId, resolve }
    emitChange()
  })
}

function closeConfirm(confirmed: boolean) {
  if (!currentConfirm) return
  const { resolve } = currentConfirm
  currentConfirm = null
  emitChange()
  resolve(confirmed)
}

/**
 * 处理 409 隐私拦截:若是 {detail, provider_id} 错误则弹知情确认,
 * 用户同意后带 confirm_cloud=true 重发,否则原样抛出。
 */
export async function requestWithCloudConfirm<T>(
  send: (opts: { confirmCloud: boolean }) => Promise<T>,
  err: unknown,
): Promise<T> {
  if (!isCloudConfirmError((err as { body?: unknown } | null)?.body)) {
    throw err
  }
  const body = (err as { body: { detail: string; provider_id: string } }).body
  const confirmed = await askCloudConfirm(body.detail, body.provider_id)
  if (!confirmed) {
    throw err // 用户取消:把 409 继续往上抛,由页面提示
  }
  return send({ confirmCloud: true })
}

/** 409 知情确认对话框;放在布局根部即可全局使用 */
export function CloudConfirmDialog() {
  const state = useSyncExternalStore(subscribe, getSnapshot)
  if (!state) return null

  const dialog = (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      role="dialog"
      aria-modal="true"
      aria-label="云端发送知情确认"
    >
      <div
        className="card w-full max-w-md"
        style={{ boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}
      >
        <h2 className="mb-2 text-base font-semibold">将内容发送到云端?</h2>
        <p className="text-sm leading-6" style={{ color: 'var(--fg-muted)' }}>
          {state.detail}
        </p>
        <p className="mt-2 text-sm" style={{ color: 'var(--fg-muted)' }}>
          目标 provider:<span className="font-mono text-xs">{state.providerId}</span>
          。该 provider 不受 local_only 限制,内容将离开本机,请确认不包含敏感隐私信息。
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => closeConfirm(false)}>
            取消,不上传
          </button>
          <button className="btn-primary" onClick={() => closeConfirm(true)}>
            我已知情,同意发送
          </button>
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(dialog, document.body) : null
}
