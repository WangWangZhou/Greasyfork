## 问题分析

根据代码和用户反馈，拖拽调整面板大小时：
- 面板整体高度变化正常（`bili-speed-vditor-panel-body` 跟随增高）
- 但 `#vditor-editor-container` 及其内部的 Vditor 编辑器高度**没有变化**
- 宽度调整正常（说明 Resizable 回调已触发，且布局宽度自适应有效）

问题出在 `VditorEditorPanel` 模块的 `adjustVditorEditorHeight` 函数未能正确更新 Vditor 实例的高度。具体原因有两点：

### 1. 获取 Vditor 根元素的方式错误
```javascript
const editorElement = vditorInstance.element;
```
Vditor 实例**没有** `element` 属性。实际可用的属性是 `vditor`（指向编辑器根容器，class="vditor"），或者直接通过 DOM 查找。由于 `editorElement` 为 `null`，函数提前返回，后续所有高度设置代码都不执行。

### 2. 高度计算公式可能不准确
`calculateVditorHeight` 硬编码了多个固定值（headerHeight:50, bodyPadding:24, titleInputHeight:40 …）。实际面板 DOM 结构可能因主题、按钮显示状态发生变化，导致计算出的可用高度与实际剩余空间不符，也会使 Vditor 高度无法增加。

---

## 解决方案

修改 `VditorEditorPanel` 模块中的 `adjustVditorEditorHeight` 函数：

1. **正确获取 Vditor 根容器**  
   使用 `vditorInstance.vditor` 或直接通过 `#vditor-editor-container .vditor` 选择器定位。

2. **改用相对高度 + Flex 自动填充**  
   不再手动计算固定高度，而是利用 CSS Flex 布局让 Vditor 容器自动占满剩余空间，并设置内部编辑器高度为 `100%`。

3. **重设 Vditor 内部布局**  
   在面板大小改变时，重新设置 `.vditor` 及其内部 `.vditor-content` 的高度为父容器的 `100%`。

---

## 修改后的代码（替换原 `adjustVditorEditorHeight` 及相关部分）

### 1. 修改 `initVditorEditor` 初始化逻辑（可选优化）
在初始化 Vditor 时，**不传递固定 height**，而是通过 CSS 让编辑器自适应。

```javascript
// 原 initVditorEditor 中：
vditorInstance = new Vditor('vditor-editor-container', {
    // 移除 height 选项，或设置为 '100%'
    height: '100%',   // 尝试让 Vditor 使用百分比高度
    mode: 'ir',
    // ... 其他配置
});
```

但由于 Vditor 对百分比高度支持不稳定，更可靠的方式是在初始化后通过 CSS 强制覆盖，并在每次 resize 时重新设置。

### 2. 重写 `adjustVditorEditorHeight` 函数
```javascript
function adjustVditorEditorHeight() {
    if (!vditorInstance) return;

    // 方法1：直接通过 DOM 查找 Vditor 根容器
    const vditorRoot = document.querySelector('#vditor-editor-container .vditor');
    if (!vditorRoot) return;

    // 获取父容器（#vditor-editor-container）的高度
    const container = document.getElementById('vditor-editor-container');
    if (!container) return;

    // 获取 Vditor 内部各区域的高度（toolbar 固定高度）
    const toolbar = vditorRoot.querySelector('.vditor-toolbar');
    const toolbarHeight = toolbar ? toolbar.offsetHeight : 40;

    // 设置 .vditor 的高度为父容器高度
    vditorRoot.style.height = container.clientHeight + 'px';

    // 计算内容区域可用高度 = 父容器高度 - toolbar 高度
    const contentHeight = container.clientHeight - toolbarHeight;

    // 更新 .vditor-content 区域的高度
    const vditorContent = vditorRoot.querySelector('.vditor-content');
    if (vditorContent) {
        vditorContent.style.height = contentHeight + 'px';
    }

    // 分别更新不同编辑模式下的内容区域（IR 模式 / SV 模式 / 预览模式）
    const irWrapper = vditorRoot.querySelector('.vditor-ir');
    if (irWrapper) irWrapper.style.height = contentHeight + 'px';
    const svWrapper = vditorRoot.querySelector('.vditor-sv');
    if (svWrapper) svWrapper.style.height = contentHeight + 'px';
    const preview = vditorRoot.querySelector('.vditor-preview');
    if (preview) preview.style.height = contentHeight + 'px';

    // 确保内部文本编辑区也填满
    const resetPre = vditorRoot.querySelector('.vditor-reset');
    if (resetPre) resetPre.style.height = contentHeight + 'px';
}
```

