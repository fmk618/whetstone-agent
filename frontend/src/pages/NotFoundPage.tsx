import { PageHeader, WipPlaceholder } from '../components/PageHeader'

export default function NotFoundPage() {
  return (
    <div>
      <PageHeader title="页面不存在" description="请检查地址或使用左侧导航" />
      <div className="card">
        <WipPlaceholder label="404" phase="无需施工" />
      </div>
    </div>
  )
}
