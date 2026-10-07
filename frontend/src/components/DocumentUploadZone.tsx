import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isCloudConfirmError, postFormDataWithProgress } from '../api/client'
import { requestWithCloudConfirm } from './CloudConfirmDialog'
import { Select } from './Select'
import type { DocType, UploadDocResponse } from '../api/types'

const MAX_SIZE = 20 * 1024 * 1024

export interface DocumentUploadOption {
  value: DocType
  label: string
}

export interface UploadSuccessContext {
  cloudConfirmed: boolean
}

interface DocumentUploadZoneProps {
  onToast: (text: string, kind?: 'success' | 'error' | 'info') => void
  onUploaded?: (data: UploadDocResponse, context: UploadSuccessContext) => Promise<void>
  options: DocumentUploadOption[]
  title: string
  description: string
}

type UploadMessage = {
  status: 'success' | 'partial' | 'error'
  text: string
}

type UploadPhase = 'idle' | 'uploading' | 'extracting' | 'complete' | 'partial' | 'error'

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  if (n >= 1024) return `${Math.round(n / 1024)} KB`
  return `${n} B`
}

export function DocumentUploadZone({
  onToast,
  onUploaded,
  options,
  title,
  description,
}: DocumentUploadZoneProps) {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [picked, setPicked] = useState<File | null>(null)
  const [docType, setDocType] = useState<DocType>(options[0]?.value ?? 'resume')
  const [uploadMsg, setUploadMsg] = useState<UploadMessage | null>(null)
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle')
  const [uploadBytes, setUploadBytes] = useState<{ loaded: number; total: number | null }>({ loaded: 0, total: null })

  function pickFile(e: ChangeEvent<HTMLInputElement>) {
    setPicked(e.target.files?.[0] ?? null)
    setUploadMsg(null)
    setUploadPhase('idle')
  }

  function onDrop(e: DragEvent<HTMLElement>) {
    e.preventDefault()
    setDragOver(false)
    if (uploadMutation.isPending) return
    setPicked(e.dataTransfer.files?.[0] ?? null)
    setUploadMsg(null)
    setUploadPhase('idle')
  }

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('doc_type', docType)
      const send = (opts: { confirmCloud: boolean }) => {
        setUploadBytes({ loaded: 0, total: file.size })
        return postFormDataWithProgress<UploadDocResponse>('/api/docs/upload', fd, {
          query: { confirm_cloud: opts.confirmCloud },
          onProgress: setUploadBytes,
        })
      }
      try {
        return { data: await send({ confirmCloud: false }), cloudConfirmed: false }
      } catch (err) {
        return {
          data: await requestWithCloudConfirm(send, err),
          cloudConfirmed: true,
        }
      }
    },
    onSuccess: async ({ data, cloudConfirmed }) => {
      void queryClient.invalidateQueries({ queryKey: ['docs'] })
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
      setPicked(null)
      if (fileRef.current) fileRef.current.value = ''
      const prefix = data.skipped ? '上传成功（同一文件已入库，本次跳过）' : '上传成功'
      const baseText = `${prefix}：${data.filename}，切块 ${data.n_chunks}，标记 ${data.sensitivity === 'local_only' ? '仅本机' : '可用云端'}${data.scanned ? '，提示：疑似扫描件' : ''}`

      if (!onUploaded) {
        setUploadPhase('complete')
        setUploadMsg({ status: 'success', text: baseText })
        onToast(`已上传《${data.filename}》（${data.n_chunks} 块）`, 'success')
        return
      }

      setUploadPhase('extracting')
      try {
        await onUploaded(data, { cloudConfirmed })
        setUploadPhase('complete')
        setUploadMsg({ status: 'success', text: `${baseText}，已完成能力抽取，可以开始出题练习。` })
        onToast(`已上传《${data.filename}》，并完成能力抽取`, 'success')
      } catch (err) {
        const body = (err as { body?: { detail?: string; retryable?: boolean } }).body
        const detail = body?.detail || (err instanceof Error ? err.message : '请到知识档案页重试')
        const retryHint = body?.retryable
          ? '云端能力抽取暂时失败，请稍后到知识档案页重试。'
          : '能力抽取未完成，请到知识档案页重试。'
        setUploadPhase('partial')
        setUploadMsg({
          status: 'partial',
          text: `${baseText}。简历已保存，但${retryHint}${detail}`,
        })
        onToast(`《${data.filename}》已保存，但能力抽取未完成`, 'error')
      }
    },
    onError: (err) => {
      const body = (err as { body?: unknown }).body
      if (isCloudConfirmError(body)) {
        setUploadPhase('partial')
        setUploadMsg({
          status: 'partial',
          text: '检测到敏感信息。已取消发送到云端，本次没有完成入库；如需继续，请重新上传并同意发送。',
        })
        return
      }
      const text = err instanceof Error ? err.message : String(err)
      const detail = (body as { detail?: string } | undefined)?.detail
      setUploadPhase('error')
      setUploadMsg({ status: 'error', text: detail || text })
    },
  })

  function submit() {
    if (!picked) {
      setUploadPhase('error')
      setUploadMsg({ status: 'error', text: '请先选择一个文件' })
      return
    }
    if (picked.size > MAX_SIZE) {
      setUploadPhase('error')
      setUploadMsg({ status: 'error', text: '文件超过 20 MB，请压缩或拆分后再上传' })
      return
    }
    setUploadMsg(null)
    setUploadPhase('uploading')
    uploadMutation.mutate(picked)
  }

  const isProcessing = uploadMutation.isPending
  const showProgress = uploadPhase !== 'idle'
  const uploadPercent = uploadBytes.total && uploadBytes.total > 0
    ? Math.min(100, Math.round((uploadBytes.loaded / uploadBytes.total) * 100))
    : null
  const phaseText = uploadPhase === 'uploading'
    ? uploadPercent === 100 ? '文件已发送，正在建立索引…' : '正在上传文件…'
    : uploadPhase === 'extracting'
      ? '文件已入库，正在提取能力档案…'
      : uploadPhase === 'complete'
        ? '上传流程已完成。'
        : uploadPhase === 'partial'
          ? '文件已保存，但能力档案尚未完成。'
          : uploadPhase === 'error'
            ? '上传流程未完成。'
            : ''

  return (
    <section className="card card-raised mb-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--fg-muted)' }}>{description}</p>
        </div>
      </div>

      {options.length > 1 ? (
        <div className="flex flex-wrap items-end gap-3 pb-2">
          <label className="min-w-[180px]">
            <span className="field-label mb-1 block">资料类型</span>
            <Select
              value={docType}
              onChange={(v) => setDocType(v as DocType)}
              options={options}
              ariaLabel="资料类型"
            />
          </label>
        </div>
      ) : null}

      <div
        role="button"
        tabIndex={0}
        className="dropzone w-full"
        style={{ backgroundColor: dragOver ? 'var(--accent-soft)' : undefined }}
        aria-label="上传资料：拖拽文件到此处，或点击选择"
        aria-disabled={isProcessing}
        onClick={() => {
          if (!isProcessing) fileRef.current?.click()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (!isProcessing) fileRef.current?.click()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          if (!isProcessing) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <input
          ref={fileRef}
          type="file"
          hidden
          accept=".md,.txt,.pdf,.docx"
          onChange={pickFile}
        />
        {isProcessing ? (
          <div className="flex flex-col items-center gap-2 py-1.5" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5" />
            </svg>
            <div className="text-sm font-medium">{uploadPhase === 'extracting' ? '能力抽取中…' : '上传与索引中…'}</div>
          </div>
        ) : (
          <>
            <svg
              viewBox="0 0 24 24"
              width="26"
              height="26"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 16V4.5M12 4.5 8 8.5M12 4.5l4 4" />
              <path d="M4 15v3A2.5 2.5 0 0 0 6.5 20.5h11A2.5 2.5 0 0 0 20 18v-3" />
            </svg>
            <div className="text-sm font-medium">
              {picked ? `已选择：${picked.name}（${formatBytes(picked.size)}）` : '拖拽文件到此处，或点击选择'}
            </div>
            <div className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
              {picked ? '点击下方「开始上传」确认' : 'PDF / Word（.docx）/ Markdown · 不超过 20 MB'}
            </div>
          </>
        )}
      </div>

      {showProgress ? (
        <div className={`inline-progress ${uploadPhase === 'error' || uploadPhase === 'partial' ? 'is-failure' : ''}`} role="status" aria-live="polite" aria-atomic="true">
          <div className="inline-progress-label">
            <span>{phaseText}</span>
            {uploadPhase === 'uploading' && uploadPercent !== null ? <strong>{uploadPercent}%</strong> : null}
          </div>
          <div
            className={`inline-progress-track ${uploadPhase === 'uploading' && uploadPercent === null ? 'is-indeterminate' : ''}`}
            role={uploadPercent !== null ? 'progressbar' : undefined}
            aria-label="文件上传进度"
            aria-valuemin={uploadPercent !== null ? 0 : undefined}
            aria-valuemax={uploadPercent !== null ? 100 : undefined}
            aria-valuenow={uploadPercent ?? undefined}
          >
            <span className="inline-progress-fill" style={{ width: `${uploadPercent ?? 100}%` }} />
          </div>
          {uploadPhase === 'uploading' && uploadPercent !== null ? (
            <div className="inline-progress-detail">已发送 {formatBytes(uploadBytes.loaded)} / {formatBytes(uploadBytes.total ?? 0)}</div>
          ) : null}
        </div>
      ) : null}

      {uploadMsg ? (
        <div
          className={`upload-message ${uploadMsg.status === 'success' ? 'is-success' : 'is-error'}`}
          role={uploadMsg.status === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          <strong>
            {uploadMsg.status === 'success' ? '上传成功' : uploadMsg.status === 'partial' ? '已上传，待完成' : '上传失败'}
          </strong>
          <span>{uploadMsg.text}</span>
        </div>
      ) : null}

      {picked && !isProcessing ? (
        <button type="button" className="btn btn-primary mt-3" onClick={submit}>
          开始上传
        </button>
      ) : null}
    </section>
  )
}
