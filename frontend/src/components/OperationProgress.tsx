import { Link } from 'react-router-dom'
import { type Operation, useOperations } from './OperationProvider'

const STATUS_LABEL: Record<Operation['status'], string> = {
  running: '处理中',
  success: '已完成',
  partial: '部分完成',
  error: '处理失败',
}

function StatusIcon({ status }: { status: Operation['status'] }) {
  if (status === 'success') return <span className="operation-status-icon is-success" aria-hidden="true">✓</span>
  if (status === 'partial') return <span className="operation-status-icon is-partial" aria-hidden="true">!</span>
  if (status === 'error') return <span className="operation-status-icon is-error" aria-hidden="true">×</span>
  return <span className="operation-status-icon is-running" aria-hidden="true" />
}

function OperationCard({ operation }: { operation: Operation }) {
  const { dismissOperation } = useOperations()
  const progress = operation.steps.length <= 1
    ? 100
    : Math.round((operation.currentStep / (operation.steps.length - 1)) * 100)

  return (
    <section className={`operation-card is-${operation.status}`} aria-label={`${operation.title}：${STATUS_LABEL[operation.status]}`}>
      <div className="flex items-start gap-2">
        <StatusIcon status={operation.status} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">{operation.title}</h2>
              <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>{STATUS_LABEL[operation.status]}</p>
            </div>
            {operation.status !== 'running' ? (
              <button type="button" className="operation-dismiss" onClick={() => dismissOperation(operation.id)} aria-label={`关闭${operation.title}处理结果`}>
                ×
              </button>
            ) : null}
          </div>
          <p className="mt-1.5 text-xs leading-relaxed" style={{ color: 'var(--fg-muted)' }}>{operation.detail}</p>
        </div>
      </div>

      <div className="operation-steps" aria-label={`${operation.title}处理步骤`}>
        <div className="operation-track" aria-hidden="true">
          <span className="operation-track-fill" style={{ width: `${progress}%` }} />
        </div>
        {operation.steps.map((step, index) => {
          const state = index < operation.currentStep || operation.status === 'success'
            ? 'complete'
            : index === operation.currentStep
              ? operation.status === 'error' ? 'failed' : 'current'
              : 'upcoming'
          return (
            <div key={step.label} className={`operation-step is-${state}`}>
              <span className="operation-step-marker" aria-hidden="true">{index + 1}</span>
              <span>{step.label}</span>
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <Link to={operation.route} className="operation-return">回到任务</Link>
        {operation.status === 'running' ? <span className="text-[11px]" style={{ color: 'var(--fg-subtle)' }}>正在后台处理</span> : null}
        {operation.retry ? <button type="button" className="operation-return" onClick={operation.retry}>重试</button> : null}
      </div>
    </section>
  )
}

export function OperationProgress() {
  const { operations } = useOperations()
  if (!operations.length) return null
  const active = operations.filter((operation) => operation.status === 'running')
  const visible = [...active, ...operations.filter((operation) => operation.status !== 'running')].slice(0, 3)
  const announcement = active.length
    ? `${active.length} 个任务正在后台处理。${active[0].title}：${active[0].detail}`
    : `${visible[0]?.title ?? '任务'}：${visible[0]?.detail ?? '处理完成。'}`

  return (
    <aside className="operation-tray" aria-label="后台处理进度">
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</div>
      <div className="operation-tray-heading">
        <span>处理进度</span>
        {active.length ? <span className="operation-count">{active.length} 进行中</span> : null}
      </div>
      <div className="operation-tray-list">
        {visible.map((operation) => <OperationCard key={operation.id} operation={operation} />)}
      </div>
    </aside>
  )
}
