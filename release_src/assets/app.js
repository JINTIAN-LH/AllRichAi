(function () {
  const STORAGE_KEY = "tf_static_state_v2";
  const LEGACY_STORAGE_KEY = "tf_static_state_v1";
  const SLOT_PREFIX = "tf_static_slot_";
  const BRIDGE_KEY = "tf_static_bridge_v1";
  const DEFAULT_GOAL = "低压力推进经营并保持家庭关系稳定";
  const PROFILE_MODAL_ID = "modal-profile-setup";
  const SETTINGS_MODAL_ID = "settings-modal";
  const PRESET_CONFIGS = [
    { name: "稳健型", values: [90, 10, 1.0, 1.0, 1.0] },
    { name: "成长型", values: [105, 12, 0.95, 1.2, 1.15] },
    { name: "高风险型", values: [135, 20, 1.25, 1.45, 1.35] }
  ];

  const { StaticGameEngine, gameData } = window.AllRichGameEngine;

  let engine = loadEngine();
  let bridgeConfig = loadBridgeConfig();
  let activePage = "home";
  let profilePromptShown = false;

  if (engine.state.open_mode.profile_saved && !engine.state.open_mode.last_options.length) {
    engine.openModeOptions(getSceneForTurn(), DEFAULT_GOAL);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function defaultBridgeConfig() {
    return {
      enabled: false,
      endpoint: "",
      model: "",
      timeoutMs: 15000,
      signEnabled: false,
      clientId: "",
      signVersion: "v1"
    };
  }

  function loadBridgeConfig() {
    try {
      const raw = localStorage.getItem(BRIDGE_KEY);
      if (!raw) return defaultBridgeConfig();
      const parsed = JSON.parse(raw);
      return {
        enabled: !!parsed.enabled,
        endpoint: String(parsed.endpoint || "").trim(),
        model: String(parsed.model || "").trim(),
        timeoutMs: clamp(Number(parsed.timeoutMs || 15000), 3000, 60000),
        signEnabled: !!parsed.signEnabled,
        clientId: String(parsed.clientId || "").trim(),
        signVersion: String(parsed.signVersion || "v1").trim() || "v1"
      };
    } catch (_) {
      return defaultBridgeConfig();
    }
  }

  function saveBridgeConfig(nextConfig) {
    bridgeConfig = {
      enabled: !!nextConfig.enabled,
      endpoint: String(nextConfig.endpoint || "").trim(),
      model: String(nextConfig.model || "").trim(),
      timeoutMs: clamp(Number(nextConfig.timeoutMs || 15000), 3000, 60000),
      signEnabled: !!nextConfig.signEnabled,
      clientId: String(nextConfig.clientId || "").trim(),
      signVersion: String(nextConfig.signVersion || "v1").trim() || "v1"
    };
    localStorage.setItem(BRIDGE_KEY, JSON.stringify(bridgeConfig));
  }

  function loadEngine() {
    const candidates = [STORAGE_KEY, LEGACY_STORAGE_KEY];
    for (const key of candidates) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        return new StaticGameEngine(JSON.parse(raw));
      } catch (_) {
      }
    }
    return StaticGameEngine.newGame();
  }

  function getSceneForTurn() {
    return `刘家村，第 ${engine.state.turn} 天，${engine.state.time}`;
  }

  function snapshotForDiff() {
    const snapshot = engine.statusSnapshot();
    return {
      money: Number(snapshot.money || 0),
      particle: Number(snapshot.particle || 0),
      energy: Number(snapshot.energy || 0),
      prosperity: Number(snapshot.prosperity || 0),
      lazyWill: Number(snapshot.lazyWill || 0),
      support: Number(snapshot.villagerSupport || 0),
      family: Number(snapshot.familyHarmony || 0),
      brand: Number(snapshot.brand || 0)
    };
  }

  function diffSnapshots(before, after) {
    const labels = {
      money: "资金",
      particle: "微粒",
      energy: "源能",
      prosperity: "共富",
      lazyWill: "躺平意愿",
      support: "村民支持度",
      family: "家庭和睦度",
      brand: "品牌知名度"
    };
    return Object.keys(labels)
      .map((key) => ({ key, delta: Number(after[key] || 0) - Number(before[key] || 0) }))
      .filter((entry) => entry.delta !== 0)
      .map((entry) => ({ label: labels[entry.key], delta: entry.delta }));
  }

  function buildSecurityMeta() {
    if (!bridgeConfig.signEnabled) return null;
    const timestamp = Date.now();
    const nonce = `${Math.random().toString(36).slice(2, 10)}${timestamp.toString(36)}`;
    return {
      timestamp,
      nonce,
      signature: "",
      clientId: bridgeConfig.clientId || "",
      signVersion: bridgeConfig.signVersion || "v1"
    };
  }

  function showLoading(show) {
    const mask = document.getElementById("loading-mask");
    if (!mask) return;
    mask.hidden = !show;
    mask.classList.toggle("active", !!show);
  }

  function openDialog(id) {
    const dialog = document.getElementById(id);
    if (dialog && typeof dialog.showModal === "function" && !dialog.open) {
      dialog.showModal();
    }
  }

  function closeDialog(id) {
    const dialog = document.getElementById(id);
    if (dialog && typeof dialog.close === "function" && dialog.open) {
      dialog.close();
    }
  }

  function maybePromptProfile() {
    if (engine.state.open_mode.profile_saved || profilePromptShown) return;
    profilePromptShown = true;
    openDialog(PROFILE_MODAL_ID);
  }

  function showFlash(message) {
    const flash = document.getElementById("flash");
    const text = document.getElementById("flash-text");
    if (!flash || !text) return;
    text.textContent = message;
    flash.hidden = false;
    window.clearTimeout(showFlash._timer);
    showFlash._timer = window.setTimeout(() => {
      flash.hidden = true;
    }, 2800);
  }

  function persistState(flashMessage) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(engine.state));
    renderAll();
    maybePromptProfile();
    if (flashMessage) showFlash(flashMessage);
  }

  function withEngine(action) {
    const before = snapshotForDiff();
    const message = action();
    const after = snapshotForDiff();
    const changes = diffSnapshots(before, after);
    persistState(message);
    if (activePage === "story" && changes.length) {
      displayResult(message, changes);
    }
    return message;
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = String(value == null ? "" : value);
  }

  function setHtml(id, value) {
    const element = document.getElementById(id);
    if (element) element.innerHTML = value;
  }

  function showPage(page) {
    activePage = page;
    document.querySelectorAll(".bottom-nav button[data-page]").forEach((button) => {
      button.classList.toggle("active", button.getAttribute("data-page") === page);
    });
    document.querySelectorAll(".page").forEach((node) => {
      node.classList.toggle("active", node.id === `page-${page}`);
    });
  }

  function formatSigned(value) {
    const num = Number(value || 0);
    return `${num > 0 ? "+" : ""}${num}`;
  }

  function getCompanyLevel() {
    return engine.companyLevelByProfit(engine.state.resources.money + engine.state.company.profit_pool);
  }

  function buildCoreModules() {
    const skillSet = new Set(engine.state.system.unlocked_skills);
    const company = engine.state.company;
    return [
      { name: "公司治理", status: company.unlocked ? "已启用" : "待建立", detail: `雇员 ${company.employees} 人，利润池 ${company.profit_pool}` },
      { name: "加工体系", status: skillSet.has("processing_workshop") ? "已启用" : "待解锁", detail: `加工坊 Lv${company.workshop_level}，产出倍率 ${company.processing_output_multiplier}` },
      { name: "电商直播", status: skillSet.has("streaming_room") ? "已启用" : "待解锁", detail: `品牌热度 ${company.brand_score}，订单奖励倍率 ${company.order_reward_multiplier}` },
      { name: "共同富裕", status: company.support_score >= 40 ? "稳定推进" : "待提升", detail: `支持度 ${company.support_score}，分红比例 ${Math.round(company.dividend_rate * 100)}%` },
      { name: "合作网络", status: Object.values(engine.state.partnerships).some((value) => value === true) ? "已接入" : "待拓展", detail: engine.partnershipReport().join(" / ") }
    ];
  }

  function buildStageGoals() {
    const totalProfit = engine.state.resources.money + engine.state.company.profit_pool;
    const definitions = [
      { level: 1, name: "村级合作社", target: "综合盈利达到 1 万", ready: totalProfit >= 10000 },
      { level: 2, name: "乡镇品牌站", target: "综合盈利达到 5 万", ready: totalProfit >= 50000 },
      { level: 3, name: "县域链路公司", target: "综合盈利达到 20 万", ready: totalProfit >= 200000 },
      { level: 4, name: "区域龙头", target: "综合盈利达到 50 万", ready: totalProfit >= 500000 },
      { level: 5, name: "共同富裕示范企业", target: "综合盈利达到 100 万", ready: totalProfit >= 1000000 }
    ];
    return definitions;
  }

  function renderBridgeSettings() {
    const enabled = document.getElementById("bridge-enabled");
    const endpoint = document.getElementById("bridge-endpoint");
    const model = document.getElementById("bridge-model");
    const timeout = document.getElementById("bridge-timeout");
    const signEnabled = document.getElementById("bridge-sign-enabled");
    const clientId = document.getElementById("bridge-client-id");
    const signVersion = document.getElementById("bridge-sign-version");
    const status = document.getElementById("bridge-status");
    if (!enabled || !endpoint || !model || !timeout || !signEnabled || !clientId || !signVersion || !status) return;
    enabled.checked = !!bridgeConfig.enabled;
    endpoint.value = bridgeConfig.endpoint || "";
    model.value = bridgeConfig.model || "";
    timeout.value = String(bridgeConfig.timeoutMs || 15000);
    signEnabled.checked = !!bridgeConfig.signEnabled;
    clientId.value = bridgeConfig.clientId || "";
    signVersion.value = bridgeConfig.signVersion || "v1";
    status.textContent = bridgeConfig.enabled && bridgeConfig.endpoint
      ? `当前模式：中转接口（${bridgeConfig.endpoint}）`
      : "当前模式：规则文本兜底";
  }

  function populateSelect(select, items, getLabel) {
    if (!select) return;
    const current = select.value;
    select.innerHTML = "";
    items.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.value;
      option.textContent = getLabel(item);
      select.appendChild(option);
    });
    if (items.some((item) => item.value === current)) {
      select.value = current;
    }
  }

  function renderHeader() {
    const snapshot = engine.statusSnapshot();
    setText("header-line", `第 ${snapshot.day} 天 | ${snapshot.time} | ${snapshot.season} | ${snapshot.weather} | 系统 Lv.${snapshot.systemLevel}`);
    const pills = document.getElementById("status-pills");
    if (!pills) return;
    const entries = [
      `阶段 ${snapshot.stage}`,
      `资金 ${snapshot.money}`,
      `微粒 ${snapshot.particle}`,
      `源能 ${snapshot.energy}`,
      `共富 ${snapshot.prosperity}`,
      `公司 Lv${getCompanyLevel()}`
    ];
    pills.innerHTML = entries.map((item) => `<span>${item}</span>`).join("");
  }

  function renderHome() {
    const snapshot = engine.statusSnapshot();
    const homeStats = [
      ["公司等级", `Lv${getCompanyLevel()}`],
      ["综合盈利", engine.state.resources.money + engine.state.company.profit_pool],
      ["村民支持度", engine.state.company.support_score],
      ["品牌热度", engine.state.company.brand_score],
      ["加工品类", Object.keys(engine.availableRecipes()).length],
      ["活跃订单", snapshot.active_orders],
      ["员工士气", engine.state.company.employee_morale],
      ["已解锁技能", engine.state.system.unlocked_skills.length]
    ];
    setHtml("home-stats", homeStats.map(([key, value]) => `<div><span>${key}</span><strong>${value}</strong></div>`).join(""));

    const supportValue = clamp(Number(engine.state.company.support_score || 0), 0, 100);
    const brandValue = clamp(Number(engine.state.company.brand_score || 0), 0, 100);
    const supportProgress = document.getElementById("support-progress");
    const brandProgress = document.getElementById("brand-progress");
    if (supportProgress) supportProgress.style.width = `${supportValue}%`;
    if (brandProgress) brandProgress.style.width = `${brandValue}%`;
    setText("support-progress-text", `${supportValue}/100`);
    setText("brand-progress-text", `${brandValue}/100`);

    const taskList = document.getElementById("task-list");
    const logList = document.getElementById("log-list");
    if (taskList) taskList.innerHTML = engine.taskReport().map((item) => `<li>${item}</li>`).join("");
    if (logList) {
      const logs = engine.state.log.slice().reverse();
      logList.innerHTML = logs.length ? logs.map((item) => `<li>${item}</li>`).join("") : "<li>暂无日志。</li>";
    }
  }

  function renderStory() {
    const snapshot = engine.statusSnapshot();
    setText("story-header-line", `第 ${snapshot.day} 天 | ${snapshot.time} | ${snapshot.season} | ${snapshot.weather} | 系统 Lv.${snapshot.systemLevel}`);

    const statusGrid = document.getElementById("story-status-grid");
    if (statusGrid) {
      const items = [
        ["资金", `${snapshot.money} 元`],
        ["微粒", snapshot.particle],
        ["生命源能", snapshot.energy],
        ["躺平意愿", snapshot.lazyWill],
        ["村民支持度", snapshot.villagerSupport],
        ["家庭和睦度", snapshot.familyHarmony],
        ["品牌知名度", snapshot.brand],
        ["公司", snapshot.company],
        ["土地", `${snapshot.land} 亩`]
      ];
      statusGrid.innerHTML = items.map(([key, value]) => `
        <div class="status-item">
          <div class="status-item-label">${key}</div>
          <div class="status-item-value">${value}</div>
        </div>
      `).join("");
    }

    const rolesPreview = document.getElementById("roles-preview");
    if (rolesPreview) {
      rolesPreview.textContent = `共 ${snapshot.roles.length} 位角色，点击按钮查看完整状态`;
    }
    const rolesList = document.getElementById("roles-list");
    if (rolesList) {
      rolesList.innerHTML = snapshot.roles.map((role) => {
        const line = Object.prototype.hasOwnProperty.call(role, "mood")
          ? `${role.name}：${role.mood} | 体力 ${role.energy}`
          : `${role.name}：好感 ${role.favor} | ${role.state}`;
        return `<div class="role-item"><div class="role-name">${line}</div></div>`;
      }).join("");
    }

    setText("crop-text", snapshot.crops && snapshot.crops.text ? snapshot.crops.text : "无 | 未播种 | 剩余 0 天");
    setText("event-text", snapshot.events || "暂无事件");

    const commandsRoot = document.getElementById("story-commands");
    if (commandsRoot) {
      commandsRoot.innerHTML = "";
      gameData.STORY_COMMANDS.forEach((commandText, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "command-item";
        button.textContent = commandText;
        button.addEventListener("click", () => executeStoryCommand(commandText, index + 1));
        commandsRoot.appendChild(button);
      });
    }
  }

  function renderBalance() {
    const snapshot = engine.statusSnapshot();
    const profile = engine.state.player_profile;
    const profileLocked = engine.state.open_mode.profile_saved;
    setHtml("profile-lines", `
      <p><strong>${profile.name}</strong> · ${profile.identity}</p>
      <p>${profile.return_reason}</p>
      <p class="empty">${profileLocked ? "主角设定已锁定，本局内不再修改。" : "尚未锁定，完成设定后开放玩法建议才会启用。"}</p>
    `);

    const stats = [
      ["天数", `第 ${snapshot.turn} 天`],
      ["阶段", snapshot.stage],
      ["公司等级", `Lv${getCompanyLevel()}`],
      ["综合盈利", engine.state.resources.money + engine.state.company.profit_pool],
      ["资金", snapshot.money],
      ["微粒", snapshot.particles],
      ["源能", snapshot.source_energy],
      ["共富", snapshot.prosperity],
      ["村民支持度", engine.state.company.support_score],
      ["品牌热度", engine.state.company.brand_score],
      ["雇员", snapshot.employees],
      ["加工坊", `Lv${snapshot.workshop_level}`]
    ];
    setHtml("balance-stats", stats.map(([key, value]) => `<div><span>${key}</span><strong>${value}</strong></div>`).join(""));

    const modules = buildCoreModules();
    setHtml("core-module-list", modules.map((module) => `
      <li>
        <strong>${module.name}</strong>
        <span class="state-tag">${module.status}</span>
        <p>${module.detail}</p>
      </li>
    `).join(""));

    const stages = buildStageGoals();
    setHtml("stage-goal-grid", stages.map((goal) => `
      <article class="goal-card ${goal.ready ? "ready" : ""}">
        <h4>Lv${goal.level} · ${goal.name}</h4>
        <p>${goal.target}</p>
        <small>${goal.ready ? "条件达成" : "待推进"}</small>
      </article>
    `).join(""));

    const progressGrid = document.getElementById("progress-grid");
    if (progressGrid) {
      const cards = [
        ["村民支持度", engine.state.company.support_score, "反映玩家对村民的关照程度"],
        ["品牌认可度", engine.state.company.brand_score, "反映产品和企业的市场认可"],
        ["家庭和睦度", snapshot.familyHarmony, "影响剧情推进与合作稳定性"]
      ];
      progressGrid.innerHTML = cards.map(([title, value, desc]) => `
        <div class="progress-card">
          <h5>${title}</h5>
          <div class="progress-circle" style="--progress:${clamp(Number(value || 0), 0, 100)}%; --size:120px;">
            <span class="progress-number">${value}</span>
            <span class="progress-label">/ 100</span>
          </div>
          <p class="progress-desc">${desc}</p>
        </div>
      `).join("");
    }

    setHtml("balance-config-list", [
      `当前基础日薪：${engine.state.company.wage_per_employee}`,
      `当前分红比例：${Math.round(engine.state.company.dividend_rate * 100)}%`,
      `加工费用倍率：${engine.state.company.processing_fee_multiplier}`,
      `加工产出倍率：${engine.state.company.processing_output_multiplier}`,
      `订单奖励倍率：${engine.state.company.order_reward_multiplier}`
    ].map((item) => `<li>${item}</li>`).join(""));

    const form = document.getElementById("balance-form");
    if (form) {
      form.wagePerEmployee.value = engine.state.company.wage_per_employee;
      form.dividendRate.value = Math.round(engine.state.company.dividend_rate * 100);
      form.processingFeeMultiplier.value = engine.state.company.processing_fee_multiplier;
      form.processingOutputMultiplier.value = engine.state.company.processing_output_multiplier;
      form.orderRewardMultiplier.value = engine.state.company.order_reward_multiplier;
    }

    const presetRow = document.getElementById("preset-row");
    if (presetRow) {
      presetRow.innerHTML = "";
      PRESET_CONFIGS.forEach((preset) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "preset-btn";
        button.textContent = preset.name;
        button.addEventListener("click", () => {
          const [wage, dividend, fee, output, reward] = preset.values;
          const message = engine.applyBalanceConfig(wage, dividend, fee, output, reward);
          persistState(message);
        });
        presetRow.appendChild(button);
      });
    }
  }

  function renderFarmModal() {
    const list = document.getElementById("farm-list");
    const form = document.getElementById("farm-form");
    if (list) list.innerHTML = engine.plotReport().map((item) => `<li>${item}</li>`).join("");
    if (form) {
      form.plotId.max = String(engine.state.plots.length);
      populateSelect(form.cropId, Object.keys(engine.availableCrops()).map((cropId) => ({ value: cropId })), (item) => {
        const crop = gameData.CROPS[item.value];
        return `${crop.name} / 成本 ${crop.seed_cost}`;
      });
    }
  }

  function renderRanchModal() {
    const list = document.getElementById("ranch-list");
    const form = document.getElementById("ranch-form");
    if (list) list.innerHTML = engine.penReport().map((item) => `<li>${item}</li>`).join("");
    if (form) {
      form.penId.max = String(engine.state.pens.length);
      populateSelect(form.livestockId, Object.keys(engine.availableLivestock()).map((livestockId) => ({ value: livestockId })), (item) => {
        const livestock = gameData.LIVESTOCKS[item.value];
        return `${livestock.name} / 成本 ${livestock.buy_cost}`;
      });
    }
  }

  function renderProcessModal() {
    const form = document.getElementById("process-form");
    if (!form) return;
    const recipes = Object.keys(engine.availableRecipes()).map((recipeId) => ({ value: recipeId }));
    populateSelect(form.recipeId, recipes, (item) => {
      const recipe = gameData.RECIPES[item.value];
      return `${recipe.name} / 费用 ${recipe.processing_fee}`;
    });
  }

  function renderOrderModal() {
    const list = document.getElementById("order-list");
    if (list) {
      list.innerHTML = engine.orderReport().map((item) => `<li>${item}</li>`).join("");
    }
  }

  function renderCompanyModal() {
    setHtml("company-list", engine.companyReport().map((item) => `<li>${item}</li>`).join(""));
  }

  function renderInventoryModal() {
    setHtml("inventory-list", engine.inventoryReport().map((item) => `<li>${item}</li>`).join(""));
  }

  function renderCharacterModal() {
    setHtml("character-list", engine.characterReport().map((item) => `<li>${item}</li>`).join(""));
    const actions = document.getElementById("character-actions");
    if (!actions) return;
    actions.innerHTML = "";
    Object.keys(gameData.CHARACTERS).forEach((characterId) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `互动：${gameData.CHARACTERS[characterId].name}`;
      button.addEventListener("click", () => withEngine(() => engine.interact(characterId)));
      actions.appendChild(button);
    });
  }

  function renderSkillsModal() {
    const skillEntries = engine.availableSkills();
    setHtml("skill-list", skillEntries.map((entry) => {
      const skill = entry.definition;
      const stateText = entry.unlocked ? "已解锁" : `消耗 ${skill.energy_cost}`;
      return `<li><strong>${skill.name}</strong><span class="state-tag">${stateText}</span><p>${skill.description}</p></li>`;
    }).join(""));
    const actions = document.getElementById("skill-actions");
    if (!actions) return;
    actions.innerHTML = "";
    skillEntries.filter((entry) => !entry.unlocked).forEach((entry) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `解锁：${entry.definition.name}`;
      button.addEventListener("click", () => withEngine(() => engine.unlockSkill(entry.skill_id)));
      actions.appendChild(button);
    });
  }

  function renderPartnershipModal() {
    setHtml("partnership-list", engine.partnershipReport().map((item) => `<li>${item}</li>`).join(""));
    const actions = document.getElementById("partnership-actions");
    if (!actions) return;
    actions.innerHTML = "";
    const labels = {
      science: "推进科研合作",
      government: "推进政府合作",
      business: "推进企业合作",
      village_collective: "推进村集体合作"
    };
    Object.keys(labels).forEach((key) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = labels[key];
      button.addEventListener("click", () => withEngine(() => engine.advancePartnership(key, 30)));
      actions.appendChild(button);
    });
  }

  function renderOpenModal() {
    setText("open-modal-title", `第 ${engine.state.turn} 天 · 开放行动`);
    const optionsRoot = document.getElementById("open-options");
    const result = document.getElementById("open-result");
    const delta = document.getElementById("open-stat-delta");
    if (result) {
      result.textContent = engine.state.open_mode.last_play_result || "选择一个行动开始推演。";
    }
    if (delta) {
      const text = String(engine.state.open_mode.last_stat_delta || "").trim();
      delta.hidden = !text;
      delta.textContent = text;
    }
    if (optionsRoot) {
      const options = engine.state.open_mode.profile_saved
        ? (engine.state.open_mode.last_options.length ? engine.state.open_mode.last_options : engine.openModeOptions(getSceneForTurn(), DEFAULT_GOAL))
        : ["请先完成主角设定，再生成行动建议。"];
      optionsRoot.innerHTML = "";
      options.forEach((optionText) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "option-card";
        button.textContent = optionText;
        button.disabled = !engine.state.open_mode.profile_saved;
        button.addEventListener("click", () => executeOpenAction(optionText));
        optionsRoot.appendChild(button);
      });
    }
    const refreshButton = document.getElementById("btn-refresh-open-options");
    if (refreshButton) refreshButton.disabled = !engine.state.open_mode.profile_saved;
  }

  function renderProfileModal() {
    const form = document.getElementById("profile-form");
    if (!form) return;
    const profile = engine.state.player_profile;
    form.playerName.value = profile.name;
    form.playerIdentity.value = profile.identity;
    form.playerReturnReason.value = profile.return_reason;
    const locked = engine.state.open_mode.profile_saved;
    form.playerName.disabled = locked;
    form.playerIdentity.disabled = locked;
    form.playerReturnReason.disabled = locked;
    const submit = document.getElementById("profile-submit");
    if (submit) {
      submit.disabled = locked;
      submit.textContent = locked ? "本局已锁定" : "确定主角，开始冒险";
    }
  }

  function renderSlots() {
    const slotList = document.getElementById("slot-list");
    if (!slotList) return;
    slotList.innerHTML = "";
    for (let i = 1; i <= 4; i += 1) {
      const key = SLOT_PREFIX + i;
      const exists = !!localStorage.getItem(key);
      const item = document.createElement("li");
      item.innerHTML = `<div class="slot-row"><span>槽位 ${i} ${exists ? "已占用" : "空"}</span><div class="slot-actions"></div></div>`;
      const actions = item.querySelector(".slot-actions");

      [
        ["存", () => {
          localStorage.setItem(key, JSON.stringify(engine.state));
          showFlash(`已保存到槽位 ${i}`);
          renderSlots();
        }],
        ["读", () => {
          const raw = localStorage.getItem(key);
          if (!raw) {
            showFlash(`槽位 ${i} 为空。`);
            return;
          }
          try {
            engine = new StaticGameEngine(JSON.parse(raw));
            profilePromptShown = engine.state.open_mode.profile_saved;
            persistState(`已读取槽位 ${i}`);
          } catch (_) {
            showFlash("读取失败，存档已损坏。");
          }
        }],
        ["删", () => {
          localStorage.removeItem(key);
          showFlash(`已删除槽位 ${i}`);
          renderSlots();
        }]
      ].forEach(([label, handler]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.addEventListener("click", handler);
        actions.appendChild(button);
      });

      slotList.appendChild(item);
    }
  }

  function renderAll() {
    renderHeader();
    renderHome();
    renderStory();
    renderBalance();
    renderFarmModal();
    renderRanchModal();
    renderProcessModal();
    renderOrderModal();
    renderCompanyModal();
    renderInventoryModal();
    renderCharacterModal();
    renderSkillsModal();
    renderPartnershipModal();
    renderOpenModal();
    renderProfileModal();
    renderBridgeSettings();
    renderSlots();
    showPage(activePage);
  }

  async function resolveOpenActionRemote(actionText) {
    if (!bridgeConfig.enabled || !bridgeConfig.endpoint) {
      throw new Error("bridge-not-enabled");
    }
    const controller = new AbortController();
    const securityMeta = buildSecurityMeta();
    const timeoutId = window.setTimeout(() => controller.abort(), bridgeConfig.timeoutMs);
    try {
      const headers = { "Content-Type": "application/json" };
      if (securityMeta) {
        headers["X-TF-Timestamp"] = String(securityMeta.timestamp);
        headers["X-TF-Nonce"] = securityMeta.nonce;
        headers["X-TF-Signature"] = securityMeta.signature;
        if (securityMeta.clientId) headers["X-TF-Client-Id"] = securityMeta.clientId;
        if (securityMeta.signVersion) headers["X-TF-Sign-Version"] = securityMeta.signVersion;
      }
      const response = await fetch(bridgeConfig.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          mode: "open_resolve",
          scene: getSceneForTurn(),
          selected_action: actionText,
          model: bridgeConfig.model || undefined,
          context: engine.statusSnapshot(),
          security: securityMeta
        }),
        signal: controller.signal
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data && data.message) || `HTTP ${response.status}`);
      }
      const result = engine.applyRemoteOpenResolution(getSceneForTurn(), actionText, data || {});
      engine.state.last_story_result = result;
      return result;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function executeOpenAction(actionText) {
    if (!engine.state.open_mode.profile_saved) {
      openDialog(PROFILE_MODAL_ID);
      return;
    }
    const loading = document.getElementById("open-loading-flash");
    if (loading) loading.hidden = false;
    showLoading(true);
    try {
      let result = "";
      if (bridgeConfig.enabled && bridgeConfig.endpoint) {
        try {
          result = await resolveOpenActionRemote(actionText);
        } catch (_) {
          engine.addLog("中转接口不可用，已自动回退规则文本。");
          showFlash("中转接口不可用，已回退本地规则推演。");
        }
      }
      if (!result) {
        result = engine.resolveOpenActionLocal(getSceneForTurn(), actionText);
      }
      engine.state.last_story_result = result;
      persistState();
      setText("open-result", result);
      displayResult(result, []);
    } finally {
      if (loading) loading.hidden = true;
      showLoading(false);
    }
  }

  function executeStoryCommand(commandText) {
    const before = snapshotForDiff();
    showLoading(true);
    try {
      const result = engine.playPanelModeAction(getSceneForTurn(), commandText);
      engine.state.last_story_result = result;
      const after = snapshotForDiff();
      const changes = diffSnapshots(before, after);
      persistState();
      displayResult(result, changes);
    } finally {
      showLoading(false);
    }
  }

  function displayResult(text, changes) {
    const panel = document.getElementById("result-panel");
    const resultText = document.getElementById("story-result");
    const list = document.getElementById("result-changes-list");
    if (resultText) resultText.textContent = text || "指令执行完成。";
    if (list) {
      if (!changes.length) {
        list.innerHTML = '<div class="change-item">本次无显著数值变化</div>';
      } else {
        list.innerHTML = changes.map((change) => {
          const className = change.delta > 0 ? "change-item change-positive" : "change-item change-negative";
          return `<div class="${className}">${change.label}: ${formatSigned(change.delta)}</div>`;
        }).join("");
      }
    }
    if (panel) panel.classList.add("active");
  }

  function refreshOpenOptions() {
    if (!engine.state.open_mode.profile_saved) {
      openDialog(PROFILE_MODAL_ID);
      return;
    }
    engine.openModeOptions(getSceneForTurn(), DEFAULT_GOAL);
    persistState("已刷新行动建议。");
  }

  function bindEvents() {
    document.getElementById("flash-close").addEventListener("click", () => {
      document.getElementById("flash").hidden = true;
    });

    document.querySelectorAll(".bottom-nav button[data-page]").forEach((button) => {
      button.addEventListener("click", () => showPage(button.getAttribute("data-page")));
    });

    document.getElementById("btn-open-settings").addEventListener("click", () => openDialog(SETTINGS_MODAL_ID));
    document.getElementById("btn-open-balance-config").addEventListener("click", () => openDialog("balance-config-modal"));
    document.getElementById("btn-open-profile").addEventListener("click", () => openDialog(PROFILE_MODAL_ID));
    document.getElementById("btn-open-roles").addEventListener("click", () => openDialog("roles-modal"));

    document.getElementById("btn-toggle-drawer").addEventListener("click", () => {
      document.getElementById("home-side").classList.toggle("open");
    });
    document.getElementById("btn-close-drawer").addEventListener("click", () => {
      document.getElementById("home-side").classList.remove("open");
    });

    document.getElementById("btn-close-result").addEventListener("click", () => {
      document.getElementById("result-panel").classList.remove("active");
    });

    document.getElementById("btn-new-game").addEventListener("click", () => {
      engine = StaticGameEngine.newGame();
      profilePromptShown = false;
      document.getElementById("projection-text").textContent = "";
      persistState("已重置为新开局。");
    });
    document.getElementById("btn-save-game").addEventListener("click", () => persistState("当前进度已保存。"));
    document.getElementById("settings-new-game").addEventListener("click", () => {
      engine = StaticGameEngine.newGame();
      profilePromptShown = false;
      document.getElementById("projection-text").textContent = "";
      closeDialog(SETTINGS_MODAL_ID);
      persistState("已重置为新开局。");
    });
    document.getElementById("settings-save-game").addEventListener("click", () => persistState("当前进度已保存。"));

    document.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.getAttribute("data-action");
        if (action === "harvest") return withEngine(() => engine.harvestAll());
        if (action === "collect") return withEngine(() => engine.collectLivestockProducts());
        if (action === "sell_market") return withEngine(() => engine.sellInventory("market"));
        if (action === "sell_stream") return withEngine(() => engine.sellInventory("stream"));
        if (action === "advance_day") return withEngine(() => engine.advanceDay());
      });
    });

    document.querySelectorAll("[data-open]").forEach((button) => {
      button.addEventListener("click", () => openDialog(button.getAttribute("data-open")));
    });
    document.querySelectorAll("[data-close]").forEach((button) => {
      button.addEventListener("click", () => closeDialog(button.closest("dialog").id));
    });

    document.getElementById("farm-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      withEngine(() => engine.plantCrop(Number(form.plotId.value), form.cropId.value));
    });
    document.getElementById("ranch-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      withEngine(() => engine.raiseLivestock(Number(form.penId.value), form.livestockId.value));
    });
    document.getElementById("process-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      withEngine(() => engine.processGoods(form.recipeId.value, Number(form.batches.value || 1)));
    });
    document.getElementById("order-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      withEngine(() => engine.fulfillOrder(form.orderTitle.value || ""));
      form.orderTitle.value = "";
    });

    document.querySelectorAll("[data-company]").forEach((button) => {
      button.addEventListener("click", () => {
        const type = button.getAttribute("data-company");
        if (type === "prepare") return withEngine(() => engine.prepareCompany());
        if (type === "hire") return withEngine(() => engine.hireVillagers(1));
        if (type === "dividend") return withEngine(() => engine.distributeDividends());
      });
    });

    document.getElementById("btn-expand-ranch").addEventListener("click", () => withEngine(() => engine.expandRanch(1)));
    document.getElementById("btn-upgrade-workshop").addEventListener("click", () => withEngine(() => engine.upgradeWorkshop()));

    document.getElementById("story-custom-submit").addEventListener("click", () => {
      const input = document.getElementById("story-custom-input");
      const value = String(input.value || "").trim();
      if (!value) return;
      executeStoryCommand(value);
      input.value = "";
    });
    document.getElementById("story-custom-input").addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        document.getElementById("story-custom-submit").click();
      }
    });

    document.getElementById("open-custom-submit").addEventListener("click", () => {
      const input = document.getElementById("open-custom-input");
      const value = String(input.value || "").trim();
      if (!value) return;
      executeOpenAction(value);
      input.value = "";
    });
    document.getElementById("btn-refresh-open-options").addEventListener("click", refreshOpenOptions);

    document.getElementById("profile-form").addEventListener("submit", (event) => {
      event.preventDefault();
      if (engine.state.open_mode.profile_saved) return;
      const form = event.currentTarget;
      const message = engine.updatePlayerProfile(form.playerName.value, form.playerIdentity.value, form.playerReturnReason.value);
      engine.openModeOptions(getSceneForTurn(), DEFAULT_GOAL);
      closeDialog(PROFILE_MODAL_ID);
      persistState(message);
    });

    document.getElementById("settings-save-bridge").addEventListener("click", () => {
      saveBridgeConfig({
        enabled: document.getElementById("bridge-enabled").checked,
        endpoint: document.getElementById("bridge-endpoint").value,
        model: document.getElementById("bridge-model").value,
        timeoutMs: Number(document.getElementById("bridge-timeout").value || 15000),
        signEnabled: document.getElementById("bridge-sign-enabled").checked,
        clientId: document.getElementById("bridge-client-id").value,
        signVersion: document.getElementById("bridge-sign-version").value
      });
      renderBridgeSettings();
      showFlash("中转配置已保存。");
    });

    document.getElementById("settings-test-bridge").addEventListener("click", async () => {
      const endpoint = String(document.getElementById("bridge-endpoint").value || "").trim();
      const timeoutMs = clamp(Number(document.getElementById("bridge-timeout").value || 15000), 3000, 60000);
      if (!endpoint) {
        showFlash("请先填写中转 Endpoint。");
        return;
      }
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
      try {
        const securityMeta = buildSecurityMeta();
        const headers = { "Content-Type": "application/json" };
        if (securityMeta) {
          headers["X-TF-Timestamp"] = String(securityMeta.timestamp);
          headers["X-TF-Nonce"] = securityMeta.nonce;
          headers["X-TF-Signature"] = securityMeta.signature;
          if (securityMeta.clientId) headers["X-TF-Client-Id"] = securityMeta.clientId;
          if (securityMeta.signVersion) headers["X-TF-Sign-Version"] = securityMeta.signVersion;
        }
        const response = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({ mode: "health", ping: "ok", security: securityMeta }),
          signal: controller.signal
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        showFlash("中转接口连通性测试成功。");
      } catch (_) {
        showFlash("中转接口测试失败，请检查地址、CORS 或网关配置。");
      } finally {
        window.clearTimeout(timeoutId);
      }
    });

    document.getElementById("balance-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const message = engine.applyBalanceConfig(
        Number(form.wagePerEmployee.value || 80),
        Number(form.dividendRate.value || 10),
        Number(form.processingFeeMultiplier.value || 1),
        Number(form.processingOutputMultiplier.value || 1),
        Number(form.orderRewardMultiplier.value || 1)
      );
      persistState(message);
    });

    document.getElementById("btn-projection").addEventListener("click", () => {
      const projection = engine.simulateProjection(7);
      setText(
        "projection-text",
        `预测未来 ${projection.days} 天：资金 ${formatSigned(projection.money_delta)}，共富 ${formatSigned(projection.prosperity_delta)}，源能 ${formatSigned(projection.energy_delta)}，预计雇员 ${projection.employees}。`
      );
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        document.getElementById("result-panel").classList.remove("active");
        document.getElementById("home-side").classList.remove("open");
      }
    });
  }

  bindEvents();
  renderAll();
  maybePromptProfile();
})();
