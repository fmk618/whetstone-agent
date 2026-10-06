import type { ReactNode, SVGProps } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { CloudConfirmDialog } from './CloudConfirmDialog'

/** 统一 1.5 描边线性图标(与整体「锻铁」线条语言一致)。装订线内用 28px 视觉尺寸 */
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

/** 装订线 / 底部 dock 共用的七项注记:纯图标,无文字(aria-label 补可访问性) */
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

const RAIL_ITEMS = NAV_ITEMS.filter((i) => i.to !== '/settings')
const SETTINGS_ITEM = NAV_ITEMS[NAV_ITEMS.length - 1]

/**
 * 装订线导航项:36×36 点击热区,28px 图标居中。
 * hover:图标色 --fg-subtle → --fg(120ms);无背景块。
 * active:图标变 --accent + 铅笔勾 3px 短竖线,锐利悬出装订线右缘(像页边批注)。
 */
function RailItem({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      title={item.label}
      aria-label={item.label}
      className={({ isActive }) =>
        `relative grid h-9 w-9 place-items-center text-[color:var(--fg-subtle)] transition-colors duration-[120ms] hover:text-[color:var(--fg)] ${
          isActive ? 'is-active text-[color:var(--accent)]' : ''
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              aria-hidden="true"
              className="absolute top-1/2 h-[18px] w-[3px] -translate-y-1/2 rounded-r"
              style={{ left: 'calc(100% + 6px)', backgroundColor: 'var(--accent)' }}
            />
          )}
          {item.icon}
        </>
      )}
    </NavLink>
  )
}

/** 手机底部 dock 项:同装订线语言,36px 热区,active 是顶端下垂 3px 铅笔勾 */
function DockItem({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      title={item.label}
      aria-label={item.label}
      className={({ isActive }) =>
        `relative grid h-9 w-9 place-items-center text-[color:var(--fg-subtle)] transition-colors duration-[120ms] active:text-[color:var(--fg)] ${
          isActive ? 'is-active text-[color:var(--accent)]' : ''
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              aria-hidden="true"
              className="absolute -top-[1px] left-1/2 h-[3px] w-4 -translate-x-1/2 rounded-b"
              style={{ backgroundColor: 'var(--accent)' }}
            />
          )}
          {item.icon}
        </>
      )}
    </NavLink>
  )
}

/**
 * 「一页书」布局:桌面 ≥lg 装订线 56px(平板 md 48px),同纸底、无分隔线、无背景块;
 * 手机 <768 为 52px 底部 dock(上缘 0.5px 墨线)。无抽屉、无遮罩、无顶栏,页头交给各页 PageHeader。
 */
export function SideNavLayout() {
  return (
    <div
      className="flex h-full min-h-0"
      style={{ backgroundColor: 'var(--bg)', color: 'var(--fg)' }}
    >
      {/* 装订线:与纸同底,无右边框,靠留白自身断开 */}
      <aside
        className="hidden shrink-0 flex-col items-center pb-5 pt-5 md:flex md:w-12 lg:w-14"
        aria-label="主导航"
      >
        {/* 品牌印:仅 Mark,链到资料库 */}
        <NavLink
          to="/"
          aria-label="磨刀石 · 资料库"
          title="磨刀石"
          className="mb-6 grid h-8 w-8 place-items-center"
        >
          <WhetstoneMark size={24} />
        </NavLink>

        <nav className="flex flex-1 flex-col items-center gap-[11px]" aria-label="主导航链接">
          {RAIL_ITEMS.map((item) => (
            <RailItem key={item.to} item={item} />
          ))}
        </nav>

        <RailItem item={SETTINGS_ITEM} />
      </aside>

      {/* 内容区:装订线右侧直接开始,页头由各页 PageHeader 提供(批次 1) */}
      <main
        className="min-w-0 flex-1 overflow-y-auto px-4 pt-8 pb-24 md:px-6 md:py-8 lg:px-12 lg:pb-8 xl:px-16"
        style={{ backgroundColor: 'var(--bg)' }}
      >
        <div className="page-content">
          <div className="page-enter">
            <Outlet />
          </div>
        </div>
      </main>

      {/* 手机底部 dock:书页「页脚」延伸;z-index 高于内容,低于浮层 */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 flex h-[52px] items-stretch justify-around md:hidden"
        style={{
          backgroundColor: 'var(--bg)',
          borderTop: '0.5px solid var(--border-ink, var(--border-strong))',
        }}
        aria-label="主导航"
      >
        {NAV_ITEMS.map((item) => (
          <DockItem key={item.to} item={item} />
        ))}
      </nav>

      {/* local_only → 云端 的 409 知情确认对话框,全局挂载 */}
      <CloudConfirmDialog />
    </div>
  )
}
