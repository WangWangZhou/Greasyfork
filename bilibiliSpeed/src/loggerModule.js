/**
 * 统一日志模块
 * 功能：
 *   - 提供统一的日志接口（log, error, warn, info, debug）
 *   - 支持日志级别控制
 *   - 支持模块前缀
 *   - 支持调试模式开关
 *   - 可统一启用/禁用日志输出
 */

// 日志级别枚举
const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4
};

// 默认配置
const DEFAULT_CONFIG = {
    enabled: false,           // 是否启用日志
    level: LogLevel.DEBUG,   // 日志级别
    showTimestamp: true,     // 是否显示时间戳
    showModule: true,        // 是否显示模块名称
    debugMode: false         // 调试模式（额外输出详细信息）
};

// 当前配置
let config = { ...DEFAULT_CONFIG };

// 模块名称映射
const moduleNames = {
    'speed': '倍速模块',
    'ad': '广告模块',
    'login': '免登录模块',
    'title': '标题简化模块',
    'control': '控制面板模块',
    'main': '主程序'
};

/**
 * 格式化时间戳
 * @returns {string} 格式化的时间字符串
 */
function formatTimestamp() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

/**
 * 获取模块名称
 * @param {string} moduleKey - 模块键
 * @returns {string} 模块名称
 */
function getModuleName(moduleKey) {
    return moduleNames[moduleKey] || moduleKey;
}

/**
 * 构建日志前缀
 * @param {string} moduleKey - 模块键
 * @param {string} level - 日志级别
 * @returns {string} 日志前缀
 */
function buildPrefix(moduleKey, level) {
    const parts = [];
    
    if (config.showTimestamp) {
        parts.push(`[${formatTimestamp()}]`);
    }
    
    if (config.showModule && moduleKey) {
        parts.push(`[${getModuleName(moduleKey)}]`);
    }
    
    if (level) {
        parts.push(`[${level}]`);
    }
    
    return parts.join(' ');
}

/**
 * 检查日志级别是否应该输出
 * @param {number} level - 日志级别
 * @returns {boolean} 是否应该输出
 */
function shouldLog(level) {
    if (!config.enabled) return false;
    return level >= config.level;
}

/**
 * 核心日志函数
 * @param {string} moduleKey - 模块键
 * @param {string} level - 日志级别
 * @param {number} levelValue - 日志级别数值
 * @param {...any} args - 日志参数
 */
function log(moduleKey, level, levelValue, ...args) {
    if (!shouldLog(levelValue)) return;
    
    const prefix = buildPrefix(moduleKey, level);
    console.log(prefix, ...args);
}

/**
 * 设置日志配置
 * @param {Object} newConfig - 新配置
 */
export function setConfig(newConfig) {
    config = { ...config, ...newConfig };
}

/**
 * 获取当前配置
 * @returns {Object} 当前配置
 */
export function getConfig() {
    return { ...config };
}

/**
 * 启用日志
 */
export function enable() {
    config.enabled = true;
}

/**
 * 禁用日志
 */
export function disable() {
    config.enabled = false;
}

/**
 * 设置日志级别
 * @param {number} level - 日志级别
 */
export function setLevel(level) {
    config.level = level;
}

/**
 * 设置调试模式
 * @param {boolean} enabled - 是否启用调试模式
 */
export function setDebugMode(enabled) {
    config.debugMode = enabled;
}

/**
 * 调试日志（仅在调试模式下输出）
 * @param {string} moduleKey - 模块键
 * @param {...any} args - 日志参数
 */
export function debug(moduleKey, ...args) {
    if (!config.debugMode) return;
    log(moduleKey, 'DEBUG', LogLevel.DEBUG, ...args);
}

/**
 * 信息日志
 * @param {string} moduleKey - 模块键
 * @param {...any} args - 日志参数
 */
export function info(moduleKey, ...args) {
    log(moduleKey, 'INFO', LogLevel.INFO, ...args);
}

/**
 * 警告日志
 * @param {string} moduleKey - 模块键
 * @param {...any} args - 日志参数
 */
export function warn(moduleKey, ...args) {
    log(moduleKey, 'WARN', LogLevel.WARN, ...args);
}

/**
 * 错误日志
 * @param {string} moduleKey - 模块键
 * @param {...any} args - 日志参数
 */
export function error(moduleKey, ...args) {
    log(moduleKey, 'ERROR', LogLevel.ERROR, ...args);
}

/**
 * 通用日志（兼容原有console.log）
 * @param {string} moduleKey - 模块键
 * @param {...any} args - 日志参数
 */
export function logMessage(moduleKey, ...args) {
    log(moduleKey, 'LOG', LogLevel.INFO, ...args);
}

// 默认导出（包含所有日志方法）
export default {
    setConfig,
    getConfig,
    enable,
    disable,
    setLevel,
    setDebugMode,
    debug,
    info,
    warn,
    error,
    log: logMessage,
    LogLevel
};