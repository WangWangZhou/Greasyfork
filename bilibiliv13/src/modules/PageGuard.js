/**
 * PageGuard - 页面守卫模块
 * 判断脚本是否应在当前页面运行
 */
const PageGuard = (() => ({
    isNotAllowedPage() {
        const url = window.location.href;
        const path = window.location.pathname;
        return url.includes('/live/') ||
               path === '/' ||
               url.includes('space.bilibili.com') ||
               url.includes('member.bilibili.com');
    },

    isInputFocused() {
        const active = document.activeElement;
        return active && (
            active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            active.contentEditable === 'true'
        );
    }
}))();