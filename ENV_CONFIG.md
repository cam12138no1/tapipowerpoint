# TapiPowerPoint 环境变量配置指南

本文档列出了 TapiPowerPoint 项目在自托管部署时需要配置的所有环境变量。

## 必需的环境变量 (Required)

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `DATABASE_URL` | MySQL/TiDB 数据库连接字符串 | `mysql://user:password@host:3306/pptmaster` |
| `JWT_SECRET` | JWT 密钥，用于会话 Cookie 签名，建议 32 位以上随机字符串 | `your-super-secret-jwt-key-32chars` |
| `PPT_ENGINE_API_KEY` | PPT 生成引擎 API 密钥 | `sk-xxxxxxxxxxxxxxxx` |

## 可选的环境变量 (Optional)

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `PPT_ENGINE_API_URL` | PPT 生成引擎 API 地址 | `https://api.pptmaster.ai/v1` |
| `PORT` | 服务器监听端口 | `3000` |
| `NODE_ENV` | Node 运行环境 | `production` |

## 前端环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `VITE_APP_TITLE` | 应用标题 | `TapiPowerPoint` |
| `VITE_APP_LOGO` | 应用 Logo URL | `/logo.png` |

## 部署示例

### 方式一：使用 .env 文件

在项目根目录创建 `.env` 文件：

```bash
# 必需配置
DATABASE_URL=mysql://pptmaster:password@your-rds-endpoint:3306/pptmaster
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long
PPT_ENGINE_API_KEY=sk-your-api-key

# 可选配置
PORT=3000
NODE_ENV=production
PPT_ENGINE_API_URL=https://api.pptmaster.ai/v1
```

### 方式二：Docker 环境变量

```yaml
# docker-compose.yml
services:
  pptmaster:
    image: pptmaster:latest
    environment:
      - DATABASE_URL=mysql://pptmaster:password@db:3306/pptmaster
      - JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long
      - PPT_ENGINE_API_KEY=sk-your-api-key
      - PORT=3000
      - NODE_ENV=production
```

### 方式三：AWS ECS 任务定义

```json
{
  "containerDefinitions": [
    {
      "name": "pptmaster",
      "environment": [
        { "name": "DATABASE_URL", "value": "mysql://..." },
        { "name": "JWT_SECRET", "value": "..." },
        { "name": "PPT_ENGINE_API_KEY", "value": "..." },
        { "name": "PORT", "value": "3000" },
        { "name": "NODE_ENV", "value": "production" }
      ]
    }
  ]
}
```

## 数据库初始化

部署后需要执行数据库迁移：

```bash
# 安装依赖
pnpm install

# 推送数据库结构
pnpm db:push

# 构建项目
pnpm build

# 启动服务
pnpm start
```
