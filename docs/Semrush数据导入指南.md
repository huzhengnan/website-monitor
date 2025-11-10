# Semrush 数据导入指南 📊

## 概述

这个功能允许你从 Semrush 复制粘贴域名分析数据，快速批量导入或更新外链库中的网站数据。

## 支持的数据字段

| 字段 | 含义 | 数据示例 | 映射到 |
|------|------|---------|--------|
| **Domain** | 域名 | producthunt.com | domain |
| **Authority Score** | 权威分数（替代 DR） | 49 | authorityScore |
| **Organic traffic** | 有机流量 | 256.5K | organicTraffic |
| **Organic keywords** | 有机关键词数 | 266.6K | organicKeywords |
| **Paid traffic** | 付费流量 | 0 | paidTraffic |
| **Backlinks** | 外链总数 | 69.5M | backlinks |
| **Ref.Domains** | 引用域名数 | 180K | refDomains |
| **AI Visibility** | AI 能见度 | 44 | aiVisibility |
| **AI Mentions** | AI 提及数 | 2.4K | aiMentions |
| **+/-** | 流量变化 | +1.7% | trafficChange |
| **+/-** | 关键词变化 | -5.7% | keywordsChange |

## 使用步骤

### 第 1 步：在 Semrush 获取数据

1. 登录 Semrush
2. 进入目标域名的 **Overview（概览）** 页面
3. 在页面上找到以下信息块：
   - Domain overview section
   - SEO metrics section
   - Traffic metrics section

### 第 2 步：复制数据

在 Semrush 中，使用以下两种方式获取数据：

**方法 A：手动选择复制**
1. 选择需要的数据行（包含字段名和数值）
2. 使用 Cmd+C (Mac) 或 Ctrl+C (Windows) 复制

**方法 B：截图后粘贴**
1. 截图包含数据的区域
2. 粘贴到文本编辑器提取文本

### 第 3 步：打开导入界面

1. 进入外链库页面
2. 点击工具栏中的 **"📊 Semrush 数据"** 按钮
3. 会打开一个导入对话框

### 第 4 步：粘贴数据

将从 Semrush 复制的数据粘贴到文本框中。

**示例格式（支持多个域名）：**

```
producthunt.com
Authority Score
49
Organic traffic
256.5K
Paid traffic
0
Ref.Domains
180K
Backlinks
69.5M
AI Visibility
44
AI Mentions
2.4K
Organic keywords
266.6K

figma.com
Authority Score
95
Organic traffic
5.2M
Paid traffic
10K
Ref.Domains
2.5M
Backlinks
120M
```

### 第 5 步：导入

1. 点击 **"导入数据"** 按钮
2. 系统会：
   - ✅ 解析粘贴的文本
   - ✅ 识别域名和各个指标
   - ✅ 自动匹配现有外链记录
   - ✅ 创建新记录或更新现有记录
3. 显示导入结果摘要

## 导入结果说明

导入完成后，你会看到以下信息：

```
✅ Semrush 数据导入成功

总计：5 个域名
✅ 新建：3 个
🔄 更新：2 个
❌ 失败：0 个
```

- **新建**：系统创建了新的外链站点记录
- **更新**：系统更新了现有外链站点的 Semrush 数据
- **失败**：由于数据无效或其他错误无法处理的记录

## 数据映射规则

### 数字格式转换

系统会自动识别并转换以下格式：

| 输入格式 | 转换为 | 说明 |
|---------|--------|------|
| 256.5K | 256500 | K 表示千 |
| 69.5M | 69500000 | M 表示百万 |
| 2.5M | 2500000 | 大数字也支持 |
| 256500 | 256500 | 直接数字 |
| 256,500 | 256500 | 逗号分隔符 |

### 百分比转换

| 输入格式 | 转换为 | 说明 |
|---------|--------|------|
| +1.7% | 1.7 | 正增长 |
| -5.7% | -5.7 | 负增长 |
| 1.7 | 1.7 | 纯数字（自动当作百分比） |

## 功能特性

✨ **智能解析**
- 自动识别各种数据格式
- 支持不完整数据（缺少某些字段不影响导入）
- 忽略多余的空白和分隔符

🔄 **智能更新**
- 如果域名已存在，会更新其 Semrush 数据
- 如果域名不存在，会创建新的外链站点记录
- 自动生成备注（包含关键指标摘要）

🛡️ **数据验证**
- 验证 Authority Score 范围 (0-100)
- 验证数值有效性
- 如果数据无效，会在错误日志中显示原因

📊 **前端展示**

