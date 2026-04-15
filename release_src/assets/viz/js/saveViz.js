// saveViz.js - 存档可视化交互逻辑
// 实现存档槽位的可视化展示、保存、读取、删除操作

const SaveViz = {
  // 初始化存档可视化
  init() {
    this.loadSaveSlots();
    this.setupSaveInteractions();
  },
  
  // 加载存档槽位
  async loadSaveSlots() {
    try {
      const slots = await EngineBridge.getSaveSlots();
      this.renderSaveSlots(slots || []);
    } catch (error) {
      console.error('加载存档槽位失败:', error);
      this.showError(`加载存档失败: ${error.message}`);
      this.renderSaveSlots([]);
    }
  },
  
  // 渲染存档槽位
  renderSaveSlots(slots) {
    const container = document.getElementById('save-slots-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    slots.forEach(slot => {
      const title = slot.exists ? `槽位 ${slot.slot}` : '空槽位';
      const dayLabel = slot.exists ? '可读取进度' : '-';
      const updated = slot.updated
        ? new Date(slot.updated * 1000).toLocaleString('zh-CN', { hour12: false })
        : '';
      const slotElement = document.createElement('div');
      slotElement.className = `save-slot ${slot.exists ? 'occupied' : 'empty'}`;
      slotElement.dataset.slot = slot.slot;
      
      slotElement.innerHTML = `
        <div class="save-thumbnail">
          <div class="thumbnail-icon">${slot.exists ? '💾' : '📦'}</div>
        </div>
        <div class="save-info">
          <div class="save-title">${title}</div>
          <div class="save-day">${dayLabel}</div>
        </div>
        <div class="save-stats">
          <div class="save-money">${slot.exists ? '已占用' : '未使用'}</div>
          <div class="save-time">${updated}</div>
        </div>
        <div class="save-actions">
          ${slot.exists ? `
            <button class="btn btn-primary" onclick="SaveViz.loadSlot(${slot.slot})">读取</button>
            <button class="btn btn-warning" onclick="SaveViz.deleteSlot(${slot.slot})">删除</button>
          ` : `
            <button class="btn btn-success" onclick="SaveViz.saveSlot(${slot.slot})">保存</button>
          `}
        </div>
      `;
      
      container.appendChild(slotElement);
    });
  },
  
  // 设置存档交互
  setupSaveInteractions() {
    // 这里可以添加额外的交互逻辑
    // 目前主要通过HTML中的onclick事件处理
  },
  
  // 保存到指定槽位
  async saveSlot(slot) {
    if (!confirm(`确定要保存到第${slot}号存档吗？这将覆盖原有存档。`)) {
      return;
    }
    
    try {
      const result = await EngineBridge.saveGame(slot);
      if (result.success) {
        this.showSuccess(`存档已保存到第${slot}号槽位`);
        this.loadSaveSlots();
      } else {
        this.showError(`保存失败: ${result.message || '未知错误'}`);
      }
    } catch (error) {
      console.error('保存存档失败:', error);
      this.showError(`保存失败: ${error.message}`);
    }
  },
  
  // 从指定槽位读取
  async loadSlot(slot) {
    if (!confirm(`确定要从第${slot}号存档读取吗？当前进度将丢失。`)) {
      return;
    }
    
    try {
      const result = await EngineBridge.loadGame(slot);
      if (result.success) {
        this.showSuccess('存档读取成功，正在刷新状态...');
        if (result.state && typeof StateSync.applyState === 'function') {
          StateSync.applyState(result.state);
        }
        setTimeout(() => {
          this.loadSaveSlots();
        }, 800);
      } else {
        this.showError(`读取失败: ${result.message || '未知错误'}`);
      }
    } catch (error) {
      console.error('读取存档失败:', error);
      this.showError(`读取失败: ${error.message}`);
    }
  },
  
  // 删除指定槽位
  async deleteSlot(slot) {
    if (!confirm(`确定要删除第${slot}号存档吗？此操作不可撤销。`)) {
      return;
    }
    
    try {
      const result = await EngineBridge.deleteGame(slot);
      if (result.success) {
        this.showSuccess(`第${slot}号存档已删除`);
        this.loadSaveSlots();
      } else {
        this.showError(`删除失败: ${result.message || '未知错误'}`);
      }
    } catch (error) {
      console.error('删除存档失败:', error);
      this.showError(`删除失败: ${error.message}`);
    }
  },
  
  // 显示成功消息
  showSuccess(message) {
    // 创建临时提示元素
    const feedback = document.createElement('div');
    feedback.textContent = message;
    feedback.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(76, 175, 80, 0.9);
      color: white;
      padding: 10px 20px;
      border-radius: 4px;
      z-index: 1001;
      animation: fadeOut 2s forwards;
    `;
    
    // 添加淡出动画样式
    if (!document.querySelector('#feedback-animation')) {
      const style = document.createElement('style');
      style.id = 'feedback-animation';
      style.textContent = `
        @keyframes fadeOut {
          0% { opacity: 1; top: 20px; }
          100% { opacity: 0; top: 0px; }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(feedback);
    
    // 2秒后移除元素
    setTimeout(() => {
      if (feedback.parentNode) {
        document.body.removeChild(feedback);
      }
    }, 2000);
  },
  
  // 显示错误
  showError(message) {
    // 创建临时错误提示元素
    const feedback = document.createElement('div');
    feedback.textContent = message;
    feedback.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(244, 67, 54, 0.9);
      color: white;
      padding: 10px 20px;
      border-radius: 4px;
      z-index: 1001;
    `;
    
    document.body.appendChild(feedback);
    
    // 3秒后移除元素
    setTimeout(() => {
      if (feedback.parentNode) {
        document.body.removeChild(feedback);
      }
    }, 3000);
    
    console.error(message);
  }
};

// 导出SaveViz以供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SaveViz;
} else {
  window.SaveViz = SaveViz;
}