// stateMapper.js - 将后端状态映射为可视化前端稳定结构

const StateMapper = {
  map(rawState) {
    if (!rawState || typeof rawState !== 'object') {
      return this.defaultState();
    }

    // 处理嵌套的state对象（如果API返回了嵌套结构）
    const actualState = rawState.state || rawState;

    const inventory = this.mapInventory(actualState.inventory);
    const tasks = this.mapTasks(actualState.tasks);
    const farmPlots = this.mapFarmPlots(actualState.farm_plots);
    const saveSlots = this.mapSaveSlots(actualState.save_slots);

    return {
      ...actualState,
      money: Number(actualState.money || actualState.snapshot?.money || 0),
      particles: Number(actualState.particles || actualState.snapshot?.particles || 0),
      land: Number(actualState.land || actualState.snapshot?.land || 0),
      turn: Number(actualState.turn || actualState.day || actualState.snapshot?.turn || actualState.snapshot?.day || 1),
      day: Number(actualState.day || actualState.turn || actualState.snapshot?.day || actualState.snapshot?.turn || 1),
      season: String(actualState.season || actualState.snapshot?.season || '初夏'),
      weather: String(actualState.weather || actualState.snapshot?.weather || '晴朗'),
      inventory,
      tasks,
      farm_plots: farmPlots,
      save_slots: saveSlots,
    };
  },

  mapInventory(inventory) {
    if (!inventory || typeof inventory !== 'object') {
      return {};
    }

    const mapped = {};
    
    // 如果inventory是数组，转换为对象
    if (Array.isArray(inventory)) {
      inventory.forEach(item => {
        if (item && typeof item === 'object' && item.id) {
          const count = Number(item.count ?? item.quantity ?? 0);
          mapped[item.id] = {
            id: item.id,
            name: item.name || item.id,
            count,
            quantity: count,
            type: item.type || 'item',
            price: Number(item.price || 0),
            icon: item.icon || null,
          };
        }
      });
    } else if (typeof inventory === 'object') {
      // 如果inventory是对象，直接映射
      Object.entries(inventory).forEach(([itemId, itemData]) => {
        // 检查是否已经是映射后的格式
        if (typeof itemData === 'string') {
          // 如果是字符串（如PowerShell输出中的对象引用），尝试解析
          try {
            itemData = JSON.parse(itemData);
          } catch {
            itemData = { id: itemId, name: itemId, count: 0, quantity: 0, type: 'item', price: 0 };
          }
        }
        
        const row = itemData && typeof itemData === 'object' ? itemData : {};
        const count = Number(row.count ?? row.quantity ?? 0);
        mapped[itemId] = {
          id: itemId,
          name: row.name || itemId,
          count,
          quantity: count,
          type: row.type || 'item',
          price: Number(row.price || 0),
          icon: row.icon || null,
        };
      });
    }

    return mapped;
  },

  mapTasks(tasks) {
    if (!tasks || typeof tasks !== 'object') {
      return {};
    }

    const mapped = {};

    // 如果tasks是数组，转换为对象
    if (Array.isArray(tasks)) {
      tasks.forEach(task => {
        if (task && typeof task === 'object' && task.task_id) {
          mapped[task.task_id] = {
            task_id: task.task_id,
            name: task.name || task.title || task.task_id,
            title: task.title || task.name || task.task_id,
            description: task.description || '',
            status: task.status || 'available',
            progress: task.progress || { current: 0, total: 1 },
            rewards: task.rewards || {},
          };
        }
      });
    } else if (typeof tasks === 'object') {
      // 如果tasks是对象，直接映射
      Object.entries(tasks).forEach(([taskId, taskData]) => {
        // 检查是否已经是映射后的格式
        if (typeof taskData === 'string') {
          // 如果是字符串（如PowerShell输出中的对象引用），尝试解析
          try {
            taskData = JSON.parse(taskData);
          } catch {
            taskData = { task_id: taskId, name: taskId, title: taskId, description: '', status: 'available', progress: { current: 0, total: 1 }, rewards: {} };
          }
        }

        const row = taskData && typeof taskData === 'object' ? taskData : {};
        mapped[taskId] = {
          task_id: taskId,
          name: row.name || row.title || taskId,
          title: row.title || row.name || taskId,
          description: row.description || '',
          status: row.status || 'available',
          progress: row.progress || { current: 0, total: 1 },
          rewards: row.rewards || {},
        };
      });
    }

    return mapped;
  },

  mapFarmPlots(farmPlots) {
    if (!farmPlots || !Array.isArray(farmPlots)) {
      return [];
    }

    return farmPlots.map(plot => ({
      plot_id: plot.plot_id || plot.id || 0,
      crop_id: plot.crop_id || plot.cropId || null,
      days_remaining: Number(plot.days_remaining || plot.daysRemaining || 0),
      ready_to_harvest: Boolean(plot.ready_to_harvest || plot.readyToHarvest || false),
      status: plot.status || (plot.ready_to_harvest ? 'mature' : (plot.crop_id ? 'planted' : 'empty')),
    }));
  },

  mapSaveSlots(saveSlots) {
    if (!saveSlots || !Array.isArray(saveSlots)) {
      return [];
    }

    return saveSlots.map(slot => ({
      slot: slot.slot || 0,
      exists: Boolean(slot.exists),
      updated: slot.updated || null,
    }));
  },

  defaultState() {
    return {
      money: 0,
      particles: 0,
      land: 10,
      turn: 1,
      day: 1,
      season: '初夏',
      weather: '晴朗',
      inventory: {},
      tasks: {},
      farm_plots: [],
      save_slots: [],
    };
  },
};