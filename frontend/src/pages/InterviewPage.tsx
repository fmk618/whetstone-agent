import { PageHeader, WipPlaceholder } from '../components/PageHeader'

export default function InterviewPage() {
  return (
    <div>
      <PageHeader title="模拟面试" description="多轮对话式模拟面试与复盘" />
      <div className="card">
        <WipPlaceholder label="面试会话" />
      </div>
    </div>
  )
}
