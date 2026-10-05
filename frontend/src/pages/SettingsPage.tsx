import { useQuery } from '@tanstack/react-query'
import { get } from '../api/client'
import type { ProviderInfo } from '../api/types'
import { PageHeader, WipPlaceholder } from '../components/PageHeader'

/**
 * 拉取 provider 列表。后端可能返回纯数组或 { providers: [...] },
 * 脚手架阶段先做兼容;等 openapi-typescript 类型生成后收敛。
 */
async function fetchProviders(): Promise<ProviderInfo[]> {
  const data = await get<ProviderInfo[] | { providers: ProviderInfo[] }>(
    '/api/settings/providers',
  )
  return Array.isArray(data) ? data : (data.providers ?? [])
}

/** 单行"已设置/未设置"状态:后端字段名待契约定型,先兼容两种写法 */
function keyStatus(p: ProviderInfo): { set: boolean; label: string } {
  const set = p.api_key_set ?? p.configured ?? false
  return { set, label: set ? '已设置' : '未设置' }
}

function P2Button({ children }: { children: string }) {
  return (
    <span className="tooltip-host" data-tooltip="P2 接入">
      <button className="btn btn-ghost" disabled>
        {children}
      </button>
    </span>
  )
}

export default function SettingsPage() {
  const { data: providers, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['settings', 'providers'],
    queryFn: fetchProviders,
  })

  return (
    <div>
      <PageHeader
        title="设置"
        description="配置模型 provider 与 local_only / 云端路由策略"
        actions={
          <button className="btn btn-ghost" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? '刷新中…' : '刷新'}
          </button>
        }
      />

      <section className="card mb-8 p-5 md:p-6">
        <h2 className="mb-3 text-base font-semibold">模型 Providers</h2>

        {isLoading ? (
          <p className="py-4 text-sm" style={{ color: 'var(--fg-muted)' }}>
            加载中…
          </p>
        ) : isError ? (
          <div className="py-4 text-sm" style={{ color: 'var(--danger)' }}>
            读取 providers 失败:请确认后端已启动(127.0.0.1:8000)。
            <span className="block pt-1 text-xs" style={{ color: 'var(--fg-muted)' }}>
              {error instanceof Error ? error.message : String(error)}
            </span>
          </div>
        ) : (providers?.length ?? 0) === 0 ? (
          <p className="py-4 text-sm" style={{ color: 'var(--fg-muted)' }}>
            后端未返回任何 provider。
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr
                className="border-b text-left"
                style={{ borderColor: 'var(--border)', color: 'var(--fg-muted)' }}
              >
                <th className="py-2 pr-4 font-medium">名称</th>
                <th className="py-2 pr-4 font-medium">ID</th>
                <th className="py-2 pr-4 font-medium">API Key 环境变量</th>
                <th className="py-2 pr-4 font-medium">状态</th>
                <th className="py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {providers!.map((p) => {
                const st = keyStatus(p)
                return (
                  <tr key={p.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                    <td className="py-2.5 pr-4">{p.name}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs">{p.id}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs">{p.api_key_env}</td>
                    <td className="py-2.5 pr-4">
                      <span
                        className="rounded-full px-2 py-0.5 text-xs"
                        style={
                          st.set
                            ? { backgroundColor: 'var(--bg)', color: 'var(--fg)' }
                            : { backgroundColor: 'var(--bg)', color: 'var(--fg-muted)' }
                        }
                      >
                        {st.label}
                      </span>
                      {p.local_only ? (
                        <span
                          className="ml-2 rounded-full px-2 py-0.5 text-xs"
                          style={{ backgroundColor: 'var(--bg)', color: 'var(--fg-muted)' }}
                        >
                          local_only
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5">
                      <div className="flex gap-2">
                        <P2Button>编辑</P2Button>
                        <P2Button>测试连接</P2Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2 className="mb-4 text-base font-semibold">路由策略</h2>
        <WipPlaceholder label="local_only / 云端路由配置(/api/settings/routing)" />
      </section>
    </div>
  )
}
