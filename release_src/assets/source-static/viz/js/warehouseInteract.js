// warehouseInteract.js - 仓库交互逻辑
// 处理仓库相关的用户交互

const WarehouseInteract = {
  // 当前激活的标签页
  activeTab: 'seeds',
  
  // 初始化仓库交互
  init() {
    this.bindEvents();
    this.switchTab(this.activeTab);
    
    // 监听状态更新，更新仓库显示
    StateSync.addStateUpdateCallback((newState, oldState) => {
      this.updateWarehouseDisplay(newState, oldState);
    });
    
    console.log('仓库交互系统已初始化');
  },
  
  // 绑定事件
  bindEvents() {
    // 支持桌面端点击事件和移动端触摸事件
    const clickEvent = 'ontouchstart' in window ? 'touchstart' : 'click';
    
    // 标签页切换事件
    document.addEventListener(clickEvent, (e) => {
      const tabBtn = e.target.closest('.tab-btn');
      if (tabBtn) {
        const tabName = tabBtn.dataset.tab;
        if (tabName) {
          this.switchTab(tabName);
        }
      }
    });
    
    // 物品使用事件
    document.addEventListener(clickEvent, (e) => {
      const useBtn = e.target.closest('.use-item');
      if (useBtn) {
        const itemCard = e.target.closest('.item-card');
        if (itemCard) {
          const itemId = itemCard.dataset.itemId;
          const itemType = itemCard.dataset.itemType;
          this.useItem(itemId, itemType);
        }
      }
    });
    
    // 物品出售事件
    document.addEventListener(clickEvent, (e) => {
      const sellBtn = e.target.closest('.sell-item');
      if (sellBtn) {
        const itemCard = e.target.closest('.item-card');
        if (itemCard) {
          const itemId = itemCard.dataset.itemId;
          const itemType = itemCard.dataset.itemType;
          this.sellItem(itemId, itemType);
        }
      }
    });
  },
  
  // 切换标签页
  switchTab(tabName) {
    // 验证标签页名称
    const validTabs = ['seeds', 'crops', 'tools'];
    if (!validTabs.includes(tabName)) {
      console.warn(`无效的标签页: ${tabName}`);
      return;
    }
    
    // 更新按钮状态
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // 显示对应的面板
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === `${tabName}-pane`);
    });
    
    // 保存当前激活的标签页
    this.activeTab = tabName;
    
    // 更新该标签页的内容
    this.updateTabContent(tabName);
  },
  
  // 更新标签页内容
  updateTabContent(tabName) {
    const state = StateSync.getCurrentState();
    if (!state || !state.inventory) return;
    
    const pane = document.getElementById(`${tabName}-pane`);
    if (!pane) return;
    
    const itemGrid = pane.querySelector('.item-grid');
    if (!itemGrid) return;
    
    // 清空当前内容
    itemGrid.innerHTML = '';
    
    // 根据标签页类型过滤物品
    const items = this.filterItemsByType(state.inventory, tabName);
    
    // 生成物品卡片
    items.forEach(item => {
      const itemCard = this.createItemCard(item, tabName);
      itemGrid.appendChild(itemCard);
    });
    
    // 如果没有物品，显示占位符
    if (items.length === 0) {
      const placeholder = document.createElement('div');
      placeholder.className = 'item-card placeholder';
      placeholder.style.cssText = 'text-align: center; padding: 20px; color: #999; grid-column: 1 / -1;';
      placeholder.textContent = `暂无${this.getItemTypeName(tabName)}`;
      itemGrid.appendChild(placeholder);
    }
  },
  
  // 按类型过滤物品
  filterItemsByType(inventory, type) {
    if (!inventory) return [];
    
    const typeMap = {
      seeds: ['seed', 'seeds', 'wheat_seed', 'corn_seed', 'rice_seed'], // 种子类型
      crops: ['crop', 'crops', 'wheat', 'corn', 'rice', 'vegetable'], // 作物类型
      tools: ['tool', 'tools', 'watering_can', 'fertilizer', 'equipment'] // 工具类型
    };
    
    const validTypes = typeMap[type] || [];
    
    return Object.entries(inventory)
      .filter(([itemId, itemData]) => {
        // 检查物品类型
        return validTypes.some(validType => 
          itemId.includes(validType) || 
          (itemData.type && validTypes.includes(itemData.type))
        );
      })
      .map(([itemId, itemData]) => ({
        id: itemId,
        name: itemData.name || this.getItemDisplayName(itemId),
        count: itemData.count || itemData.quantity || 0,
        type: itemData.type || this.inferItemType(itemId),
        icon: itemData.icon || this.getItemIcon(itemId),
        price: itemData.price || this.getItemPrice(itemId)
      }));
  },
  
  // 推断物品类型
  inferItemType(itemId) {
    if (itemId.includes('seed')) return 'seed';
    if (itemId.includes('crop') || itemId.includes('_')) return 'crop';
    return 'item';
  },
  
  // 获取物品显示名称
  getItemDisplayName(itemId) {
    const nameMap = {
      'wheat_seed': '小麦种子',
      'corn_seed': '玉米种子',
      'rice_seed': '水稻种子',
      'wheat': '小麦',
      'corn': '玉米',
      'rice': '大米',
      'watering_can': '水桶',
      'fertilizer': '化肥'
    };
    
    return nameMap[itemId] || itemId.replace('_', ' ');
  },
  
  // 获取物品类型名称
  getItemTypeName(type) {
    const nameMap = {
      seeds: '种子',
      crops: '作物',
      tools: '工具'
    };
    
    return nameMap[type] || type;
  },
  
  // 获取物品图标
  getItemIcon(itemId) {
    const iconMap = {
      'wheat_seed': '🌾',
      'corn_seed': '🌽',
      'rice_seed': '🍚',
      'wheat': '🌾',
      'corn': '🌽',
      'rice': '🍚',
      'watering_can': '🪣',
      'fertilizer': '🧪'
    };
    
    return iconMap[itemId] || '📦';
  },
  
  // 获取物品价格
  getItemPrice(itemId) {
    const priceMap = {
      'wheat': 10,
      'corn': 15,
      'rice': 12,
      'wheat_seed': 5,
      'corn_seed': 7,
      'rice_seed': 6
    };
    
    return priceMap[itemId] || 0;
  },
  
  // 创建物品卡片
  createItemCard(item, tabName) {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.dataset.itemId = item.id;
    card.dataset.itemType = item.type;
    
    // 根据标签页类型决定按钮
    let buttonHtml = '';
    if (tabName === 'seeds' || tabName === 'tools') {
      buttonHtml = `<button class="btn btn-sm btn-primary use-item">使用</button>`;
    } else if (tabName === 'crops') {
      buttonHtml = `<button class="btn btn-sm btn-success sell-item">出售 (${item.price}/个)</button>`;
    }
    
    card.innerHTML = `
      <div class="item-icon">${item.icon}</div>
      <div class="item-name">${item.name}</div>
      <div class="item-count">数量: <span class="count">${item.count}</span></div>
      ${buttonHtml}
    `;
    
    return card;
  },
  
  // 使用物品
  async useItem(itemId, itemType) {
    try {
      // 验证物品是否可使用
      if (!this.canUseItem(itemId, itemType)) {
        alert('该物品无法使用！');
        return;
      }
      
      // 准备动作数据
      const actionData = {
        action: 'use_item',
        item_id: itemId,
        item_type: itemType,
        turn: StateSync.getCurrentState()?.turn || 1
      };
      
      // 执行使用操作
      const result = await EngineBridge.executeAction(actionData);
      
      if (result.success) {
        // 使用成功，更新显示
        this.updateAfterUse(itemId, result);
        
        // 播放使用动画
        this.playUseAnimation(itemId);
        
        // 显示成功消息
        this.showUseFeedback(itemId, result);
      } else {
        // 使用失败，显示错误
        this.showUseError(itemId, result);
      }
    } catch (error) {
      console.error(`使用物品失败:`, error);
      alert(`使用物品失败: ${error.message}`);
    }
  },
  
  // 出售物品
  async sellItem(itemId, itemType) {
    try {
      // 验证物品是否可出售
      if (!this.canSellItem(itemId, itemType)) {
        alert('该物品无法出售！');
        return;
      }
      
      // 获取物品价格
      const itemPrice = this.getItemPrice(itemId);
      if (!itemPrice || itemPrice <= 0) {
        alert('该物品无法出售！');
        return;
      }
      
      // 准备动作数据
      const actionData = {
        action: 'sell_item',
        item_id: itemId,
        item_type: itemType,
        quantity: 1, // 默认出售1个
        turn: StateSync.getCurrentState()?.turn || 1
      };
      
      // 执行出售操作
      const result = await EngineBridge.executeAction(actionData);
      
      if (result.success) {
        // 出售成功，更新显示
        this.updateAfterSell(itemId, result);
        
        // 播放出售动画
        this.playSellAnimation(itemId);
        
        // 显示成功消息
        this.showSellFeedback(itemId, result);
      } else {
        // 出售失败，显示错误
        this.showSellError(itemId, result);
      }
    } catch (error) {
      console.error(`出售物品失败:`, error);
      alert(`出售物品失败: ${error.message}`);
    }
  },
  
  // 验证是否可使用物品
  canUseItem(itemId, itemType) {
    // 在实际实现中，会检查玩家是否有足够物品等
    return true;
  },
  
  // 验证是否可出售物品
  canSellItem(itemId, itemType) {
    // 在实际实现中，会检查物品是否可出售
    return itemType === 'crop' || itemId.includes('crop');
  },
  
  // 使用后更新显示
  updateAfterUse(itemId, result) {
    // 更新对应标签页的内容
    const tabName = this.getTabByItemType(itemId);
    if (tabName) {
      this.updateTabContent(tabName);
    }
  },
  
  // 出售后更新显示
  updateAfterSell(itemId, result) {
    // 更新所有标签页的内容（因为出售可能影响多个地方的显示）
    ['seeds', 'crops', 'tools'].forEach(tab => {
      this.updateTabContent(tab);
    });
    
    // 更新状态栏
    if (typeof StatusBind !== 'undefined') {
      StatusBind.updateStatusDisplay(StateSync.getCurrentState());
    }
  },
  
  // 播放使用动画
  playUseAnimation(itemId) {
    const itemCard = document.querySelector(`.item-card[data-item-id="${itemId}"]`);
    if (itemCard) {
      // 触发使用动画
      AnimEngine.triggerAnimation('highlight', itemCard);
    }
  },
  
  // 播放出售动画
  playSellAnimation(itemId) {
    const itemCard = document.querySelector(`.item-card[data-item-id="${itemId}"]`);
    if (itemCard) {
      // 触发出售动画
      AnimEngine.triggerAnimation('collect', itemCard, {
        target: document.querySelector('.status-item .status-value[id*="money"]') || document.body
      });
      
      // 出售粒子效果
      const rect = itemCard.getBoundingClientRect();
      ParticleEffect.createRewardEffect(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        { icon: '💰', count: 5 }
      );
    }
  },
  
  // 显示使用反馈
  showUseFeedback(itemId, result) {
    const itemName = this.getItemDisplayName(itemId);
    const feedbackMsg = `成功使用 ${itemName}！`;
    this.showTemporaryMessage(feedbackMsg, 'success');
  },
  
  // 显示出售反馈
  showSellFeedback(itemId, result) {
    const itemName = this.getItemDisplayName(itemId);
    const price = this.getItemPrice(itemId);
    const feedbackMsg = `成功出售 ${itemName}，获得 ${price} 金币！`;
    this.showTemporaryMessage(feedbackMsg, 'success');
  },
  
  // 显示使用错误
  showUseError(itemId, result) {
    const itemName = this.getItemDisplayName(itemId);
    const errorMsg = result.message || `使用 ${itemName} 失败！`;
    this.showTemporaryMessage(errorMsg, 'error');
  },
  
  // 显示出售错误
  showSellError(itemId, result) {
    const itemName = this.getItemDisplayName(itemId);
    const errorMsg = result.message || `出售 ${itemName} 失败！`;
    this.showTemporaryMessage(errorMsg, 'error');
  },
  
  // 根据物品ID获取对应的标签页
  getTabByItemType(itemId) {
    if (itemId.includes('seed')) return 'seeds';
    if (itemId.includes('crop')) return 'crops';
    if (itemId.includes('tool')) return 'tools';
    return null;
  },
  
  // 更新仓库显示
  updateWarehouseDisplay(newState, oldState) {
    // 检查库存是否发生变化
    if (oldState && 
        JSON.stringify(newState.inventory) !== JSON.stringify(oldState.inventory)) {
      // 更新当前激活的标签页
      this.updateTabContent(this.activeTab);
    }
  },
  
  // 显示临时消息
  showTemporaryMessage(message, type = 'info') {
    // 创建临时消息元素
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
      ${type === 'success' ? 'background: #4CAF50;' : 
        type === 'error' ? 'background: #F44336;' : 
        'background: #2196F3;'}
    `;
    
    document.body.appendChild(msgEl);
    
    // 2秒后移除消息
    setTimeout(() => {
      if (msgEl.parentNode) {
        document.body.removeChild(msgEl);
      }
    }, 2000);
  }
};

// 导出WarehouseInteract以供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WarehouseInteract;
} else {
  window.WarehouseInteract = WarehouseInteract;
}