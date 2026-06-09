/**
 * UI模块 - 统一导出入口
 *
 * 本模块作为UI层统一导出点，集中管理所有UI组件和行为的导出
 * 便于主应用统一引用和维护
 *
 * @module UI
 */

export { default as CardPanel } from './components/CardPanel.js';
export { default as ControlPanel } from './components/ControlPanel.js';
export { default as Toast } from './components/Toast.js';
export { default as Draggable } from './behaviors/Draggable.js';

export const UIVersion = '3.0.0';

export const UIComponents = {
    CardPanel: 'CardPanel - 信息卡片组件',
    ControlPanel: 'ControlPanel - 控制面板组件',
    Toast: 'Toast - 消息提示组件',
    Draggable: 'Draggable - 拖拽行为'
};

export default {
    CardPanel,
    ControlPanel,
    Toast,
    Draggable,
    UIVersion,
    UIComponents
};