import { useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { Reveal } from '../components/Motion'

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
    <section className="card card-raised mb-6">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">上传文档</h2>
        <span className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
          支持 PDF / Word / Markdown · 单个文件不超过 20 MB
        </span>
      </div>
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
      </button>
      <p className="mt-3 text-xs leading-relaxed" style={{ color: 'var(--fg-subtle)' }}>
        上传前请确认文件中不含身份证号、真实手机号等隐私信息;标记为「仅本机」的内容永远不会离开这台电脑。
      </p>
    </section>
  )
}

/** 区域二:文档列表 —— 桌面为表格,手机端卡片化 */
function DocTable() {
  const [docs] = useState<DocRow[]>(MOCK_DOCS)

  // 手机端:每份文档一张卡
  function DocCards() {
    return (
      <ul className="flex flex-col gap-3 md:hidden" role="list">
        {docs.map((doc, i) => {
          const typeMeta = DOC_TYPE_META[doc.doc_type]
          return (
            <Reveal key={doc.id} index={i} as="li" className="rounded-lg border p-4" data-mobile="card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium break-all">{doc.filename}</div>
                  <div className="tnum mt-1 font-mono text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
                    {doc.id}
                  </div>
                </div>
                <SensitivityBadge level={doc.sensitivity} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs" style={{ color: 'var(--fg-muted)' }}>
                <span className={`badge ${typeMeta.badge}`}>{typeMeta.label}</span>
                <span className="tnum">{doc.n_chunks} 块</span>
                <span className="tnum">{formatBytes(MOCK_SIZES[doc.id] ?? 0)}</span>
                <span className="tnum">{doc.created_at}</span>
              </div>
              <div className="mt-3 flex gap-2 border-t pt-3">
                <button type="button" className="btn btn-ghost btn-sm" disabled title="重建索引(P2)">重建索引</button>
                <button type="button" className="btn btn-ghost btn-sm" disabled title="删除文档(P2)" style={{ color: 'var(--danger)' }}>删除</button>
              </div>
            </Reveal>
          )
        })}
      </ul>
    )
  }

  // 平板/桌面:表格,横向可滚兜底
  function DocTableDesktop() {
    return (
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[640px] border-collapse text-sm">
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
            {docs.map((doc, i) => (
              <Reveal
                key={doc.id}
                index={i}
                as="tr"
                className="group"
              >
                <td
                  className="border-b px-3 py-3 font-medium"
                  style={{ borderColor: 'var(--border)' }}
                >
                  {doc.filename}
                  <div className="tnum mt-0.5 font-mono text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
                    {doc.id}
                  </div>
                </td>
                <td className="border-b px-3 py-3" style={{ borderColor: 'var(--border)' }}>
                  <span className={`badge ${DOC_TYPE_META[doc.doc_type].badge}`}>{DOC_TYPE_META[doc.doc_type].label}</span>
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
                  {formatBytes(MOCK_SIZES[doc.id] ?? 0)}
                </td>
                <td
                  className="tnum border-b px-3 py-3 text-xs"
                  style={{ borderColor: 'var(--border)', color: 'var(--fg-muted)' }}
                >
                  {doc.created_at}
                </td>
                <td className="border-b px-3 py-3" style={{ borderColor: 'var(--border)' }}>
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
              </Reveal>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <section className="card p-5 md:p-6">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">文档列表</h2>
        <span className="tnum text-xs" style={{ color: 'var(--fg-subtle)' }}>
          共 {docs.length} 份
        </span>
      </div>
      <DocCards />
      <DocTableDesktop />
      <p className="mt-4 text-xs leading-relaxed" style={{ color: 'var(--fg-subtle)' }}>
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
      <DocTable />
    </div>
  )
}
