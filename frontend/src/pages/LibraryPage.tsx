import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { del, get, post } from '../api/client'
import { requestWithCloudConfirm } from '../components/CloudConfirmDialog'
import { DocumentUploadZone } from '../components/DocumentUploadZone'
import { useToast } from '../components/Toast'
import { PageHeader } from '../components/PageHeader'
import { Reveal } from '../components/Motion'
import type {
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
          上传简历后，就可以生成知识档案和出题练习。项目、笔记等补充资料请在知识档案页上传。
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

  async function extractResume(data: UploadDocResponse) {
    const send = (opts: { confirmCloud: boolean }) =>
      post(`/api/docs/${data.doc_id}/profile/extract`, {}, {
        query: { confirm_cloud: opts.confirmCloud },
      })
    try {
      await send({ confirmCloud: false })
    } catch (err) {
      await requestWithCloudConfirm(send, err)
    }
  }

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
      <DocumentUploadZone
        onToast={show}
        onUploaded={extractResume}
        options={[{ value: 'resume', label: '简历' }]}
        title="上传简历"
        description="简历是生成知识档案和出题练习的最小资料。"
      />
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
