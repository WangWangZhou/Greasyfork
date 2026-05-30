# BiliBiliV18 组件重构与文件迁移计划

## 任务目标

对 `d:\code\javascript\greasyfork-js-2025\Greasyfork\bilibiliv18` 项目进行UI组件重构，创建可复用的基础组件，并完成文件迁移工作。

## 当前项目结构分析

```
src/
├── ui/
│   ├── components/
│   │   ├── CardPanel.js      # 信息卡片组件（包含progress功能）
│   │   ├── ControlPanel.js   # 控制面板组件
│   │   └── Toast.js          # 消息提示组件
│   ├── behaviors/
│   │   └── Draggable.js      # 拖拽行为
│   ├── styles/
│   │   └── shared.css        # 共享样式
│   └── index.js              # UI模块导出
└── modules/                   # 业务逻辑层
    ├── Config.js
    ├── EventBus.js
    ├── Utils.js
    └── ...
```

## 实施步骤

### 阶段一：创建可复用的基础组件

#### 1.1 创建 Card 组件

**文件位置**：`d:\code\javascript\greasyfork-js-2025\Greasyfork\bilibiliv18\src\ui\components\Card.js`

**组件设计**：

* 组件结构：header（可选）、body（必需）、footer（可选）

* 实现方式：使用JavaScript IIFE模式模拟slot功能

* API设计：

  ```javascript
  Card.create({
    className: 'custom-card',  // 自定义类名
    header: { visible: true, draggable: true },  // header配置
    footer: { visible: true },  // footer配置
    styles: {},  // 自定义样式
    onHeaderReady: (headerEl) => {},  // header就绪回调
    onBodyReady: (bodyEl) => {},     // body就绪回调
    onFooterReady: (footerEl) => {},  // footer就绪回调
    onReady: (cardEl) => {}          // 整个卡片就绪回调
  })
  ```

**实现要点**：

* 支持可选的header和footer区域

* 提供统一的样式基础

* 支持拖拽功能集成

* 返回组件实例供外部调用

#### 1.2 创建 Progress 组件

**文件位置**：`d:\code\javascript\greasyfork-js-2025\Greasyfork\bilibiliv18\src\ui\components\Progress.js`

**从CardPanel提取的功能**：

* `initProgressBar()` 函数逻辑

* 进度条渲染

* tooltip显示

* 拖拽跳转功能

* 鼠标悬停提示

**组件API设计**：

```javascript
Progress.create({
  container: parentElement,     // 父容器元素
  className: 'progress',       // 自定义类名前缀
  initialValue: 0,              // 初始进度值（0-100）
  showTooltip: true,            // 是否显示时间提示
  formatTime: (seconds) => {},  // 时间格式化函数
  onSeek: (time) => {},         // 跳转回调
  onProgressChange: (percent) => {}  // 进度变化回调
})

// 实例方法
progress.setProgress(percent)   // 设置进度
progress.getProgress()          // 获取当前进度
progress.destroy()              // 销毁组件
```

### 阶段二：文件迁移与目录结构调整

#### 2.1 创建 views 目录

**目录位置**：`d:\code\javascript\greasyfork-js-2025\Greasyfork\bilibiliv18\src\ui\views`

#### 2.2 迁移文件

将以下文件从 `components` 迁移到 `views` 目录：

* `src/ui/components/CardPanel.js` → `src/ui/views/CardPanel.js`

* `src/ui/components/ControlPanel.js` → `src/ui/views/ControlPanel.js`

### 阶段三：使用新组件重构视图文件

#### 3.1 重构 CardPanel.js

**文件位置**：`d:\code\javascript\greasyfork-js-2025\Greasyfork\bilibiliv18\src\ui\views\CardPanel.js`

**重构要点**：

1. 使用新创建的 `Card` 组件替换现有的HTML结构
2. 使用新创建的 `Progress` 组件替换进度条实现
3. 保持所有业务逻辑不变：

   * 倍速显示

   * 剩余时间显示

   * 合集时长显示

   * 播放/暂停按钮

   * 拖拽功能
4. 保持UI样式完全一致

#### 3.2 重构 ControlPanel.js

**文件位置**：`d:\code\javascript\greasyfork-js-2025\Greasyfork\bilibiliv18\src\ui\views\ControlPanel.js`

**重构要点**：

1. 使用新创建的 `Card` 组件作为基础结构
2. 保持所有业务逻辑不变：

   * 步进值选择

   * 初始倍速选择

   * 快捷键设置

   * 重置/保存功能

   * 高级选项（5次点击显示）
3. 保持UI样式完全一致

### 阶段四：更新构建脚本

#### 4.1 修改 build.js

**文件位置**：`d:\code\javascript\greasyfork-js-2025\Greasyfork\bilibiliv18\build.js`

**更新内容**：

* 更新模块顺序，将新创建的 `Card.js` 和 `Progress.js` 添加到加载列表

* 更新 `CardPanel.js` 和 `ControlPanel.js` 的路径指向 `views` 目录

* 确保正确的依赖顺序：

  ```
  EventBus → Logger → Utils → Config → PageGuard → Draggable →
  Toast → Card → Progress → VideoController → CardPanel → ControlPanel
  ```

### 阶段五：测试与验证

#### 5.1 构建测试

```bash
npm run build
```

#### 5.2 功能验证清单

* [ ] 信息卡片显示正确

* [ ] 控制面板显示正确

* [ ] 快捷键功能正常（x/c/z）

* [ ] 进度条拖拽跳转功能正常

* [ ] 拖拽面板位置保存功能正常

* [ ] 合集时长显示正确

* [ ] 播放/暂停功能正常

## 实施顺序

1. 创建 `Card.js` 组件（基础组件）
2. 创建 `Progress.js` 组件（依赖Card组件的数据展示）
3. 创建 `views` 目录
4. 迁移 `CardPanel.js` 到 `views` 目录
5. 迁移 `ControlPanel.js` 到 `views` 目录
6. 使用新组件重构 `CardPanel.js`
7. 使用新组件重构 `ControlPanel.js`
8. 更新 `build.js` 构建脚本
9. 执行构建并测试

## 预期产出

1. 新增组件文件：

   * `src/ui/components/Card.js`

   * `src/ui/components/Progress.js`

2. 重构后的文件：

   * `src/ui/views/CardPanel.js`（使用Card和Progress组件）

   * `src/ui/views/ControlPanel.js`（使用Card组件）

3. 更新的构建配置：

   * `build.js`（适配新的目录结构）

4. 组件文档：

   * 每个组件包含JSDoc注释说明使用方法和参数

## 注意事项

* 确保重构后功能与原实现完全一致

* 保持所有CSS样式不变

* 所有现有业务逻辑必须保留

* 构建脚本需要正确处理新的文件路径

* 组件应该保持独立可测试性

