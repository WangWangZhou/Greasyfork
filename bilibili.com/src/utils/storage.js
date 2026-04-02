/**
 * Storage 类 - localStorage 封装
 * 提供便捷的本地存储操作方法
 */
class Storage {
    /**
     * 构造函数
     * @param {string} prefix - 键名前缀，默认为 'app_'，用于避免命名冲突
     */
    constructor(prefix = 'app_') {
        this.prefix = prefix;
        this.storage = window.localStorage;
    }

    /**
     * 存储数据
     * @param {string} key - 键名
     * @param {*} value - 要存储的值（会被序列化为 JSON）
     * @returns {boolean} 操作是否成功
     */
    set(key, value) {
        try {
            const serializedValue = JSON.stringify(value);
            this.storage.setItem(this.prefix + key, serializedValue);
            return true;
        } catch (error) {
            console.error('Storage set error:', error);
            return false;
        }
    }

    /**
     * 获取数据
     * @param {string} key - 键名
     * @param {*} defaultValue - 默认值，当键不存在时返回
     * @returns {*} 存储的值或默认值
     */
    get(key, defaultValue = null) {
        try {
            const value = this.storage.getItem(this.prefix + key);
            if (value === null) {
                return defaultValue;
            }
            return JSON.parse(value);
        } catch (error) {
            console.error('Storage get error:', error);
            return defaultValue;
        }
    }

    /**
     * 删除数据
     * @param {string} key - 要删除的键名
     * @returns {boolean} 操作是否成功
     */
    remove(key) {
        try {
            this.storage.removeItem(this.prefix + key);
            return true;
        } catch (error) {
            console.error('Storage remove error:', error);
            return false;
        }
    }

    /**
     * 清空所有数据
     * @returns {boolean} 操作是否成功
     */
    clear() {
        try {
            const keys = this.keys();
            keys.forEach(key => {
                this.remove(key);
            });
            return true;
        } catch (error) {
            console.error('Storage clear error:', error);
            return false;
        }
    }

    /**
     * 检查键是否存在
     * @param {string} key - 要检查的键名
     * @returns {boolean} 键是否存在
     */
    has(key) {
        try {
            return this.storage.getItem(this.prefix + key) !== null;
        } catch (error) {
            console.error('Storage has error:', error);
            return false;
        }
    }

    /**
     * 获取所有键名
     * @returns {Array<string>} 键名数组（不包含前缀）
     */
    keys() {
        try {
            const allKeys = [];
            for (let i = 0; i < this.storage.length; i++) {
                const key = this.storage.key(i);
                if (key && key.startsWith(this.prefix)) {
                    allKeys.push(key.substring(this.prefix.length));
                }
            }
            return allKeys;
        } catch (error) {
            console.error('Storage keys error:', error);
            return [];
        }
    }

    /**
     * 获取存储的键数量
     * @returns {number} 键的数量
     */
    size() {
        try {
            return this.keys().length;
        } catch (error) {
            console.error('Storage size error:', error);
            return 0;
        }
    }

    /**
     * 获取所有数据
     * @returns {Object} 包含所有键值对的对象
     */
    getAll() {
        try {
            const data = {};
            const keys = this.keys();
            keys.forEach(key => {
                data[key] = this.get(key);
            });
            return data;
        } catch (error) {
            console.error('Storage getAll error:', error);
            return {};
        }
    }

    /**
     * 批量存储数据
     * @param {Object} data - 包含键值对的对象
     * @returns {boolean} 操作是否成功
     */
    setMultiple(data) {
        try {
            Object.keys(data).forEach(key => {
                this.set(key, data[key]);
            });
            return true;
        } catch (error) {
            console.error('Storage setMultiple error:', error);
            return false;
        }
    }

    /**
     * 批量删除数据
     * @param {Array<string>} keys - 要删除的键名数组
     * @returns {boolean} 操作是否成功
     */
    removeMultiple(keys) {
        try {
            keys.forEach(key => {
                this.remove(key);
            });
            return true;
        } catch (error) {
            console.error('Storage removeMultiple error:', error);
            return false;
        }
    }

    /**
     * 获取存储空间大小（字节）
     * @returns {number} 存储空间大小（字节）
     */
    getStorageSize() {
        try {
            let total = 0;
            for (let i = 0; i < this.storage.length; i++) {
                const key = this.storage.key(i);
                if (key && key.startsWith(this.prefix)) {
                    const value = this.storage.getItem(key);
                    total += (key.length + value.length) * 2;
                }
            }
            return total;
        } catch (error) {
            console.error('Storage getStorageSize error:', error);
            return 0;
        }
    }

    /**
     * 获取存储空间大小（KB）
     * @returns {string} 存储空间大小（KB）
     */
    getStorageSizeInKB() {
        return (this.getStorageSize() / 1024).toFixed(2);
    }

    /**
     * 获取存储空间大小（MB）
     * @returns {string} 存储空间大小（MB）
     */
    getStorageSizeInMB() {
        return (this.getStorageSize() / 1024 / 1024).toFixed(2);
    }
}

export default Storage;