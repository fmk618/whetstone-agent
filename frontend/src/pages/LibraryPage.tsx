import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { del, get, post } from '../api/client'
import { requestWithCloudConfirm } from '../components/CloudConfirmDialog'
import { useToast } from '../components/Toast'
import { PageHeader } from '../components/PageHeader'
import { Reveal } from '../components/Motion'
import { Select } from '../components/Select'
import type {
  DocType,
  DocTypeLoose,
  LibraryDoc,
  ReindexResponse,
  UploadDocResponse,
} from '../api/types'

/* ============================================================
   资料库页:上传(dropzone + FormData)/ 列表(GET /api/docs) /
   删除 / 重建索引;后端未启动友好提示 + 重试;空态引导上传。
   ============================================================ */

const DOC_TYPE_META: Record<DocTypeLoose, { label: string; badge: string }> = {
  resume: { label: '简历', badge: 'badge-accent' },
  jd: { label: '岗位 JD', badge: 'badge-neutral' },
  interview_exp: { label: '面经', badge: 'badge-success' },
  note: { label: '笔记', badge: 'badge-neutral' },
  notes: { label: '笔记', badge: 'badge-neutral' },
  project: { label: '项目', badge: 'badge-neutral' },
  reference: { label: '参考', badge: 'badge-warning' },
}

// doc_type 选项对齐后端五类:resume/project/notes/jd/reference(面经归 notes)
const DOC_TYPE_OPTIONS: Array<{ value: DocType; label: string }> = [
  { value: 'resume', label: '简历' },
  { value: 'jd', label: '岗位 JD' },
  { value: 'notes', label: '笔记 / 面经' },
  { value: 'project', label: '项目' },
  { value: 'reference', label: '参考' },
]

const MAX_SIZE = 20 * 1024 * 1024 // 20 MB

/** 敏感级别徽章:local_only 优先醒目(锁形),cloud_ok 弱化为中性 */
function SensitivityBadge({ level }: { level: LibraryDoc['sensitivity'] }) {
  if (level === 'local_only') {
    return (
      <span className="badge badge-success">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="4.5" y="10.5" width="15" height="9.5" rx="2" />
          <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
        </svg>
        仅本机
      </span>
    )
  }
  return <span className="badge badge-warning">可用云端</span>
}

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  if (n >= 1024) return `${Math.round(n / 1024)} KB`
  return `${n} B`
}

/** 区域一:上传(拖放 + 点击选择;doc_type 选择;loading 态;409 知情确认) */
function UploadZone({ onToast }: { onToast: (text: string, kind?: 'success' | 'error' | 'info') => void }) {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [picked, setPicked] = useState<File | null>(null)
  const [docType, setDocType] = useState<DocType>('resume')
  const [uploadMsg, setUploadMsg] = useState<{ ok: boolean; text: string } | null>(null)

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
      // FastAPI: confirm_cloud 在 routes_docs 里为显式 bool 函数参数,
      // Query/form 双路都收;这里直接放 query(README 契约口径)。
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['docs'] })
      setPicked(null)
      if (fileRef.current) fileRef.current.value = ''
      const prefix = data.skipped ? '上传成功(同一文件已入库,本次跳过)' : '上传成功'
      setUploadMsg({
        ok: true,
        text: `${prefix}:${data.filename},切块 ${data.n_chunks},标记 ${data.sensitivity === 'local_only' ? '仅本机' : '可用云端'}${data.scanned ? ',提示:疑似扫描件' : ''}`,
      })
      onToast(`已上传《${data.filename}》(${data.n_chunks} 块)`, 'success')
    },
    onError: (err) => {
      const text = err instanceof Error ? err.message : String(err)
      let detail = ''
      const body = (err as { body?: { detail?: string } }).body
      if (body?.detail) detail = body.detail
      setUploadMsg({ ok: false, text: detail || text })
      onToast(detail || text, 'error')
    },
  })

  function submit() {
    if (!picked) {
      setUploadMsg({ ok: false, text: '请先选择一个文件' })
      return
    }
    if (picked.size > MAX_SIZE) {
      setUploadMsg({ ok: false, text: `文件超过 20 MB,请压缩或拆分后再上传` })
      return
    }
    setUploadMsg(null)
    uploadMutation.mutate(picked)
  }

  return (
    <section className="card card-raised mb-6">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">上传文档</h2>
      </div>

      <div className="flex flex-wrap items-end gap-3 pb-2">
        <label className="min-w-[140px]">
          <span className="field-label mb-1 block">文档类型</span>
          <Select
            value={docType}
            onChange={(v) => setDocType(v as DocType)}
            options={DOC_TYPE_OPTIONS}
            ariaLabel="文档类型"
          />
        </label>
      </div>

      <div
        role="button"
        tabIndex={0}
        className="dropzone w-full"
        style={{ backgroundColor: dragOver ? 'var(--accent-soft)' : undefined }}
        aria-label="上传文档:拖拽文件到此处,或点击选择"
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
          accept=".md,.txt,.pdf,.docx,.doc"
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
              {picked ? `已选择:${picked.name}(${formatBytes(picked.size)})` : '拖拽文件到此处,或点击选择'}
            </div>
            <div className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
              {picked ? '点击下方「开始上传」确认' : 'PDF / Word / Markdown · 不超过 20 MB'}
            </div>
          </>
        )}
      </div>

      {uploadMsg ? (
        <p
          className="mt-2 text-xs leading-relaxed"
          style={{ color: uploadMsg.ok ? 'var(--success)' : 'var(--danger)' }}
        >
          {uploadMsg.text}
        </p>
      ) : null}

      {picked && !uploadMutation.isPending ? (
        <button type="button" className="btn btn-primary mt-3" onClick={submit}>
          开始上传
        </button>
      ) : null}
    </section>
  )
}

