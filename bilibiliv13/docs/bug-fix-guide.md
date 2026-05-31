# B站自定义倍速脚本 Bug 修复方案

> 本文档详细说明项目中发现的 8 个潜在 Bug 的修复方案。

---

## Bug 1: CardPanel.js - 进度条事件监听器未清理

### 问题描述

`initProgressBar` 函数添加了多个事件监听器，但只有部分被添加到 `cleanupFns` 中进行清理。当用户多次切换页面或重新初始化卡片面板时，会导致内存泄漏和事件重复绑定。

**泄漏的事件监听器**：
- `mouseenter`
- `mouseleave`
- `click`
- `mousedown`

**已清理的监听器**：
- `mousemove` ✓
- `mouseup` ✓

### 修复方案

在 `initProgressBar` 函数中，将所有事件监听器都添加到 `cleanupFns` 中统一管理。

**修改文件**: `src/modules/CardPanel.js`

**修改位置**: `initProgressBar` 函数，约第 47-90 行

```javascript
function initProgressBar(progressWrapper, progressBar, tooltip) {
    const video = VideoController.getVideo();
    let isDraggingProgress = false;

    // ... 其余代码保持不变 ...

    const onMouseEnter = (e) => updateTooltip(e.clientX);
    const onMouseMove = (e) => { if (!isDraggingProgress) updateTooltip(e.clientX); };
    const onMouseLeave = () => { if (!isDraggingProgress) tooltip.style.display = 'none'; };

    const onClick = (e) => {
        if (!video || !video.duration) return;
        video.currentTime = getTimeFromPosition(e.clientX);
    };

    const onDragStart = (e) => {
        if (!video || !video.duration) return;
        isDraggingProgress = true;
        e.preventDefault();
    };

    const onDragMove = (e) => {
        if (!isDraggingProgress) return;
        updateTooltip(e.clientX);
        const time = getTimeFromPosition(e.clientX);
        seekVideo(time);
        progressBar.style.width = `${(time / video.duration) * 100}%`;
    };

    const onDragEnd = () => {
        if (isDraggingProgress) {
            isDraggingProgress = false;
            tooltip.style.display = 'none';
        }
    };

    // 添加事件监听
    progressWrapper.addEventListener('mouseenter', onMouseEnter);
    progressWrapper.addEventListener('mousemove', onMouseMove);
    progressWrapper.addEventListener('mouseleave', onMouseLeave);
    progressWrapper.addEventListener('click', onClick);
    progressWrapper.addEventListener('mousedown', onDragStart);
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);

    // 【修复】统一清理所有事件监听器
    const cleanupDrag = () => {
        progressWrapper.removeEventListener('mouseenter', onMouseEnter);
        progressWrapper.removeEventListener('mousemove', onMouseMove);
        progressWrapper.removeEventListener('mouseleave', onMouseLeave);
        progressWrapper.removeEventListener('click', onClick);
        progressWrapper.removeEventListener('mousedown', onDragStart);
        document.removeEventListener('mousemove', onDragMove);
        document.removeEventListener('mouseup', onDragEnd);
    };
    cleanupFns.add(cleanupDrag);
}
```

---

## Bug 2: Config.js - Proxy 边界检查缺失

### 问题描述

`Config` 模块使用 Proxy 访问配置值，但 `get` trap 中直接返回 `GM_getValue` 的结果。当 `GM_getValue` 返回 `undefined`（key 从未设置过）时，即使 `DEFAULTS` 中有对应值，也会返回 `undefined` 而非默认值。

### 修复方案

修改 Proxy 的 `get` trap，确保访问不存在的 key 时返回 `DEFAULTS` 中的默认值。

**修改文件**: `src/modules/Config.js`

**修改位置**: Proxy 定义，约第 15-23 行

```javascript
// 修改前
const proxy = new Proxy({}, {
    get(_, key) {
        return GM_getValue(key, DEFAULTS[key]);
    },
    set(_, key, value) {
        GM_setValue(key, value);
        return true;
    }
});

// 修改后
const proxy = new Proxy({}, {
    get(_, key) {
        if (!(key in DEFAULTS)) {
            Logger.warn(`配置项 "${key}" 不存在`);
            return undefined;
        }
        const value = GM_getValue(key);
        // 如果 GM_getValue 返回 undefined，使用默认值
        return value !== undefined ? value : DEFAULTS[key];
    },
    set(_, key, value) {
        if (!(key in DEFAULTS)) {
            Logger.warn(`无法设置不存在的配置项 "${key}"`);
            return false;
        }
        GM_setValue(key, value);
        return true;
    }
});
```