**注意**：此函数不再需要 `panelHeight` 参数，直接根据父容器 `#vditor-editor-container` 的当前高度来设置，更加可靠。

### 3. 修改 `Resizable` 回调中的调用
原代码：
```javascript
onResize: (newWidth, newHeight) => {
    if (vditorInstance) {
        adjustVditorEditorHeight(newHeight);
    }
}
```
改为：
```javascript
onResize: (newWidth, newHeight) => {
    if (vditorInstance) {
        // 只需要调用无参版本，它会自动读取容器高度
        adjustVditorEditorHeight();
    }
}
```

### 4. 保证 `#vditor-editor-container` 本身能自动撑满父容器
在 `createPanel` 的 `onBodyReady` 中，确保 `#vditor-editor-container` 的 CSS 设置：
```javascript
bodyEl.innerHTML = `...`; // 原有 HTML

// 添加样式规则
const editorContainer = document.getElementById('vditor-editor-container');
if (editorContainer) {
    editorContainer.style.flex = '1';
    editorContainer.style.minHeight = '0';
    editorContainer.style.height = 'auto';  // 让 flex 控制高度
}
```

同时，为 `.vditor` 添加基础样式：
```javascript
const style = document.createElement('style');
style.textContent = `
    #vditor-editor-container {
        display: flex;
        flex-direction: column;
    }
    #vditor-editor-container .vditor {
        height: 100% !important;
        display: flex;
        flex-direction: column;
    }
    #vditor-editor-container .vditor-content {
        flex: 1;
        min-height: 0;
    }
`;
document.head.appendChild(style);
```

---

## 完整修改建议（补丁形式）

将 `VditorEditorPanel` 模块中的以下函数替换为：

```javascript
function adjustVditorEditorHeight() {
    if (!vditorInstance) return;
    const container = document.getElementById('vditor-editor-container');
    if (!container) return;
    const vditorRoot = container.querySelector('.vditor');
    if (!vditorRoot) return;

    const containerHeight = container.clientHeight;
    if (containerHeight <= 0) return;

    const toolbar = vditorRoot.querySelector('.vditor-toolbar');
    const toolbarHeight = toolbar ? toolbar.offsetHeight : 40;
    const contentHeight = Math.max(50, containerHeight - toolbarHeight);

    vditorRoot.style.height = containerHeight + 'px';

    const vditorContent = vditorRoot.querySelector('.vditor-content');
    if (vditorContent) vditorContent.style.height = contentHeight + 'px';

    // 各模式编辑区
    const ir = vditorRoot.querySelector('.vditor-ir');
    if (ir) ir.style.height = contentHeight + 'px';
    const sv = vditorRoot.querySelector('.vditor-sv');
    if (sv) sv.style.height = contentHeight + 'px';
    const preview = vditorRoot.querySelector('.vditor-preview');
    if (preview) preview.style.height = contentHeight + 'px';

    const reset = vditorRoot.querySelector('.vditor-reset');
    if (reset) reset.style.height = contentHeight + 'px';
}
```

并在 `initVditorEditor` 末尾增加一次调用，以及在面板首次显示后调用一次（例如在 `open` 方法的 `setTimeout` 中）。

这样即可解决 Vditor 编辑器高度不随面板拖拽变化的问题。宽度之所以正常，是因为 Vditor 默认 `width:100%` 且父容器宽度变化时自动重排，而高度需要手动维护。