# Rust Wiki 阅读小助手

一个为 Rust Wiki 网站提供增强功能的用户脚本，添加返回顶部、直到底部、暗黑模式按钮和目录导航等功能，提升阅读体验。

## ✨ 功能特性

- 📍 **返回顶部/直到底部** - 快速导航到页面顶部或底部
- 🌙 **暗黑模式** - 一键切换暗黑模式，保护眼睛
- 📑 **智能目录** - 自动生成页面目录，支持拖拽调整位置
- 💾 **本地存储** - 保存用户设置（暗黑模式状态、目录位置等）
- 🎨 **响应式设计** - 适配不同屏幕尺寸

## 📦 安装

### 方法一：直接安装
1. 确保你的浏览器已安装 Tampermonkey、Violentmonkey 或其他用户脚本管理器
2. 点击 [安装链接] 即可自动安装

### 方法二：手动安装
1. 克隆或下载本项目
2. 运行 `npm install` 安装依赖
3. 运行 `npm run build` 构建脚本
4. 在用户脚本管理器中导入生成的 `dist/rustwiki-tools.user.js` 文件

## 🚀 开发

1. 克隆项目
   ```bash
   git clone <repository-url>
   cd rustwiki
   ```

2. 安装依赖
   ```bash
   pnpm install
   ```

3. 启动开发服务器
   ```bash
   pnpm run dev
   ```

4. 在浏览器中打开生成的开发 URL 进行测试

5. 构建生产版本
   ```bash
   pnpm run build
   ```

## 📁 项目结构

```
src/
├── components/         # 组件目录
│   ├── Card.js        # 可拖拽卡片组件（用于目录）
│   └── Button.js      # 工具按钮组件
├── utils/             # 工具函数目录
│   └── Storage.js     # 本地存储管理
└── main.js            # 主逻辑文件
vite.config.js         # Vite 配置文件
package.json           # 项目依赖配置
```

## 🔧 技术栈

- **前端框架**: 原生 JavaScript
- **构建工具**: Vite
- **用户脚本插件**: vite-plugin-monkey
- **存储**: localStorage

## 🎯 支持网站

- https://www.rustwiki.org.cn/zh-CN/*
- https://www.rustwiki.org.cn/en/*
- https://rustwiki.org/zh-CN/*
- https://rustwiki.org/en/*

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 👨‍💻 作者

**小明**

## 🙏 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目！

---

**享受更优质的 Rust Wiki 阅读体验！** 🎉