// statusBind.js - 状态绑定逻辑
// 负责将游戏状态绑定到UI元素

const StatusBind = {
  // 初始化状态绑定
  init() {
    this.bindStatusElements();
    
    // 监听状态更新，更新UI显示
    StateSync.addStateUpdateCallback((newState, oldState) => {
      this.updateStatusDisplay(newState, oldState);
    });
    
    // 初始更新状态显示
    const initialState = StateSync.getCurrentState();
    if (initialState) {
      this.updateStatusDisplay(initialState);
    }
    
    console.log('状态绑定系统已初始化');
  },
  
  // 绑定状态元素
  bindStatusElements() {
    // 绑定顶部状态栏元素
    this.bindTopStatusBar();
  },
  
  // 绑定顶部状态栏
  bindTopStatusBar() {
    // 绑定各个状态值的元素
    const statusElements = {
      money: document.getElementById('money-value'),
      particles: document.getElementById('particles-value'),
      land: document.getElementById('land-value'),
      day: document.getElementById('day-value'),
      season: document.getElementById('season-value'),
      weather: document.getElementById('weather-value')
    };
    
    // 保存到实例变量
    this.statusElements = statusElements;
  },
  
  // 更新状态显示
  updateStatusDisplay(newState, oldState) {
    if (!newState) return;
    
    // 更新顶部状态栏
    this.updateTopStatusBar(newState, oldState);
    
    // 更新其他状态相关元素
    this.updateOtherStatusElements(newState, oldState);
  },
  
  // 更新顶部状态栏
  updateTopStatusBar(newState, oldState) {
    if (!this.statusElements) return;
    
    // 更新金钱
    if (this.statusElements.money && 
        (!oldState || oldState.money !== newState.money)) {
      this.updateAnimatedValue(
        this.statusElements.money, 
        oldState?.money || 0, 
        newState.money,
        'money'
      );
    }
    
    // 更新微粒
    if (this.statusElements.particles && 
        (!oldState || oldState.particles !== newState.particles)) {
      this.updateAnimatedValue(
        this.statusElements.particles, 
        oldState?.particles || 0, 
        newState.particles,
        'particles'
      );
    }
    
    // 更新土地
    if (this.statusElements.land && 
        (!oldState || oldState.land !== newState.land)) {
      this.updateStaticValue(
        this.statusElements.land, 
        `${newState.land}亩`,
        `${oldState?.land || 0}亩`
      );
    }
    
    // 更新天数和季节（如果有变化）
    this.updateDayAndSeason(newState, oldState);
  },
  
  // 更新其他状态元素
  updateOtherStatusElements(newState, oldState) {
    // 这里可以添加其他状态元素的更新逻辑
    // 例如：更新数据可视化面板的摘要信息
    this.updateDataVizSummary(newState, oldState);
  },
  
  // 更新数据可视化摘要
  updateDataVizSummary(newState, oldState) {
    // 更新总收益
    const totalEarningsEl = document.getElementById('total-earnings');
    if (totalEarningsEl && 
        (!oldState || oldState.money !== newState.money)) {
      totalEarningsEl.textContent = newState.money || 0;
    }
    
    // 更新活跃天数
    const activeDaysEl = document.getElementById('active-days');
    if (activeDaysEl && 
        (!oldState || oldState.turn !== newState.turn)) {
      activeDaysEl.textContent = newState.turn || 1;
    }
    
    // 更新完成任务数
    const completedTasksEl = document.getElementById('completed-tasks');
    if (completedTasksEl && 
        (!oldState || JSON.stringify(oldState.tasks) !== JSON.stringify(newState.tasks))) {
      const completedCount = this.getCompletedTaskCount(newState.tasks || {});
      completedTasksEl.textContent = completedCount;
    }
  },
  
  // 获取完成任务数
  getCompletedTaskCount(tasks) {
    if (!tasks) return 0;
    
    return Object.values(tasks).filter(task => 
      task.status === 'completed' || 
      (task.progress && task.progress.current >= task.progress.total)
    ).length;
  },
  
  // 更新天数和季节
  updateDayAndSeason(newState, oldState) {
    if (this.statusElements.day && (!oldState || oldState.turn !== newState.turn)) {
      this.statusElements.day.textContent = newState.turn || 1;
    }
    if (this.statusElements.season && (!oldState || oldState.season !== newState.season)) {
      this.statusElements.season.textContent = newState.season || '春季';
    }
    if (this.statusElements.weather && (!oldState || oldState.weather !== newState.weather)) {
      this.statusElements.weather.textContent = newState.weather || '晴朗';
    }
  },
  
  // 更新带动画的数值
  updateAnimatedValue(element, oldValue, newValue, valueType) {
    if (!element) return;
    
    // 如果旧值和新值相同，不执行动画
    if (oldValue === newValue) return;
    
    // 确定动画方向（增加或减少）
    const isIncreasing = newValue > oldValue;
    
    // 添加变化指示类
    element.classList.add(isIncreasing ? 'value-increase' : 'value-decrease');
    
    // 使用动画更新数值
    this.animateValueChange(element, oldValue, newValue, valueType);
    
    // 一段时间后移除动画类
    setTimeout(() => {
      element.classList.remove('value-increase', 'value-decrease');
    }, 1000);
  },
  
  // 更新静态值
  updateStaticValue(element, newValue, oldValue) {
    if (!element) return;
    
    // 如果值没有变化，直接返回
    if (oldValue === newValue) return;
    
    // 直接更新值
    element.textContent = newValue;
  },
  
  // 数值变化动画
  animateValueChange(element, startValue, endValue, valueType) {
    const duration = 800; // 动画持续时间
    const startTime = performance.now();
    
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // 使用缓动函数
      const easeProgress = this.easeOutCubic(progress);
      
      // 计算当前值
      const currentValue = Math.floor(startValue + (endValue - startValue) * easeProgress);
      
      // 更新显示
      if (valueType === 'land') {
        element.textContent = `${currentValue}亩`;
      } else {
        element.textContent = currentValue;
      }
      
      // 继续动画直到完成
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  },
  
  // 缓动函数 - 三次方缓出
  easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  },
  
  // 获取当前状态的副本
  getCurrentStatus() {
    return StateSync.getCurrentState();
  },
  
  // 手动触发状态更新
  refreshStatusDisplay() {
    const currentState = StateSync.getCurrentState();
    if (currentState) {
      this.updateStatusDisplay(currentState);
    }
  }
};

// 导出StatusBind以供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StatusBind;
} else {
  window.StatusBind = StatusBind;
}