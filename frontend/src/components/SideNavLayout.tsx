import { useEffect, useState, type ReactNode, type SVGProps } from 'react'
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

interface NavGroup {
  title: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: '工作室',
    items: [
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
    ],
  },
  {
    title: '修炼',
    items: [
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
    ],
  },
  {
    title: '系统',
    items: [
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
    ],
  },
]

const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items)

/** 当前路由对应的页面标题(供顶栏与移动顶栏展示) */
function usePageTitle(): string {
  const { pathname } = useLocation()
  if (pathname === '/') return '资料库'
  const hit = ALL_NAV_ITEMS.find((item) => item.to !== '/' && pathname.startsWith(item.to))
  return hit?.label ?? '磨刀石'
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      {NAV_GROUPS.map((group) => (
        <div key={group.title}>
          <div className="nav-group-title" aria-hidden="true">
            {group.title}
          </div>
          <ul className="flex flex-col gap-1.5" role="list">
            {group.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `nav-link ${isActive ? 'is-active' : ''}`
                  }
                >
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  )
}

/** 左侧导航 + 主内容区布局。手机端:顶栏汉堡按钮 + 滑入抽屉 + 遮罩 */
export function SideNavLayout() {
  const pageTitle = usePageTitle()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { pathname } = useLocation()

  // 路由变化时收起抽屉
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  // 开启时锁住 body 滚动(遮罩之下不再滚)
  useEffect(() => {
    if (!drawerOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [drawerOpen])

  // Escape 关闭抽屉
  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  return (
    <div className="flex min-h-full flex-col md:flex-row" style={{ backgroundColor: 'var(--bg)' }}>
      {/* 桌面/平板侧栏 */}
      <aside
        className="sticky top-0 hidden h-full max-h-screen shrink-0 flex-col pb-4 pt-6 md:flex md:w-[228px]"
        style={{ backgroundColor: 'var(--bg)', borderRight: '1px solid var(--border)' }}
        aria-label="主导航"
      >
        <div className="nav-brand flex items-center gap-2.5 px-5">
          <WhetstoneMark />
          <div className="text-[15px] font-semibold leading-tight tracking-wide">磨刀石</div>
        </div>

        <nav className="flex-1 overflow-y-auto pb-2" aria-label="主导航链接">
          <NavLinks />
        </nav>
      </aside>

      {/* 手机端顶栏:汉堡 + 标题 */}
      <header
        className="sticky top-0 z-30 flex h-13 shrink-0 items-center gap-2 px-4 py-2.5 md:hidden"
        style={{ backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}
      >
        <button
          type="button"
          className="btn btn-ghost px-2.5"
          aria-label={drawerOpen ? '关闭导航' : '打开导航'}
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen((v) => !v)}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            {drawerOpen ? (
              <path d="M6 6l12 12M18 6 6 18" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <WhetstoneMark />
          <span className="text-[14px] font-semibold">磨刀石</span>
        </div>
        <span className="ml-auto text-[13px]" style={{ color: 'var(--fg-muted)' }}>
          {pageTitle}
        </span>
      </header>

      {/* 手机端抽屉:遮罩 + 滑入面板 */}
      {drawerOpen ? (
        <>
          <div
            className="drawer-mask fixed inset-0 z-40 md:hidden"
            style={{ backgroundColor: 'rgba(30, 22, 10, 0.4)' }}
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="drawer-panel fixed top-0 left-0 z-50 flex h-full w-[240px] flex-col overflow-y-auto pb-5 pt-5 md:hidden"
            style={{ backgroundColor: 'var(--bg)', borderRight: '1px solid var(--border)' }}
            aria-label="主导航抽屉"
          >
            <div className="nav-brand flex items-center gap-2.5 px-5">
              <WhetstoneMark />
              <div className="text-[15px] font-semibold leading-tight tracking-wide">磨刀石</div>
            </div>
            <nav className="flex-1 pb-3" aria-label="主导航链接">
              <NavLinks onNavigate={() => setDrawerOpen(false)} />
            </nav>
          </aside>
        </>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* 桌面端上方留白顶栏(手机端顶栏已含) */}
        <header
          className="hidden h-6 shrink-0 border-b md:flex"
          style={{ borderColor: 'transparent', backgroundColor: 'var(--bg)' }}
        >
          <span className="sr-only">{pageTitle}</span>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 md:px-7 md:py-8 lg:px-10">
          <div className="page-content">
            <div className="page-enter" key={pathname}>
              <Outlet />
            </div>
          </div>
        </main>
      </div>

      {/* local_only → 云端 的 409 知情确认对话框,全局挂载 */}
      <CloudConfirmDialog />
    </div>
  )
}
