/**
 * NoLoginGuard - 免登录守卫模块
 * 阻止未登录时的登录弹窗及其副作用（暂停视频、退出全屏）
 * 不涉及高清画质破解，仅改善 360P 观看体验
 */
const NoLoginGuard = (() => {
    let observer = null;
    let playState = 'playing';   // 记录弹窗出现前的播放状态
    let isProbingPaused = false; // 防止恢复播放时触发循环

    // === 用户主动登录拦截 ===
    // 当用户手动点击登录相关按钮时，设置宽限期，期间放行弹窗不拦截
    let userRequestedLogin = false;
    let loginRequestResetTimer = null;
    const USER_LOGIN_GRACE_MS = 5000; // 5 秒宽限期（足够弹窗出现）
    let clickInterceptorBound = null;  // 保存 click 拦截器引用方便解绑

    /**
     * 判断当前 B 站是否已登录
     * 通过 nav API 返回值或 cookie 中是否有 DedeUserID 判断
     */
    function checkIsLogin() {
        try {
            // 优先检测 cookie（同步，无需网络请求）
            const cookie = document.cookie;
            if (cookie.includes('DedeUserID=')) {
                const match = cookie.match(/DedeUserID=([^;]+)/);
                if (match && match[1] !== '0' && match[1] !== '') {
                    return true;
                }
            }

            // 检测页面全局状态
            if (window.__INITIAL_STATE__?.userInfo?.isLogin) {
                return true;
            }
            if (window.__NUXT__?.userInfo?.isLogin) {
                return true;
            }

            return false;
        } catch (err) {
            Logger.warn('NoLoginGuard checkIsLogin 异常:', err);
            return false;
        }
    }

    /**
     * 弹窗相关选择器（登录弹窗 + 试看结束弹窗 + 播放器内提示弹窗）
     */
    const POPUP_SELECTORS = [
        // 登录弹窗遮罩层/容器
        '[class*="bili-mini-mask"]',
        '[class*="mini-login-mask"]',
        '[class*="bili-login-mask"]',
        '[class*="login-prompt"]',
        '[class*="login-guide"]',
        '[class*="player-login-mask"]',
        '[class*="player-login"]',
        '[class*="video-popup-login"]',
        // 试看结束弹窗
        '[class*="trial-end"]',
        '[class*="trialend"]',
        '[class*="quality-trial"]',
        '[class*="bpx-player-quality-trial"]',
        '[class*="bpx-player-quality-popup"]',
        '[class*="player-quality-guide"]',
        // 播放器内"登录免费享高清"提示弹窗
        '[class*="login-tip"]',
        '[class*="login-banner"]',
        '[class*="login-notice"]',
        '[class*="login-card"]',
        '[class*="quality-tip"]',
        '[class*="video-tip"]',
        '[class*="video-login-tip"]',
        '[class*="player-tip"]',
        '[class*="player-banner"]',
        '[class*="player-popup"]',
        '[class*="player-dialog"]',
        '[class*="bpx-player-dialog-area"] > *',
        '[class*="video-guide"]',
        '[class*="video-banner"]',
        // 特定 ID
        '#bili-mini-mask',
        '#player-login-mask',
        '#bPlayerMask',
        // iframe 形式的登录面板
        'iframe[src*="login"]',
        'iframe[src*="mini-login"]'
    ];

    /**
     * 判断元素是否是弹窗（登录弹窗 or 试看结束弹窗）
     */
    function isLoginPopup(el) {
        if (!(el instanceof Element)) return false;

        // 1. class/id 匹配
        const elStr = (el.className || '') + ' ' + (el.id || '');
        if (/bili-mini|mini-login|login-mask|login-prompt|login-guide|player-login|bPlayerMask/i.test(elStr)) {
            return true;
        }

        // 2. tag 名 + 属性匹配
        if (el.tagName === 'IFRAME') {
            const src = el.getAttribute('src') || '';
            if (/login|passport|mini-login/i.test(src)) {
                return true;
            }
        }

        return false;
    }

    /**
     * 判断元素是否是试看结束弹窗
     */
    function isTrialPopup(el) {
        if (!Config.data.noLoginBlockTrialEnd) return false;
        if (!(el instanceof Element)) return false;

        // class/id 包含 trial/quality
        const elStr = (el.className || '') + ' ' + (el.id || '');
        if (/trial|trail|quality.*trial|quality.*popup/i.test(elStr)) {
            return true;
        }

        // 文本包含试看相关关键词
        const text = (el.textContent || '').trim();
        const trialKeywords = [
            '试看已结束',
            '高清试看',
            '为您切换回',
            '体验高清画质',
            '30秒',
            'trial'
        ];
        if (trialKeywords.some(kw => text.includes(kw)) && text.length < 300) {
            return true;
        }

        return false;
    }

    /**
     * 判断一个元素是否是用户主动点击的"登录触发按钮"
     * 宽限期内不拦截这些按钮触发的登录弹窗
     */
    function isUserLoginTriggerClick(target) {
        if (!(target instanceof Element)) return false;

        // 向上查找可点击的登录相关元素
        const loginTrigger = target.closest(
            'a[href*="passport"],' +
            'a[href*="login"],' +
            '[class*="login-btn"],' +
            '[class*="LoginBtn"],' +
            '[class*="bili-header-login"],' +
            '[class*="header-login"],' +
            'button[class*="login"],' +
            '[data-action*="login"],' +
            '[data-stat*="login"],' +
            '[class*="quality-menu-item"],' +  // 清晰度菜单里的「登录即享」项
            '[class*="unlogin"],' +             // 播放器内的未登录提示容器
            '[class*="player-login"]'           // 播放器登录按钮容器
        );

        if (loginTrigger) return true;

        // 兜底：检查点击元素的文字是否包含登录诱导关键词
        const text = (target.textContent || '').trim();
        const loginTexts = ['登录', '立即登录', '登录后观看', '登录即享', '登录可享', '登录免费'];
        if (loginTexts.some(t => text === t || text.includes(t))) {
            return true;
        }

        // 兜底：向上查 3 层，看看哪个元素文字是登录相关
        let el = target;
        for (let i = 0; i < 3 && el; i++) {
            const elText = (el.textContent || '').trim();
            if (loginTexts.some(t => elText === t) && el.children.length <= 3) {
                return true;
            }
            el = el.parentElement;
        }

        return false;
    }

    /**
     * 点击拦截器：检测用户是否主动点击登录按钮
     * 使用 capture 阶段，比 B 站自己的 handler 先执行
     */
    function setupClickInterceptor() {
        clickInterceptorBound = (e) => {
            // 只处理鼠标/键盘触发的 click，不处理脚本触发
            if (typeof e.isTrusted !== 'boolean' || !e.isTrusted) return;

            if (isUserLoginTriggerClick(e.target)) {
                userRequestedLogin = true;

                // 清除旧计时器，重置宽限期
                if (loginRequestResetTimer) {
                    clearTimeout(loginRequestResetTimer);
                }
                loginRequestResetTimer = setTimeout(() => {
                    userRequestedLogin = false;
                    Logger.info('NoLoginGuard: 登录宽限期结束，恢复自动拦截');
                }, USER_LOGIN_GRACE_MS);

                Logger.info('NoLoginGuard: 检测到用户主动点击登录按钮，' + USER_LOGIN_GRACE_MS + 'ms 内放行弹窗');
            }
        };

        document.addEventListener('click', clickInterceptorBound, true);
    }

    function teardownClickInterceptor() {
        if (clickInterceptorBound) {
            document.removeEventListener('click', clickInterceptorBound, true);
            clickInterceptorBound = null;
        }
        if (loginRequestResetTimer) {
            clearTimeout(loginRequestResetTimer);
            loginRequestResetTimer = null;
        }
        userRequestedLogin = false;
    }

    /**
     * 移除页面上所有登录弹窗和试看结束弹窗
     * 如果用户主动点击了登录按钮（宽限期内），则放行不拦截登录弹窗
     */
    function removeAllPopups() {
        let removed = 0;

        // 宽限期内：用户主动点了登录按钮 → 只拦截试看弹窗，放行登录弹窗
        const gracePeriodActive = userRequestedLogin;

        POPUP_SELECTORS.forEach(selector => {
            const nodes = document.querySelectorAll(selector);
            nodes.forEach(node => {
                const isLogin = isLoginPopup(node);
                const isTrial = isTrialPopup(node);

                if (!isLogin && !isTrial) return;

                // 宽限期内：放行登录弹窗（用户主动要登录）
                if (gracePeriodActive && isLogin) {
                    Logger.info('NoLoginGuard: 宽限期内，放行用户主动触发的登录弹窗');
                    return;
                }

                // 试看弹窗永远拦截（不影响手动登录）
                // 登录弹窗仅在非宽限期拦截
                if (isTrial || isLogin) {
                    // 记录弹窗出现前的播放状态
                    const video = document.querySelector('video');
                    if (video) {
                        playState = video.paused ? 'paused' : 'playing';
                    }

                    node.remove();
                    removed++;
                    Logger.info('NoLoginGuard 已移除弹窗:', selector);
                }
            });
        });

        // ===== 兜底扫描 1: body 直属子元素（fixed 定位，高 z-index）=====
        const bodyChildren = document.body?.children;
        if (bodyChildren) {
            for (let i = bodyChildren.length - 1; i >= 0; i--) {
                const child = bodyChildren[i];
                // 弹窗通常是 position: fixed 且 z-index 很高
                const style = window.getComputedStyle(child);
                if (style.position === 'fixed' &&
                    style.zIndex !== 'auto' &&
                    parseInt(style.zIndex) > 10000 &&
                    !child.classList.contains('bili-speed-card')) {
                    // 检查是否包含登录或试看相关文字
                    const text = child.textContent || '';

                    const isAutoPopup = (
                        // 试看/自动弹窗关键词
                        text.includes('试看已结束') ||
                        text.includes('高清试看') ||
                        text.includes('为您切换回') ||
                        text.includes('30秒试看')
                    );

                    const isLoginKeyword = (
                        // 登录诱导关键词
                        (text.includes('登录') && (text.includes('享') || text.includes('免费'))) ||
                        text.includes('登录免费') ||
                        text.includes('登录解锁') ||
                        text.includes('立即登录') ||
                        text.includes('登录后观看')
                    );

                    const shouldRemove =
                        isAutoPopup ||                          // 试看弹窗永远拦截
                        (!gracePeriodActive && isLoginKeyword); // 登录弹窗仅非宽限期拦截

                    if (shouldRemove) {
                        const video = document.querySelector('video');
                        if (video) playState = video.paused ? 'paused' : 'playing';

                        child.remove();
                        removed++;
                        Logger.info('NoLoginGuard 已移除兜底弹窗（body, z-index:' + style.zIndex + '）');
                    }
                }
            }
        }

        // ===== 兜底扫描 2: 播放器容器内部（absolute 定位的弹窗/tip）=====
        // "登录免费享高清" 这类提示通常在播放器容器内部，是 absolute 定位
        const playerContainer = document.querySelector('.bpx-player-container');
        if (playerContainer) {
            const allInPlayer = playerContainer.querySelectorAll('*');
            for (let i = allInPlayer.length - 1; i >= 0; i--) {
                const el = allInPlayer[i];
                try {
                    const s = window.getComputedStyle(el);
                    // 只看有实际尺寸的 absolute/fixed 元素
                    const rect = el.getBoundingClientRect();
                    const hasSize = rect.width > 30 && rect.height > 15;
                    const isPositioned = s.position === 'absolute' || s.position === 'fixed';

                    if (!hasSize || !isPositioned) continue;
                    // 跳过 tooltip（播放器自身的功能按钮提示，不是登录诱导）
                    if (el.classList.contains('bpx-player-tooltip-item')) continue;

                    const text = (el.textContent || '').trim();
                    // 播放器内弹窗关键词（更宽泛，播放器内只有登录诱导才会有这些词）
                    const isPlayerPopupText = (
                        text.includes('登录免费') ||
                        text.includes('登录享') ||
                        text.includes('登录解锁') ||
                        text.includes('立即登录') ||
                        text.includes('登录后观看') ||
                        text.includes('试看已结束') ||
                        text.includes('高清试看') ||
                        text.includes('免费享高清')
                    );

                    if (isPlayerPopupText && text.length < 300) {
                        // 在宽限期内跳过登录类（但试看弹窗仍拦截）
                        const isTrialText = text.includes('试看') || text.includes('30秒');
                        if (gracePeriodActive && !isTrialText) {
                            Logger.info('NoLoginGuard: 宽限期内，放行播放器内登录提示');
                            continue;
                        }

                        const video = document.querySelector('video');
                        if (video) playState = video.paused ? 'paused' : 'playing';

                        // 找到最外层容器再删（避免删到子元素留空壳）
                        let toRemove = el;
                        // 向上找最多 3 层，找更合适的容器（class 里有 tip/popup/banner 的）
                        let cur = el;
                        for (let j = 0; j < 3 && cur && cur !== playerContainer; j++) {
                            const curClass = (cur.className || '').toString();
                            if (/tip|popup|banner|dialog|notice|card|mask/i.test(curClass)) {
                                toRemove = cur;
                            }
                            cur = cur.parentElement;
                        }

                        toRemove.remove();
                        removed++;
                        Logger.info('NoLoginGuard 已移除播放器内弹窗:',
                            (el.className || '').toString().substring(0, 60));
                    }
                } catch(e) { /* 忽略个别元素访问异常 */ }
            }
        }

        return removed;
    }

    /**
     * 恢复被弹窗副作用影响的视频状态
     */
    function restoreVideoState() {
        const video = document.querySelector('video');
        if (!video) return;

        // 如果弹窗出现前视频在播放，现在被暂停了 → 恢复播放
        if (playState === 'playing' && video.paused && !isProbingPaused) {
            isProbingPaused = true;
            video.play().then(() => {
                Logger.info('NoLoginGuard 已恢复视频播放');
            }).catch(() => {
                Logger.warn('NoLoginGuard 恢复播放失败');
            }).finally(() => {
                isProbingPaused = false;
            });
        }
    }

    /**
     * MutationObserver 回调：DOM 变化时移除弹窗 + 恢复视频
     */
    function onMutation(mutations) {
        // 只在新增节点时检查
        for (const mutation of mutations) {
            if (mutation.addedNodes && mutation.addedNodes.length > 0) {
                const removed = removeAllPopups();
                if (removed > 0) {
                    restoreVideoState();
                }
                break;
            }
        }
    }

    /**
     * 兜底定时器：某些弹窗可能不在 MutationObserver 捕获范围内
     */
    let fallbackTimer = null;

    return {
        init() {
            // 总开关关闭则跳过
            if (!Config.data.noLoginEnabled) {
                Logger.info('NoLoginGuard: 开关已关闭，跳过免登录守卫');
                return false;
            }

            // 已登录则跳过
            if (checkIsLogin()) {
                Logger.info('NoLoginGuard: 已登录，跳过免登录守卫');
                return false;
            }

            // 1. 立即清理一次可能已存在的弹窗
            removeAllPopups();

            // 2. 启动点击拦截器（区分用户主动 vs 自动弹窗）
            setupClickInterceptor();

            // 3. 启动 MutationObserver 持续监听
            observer = new MutationObserver(onMutation);
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            // 4. 兜底定时器（每 3s 扫一次，防止极端情况漏网）
            fallbackTimer = setInterval(() => {
                const removed = removeAllPopups();
                if (removed > 0) {
                    restoreVideoState();
                }
            }, 3000);

            Logger.info('NoLoginGuard 已启动（未登录守卫模式）');
            return true;
        },

        /**
         * 运行时启用（菜单切换开启时调用）
         */
        enable() {
            Config.data.noLoginEnabled = true;
            if (observer || fallbackTimer) return; // 已在运行
            this.init();
            Toast.show('免登录已启用');
        },

        /**
         * 运行时禁用（菜单切换关闭时调用）
         */
        disable() {
            Config.data.noLoginEnabled = false;
            if (observer) {
                observer.disconnect();
                observer = null;
            }
            if (fallbackTimer) {
                clearInterval(fallbackTimer);
                fallbackTimer = null;
            }
            playState = 'playing';
            Toast.show('免登录已禁用，刷新后生效');
        },

        destroy() {
            teardownClickInterceptor();
            if (observer) {
                observer.disconnect();
                observer = null;
            }
            if (fallbackTimer) {
                clearInterval(fallbackTimer);
                fallbackTimer = null;
            }
            playState = 'playing';
            isProbingPaused = false;
            Logger.info('NoLoginGuard 已销毁');
        },

        /**
         * 手动触发一次弹窗清理（供外部调用）
         */
        sweep() {
            const removed = removeAllPopups();
            if (removed > 0) restoreVideoState();
            return removed;
        }
    };
})();
