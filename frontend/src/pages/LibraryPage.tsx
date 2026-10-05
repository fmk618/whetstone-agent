import { useState } from 'react'
import type { ReactNode } from 'react'

export interface PageHeaderProps {
  title: string
  description: string
  actions?: ReactNode
}

/** 页面统一页头:标题 + 一句话说明 + 右侧动作区 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-wide">{title}</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--fg-muted)' }}>
          {description}
        </p>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  )
}

/** 占位块:标明该区块属于哪期施工 */
export function WipPlaceholder({ label, phase = '后续迭代' }: { label: string; phase?: string }) {
  return (
    <div
      className="rounded-md border border-dashed px-4 py-6 text-center text-sm"
      style={{ borderColor: 'var(--border)', color: 'var(--fg-muted)' }}
    >
      {label} · <span className="font-medium">施工中</span>({phase})
    </div>
  )
}

/* ============================================================
   资料库页内部小组件(仅供本页使用)
   ============================================================ */

/** 与后端 GET /api/docs 的 documents 表结构对齐(id/filename/doc_type/sensitivity/n_chunks/created_at) */
interface DocRow {
  id: string
  filename: string
  doc_type: 'resume' | 'jd' | 'interview_exp' | 'note'
  sensitivity: 'local_only' | 'cloud_ok'
  n_chunks: number
  created_at: string
}

/** 占位数据:结构即后端契约,后续直接换成 useQuery 结果 */
const MOCK_DOCS: DocRow[] = [
  {
    id: 'doc_01j9k2',
    filename: '张三_后端工程师_简历.pdf',
    doc_type: 'resume',
    sensitivity: 'local_only',
    n_chunks: 18,
    created_at: '2026-09-28 14:32',
  },
  {
    id: 'doc_01j9k8',
    filename: 'JD_某厂_资深Go开发.txt',
    doc_type: 'jd',
    sensitivity: 'cloud_ok',
    n_chunks: 4,
    created_at: '2026-09-28 15:07',
  },
  {
    id: 'doc_01ja31',
    filename: '面经_2025秋招_Golang合集.md',
    doc_type: 'interview_exp',
    sensitivity: 'local_only',
    n_chunks: 42,
    created_at: '2026-10-02 21:15',
  },
  {
    id: 'doc_01jb5c',
    filename: '笔记_Kafka核心机制.md',
    doc_type: 'note',
    sensitivity: 'local_only',
    n_chunks: 27,
    created_at: '2026-10-04 09:48',
  },
]

const DOC_TYPE_META: Record<DocRow['doc_type'], { label: string; badge: string }> = {
  resume: { label: '简历', badge: 'badge-accent' },
  jd: { label: '岗位 JD', badge: 'badge-neutral' },
  interview_exp: { label: '面经', badge: 'badge-success' },
  note: { label: '笔记', badge: 'badge-neutral' },
}

/** 敏感级别徽章:local_only 优先醒目(锁形),cloud_ok 弱化为中性 */
function SensitivityBadge({ level }: { level: DocRow['sensitivity'] }) {
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
  return `${Math.max(1, Math.round(n / 1024))} KB`
}

const MOCK_SIZES: Record<string, number> = {
  doc_01j9k2: 386_204,
  doc_01j9k8: 4_120,
  doc_01ja31: 74_880,
  doc_01jb5c: 31_005,
}

/** 区域一:上传(拖放框样式,静态占位,不接真实上传) */
function UploadZone() {
  return (
    <section className="card mb-4">
      <h2 className="mb-3 text-base font-semibold">上传文档</h2>
      <button
        type="button"
        className="dropzone w-full"
        aria-label="上传文档:拖拽文件到此处,或点击选择"
      >
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
        <div className="text-sm font-medium">拖拽文件到此处,或点击选择</div>
        <div className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
          支持 PDF / Word / Markdown · 单个文件不超过 20 MB
        </div>
      </button>
      <p className="mt-2.5 text-xs" style={{ color: 'var(--fg-subtle)' }}>
        上传前请确认文件中不含身份证号、真实手机号等隐私信息;标记为「仅本机」的内容永远不会离开这台电脑。
      </p>
    </section>
  )
}

