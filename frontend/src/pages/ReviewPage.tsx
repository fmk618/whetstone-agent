import { PageHeader, WipPlaceholder } from '../components/PageHeader'

export default function ReviewPage() {
  return (
    <div>
      <PageHeader title="复习看板" description="今日待复习题目与记忆曲线" />
      <div className="card">
        <WipPlaceholder label="今日复习队列(/api/quiz/review/today)" />
      </div>
    </div>
  )
}
