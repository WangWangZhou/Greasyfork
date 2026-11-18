# BiliBili Speed Control - 模块化重构版

B站自定义倍速油猴脚本，支持自定义播放倍速，方便学习网课。

## 功能特性

- **快捷键控制**：使用 `x`、`c`、`z` 键快速调整播放倍速
- **信息卡片**：实时显示当前倍速和剩余播放时间
- **控制面板**：可视化配置步进值、初始倍速等参数
- **记忆功能**：自动保存用户设置，重启浏览器后保持配置
- **合集支持**：自动计算B站合集视频总时长

## 快捷键

| 按键 | 功能 |
|------|------|
| `z` | 重置倍速为初始值 |
| `c` | 加速（步进值递增） |
| `x` | 减速（步进值递减） |

> ⚠️ 当焦点在输入框时，快捷键不会触发，可正常输入文字

## 项目结构

```
bilibiliv13/
├── src/
│   ├── modules/           # 模块目录
│   │   ├── EventBus.js        # 事件总线
│   │   ├── Logger.js          # 日志模块
│   │   ├── Utils.js           # 工具函数
│   │   ├── Config.js          # 配置管理
│   │   ├── PageGuard.js       # 页面守卫
│   │   ├── Draggable.js       # 拖拽行为
│   │   ├── Toast.js           # 消息提示
│   │   ├── VideoController.js # 倍速控制
│   │   ├── CardPanel.js       # 信息卡片
│   │   ├── ControlPanel.js    # 控制面板
│   │   ├── KeyboardHandler.js # 键盘处理
│   │   └── ScreenModeManager.js # 屏幕模式管理
│   ├── App.js            # 主控模块
│   └── index.js          # 入口模板
├── dist/
│   └── bbb.js            # 合并后的最终脚本
├── build.js              # 构建脚本
└── package.json         # 项目配置
```

## 构建

```bash
# 安装依赖（可选）
npm install

# 构建项目
npm run build
```

构建后的脚本位于 `dist/bbb.js`，可直接复制到 Tampermonkey 使用。

或者

采用file url
在浏览器中的油猴脚本添加require file。例如
```
// ==UserScript==
// @name         B站自定义倍速油猴脚本
// @namespace    https://docs.scriptcat.org/
// @version      0.1.0
// @description  B站自定义倍速油猴脚本
// @author       XiaoMing
// @match        https://*.bilibili.com/*
// @icon         https://www.bilibili.com/favicon.ico
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// @require      file://D:/code/bilibiliv18/bbb.js
// @noframes
// ==/UserScript==

(function() {
    'use strict';

    console.log('B站自定义倍速油猴脚本加载成功');
})();
```
Chrome 插件,右键，选择Manage extension，打开Allow access to file URLs


## 模块说明

| 模块 | 职责 |
|------|------|
| EventBus | 事件发布/订阅 |
| Logger | 调试日志输出 |
| Utils | 通用工具函数 |
| Config | GM存储的响应式配置代理 |
| PageGuard | 页面类型判断、输入框焦点检测 |
| Draggable | 元素拖拽封装 |
| Toast | 临时消息提示 |
| VideoController | 视频倍速控制核心 |
| CardPanel | 悬浮信息卡片UI |
| ControlPanel | 设置面板UI |
| KeyboardHandler | 全局快捷键注册 |
| ScreenModeManager | 宽屏/全屏模式检测 |

## 更新日志

### v3.1.2
- 新增播放器设置菜单（PlayerMenu）
  - 控制面板 → 🎬 播放器 → 倍速滚动条开关
  - 默认开启，关闭后恢复 B 站原始倍速菜单样式（6 档竖排、70px 宽、无 slider）
  - 重新开启后立即注入横排 grid + slider +/- 按钮（200px 宽）
- PlayerModifier 模块增强：支持 enable()/disable() 动态切换
  - 宽限期识别扩展：清晰度菜单「登录即享」项现在可正确放行
  - 新增 restoreOriginalMenu()：还原 DOM 到注入前状态

### v3.1
- 新增免登录守卫模块（NoLoginGuard）
  - 阻止未登录时的自动登录弹窗（60s 全屏遮罩）
  - 阻止 30 秒高清试看结束后的降画质 + 弹窗诱导
  - 阻止播放器容器内的「登录免费享高清」提示弹窗
  - 支持宽限期放行：用户主动点击登录按钮时 5 秒内放行弹窗，不影响手动登录
  - 支持配置开关：控制面板 → 免登录 → 启用免登录 / 关闭试看弹窗
- 新增播放器倍速精细调节（PlayerModifier）
  - Hook B 站播放器自带的倍速菜单，注入 range slider
  - 支持 +/- 按钮步进调节，步进值与全局 step 配置联动
  - 范围 0.5x ~ 2.0x（可配置），三种调节方式互相同步
  - 所有播放器倍速调节均为临时生效（刷新后重置为 defaultRate）
  - 菜单宽度从 70px 扩展到 200px，原 6 档改为横排 3×2 grid
- 新增面板层级切换（OtherMenu）
  - 控制面板 → 其它 → 面板层级开关
  - 开启：脚本面板显示在 B 站弹出层之上（z-index 15000）
  - 关闭：脚本面板显示在 B 站弹出层之下（z-index 500）
  - 实时切换，即时生效
- UserScript Header 新增 `@noframes`，脚本只在顶层页面运行
- 修复点击清晰度菜单「登录即享」无法弹出登录窗口的问题
- 构建脚本支持多环境（local/prod），dist/bbb.js 为合并产物

### v3.0
- 新增收藏夹系统（支持分组管理、添加/删除收藏）
- 新增笔记系统（支持 Quill 富文本和 Vditor Markdown 两种编辑器）
- 新增数据导出/导入功能（收藏分组与条目、笔记数据）
- 新增笔记筛选/搜索/标签过滤/分页功能
- 修复所有面板（信息卡片/控制面板/收藏面板/笔记面板）位置超出视口的问题
- 优化面板 z-index 层级，避免遮挡 B 站弹出菜单
- 优化文件头注释，提升代码可读性

### v2.0
- 完成模块化重构，代码结构更清晰
- 修复输入框内无法输入 `c`、`x`、`z` 的问题
- 优化事件通信机制
- 添加构建脚本，支持源码开发

### v1.x
- 初始版本，单文件实现

