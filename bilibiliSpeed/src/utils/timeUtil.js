/**
 * 时间工具模块
 * 提供格式化秒数、获取当前时间戳等常用功能
 */

/**
 * 格式化秒数为 mm:ss 或 hh:mm:ss 格式
 * 当总秒数 >= 3600 时显示 hh:mm:ss（小时不补零），否则显示 mm:ss（分钟补零）
 * @param {number} seconds - 秒数（负数将按 0 处理）
 * @returns {string} 格式化后的时间字符串
 * @example
 * formatTime(65)      // "01:05"
 * formatTime(3665)    // "1:01:05"
 */
export function formatTime(seconds) {
    if (seconds < 0) seconds = 0;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        // 小时不强制补零，分钟和秒补零
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}

/**
 * 固定宽度格式化（小时、分钟、秒均补零到两位）
 * @param {number} seconds - 秒数
 * @returns {string} 格式为 HH:MM:SS，如 "01:02:03"
 * @example
 * formatTimeFixed(3665)  // "01:01:05"
 */
export function formatTimeFixed(seconds) {
    if (seconds < 0) seconds = 0;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 获取当前 Unix 时间戳（秒）
 * @returns {number}
 */
export function getCurrentTimestamp() {
    return Math.floor(Date.now() / 1000);
}

/**
 * 计算合集总时长（秒）
 * @returns {number}
 */
export function calculateTotalDuration() {
    let totalDuration = 0;
    if (window.__INITIAL_STATE__ && window.__INITIAL_STATE__.videoData) {
        const pages = window.__INITIAL_STATE__.videoData.pages;
        if (Array.isArray(pages)) {
            pages.forEach(page => {
                if (page && typeof page.duration === 'number') {
                    totalDuration += page.duration;
                }
            });
        }
    }
    return totalDuration;
}

//是否是合集 
export function isCollection(){
    return window.__INITIAL_STATE__.videoData.pages.length > 1;
}

//当前视频时长
export function getCurrentVideoDuration(){
    const video = document.querySelector('video');
    return video.duration;
}

//当前视频已播放时长
export function getCurrentVideoPlayedTime(){
    const video = document.querySelector('video');
    return video.currentTime;
}

//当前视频剩余时长
export function getRemainingTime(){
    let remainingTime = 0;
    // 获取页面中的第一个 video 元素
    const video = document.querySelector('video');

    if (video) {
    // 计算剩余时间（单位：秒）
    remainingTime = video.duration - video.currentTime;
    
    //console.log(`剩余时长: ${remainingTime.toFixed(2)} 秒`);
    //console.log(`格式化剩余时间: ${formatTime(remainingTime)}`);
    } else {
    //console.log('未找到 video 元素');
    }

    return remainingTime;
}

// 默认导出（包含所有函数）
export default {
    formatTime,
    formatTimeFixed,
    getCurrentTimestamp,
    calculateTotalDuration,
    getRemainingTime,
    isCollection,
    getCurrentVideoDuration,
    getCurrentVideoPlayedTime
};


