# whetstone-agent frontend

个人面试与学习智能体(磨刀石)的前端,React 18 + Vite 6 + TypeScript(严格模式)+ Tailwind v4 + TanStack Query + React Router。

## 命令

```bash
npm install     # 安装依赖
npm run dev     # 开发服务器(Vite,默认 http://localhost:5173)
npm run build   # 先 tsc --noEmit 类型检查,再产物输出到 dist/
npm run preview # 本地预览 dist/ 产物
```

## 后端代理

`vite.config.ts` 中 `server.proxy` 把所有 `/api/*` 请求转发到 FastAPI 后端 `http://127.0.0.1:8000`,开发时前端代码统一用相对路径(如 `/api/settings/providers`),无跨域问题。后端未启动时,依赖后端的页面(如设置页)会显示请求失败提示。

## 结构速览

- `src/api/client.ts` — fetch 封装(get/post/put/del),非 2xx 抛 `ApiError {status, body}`;`src/api/types.ts` 为手写最小类型(后续用 openapi-typescript 生成替换)。
- `src/components/CloudConfirmDialog.tsx` — local_only 内容发云端时后端返回 `409 {detail, provider_id}`,此处弹出知情确认,确认后带 `confirm_cloud=true` 重发。
- `src/pages/` — 路由页面(资料库 / 知识档案 / 目标岗位 / 出题练习 / 模拟面试 / 复习看板 / 设置),多数为"施工中"占位;设置页已真实拉取 `GET /api/settings/providers` 渲染。
