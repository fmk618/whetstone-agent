import { PageHeader, WipPlaceholder } from '../components/PageHeader'

export default function ProfilePage() {
  return (
    <div>
      <PageHeader title="知识档案" description="从资料库提炼出的个人技能与项目画像" />
      <div className="card">
        <WipPlaceholder label="档案生成 / 编辑" />
      </div>
    </div>
  )
}
