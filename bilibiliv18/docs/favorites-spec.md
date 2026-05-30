# 收藏夹功能需求文档

## 1. 功能概述

为 bilibiliv18 油猴脚本添加收藏夹功能，允许用户收藏B站视频，方便后续快速访问。

## 2. 功能需求

### 2.1 核心功能

| 功能点 | 描述 | 优先级 |
|--------|------|--------|
| 添加收藏 | 用户可将当前视频添加到收藏夹 | 高 |
| 删除收藏 | 用户可从收藏夹中删除视频 | 高 |
| 查看收藏列表 | 展示所有收藏的视频 | 高 |
| 跳转到视频 | 点击收藏项可跳转至对应视频 | 高 |
| 收藏状态标识 | 在信息卡片中显示当前视频的收藏状态 | 中 |

### 2.2 用户流程

```
用户点击菜单 "收藏面板"
    ↓
打开收藏夹面板
    ↓
查看收藏列表
    ↓
[可选] 点击收藏项跳转视频
    ↓
[可选] 删除收藏项
```

```
在信息卡片中点击收藏按钮
    ↓
添加/移除当前视频收藏
    ↓
更新收藏状态标识
```

## 3. 界面设计规范

### 3.1 收藏面板设计

- **布局**：采用与控制面板一致的卡片式布局
- **尺寸**：宽度 320px，自适应高度
- **风格**：与现有UI保持一致（白色背景、圆角、阴影）

### 3.2 收藏列表项设计

| 元素 | 设计规范 |
|------|----------|
| 缩略图 | 60x60px，圆角 4px |
| 标题 | 14px，单行截断 |
| UP主 | 12px，灰色 |
| 时长 | 12px，灰色 |
| 删除按钮 | 悬停显示，红色 |

### 3.3 信息卡片收藏按钮

- **位置**：header actions 区域
- **图标**：★（实心表示已收藏，空心表示未收藏）
- **样式**：与关闭按钮一致

## 4. 数据结构定义

### 4.1 收藏项数据结构

```javascript
{
    id: string,           // 视频AV号或BV号
    bvid: string,         // BV号
    title: string,        // 视频标题
    author: string,       // UP主名称
    duration: number,     // 视频时长（秒）
    cover: string,        // 封面URL
    url: string,          // 视频完整URL
    addedAt: number       // 添加时间戳
}
```

### 4.2 存储格式

```javascript
// GM_setValue('favorites', [...])
[
    { id: 'BV1xx411c7mZ', bvid: 'BV1xx411c7mZ', title: '...', ... },
    // ...
]
```

## 5. 技术实现要点

### 5.1 存储模块 (Favorites.js)

**位置**：`src/modules/Favorites.js`

**API设计**：

| 方法 | 功能 | 参数 | 返回值 |
|------|------|------|--------|
| `add(item)` | 添加收藏 | `item`: 收藏项对象 | `boolean` |
| `remove(id)` | 删除收藏 | `id`: 视频ID | `boolean` |
| `get(id)` | 获取单个收藏 | `id`: 视频ID | `object/null` |
| `getAll()` | 获取所有收藏 | 无 | `array` |
| `has(id)` | 判断是否已收藏 | `id`: 视频ID | `boolean` |
| `clear()` | 清空所有收藏 | 无 | `void` |
| `count()` | 获取收藏数量 | 无 | `number` |

### 5.2 视图组件 (FavoritesPanel.js)

**位置**：`src/ui/views/FavoritesPanel.js`

**功能**：
- 展示收藏列表
- 添加收藏（从当前页面）
- 删除收藏项
- 跳转到视频

### 5.3 菜单命令注册

在 `App.js` 中添加：
```javascript
GM_registerMenuCommand('收藏面板', () => EventBus.emit('favorites:toggle'));
```

### 5.4 事件监听

| 事件名 | 触发时机 | 处理模块 |
|--------|----------|----------|
| `favorites:toggle` | 用户点击菜单 | FavoritesPanel |
| `favorites:add` | 添加收藏 | Favorites |
| `favorites:remove` | 删除收藏 | Favorites |
| `favorites:updated` | 收藏数据更新 | CardPanel |

## 6. 代码规范

### 6.1 命名规范

- 文件命名：使用 PascalCase（如 `FavoritesPanel.js`）
- 类/模块命名：使用 PascalCase
- 变量/函数命名：使用 camelCase
- CSS类名：使用 kebab-case（如 `bili-speed-favorites`）

### 6.2 架构规范

- 遵循现有模块模式（IIFE闭包）
- 使用 GM_* API 进行持久化
- 通过 EventBus 进行模块间通信
- 视图层使用 Card 组件构建界面

## 7. 兼容性要求

- 支持 Chrome/Firefox 最新版本
- 兼容 Tampermonkey/Greasemonkey
- 支持 B站新旧页面结构

## 8. 安全性考虑

- 验证用户输入数据格式
- 防止 XSS 攻击（对标题等字段进行转义）
- 限制收藏数量（建议上限 1000 条）
