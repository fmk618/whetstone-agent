import type { ReactNode, SVGProps } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { CloudConfirmDialog } from './CloudConfirmDialog'

/** 统一 1.5 描边线性图标(与整体「锻铁」线条语言一致) */
function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
      {...props}
    >
      {children}
    </svg>
  )
}

/** 品牌:磨刀石上的一柄刀刃 —— 两块叠石与一道开锋的斜刃 */
function WhetstoneMark() {
  return (
    <svg
      viewBox="0 0 28 28"
      width="30"
      height="30"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      {/* 磨石基座 */}
      <rect x="3" y="18" width="22" height="6" rx="1.5" stroke="var(--fg-subtle)" strokeWidth="1.5" />
      {/* 刀刃:斜向开锋 */}
      <path
        d="M7 16 L21 5 L23.5 10.5 L11 16.5 Z"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="var(--accent-soft)"
      />
      {/* 刃口高光 */}
      <path d="M21 5 L23.5 10.5" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

interface NavItem {
  to: string
  label: string
  icon: ReactNode
}

const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: '资料库',
    icon: (
      <Icon>
        <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H9a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5h-4A1.5 1.5 0 0 1 4 16V5.5Z" />
        <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H15a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5h4A1.5 1.5 0 0 0 20 16V5.5Z" />
      </Icon>
    ),
  },
  {
    to: '/profile',
    label: '知识档案',
    icon: (
      <Icon>
        <path d="M3.5 7A2.5 2.5 0 0 1 6 4.5h3.2c.7 0 1.4.3 1.9.9l.9 1.1h6A2.5 2.5 0 0 1 20.5 9v8A2.5 2.5 0 0 1 18 19.5H6A2.5 2.5 0 0 1 3.5 17V7Z" />
        <path d="M7.5 12.5h9M7.5 15.5h6" />
      </Icon>
    ),
  },
  {
    to: '/job',
    label: '目标岗位',
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="7.5" />
        <circle cx="12" cy="12" r="4.5" />
        <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      </Icon>
    ),
  },
  {
    to: '/quiz',
    label: '出题练习',
    icon: (
      <Icon>
        <path d="M5 4.5h11a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 16 19.5H5A1.5 1.5 0 0 1 3.5 18V6A1.5 1.5 0 0 1 5 4.5Z" />
        <path d="M7.5 8.5h7M7.5 12h7M7.5 15.5h4" />
        <path d="m17.5 14.5 3-3M20.5 11.5l1.5 1.5-3.5 3.5-2 .5.5-2Z" />
      </Icon>
    ),
  },
  {
    to: '/interview',
    label: '模拟面试',
    icon: (
      <Icon>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6" />
      </Icon>
    ),
  },
  {
    to: '/review',
    label: '复习看板',
    icon: (
      <Icon>
        <path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5" />
        <path d="M20 4.5v4h-4" />
        <path d="M20 12a8 8 0 0 1-13.7 5.6L4 15.5" />
        <path d="M4 19.5v-4h4" />
      </Icon>
    ),
  },
  {
    to: '/settings',
    label: '设置',
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5" />
      </Icon>
    ),
  },
]

/** 当前路由对应的页面标题(供顶栏展示) */
function usePageTitle(): string {
  const { pathname } = useLocation()
  if (pathname === '/') return '资料库'
  const hit = NAV_ITEMS.find((item) => item.to !== '/' && pathname.startsWith(item.to))
  return hit?.label ?? '磨刀石'
}

/** 左侧导航 + 主内容区布局(子路由经 <Outlet /> 渲染) */
export function SideNavLayout() {
  const pageTitle = usePageTitle()

  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <nav
        className="flex shrink-0 flex-col border-b px-3 pb-1 pt-3 md:w-56 md:border-b-0 md:border-r md:pb-4 md:pt-5"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)' }}
        aria-label="主导航"
      >
        {/* 品牌区(移动端与导航同行) */}
        <div className="mb-2 flex items-center gap-2.5 px-2 md:mb-7">
          <WhetstoneMark />
          <div>
            <div className="text-[15px] font-semibold leading-tight tracking-wide">磨刀石</div>
            <div className="mt-0.5 hidden text-[11px] leading-tight sm:block" style={{ color: 'var(--fg-subtle)' }}>
              个人面试与学习智能体
            </div>
          </div>
        </div>

        <ul className="flex flex-1 flex-row gap-0.5 overflow-x-auto md:flex-col md:overflow-visible">
          {NAV_ITEMS.map((item) => (
            <li key={item.to} className="shrink-0">
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `nav-link relative flex items-center gap-2.5 rounded-md px-3 py-[7px] text-sm transition-colors ${
                    isActive ? 'is-active' : ''
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive ? <span className="nav-edge" aria-hidden="true" /> : null}
                    {item.icon}
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* 隐私安心感:本地模式声明(移动端收起,空间不足) */}
        <div
          className="mt-4 hidden rounded-lg border px-3 py-2.5 text-[11px] leading-relaxed md:block"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-inset)', color: 'var(--fg-subtle)' }}
        >
          <div className="flex items-center gap-1.5 font-medium" style={{ color: 'var(--success)' }}>
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="4.5" y="10.5" width="15" height="9.5" rx="2" />
              <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
            </svg>
            本地模式 · 数据不出本机
          </div>
          <div className="mt-1">文档与作答仅存于本机,任何云端发送都会先经你确认。</div>
        </div>

        <div className="mt-3 hidden px-1 text-[11px] md:block" style={{ color: 'var(--fg-subtle)' }}>
          磨刀石 v0.1
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* 顶栏:当前页面标题(面包屑式定位) */}
        <header
          className="flex h-12 shrink-0 items-center border-b px-4 md:px-8"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)' }}
        >
          <span className="text-[13px] font-medium" style={{ color: 'var(--fg-muted)' }}>
            {pageTitle}
          </span>
        </header>

        <main className="min-w-0 flex-1 px-4 py-5 md:px-8 md:py-6">
          <Outlet />
        </main>
      </div>

      {/* local_only → 云端 的 409 知情确认对话框,全局挂载 */}
      <CloudConfirmDialog />
    </div>
  )
}
