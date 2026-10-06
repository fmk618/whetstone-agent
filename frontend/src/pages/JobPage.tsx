import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'

/** 岗位分析功能尚未开放。页面保留真实输入入口，但不预填岗位描述、匹配结果或能力分析。 */
function JdEditor() {
  const [jd, setJd] = useState('')

  return (
    <section className="card jd-editor-card flex min-h-0 flex-col">
      <h2 className="mb-3 shrink-0 text-base font-semibold">岗位描述</h2>
      <label className="sr-only" htmlFor="jd-text">岗位描述原文</label>
      <textarea
        id="jd-text"
        className="input jd-editor-textarea min-h-0 min-w-0 w-full flex-1 resize-y leading-relaxed"
        value={jd}
        onChange={(event) => setJd(event.target.value)}
        placeholder="粘贴岗位描述原文……"
      />
      <div className="mt-3 flex shrink-0 items-center justify-between">
        <span className="tnum text-xs" style={{ color: 'var(--fg-subtle)' }}>{jd.length} 字</span>
        <button type="button" className="btn btn-primary" disabled title="岗位分析功能暂未开放">
          解析岗位
        </button>
      </div>
    </section>
  )
}

function EmptyAnalysisState() {
  return (
    <section className="card p-8 text-center md:p-10">
      <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="var(--fg-subtle)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mx-auto">
        <path d="M4.5 5.5A2 2 0 0 1 6.5 3.5h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-7l-4.5 3v-3.5h-.5a2 2 0 0 1-2-2v-9.5Z" />
        <path d="M8 9h8M8 12.5h5" />
      </svg>
      <h2 className="mt-3 text-base font-semibold">暂无岗位分析结果</h2>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
        岗位分析功能正在开发中，完成后这里会显示岗位匹配结果和能力分析。
      </p>
      <div
        className="mt-4 rounded-md border border-dashed px-4 py-5 text-center text-sm"
        style={{ borderColor: 'var(--border)', color: 'var(--fg-muted)' }}
      >
        岗位分析、岗位匹配和能力分析功能暂未开放
      </div>
      <Link to="/" className="btn btn-ghost mt-4">前往资料库上传岗位描述</Link>
    </section>
  )
}

export default function JobPage() {
  return (
    <div>
      <PageHeader title="目标岗位" />
      <div className="flex flex-col gap-6 lg:gap-8">
        <JdEditor />
        <EmptyAnalysisState />
      </div>
    </div>
  )
}
