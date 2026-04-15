// engineBridge.js - 引擎桥接层
// 负责与后端Flask引擎通信

const EngineBridge = {
  // API基础URL
  baseUrl: '/api/viz',

  async request(path, options = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  },

  normalizeResult(result) {
    const ok = Boolean(result && (result.ok ?? result.success));
    return {
      ...result,
      ok,
      success: ok,
      message: result?.message || '',
    };
  },
  
  // 执行游戏动作
  async executeAction(actionData) {
    try {
      const payload = {
        action: actionData.action,
        params: { ...actionData },
      };
      delete payload.params.action;
      const result = await this.request('/action', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return this.normalizeResult(result);
    } catch (error) {
      console.error('执行动作失败:', error);
      return { success: false, message: error.message };
    }
  },
  
  // 获取游戏状态
  async getState() {
    try {
      const result = await this.request('/state', { method: 'GET' });
      const normalized = this.normalizeResult(result);
      return normalized.state || normalized;
    } catch (error) {
      console.error('获取状态失败:', error);
      throw error;
    }
  },
  
  // 保存游戏
  async saveGame(slot) {
    try {
      const result = await this.request('/slot/save', {
        method: 'POST',
        body: JSON.stringify({ slot }),
      });
      return this.normalizeResult(result);
    } catch (error) {
      console.error('保存游戏失败:', error);
      return { success: false, message: error.message };
    }
  },
  
  // 加载游戏
  async loadGame(slot) {
    try {
      const result = await this.request('/slot/load', {
        method: 'POST',
        body: JSON.stringify({ slot }),
      });
      return this.normalizeResult(result);
    } catch (error) {
      console.error('加载游戏失败:', error);
      return { success: false, message: error.message };
    }
  },

  async deleteGame(slot) {
    try {
      const result = await this.request('/slot/delete', {
        method: 'POST',
        body: JSON.stringify({ slot }),
      });
      return this.normalizeResult(result);
    } catch (error) {
      console.error('删除游戏失败:', error);
      return { success: false, message: error.message };
    }
  },

  async getSaveSlots() {
    const state = await this.getState();
    return state.save_slots || [];
  },
  
  // 获取AI建议
  async getSuggestion(scene, goal) {
    try {
      const result = await this.request('/open/suggest', {
        method: 'POST',
        body: JSON.stringify({ scene, goal }),
      });
      return this.normalizeResult(result);
    } catch (error) {
      console.error('获取建议失败:', error);
      return { success: false, message: error.message, suggestions: [] };
    }
  },
  
  // 执行开放玩法动作
  async executeOpenAction(scene, openAction) {
    try {
      const result = await this.request('/open/play', {
        method: 'POST',
        body: JSON.stringify({
          scene,
          open_action: openAction,
        }),
      });
      return this.normalizeResult(result);
    } catch (error) {
      console.error('执行开放玩法失败:', error);
      return { success: false, message: error.message };
    }
  },

  async getStoryDialog(chapterId) {
    try {
      const result = await this.request('/story/dialog', {
        method: 'POST',
        body: JSON.stringify({ chapter_id: chapterId }),
      });
      return this.normalizeResult(result);
    } catch (error) {
      console.error('获取剧情对话失败:', error);
      return { success: false, message: error.message };
    }
  },

  async executeStoryChoice(chapterId, choiceText) {
    try {
      const result = await this.request('/story/choice', {
        method: 'POST',
        body: JSON.stringify({
          chapter_id: chapterId,
          choice_text: choiceText,
        }),
      });
      return this.normalizeResult(result);
    } catch (error) {
      console.error('执行剧情选择失败:', error);
      return { success: false, message: error.message };
    }
  }
};

// 导出EngineBridge以供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EngineBridge;
} else {
  window.EngineBridge = EngineBridge;
}