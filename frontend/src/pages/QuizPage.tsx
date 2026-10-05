import { PageHeader, WipPlaceholder } from '../components/PageHeader'

export default function QuizPage() {
  return (
    <div>
      <PageHeader title="出题练习" description="基于资料库与目标岗位生成练习题并作答" />
      <div className="card">
        <WipPlaceholder label="练习会话 / 作答 / 导出" />
      </div>
    </div>
  )
}
