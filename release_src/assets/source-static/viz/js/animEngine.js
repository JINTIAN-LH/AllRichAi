// animEngine.js - 动画引擎
// 管理各类动画效果

const AnimEngine = {
  // 动画配置
  config: {
    duration: 300,
    easing: 'ease-out'
  },
  
  // 初始化动画引擎
  init() {
    console.log('动画引擎已初始化');
  },
  
  // 触发动画
  triggerAnimation(type, element, options = {}) {
    switch(type) {
      case 'drag':
        return this.triggerDragAnim(element, options);
      case 'harvest':
        return this.triggerHarvestAnim(element, options);
      case 'plant':
        return this.triggerPlantAnim(element, options);
      case 'collect':
        return this.triggerCollectAnim(element, options);
      case 'upgrade':
        return this.triggerUpgradeAnim(element, options);
      case 'highlight':
        return this.triggerHighlightAnim(element, options);
      case 'pulse':
        return this.triggerPulseAnim(element, options);
      case 'floatUp':
        return this.triggerFloatUpAnim(element, options);
      case 'floatDown':
        return this.triggerFloatDownAnim(element, options);
      default:
        console.warn(`未知动画类型: ${type}`);
        return null;
    }
  },
  
  // 拖拽动画
  triggerDragAnim(element, options = {}) {
    const duration = options.duration || this.config.duration;
    
    element.style.transition = `transform ${duration}ms ${this.config.easing}`;
    element.style.transform = 'scale(1.05)';
    
    // 拖拽结束后恢复
    setTimeout(() => {
      element.style.transform = 'scale(1)';
    }, duration);
    
    return Promise.resolve();
  },
  
  // 收获动画
  triggerHarvestAnim(element, options = {}) {
    const duration = options.duration || this.config.duration;
    const originalOpacity = element.style.opacity || '1';
    const originalTransform = element.style.transform || 'scale(1)';
    
    // 淡出并缩小
    element.style.transition = `all ${duration}ms ${this.config.easing}`;
    element.style.opacity = '0';
    element.style.transform = 'scale(0.8)';
    
    return new Promise(resolve => {
      setTimeout(() => {
        // 恢复原始状态
        element.style.opacity = originalOpacity;
        element.style.transform = originalTransform;
        resolve();
      }, duration);
    });
  },
  
  // 种植动画
  triggerPlantAnim(element, options = {}) {
    const duration = options.duration || this.config.duration;
    
    // 从小到大放大
    element.style.transition = `transform ${duration}ms ${this.config.easing}`;
    element.style.transform = 'scale(1.2)';
    
    return new Promise(resolve => {
      setTimeout(() => {
        element.style.transform = 'scale(1)';
        resolve();
      }, duration);
    });
  },
  
  // 收集动画
  triggerCollectAnim(element, options = {}) {
    const duration = options.duration || this.config.duration;
    const target = options.target || document.body;
    
    if (!target) return Promise.resolve();
    
    // 获取目标位置
    const targetRect = target.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    
    // 计算偏移量
    const offsetX = targetRect.left + targetRect.width/2 - elementRect.left - elementRect.width/2;
    const offsetY = targetRect.top + targetRect.height/2 - elementRect.top - elementRect.height/2;
    
    // 移动到目标位置
    element.style.transition = `transform ${duration}ms ${this.config.easing}`;
    element.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(0)`;
    
    return new Promise(resolve => {
      setTimeout(() => {
        // 隐藏元素
        element.style.display = 'none';
        resolve();
      }, duration);
    });
  },
  
  // 升级动画
  triggerUpgradeAnim(element, options = {}) {
    const duration = options.duration || this.config.duration * 2;
    
    // 闪烁效果
    let step = 0;
    const flashInterval = setInterval(() => {
      element.style.opacity = step % 2 === 0 ? '0.5' : '1';
      step++;
      
      if (step >= 6) { // 闪烁3次
        clearInterval(flashInterval);
        element.style.opacity = '1';
      }
    }, duration / 6);
    
    return new Promise(resolve => {
      setTimeout(() => {
        clearInterval(flashInterval);
        element.style.opacity = '1';
        resolve();
      }, duration);
    });
  },
  
  // 高亮动画
  triggerHighlightAnim(element, options = {}) {
    const duration = options.duration || this.config.duration;
    
    // 添加高亮类
    element.classList.add('highlight');
    
    return new Promise(resolve => {
      setTimeout(() => {
        element.classList.remove('highlight');
        resolve();
      }, duration);
    });
  },
  
  // 脉冲动画
  triggerPulseAnim(element, options = {}) {
    const duration = options.duration || this.config.duration;
    
    // 添加脉冲类
    element.classList.add('pulse');
    
    return new Promise(resolve => {
      setTimeout(() => {
        element.classList.remove('pulse');
        resolve();
      }, duration);
    });
  },
  
  // 上浮动画
  triggerFloatUpAnim(element, options = {}) {
    const duration = options.duration || this.config.duration;
    const distance = options.distance || 20;
    const originalTransform = element.style.transform || 'translateY(0)';
    
    // 向上移动并淡出
    element.style.transition = `all ${duration}ms ${this.config.easing}`;
    element.style.transform = `${originalTransform} translateY(-${distance}px)`;
    element.style.opacity = '0';
    
    return new Promise(resolve => {
      setTimeout(() => {
        element.style.transform = originalTransform;
        element.style.opacity = '1';
        resolve();
      }, duration);
    });
  },
  
  // 下沉动画
  triggerFloatDownAnim(element, options = {}) {
    const duration = options.duration || this.config.duration;
    const distance = options.distance || 20;
    const originalTransform = element.style.transform || 'translateY(0)';
    
    // 向下移动并淡出
    element.style.transition = `all ${duration}ms ${this.config.easing}`;
    element.style.transform = `${originalTransform} translateY(${distance}px)`;
    element.style.opacity = '0';
    
    return new Promise(resolve => {
      setTimeout(() => {
        element.style.transform = originalTransform;
        element.style.opacity = '1';
        resolve();
      }, duration);
    });
  },
  
  // 创建自定义动画
  createCustomAnimation(element, config) {
    const {
      properties = {},
      duration = this.config.duration,
      easing = this.config.easing,
      delay = 0
    } = config;
    
    return new Promise(resolve => {
      setTimeout(() => {
        // 应用变换属性
        element.style.transition = `all ${duration}ms ${easing}`;
        
        // 应用所有属性
        Object.keys(properties).forEach(prop => {
          element.style[prop] = properties[prop];
        });
        
        setTimeout(() => {
          resolve();
        }, duration);
      }, delay);
    });
  }
};

// 导出AnimEngine以供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnimEngine;
} else {
  window.AnimEngine = AnimEngine;
}