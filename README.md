# 课堂网络对照测试

独立测试资源，不修改原 Sites 项目，不是完整课堂反馈工具。

- GitHub Pages：https://wang-xijun.github.io/classroom-network-test-20261016/
- 源仓库：https://github.com/wang-xijun/classroom-network-test-20261016
- Cloudflare 后端与 D1：尚未部署，等待用户自己的 Cloudflare 授权。`public/config.js` 中 `apiBase: null` 表示未上线，不使用虚构地址。

## 范围与数据

页面依次显示：前端已打开、实时后端连接、一次虚拟记录写入和独立读取。数据库仅接受两个 UUID 与服务器时间，拒绝额外字段；不存姓名、学号、回答、IP 或完整请求头。页面不持久化标识。过 24 小时记录无法通过 API 读取，但未自动物理删除；测试结束后删除专用 D1 即可。

## 目录

- `public/`：静态页面唯一编辑源，GitHub 与 Worker 共用。
- `docs/`：GitHub Pages 发布副本，由 `node scripts/prepare-pages.mjs` 生成并提交。
- `worker/index.js`：Cloudflare Workers API。
- `migrations/0001_init.sql`：D1 结构及整个数据库最多 500 次成功写入的原子触发器。
- `scripts/worker.test.mjs`：Node SQLite 本地集成检查。不是远程 D1 验证。

## 运行与部署

1. `npm ci` 安装项目锁定的官方 Wrangler。
2. `npx wrangler whoami` 检查授权；尚未登录时由用户运行 `npx wrangler login` 并在 Cloudflare 官方授权页完成登录，无需粘贴任何密钥。
3. 确认账户是 Workers Free，若已有付费计划先暂停确认。此项目不升级计划、不购买服务。
4. `npx wrangler d1 create classroom-network-test-20261016` 创建专用 D1；把实际返回的 database_id 写入 `wrangler.jsonc`。没有真实 ID 时禁止发布。
5. `npx wrangler d1 migrations apply classroom-network-test-20261016 --remote` 初始化专用表。
6. `npx wrangler deploy` 发布 Worker 与 `public/` 静态直达页，保留实际返回的网址。
7. 将真实 Worker origin 写入 `public/config.js` 的 `apiBase`，运行 `node scripts/prepare-pages.mjs`，提交推送，再部署 Worker 使两份静态页一致。
8. 本地可运行 `npx wrangler dev --ip 127.0.0.1 --port 8787` 及本地迁移；仅同源 localhost 直达页，不额外开放跨域来源。

## 限制

- JSON 流式读取最多 256 字节，固定 schema，无任意 SQL、外部 URL 或列表接口。
- 跨域只允许 `https://wang-xijun.github.io`；浏览器 Origin 不含路径，因此不能将 CORS 精确到某个仓库目录。同源 Worker 直达页可以调用自身接口；拒绝其他 Origin，写入要求 Origin。
- CORS 不是身份认证，非浏览器客户端能伪造 Origin。限制主要依靠固定数据格式、平台限流和 500 条数据库写入硬上限。
- 平台限流按 IP 和 Cloudflare 节点计算，240 次/60 秒；校园共享出口会共用额度。这是测试用限制，不是生产课堂策略，也不是账单硬上限。
- 无应用访问日志、无第三方分析；托管平台可能仍有常规日志。
- 60 多人并发与中国大陆各网络可达性未保证，需要现场测试。

## 检查

`node --test scripts/worker.test.mjs` 使用 Node 内置 SQLite 跑迁移、真实写读、CORS、体积与字段限制、500 条上限、过期读取及限流路径。部署后需再做真实 Workers/D1 写读及手机实测。
