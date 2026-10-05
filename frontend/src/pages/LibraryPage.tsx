import { PageHeader, WipPlaceholder } from '../components/PageHeader'

/** / 资料库:占位页,但布局含"上传 / 列表 / 敏感提示"三个区域框架 */
export default function LibraryPage() {
  return (
    <div>
      <PageHeader
        title="资料库"
        description="上传简历、JD、面经与学习资料,构建个人知识底座"
        actions={<button className="btn btn-primary" disabled>上传文档</button>}
      />

      {/* 区域一:上传 */}
      <section className="card mb-4">
        <h2 className="mb-3 text-base font-semibold">上传文档</h2>
        <div
          className="rounded-md border border-dashed px-4 py-8 text-center text-sm"
          style={{ borderColor: 'var(--border)', color: 'var(--fg-muted)' }}
        >
          拖拽文件到此处,或点击选择(PDF / Word / Markdown)· 施工中
        </div>
      </section>

      {/* 区域二:敏感提示 */}
      <section className="card mb-4">
        <h2 className="mb-3 text-base font-semibold">隐私与敏感提示</h2>
        <div
          className="rounded-md px-4 py-3 text-sm"
          style={{ backgroundColor: 'var(--bg)', color: 'var(--fg-muted)' }}
        >
          标记为 local_only 的内容只在本机推理;若必须使用云端,会弹出知情确认后才会发送。· 施工中
        </div>
      </section>

      {/* 区域三:文档列表 */}
      <section className="card">
        <h2 className="mb-3 text-base font-semibold">文档列表</h2>
        <WipPlaceholder label="列表 / 删除 / 重建索引 / 归属 profile" />
      </section>
    </div>
  )
}
