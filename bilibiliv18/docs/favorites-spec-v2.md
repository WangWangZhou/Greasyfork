# 收藏夹功能需求文档 v2

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
| 收藏数据导出 | 支持将收藏数据导出为 JSON 文件 | 中 |
| 主题切换 | 支持深色/浅色主题切换 | 低 |

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
    ↓
[可选] 导出收藏数据
```

```
在信息卡片中点击收藏按钮
    ↓
添加/移除当前视频收藏
    ↓
更新收藏状态标识
```

## 3. 界面设计规范

### 3.1 信息卡片 (CardPanel) 设计更新

#### 3.1.1 标题栏按钮布局

- **位置**：标题栏右侧 actions 区域
- **按钮顺序**（从左到右）：
  1. 收藏按钮
  2. 控制面板按钮
  3. 关闭按钮

#### 3.1.2 按钮详细说明

| 按钮 | 图标 | 功能描述 | 交互效果 |
|------|------|----------|----------|
| 收藏按钮 | ★ | 添加/移除当前视频收藏 | <ul><li>空心表示未收藏</li><li>实心表示已收藏</li><li>点击切换收藏状态</li><li>状态变化时显示 toast 提示</li></ul> |
| 控制面板按钮 | ⚙️ | 打开/关闭控制面板 | <ul><li>点击触发 `panel:toggle` 事件</li><li>悬停显示快捷键提示</li></ul> |
| 关闭按钮 | X | 关闭信息卡片 | <ul><li>点击触发 `card:toggle` 事件</li><li>隐藏信息卡片</li></ul> |

#### 3.1.3 按钮样式规范

```css
.bili-speed-card-actions button {
    background: transparent;
    color: #000;
    border: none;
    padding: 2px 6px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
}

.bili-speed-card-actions button:hover {
    background: rgba(0, 0, 0, 0.1);
}

.bili-speed-card-actions button.favorited {
    color: #FF6B81;
}
```

### 3.2 控制面板 (ControlPanel) 设计更新

#### 3.2.1 整体布局

采用**左右分栏布局**：
- **左侧**：菜单导航区域，宽度固定 120px
- **右侧**：内容区域，自适应宽度

```
┌─────────────────────────────┐
│ ⚙️ 控制面板  [×]            │
├──────────────┬──────────────┤
│ 菜单1        │  内容区域    │
│ 菜单2        │              │
│ 菜单3        │              │
└──────────────┴──────────────┘
```

#### 3.2.2 左侧菜单导航系统

| 菜单项 | 功能描述 |
|--------|----------|
| 油猴脚本系统菜单 | 包含主题切换功能 |
| B站自定义倍速油猴脚本菜单 | 包含现有倍速设置功能 |
| 收藏夹菜单 | 包含收藏管理和数据导出功能 |

**菜单样式规范**：
```css
.bili-speed-panel-menu {
    width: 120px;
    border-right: 1px solid #ddd;
    padding: 8px 0;
}

.bili-speed-panel-menu-item {
    padding: 10px 12px;
    cursor: pointer;
    font-size: 13px;
    border-left: 3px solid transparent;
    transition: all 0.2s;
}

.bili-speed-panel-menu-item:hover {
    background: #f0f0f0;
}

.bili-speed-panel-menu-item.active {
    background: #e6f7ff;
    border-left-color: #00AEEC;
    color: #00AEEC;
}
```

#### 3.2.3 菜单项详细说明

##### 3.2.3.1 油猴脚本系统菜单

| 功能项 | 描述 | 技术实现 |
|--------|------|----------|
| 主题切换 | 支持深色/浅色主题切换 | <ul><li>使用 GM_setValue 存储主题偏好</li><li>为卡片元素添加 `theme-dark`/`theme-light` 类</li><li>切换时重新渲染 UI</li></ul> |

**主题样式**：
```css
/* 浅色主题（默认） */
.bili-speed-panel {
    background: #fff;
    color: #000;
}

