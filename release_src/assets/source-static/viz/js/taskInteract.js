// taskInteract.js - 任务交互逻辑
// 处理任务相关的用户交互

const TaskInteract = {
  // 初始化任务交互
  init() {
    this.bindEvents();
    this.updateTaskDisplay();
    
    // 监听状态更新，更新任务显示
    StateSync.addStateUpdateCallback((newState, oldState) => {
      this.updateTaskDisplay(newState, oldState);
    });
    
    console.log('任务交互系统已初始化');
  },
  
  // 绑定事件
  bindEvents() {
    // 支持桌面端点击事件和移动端触摸事件
    const clickEvent = 'ontouchstart' in window ? 'touchstart' : 'click';
    
    // 任务完成事件
    document.addEventListener(clickEvent, (e) => {
      const completeBtn = e.target.closest('.complete-task');
      if (completeBtn) {
        const taskItem = e.target.closest('.task-item');
        if (taskItem) {
          const taskId = taskItem.dataset.taskId;
          this.completeTask(taskId);
        }
      }
    });
  },
  
  // 更新任务显示
  updateTaskDisplay(newState, oldState) {
    const state = newState || StateSync.getCurrentState();
    if (!state) return;
    
    // 更新任务列表
    this.updateTaskList(state.tasks || {});
  },
  
  // 更新任务列表
  updateTaskList(tasks) {
    const taskList = document.querySelector('.task-list');
    if (!taskList) return;
    
    // 清空当前任务列表
    taskList.innerHTML = '';
    
    // 如果没有任务，显示占位符
    if (!tasks || Object.keys(tasks).length === 0) {
      const placeholder = document.createElement('div');
      placeholder.className = 'task-item placeholder';
      placeholder.style.cssText = 'text-align: center; padding: 20px; color: #999;';
      placeholder.textContent = '暂无任务';
      taskList.appendChild(placeholder);
      return;
    }
    
    // 生成任务项
    Object.entries(tasks).forEach(([taskId, taskData]) => {
      const taskItem = this.createTaskItem(taskId, taskData);
      taskList.appendChild(taskItem);
    });
  },
  
  // 创建任务项
  createTaskItem(taskId, taskData) {
    const taskItem = document.createElement('div');
    taskItem.className = 'task-item';
    taskItem.dataset.taskId = taskId;
    taskItem.dataset.status = taskData.status || 'available';
    
    // 计算任务进度
    const progress = this.calculateTaskProgress(taskData);
    const progressPercent = Math.min(100, Math.round((progress.current / progress.total) * 100));
    
    taskItem.innerHTML = `
      <div class="task-header">
        <div class="task-title">${taskData.name || taskData.title || taskId}</div>
        <div class="task-reward">${this.formatTaskRewards(taskData.rewards || taskData.reward || {})}</div>
      </div>
      <div class="task-desc">${taskData.description || taskData.desc || '任务描述'}</div>
      <div class="task-progress">
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${progressPercent}%"></div>
        </div>
        <div class="progress-text">${progress.current}/${progress.total}</div>
      </div>
      ${this.getTaskActionButton(taskData)}
    `;
    
    return taskItem;
  },
  
  // 计算任务进度
  calculateTaskProgress(taskData) {
    // 在实际实现中，这里会根据任务类型和条件计算进度
    // 简化处理：返回示例进度
    if (taskData.progress) {
      return {
        current: taskData.progress.current || 0,
        total: taskData.progress.total || 1
      };
    }
    
    // 默认返回一些示例数据
    return {
      current: taskData.current || 0,
      total: taskData.total || 1
    };
  },
  
  // 格式化任务奖励
  formatTaskRewards(rewards) {
    if (!rewards) return '💰+0';
    
    let rewardText = '';
    
    // 金币奖励
    if (rewards.money || rewards.gold || rewards.coins) {
      const amount = rewards.money || rewards.gold || rewards.coins;
      rewardText += `💰+${amount} `;
    }
    
    // 经验奖励
    if (rewards.exp || rewards.experience) {
      const amount = rewards.exp || rewards.experience;
      rewardText += `⭐+${amount} `;
    }
    
    // 物品奖励
    if (rewards.items || rewards.goods) {
      const items = rewards.items || rewards.goods;
      if (Array.isArray(items)) {
        items.forEach(item => {
          rewardText += `${item.icon || '🎁'}+${item.amount || 1} `;
        });
      }
    }
    
    return rewardText.trim() || '🎁奖励';
  },
  
  // 获取任务操作按钮
  getTaskActionButton(taskData) {
    const status = taskData.status || 'available';
    
    switch(status) {
      case 'completed':
        return '<button class="btn btn-sm btn-success completed">已完成</button>';
      case 'locked':
        return '<button class="btn btn-sm btn-secondary" disabled>锁定</button>';
      case 'in_progress':
        return '<button class="btn btn-sm btn-primary complete-task">完成</button>';
      case 'available':
      default:
        // 检查是否可以完成
        if (this.canCompleteTask(taskData)) {
          return '<button class="btn btn-sm btn-primary complete-task">完成</button>';
        } else {
          return '<button class="btn btn-sm btn-secondary" disabled>进行中</button>';
        }
    }
  },
  
  // 检查是否可以完成任务
  canCompleteTask(taskData) {
    // 在实际实现中，这里会检查任务完成条件
    // 简化处理：如果进度达到总数则可完成
    const progress = this.calculateTaskProgress(taskData);
    return progress.current >= progress.total;
  },
  
  // 完成任务
  async completeTask(taskId) {
    try {
      // 验证任务是否可以完成
      if (!this.canTaskBeCompleted(taskId)) {
        alert('任务还未完成！');
        return;
      }
      
      // 准备动作数据
      const actionData = {
        action: 'complete_task',
        task_id: taskId,
        turn: StateSync.getCurrentState()?.turn || 1
      };
      
      // 执行完成任务操作
      const result = await EngineBridge.executeAction(actionData);
      
      if (result.success) {
        // 完成成功，更新显示
        this.updateAfterCompletion(taskId, result);
        
        // 播放完成动画
        this.playCompletionAnimation(taskId);
        
        // 显示成功消息
        this.showCompletionFeedback(taskId, result);
      } else {
        // 完成失败，显示错误
        this.showCompletionError(taskId, result);
      }
    } catch (error) {
      console.error(`完成任务失败:`, error);
      alert(`完成任务失败: ${error.message}`);
    }
  },
  
  // 检查任务是否可以完成
  canTaskBeCompleted(taskId) {
    const state = StateSync.getCurrentState();
    if (!state || !state.tasks) return false;
    
    const task = state.tasks[taskId];
    if (!task) return false;
    
    // 检查任务状态和进度
    return this.canCompleteTask(task);
  },
  
  // 完成后更新显示
  updateAfterCompletion(taskId, result) {
    // 重新获取最新的任务状态
    setTimeout(() => {
      const state = StateSync.getCurrentState();
      if (state && state.tasks) {
        this.updateTaskList(state.tasks);
      }
    }, 500); // 延迟更新，等待状态同步
  },
  
  // 播放完成动画
  playCompletionAnimation(taskId) {
    const taskItem = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
    if (taskItem) {
      // 触发完成动画
      AnimEngine.triggerAnimation('upgrade', taskItem);
      
      // 完成粒子效果
      const rect = taskItem.getBoundingClientRect();
      ParticleEffect.createUpgradeEffect(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        { icon: '⭐', count: 10 }
      );
    }
  },
  
  // 显示完成反馈
  showCompletionFeedback(taskId, result) {
    // 在实际实现中，这里会显示具体的奖励信息
    const feedbackMsg = `任务完成！获得了奖励！`;
    this.showTemporaryMessage(feedbackMsg, 'success');
  },
  
  // 显示完成错误
  showCompletionError(taskId, result) {
    const errorMsg = result.message || `完成任务失败！`;
    this.showTemporaryMessage(errorMsg, 'error');
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

// 导出TaskInteract以供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TaskInteract;
} else {
  window.TaskInteract = TaskInteract;
}