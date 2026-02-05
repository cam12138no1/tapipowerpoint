# 部署检查清单

在部署到生产环境前，请确认所有项目已完成。

---

## ⚡ 紧急修复部署

如果您只需要修复 PPT 文件提取问题，按此快速清单：

### 最小部署（10 分钟）

- [x] 代码已更新（`server/ppt-engine.ts`, `server/routers.ts`）
- [ ] 运行测试: `npm test`
- [ ] 构建: `npm run build`
- [ ] 部署: 上传 `dist/` 目录
- [ ] 重启服务: `pm2 restart all` 或类似命令
- [ ] 验证: 创建测试任务，查看日志

**环境变量**: 无需更改（使用现有配置）

---

## 🔒 完整安全部署

如果您要应用所有安全修复，按此完整清单：

### 准备阶段 (30 分钟)

#### 1. 代码验证
- [x] 所有代码更新已应用
- [x] 新增库模块已创建
- [ ] 运行完整测试套件: `npm test`
- [ ] 类型检查通过: `npm run check`
- [ ] 代码格式化: `npm run format`

#### 2. 环境变量配置

**生成 JWT Secret**:
```bash
# 生成 32+ 字符的强 secret
openssl rand -base64 32

# 输出示例:
# a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2==
```

**检查清单**:
- [ ] `JWT_SECRET` 已设置
- [ ] `JWT_SECRET` 长度 ≥ 32 字符
- [ ] `DATABASE_URL` 正确
- [ ] `PPT_ENGINE_API_KEY` 有效
- [ ] AWS credentials 配置
- [ ] `S3_BUCKET` 存在
- [ ] `NODE_ENV=production` 设置

**验证命令**:
```bash
# 检查 JWT_SECRET 长度
echo -n "$JWT_SECRET" | wc -c
# 应该输出 ≥ 32

# 测试数据库连接
psql $DATABASE_URL -c "SELECT 1;"

# 测试 S3 访问
aws s3 ls s3://$S3_BUCKET/

# 测试 Manus API
curl -H "API_KEY: $PPT_ENGINE_API_KEY" \
     https://api.manus.ai/v1/tasks \
     -X GET
```

#### 3. 依赖安装

- [ ] 运行: `npm install`
- [ ] bcrypt 已安装
- [ ] 无高危漏洞: `npm audit`

```bash
# 检查 bcrypt
npm list bcrypt
# 应该显示: bcrypt@5.x.x

# 检查安全漏洞
npm audit
# 修复可修复的漏洞
npm audit fix
```

---

### 构建阶段 (10 分钟)

#### 4. 构建验证

- [ ] 清理旧构建: `rm -rf dist/`
- [ ] 运行构建: `npm run build`
- [ ] 验证构建产物: `ls -lh dist/`
- [ ] 检查构建大小（应该 <10MB）

```bash
# 构建
npm run build

# 检查产物
ls -lh dist/
# 应该包含:
# - index.js (服务器)
# - client/ (前端)
```

#### 5. 本地测试

在本地以生产模式测试：

```bash
# 设置生产环境变量
export NODE_ENV=production
export JWT_SECRET=$(openssl rand -base64 32)
export DATABASE_URL="postgresql://..."
# ... 其他变量

# 启动生产构建
npm start

# 测试健康检查
curl http://localhost:3000/health
# 预期: {"status":"healthy","timestamp":"..."}

# 测试登录
curl -X POST http://localhost:3000/api/trpc/auth.login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser"}' | jq .
# 预期: {"result":{"data":{"success":true,"token":"..."}}}

# 测试创建项目
# ... 使用 token 测试其他端点
```

---

### 部署阶段 (20 分钟)

#### 6. 数据库迁移

- [ ] 备份生产数据库
- [ ] 运行迁移（如需要）: `npm run db:push`
- [ ] 验证 schema 正确

```bash
# 备份数据库
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 运行迁移
npm run db:push

# 验证
psql $DATABASE_URL -c "\dt"
```

#### 7. 上传代码

**方式 A: Git 部署**
```bash
git add .
git commit -m "fix: 修复PPT文件提取和关键安全问题 (v1.1.0)"
git push origin master

# 在服务器上
git pull
npm install --production
npm run build
```

**方式 B: 直接上传**
```bash
# 打包
tar czf tapippt-v1.1.0.tar.gz dist/ package.json package-lock.json

# 上传到服务器
scp tapippt-v1.1.0.tar.gz user@server:/path/to/app/

# 在服务器上解压
tar xzf tapippt-v1.1.0.tar.gz
npm install --production
```