/* 深色主题 */
.bili-speed-panel.theme-dark {
    background: #1f1f1f;
    color: #fff;
}

.bili-speed-panel.theme-dark button {
    color: #fff;
    border-color: #444;
    background: #333;
}

.bili-speed-panel.theme-dark button:hover {
    background: #444;
}

.bili-speed-panel.theme-dark button.active {
    background: #00AEEC;
    border-color: #00AEEC;
}
```

##### 3.2.3.2 B站自定义倍速油猴脚本菜单

包含原有的所有功能：
- 步进值设置 (0.02, 0.05, 0.10)
- 初始倍速设置 (0.8x, 0.9x, 1.0x, 1.1x, 1.25x)
- 高级选项（最小倍速、最大倍速、快捷键设置）

##### 3.2.3.3 收藏夹菜单

| 功能项 | 描述 |
|--------|------|
| 收藏列表 | 显示所有收藏的视频 |
| 导出按钮 | 将收藏数据导出为 JSON 文件 |

### 3.3 收藏面板设计

- **布局**：采用与控制面板一致的卡片式布局
- **尺寸**：宽度 320px，自适应高度
- **风格**：与现有UI保持一致（白色背景、圆角、阴影）

### 3.4 收藏列表项设计

| 元素 | 设计规范 |
|------|----------|
| 缩略图 | 60x60px，圆角 4px |
| 标题 | 14px，单行截断 |
| UP主 | 12px，灰色 |
| 时长 | 12px，灰色 |
| 删除按钮 | 悬停显示，红色 |

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

### 4.3 导出数据格式

```javascript
{
    version: "1.0",
    exportedAt: 1672531200000,  // 导出时间戳
    count: 10,                   // 收藏数量
    data: [
        { id: 'BV1xx411c7mZ', bvid: 'BV1xx411c7mZ', title: '...', ... },
        // ...
    ]
}
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
| `exportData()` | 导出收藏数据 | 无 | `string` (JSON字符串) |
| `downloadExport()` | 下载导出文件 | 无 | `void` |

**数据导出实现**：
```javascript
function exportData() {
    const data = {
        version: "1.0",
        exportedAt: Date.now(),
        count: count(),
        data: getAll()
    };
    return JSON.stringify(data, null, 2);
}

function downloadExport() {
    const json = exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bili-favorites-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
```

### 5.2 视图组件 (FavoritesPanel.js)

**位置**：`src/ui/views/FavoritesPanel.js`

**功能**：
- 展示收藏列表
- 添加收藏（从当前页面）
- 删除收藏项
- 跳转到视频
- 导出收藏数据

### 5.3 视图组件 (ControlPanel.js) 更新

**新增功能**：
- 左侧菜单导航
- 主题切换
- 收藏夹菜单（包含导出功能）

**菜单切换实现**：
```javascript
let currentMenu = 'speed';  // 'system', 'speed', 'favorites'

function switchMenu(menuName) {
    currentMenu = menuName;
    // 更新菜单激活状态
    document.querySelectorAll('.bili-speed-panel-menu-item').forEach(item => {
        item.classList.toggle('active', item.dataset.menu === menuName);
    });
    // 渲染对应内容
    renderContent(menuName);
}
```

### 5.4 菜单命令注册

在 `App.js` 中添加：
```javascript
GM_registerMenuCommand('收藏面板', () => EventBus.emit('favorites:toggle'));
```

### 5.5 事件监听

| 事件名 | 触发时机 | 处理模块 |
|--------|----------|----------|
| `favorites:toggle` | 用户点击菜单 | FavoritesPanel |
| `favorites:add` | 添加收藏 | Favorites |
| `favorites:remove` | 删除收藏 | Favorites |
| `favorites:updated` | 收藏数据更新 | CardPanel, FavoritesPanel |
| `theme:toggle` | 切换主题 | ControlPanel, CardPanel, FavoritesPanel |
| `theme:changed` | 主题已切换 | 所有视图组件 |

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
