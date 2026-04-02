// 导入控制器类
import VideoSpeedController from './VideoSpeedController.js';
import RightContainerController from './RightContainerController.js';
import LeftContainerController from './LeftContainerController.js';
import { globalVariables } from './global.js';

// 创建并导出控制器实例
let videoController = null;
let rightContainerController = null;
let leftContainerController = null;

// 初始化函数
function initVideoSpeedController(options) {
    if (!videoController) {
        // 初始化全局变量
        globalVariables.initGlobalVariables();
        
        // 视频速度控制器
        videoController = new VideoSpeedController(options);
        
        // 右侧容器控制器
        rightContainerController = new RightContainerController();
        
        // 左侧容器控制器（速度提示）
        leftContainerController = new LeftContainerController();
        
        // 示例：添加扩展功能
        // const likeFeature = new LikeFeature(videoController);
        // likeFeature.enable();
        
        // const favoriteFeature = new FavoriteFeature(videoController);
        // favoriteFeature.enable();
    }
    return videoController;
}

// 自动初始化（当页面加载完成时）
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initVideoSpeedController();
    });
} else {
    initVideoSpeedController();
}

// 导出到全局作用域，方便调试
window.VideoSpeedController = VideoSpeedController;
window.RightContainerController = RightContainerController;
window.LeftContainerController = LeftContainerController;
window.videoController = videoController;
window.rightContainerController = rightContainerController;
window.leftContainerController = leftContainerController;