// engineBridge.js - 引擎桥接层
// 负责与后端Flask引擎通信

const EngineBridge = {
  // API基础URL
  baseUrl: '/api/viz',
  _resolvedBaseUrl: null,

  normalizeBaseUrl(baseUrl) {
    const raw = String(baseUrl || '').trim();
    if (!raw) {
      return '';
    }

    const trimmed = raw.replace(/\/+$/, '');
    if (trimmed.endsWith('/api/viz')) {
      return trimmed;
    }

    // Support configuring only backend origin, then append canonical API prefix.
    return `${trimmed}/api/viz`;
  },

  resolveConfiguredBaseUrl() {
    if (this._resolvedBaseUrl !== null) {
      return this._resolvedBaseUrl;
    }

    let configured = '';

    if (typeof window !== 'undefined') {
      const globalBase = window.__FARMGAME_API_BASE__;
      if (globalBase) {
        configured = String(globalBase);
      }

      if (!configured && window.localStorage) {
        const cached = window.localStorage.getItem('farmgame_api_base');
        if (cached) {
          configured = cached;
        }
      }

      if (!configured) {
        const query = new URLSearchParams(window.location.search);
        const fromQuery = query.get('api_base');
        if (fromQuery) {
          configured = fromQuery;
          if (window.localStorage) {
            window.localStorage.setItem('farmgame_api_base', fromQuery);
          }
        }
      }
    }

    this._resolvedBaseUrl = this.normalizeBaseUrl(configured);
    return this._resolvedBaseUrl;
  },

  getConfiguredBaseUrl() {
    return this.resolveConfiguredBaseUrl();
  },

  isDebugApiConfigEnabled() {
    if (typeof window === 'undefined') {
      return false;
    }

    try {
      const query = new URLSearchParams(window.location.search);
      if (query.get('debug_api') === '1') {
        return true;
      }
    } catch (error) {
      // Ignore malformed URL/search edge cases and treat as non-debug.
    }

    if (window.localStorage && window.localStorage.getItem('farmgame_debug_api') === '1') {
      return true;
    }

    return Boolean(window.__FARMGAME_DEBUG_API__);
  },

  setConfiguredBaseUrl(baseUrl, persist = true) {
    const normalized = this.normalizeBaseUrl(baseUrl);
    this._resolvedBaseUrl = normalized;

    if (persist && typeof window !== 'undefined' && window.localStorage) {
      if (normalized) {
        window.localStorage.setItem('farmgame_api_base', normalized);
      } else {
        window.localStorage.removeItem('farmgame_api_base');
      }
    }

    return normalized;
  },

  getCandidateBaseUrls() {
    const candidates = [];
    const configured = this.resolveConfiguredBaseUrl();
    if (configured) {
      candidates.push(configured);
    }
    candidates.push(this.baseUrl);

    return Array.from(new Set(candidates.map((item) => this.normalizeBaseUrl(item)).filter(Boolean)));
  },

  async request(path, options = {}) {
    const requestOptions = {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    };
    const requestMethod = String(requestOptions.method || 'GET').toUpperCase();
    const candidates = this.getCandidateBaseUrls();

    let lastError = null;
    for (let i = 0; i < candidates.length; i += 1) {
      const candidate = candidates[i];
      const isLast = i === candidates.length - 1;
      try {
        const response = await fetch(`${candidate}${path}`, requestOptions);
        if (!response.ok) {
          // 404 usually indicates wrong API base in static deployments, try fallback candidates.
          if (response.status === 404 && !isLast) {
            continue;
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        if (this.baseUrl !== candidate) {
          this.baseUrl = candidate;
        }
        return response.json();
      } catch (error) {
        lastError = error;
        if (!isLast && requestMethod === 'GET') {
          continue;
        }
        if (!isLast && String(error?.message || '').includes('HTTP error! status: 404')) {
          continue;
        }
        throw error;
      }
    }

    throw lastError || new Error('Request failed');
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