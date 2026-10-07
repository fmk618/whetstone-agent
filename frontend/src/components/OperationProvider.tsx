import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { type QueryKey, useQueryClient } from '@tanstack/react-query'

export type OperationStatus = 'running' | 'success' | 'partial' | 'error'

export interface OperationStep {
  label: string
}

export interface Operation {
  id: string
  kind: string
  title: string
  route: string
  status: OperationStatus
  steps: OperationStep[]
  currentStep: number
  detail: string
  retry?: () => void
}

interface StartOperationOptions<T> {
  kind: string
  title: string
  route: string
  steps: OperationStep[]
  execute: (control: { advance: (step: number, detail?: string) => void }) => Promise<T>
  invalidate?: QueryKey[]
  summary?: (result: T) => string
  isPartial?: (result: T) => boolean
  retry?: () => void
}

interface OperationContextValue {
  operations: Operation[]
  startOperation: <T>(options: StartOperationOptions<T>) => Promise<T>
  dismissOperation: (id: string) => void
}

const OperationContext = createContext<OperationContextValue | null>(null)

function errorDetail(error: unknown): string {
  const body = (error as { body?: { detail?: unknown } } | null)?.body
  if (body && typeof body.detail === 'string') return body.detail
  return error instanceof Error ? error.message : '处理失败，请稍后重试。'
}

function createOperationId(): string {
  return `operation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function OperationProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [operations, setOperations] = useState<Operation[]>([])

  const dismissOperation = useCallback((id: string) => {
    setOperations((current) => current.filter((operation) => operation.id !== id || operation.status === 'running'))
  }, [])

  const startOperation = useCallback(async <T,>(options: StartOperationOptions<T>): Promise<T> => {
    const id = createOperationId()
    const steps = options.steps.length ? options.steps : [{ label: '处理中' }]
    const initial: Operation = {
      id,
      kind: options.kind,
      title: options.title,
      route: options.route,
      status: 'running',
      steps,
      currentStep: 0,
      detail: '已开始处理，离开当前页面也会继续。',
      retry: options.retry,
    }
    setOperations((current) => [initial, ...current].slice(0, 6))

    const advance = (step: number, detail?: string) => {
      setOperations((current) => current.map((operation) => {
        if (operation.id !== id) return operation
        const currentStep = Math.min(Math.max(step, 0), operation.steps.length - 1)
        return {
          ...operation,
          currentStep,
          detail: detail ?? operation.steps[currentStep].label,
        }
      }))
    }

    try {
      const result = await options.execute({ advance })
      await Promise.all((options.invalidate ?? []).map((queryKey) => queryClient.invalidateQueries({ queryKey })))
      const partial = options.isPartial?.(result) ?? false
      setOperations((current) => current.map((operation) => (
        operation.id === id
          ? {
              ...operation,
              status: partial ? 'partial' : 'success',
              currentStep: operation.steps.length - 1,
              detail: options.summary?.(result) ?? (partial ? '部分完成，请查看处理结果。' : '处理完成。'),
            }
          : operation
      )))
      return result
    } catch (error) {
      setOperations((current) => current.map((operation) => (
        operation.id === id
          ? { ...operation, status: 'error', detail: errorDetail(error) }
          : operation
      )))
      throw error
    }
  }, [queryClient])

  const value = useMemo(
    () => ({ operations, startOperation, dismissOperation }),
    [operations, startOperation, dismissOperation],
  )

  return <OperationContext.Provider value={value}>{children}</OperationContext.Provider>
}

export function useOperations(): OperationContextValue {
  const value = useContext(OperationContext)
  if (!value) throw new Error('useOperations 必须在 OperationProvider 内使用')
  return value
}
