import { useEffect, useState, type ReactNode, type SVGProps } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
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
 * 装订线导航项 —— 单点 morph:
 * 静置恒为 36×36 纯图标(装订线 64/56px 不变);胶囊态(当前页长显,
 * 或点击其它项迁移过去)图标不动、右侧文字从旁边淡入,宽度由文字撑开。
 * 再点已展开项收回到纯图标。hover 只做变色轻反馈。
 */
function RailItem({
  item,
  expanded,
  onExpand,
}: {
  item: NavItem
  expanded: boolean
  onExpand: (to: string) => void
}) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      aria-label={item.label}
      className={({ isActive }) =>
        `rail-item ${expanded ? 'rail-item-open' : ''} ${
          isActive ? 'is-active text-[color:var(--accent)]' : 'text-[color:var(--fg-subtle)] hover:text-[color:var(--fg)]'
        }`
      }
      onClick={() => onExpand(item.to)}
    >
      {() => (
        <>
          <span className="grid h-9 w-9 shrink-0 place-items-center">{item.icon}</span>
          <span className="rail-pill">
            <span className="rail-pill-label">{item.label}</span>
          </span>
        </>
      )}
    </NavLink>
  )
}

/** 手机底部 dock 项:20px 图标 + 下方 10.5px 文字标签;active 是上缘 3px 铅笔勾 */
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
          {isActive && (
            <span
              aria-hidden="true"
              className="absolute top-0 left-1/2 h-[3px] w-4 -translate-x-1/2 rounded-b"
              style={{ backgroundColor: 'var(--accent)' }}
            />
          )}
          <span className="[&>svg]:h-5 [&>svg]:w-5">{item.icon}</span>
          <span className="dock-label max-w-full truncate">{item.label}</span>
        </>
      )}
    </NavLink>
  )
}

/**
 * 「一页书」布局:
 * 桌面 ≥md 装订线恒 64px(lg)/ 56px(md),导航项静置 36×36 纯图标;
 * 当前页默认长显图标+文字胶囊;点击其它项胶囊即时迁移(200ms morph),
 * 再点已展开项收回纯图标。整条侧栏不再有 208px 展开档位。
 * 手机 <md 为 52px 底部 dock(上缘 0.5px 墨线),图标 + 10.5px 文字标签。
 */
export function SideNavLayout() {
  // 当前长显胶囊的导航项:跟随路由(品牌印 / 程序内跳转也会带动)
  const [openTo, setOpenTo] = useState('')
  const { pathname } = useLocation()

  useEffect(() => {
    setOpenTo(pathname)
  }, [pathname])

  /** 点已展开项收回;点其它项则胶囊迁移过去 */
  const handleExpand = (to: string) => {
    setOpenTo((prev) => (prev === to ? '' : to))
  }

  return (
    <div
      className="flex h-full min-h-0"
      style={{ backgroundColor: 'var(--bg)', color: 'var(--fg)' }}
    >
      {/* 装订线:与纸同底、无右边框;宽度恒定,仅单项位置 morph 出文字胶囊 */}
      <aside
        className="hidden w-14 shrink-0 flex-col pb-4 pt-5 md:flex lg:w-16"
        aria-label="主导航"
      >
        {/* 品牌区:Mark 图标;「磨刀石」文字在其下方(装订线仅 56/64px,放不下横排) */}
        <NavLink
          to="/"
          aria-label="磨刀石 · 资料库"
          className="flex flex-col items-center gap-[2px] px-[12px] py-1"
        >
          <WhetstoneMark size={24} />
          <span className="brand-name">磨刀石</span>
        </NavLink>

        <nav className="mt-5 flex flex-1 flex-col items-start gap-[7px] px-[12px]" aria-label="主导航链接">
          {RAIL_ITEMS.map((item) => (
            <RailItem
              key={item.to}
              item={item}
              expanded={openTo === item.to}
              onExpand={handleExpand}
            />
          ))}
        </nav>

        {/* 底部设置项:与上面 6 项同模式 */}
        <div className="mt-4 flex flex-col items-start gap-[7px] px-[12px] pb-1">
          <RailItem
            item={SETTINGS_ITEM}
            expanded={openTo === SETTINGS_ITEM.to}
            onExpand={handleExpand}
          />
        </div>
      </aside>

      {/* 内容区:装订线右侧直接开始,页头由各页 PageHeader 提供 */}
      <main
        className="min-w-0 flex-1 overflow-y-auto px-4 pt-6 pb-[80px] md:px-6 md:py-8 lg:px-10 lg:pb-8 xl:px-10"
        style={{ backgroundColor: 'var(--bg)' }}
      >
        <div className="page-content">
          <div className="page-enter">
            <Outlet />
          </div>
        </div>
      </main>

      {/* 手机底部 dock:书页「页脚」延伸;上缘 0.5px 墨线 */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 flex h-[52px] items-stretch md:hidden"
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
