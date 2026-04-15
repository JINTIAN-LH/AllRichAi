// openPlayViz.js - 开放玩法可视化交互逻辑
// 实现输入、建议、推演结果展示

const OpenPlayViz = {
  // 当前选中的建议
  selectedSuggestion: null,
  
  // 初始化开放玩法可视化
  init() {
    this.setupInputInteractions();
    this.setupSuggestionInteractions();
  },
  
  // 设置输入交互
  setupInputInteractions() {
    const input = document.getElementById('open-play-input');
    if (!input) return;
    
    // Enter键提交（需要配合Ctrl键避免意外提交）
    input.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        this.getSuggestions();
      }
    });
    
    // 输入变化时清除结果
    input.addEventListener('input', () => {
      this.clearResult();
    });
  },
  
  // 设置建议交互
  setupSuggestionInteractions() {
    // 交互逻辑在HTML中定义
  },
  
  // 获取AI建议
  async getSuggestions() {
    const input = document.getElementById('open-play-input');
    if (!input) return;
    
    const inputValue = input.value.trim();
    if (!inputValue) {
      this.showError('请输入你的想法或计划');
      return;
    }
    
    // 显示加载状态
    this.showLoadingSuggestions();
    
    try {
      // 构造场景描述
      const scene = this.constructSceneDescription();

      const result = await EngineBridge.getSuggestion(scene, inputValue);
      if (!result.success) {
        throw new Error(result.message || '获取建议失败');
      }

      this.renderSuggestions(result.options || []);
    } catch (error) {
      console.error('获取建议失败:', error);
      this.showError(`获取建议失败: ${error.message}`);
    }
  },

  renderSuggestions(options) {
    const suggestionList = document.getElementById('suggestion-list');
    if (!suggestionList) return;

    suggestionList.innerHTML = '';
    const safeOptions = Array.isArray(options) ? options : [];
    if (safeOptions.length === 0) {
      suggestionList.innerHTML = '<div class="result-placeholder">暂无可用建议，请调整目标后重试。</div>';
      return;
    }

    safeOptions.forEach((optionText, index) => {
      const item = document.createElement('div');
      item.className = 'suggestion-item';
      item.style.cssText = 'padding: 12px; margin: 6px 0; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; transition: all 0.2s; background: #fafafa;';
      item.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>${optionText}</span>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-sm btn-primary" onclick="OpenPlayViz.selectSuggestion(${index})">选择</button>
            <button class="btn btn-sm btn-success" onclick="OpenPlayViz.executeSuggestion(${index})">执行</button>
          </div>
        </div>
      `;
      item.addEventListener('click', () => this.selectSuggestion(index));
      suggestionList.appendChild(item);
    });
  },
  
  // 构造场景描述
  constructSceneDescription() {
    // 从当前游戏状态构造场景描述
    const state = StateSync.currentState;
    if (!state) {
      return '刘家村，一个普通的乡村环境';
    }
    
    return `刘家村，第${state.turn}天，${state.season}，${state.weather}。当前资源：金币${state.money}，微粒${state.particles}，土地${state.land}亩。${state.event_text || '今日无特殊事件'}`;
  },
  
  // 显示加载状态
  showLoadingSuggestions() {
    const suggestionList = document.getElementById('suggestion-list');
    if (!suggestionList) return;
    
    suggestionList.innerHTML = `
      <div class="loading-suggestions" style="padding: 15px; text-align: center; color: #666;">
        <div>🔄 正在获取AI建议...</div>
        <div style="font-size: 0.9em; margin-top: 8px;">分析当前农场状态，提供个性化建议</div>
      </div>
    `;
  },
  
  
  // 选择建议
  selectSuggestion(index) {
    const suggestionList = document.getElementById('suggestion-list');
    if (!suggestionList) return;
    
    const suggestions = Array.from(suggestionList.querySelectorAll('.suggestion-item'));
    if (index >= 0 && index < suggestions.length) {
      // 清除之前的选择样式
      suggestions.forEach(item => {
        item.style.backgroundColor = '#fafafa';
        item.style.borderColor = '#ddd';
      });
      
      // 应用选择样式
      const selectedItem = suggestions[index];
      selectedItem.style.backgroundColor = '#e3f2fd';
      selectedItem.style.borderColor = '#2196f3';
      
      // 更新输入框内容
      const suggestionText = selectedItem.querySelector('span').textContent;
      document.getElementById('open-play-input').value = suggestionText;
      
      this.selectedSuggestion = index;
    }
  },
  
  // 执行选中建议
  async executeSuggestion(index) {
    const suggestionList = document.getElementById('suggestion-list');
    if (!suggestionList) return;
    
    const suggestions = Array.from(suggestionList.querySelectorAll('.suggestion-item'));
    if (index < 0 || index >= suggestions.length) {
      this.showError('请选择一个建议');
      return;
    }
    
    const suggestionText = suggestions[index].querySelector('span').textContent;
    this.executePlan(suggestionText);
  },
  
  // 执行当前计划
  async executePlan(planText) {
    if (!planText || planText.trim() === '') {
      this.showError('请先选择或输入要执行的计划');
      return;
    }
    
    // 显示执行状态
    this.showExecutingPlan();
    
    try {
      // 构造场景描述
      const scene = this.constructSceneDescription();

      const result = await EngineBridge.executeOpenAction(scene, planText);
      if (!result.success) {
        throw new Error(result.message || '执行计划失败');
      }

      this.renderExecutionResult(planText, result);
      if (result.state && typeof StateSync.applyState === 'function') {
        StateSync.applyState(result.state);
      }
    } catch (error) {
      console.error('执行计划失败:', error);
      this.showError(`执行计划失败: ${error.message}`);
    }
  },

  renderExecutionResult(planText, result) {
    const resultPanel = document.getElementById('result-panel');
    if (!resultPanel) return;

    const nextOptions = Array.isArray(result.next_options) ? result.next_options : [];
    const optionsHtml = nextOptions.length
      ? `<div style="margin-top: 10px;"><strong>后续建议:</strong><ul>${nextOptions.map(item => `<li>${item}</li>`).join('')}</ul></div>`
      : '';

    resultPanel.innerHTML = `
      <div class="result-content">
        <div style="margin-bottom: 10px;"><strong>计划:</strong> ${planText}</div>
        <div style="margin-bottom: 8px; white-space: pre-wrap; line-height: 1.6;">${result.message || '已执行。'}</div>
        ${result.stat_delta ? `<div style="padding: 8px; border-radius: 6px; background: #f7f7f7;">${result.stat_delta}</div>` : ''}
        ${optionsHtml}
      </div>
    `;
  },
  
  // 显示执行中状态
  showExecutingPlan() {
    const resultPanel = document.getElementById('result-panel');
    if (!resultPanel) return;
    
    resultPanel.innerHTML = `
      <div class="executing-plan" style="padding: 15px; text-align: center; color: #666;">
        <div>🔄 正在执行计划...</div>
        <div style="font-size: 0.9em; margin-top: 8px;">模拟计划执行过程，分析可能结果</div>
      </div>
    `;
  },
  
  // 清除结果
  clearResult() {
    const resultPanel = document.getElementById('result-panel');
    if (resultPanel) {
      resultPanel.innerHTML = '<div class="result-placeholder">执行计划后将显示可能的结果和影响</div>';
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

// 导出OpenPlayViz以供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OpenPlayViz;
} else {
  window.OpenPlayViz = OpenPlayViz;
}