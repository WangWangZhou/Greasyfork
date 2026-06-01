/**
 * Switch - 开关组件
 * UI基础组件 - 提供美观的开关控件
 *
 * @module UI/Components
 *
 * @example
 * const switchEl = Switch.create({
 *   checked: false,
 *   onChange: (isChecked) => {
 *     console.log('Switch:', isChecked);
 *   }
 * });
 *
 * document.body.appendChild(switchEl);
 */
const Switch = (() => {
    return {
        /**
         * 创建Switch实例
         * @param {Object} options - 配置选项
         * @param {boolean} [options.checked=false] - 初始是否选中
         * @param {Function} [options.onChange] - 状态变化回调
         * @param {boolean} [options.disabled=false] - 是否禁用
         * @param {string} [options.size='normal'] - 尺寸: 'small', 'normal', 'large'
         * @returns {HTMLElement} Switch元素
         */
        create(options = {}) {
            const {
                checked = false,
                onChange,
                disabled = false,
                size = 'normal'
            } = options;

            const container = document.createElement('div');
            container.className = 'bili-speed-switch-container';

            const sizes = {
                small: { width: 28, height: 16, knob: 12 },
                normal: { width: 40, height: 22, knob: 18 },
                large: { width: 52, height: 28, knob: 24 }
            };

            const config = sizes[size] || sizes.normal;
            const transitionDuration = '0.25s';

            container.innerHTML = `
                <div class="bili-speed-switch ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}" 
                     role="switch" 
                     aria-checked="${checked}"
                     tabindex="0">
                    <div class="bili-speed-switch-track">
                        <div class="bili-speed-switch-knob"></div>
                    </div>
                </div>
            `;

            const switchEl = container.querySelector('.bili-speed-switch');
            const trackEl = container.querySelector('.bili-speed-switch-track');

            const baseStyles = `
                display: inline-block;
                vertical-align: middle;
            `;
            container.style.cssText = baseStyles;

            const switchStyles = `
                position: relative;
                display: inline-block;
                width: ${config.width}px;
                height: ${config.height}px;
                cursor: ${disabled ? 'not-allowed' : 'pointer'};
                transition: all ${transitionDuration} ease;
            `;
            switchEl.style.cssText = switchStyles;

            const trackStyles = `
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: #ccc;
                border-radius: ${config.height / 2}px;
                transition: background-color ${transitionDuration} ease;
            `;
            trackEl.style.cssText = trackStyles;

            const knobEl = container.querySelector('.bili-speed-switch-knob');
            const knobSize = config.knob;
            const knobMargin = (config.height - knobSize) / 2;
            const knobStyles = `
                position: absolute;
                top: ${knobMargin}px;
                left: ${knobMargin}px;
                width: ${knobSize}px;
                height: ${knobSize}px;
                background-color: #fff;
                border-radius: 50%;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                transition: transform ${transitionDuration} ease;
            `;
            knobEl.style.cssText = knobStyles;

            if (checked) {
                const translateX = config.width - knobSize - knobMargin * 2;
                knobEl.style.transform = `translateX(${translateX}px)`;
                trackEl.style.backgroundColor = '#00aeec';
            }

            function updateState(newChecked) {
                if (disabled) return;

                const isChecked = newChecked;
                if (isChecked) {
                    switchEl.classList.add('checked');
                    trackEl.style.backgroundColor = '#00aeec';
                    knobEl.style.transform = `translateX(${config.width - knobSize - knobMargin * 2}px)`;
                } else {
                    switchEl.classList.remove('checked');
                    trackEl.style.backgroundColor = '#ccc';
                    knobEl.style.transform = 'translateX(0)';
                }
                switchEl.setAttribute('aria-checked', isChecked);

                if (onChange && typeof onChange === 'function') {
                    onChange(isChecked);
                }
            }

            switchEl.addEventListener('click', () => {
                if (disabled) return;
                const newChecked = !switchEl.classList.contains('checked');
                updateState(newChecked);
            });

            switchEl.addEventListener('keydown', (e) => {
                if (disabled) return;
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const newChecked = !switchEl.classList.contains('checked');
                    updateState(newChecked);
                }
            });

            const switchInstance = {
                element: container,
                getValue: () => container.querySelector('.bili-speed-switch').classList.contains('checked'),
                setValue: (value) => updateState(!!value),
                enable: () => {
                    switchEl.classList.remove('disabled');
                    switchEl.style.cursor = 'pointer';
                },
                disable: () => {
                    switchEl.classList.add('disabled');
                    switchEl.style.cursor = 'not-allowed';
                },
                destroy: () => {
                    container.remove();
                }
            };

            return switchInstance;
        }
    };
})();
