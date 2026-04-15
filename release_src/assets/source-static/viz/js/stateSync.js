// stateSync.js - 状态同步管理
// 负责定期从后端获取游戏状态并通知UI更新

const StateSync = {
  // 当前游戏状态
  currentState: null,
  
  // 状态更新回调函数列表
  stateUpdateCallbacks: [],
  
  // 轮询间隔（毫秒）
  POLL_INTERVAL: 2000,
  
  // 轮询定时器
  pollTimer: null,
  
  // 初始化状态同步
  init() {
    this.syncState();
    this.startPolling();
  },
  
  // 开始轮询
  startPolling() {
    this.pollTimer = setInterval(() => {
      this.syncState();
    }, this.POLL_INTERVAL);
  },
  
  // 停止轮询
  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  },
  
  // 同步游戏状态
  async syncState() {
    try {
      const rawState = await EngineBridge.getState();
      // 确保状态结果被规范化
      const normalizedState = EngineBridge.normalizeResult({ state: rawState }).state;
      const newState = (typeof StateMapper !== 'undefined' && StateMapper.map)
        ? StateMapper.map(normalizedState)
        : normalizedState;
      
      // 检查状态是否发生变化
      const hasChanged = this.hasStateChanged(this.currentState, newState);
      
      if (hasChanged) {
        const oldState = this.currentState;
        this.currentState = newState;
        
        // 通知所有订阅者状态已更新
        this.notifyStateUpdate(newState, oldState);
      }
    } catch (error) {
      console.error('同步状态失败:', error);
    }
  },
  
  // 检查状态是否发生变化
  hasStateChanged(oldState, newState) {
    if (!oldState || !newState) return true;
    
    // 比较关键字段
    return (
      oldState.money !== newState.money ||
      oldState.particles !== newState.particles ||
      oldState.land !== newState.land ||
      oldState.turn !== newState.turn ||
      oldState.season !== newState.season ||
      oldState.weather !== newState.weather ||
      JSON.stringify(oldState.farm_plots) !== JSON.stringify(newState.farm_plots) ||
      JSON.stringify(oldState.inventory) !== JSON.stringify(newState.inventory) ||
      JSON.stringify(oldState.tasks) !== JSON.stringify(newState.tasks)
    );
  },

  // 使用后端响应中的 state 直接更新，避免重复请求
  applyState(rawState) {
    const newState = (typeof StateMapper !== 'undefined' && StateMapper.map)
      ? StateMapper.map(rawState)
      : rawState;
    const hasChanged = this.hasStateChanged(this.currentState, newState);
    if (!hasChanged) {
      return;
    }
    const oldState = this.currentState;
    this.currentState = newState;
    this.notifyStateUpdate(newState, oldState);
  },
  
  // 添加状态更新回调
  addStateUpdateCallback(callback) {
    if (typeof callback === 'function') {
      this.stateUpdateCallbacks.push(callback);
    }
  },
  
  // 移除状态更新回调
  removeStateUpdateCallback(callback) {
    const index = this.stateUpdateCallbacks.indexOf(callback);
    if (index > -1) {
      this.stateUpdateCallbacks.splice(index, 1);
    }
  },
  
  // 通知所有订阅者状态已更新
  notifyStateUpdate(newState, oldState) {
    this.stateUpdateCallbacks.forEach(callback => {
      try {
        callback(newState, oldState);
      } catch (error) {
        console.error('执行状态更新回调失败:', error);
      }
    });
  },
  
  // 获取当前状态的副本
  getCurrentState() {
    return this.currentState ? {...this.currentState} : null;
  },
  
  // 手动触发状态同步
  manualSync() {
    this.syncState();
  }
};

// 导出StateSync以供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StateSync;
} else {
  window.StateSync = StateSync;
}