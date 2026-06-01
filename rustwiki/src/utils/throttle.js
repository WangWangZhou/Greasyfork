// 节流函数
export function throttle(func, limit) {
    let inThrottle;
    let lastFunc;
    let lastRan;
    
    return function() {
        const context = this;
        const args = arguments;
        
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            lastRan = Date.now();
            setTimeout(() => {
                inThrottle = false;
                if (lastFunc) {
                    func.apply(context, args);
                    lastFunc = null;
                }
            }, limit);
        } else {
            lastFunc = () => {
                func.apply(context, args);
                lastFunc = null;
            };
        }
    }
}