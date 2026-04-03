/**
 * Bilibili 自定义播放速度小助手 - 主入口文件
 * 整合了倍速控制、广告屏蔽、免登录弹窗关闭、标题简化等功能
 */

import logger from './loggerModule.js';
import speedModule from './videoSpeedModule.js';
import adModule from './adModule.js';
import loginModule from './loginFreeModule.js';
import titleModule from './videoTitleConciseModule.js';
import { initControlPanel } from './controlPanelModule.js';

// 等待 DOM 加载完成后初始化
function initialize() {
    try {
        // 初始化控制面板，传入所有功能模块
        initControlPanel({
            speedModule,
            adModule,
            loginModule,
            titleModule
        });
        logger.log('main', 'Bilibili自定义播放速度小助手已启动');
    } catch (error) {
        logger.error('main', 'Bilibili自定义播放速度小助手初始化失败:', error);
    }
}

// 如果文档已经加载完成，直接初始化；否则等待 DOMContentLoaded 事件
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}