**同时添加 Logger.warn 方法**（如果 Logger 模块尚未支持）：

**修改文件**: `src/modules/Logger.js`

```javascript
warn(msg) {
    if (DEBUG) console.warn(`${PREFIX} ${msg}`);
}
```

---

## Bug 3: VideoController.js - throttle 使用错误

### 问题描述

`throttledSetRate` 的定义完全错误：

```javascript
const throttledSetRate = Utils.throttle(fn => fn(), 100);
```

这个 throttle 包装了一个立即执行的空函数 `fn => fn()`，完全没有节流效果。每次调用 `throttledSetRate(() => this.setRate(...))` 都会立即执行传入的函数。

### 修复方案

修改 `throttledSetRate` 的定义和使用方式：

**修改文件**: `src/modules/VideoController.js`

**修改位置**: 第 7 行，以及 `adjustRate` 和 `resetRate` 方法

```javascript
// 修改前
const throttledSetRate = Utils.throttle(fn => fn(), 100);

// 修改后
const throttledSetRate = Utils.throttle((rate) => {
    this.setRate(rate);
}, 100);

// adjustRate 方法修改
adjustRate(delta) {
    if (!video || Config.data.panelVisible || PageGuard.isInputFocused()) return;
    throttledSetRate(video.playbackRate + delta);
},

// resetRate 方法修改
resetRate() {
    if (!video || Config.data.panelVisible || PageGuard.isInputFocused()) return;
    throttledSetRate(Config.data.defaultRate);
},
```

---

## Bug 4: ControlPanel.js - 重置值与 DEFAULTS 不一致

### 问题描述

控制面板的重置按钮使用硬编码值，其中 `maxRate: 4.0` 与 `Config.DEFAULTS.maxRate: 2.0` 不一致。

### 修复方案

使用 `Config.DEFAULTS` 中的值代替硬编码：

**修改文件**: `src/modules/ControlPanel.js`

**修改位置**: `#reset-btn` 点击事件处理，约第 214 行

```javascript
// 修改前
panelEl.querySelector('#reset-btn').addEventListener('click', () => {
    Config.data.step = 0.05;
    Config.data.minRate = 0.5;
    Config.data.maxRate = 4.0;  // ⚠️ 硬编码，与 DEFAULTS 不一致
    Config.data.defaultRate = 1.0;
    Config.data.keyReset = 'z';
    Config.data.keyUp = 'x';
    Config.data.keyDown = 'c';
    panelEl.querySelector('#key-reset').value = 'Z';
    panelEl.querySelector('#key-up').value = 'X';
    panelEl.querySelector('#key-down').value = 'C';
    updateButtonState();
    EventBus.emit('config:reset');
});

// 修改后
panelEl.querySelector('#reset-btn').addEventListener('click', () => {
    Config.batchUpdate({
        step: Config.DEFAULTS.step,
        minRate: Config.DEFAULTS.minRate,
        maxRate: Config.DEFAULTS.maxRate,
        defaultRate: Config.DEFAULTS.defaultRate,
        keyReset: Config.DEFAULTS.keyReset,
        keyUp: Config.DEFAULTS.keyUp,
        keyDown: Config.DEFAULTS.keyDown
    });
    panelEl.querySelector('#key-reset').value = Config.DEFAULTS.keyReset.toUpperCase();
    panelEl.querySelector('#key-up').value = Config.DEFAULTS.keyUp.toUpperCase();
    panelEl.querySelector('#key-down').value = Config.DEFAULTS.keyDown.toUpperCase();
    updateButtonState();
    EventBus.emit('config:reset');
});
```

---

## Bug 5: ScreenModeManager.js - setupMutationObserver 从未被调用

### 问题描述

`setupMutationObserver()` 方法定义了但从未被调用。目前使用 `click` 事件和定时轮询来检测屏幕模式变化，但 MutationObserver 代码是死代码。

### 修复方案

移除未使用的 `setupMutationObserver` 方法，并清理相关代码：

**修改文件**: `src/modules/ScreenModeManager.js`

**完整重构后的代码**：

