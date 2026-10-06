import type { ReactNode, SVGProps } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { CloudConfirmDialog } from './CloudConfirmDialog'

/** 统一 1.5 描边线性图标(与整体「锻铁」线条语言一致)。装订线内 24px 视觉尺寸 */
function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
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
function WhetstoneMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 28 28"
      width={size}
      height={size}
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

/** 装订线 / 底部 dock 共用的七项注记 */
const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: '资料库',
    icon: (
      <Icon>
        <path d="M4.5 5.5A2.5 2.5 0 0 1 7 3h3a2 2 0 0 1 2 2v15a3 3 0 0 0-3-2H7a2.5 2.5 0 0 1-2.5-2.5V5.5Z" />
        <path d="M19.5 5.5A2.5 2.5 0 0 0 17 3h-3a2 2 0 0 0-2 2v15a3 3 0 0 1 3-2h2.5a2.5 2.5 0 0 0 2.5-2.5V5.5Z" />
      </Icon>
    ),
  },
  {
    to: '/profile',
    label: '知识档案',
    icon: (
      <Icon>
        <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
        <circle cx="8.5" cy="10" r="2" />
        <path d="M5.8 16a3 3 0 0 1 5.4 0M14 9h3.5M14 12h3.5M14 15h2" />
      </Icon>
    ),
  },
  {
    to: '/job',
    label: '目标岗位',
    icon: (
      <Icon>
        <rect x="3.5" y="6.5" width="17" height="13" rx="2" />
        <path d="M8 6.5V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1.5M3.5 11.5h17M10 11.5v2h4v-2" />
      </Icon>
    ),
  },
  {
    to: '/quiz',
    label: '出题练习',
    icon: (
      <Icon>
        <rect x="5" y="4.5" width="14" height="17" rx="2" />
        <path d="M9 4.5v-1h6v1M8 10l1.5 1.5 3-3M14.5 10h2M8 16l1.5 1.5 3-3M14.5 16h2" />
      </Icon>
    ),
  },
  {
    to: '/interview',
    label: '模拟面试',
    icon: (
      <Icon>
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h7A2.5 2.5 0 0 1 16 5.5v5a2.5 2.5 0 0 1-2.5 2.5H9l-3.5 3v-3.1A2.5 2.5 0 0 1 4 10.5v-5Z" />
        <path d="M12 8.5h6.5A1.5 1.5 0 0 1 20 10v5a1.5 1.5 0 0 1-1.5 1.5h-.5v2.2l-2.5-2.2H13" />
      </Icon>
    ),
  },
  {
    to: '/review',
    label: '复习看板',
    icon: (
      <Icon>
        <rect x="4" y="5.5" width="16" height="15" rx="2" />
        <path d="M8 3.5v4M16 3.5v4M4 9.5h16M8 13.5h2M14 13.5h2M8 17h2" />
        <path d="M15.5 17.5a3.5 3.5 0 1 1 1.8-6.5M17.3 11v2.2h-2.2" />
      </Icon>
    ),
  },
  {
    to: '/settings',
    label: '设置',
    icon: (
      <Icon>
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0L6.2 6.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
        <circle cx="12" cy="12" r="3" />
      </Icon>
    ),
  },
]


const RAIL_ITEMS = NAV_ITEMS.filter((item) => item.to !== '/settings')
const SETTINGS_ITEM = NAV_ITEMS[NAV_ITEMS.length - 1]

function RailItem({ item, tabletOnly = false }: { item: NavItem; tabletOnly?: boolean }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      aria-label={item.label}
      className={({ isActive }) => `side-nav-item ${isActive ? 'is-active' : ''}`}
    >
      <span className="side-nav-icon">{item.icon}</span>
      <span className="side-nav-label">{item.label}</span>
      {tabletOnly ? <span className="side-nav-tooltip" aria-hidden="true">{item.label}</span> : null}
    </NavLink>
  )
}

function DockItem({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      aria-label={item.label}
      className={({ isActive }) =>
        `relative flex min-w-0 flex-1 flex-col items-center justify-center gap-[2px] pt-[2px] transition-colors duration-[120ms] active:text-[color:var(--fg)] ${
          isActive ? 'is-active text-[color:var(--accent)]' : 'text-[color:var(--fg-subtle)]'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive ? (
            <span aria-hidden="true" className="absolute top-0 left-1/2 h-[3px] w-4 -translate-x-1/2 rounded-b" style={{ backgroundColor: 'var(--accent)' }} />
          ) : null}
          <span className="[&>svg]:h-5 [&>svg]:w-5">{item.icon}</span>
          <span className="dock-label max-w-full truncate">{item.label}</span>
        </>
      )}
    </NavLink>
  )
}

export function SideNavLayout() {
  return (
    <div className="app-shell flex h-full min-h-0" style={{ backgroundColor: 'var(--bg)', color: 'var(--fg)' }}>
      <a className="skip-link" href="#main-content">跳到主要内容</a>

      <aside className="side-nav hidden shrink-0 flex-col md:flex" aria-label="主导航">
        <NavLink to="/" aria-label="磨刀石 · 资料库" className="side-nav-brand">
          <WhetstoneMark size={24} />
          <span className="side-nav-brand-name">磨刀石</span>
        </NavLink>

        <nav className="side-nav-list" aria-label="主导航链接">
          {RAIL_ITEMS.map((item) => <RailItem key={item.to} item={item} tabletOnly />)}
        </nav>

        <div className="side-nav-settings">
          <RailItem item={SETTINGS_ITEM} tabletOnly />
        </div>
      </aside>

      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 overflow-y-auto px-4 pt-6 pb-[80px] md:px-6 md:py-8 md:pb-8 lg:px-8 xl:px-10" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="page-content">
          <div className="page-enter"><Outlet /></div>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 flex h-[52px] items-stretch md:hidden" style={{ backgroundColor: 'var(--bg)', borderTop: '0.5px solid var(--border-ink, var(--border-strong))' }} aria-label="主导航">
        {NAV_ITEMS.map((item) => <DockItem key={item.to} item={item} />)}
      </nav>

      <CloudConfirmDialog />
    </div>
  )
}
