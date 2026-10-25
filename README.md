# I画创前端

I画创的公开 Vue 前端、产品展示页和 GitHub Pages 演示站点。

- 产品页：<https://0fengzi0.github.io/I-HuaChuang-Frontend/>
- 前端演示：<https://0fengzi0.github.io/I-HuaChuang-Frontend/app/>
- GitHub 仓库：<https://github.com/0fengzi0/I-HuaChuang-Frontend>

## 技术栈

- Vue 3 + TypeScript
- Pinia + Vue Router + TanStack Query
- Vite + Tailwind CSS
- Vitest + Playwright

## 本地开发

需要 Node.js 22+。

```powershell
npm ci
npm run dev
```

默认访问 `http://localhost:5173`，开发服务器会把 `/api` 代理到
`http://localhost:8080`。真实登录、积分和图片生成需要单独运行 I画创 Go 后端。

不连接后端时，可启动哈希路由和内置演示数据：

```powershell
npm run dev -- --mode pages
```

访问 `http://localhost:5173/I-HuaChuang-Frontend/app/`。

## 验证

```powershell
npm run lint
npm run build
npm run test:unit
npm run test:e2e
```

Playwright 默认使用本机 Microsoft Edge，并自动启动演示模式开发服务器。

## GitHub Pages

`npm run build:pages` 会完成以下工作：

1. 使用 `/I-HuaChuang-Frontend/app/` 基路径构建 Vue SPA。
2. 复制 `site/` 中的产品页与截图。
3. 将 SPA 写入 `_site/app/`。
4. 写入启用内置演示数据的运行时 `config.js`。

`Deploy GitHub Pages` 工作流在每次推送到 `main` 后重新构建并发布 `_site`。
GitHub Pages 只托管静态前端，不运行 Go API、数据库或真实图片生成服务。

## 运行时配置

非演示环境可以在部署后的 `config.js` 中设置后端地址：

```js
window.__IHUACHUANG_CONFIG__ = {
  apiBaseUrl: "https://api.example.com",
  demoMode: false,
}
```

仓库不会保存 API Key、数据库凭据或后端配置。