导入后，你可以在外链库列表中看到新的数据列：

| 列名 | 说明 | 颜色 |
|------|------|------|
| Authority | Semrush 权威分数 | 🔵 Cyan |
| 有机流量 | Organic traffic | - |
| 引用域名 | Ref.Domains | 🟠 Orange |
| 外链数 | Backlinks | 🟣 Purple |

## 常见问题

### Q1：能导入多个域名吗？

是的！一次可以导入多个域名。只需要在粘贴的文本中包含多个域名的数据。每个域名会被识别和处理。

### Q2：如果数据格式不完全一样怎么办？

系统有较强的容错能力，支持以下变体：
- 字段名大小写不同（AUTHORITY SCORE vs Authority Score）
- 字段值前后有空格
- 缺少某些字段（会默认为空）
- 不同的单位格式（K、M、B）

### Q3：导入失败的原因有哪些？

常见原因：
- ❌ 无法识别域名
- ❌ Authority Score 不在 0-100 范围内
- ❌ 数值无法解析（格式错误）
- ❌ 其他数据库错误

### Q4：能修改已导入的数据吗？

是的！导入后，你可以：
1. 在表格中找到该条记录
2. 点击 **"编辑"** 按钮
3. 修改 URL、备注等信息
4. 再次导入 Semrush 数据会自动更新所有指标

### Q5：导入的数据会覆盖现有的备注吗？

不会。系统只在备注为空时才自动生成备注。如果已有备注，会保留原有内容。

## 后续步骤

### 查看导入的数据

1. 进入外链库列表
2. 新的列会显示：
   - **Authority**：权威分数
   - **有机流量**：显示为 K 或 M 单位
   - **引用域名**：显示为 K 或 M 单位（橙色）
   - **外链数**：显示为 K、M 或 B 单位（紫色）

### 按 Semrush 数据排序

点击列头可以对 Authority、有机流量等数据排序，快速找到最有价值的外链机会。

### 生成自动备注

系统会根据 Semrush 数据自动生成备注，格式如下：

```
Authority: 49 | Traffic: 256K | RefDomains: 180K | Backlinks: 69M
```

## 数据库更新说明

本功能需要数据库迁移。迁移内容：

```sql
ALTER TABLE backlink_sites
ADD COLUMN authority_score INTEGER,
ADD COLUMN organic_traffic DECIMAL(15, 2),
ADD COLUMN organic_keywords INTEGER,
ADD COLUMN paid_traffic DECIMAL(15, 2),
ADD COLUMN backlinks BIGINT,
ADD COLUMN ref_domains INTEGER,
ADD COLUMN ai_visibility INTEGER,
ADD COLUMN ai_mentions INTEGER,
ADD COLUMN traffic_change DECIMAL(6, 2),
ADD COLUMN keywords_change DECIMAL(6, 2),
ADD COLUMN semrush_last_sync TIMESTAMP,
ADD COLUMN semrush_data_json JSONB;
```

执行迁移后，新字段会自动生效。

## 技术细节

### 解析算法

系统使用以下步骤解析文本：

1. **分块识别**：按域名分割数据块
2. **字段提取**：在每个数据块中查找关键字
3. **值解析**：提取并转换数值（处理 K、M、B 单位）
4. **验证**：检查数据有效性
5. **存储**：保存到数据库

### 重复检测

如果导入的域名已存在：
- 系统会自动更新现有记录的 Semrush 数据
- 不会创建重复记录
- 会在导入结果中显示 "已更新" 数量

### API 端点

- **POST** `/api/backlink-sites/semrush-import`
- **参数**：`{ pastedText: string }`
- **返回**：导入结果和错误详情

## 故障排除

### 导入后看不到数据

1. 检查网络连接
2. 刷新页面
3. 检查浏览器控制台是否有错误消息
4. 查看导入结果中是否有失败记录

### 某些数字显示不正确

数字显示格式在前端进行了缩写处理：
- 100K+ 显示为 X.XK
- 100M+ 显示为 X.XM
- 100B+ 显示为 X.XB

原始值仍完整保存在数据库中。

### Authority Score 未显示

- 检查是否正确复制了 Authority Score 数据
- 确保分数在 0-100 范围内
- 如果导入失败，查看错误日志

## 最佳实践

1. **定期更新**：定期从 Semrush 导入最新数据，保持数据新鲜
2. **验证数据**：导入前检查粘贴的数据格式是否正确
3. **备份**：导入前可以导出 CSV 作为备份
4. **批量处理**：一次性导入多个域名以提高效率

---

有任何问题，请查看错误日志或联系管理员。
