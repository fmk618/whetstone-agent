import { NavLink, Outlet } from 'react-router-dom'
import { CloudConfirmDialog } from './CloudConfirmDialog'

interface NavItem {
  to: string
  label: string
  icon: string
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: '资料库', icon: '📚' },
  { to: '/profile', label: '知识档案', icon: '🗂️' },
  { to: '/job', label: '目标岗位', icon: '🎯' },
  { to: '/quiz', label: '出题练习', icon: '✍️' },
  { to: '/interview', label: '模拟面试', icon: '🎤' },
  { to: '/review', label: '复习看板', icon: '🔁' },
  { to: '/settings', label: '设置', icon: '⚙️' },
]

/** 左侧导航 + 主内容区布局(子路由经 <Outlet /> 渲染) */
export function SideNavLayout() {
  return (
    <div className="flex min-h-full">
      <nav
        className="flex w-52 shrink-0 flex-col border-r px-3 py-5"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)' }}
      >
        <div className="mb-6 px-2">
          <div className="text-base font-bold tracking-wide">磨刀石</div>
          <div className="mt-0.5 text-xs" style={{ color: 'var(--fg-muted)' }}>
            个人面试与学习智能体
          </div>
        </div>

        <ul className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                    isActive ? 'font-semibold' : ''
                  }`
                }
                style={({ isActive }) =>
                  isActive
                    ? { backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }
                    : { color: 'var(--fg)' }
                }
              >
                <span aria-hidden>{item.icon}</span>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="px-3 text-xs" style={{ color: 'var(--fg-muted)' }}>
          v0.1 · 脚手架
        </div>
      </nav>

      <main className="min-w-0 flex-1 px-8 py-6">
        <Outlet />
      </main>

      {/* local_only → 云端 的 409 知情确认对话框,全局挂载 */}
      <CloudConfirmDialog />
    </div>
  )
}
