// 存储类
export class Storage {
    constructor(prefix = 'rustwiki-') {
        this.prefix = prefix;
    }

    get(key, defaultValue = null) {
        const value = localStorage.getItem(this.prefix + key);
        if (value === null) return defaultValue;
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    }

    set(key, value) {
        localStorage.setItem(this.prefix + key, JSON.stringify(value));
    }

    remove(key) {
        localStorage.removeItem(this.prefix + key);
    }

    clear() {
        Object.keys(localStorage)
            .filter(key => key.startsWith(this.prefix))
            .forEach(key => localStorage.removeItem(key));
    }
}