```javascript
/**
 * ScreenModeManager - 屏幕模式管理模块
 */
const ScreenModeManager = (() => {
    let clickHandler = null;

    function updateByScreenMode(screenMode) {
        if (screenMode === 'wide' || screenMode === 'web') {
            CardPanel.hide();
        } else {
            CardPanel.show();
        }
    }

    return {
        init() {
            // 点击宽屏/网页全屏按钮时隐藏卡片
            clickHandler = (e) => {
                const target = e.target;
                const wideBtn = target.closest('.bpx-player-ctrl-wide');
                const webBtn = target.closest('.bpx-player-ctrl-web');

                if (wideBtn || webBtn) {
                    Logger.info('点击了宽屏/网页全屏按钮');
                    CardPanel.hide();
                }
            };
            document.addEventListener('click', clickHandler, true);

            // 定时检测屏幕模式变化（SPA 页面可能不触发 mutation）
            let lastScreenMode = '';
            const checkInterval = setInterval(() => {
                const playerContainer = document.querySelector('.bpx-player-container');
                if (!playerContainer) return;

                const screenMode = playerContainer.getAttribute('data-screen') || '';
                if (screenMode !== lastScreenMode) {
                    lastScreenMode = screenMode;
                    Logger.info(`播放器模式变化: ${screenMode}`);
                    updateByScreenMode(screenMode);
                }
            }, 500);

            // 返回清理函数
            return () => {
                if (clickHandler) {
                    document.removeEventListener('click', clickHandler, true);
                    clickHandler = null;
                }
                if (checkInterval) {
                    clearInterval(checkInterval);
                }
            };
        },

        destroy() {
            // 清理逻辑由 init 返回的函数处理
            if (clickHandler) {
                document.removeEventListener('click', clickHandler, true);
                clickHandler = null;
            }
        }
    };
})();
```

**注意**: 如果需要使用 MutationObserver，可以按以下方式在 `init()` 中启用：

```javascript
init() {
    // ... clickHandler 代码 ...

    // 可选：使用 MutationObserver（部分浏览器可能不支持）
    const playerContainer = document.querySelector('.bpx-player-container');
    if (playerContainer) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'data-screen') {
                    const screenMode = playerContainer.getAttribute('data-screen');
                    Logger.info(`播放器模式变化(MutationObserver): ${screenMode}`);
                    updateByScreenMode(screenMode);
                }
            });
        });
        observer.observe(playerContainer, {
            attributes: true,
            attributeFilter: ['data-screen']
        });
    }

    // ...
}
```

---

## Bug 7: Draggable.js - cleanupFns 模块级共享

### 问题描述

`cleanupFns` 是模块级变量，所有 `make()` 调用共享同一个 Set。当多个组件（如 CardPanel 和 ControlPanel）同时存在时，调用一个组件的清理函数可能影响另一个组件。

### 修复方案

将 `cleanupFns` 从模块级变量改为由 `make()` 返回的实例级变量：

**修改文件**: `src/modules/Draggable.js`

**完整重构后的代码**：

```javascript
/**
 * Draggable - 拖拽行为模块
 */
const Draggable = (() => {
    return {
        make(el, saveKey, headerSelector) {
            let isDragging = false;
            let startX, startY, startLeft, startTop;
            const cleanupFns = new Set();

            const header = headerSelector ? el.querySelector(headerSelector) : el;
            if (!header) return () => {};

            const onMouseDown = (e) => {
                if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.classList.contains('bili-speed-drag-text')) return;
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                const rect = el.getBoundingClientRect();
                startLeft = rect.left;
                startTop = rect.top;
                el.style.cursor = 'grabbing';
                e.preventDefault();
            };

            const onMouseMove = (e) => {
                if (!isDragging) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                const newLeft = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, startLeft + dx));
                const newTop = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, startTop + dy));
                el.style.left = newLeft + 'px';
                el.style.top = newTop + 'px';
                el.style.right = 'auto';
                el.style.bottom = 'auto';
            };

            const onMouseUp = () => {
                if (isDragging) {
                    isDragging = false;
                    el.style.cursor = '';
                    Config.data[saveKey] = { left: el.style.left, top: el.style.top };
                }
            };

            header.addEventListener('mousedown', onMouseDown);
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);

            const cleanup = () => {
                header.removeEventListener('mousedown', onMouseDown);
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                cleanupFns.clear();
            };

            cleanupFns.add(cleanup);
            return cleanup;
        },

        // 保留此方法以备兼容，但不再被组件使用
        cleanupAll() {
            // 此方法现在无意义，因为每个 make() 实例有独立的 cleanupFns
            Logger.warn('Draggable.cleanupAll() 已弃用');
        }
    };
})();
```

---

## Bug 9: ControlPanel.js - 多击事件重复绑定

### 问题描述

`Utils.multiClick` 在 `create()` 方法中被调用，而 `create()` 可能在不调用 `destroy()` 的情况下被重复调用（通过 `ControlPanel.toggle` 实际只切换显示/隐藏，不会重新创建）。但如果 `App.init()` 被多次调用（URL 变化时），会导致事件监听器累积。

### 修复方案

在 `create()` 开始时先移除已有的事件监听器，或使用 `EventBus.once` 模式确保只绑定一次：

