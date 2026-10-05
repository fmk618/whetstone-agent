import { PageHeader, WipPlaceholder } from '../components/PageHeader'

export default function JobPage() {
  return (
    <div>
      <PageHeader title="目标岗位" description="维护 JD 与岗位要求,驱动出题与面试方向" />
      <div className="card">
        <WipPlaceholder label="JD 管理" />
      </div>
    </div>
  )
}
