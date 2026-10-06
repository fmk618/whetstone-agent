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
      <button type="button" className="btn btn-ghost" disabled>
        {children}
      </button>
    </span>
  )
}

function ProviderBadges({ provider }: { provider: ProviderInfo }) {
  const st = keyStatus(provider)
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className="rounded-full px-2 py-0.5 text-xs"
        style={{ backgroundColor: 'var(--bg)', color: st.set ? 'var(--fg)' : 'var(--fg-muted)' }}
      >
        {st.label}
      </span>
      {provider.local_only ? (
        <span
          className="rounded-full px-2 py-0.5 text-xs"
          style={{ backgroundColor: 'var(--bg)', color: 'var(--fg-muted)' }}
        >
          local_only
        </span>
      ) : null}
    </div>
  )
}

function ProviderActions() {
  return (
    <div className="flex flex-wrap gap-2">
      <P2Button>编辑</P2Button>
      <P2Button>测试连接</P2Button>
    </div>
  )
}

export default function SettingsPage() {
  const { data: providers, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['settings', 'providers'],
    queryFn: fetchProviders,
  })

  return (
    <div className="min-w-0">
      <PageHeader
        title="设置"
        actions={
          <button className="btn btn-ghost" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? '刷新中…' : '刷新'}
          </button>
        }
      />

      <section className="card mb-8 min-w-0 p-5 md:p-6">
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
          <>
            {/* 桌面保持数据表格;窄屏改为卡片,避免五列被挤到视口外。 */}
            <div className="hidden min-w-0 overflow-x-auto overscroll-x-contain md:block">
              <table className="w-full min-w-[640px] text-sm">
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
                  {providers!.map((p) => (
                    <tr key={p.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                      <td className="min-w-0 py-2.5 pr-4 break-words">{p.name}</td>
                      <td className="min-w-0 py-2.5 pr-4 break-all font-mono text-xs">{p.id}</td>
                      <td className="min-w-0 py-2.5 pr-4 break-all font-mono text-xs">{p.api_key_env}</td>
                      <td className="py-2.5 pr-4">
                        <ProviderBadges provider={p} />
                      </td>
                      <td className="py-2.5">
                        <ProviderActions />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 手机端每个 provider 独立成卡片,名称、环境变量与按钮均可换行。 */}
            <div className="space-y-3 md:hidden">
              {providers!.map((p) => (
                <article
                  key={p.id}
                  className="min-w-0 rounded-lg border p-3"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h3 className="min-w-0 break-words text-sm font-semibold">{p.name}</h3>
                    <span className="min-w-0 break-all font-mono text-xs" style={{ color: 'var(--fg-muted)' }}>
                      {p.id}
                    </span>
                  </div>
                  <dl className="mt-3 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
                    <dt style={{ color: 'var(--fg-muted)' }}>API Key 环境变量</dt>
                    <dd className="min-w-0 break-all font-mono text-xs">{p.api_key_env}</dd>
                    <dt style={{ color: 'var(--fg-muted)' }}>状态</dt>
                    <dd className="min-w-0">
                      <ProviderBadges provider={p} />
                    </dd>
                  </dl>
                  <div className="mt-3">
                    <ProviderActions />
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="card min-w-0">
        <h2 className="mb-4 text-base font-semibold">路由策略</h2>
        <WipPlaceholder label="local_only / 云端路由配置(/api/settings/routing)" />
      </section>
    </div>
  )
}
