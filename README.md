# Cloud Blog

Cloud Blog 是一个基于 Cloudflare 的个人博客，包含公开博客与私有 CMS。

## 技术栈

- 前端：Vue 3、Vite、TypeScript、Pinia、Vue Router
- 编辑器：Tiptap
- 部署平台：Cloudflare Pages、Cloudflare Pages Functions
- 数据库：Cloudflare D1
- 对象存储：Cloudflare R2
- 鉴权：GitHub OAuth
- AI 接口：OpenAI 兼容接口

## 主要功能

- 公开博客首页、文章列表、文章详情页
- 私有 CMS 后台
- 富文本文章编辑与自动保存
- 文章版本记录与回滚
- GitHub 登录
- 评论系统
- 访问分析
- 媒体上传与对象存储管理
- 站点设置管理

## 项目结构

- `src/`：前端页面、组件、状态管理与 API 封装
- `functions/`：Cloudflare Pages Functions 接口
- `public/`：静态资源与字体文件
- `migrations/`：D1 数据库迁移
- `seed.sql`：本地或远端初始化数据
- `wrangler.toml`：Cloudflare Pages、D1、R2 绑定配置
- `.dev.vars.example`：本地开发环境变量模板

## 本地开发

```sh
cd cloud-vue-ui
```

安装依赖：

```sh
pnpm install
```

复制本地环境变量模板：

```powershell
Copy-Item .dev.vars.example .dev.vars
```

构建项目：

```sh
pnpm build
```

执行本地 D1 迁移与初始化：

```sh
pnpm d1:migrate:local
pnpm d1:seed:local
```

启动本地 Cloudflare Pages 开发环境：

```sh
pnpm cf:dev:8788
```

默认访问地址：

```text
http://127.0.0.1:8788
```

## 部署说明

项目部署目标是 Cloudflare Pages + Pages Functions。

部署前需要准备：

- Cloudflare Pages 项目
- Cloudflare D1 数据库
- Cloudflare R2 Bucket
- GitHub OAuth 应用
- 生产环境变量与密钥

部署基本流程：

1. 配置 `wrangler.toml` 中的 D1 和 R2 绑定。
2. 在 Cloudflare Pages 中配置 `DB` 与 `BUCKET` 绑定。
3. 在 Pages 中配置环境变量，例如 `GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`、`SESSION_SECRET`、`SITE_URL`、AI 相关变量等。
4. 本地执行构建。
5. 执行远端 D1 迁移。
6. 通过 Cloudflare Pages 完成部署。

常用命令：

```sh
cd cloud-vue-ui
pnpm build
pnpm d1:migrate:remote
pnpm d1:seed:remote
```