/** 区域二:文档列表(GET /api/docs) —— 桌面表格,手机端卡片化 */
function DocTable({
  docs,
  isLoading,
  isError,
  error,
  refetch,
  isFetching,
  onToast,
}: {
  docs: LibraryDoc[] | undefined
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
  isFetching: boolean
  onToast: (text: string, kind?: 'success' | 'error' | 'info') => void
}) {
  const queryClient = useQueryClient()
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => del<{ deleted: string }>(`/api/docs/${docId}`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['docs'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      onToast(`已删除《${data.deleted.slice(0, 12)}…》`, 'success')
      setConfirmDeleteId(null)
    },
    onError: (err) => {
      const body = (err as { body?: { detail?: string } }).body
      onToast(body?.detail ?? (err instanceof Error ? err.message : String(err)), 'error')
      setConfirmDeleteId(null)
    },
  })

  async function handleDelete(docId: string) {
    // 克制的二次确认:内置 confirm
    if (!window.confirm('删除后文档、向量与该技能档案的关联将一并清除,不可恢复。确定删除?')) return
    deleteMutation.mutate(docId)
  }

  const reindexMutation = useMutation({
    mutationFn: async () => {
      const send = (opts: { confirmCloud: boolean }) =>
        post<ReindexResponse>('/api/docs/reindex', {}, { query: { confirm_cloud: opts.confirmCloud } })
      try {
        return await send({ confirmCloud: false })
      } catch (err) {
        return await requestWithCloudConfirm(send, err)
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['docs'] })
      onToast(
        data.rebuilt.length
          ? `重建完成:${data.rebuilt.join(', ')} 集合已重建,${data.docs} 份文档,共 ${data.n_chunks} 块`
          : `无需重建集合(索引已对齐),${data.docs} 份文档 ${data.n_chunks} 块已保持最新`,
        'success',
      )
    },
    onError: (err) => {
      const body = (err as { body?: { detail?: string } }).body
      onToast(body?.detail ?? (err instanceof Error ? err.message : String(err)), 'error')
    },
  })

  if (isLoading) {
    return (
      <section className="card p-5 md:p-6">
        <p className="py-6 text-sm" style={{ color: 'var(--fg-muted)' }}>加载中…</p>
      </section>
    )
  }

  if (isError) {
    return (
      <section className="card p-5 md:p-6">
        <div className="py-4 text-sm" style={{ color: 'var(--danger)' }}>
          读取文档列表失败:请确认后端已启动(127.0.0.1:8000)。
          <span className="block pt-1 text-xs" style={{ color: 'var(--fg-muted)' }}>
            {error instanceof Error ? error.message : String(error ?? '')}
          </span>
        </div>
        <button type="button" className="btn btn-ghost mt-2" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? '重试中…' : '重试'}
        </button>
      </section>
    )
  }

  const list = docs ?? []

  if (list.length === 0) {
    return (
      <section className="card p-8 text-center md:p-10">
        <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="var(--fg-subtle)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mx-auto">
          <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H9a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5h-4A1.5 1.5 0 0 1 4 16V5.5Z" />
          <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H15a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5h4A1.5 1.5 0 0 0 20 16V5.5Z" />
        </svg>
        <h2 className="mt-3 text-base font-semibold">资料库还是空的</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
          上传第一份简历或项目文档,马上为它建档。出题、能力档案和模拟面试都会基于资料库生成。
        </p>
        <p className="mt-2 text-xs" style={{ color: 'var(--fg-subtle)' }}>
          推荐:先传简历(resume),再传目标岗位 JD(jd),可训练“Match 准确度”。
        </p>
      </section>
    )
  }

  // 手机端:每份文档一张卡
  function DocCards() {
    return (
      <ul className="flex flex-col gap-3 md:hidden" role="list">
        {list.map((doc, i) => {
          const typeMeta = DOC_TYPE_META[doc.doc_type] ?? { label: doc.doc_type, badge: 'badge-neutral' }
          return (
            <Reveal key={doc.id} index={i} as="li" className="rounded-lg border p-4" data-mobile="card" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium break-all">{doc.filename}</div>
                  <div className="tnum mt-1 font-mono text-[11px] break-all" style={{ color: 'var(--fg-subtle)' }}>
                    {doc.id.slice(0, 16)}…
                  </div>
                </div>
                <SensitivityBadge level={doc.sensitivity} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs" style={{ color: 'var(--fg-muted)' }}>
                <span className={`badge ${typeMeta.badge}`}>{typeMeta.label}</span>
                <span className="tnum">{doc.n_chunks} 块</span>
                <span className="tnum">{doc.created_at ?? ''}</span>
              </div>
              <div className="mt-3 flex gap-2 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={reindexMutation.isPending}
                  onClick={() => reindexMutation.mutate()}
                >
                  {reindexMutation.isPending ? '重建中…' : '重建索引'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={deleteMutation.isPending && confirmDeleteId === doc.id}
                  onClick={() => handleDelete(doc.id)}
                  style={{ color: 'var(--danger)' }}
                >
                  删除
                </button>
              </div>
            </Reveal>
          )
        })}
      </ul>
    )
  }

  // 平板/桌面:表格
  function DocTableDesktop() {
    return (
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr style={{ color: 'var(--fg-subtle)' }}>
              {['名称', '类型', '敏感级别', '块数', '大小', '导入时间', '操作'].map((h) => (
                <th
                  key={h}
                  className="whitespace-nowrap border-b px-3 py-2.5 text-left text-xs font-medium"
                  style={{ borderColor: 'var(--border)' }}
                  scope="col"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((doc, i) => {
              const typeMeta = DOC_TYPE_META[doc.doc_type] ?? { label: doc.doc_type, badge: 'badge-neutral' }
              return (
                <Reveal key={doc.id} index={i} as="tr" className="group">
                  <td
                    className="border-b px-3 py-3 font-medium"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    {doc.filename}
                    <div className="tnum mt-0.5 font-mono text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
                      {doc.id.slice(0, 16)}…
                    </div>
                  </td>
                  <td className="border-b px-3 py-3" style={{ borderColor: 'var(--border)' }}>
                    <span className={`badge ${typeMeta.badge}`}>{typeMeta.label}</span>
                  </td>
                  <td className="border-b px-3 py-3" style={{ borderColor: 'var(--border)' }}>
                    <SensitivityBadge level={doc.sensitivity} />
                  </td>
                  <td
                    className="tnum border-b px-3 py-3 font-mono text-[13px]"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    {doc.n_chunks}
                  </td>
                  <td
                    className="tnum border-b px-3 py-3 text-xs"
                    style={{ borderColor: 'var(--border)', color: 'var(--fg-muted)' }}
                  >
                    {doc.embedded ? (doc.embedded.provider === 'qwen' ? '云端嵌入' : '本机嵌入') : '未嵌入'}
                  </td>
                  <td
                    className="tnum border-b px-3 py-3 text-xs"
                    style={{ borderColor: 'var(--border)', color: 'var(--fg-muted)' }}
                  >
                    {doc.created_at ?? ''}
                  </td>
                  <td className="border-b px-3 py-3" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={reindexMutation.isPending}
                        onClick={() => reindexMutation.mutate()}
                      >
                        {reindexMutation.isPending ? '重建中…' : '重建索引'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={deleteMutation.isPending && confirmDeleteId === doc.id}
                        onClick={() => handleDelete(doc.id)}
                        style={{ color: 'var(--danger)' }}
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </Reveal>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <section className="card p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">文档列表</h2>
        <div className="flex items-baseline gap-4">
          <span className="tnum text-xs" style={{ color: 'var(--fg-subtle)' }}>
            共 {list.length} 份
          </span>
          <button
            type="button"
            className={`btn btn-ghost ${deleteMutation.isPending ? 'btn-sm' : 'btn-sm'}`}
            disabled={reindexMutation.isPending}
            onClick={() => reindexMutation.mutate()}
          >
            {reindexMutation.isPending ? '重建中…' : '重建全部索引'}
          </button>
        </div>
      </div>
      <DocCards />
      <DocTableDesktop />
    </section>
  )
}

export default function LibraryPage() {
  const { toast, show } = useToast()
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['docs'],
    queryFn: () => get<LibraryDoc[]>('/api/docs'),
  })

  return (
    <div>
      {toast}
      <PageHeader
        title="资料库"
        actions={
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            {isFetching ? '刷新中…' : '刷新'}
          </button>
        }
      />
      <UploadZone onToast={show} />
      <DocTable
        docs={data}
        isLoading={isLoading}
        isError={isError}
        error={error as Error | null}
        refetch={() => void refetch()}
        isFetching={isFetching}
        onToast={show}
      />
    </div>
  )
}
