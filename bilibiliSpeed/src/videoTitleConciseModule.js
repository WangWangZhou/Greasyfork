/**
 * B站合集视频标题简化模块
 * 功能：自动检测并移除多个视频标题中的公共前缀，保留序号部分，使标题更简洁
 * 条件：视频数量 ≥ minCount 且 原始标题平均长度 ≥ minAvgLength
 */

import logger from './loggerModule.js';

/**
 * 去除标题开头的数字及各种分隔符组合
 * 匹配模式：数字 + (空格 / '-' / '-空格' / 空格'-')
 * @param {string} str - 原始标题
 * @returns {string} 处理后的标题
 */
function trimLeadingNumberAndDelimiter(str) {
    const regex = /^\d+(\s+|\-|\-\s+|\s+\-)/;
    return str.replace(regex, '');
}

/**
 * 提取标题开头的数字及分隔符部分（用于恢复序号）
 * @param {string} str - 原始标题
 * @returns {string} 序号前缀（如 "1-", "2 - "）
 */
function extractNumberPrefix(str) {
    const regex = /^\d+(\s+|\-|\-\s+|\s+\-)/;
    const match = str.match(regex);
    return match ? match[0] : '';
}

/**
 * 求字符串数组的最长公共前缀
 * @param {string[]} strs
 * @returns {string}
 */
function longestCommonPrefix(strs) {
    if (!strs.length) return '';
    let prefix = strs[0];
    for (let i = 1; i < strs.length; i++) {
        while (strs[i].indexOf(prefix) !== 0) {
            prefix = prefix.slice(0, -1);
            if (prefix === '') return '';
        }
    }
    return prefix;
}

/**
 * 从数组中随机取 n 个不重复的元素
 * @param {Array} arr - 原数组
 * @param {number} n - 抽取个数
 * @returns {Array} 抽取结果
 */
function randomSample(arr, n) {
    if (n > arr.length) n = arr.length;
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, n);
}

/**
 * 简化视频标题
 * @param {Object} options - 配置参数
 * @param {HTMLElement[]|NodeList} [options.elements] - 标题所在的DOM元素列表（必须拥有 textContent 属性）
 * @param {string} [options.selector='.title-txt'] - 如果未提供 elements，则使用此选择器查找元素
 * @param {number} [options.minCount=10] - 最小视频数量，低于此值不执行简化
 * @param {number} [options.minAvgLength=15] - 最小平均标题长度，低于此值不执行简化
 * @param {number} [options.sampleSize=3] - 随机抽取用于计算公共前缀的样本数量
 * @param {boolean} [options.debug=false] - 是否输出调试日志
 * @returns {Object} 执行结果
 * @property {boolean} simplified - 是否实际执行了简化
 * @property {number} count - 处理的总视频数量
 * @property {number} avgLength - 原始标题平均长度
 * @property {string} commonPrefix - 检测到的公共前缀（未简化时为空字符串）
 * @property {number} modifiedCount - 实际修改的标题数量
 */
export function simplifyTitles(options = {}) {
    const {
        elements: providedElements,
        selector = '.title-txt',
        minCount = 10,
        minAvgLength = 15,
        sampleSize = 3,
        debug = false
    } = options;

    // 获取标题元素列表
    let titleElements;
    if (providedElements) {
        titleElements = Array.from(providedElements);
    } else {
        titleElements = Array.from(document.querySelectorAll(selector));
    }

    const totalCount = titleElements.length;
    if (debug) logger.debug('title', `找到 ${totalCount} 个标题元素`);

    // 条件1：数量不足
    if (totalCount < minCount) {
        if (debug) logger.debug('title', `视频数量 ${totalCount} < ${minCount}，不启动功能`);
        return { simplified: false, count: totalCount, avgLength: 0, commonPrefix: '', modifiedCount: 0 };
    }

    // 获取原始标题文本
    const originalTitles = titleElements.map(el => el.textContent.trim());

    // 计算平均长度
    const totalLength = originalTitles.reduce((sum, t) => sum + t.length, 0);
    const avgLength = totalLength / totalCount;
    if (debug) logger.debug('title', `平均标题长度: ${avgLength.toFixed(2)}`);

    if (avgLength < minAvgLength) {
        if (debug) logger.debug('title', `平均长度 ${avgLength.toFixed(2)} < ${minAvgLength}，不启动功能`);
        return { simplified: false, count: totalCount, avgLength, commonPrefix: '', modifiedCount: 0 };
    }

    // 初步加工：去除开头的数字及分隔符
    const processedTitles = originalTitles.map(title => trimLeadingNumberAndDelimiter(title));

    // 随机抽取 sampleSize 个样本
    const samples = randomSample(processedTitles, sampleSize);
    if (debug) logger.debug('title', '随机样本:', samples);

    // 计算最长公共前缀
    const commonPrefix = longestCommonPrefix(samples);
    if (!commonPrefix) {
        if (debug) logger.debug('title', '未检测到公共前缀，不进行简化');
        return { simplified: false, count: totalCount, avgLength, commonPrefix: '', modifiedCount: 0 };
    }
    if (debug) logger.debug('title', `检测到公共前缀: "${commonPrefix}"`);

    // 执行简化：保留序号前缀，移除公共前缀
    let modifiedCount = 0;
    titleElements.forEach((element, idx) => {
        const original = originalTitles[idx];
        const processed = processedTitles[idx];

        let individualPart = processed;
        if (processed.startsWith(commonPrefix)) {
            individualPart = processed.slice(commonPrefix.length);
        }

        const numberPrefix = extractNumberPrefix(original);
        let newTitle = numberPrefix + individualPart;

        // 避免空标题
        if (!newTitle.trim()) {
            newTitle = original;
        }

        if (element.textContent !== newTitle) {
            element.textContent = newTitle;
            modifiedCount++;
            if (debug && modifiedCount <= 5) logger.debug('title', `"${original}" → "${newTitle}"`);
        }
    });

    if (debug) logger.debug('title', `完成，共修改 ${modifiedCount} 个标题`);
    return {
        simplified: true,
        count: totalCount,
        avgLength,
        commonPrefix,
        modifiedCount
    };
}

// 默认导出（可选，方便直接导入后调用）
export default simplifyTitles;