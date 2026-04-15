// farmInteract.js - 农场交互逻辑

const FarmInteract = {
  selectedPlot: null,
  currentOperation: null,

  init() {
    this.bindEvents();
    this.updatePlotDisplays();
    StateSync.addStateUpdateCallback(() => {
      this.updatePlotDisplays();
    });
    console.log('农场交互系统已初始化');
  },

  bindEvents() {
    // 支持桌面端点击事件和移动端触摸事件
    const clickEvent = 'ontouchstart' in window ? 'touchstart' : 'click';
    
    document.addEventListener(clickEvent, (e) => {
      const plot = e.target.closest('.plot');
      if (plot) {
        this.handlePlotClick(plot);
      }
    });

    document.addEventListener(clickEvent, (e) => {
      if (e.target.id === 'plant-btn') this.setOperation('plant');
      if (e.target.id === 'harvest-btn') this.setOperation('harvest');
      if (e.target.id === 'water-btn') this.setOperation('water');
      if (e.target.id === 'fertilize-btn') this.setOperation('fertilize');
    });
  },

  handlePlotClick(plot) {
    if (!this.currentOperation) {
      this.selectPlot(plot);
      return;
    }
    this.executeOperation(plot.dataset.plotId, this.currentOperation, plot);
  },

  selectPlot(plot) {
    if (this.selectedPlot) {
      this.selectedPlot.classList.remove('selected');
    }
    this.selectedPlot = plot;
    plot.classList.add('selected');
    if (typeof AnimEngine !== 'undefined') {
      AnimEngine.triggerAnimation('highlight', plot);
    }
  },

  setOperation(operation) {
    this.currentOperation = operation;
    this.updateOperationButtons();
    if (this.selectedPlot) {
      this.selectedPlot.classList.remove('selected');
      this.selectedPlot = null;
    }
  },

  updateOperationButtons() {
    const buttons = {
      plant: document.getElementById('plant-btn'),
      harvest: document.getElementById('harvest-btn'),
      water: document.getElementById('water-btn'),
      fertilize: document.getElementById('fertilize-btn')
    };

    Object.keys(buttons).forEach((op) => {
      const btn = buttons[op];
      if (!btn) return;
      btn.classList.toggle('btn-primary', op === this.currentOperation);
      btn.classList.toggle('btn-secondary', op !== this.currentOperation);
    });
  },

  async executeOperation(plotId, operation, plotElement) {
    const actionData = {
      action: operation,
      plot_id: parseInt(plotId, 10),
      turn: StateSync.getCurrentState()?.turn || 1,
    };
    if (operation === 'plant') {
      actionData.seed_type = 'wheat_seed';
    }

    const result = await EngineBridge.executeAction(actionData);
    if (!result.success) {
      this.showTemporaryMessage(result.message || '操作失败', 'error');
      return;
    }

    if (result.state && typeof StateSync.applyState === 'function') {
      StateSync.applyState(result.state);
    }
    this.playOperationAnimation(operation, plotElement);
    this.showTemporaryMessage(result.message || `${operation} 操作成功`, 'success');
    this.clearOperation();
  },

  playOperationAnimation(operation, plot) {
    if (!plot || typeof AnimEngine === 'undefined') return;

    const rect = plot.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    if (operation === 'plant') {
      AnimEngine.triggerAnimation('plant', plot);
      return;
    }
    if (operation === 'harvest') {
      AnimEngine.triggerAnimation('harvest', plot);
      if (typeof ParticleEffect !== 'undefined') {
        ParticleEffect.createHarvestEffect(x, y, { icon: '🌾', count: 8 });
      }
      return;
    }
    if (operation === 'water') {
      AnimEngine.triggerAnimation('pulse', plot);
      return;
    }
    if (operation === 'fertilize') {
      AnimEngine.triggerAnimation('upgrade', plot);
    }
  },

  clearOperation() {
    this.currentOperation = null;
    this.updateOperationButtons();
  },

  updatePlotDisplays() {
    const state = StateSync.getCurrentState();
    if (!state) return;

    const map = {};
    (state.farm_plots || []).forEach((p) => {
      map[String(p.plot_id)] = p;
    });

    document.querySelectorAll('.plot').forEach((plot) => {
      const plotId = plot.dataset.plotId;
      const row = map[plotId] || { status: 'empty', crop_id: '', days_remaining: 0 };
      const status = row.status || 'empty';
      plot.dataset.status = status;
      plot.classList.remove('empty', 'planted', 'mature', 'withered');
      plot.classList.add(status);

      const content = plot.querySelector('.plot-content');
      if (!content) return;

      if (status === 'empty') {
        content.innerHTML = '<div class="plot-icon">🌱</div><div class="plot-action">种植</div>';
        return;
      }

      const icon = status === 'mature' ? '🌾' : '🌱';
      const label = status === 'mature' ? '可收获' : '生长中';
      const dayText = row.days_remaining > 0 ? `剩余${row.days_remaining}天` : '';
      content.innerHTML = `
        <div class="plot-icon">${icon}</div>
        <div class="plot-action">${label}</div>
        <div class="plot-status">${row.crop_id || ''} ${dayText}</div>
      `;
    });
  },

  showTemporaryMessage(message, type = 'info') {
    const msgEl = document.createElement('div');
    msgEl.textContent = message;
    msgEl.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 10px 20px;
      border-radius: 4px;
      color: white;
      font-weight: bold;
      z-index: 1000;
      ${type === 'success' ? 'background: #4CAF50;' : type === 'error' ? 'background: #F44336;' : 'background: #2196F3;'}
    `;
    document.body.appendChild(msgEl);
    setTimeout(() => {
      if (msgEl.parentNode) {
        document.body.removeChild(msgEl);
      }
    }, 1800);
  },
};

// 导出FarmInteract以供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FarmInteract;
} else {
  window.FarmInteract = FarmInteract;
}