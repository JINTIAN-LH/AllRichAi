// 静态可视化界面主模块
(function() {
  'use strict';

  // 获取引擎实例
  const app = window.AllRichStaticApp;
  const gameModule = window.AllRichGameEngine;
  if (!app || !gameModule) {
    console.error('Missing required global objects: AllRichStaticApp or AllRichGameEngine');
    return;
  }

  const { StaticGameEngine, gameData } = gameModule;

  // 获取引擎实例 - 优先使用 app 中已初始化的实例，否则自己创建
  function getEngine() {
    if (app && app.getEngine) {
      return app.getEngine();
    }
    // 仅在 app 未就绪时兜底显示空引擎
    return StaticGameEngine.newGame();
  }
  const uiState = window.uiState || {};

  // 设置元素文本内容的辅助函数
  function setText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = text;
    }
  }

  // 执行操作并提交结果的辅助函数
  function commit(message) {
    app.showFlash(message || "操作执行完成");
    setTimeout(() => {
      renderAllModules(getEngine());
    }, 100);
  }

  async function runVizAction(action, params = {}) {
    const payload = await app.runVizAction(action, params);
    commit(payload && payload.message ? payload.message : "操作执行完成");
    return payload;
  }

  // 设置抽屉状态
  function setDrawerState(targetId, open) {
    const body = document.getElementById(targetId);
    if (!body) return;
    body.classList.toggle("is-open", open);
    const toggle = document.querySelector(`.viz-drawer-toggle[data-drawer-target="${targetId}"]`);
    if (toggle) {
      const label = toggle.querySelector('em');
      if (label) {
        label.textContent = open ? '收起' : '展开';
      }
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
  }

  // 切换抽屉
  function toggleDrawer(targetId) {
    const body = document.getElementById(targetId);
    if (!body) return;
    const isOpen = body.classList.contains("is-open");
    setDrawerState(targetId, !isOpen);
  }

  // 渲染可视化顶部指标卡片
  function renderMetrics(engine) {
    if (!engine) return;
    const snapshot = engine.statusSnapshot();
    setText("viz-stage-label", snapshot.stage);
    setText("viz-company-label", snapshot.company);
    setText("viz-event-label", snapshot.events || "暂无事件");
    setText("viz-money", snapshot.money);
    setText("viz-particles", snapshot.particle);
    setText("viz-energy", snapshot.energy);
    setText("viz-prosperity", snapshot.prosperity);
    setText("viz-support", snapshot.villagerSupport);
    setText("viz-brand", snapshot.brand);
    setText("viz-farm-caption", `${snapshot.season} · ${snapshot.weather} · 当前可播种 ${Object.keys(engine.availableCrops()).length} 种作物`);
  }

  // 渲染作物选择下拉框
  function renderCropSelect(engine) {
    if (!engine) return;
    const select = document.getElementById("viz-crop-select");
    if (!select) return;
    const current = select.value;
    const cropIds = Object.keys(engine.availableCrops());
    select.innerHTML = cropIds.map((cropId) => {
      const crop = gameData.CROPS[cropId];
      return `<option value="${cropId}">${crop.name} / 成本 ${crop.seed_cost}</option>`;
    }).join("");
    if (cropIds.includes(current)) {
      select.value = current;
    }
  }

  // 渲染养殖选择下拉框
  function renderLivestockSelect(engine) {
    if (!engine) return;
    const select = document.getElementById("viz-livestock-select");
    if (!select) return;
    const current = select.value;
    const livestockMap = engine.availableLivestock();
    const ids = Object.keys(livestockMap);
    if (!ids.length) {
      select.innerHTML = '<option value="">当前阶段暂无可养殖品种</option>';
      return;
    }
    select.innerHTML = ids.map((id) => `<option value="${id}">${livestockMap[id]}</option>`).join("");
    if (ids.includes(current)) {
      select.value = current;
    }
  }

  // 渲染配方选择下拉框
  function renderRecipeSelect(engine) {
    if (!engine) return;
    const select = document.getElementById("viz-recipe-select");
    if (!select) return;
    const current = select.value;
    const recipeMap = engine.availableRecipes();
    const ids = Object.keys(recipeMap);
    if (!ids.length) {
      select.innerHTML = '<option value="">未解锁加工配方</option>';
      return;
    }
    select.innerHTML = ids.map((id) => `<option value="${id}">${recipeMap[id]}</option>`).join("");
    if (ids.includes(current)) {
      select.value = current;
    }
  }

  // 渲染农场地块
  function renderFarm(engine) {
    if (!engine) return;
    // 重建 farm drawer body 结构：保留 toolbar + 地块网格
    const body = document.getElementById("viz-farm-body");
    if (!body) return;

    // 保留 toolbar 结构，避免被摧毁
    if (!body.querySelector(".viz-card-head")) {
      body.innerHTML = `
        <div class="viz-card-head">
          <div>
            <p id="viz-farm-caption">用同一套静态引擎状态驱动地块成熟、收获与推进。</p>
          </div>
          <div class="viz-toolbar">
            <label class="viz-inline-field">播种作物
              <select id="viz-crop-select"></select>
            </label>
            <button id="viz-advance-day" class="viz-btn accent" type="button">推进一天</button>
          </div>
        </div>
        <div class="viz-toolbar">
          <button id="viz-harvest-all" class="viz-btn ghost" type="button">一键收获</button>
          <button id="viz-collect-products" class="viz-btn ghost" type="button">收取养殖</button>
          <button id="viz-sell-market" class="viz-btn accent" type="button">集市销售</button>
          <button id="viz-sell-stream" class="viz-btn accent" type="button">直播销售</button>
        </div>
        <div id="viz-farm-grid" class="viz-farm-grid"></div>
      `;
    }

    // 重新获取 grid 元素（innerHTML 替换后 root 已失效）
    const gridEl = document.getElementById("viz-farm-grid");
    if (!gridEl) return;
    gridEl.innerHTML = engine.state.plots.map((plot) => {
      const crop = plot.crop_id ? gameData.CROPS[plot.crop_id] : null;
      const plotClass = plot.ready_to_harvest ? "ready" : (plot.crop_id ? "growing" : "empty");
      const statusText = plot.ready_to_harvest ? "可收获" : (plot.crop_id ? `剩余 ${plot.days_remaining} 天` : "空闲");
      const action = plot.ready_to_harvest ? "harvest" : (plot.crop_id ? "story" : "plant");
      const actionLabel = plot.ready_to_harvest ? "一键收获" : (plot.crop_id ? "跳去剧情页" : "在此播种");
      const note = plot.ready_to_harvest
        ? `这块地上的 ${crop.name} 已成熟。当前会调用主静态引擎的收获逻辑。`
        : plot.crop_id
          ? `${crop.name} 正在生长，成熟后库存会同步反映到主页与可视化页。`
          : "点击后按当前选择的作物直接播种。";
      return `
        <article class="viz-plot-card ${plotClass}" data-plot-id="${plot.plot_id}">
          <div class="viz-plot-top">
            <span class="viz-plot-index">地块 ${plot.plot_id}</span>
            <span class="viz-plot-status">${statusText}</span>
          </div>
          <div class="viz-plot-crop">${crop ? crop.name : "待播种地块"}</div>
          <div class="viz-plot-note">${note}</div>
          <button class="viz-plot-action" data-plot-id="${plot.plot_id}" data-plot-action="${action}" type="button">${actionLabel}</button>
        </article>
      `;
    }).join("");
  }

  // 渲染养殖栏
  function renderRanch(engine) {
    if (!engine) return;
    const body = document.getElementById("viz-ranch-body");
    const root = document.getElementById("viz-ranch-grid");
    if (!root) return;

    // 保留 toolbar 结构，避免被摧毁
    if (body && !body.querySelector(".viz-card-head")) {
      body.innerHTML = `
        <div class="viz-card-head">
          <div>
            <p id="viz-ranch-caption">护栏容量与养殖状态。</p>
          </div>
          <div class="viz-toolbar">
            <label class="viz-inline-field">养殖品种
              <select id="viz-livestock-select"></select>
            </label>
            <button id="viz-ranch-expand" class="viz-btn ghost" type="button">扩栏 +1</button>
            <button id="viz-ranch-collect" class="viz-btn accent" type="button">收取产物</button>
          </div>
        </div>
        <div id="viz-ranch-grid" class="viz-ranch-grid"></div>
      `;
    }

    // 重新获取 root（可能被 innerHTML 替换后变化）
    const gridEl = document.getElementById("viz-ranch-grid");
    if (!gridEl) return;
    gridEl.innerHTML = engine.state.pens.map((pen) => {
      const livestock = pen.livestock_id ? gameData.LIVESTOCKS[pen.livestock_id] : null;
      const penClass = pen.ready_to_collect ? "ready" : (pen.livestock_id ? "active" : "empty");
      const statusText = pen.ready_to_collect ? "可收取" : (pen.livestock_id ? `周期 ${pen.days_remaining} 天` : "空栏");
      const action = pen.ready_to_collect ? "collect" : (pen.livestock_id ? "story" : "raise");
      const actionLabel = pen.ready_to_collect ? "收取产物" : (pen.livestock_id ? "跳去剧情页" : "投放养殖");
      const note = pen.ready_to_collect
        ? `这个棚舍的 ${livestock ? livestock.name : '生物'} 产出了 ${livestock ? livestock.product_amount : 0} 份 ${livestock ? (gameData.ITEMS[livestock.product_item_id]?.name || livestock.product_item_id) : '产物'}。`
        : pen.livestock_id
          ? `${livestock.name} 正在养殖，周期结束后产出。`
          : "点击后按当前选择的品种投放养殖。";
      return `
        <article class="viz-pen-card ${penClass}" data-pen-id="${pen.pen_id}">
          <div class="viz-pen-top">
            <span class="viz-pen-index">棚舍 ${pen.pen_id}</span>
            <span class="viz-pen-status">${statusText}</span>
          </div>
          <div class="viz-pen-livestock">${livestock ? livestock.name : "待投放"}</div>
          <div class="viz-pen-note">${note}</div>
          <button class="viz-pen-action" data-pen-id="${pen.pen_id}" data-pen-action="${action}" type="button">${actionLabel}</button>
        </article>
      `;
    }).join("");
  }

  // 渲染加工列表
  function renderProcess(engine) {
    if (!engine) return;
    const body = document.getElementById("viz-process-body");
    const root = document.getElementById("viz-process-list");
    if (!root) return;

    // 重建 process drawer body 结构：保留 toolbar + 配方列表
    if (body && !body.querySelector(".viz-card-head")) {
      body.innerHTML = `
        <div class="viz-card-head">
          <div>
            <p id="viz-process-caption">加工坊状态与配方。</p>
          </div>
          <div class="viz-toolbar">
            <label class="viz-inline-field">加工配方
              <select id="viz-recipe-select"></select>
            </label>
            <label class="viz-inline-field">批次
              <select id="viz-batches-select">
                <option value="1">1批</option>
                <option value="2">2批</option>
                <option value="3">3批</option>
                <option value="5">5批</option>
                <option value="10">10批</option>
              </select>
            </label>
            <button id="viz-process-run" class="viz-btn accent" type="button">执行加工</button>
            <button id="viz-workshop-upgrade" class="viz-btn ghost" type="button">升级加工坊</button>
          </div>
        </div>
        <div id="viz-process-list" class="viz-process-list"></div>
      `;
    }

    // 重新获取 root（可能被 innerHTML 替换后变化）
    const listEl = document.getElementById("viz-process-list");
    if (!listEl) return;
    const recipes = gameData.RECIPES || {};
    const unlocked = engine.availableRecipes();
    const workshopLevel = (engine.state.company && engine.state.company.workshop_level) || 1;
    const captionEl = document.getElementById("viz-process-caption");
    if (captionEl) {
      captionEl.textContent = `加工坊 Lv.${workshopLevel}，已开放 ${Object.keys(unlocked).length} 个配方。`;
    }
    const rows = Object.keys(unlocked).map((recipeId) => {
      const row = recipes[recipeId] || { name: recipeId, inputs: {}, output_item_id: "", output_amount: 0, processing_fee: 0 };
      const inputText = Object.keys(row.inputs || {}).map((itemId) => {
        const label = gameData.ITEMS && gameData.ITEMS[itemId] ? gameData.ITEMS[itemId].name : itemId;
        return `${label} x${row.inputs[itemId]}`;
      }).join("、") || "无";
      const outputLabel = gameData.ITEMS && gameData.ITEMS[row.output_item_id] ? gameData.ITEMS[row.output_item_id].name : row.output_item_id;
      return `
        <article class="viz-process-item">
          <div class="viz-process-item-head">
            <strong>${row.name}</strong>
            <span class="viz-muted">工费 ${row.processing_fee}</span>
          </div>
          <p class="viz-muted">原料：${inputText}</p>
          <p class="viz-muted">产物：${outputLabel} x${row.output_amount}</p>
        </article>
      `;
    });
    const processContent = rows.length ? rows.join("") : '<div class="viz-process-item"><strong>尚未解锁加工配方</strong><p class="viz-muted">先在系统技能中解锁"农产品加工坊"。</p></div>';
    listEl.innerHTML = processContent;
  }

  // 渲染订单列表
  function renderOrders(engine) {
    if (!engine) return;
    const root = document.getElementById("viz-orders-list");
    if (!root) return;
    const orders = engine.state.orders || [];
    root.innerHTML = orders.map((order) => {
      const fulfilled = order.fulfilled || 0;
      const progress = Math.min(100, Math.round((fulfilled / order.amount) * 100));
      return `
        <article class="viz-order-item">
          <div class="viz-order-item-head">
            <strong>${order.name}</strong>
            <span class="viz-muted">x${order.amount}</span>
          </div>
          <div class="viz-progress">
            <div class="viz-progress-bar" style="width:${progress}%"></div>
          </div>
          <p class="viz-muted">已履约 ${fulfilled}/${order.amount} · 奖励 ${order.reward_money}</p>
          <div class="viz-order-item-actions">
            <button class="viz-btn accent" data-order-id="${order.order_id}" type="button">履约 +${Math.min(order.amount - fulfilled, 1)}</button>
          </div>
        </article>
      `;
    }).join("");
  }

  // 渲染公司治理
  function renderCompany(engine) {
    if (!engine) return;
    const root = document.getElementById("viz-company-list");
    if (!root) return;
    const company = engine.state.company || {};
    root.innerHTML = `
      <article class="viz-company-item">
        <div class="viz-company-item-head">
          <strong>${company.name || "未注册公司"}</strong>
          <span class="viz-muted">Lv.${company.level || 0}</span>
        </div>
        <p class="viz-muted">品牌热度 ${company.brand_score || 0} · 员工 ${company.employees || 0}</p>
        <p class="viz-muted">利润池 ${company.profit_pool || 0} · 工厂等级 ${company.factory_level || 0}</p>
        <div class="viz-order-item-actions">
          <button class="viz-btn" data-company-action="prepare" type="button">成立公司</button>
          <button class="viz-btn" data-company-action="hire" type="button">雇佣 1 名村民</button>
          <button class="viz-btn accent" data-company-action="dividend" type="button">执行分红</button>
        </div>
      </article>
    `;
  }

  // 渲染合作伙伴
  function renderPartnership(engine) {
    if (!engine) return;
    const root = document.getElementById("viz-partnership-list");
    if (!root) return;
    const partnerships = engine.state.partnerships || {};
    root.innerHTML = Object.keys(partnerships).map((partner) => {
      const p = partnerships[partner];
      return `
        <article class="viz-partner-item">
          <div class="viz-partner-item-head">
            <strong>${p.name}</strong>
            <span class="viz-muted">Lv.${p.level}</span>
          </div>
          <p class="viz-muted">源能 ${p.energy} · 关系 ${p.relationship}</p>
          <div class="viz-order-item-actions">
            <button class="viz-btn" data-partner="${partner}" type="button">投入 10 源能</button>
          </div>
        </article>
      `;
    }).join("");
  }

  // 渲染角色互动
  function renderCharacters(engine) {
    if (!engine) return;
    const root = document.getElementById("viz-character-list");
    if (!root) return;
    const characters = engine.state.characters || {};
    root.innerHTML = Object.keys(characters).map((charId) => {
      const char = characters[charId];
      return `
        <article class="viz-character-item">
          <div class="viz-character-item-head">
            <strong>${char.name}</strong>
            <span class="viz-muted">${char.role}</span>
          </div>
          <p class="viz-muted">${char.relationship} 关系 · ${char.engagement}% 参与度</p>
          <div class="viz-order-item-actions">
            <button class="viz-btn" data-character-id="${charId}" type="button">互动</button>
          </div>
        </article>
      `;
    }).join("");
  }

  // 渲染库存
  function renderInventory(engine) {
    if (!engine) return;
    const root = document.getElementById("viz-inventory-list");
    if (!root) return;
    const inventory = engine.state.inventory || {};
    root.innerHTML = Object.keys(inventory).map((itemId) => {
      const item = gameData.ITEMS[itemId];
      const amount = inventory[itemId];
      if (!item) return '';
      return `
        <article class="viz-inventory-item">
          <div class="viz-inventory-item-head">
            <strong>${item.name}</strong>
            <span class="viz-muted">x${amount}</span>
          </div>
          <p class="viz-muted">${item.category || '未知分类'} · 单价 ${item.sell_price}</p>
        </article>
      `;
    }).join("");
  }

  // 渲染任务
  function renderTasks(engine) {
    if (!engine) return;
    const root = document.getElementById("viz-task-list");
    if (!root) return;
    const tasks = engine.state.tasks || [];
    root.innerHTML = tasks.map((task) => {
      return `
        <article class="viz-task-item ${task.completed ? 'completed' : ''}">
          <div class="viz-task-item-head">
            <strong>${task.title}</strong>
            <span class="viz-muted">${task.completed ? '已完成' : '进行中'}</span>
          </div>
          <p class="viz-muted">${task.description}</p>
          <p class="viz-muted">奖励: ${task.reward_desc}</p>
          ${task.completed ? '' : `<button class="viz-btn accent" data-task-id="${task.task_id}" type="button">完成任务</button>`}
        </article>
      `;
    }).join("");
  }

  // 渲染故事时间线
  function renderStoryTimeline(engine) {
    if (!engine) return;
    const root = document.getElementById("viz-story-timeline");
    if (!root) return;
    root.innerHTML = '<p>故事时间线内容将在这里显示</p>';
  }

  // 渲染故事面板
  function renderStoryPanel(engine) {
    if (!engine) return;
    const root = document.getElementById("viz-story-panel");
    if (!root) return;
    root.innerHTML = '<p>故事面板内容将在这里显示</p>';
  }

  // 渲染开放玩法
  function renderOpenMode(engine) {
    if (!engine) return;
    const root = document.getElementById("viz-open-suggestions");
    if (!root) return;
    const options = engine.state.open_mode.profile_saved
      ? (engine.state.open_mode.last_options.length ? engine.state.open_mode.last_options : ["请先完成主角设定，再生成行动建议。"])
      : ["请先完成主角设定，再生成行动建议。"];
    root.innerHTML = options.map(opt => `<div class="viz-open-option">${opt}</div>`).join("");

    // 显示上次执行结果
    const resultEl = document.getElementById("viz-open-result");
    if (resultEl && engine.state.last_story_result) {
      resultEl.textContent = engine.state.last_story_result;
    }
  }

  // 渲染技能模块
  function renderSkills(engine) {
    if (!engine) return;
    const root = document.getElementById("viz-skills-list");
    if (!root) return;
    const skills = engine.availableSkills();
    const stageLabels = { startup: "躺平起步", scale_up: "产业升级", common_prosperity: "共同富裕" };
    const stageRank = { startup: 0, scale_up: 1, common_prosperity: 2 };
    const currentStageRank = stageRank[engine.state.stage] || 0;
    const sourceEnergy = Number(engine.state.resources.source_energy || 0);

    root.innerHTML = skills.map(entry => {
      const skill = entry.definition;
      const stageOk = (stageRank[skill.required_stage] || 0) <= currentStageRank;
      const energyOk = sourceEnergy >= Number(skill.energy_cost || 0);
      const canUnlock = !entry.unlocked && stageOk && energyOk;
      const stateText = entry.unlocked
        ? "已解锁"
        : `解锁条件：${stageLabels[skill.required_stage] || skill.required_stage}，源能≥${skill.energy_cost}`;
      return `
        <article class="viz-skill-item ${entry.unlocked ? 'unlocked' : ''} ${canUnlock ? 'can-unlock' : ''}">
          <div class="viz-skill-head">
            <strong>${skill.name}</strong>
            <span class="viz-skill-state">${stateText}</span>
          </div>
          <p class="viz-muted">${skill.description}</p>
          ${canUnlock ? `<button class="viz-btn accent" data-skill-id="${skill.skill_id}" type="button">解锁技能</button>` : ''}
        </article>
      `;
    }).join("");
  }

  // 渲染所有业务模块
  function renderAllModules(engine) {
    // 引擎未就绪时，显示友好提示并跳过渲染
    if (!engine) {
      const grid = document.getElementById("viz-module-grid");
      if (grid) {
        grid.innerHTML = '<div class="error-container"><p>引擎未初始化，无法渲染可视化模块。</p></div>';
      }
      return;
    }
    // 健壮初始化抽屉展开状态
    if (!uiState.drawerOpen || typeof uiState.drawerOpen !== 'object') {
      uiState.drawerOpen = {
        farm: true, ranch: false, process: false, orders: false, company: false, partnership: false, characters: false, inventory: false, tasks: false, story: false, openmode: false, skills: false
      };
    }

    const modules = [
      {
        id: "farm",
        title: "农场",
        render: function() {
          return '<div id="viz-farm-grid"></div>';
        }
      },
      {
        id: "ranch",
        title: "养殖",
        render: function() {
          return '<div id="viz-ranch-grid"></div>';
        }
      },
      {
        id: "process",
        title: "加工车间",
        render: function() {
          return '<div id="viz-process-list"></div>';
        }
      },
      { 
        id: "orders", 
        title: "订单履约", 
        render: function() { 
          return '<div id="viz-orders-list"></div>'; 
        } 
      },
      { 
        id: "company", 
        title: "公司治理", 
        render: function() { 
          return '<div id="viz-company-list"></div>'; 
        } 
      },
      { 
        id: "partnership", 
        title: "合作推进", 
        render: function() { 
          return '<div id="viz-partnership-list"></div>'; 
        } 
      },
      { 
        id: "characters", 
        title: "村民与角色", 
        render: function() { 
          return '<div id="viz-character-list"></div>'; 
        } 
      },
      { 
        id: "inventory", 
        title: "库存", 
        render: function() { 
          return '<div id="viz-inventory-list"></div>'; 
        } 
      },
      { 
        id: "tasks", 
        title: "任务", 
        render: function() { 
          return '<div id="viz-task-list"></div>'; 
        } 
      },
      { 
        id: "story", 
        title: "剧情", 
        render: function() { 
          return '<div id="viz-story-timeline"></div>'; 
        } 
      },
      {
        id: "openmode",
        title: "开放模式",
        render: function() {
          return '<div id="viz-open-suggestions"></div>';
        }
      },
      {
        id: "skills",
        title: "系统技能",
        render: function() {
          return '<div id="viz-skills-list"></div>';
        }
      }
    ];

    const grid = document.getElementById("viz-module-grid");
    if (!grid) return;
    grid.innerHTML = modules.map(mod => `
      <section class="viz-drawer-card">
        <header class="viz-drawer-toggle" data-drawer-target="${mod.id}" aria-expanded="${uiState.drawerOpen[mod.id] ? 'true' : 'false'}">
          <span>${mod.title}</span>
          <em>${uiState.drawerOpen[mod.id] ? '收起' : '展开'}</em>
        </header>
        <div class="viz-drawer-body${uiState.drawerOpen[mod.id] ? ' is-open' : ''}" id="${mod.id}">
          ${mod.render()}
        </div>
      </section>
    `).join("");

    // 渲染各业务内容到对应容器
    try {
      renderFarm(engine);
      renderMetrics(engine);      // 必须在 renderFarm 之后（viz-farm-caption 存在后）才有效
      renderCropSelect(engine);  // 必须在 renderFarm 之后（viz-crop-select 存在后）才有效
      renderRanch(engine);
      renderLivestockSelect(engine); // 必须在 renderRanch 之后
      renderProcess(engine);
      renderRecipeSelect(engine);  // 必须在 renderProcess 之后
      renderOrders(engine);
      renderCompany(engine);
      renderPartnership(engine);
      renderCharacters(engine);
      renderInventory(engine);
      renderTasks(engine);
      renderStoryTimeline(engine);
      renderStoryPanel(engine);
      renderOpenMode(engine);
      renderSkills(engine);
    } catch (error) {
      console.error("渲染业务内容时出错:", error);
    }
  }

  // 全局渲染函数
  function render(engine) {
    renderMetrics(engine);
    renderCropSelect(engine);
    renderLivestockSelect(engine);
    renderRecipeSelect(engine);
    renderFarm(engine);
    renderRanch(engine);
    renderProcess(engine);
    renderOrders(engine);
    renderCompany(engine);
    renderPartnership(engine);
    renderCharacters(engine);
    renderInventory(engine);
    renderTasks(engine);
    renderStoryTimeline(engine);
    renderStoryPanel(engine);
    renderOpenMode(engine);
    renderSkills(engine);
  }

  // 事件绑定函数
  function bindEvents() {
    // 统一事件委托：抽屉toggle事件提升到document，保证任何位置都能响应
    document.addEventListener("click", (event) => {
      // 抽屉展开/收起
      const toggle = event.target.closest(".viz-drawer-toggle[data-drawer-target]");
      if (toggle) {
        const targetId = toggle.getAttribute("data-drawer-target");
        toggleDrawer(targetId);
        return;
      }
    });

    // 其它交互仍挂在 .viz-module-grid 上
    document.getElementById("viz-module-grid")?.addEventListener("click", (event) => {
      // 农场：快捷操作
      if (event.target.closest("#viz-harvest-all")) {
        runVizAction("harvest").catch((error) => app.showFlash(`操作失败：${error.message || "未知错误"}`));
        return;
      }
      if (event.target.closest("#viz-collect-products")) {
        runVizAction("collect").catch((error) => app.showFlash(`操作失败：${error.message || "未知错误"}`));
        return;
      }
      if (event.target.closest("#viz-sell-market")) {
        runVizAction("sell_market").catch((error) => app.showFlash(`操作失败：${error.message || "未知错误"}`));
        return;
      }
      if (event.target.closest("#viz-sell-stream")) {
        runVizAction("sell_stream").catch((error) => app.showFlash(`操作失败：${error.message || "未知错误"}`));
        return;
      }
      // 农场：推进一天
      if (event.target.closest("#viz-advance-day")) {
        runVizAction("advance_day").catch((error) => app.showFlash(`操作失败：${error.message || "未知错误"}`));
        return;
      }
      // 技能解锁
      const skillBtn = event.target.closest("[data-skill-id]");
      if (skillBtn) {
        const skillId = skillBtn.getAttribute("data-skill-id");
        runVizAction("unlock_skill", { skill_id: skillId }).catch((error) => app.showFlash(`操作失败：${error.message || "未知错误"}`));
        return;
      }

      // 农场：地块操作
      const plotBtn = event.target.closest("[data-plot-action]");
      if (plotBtn) {
        const plotId = Number(plotBtn.getAttribute("data-plot-id") || 0);
        const action = plotBtn.getAttribute("data-plot-action");
        const engine = getEngine();
        if (action === "plant") {
          const cropId = document.getElementById("viz-crop-select")?.value;
          if (!cropId) return;
          runVizAction("plant", { plot_id: plotId, crop_id: cropId }).catch((error) => app.showFlash(`操作失败：${error.message || "未知错误"}`));
          return;
        }
        if (action === "harvest") {
          runVizAction("harvest").catch((error) => app.showFlash(`操作失败：${error.message || "未知错误"}`));
          return;
        }
        if (action === "story") {
          app.showPage("story");
        }
        return;
      }
      // 养殖：扩栏
      if (event.target.closest("#viz-ranch-expand")) {
        runVizAction("expand_ranch", { blocks: 1 }).catch((error) => app.showFlash(`操作失败：${error.message || "未知错误"}`));
        return;
      }
      // 养殖：收取产物
      if (event.target.closest("#viz-ranch-collect")) {
        runVizAction("collect").catch((error) => app.showFlash(`操作失败：${error.message || "未知错误"}`));
        return;
      }
      // 养殖：棚舍操作
      const penBtn = event.target.closest("[data-pen-action]");
      if (penBtn) {
        const penId = Number(penBtn.getAttribute("data-pen-id") || 0);
        const action = penBtn.getAttribute("data-pen-action");
        if (action === "collect") {
          runVizAction("collect").catch((error) => app.showFlash(`操作失败：${error.message || "未知错误"}`));
          return;
        }
        const livestockId = document.getElementById("viz-livestock-select")?.value;
        if (!livestockId) {
          app.showFlash("当前阶段暂无可投放养殖品种。");
          return;
        }
        runVizAction("raise_livestock", { pen_id: penId, livestock_id: livestockId }).catch((error) => app.showFlash(`操作失败：${error.message || "未知错误"}`));
        return;
      }
      // 订单履约操作
      const orderBtn = event.target.closest("[data-order-id]");
      if (orderBtn) {
        const orderId = orderBtn.getAttribute("data-order-id");
        runVizAction("fulfill_order", { order_id: orderId }).catch((error) => app.showFlash(`操作失败：${error.message || "未知错误"}`));
        return;
      }
      // 公司治理操作
      const companyBtn = event.target.closest("[data-company-action]");
      if (companyBtn) {
        const action = companyBtn.getAttribute("data-company-action");
        if (action === "prepare") {
          runVizAction("prepare_company", {}).catch((error) => app.showFlash(`操作失败：${error.message || "未知错误"}`));
        } else if (action === "hire") {
          runVizAction("hire", { count: 1 }).catch((error) => app.showFlash(`操作失败：${error.message || "未知错误"}`));
        } else if (action === "dividend") {
          runVizAction("dividends", {}).catch((error) => app.showFlash(`操作失败：${error.message || "未知错误"}`));
        }
        return;
      }
      // 合作推进操作
      const partnerBtn = event.target.closest("[data-partner]");
      if (partnerBtn) {
        const partner = partnerBtn.getAttribute("data-partner");
        runVizAction("advance_partnership", { partner_type: partner }).catch((error) => app.showFlash(`操作失败：${error.message || "未知错误"}`));
        return;
      }
      // 角色互动操作
      const charBtn = event.target.closest("[data-character-id]");
      if (charBtn) {
        const charId = charBtn.getAttribute("data-character-id");
        runVizAction("interact", { character_id: charId }).catch((error) => app.showFlash(`操作失败：${error.message || "未知错误"}`));
        return;
      }
      // 任务操作
      const taskBtn = event.target.closest("[data-task-id]");
      if (taskBtn) {
        runVizAction("complete_task", {}).catch((error) => app.showFlash(`操作失败：${error.message || "未知错误"}`));
        return;
      }
      // 加工车间操作
      if (event.target.closest("#viz-process-run")) {
        const recipeId = document.getElementById("viz-recipe-select")?.value;
        const batches = Number(document.getElementById("viz-batches-select")?.value || 1);
        if (!recipeId) {
          app.showFlash("请选择加工配方。");
          return;
        }
        runVizAction("process", { recipe_id: recipeId, batches: batches }).catch((error) => app.showFlash(`操作失败：${error.message || "未知错误"}`));
        return;
      }
      if (event.target.closest("#viz-workshop-upgrade")) {
        runVizAction("upgrade_workshop", {}).catch((error) => app.showFlash(`操作失败：${error.message || "未知错误"}`));
        return;
      }
      // 开放玩法：生成行动建议
      if (event.target.closest("#viz-open-suggest")) {
        const engine = getEngine();
        if (!engine.state.open_mode.profile_saved) {
          app.showFlash("请先完成主角设定。");
          return;
        }
        const scene = `刘家村，第 ${engine.state.turn} 天，${engine.state.time}`;
        const goal = engine.state.open_mode.last_goal || "低压力推进经营并保持家庭关系稳定";
        app.apiRequest("/api/viz/open/suggest", {
          method: "POST",
          body: JSON.stringify({ scene, goal })
        })
          .then(() => app.syncFromBackend("已刷新行动建议。"))
          .catch((error) => app.showFlash(`操作失败：${error.message || "未知错误"}`));
        return;
      }
      // 开放玩法：执行自定义行动
      if (event.target.closest("#viz-open-run")) {
        const input = document.getElementById("viz-open-input");
        const actionText = input?.value?.trim();
        if (!actionText) {
          app.showFlash("请输入自定义行动。");
          return;
        }
        const engine = getEngine();
        if (!engine.state.open_mode.profile_saved) {
          app.showFlash("请先完成主角设定。");
          return;
        }
        const scene = `刘家村，第 ${engine.state.turn} 天，${engine.state.time}`;
        app.apiRequest("/api/viz/open/play", {
          method: "POST",
          body: JSON.stringify({ scene, open_action: actionText })
        })
          .then((data) => {
            app.syncFromBackend();
            commit(data.message || "执行完成");
            input.value = "";
          })
          .catch((error) => app.showFlash(`操作失败：${error.message || "未知错误"}`));
        return;
      }
      // 开放玩法：点击建议选项执行
      const openOptBtn = event.target.closest(".viz-open-option");
      if (openOptBtn && !event.target.closest("button")) {
        const optionText = openOptBtn.textContent?.trim();
        if (!optionText || optionText.includes("请先完成主角设定")) return;
        const engine = getEngine();
        if (!engine.state.open_mode.profile_saved) {
          app.showFlash("请先完成主角设定。");
          return;
        }
        const scene = `刘家村，第 ${engine.state.turn} 天，${engine.state.time}`;
        app.apiRequest("/api/viz/open/play", {
          method: "POST",
          body: JSON.stringify({ scene, open_action: optionText })
        })
          .then((data) => {
            app.syncFromBackend();
            commit(data.message || "执行完成");
          })
          .catch((error) => app.showFlash(`操作失败：${error.message || "未知错误"}`));
        return;
      }
    });
  }

  // 页面初始化
  document.addEventListener("DOMContentLoaded", function () {
    if (document.getElementById("viz-module-grid")) {
      try {
        renderAllModules(getEngine());
      } catch (error) {
        console.error("初始化可视化模块时出错:", error);
        // 显示错误信息给用户
        const grid = document.getElementById("viz-module-grid");
        if (grid) {
          grid.innerHTML = '<div class="error-container"><p>初始化失败: ' + error.message + '</p></div>';
        }
      }
      bindEvents();
    }
  });
})();