**修改文件**: `src/modules/ControlPanel.js`

**修改位置**: `create()` 方法开始处

```javascript
create() {
    // 【修复】如果已存在 panelEl，先移除旧的事件监听
    if (panelEl) {
        panelEl.remove();
        panelEl = null;
    }

    // ... 其余代码保持不变 ...
}
```

**或更好的方案**：重构 `multiClick` 使用 `once` 模式：

**修改文件**: `src/modules/Utils.js`

```javascript
// 修改 multiClick 函数，添加 cleanup 功能
multiClick(element, times, callback, timeout = 800) {
    let clickCount = 0;
    let clickTimer = null;

    const handler = () => {
        clickCount++;
        if (clickTimer) clearTimeout(clickTimer);
        clickTimer = setTimeout(() => {
            clickCount = 0;
        }, timeout);

        if (clickCount >= times) {
            clickCount = 0;
            callback();
        }
    };

    element.addEventListener('click', handler);

    // 返回清理函数
    return () => {
        element.removeEventListener('click', handler);
        if (clickTimer) clearTimeout(clickTimer);
    };
}
```

**修改 ControlPanel.js**：

```javascript
let multiClickCleanup = null;

create() {
    // 清理之前的 multiClick 监听器
    if (multiClickCleanup) {
        multiClickCleanup();
        multiClickCleanup = null;
    }

    // ... 创建 panelEl ...

    multiClickCleanup = Utils.multiClick(panelTitle, 5, () => {
        advancedVisible = !advancedVisible;
        // ...
    });
}

destroy() {
    if (multiClickCleanup) {
        multiClickCleanup();
        multiClickCleanup = null;
    }
    // ... 其余清理代码 ...
}
```

---

## Bug 10: EventBus - once 实现异常时内存泄漏

### 问题描述

`once` 方法的实现：

```javascript
once(event, callback) {
    const wrapper = (...args) => {
        callback(...args);
        this.off(event, wrapper);  // 如果上面抛出异常，这行不会执行
    };
    this.on(event, wrapper);
}
```

如果 `callback` 抛出异常，`wrapper` 不会被从 listeners 中删除，导致内存泄漏。

### 修复方案

使用 `try...finally` 确保 `off` 总是被执行：

**修改文件**: `src/modules/EventBus.js`

**修改位置**: `once` 方法，约第 19-24 行

```javascript
// 修改前
once(event, callback) {
    const wrapper = (...args) => {
        callback(...args);
        this.off(event, wrapper);
    };
    this.on(event, wrapper);
}

// 修改后
once(event, callback) {
    const wrapper = (...args) => {
        try {
            callback(...args);
        } finally {
            // 确保即使抛出异常也能清理
            this.off(event, wrapper);
        }
    };
    this.on(event, wrapper);
}
```

**进一步改进**：添加错误处理日志

```javascript
once(event, callback) {
    const wrapper = (...args) => {
        try {
            callback(...args);
        } catch (err) {
            console.error(`[EventBus] once("${event}") 回调执行异常:`, err);
        } finally {
            this.off(event, wrapper);
        }
    };
    this.on(event, wrapper);
}
```

---

## 修复优先级建议

| 优先级 | Bug | 修复复杂度 | 影响 |
|--------|-----|------------|------|
| 🔴 高 | Bug 1: 事件监听器未清理 | 低 | 内存泄漏 |
| 🔴 高 | Bug 2: Config 边界检查 | 低 | 配置错误 |
| 🔴 高 | Bug 10: once 内存泄漏 | 低 | 内存泄漏 |
| 🟠 中 | Bug 3: throttle 无效 | 低 | 性能问题 |
| 🟠 中 | Bug 4: 重置值不一致 | 低 | 功能错误 |
| 🟠 中 | Bug 9: 多击事件重复绑定 | 中 | 功能异常 |
| 🟡 低 | Bug 5: 死代码 | 低 | 代码维护 |
| 🟡 低 | Bug 7: 设计缺陷 | 中 | 潜在问题 |

---

## 测试建议

修复完成后，建议进行以下测试：

1. **Bug 1**: 多次打开/关闭卡片面板，检查是否有内存泄漏（Chrome DevTools > Memory）
2. **Bug 3**: 快速连续按键（Z/X/C），观察节流是否生效
3. **Bug 4**: 点击重置按钮后刷新页面，验证配置值是否正确
4. **Bug 9**: 多次切换控制面板显示/隐藏，检查5次点击行为是否正常
5. **Bug 10**: 模拟 callback 抛出异常的场景，验证内存是否泄漏

---

*文档生成时间: 2026-05-30*
