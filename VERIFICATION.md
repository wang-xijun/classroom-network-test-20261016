# 检查记录（2026-10-16，北京时间）

## 现有独立测试资源

- GitHub 仓库：https://github.com/wang-xijun/classroom-network-test-20261016
- GitHub Pages：https://wang-xijun.github.io/classroom-network-test-20261016/
- Cloudflare 直达页与 API：https://classroom-network-test-20261016.classroom-network-comparison.workers.dev/
- 资源属于用户 OAuth 登录的 Cloudflare 账户。没有使用 Sites 平台账户、临时预览账户、付费升级或域名购买。
- 专用 D1：`classroom-network-test-20261016`，ID `edc37799-82b4-426e-89a9-355a9c92caa4`，区域 WNAM。
- Workers 当前部署版本：`299e4ad2-b04a-4c48-976c-d636bffb6635`，最终静态配置加载版本参数已同步发布。

## 已验证

- 官方 Wrangler 4.151.0 确认用户已 OAuth 登录；未打印或保存认证令牌到项目。
- 订阅 API 返回 403，OAuth 无账单读取权限。账户为用户本次新注册账户，沿用官方默认 Workers Free；未执行任何订阅变更，不能声称通过账单接口独立确认套餐。
- GitHub 配置为 `main` 分支 `/docs`。接入后端的提交 `2085acec868d82fd6420e76b7b1ac3b45dd11a57` 对应发布任务 https://github.com/wang-xijun/classroom-network-test-20261016/actions/runs/38851455210 成功。
- GitHub 首页 HTTP 200（约 0.84 秒）；带新查询参数的 config.js HTTP 200，并确认包含实际 Workers 地址。旧无参数配置曾返回缓存，页面已增加配置版本参数。此后本机对 GitHub 的复查也曾出现 TLS 连接失败，说明当前网络访问有波动。
- 本地 Node SQLite 的 7 项检查通过：真实迁移与分离写读、来源与预检限制、请求大小与字段限制、500 次原子写入上限、过期记录读取、限流和同源静态页。
- 本地 Workers/D1 模拟器迁移成功，实际 HTTP：首页 200、ping 200、预检 204、写入 201、独立读取 200 且 marker 匹配、不允许来源 403。
- 远程 D1 迁移成功。通过官方管理接口写入 UUID `79d662d4-d830-4e13-aa8c-331b52cba5db` 的虚拟记录，并以独立 SQL 查询读回核对。此项验证远程数据库，不代表公开 API 链路成功。
- Wrangler 确认 Worker 及静态资源发布成功，当前资源绑定为专用 D1、240 请求/60秒平台限流及静态页面。
- 原 Sites 网站未改动。

## 仍未通过或未验证

- 本机经现有代理访问公开 workers.dev 地址：TLS 握手失败；单次直连请求 12 秒超时。均未收到 HTTP 应用响应，不能据此认定后端代码失败或成功。
- 因公开域名访问失败，线上网页 → Workers → D1 完整链路及实际 CORS 预检尚未验证；配置代码与本地验证均已准备。
- 浏览器自动化读取超时，未完成桌面或手机视觉检查。
- 校园网、手机流量、多人并发需实测，不保证中国大陆所有网络可达。

## 用户实测

1. 用校园网打开 GitHub 页面，分别点后端和数据库测试，记下成功/错误与耗时。
2. 用 Cloudflare 直达页重复；如果直达页也打不开，说明需先解决 Cloudflare 入口可达性。
3. 关闭 Wi-Fi、改用手机流量，重复对比。刷新旧页面以加载新的配置。

只保存随机 UUID、虚拟 marker 和服务器时间。整个专用数据库最多成功写入 500 条；24 小时后记录无法经 API 读取，但未自动物理删除，可在测试结束后删除专用数据库。
