// stateSync.js - 状态同步管理
// 负责定期从后端获取游戏状态并通知UI更新

const StateSync = {
  // 当前游戏状态
  currentState: null,

  // 连续失败次数（用于触发玩家可见的连接提示）
  consecutiveFailures: 0,
  
  // 状态更新回调函数列表
  stateUpdateCallbacks: [],
  
  // 轮询间隔（毫秒）
  POLL_INTERVAL: 2000,

  // 连续失败达到阈值后暂停自动轮询，避免接口404时刷屏
  MAX_FAILURES_BEFORE_PAUSE: 3,

  // 同类错误日志节流窗口（毫秒）
  ERROR_LOG_THROTTLE_MS: 15000,
  
  // 轮询定时器
  pollTimer: null,

  // 当前是否处于暂停轮询状态
  pollPaused: false,

  // 错误日志节流状态
  _lastErrorSignature: '',
  _lastErrorLogAt: 0,

  // 同步请求并发锁，避免初始化和轮询重叠导致重复请求
  isSyncInProgress: false,
  
  // 初始化状态同步
  init() {
    this.pollPaused = false;
    this.syncState();
    this.startPolling();
  },
  
  // 开始轮询
  startPolling() {
    if (this.pollTimer) {
      return;
    }
    if (this.pollPaused) {
      return;
    }
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
    if (this.pollPaused || this.isSyncInProgress) {
      return;
    }

    this.isSyncInProgress = true;

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

      this.consecutiveFailures = 0;
      this.pollPaused = false;
      this.hideConnectionHelper();
    } catch (error) {
      this.consecutiveFailures += 1;

      const isEndpointUnavailable =
        typeof EngineBridge !== 'undefined' &&
        typeof EngineBridge.isEndpointUnavailableError === 'function' &&
        EngineBridge.isEndpointUnavailableError(error);

      if (isEndpointUnavailable) {
        this.pollPaused = true;
        this.stopPolling();
      } else if (this.consecutiveFailures >= this.MAX_FAILURES_BEFORE_PAUSE) {
        this.pollPaused = true;
        this.stopPolling();
      }

      this.showConnectionHelper(error);
      this.logSyncError(error);
    } finally {
      this.isSyncInProgress = false;
    }
  },

  logSyncError(error) {
    const message = String(error && error.message ? error.message : error || '未知错误');
    const signature = message;
    const now = Date.now();
    const isSameError = this._lastErrorSignature === signature;
    const withinThrottleWindow = now - this._lastErrorLogAt < this.ERROR_LOG_THROTTLE_MS;
    if (isSameError && withinThrottleWindow) {
      return;
    }
    this._lastErrorSignature = signature;
    this._lastErrorLogAt = now;
    console.error('同步状态失败:', error);
  },

  ensureConnectionHelper() {
    if (this.connectionHelperEl) {
      return this.connectionHelperEl;
    }

    const wrapper = document.createElement('div');
    wrapper.id = 'viz-connection-helper';
    wrapper.style.cssText = [
      'display:none',
      'position:fixed',
      'left:12px',
      'right:12px',
      'bottom:64px',
      'z-index:2200',
      'background:#fff7ed',
      'border:1px solid #fdba74',
      'border-radius:10px',
      'box-shadow:0 6px 20px rgba(0,0,0,.12)',
      'padding:10px 12px',
      'font-size:13px',
      'line-height:1.5',
      'color:#7c2d12',
    ].join(';');

    const showDebugTools = Boolean(
      typeof EngineBridge !== 'undefined' &&
      typeof EngineBridge.isDebugApiConfigEnabled === 'function' &&
      EngineBridge.isDebugApiConfigEnabled()
    );

    wrapper.innerHTML = `
      <div style="font-weight:700;margin-bottom:6px;">网络连接异常</div>
      <div id="viz-connection-helper-detail" style="margin-bottom:8px;">正在尝试重新连接服务器，请稍后重试。</div>
      <div style="display:flex;gap:8px;align-items:center;">
        <button id="viz-retry-sync" type="button" style="border:none;background:#ea580c;color:#fff;padding:7px 12px;border-radius:6px;cursor:pointer;">立即重试</button>
        <button id="viz-close-helper" type="button" style="border:1px solid #fdba74;background:#fff;color:#9a3412;padding:7px 10px;border-radius:6px;cursor:pointer;">先继续离线浏览</button>
      </div>
      <div style="margin-top:8px;color:#9a3412;">如持续失败，请稍后刷新页面。</div>
      ${showDebugTools ? `
      <details style="margin-top:8px;">
        <summary style="cursor:pointer;color:#9a3412;">调试: API 地址配置</summary>
        <label for="viz-api-base-input" style="display:block;margin:6px 0 4px;color:#9a3412;">后端 API 地址（可填域名或完整 /api/viz）</label>
        <div style="display:flex;gap:8px;align-items:center;">
          <input id="viz-api-base-input" type="text" placeholder="例如: https://your-backend.example.com" style="flex:1;min-width:0;border:1px solid #fb923c;border-radius:6px;padding:7px 8px;" />
          <button id="viz-api-base-save" type="button" style="border:none;background:#b45309;color:#fff;padding:7px 10px;border-radius:6px;cursor:pointer;">保存地址</button>
        </div>
      </details>` : ''}
    `;

    document.body.appendChild(wrapper);

    const retryBtn = wrapper.querySelector('#viz-retry-sync');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        if (this.pollPaused) {
          this.pollPaused = false;
          this.startPolling();
        }
        this.syncState();
      });
    }

    const closeBtn = wrapper.querySelector('#viz-close-helper');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.hideConnectionHelper();
      });
    }

    const saveBtn = wrapper.querySelector('#viz-api-base-save');
    const input = wrapper.querySelector('#viz-api-base-input');
    if (saveBtn && input) {
      saveBtn.addEventListener('click', () => {
        const value = String(input.value || '').trim();
        EngineBridge.setConfiguredBaseUrl(value, true);
        this.consecutiveFailures = 0;
        this.syncState();
      });
    }

    this.connectionHelperEl = wrapper;
    return wrapper;
  },

  showConnectionHelper(error) {
    if (this.consecutiveFailures < 2) {
      return;
    }

    const helper = this.ensureConnectionHelper();
    const detail = helper.querySelector('#viz-connection-helper-detail');
    const input = helper.querySelector('#viz-api-base-input');

    if (detail) {
      const errText = String(error && error.message ? error.message : error || '未知错误');
      const pausedHint = this.pollPaused ? '。已暂停自动轮询，请检查 API 地址后点击“立即重试”。' : '';
      detail.textContent = `状态同步已连续失败 ${this.consecutiveFailures} 次：${errText}${pausedHint}`;
    }

    if (input && !input.value) {
      const configured = EngineBridge.getConfiguredBaseUrl();
      const currentValue = configured || (typeof window !== 'undefined' ? window.location.origin : '');
      input.value = currentValue;
    }

    helper.style.display = 'block';
  },

  hideConnectionHelper() {
    if (!this.connectionHelperEl) {
      return;
    }
    this.connectionHelperEl.style.display = 'none';
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