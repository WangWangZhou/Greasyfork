/**
 * 时间处理工具类
 * 提供时间格式化和解析相关功能
 */

/**
 * 将秒数格式化为时间字符串
 * @param {number} seconds - 秒数
 * @returns {string} 格式化后的时间字符串，例如 "4:25:38" 或 "45:30"
 */
function formatSeconds(seconds) {
    if (seconds < 0) seconds = 0;
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}

/**
 * 将时间字符串解析为秒数
 * @param {string} timeStr - 时间字符串，例如 "47:55" 或 "03:31:43"
 * @returns {number} 秒数
 */
function parseTimeString(timeStr) {
    if (!timeStr) return 0;
    
    const parts = timeStr.split(':').map(part => parseInt(part, 10));
    
    if (parts.length === 2) {
        // 格式：分:秒
        return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
        // 格式：时:分:秒
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    
    console.warn('无法解析的时长格式:', timeStr);
    return 0;
}

/**
 * 计算合集总时长（秒）
 * @returns {number} 总时长（秒）
 */
function calculateTotalDuration() {
    // 获取所有时长元素（根据你提供的 HTML 结构，时长在 .duration 元素内）
    const durationElements = document.querySelectorAll('.stat-item.duration');
    if (durationElements.length === 0) return 0;

    let totalSeconds = 0;

    // 遍历每个时长，解析为秒数并累加
    durationElements.forEach(el => {
        const timeStr = el.textContent.trim();
        if (!timeStr) return;
        totalSeconds += parseTimeString(timeStr);
    });

    return totalSeconds;
}

export {
    formatSeconds,
    parseTimeString,
    calculateTotalDuration
};

export default {
    formatSeconds,
    parseTimeString,
    calculateTotalDuration
};