#### 8. 配置服务器

**更新环境变量**:
```bash
# 编辑环境文件
nano /path/to/app/.env

# 或使用 systemd/pm2 配置
pm2 start ecosystem.config.js --update-env
```

**检查 systemd/pm2 配置**:
```bash
# PM2
pm2 show tapippt
pm2 env 0  # 查看环境变量

# Systemd
systemctl cat tapippt
```

#### 9. 重启服务

- [ ] 停止旧服务
- [ ] 启动新服务
- [ ] 检查进程运行
- [ ] 验证端口监听

```bash
# PM2
pm2 restart tapippt
pm2 logs tapippt --lines 50

# Systemd
sudo systemctl restart tapippt
sudo journalctl -u tapippt -f

# Docker
docker-compose down
docker-compose up -d
docker-compose logs -f

# 检查进程
ps aux | grep node
netstat -tlnp | grep 3000
```

---

### 验证阶段 (15 分钟)

#### 10. 功能验证

- [ ] 健康检查: `curl https://your-domain.com/health`
- [ ] 登录功能正常
- [ ] 创建项目正常
- [ ] 文件上传正常
- [ ] PPT 生成流程正常
- [ ] 下载结果正常

```bash
# 自动化验证脚本
./scripts/verify-deployment.sh

# 或手动测试
# 1. 访问前端
open https://your-domain.com

# 2. 登录

# 3. 创建测试任务

# 4. 等待完成（查看日志）

# 5. 下载文件验证
```

#### 11. 日志监控

- [ ] 启动日志流: `tail -f logs/server.log`
- [ ] 创建测试任务
- [ ] 观察文件提取日志
- [ ] 确认无 ERROR 级别日志

**成功日志示例**:
```
[PPTEngine] Extracting files from response...
[PPTEngine] ✓ Found PPTX in output: presentation.pptx
[Task 1] ✓ SUCCESS! PPTX URL: https://...
```

**失败日志示例**:
```
[PPTEngine] ERROR: No PPTX file found
[Task 1] ⚠️ No PPTX found, retry 1/10
```

如果看到失败日志，参考 [调试指南](./HOW_TO_DEBUG_PPT_EXTRACTION.md)

#### 12. 性能监控

- [ ] 响应时间正常 (< 2s)
- [ ] CPU 使用率正常 (< 70%)
- [ ] 内存使用正常 (< 1GB)
- [ ] 数据库连接正常

```bash
# 检查资源使用
top
htop
free -h

# 检查数据库
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"
```

---

### 回滚计划 (如果出问题)

#### 快速回滚

```bash
# Git 回滚
git revert HEAD
npm run build
pm2 restart all

# 或回滚到上一个版本
git checkout v1.0.0
npm install
npm run build
pm2 restart all
```

#### 环境变量回滚

```bash
# 移除 JWT_SECRET 长度检查（临时）
# 在 server/_core/auth.ts 中注释掉长度检查

# 重启
pm2 restart all
```

---

## 📊 部署后监控

### 第一小时

- [ ] 每 5 分钟检查日志
- [ ] 监控错误率
- [ ] 验证 PPT 生成成功率 > 85%
- [ ] 检查用户反馈

### 第一天

- [ ] 每小时检查一次
- [ ] 收集性能指标
- [ ] 分析失败任务
- [ ] 优化问题区域

### 第一周

- [ ] 每天审查日志
- [ ] 统计成功率
- [ ] 收集用户反馈
- [ ] 规划下一步改进

---

## ✅ 最终确认

在标记部署为"完成"前：

- [ ] 所有测试通过
- [ ] 生产环境正常运行
- [ ] JWT Secret 验证工作
- [ ] 文件上传验证工作
- [ ] PPT 生成成功率 ≥ 85%
- [ ] 无严重错误日志
- [ ] 用户可以正常使用
- [ ] 监控告警已配置
- [ ] 团队已通知
- [ ] 文档已更新

**签署**:
- [ ] 技术负责人确认
- [ ] 运维团队确认
- [ ] 产品经理确认

---

## 🆘 紧急联系

如果遇到严重问题：

1. **立即回滚**: 使用上述回滚计划
2. **通知团队**: Slack/Email
3. **收集日志**: 保存所有错误日志
4. **创建事故报告**: 记录问题和解决方案

---

**检查清单版本**: v1.1.0  
**创建日期**: 2026-02-05  
**维护者**: DevOps Team