/** 区域二:可折叠隐私说明条 */
function PrivacyNote() {
  return (
    <details className="privacy-note mb-4">
      <summary>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3 4.5 6v5.2c0 4.6 3.2 7.9 7.5 9.3 4.3-1.4 7.5-4.7 7.5-9.3V6L12 3Z" />
        </svg>
        隐私与敏感级别说明
        <span className="chev ml-auto" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </span>
      </summary>
      <div className="privacy-note-body">
        <p>
          <strong style={{ color: 'var(--success)' }}>仅本机(local_only)</strong>
          :文档切片、向量化与出题推理全部在本机模型上完成,数据不出本机。
        </p>
        <p className="mt-1.5">
          <strong style={{ color: 'var(--warning)' }}>可用云端(cloud_ok)</strong>
          :内容可能发送到云端模型。即使如此,任何一次实际外发前都会弹出
          <span className="tnum font-medium">「我已知情,同意发送」</span>
          确认框,你不同意就不会发送。
        </p>
        <p className="mt-1.5">
          在「设置 → 模型服务」中可以调整每个 provider 的 local_only 标记;标记为仅本机的文档一旦需要云端能力,任务会直接被后端拦截(409)。
        </p>
      </div>
    </details>
  )
}

/** 区域三:文档列表表格 */
function DocTable() {
  const [docs] = useState<DocRow[]>(MOCK_DOCS)

  return (
    <section className="card p-0">
      <div className="flex items-center justify-between px-5 pb-1 pt-4">
        <h2 className="text-base font-semibold">文档列表</h2>
        <span className="tnum text-xs" style={{ color: 'var(--fg-subtle)' }}>
          共 {docs.length} 份
        </span>
      </div>
      <div className="overflow-x-auto px-2 pb-2">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr style={{ color: 'var(--fg-subtle)' }}>
              {['名称', '类型', '敏感级别', '块数', '大小', '导入时间', '操作'].map((h) => (
                <th
                  key={h}
                  className="whitespace-nowrap border-b px-3 py-2 text-left text-xs font-medium"
                  style={{ borderColor: 'var(--border)' }}
                  scope="col"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {docs.map((doc) => {
              const typeMeta = DOC_TYPE_META[doc.doc_type]
              return (
                <tr key={doc.id} className="group transition-colors">
                  <td
                    className="border-b px-3 py-2.5 font-medium group-hover:bg-[var(--bg-inset)]"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    {doc.filename}
                    <div className="tnum mt-0.5 font-mono text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
                      {doc.id}
                    </div>
                  </td>
                  <td
                    className="border-b px-3 py-2.5 group-hover:bg-[var(--bg-inset)]"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <span className={`badge ${typeMeta.badge}`}>{typeMeta.label}</span>
                  </td>
                  <td
                    className="border-b px-3 py-2.5 group-hover:bg-[var(--bg-inset)]"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <SensitivityBadge level={doc.sensitivity} />
                  </td>
                  <td
                    className="tnum border-b px-3 py-2.5 font-mono text-[13px] group-hover:bg-[var(--bg-inset)]"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    {doc.n_chunks}
                  </td>
                  <td
                    className="tnum border-b px-3 py-2.5 text-xs group-hover:bg-[var(--bg-inset)]"
                    style={{ borderColor: 'var(--border)', color: 'var(--fg-muted)' }}
                  >
                    {formatBytes(MOCK_SIZES[doc.id] ?? 0)}
                  </td>
                  <td
                    className="tnum border-b px-3 py-2.5 text-xs group-hover:bg-[var(--bg-inset)]"
                    style={{ borderColor: 'var(--border)', color: 'var(--fg-muted)' }}
                  >
                    {doc.created_at}
                  </td>
                  <td
                    className="border-b px-3 py-2.5 group-hover:bg-[var(--bg-inset)]"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div className="flex gap-1.5">
                      <button type="button" className="btn btn-ghost btn-sm" disabled title="重建索引(P2)">
                        重建索引
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled
                        title="删除文档(P2)"
                        style={{ color: 'var(--danger)' }}
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="px-5 pb-4 pt-1 text-xs" style={{ color: 'var(--fg-subtle)' }}>
        切片(block)由后端入库时自动计算;「重建索引」会在文档内容变更后重新向量化。
      </p>
    </section>
  )
}

/** / 资料库:上传 / 文档列表 / 隐私提示 三区,数据为后端契约结构的占位数组 */
export default function LibraryPage() {
  return (
    <div>
      <PageHeader
        title="资料库"
        description="上传简历、JD、面经与学习资料,构建个人知识底座"
        actions={
          <button type="button" className="btn btn-primary" disabled>
            上传文档
          </button>
        }
      />
      <UploadZone />
      <PrivacyNote />
      <DocTable />
    </div>
  )
}
