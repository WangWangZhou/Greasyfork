/**
 * Bilibili 自定义播放速度小助手 - 主入口文件
 * 整合了倍速控制、广告屏蔽、免登录弹窗关闭、标题简化、视频信息面板等功能
 */

// 导入各模块
import videoSpeedModule from './videoSpeedModule.js';
import { initAdBlocker } from './adModule.js';
import { keepLoginModalClosed } from './loginFreeModule.js';
import simplifyTitles from './videoTitleConciseModule.js';
import { initVideoInfoDisplay } from './videoInfoDisplayModule.js';
import logger from './utils/loggerModule.js';

// 模块实例存储（用于后续可能的销毁操作）
const moduleInstances = {
    speed: null,
    adBlocker: null,
    login: null,
    title: null,
    videoInfo: null
};

/**
 * 初始化倍速控制模块
 */
function initSpeedModule() {
    const speedInstance = videoSpeedModule.init({
        step: 0.05,
        minSpeed: 0.5,
        maxSpeed: 4,
        initialSpeed: 0,
        keys: {
            reset: 'z',
            inc: 'x',
            dec: 'c'
        },
        tipDuration: 500,
        showTip: true,
        debug: false
    });
    
    if (speedInstance.active) {
        logger.log('main', '[倍速模块] 已启用');
    } else {
        logger.log('main', '[倍速模块]', speedInstance.reason === 'live_page' ? '直播页面，已禁用' : '未启用');
    }
    
    moduleInstances.speed = speedInstance;
}

/**
 * 初始化广告屏蔽模块
 */
function initAdModule() {
    const adBlocker = initAdBlocker(
        [
            '.video-card-ad-small',
            '.right-bottom-banner'
        ],
        {
            immediate: true,
            targetNode: document.body
        }
    );
    
    logger.log('main', '[广告屏蔽模块] 已启动');
    moduleInstances.adBlocker = adBlocker;
}

/**
 * 初始化免登录模块
 */
function initLoginModule() {
    const loginObserver = keepLoginModalClosed({
        immediate: true,
        targetNode: document.body
    });
    
    logger.log('main', '[免登录模块] 已启动');
    moduleInstances.login = loginObserver;
}

/**
 * 初始化标题简化模块
 */
function initTitleModule() {
    const result = simplifyTitles({
        selector: '.title-txt',
        minCount: 10,
        minAvgLength: 15,
        sampleSize: 3,
        debug: false
    });
    
    if (result.simplified) {
        logger.log('main', `[标题简化模块] 已简化 ${result.modifiedCount} 个标题，公共前缀: "${result.commonPrefix}"`);
    } else {
        logger.log('main', '[标题简化模块] 未执行简化', result.count < 10 ? '(视频数量不足)' : '(平均长度不足)');
    }
    
    moduleInstances.title = result;
}

/**
 * 主初始化函数
 */
function initialize() {
    logger.log('main', '='.repeat(50));
    logger.log('main', 'Bilibili 自定义播放速度小助手 - 初始化中...');
    logger.log('main', '='.repeat(50));
    
    try {
        initSpeedModule();
    } catch (error) {
        logger.error('main', '[倍速模块] 初始化失败:', error);
    }
    
    try {
        initAdModule();
    } catch (error) {
        logger.error('main', '[广告屏蔽模块] 初始化失败:', error);
    }
    
    try {
        initLoginModule();
    } catch (error) {
        logger.error('main', '[免登录模块] 初始化失败:', error);
    }
    
    try {
        initTitleModule();
    } catch (error) {
        logger.error('main', '[标题简化模块] 初始化失败:', error);
    }
    
    try {
        initVideoInfoDisplay();
    } catch (error) {
        logger.error('main', '[视频信息面板模块] 初始化失败:', error);
    }
    
    logger.log('main', '='.repeat(50));
    logger.log('main', 'Bilibili 自定义播放速度小助手 - 初始化完成');
    logger.log('main', '='.repeat(50));
}

/**
 * 销毁所有模块（可选，用于清理资源）
 */
function destroyAll() {
    logger.log('main', '[主程序] 开始销毁所有模块...');
    
    if (moduleInstances.speed && moduleInstances.speed.destroy) {
        moduleInstances.speed.destroy();
        logger.log('main', '[倍速模块] 已销毁');
    }
    
    if (moduleInstances.adBlocker && moduleInstances.adBlocker.disconnect) {
        moduleInstances.adBlocker.disconnect();
        logger.log('main', '[广告屏蔽模块] 已销毁');
    }
    
    if (moduleInstances.login && moduleInstances.login.disconnect) {
        moduleInstances.login.disconnect();
        logger.log('main', '[免登录模块] 已销毁');
    }
    
    if (moduleInstances.videoInfo && moduleInstances.videoInfo.destroy) {
        moduleInstances.videoInfo.destroy();
        logger.log('main', '[视频信息面板模块] 已销毁');
    }
    
    moduleInstances.speed = null;
    moduleInstances.adBlocker = null;
    moduleInstances.login = null;
    moduleInstances.title = null;
    moduleInstances.videoInfo = null;
    
    logger.log('main', '[主程序] 所有模块已销毁');
}

// 导出销毁函数（供外部调用）
//export { destroyAll };

// 如果文档已经加载完成
//if (document.readyState === 'loading') {
//    document.addEventListener('DOMContentLoaded', () => {
//        initialize();
//    });
//}

initialize();
