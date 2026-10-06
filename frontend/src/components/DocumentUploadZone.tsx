import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { post } from '../api/client'
import { requestWithCloudConfirm } from './CloudConfirmDialog'
import { Select } from './Select'
import type { DocType, UploadDocResponse } from '../api/types'

const MAX_SIZE = 20 * 1024 * 1024

export interface DocumentUploadOption {
  value: DocType
  label: string
}

interface DocumentUploadZoneProps {
  onToast: (text: string, kind?: 'success' | 'error' | 'info') => void
  onUploaded?: (data: UploadDocResponse) => Promise<void>
  options: DocumentUploadOption[]
  title: string
  description: string
}

type UploadMessage = {
  status: 'success' | 'partial' | 'error'
  text: string
}

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

  function pickFile(e: ChangeEvent<HTMLInputElement>) {
    setPicked(e.target.files?.[0] ?? null)
    setUploadMsg(null)
  }

  function onDrop(e: DragEvent<HTMLElement>) {
    e.preventDefault()
    setDragOver(false)
    setPicked(e.dataTransfer.files?.[0] ?? null)
    setUploadMsg(null)
  }

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('doc_type', docType)
      const send = (opts: { confirmCloud: boolean }) =>
        post<UploadDocResponse>('/api/docs/upload', fd, {
          query: { confirm_cloud: opts.confirmCloud },
        })
      try {
        return await send({ confirmCloud: false })
      } catch (err) {
        return await requestWithCloudConfirm(send, err)
      }
    },
    onSuccess: async (data) => {
      void queryClient.invalidateQueries({ queryKey: ['docs'] })
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
      setPicked(null)
      if (fileRef.current) fileRef.current.value = ''
      const prefix = data.skipped ? '上传成功（同一文件已入库，本次跳过）' : '上传成功'
      const baseText = `${prefix}：${data.filename}，切块 ${data.n_chunks}，标记 ${data.sensitivity === 'local_only' ? '仅本机' : '可用云端'}${data.scanned ? '，提示：疑似扫描件' : ''}`

      if (!onUploaded) {
        setUploadMsg({ status: 'success', text: baseText })
        onToast(`已上传《${data.filename}》（${data.n_chunks} 块）`, 'success')
        return
      }

      try {
        await onUploaded(data)
        setUploadMsg({ status: 'success', text: `${baseText}，已完成能力抽取，可以开始出题练习。` })
        onToast(`已上传《${data.filename}》，并完成能力抽取`, 'success')
      } catch (err) {
        const body = (err as { body?: { detail?: string } }).body
        const detail = body?.detail || (err instanceof Error ? err.message : '请到知识档案页重试')
        setUploadMsg({
          status: 'partial',
          text: `${baseText}。简历已保存，但能力抽取未完成，请到知识档案页重试。${detail}`,
        })
        onToast(`《${data.filename}》已保存，但能力抽取未完成`, 'error')
      }
    },
    onError: (err) => {
      const text = err instanceof Error ? err.message : String(err)
      const body = (err as { body?: { detail?: string } }).body
      setUploadMsg({ status: 'error', text: body?.detail || text })
    },
  })

  function submit() {
    if (!picked) {
      setUploadMsg({ status: 'error', text: '请先选择一个文件' })
      return
    }
    if (picked.size > MAX_SIZE) {
      setUploadMsg({ status: 'error', text: '文件超过 20 MB，请压缩或拆分后再上传' })
      return
    }
    setUploadMsg(null)
    uploadMutation.mutate(picked)
  }

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
        aria-disabled={uploadMutation.isPending}
        onClick={() => {
          if (!uploadMutation.isPending) fileRef.current?.click()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (!uploadMutation.isPending) fileRef.current?.click()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
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
        {uploadMutation.isPending ? (
          <div className="flex flex-col items-center gap-2 py-1.5" aria-live="polite">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5" />
            </svg>
            <div className="text-sm font-medium">上传中…</div>
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

      {picked && !uploadMutation.isPending ? (
        <button type="button" className="btn btn-primary mt-3" onClick={submit}>
          开始上传
        </button>
      ) : null}
    </section>
  )
}
