/**
 * 节流和防抖工具函数
 * 功能：
 *   - 节流（throttle）：在一定时间内只执行一次函数
 *   - 防抖（debounce）：在事件触发后等待一段时间再执行
 */

/**
 * 节流函数
 * 在指定的时间间隔内，只执行一次函数
 * 
 * @param {Function} func - 需要节流的函数
 * @param {number} delay - 节流时间间隔（毫秒）
 * @returns {Function} 节流后的函数
 * 
 * @example
 * const throttledFn = throttle(() => console.log('执行'), 100);
 * window.addEventListener('scroll', throttledFn);
 */
export function throttle(func, delay) {
    let lastCall = 0;
    let timer = null;
    
    return function(...args) {
        const now = Date.now();
        const remaining = delay - (now - lastCall);
        
        if (remaining <= 0) {
            // 如果已经过了节流时间，立即执行
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            lastCall = now;
            return func.apply(this, args);
        } else {
            // 否则设置定时器在剩余时间后执行
            if (!timer) {
                timer = setTimeout(() => {
                    lastCall = Date.now();
                    timer = null;
                    return func.apply(this, args);
                }, remaining);
            }
        }
    };
}

/**
 * 防抖函数
 * 在事件触发后等待指定时间再执行，如果在这段时间内再次触发，则重新计时
 * 
 * @param {Function} func - 需要防抖的函数
 * @param {number} delay - 防抖等待时间（毫秒）
 * @param {boolean} immediate - 是否立即执行（首次触发时立即执行）
 * @returns {Function} 防抖后的函数
 * 
 * @example
 * const debouncedFn = debounce(() => console.log('执行'), 300);
 * window.addEventListener('resize', debouncedFn);
 */
export function debounce(func, delay, immediate = false) {
    let timer = null;
    
    return function(...args) {
        const callNow = immediate && !timer;
        
        if (timer) {
            clearTimeout(timer);
        }
        
        timer = setTimeout(() => {
            timer = null;
            if (!immediate) {
                return func.apply(this, args);
            }
        }, delay);
        
        if (callNow) {
            return func.apply(this, args);
        }
    };
}

/**
 * 带取消功能的节流函数
 * 返回的函数包含 cancel 方法，可以取消待执行的调用
 * 
 * @param {Function} func - 需要节流的函数
 * @param {number} delay - 节流时间间隔（毫秒）
 * @returns {Function & { cancel: Function }} 节流后的函数，包含 cancel 方法
 */
export function throttleWithCancel(func, delay) {
    let lastCall = 0;
    let timer = null;
    
    const throttled = function(...args) {
        const now = Date.now();
        const remaining = delay - (now - lastCall);
        
        if (remaining <= 0) {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            lastCall = now;
            return func.apply(this, args);
        } else {
            if (!timer) {
                timer = setTimeout(() => {
                    lastCall = Date.now();
                    timer = null;
                    return func.apply(this, args);
                }, remaining);
            }
        }
    };
    
    throttled.cancel = () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
    };
    
    return throttled;
}

/**
 * 带取消功能的防抖函数
 * 返回的函数包含 cancel 方法，可以取消待执行的调用
 * 
 * @param {Function} func - 需要防抖的函数
 * @param {number} delay - 防抖等待时间（毫秒）
 * @param {boolean} immediate - 是否立即执行
 * @returns {Function & { cancel: Function }} 防抖后的函数，包含 cancel 方法
 */
export function debounceWithCancel(func, delay, immediate = false) {
    let timer = null;
    
    const debounced = function(...args) {
        const callNow = immediate && !timer;
        
        if (timer) {
            clearTimeout(timer);
        }
        
        timer = setTimeout(() => {
            timer = null;
            if (!immediate) {
                return func.apply(this, args);
            }
        }, delay);
        
        if (callNow) {
            return func.apply(this, args);
        }
    };
    
    debounced.cancel = () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
    };
    
    return debounced;
}

// 默认导出
export default {
    throttle,
    debounce,
    throttleWithCancel,
    debounceWithCancel
};
