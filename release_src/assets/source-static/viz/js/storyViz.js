// storyViz.js - 剧情可视化交互逻辑

const StoryViz = {
  currentState: null,
  currentChapterId: null,

  init() {
    this.setupTimelineInteractions();
    this.setupDialogInteractions();
    this.setupResultInteractions();

    StateSync.addStateUpdateCallback((newState) => {
      this.updateStoryVisualization(newState);
    });
  },

  setupTimelineInteractions() {
    // 支持桌面端点击事件和移动端触摸事件
    const clickEvent = 'ontouchstart' in window ? 'touchstart' : 'click';
    
    document.querySelectorAll('.volume-btn').forEach((btn) => {
      btn.addEventListener(clickEvent, () => {
        const volume = btn.dataset.volume;
        document.querySelectorAll('.volume-btn').forEach((item) => item.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.volume-section').forEach((section) => {
          section.style.display = section.dataset.volume === volume ? 'block' : 'none';
        });
      });
    });

    document.querySelectorAll('.chapter-node').forEach((node) => {
      node.addEventListener(clickEvent, () => {
        this.openStoryChapter(node.dataset.chapter);
      });
    });
  },

  setupDialogInteractions() {
    // 支持桌面端点击事件和移动端触摸事件
    const clickEvent = 'ontouchstart' in window ? 'touchstart' : 'click';
    
    document.querySelectorAll('.close-dialog').forEach((btn) => {
      btn.addEventListener(clickEvent, () => this.hideDialog());
    });
  },

  setupResultInteractions() {
    // 支持桌面端点击事件和移动端触摸事件
    const clickEvent = 'ontouchstart' in window ? 'touchstart' : 'click';
    
    document.querySelectorAll('.close-result, #accept-result').forEach((btn) => {
      btn.addEventListener(clickEvent, () => this.hideResult());
    });
  },

  updateStoryVisualization(gameState) {
    if (!gameState) return;
    this.currentState = gameState;
    this.updateTimeline(gameState);
  },

  updateTimeline(gameState) {
    const stage = String(gameState.stage || '');
    const stageRules = {
      v1: true,
      v2: stage.includes('公司') || stage.includes('电商') || Number(gameState.turn || 0) >= 8,
      v3: Number(gameState.prosperity || 0) >= 15 || Number(gameState.turn || 0) >= 20,
    };

    document.querySelectorAll('.chapter-node').forEach((node) => {
      const chapter = node.dataset.chapter || '';
      const volumeKey = chapter.slice(0, 2);
      const unlocked = Boolean(stageRules[volumeKey]);
      node.dataset.status = unlocked ? 'available' : 'locked';
      node.classList.toggle('locked', !unlocked);
      const progress = this.getChapterProgress(chapter, gameState);
      const fill = node.querySelector('.progress-fill');
      const text = node.querySelector('.progress-text');
      if (fill) fill.style.width = `${progress}%`;
      if (text) text.textContent = `${progress}%`;
    });
  },

  getChapterProgress(chapterId, gameState) {
    const base = Math.min(100, Math.max(0, Math.floor((Number(gameState.turn || 1) / 30) * 100)));
    if (chapterId.startsWith('v1')) return base;
    if (chapterId.startsWith('v2')) return Math.max(0, base - 30);
    if (chapterId.startsWith('v3')) return Math.max(0, base - 60);
    return 0;
  },

  async openStoryChapter(chapterId) {
    const node = document.querySelector(`.chapter-node[data-chapter="${chapterId}"]`);
    if (node && node.dataset.status === 'locked') {
      return;
    }
    const result = await EngineBridge.getStoryDialog(chapterId);
    if (!result.success || !result.dialog) {
      console.error('打开剧情章节失败:', result.message);
      return;
    }

    this.currentChapterId = chapterId;
    const dialog = result.dialog;
    const panel = document.querySelector('.story-dialog-panel');
    if (!panel) return;

    const avatarEl = panel.querySelector('.character-avatar');
    const nameEl = panel.querySelector('.character-name');
    const statusEl = panel.querySelector('.character-status');
    const textEl = panel.querySelector('.dialog-text');
    const optionsEl = panel.querySelector('.dialog-options');

    if (avatarEl) avatarEl.textContent = dialog.character?.avatar || '👤';
    if (nameEl) nameEl.textContent = dialog.character?.name || '角色';
    if (statusEl) statusEl.textContent = dialog.character?.status || '对话';
    if (textEl) textEl.textContent = dialog.text || '';

    if (optionsEl) {
      optionsEl.innerHTML = '';
      (dialog.options || []).forEach((option, index) => {
        const item = document.createElement('div');
        item.className = 'option-item';
        item.style.cssText = 'padding: 12px; margin-bottom: 8px; background: #e3f2fd; border-radius: 6px; cursor: pointer; transition: background 0.2s;';
        item.innerHTML = `<div class="option-text">${option.text}</div>`;
        item.addEventListener('click', () => this.handleChoice(index, option.text));
        optionsEl.appendChild(item);
      });
    }

    panel.style.display = 'flex';
  },

  async handleChoice(choiceIndex, choiceText) {
    if (!this.currentChapterId) return;
    const result = await EngineBridge.executeStoryChoice(this.currentChapterId, choiceText);
    if (!result.success) {
      console.error('剧情选择执行失败:', result.message);
      return;
    }
    if (result.state && typeof StateSync.applyState === 'function') {
      StateSync.applyState(result.state);
    }
    this.hideDialog();
    this.showResult(result.result_text || '', result.stat_changes || {});
  },

  showResult(text, statChanges) {
    const panel = document.querySelector('.story-result-panel');
    if (!panel) return;

    const textEl = panel.querySelector('.result-text');
    const effectsList = panel.querySelector('.effects-list');
    if (textEl) {
      textEl.textContent = text || '剧情已推进。';
    }
    if (effectsList) {
      effectsList.innerHTML = '';
      Object.entries(statChanges).forEach(([name, value]) => {
        const num = Number(value || 0);
        const effect = document.createElement('div');
        effect.className = 'effect-item';
        effect.style.cssText = 'padding: 8px; margin-bottom: 8px; background: #f0f8ff; border-radius: 4px; display: flex; justify-content: space-between;';
        effect.innerHTML = `<span>${name}</span><span class="effect-change ${num >= 0 ? 'positive' : 'negative'}">${num >= 0 ? '+' : ''}${num}</span>`;
        effectsList.appendChild(effect);
      });
      if (!Object.keys(statChanges).length) {
        effectsList.innerHTML = '<div class="effect-item" style="padding:8px; background:#f0f8ff; border-radius:4px;">本次剧情未引起显著数值变化</div>';
      }
    }

    panel.style.display = 'flex';
  },

  hideDialog() {
    const panel = document.querySelector('.story-dialog-panel');
    if (panel) panel.style.display = 'none';
  },

  hideResult() {
    const panel = document.querySelector('.story-result-panel');
    if (panel) panel.style.display = 'none';
  }
};

// 导出StoryViz以供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StoryViz;
} else {
  window.StoryViz = StoryViz;
}