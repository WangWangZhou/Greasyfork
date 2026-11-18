/**
 * PlayerModifier - 播放器修改模块
 * Hook B站播放器的倍速菜单，注入精细调节 slider
 *
 * 倍速调节的三种方式：
 *   1. 面板按钮    → setRate(rate)           → 临时生效
 *   2. 快捷键 x/c/z → adjustRate(delta)       → 临时生效
 *   3. 播放器slider  → 本模块注入              → 临时生效
 *
 * 所有方式都是临时的，刷新后视频会用 Config.data.defaultRate 重置。
 * 持久化的只有 defaultRate（默认倍速）和 step（步进值）。
 */
const PlayerModifier = (() => {
    let injectedSlider = null;     // 当前注入的 slider 容器
    let boundRateChangeListener = null; // video 的 ratechange 监听

    const SLIDER_MIN = 0.5;
    const SLIDER_MAX = 2.0;

    /**
     * 往倍速菜单里注入精细调节区域
     */
    function injectRateSlider(menuEl) {
        if (!menuEl || menuEl.querySelector('.bili-speed-player-slider-wrap')) {
            return; // 已注入或菜单不存在
        }

        const step = Config.data.step || 0.05;
        const currentRate = VideoController.getVideo()?.playbackRate || 1.0;

        // ===== 改造菜单：加宽到 200px + 6 个档位横排 =====
        menuEl.style.width = '200px';
        menuEl.style.minWidth = '200px';

        // 找到原来 6 个竖排的 LI 项，改成横排 grid（3 列 × 2 行）
        const existingItems = Array.from(menuEl.querySelectorAll(':scope > li'));
        if (existingItems.length > 0) {
            const gridWrap = document.createElement('div');
            gridWrap.className = 'bili-speed-rate-grid';
            gridWrap.style.cssText = `
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 4px;
                padding: 6px;
            `;

            existingItems.forEach(li => {
                li.style.cssText = `
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 8px 0;
                    font-size: 13px;
                    border-radius: 5px;
                    cursor: pointer;
                    list-style: none;
                    transition: background 0.15s;
                `;
                gridWrap.appendChild(li);
            });

            menuEl.innerHTML = '';
            menuEl.appendChild(gridWrap);
        }

        // ===== 注入精细调节区域（slider + 左右 +/- 按钮）=====
        const wrap = document.createElement('div');
        wrap.className = 'bili-speed-player-slider-wrap';
        wrap.style.cssText = `
            padding: 10px 14px 12px;
            border-top: 1px solid rgba(255,255,255,0.1);
            margin-top: 2px;
            user-select: none;
        `;

        wrap.innerHTML = `
            <div style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 10px;
                font-size: 12px;
                color: rgba(255,255,255,0.7);
            ">
                <span>精细调节</span>
                <span class="bili-speed-slider-value" style="
                    color: #00aeec;
                    font-weight: bold;
                    font-family: monospace;
                ">${currentRate.toFixed(2)}x</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <!-- 减按钮 -->
                <button class="bili-speed-rate-btn bili-speed-rate-btn-minus" style="
                    width: 24px;
                    height: 24px;
                    border: none;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.1);
                    color: #fff;
                    font-size: 16px;
                    font-weight: bold;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.15s;
                    padding: 0;
                    line-height: 1;
                ">−</button>
                <!-- slider -->
                <input type="range"
                    class="bili-speed-rate-slider"
                    min="${SLIDER_MIN}"
                    max="${SLIDER_MAX}"
                    step="${step}"
                    value="${currentRate}"
                    style="
                        flex: 1;
                        height: 4px;
                        -webkit-appearance: none;
                        appearance: none;
                        background: rgba(255,255,255,0.2);
                        border-radius: 2px;
                        outline: none;
                        cursor: pointer;
                    "
                >
                <!-- 加按钮 -->
                <button class="bili-speed-rate-btn bili-speed-rate-btn-plus" style="
                    width: 24px;
                    height: 24px;
                    border: none;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.1);
                    color: #fff;
                    font-size: 16px;
                    font-weight: bold;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.15s;
                    padding: 0;
                    line-height: 1;
                ">+</button>
            </div>
            <div style="
                display: flex;
                justify-content: space-between;
                font-size: 10px;
                color: rgba(255,255,255,0.4);
                margin-top: 6px;
            ">
                <span>${SLIDER_MIN}x</span>
                <span>${SLIDER_MAX}x</span>
            </div>
        `;

        // 注入样式
        const style = document.createElement('style');
        style.textContent = `
            .bpx-player-ctrl-playbackrate-menu .bili-speed-rate-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 14px;
                height: 14px;
                background: #00aeec;
                border-radius: 50%;
                cursor: pointer;
                border: 2px solid #fff;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            }
            .bpx-player-ctrl-playbackrate-menu .bili-speed-rate-slider::-moz-range-thumb {
                width: 14px;
                height: 14px;
                background: #00aeec;
                border-radius: 50%;
                cursor: pointer;
                border: 2px solid #fff;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            }
            /* 横排档位 hover / active */
            .bpx-player-ctrl-playbackrate-menu .bili-speed-rate-grid > li:hover {
                background: rgba(255,255,255,0.12);
            }
            .bpx-player-ctrl-playbackrate-menu .bili-speed-rate-grid > li.bpx-state-active {
                color: #00aeec;
                background: rgba(0,174,236,0.18);
            }
            /* +/- 按钮 hover */
            .bpx-player-ctrl-playbackrate-menu .bili-speed-rate-btn:hover {
                background: rgba(0,174,236,0.5) !important;
            }
            .bpx-player-ctrl-playbackrate-menu .bili-speed-rate-btn:active {
                transform: scale(0.9);
            }
        `;
        wrap.appendChild(style);

        menuEl.appendChild(wrap);
        injectedSlider = wrap;

        // ===== 绑定事件 =====
        const slider = wrap.querySelector('.bili-speed-rate-slider');
        const valueEl = wrap.querySelector('.bili-speed-slider-value');
        const btnMinus = wrap.querySelector('.bili-speed-rate-btn-minus');
        const btnPlus = wrap.querySelector('.bili-speed-rate-btn-plus');

        let isDragging = false;

        // slider 拖动
        slider.addEventListener('input', () => {
            isDragging = true;
            const rate = parseFloat(slider.value);
            valueEl.textContent = rate.toFixed(2) + 'x';
            VideoController.setRate(rate);
        });

        slider.addEventListener('change', () => {
            isDragging = false;
            Logger.info('PlayerModifier slider 调节倍速:', slider.value + 'x');
        });

        // +/- 按钮点击
        btnMinus.addEventListener('click', (e) => {
            e.stopPropagation();
            const video = VideoController.getVideo();
            if (!video) return;
            const newRate = Math.max(SLIDER_MIN, video.playbackRate - step);
            slider.value = newRate;
            valueEl.textContent = newRate.toFixed(2) + 'x';
            VideoController.setRate(newRate);
        });

        btnPlus.addEventListener('click', (e) => {
            e.stopPropagation();
            const video = VideoController.getVideo();
            if (!video) return;
            const newRate = Math.min(SLIDER_MAX, video.playbackRate + step);
            slider.value = newRate;
            valueEl.textContent = newRate.toFixed(2) + 'x';
            VideoController.setRate(newRate);
        });

        // 监听 video 的 ratechange，其他方式改倍速时同步 slider
        const video = VideoController.getVideo();
        if (video) {
            boundRateChangeListener = () => {
                if (isDragging) return;
                const r = video.playbackRate;
                slider.value = r;
                valueEl.textContent = r.toFixed(2) + 'x';
            };
            video.addEventListener('ratechange', boundRateChangeListener);
        }

        Logger.info('PlayerModifier: 倍速精细调节已注入');
    }

    /**
     * 移除注入的 slider 清理
     */
    function cleanupSlider() {
        if (injectedSlider) {
            injectedSlider.remove();
            injectedSlider = null;
        }
        if (boundRateChangeListener) {
            const video = VideoController.getVideo();
            if (video) {
                video.removeEventListener('ratechange', boundRateChangeListener);
            }
            boundRateChangeListener = null;
        }
    }

    /**
     * MutationObserver 回调：检测倍速菜单是否出现
     */
    function onMutation() {
        // 找倍速菜单（B 站播放器控制栏弹出的菜单）
        const menu = document.querySelector('.bpx-player-ctrl-playbackrate-menu');
        if (menu) {
            // 检查菜单是否真的可见（有时候元素存在但 display:none）
            const style = window.getComputedStyle(menu);
            if (style.display !== 'none' && style.visibility !== 'hidden') {
                injectRateSlider(menu);
            }
        }
    }

    /**
     * 还原倍速菜单到 B 站原始样式
     * 清除 grid 包裹、slider、宽度修改
     */
    function restoreOriginalMenu() {
        const menu = document.querySelector('.bpx-player-ctrl-playbackrate-menu');
        if (!menu) return;

        // 1. 还原宽度
        menu.style.width = '';
        menu.style.minWidth = '';

        // 2. 移除 slider 包裹
        cleanupSlider();

        // 3. 把 grid 里的 LI 还原回 menu 直属子元素
        const gridWrap = menu.querySelector('.bili-speed-rate-grid');
        if (gridWrap) {
            const lis = Array.from(gridWrap.children);
            gridWrap.remove();
            lis.forEach(li => {
                // 还原 LI 的内联样式（清掉我们加的）
                li.style.cssText = '';
                menu.appendChild(li);
            });
        }

        Logger.info('PlayerModifier: 已还原 B 站原始倍速菜单');
    }

    let observer = null;
    let enabled = true;  // 当前是否启用

    /**
     * MutationObserver 回调：检测倍速菜单是否出现
     */
    function onMutation() {
        if (!enabled) {
            // 关闭状态下尝试还原（可能是刚被关闭）
            restoreOriginalMenu();
            return;
        }

        const menu = document.querySelector('.bpx-player-ctrl-playbackrate-menu');
        if (menu) {
            const style = window.getComputedStyle(menu);
            if (style.display !== 'none' && style.visibility !== 'hidden') {
                injectRateSlider(menu);
            }
        }
    }

    return {
        init() {
            enabled = Config.data.playerRateSliderEnabled !== false;
            if (!enabled) {
                // 关闭状态，直接跳过
                Logger.info('PlayerModifier 已禁用（playerRateSliderEnabled=false）');
            } else {
                onMutation();
            }

            observer = new MutationObserver(onMutation);
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            Logger.info('PlayerModifier 已启动');
        },

        enable() {
            enabled = true;
            Config.data.playerRateSliderEnabled = true;
            Toast.show('播放器倍速滑块：已开启');
            onMutation(); // 立即尝试注入
        },

        disable() {
            enabled = false;
            Config.data.playerRateSliderEnabled = false;
            restoreOriginalMenu();
            Toast.show('播放器倍速滑块：已关闭');
        },

        destroy() {
            cleanupSlider();
            if (observer) {
                observer.disconnect();
                observer = null;
            }
            Logger.info('PlayerModifier 已销毁');
        }
    };
})();
