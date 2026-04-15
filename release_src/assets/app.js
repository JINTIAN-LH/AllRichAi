(function () {
  const STORAGE_KEY = "tf_static_state_v2";
  const LEGACY_STORAGE_KEY = "tf_static_state_v1";
  const BACKEND_KEY = "tf_backend_config_v1";
  const DEFAULT_BACKEND_BASE_URL = "https://allrichai.onrender.com";
  const BRIDGE_KEY = "tf_static_bridge_v1";
  const BRIDGE_SLOT_KEY = "tf_static_bridge_slot_v1";
  const DEFAULT_GOAL = "低压力推进经营并保持家庭关系稳定";
  const PROFILE_MODAL_ID = "modal-profile-setup";
  const SETTINGS_MODAL_ID = "settings-modal";
  const PRESET_CONFIGS = [
    { name: "稳健型", values: [90, 10, 1.0, 1.0, 1.0] },
    { name: "成长型", values: [105, 12, 0.95, 1.2, 1.15] },
    { name: "高风险型", values: [135, 20, 1.25, 1.45, 1.35] }
  ];
  const STYLE_TEMPLATE = [
    "风格样板（请模仿结构与语气，不要逐字照抄）：",
    "1) 开头先写场景气味与人物处境；",
    "2) 给出系统提示（如【叮！】、当前资源、目标）；",
    "3) 中段写行动经过与人物反馈；",
    "4) 结尾给出可执行的行动选择；",
    "5) 文字要有生活感，避免摘要口吻。",
    "示例语气关键词：重生归乡、村庄日常、泥土与青草味、系统激活、低压力但有后果。"
  ].join("\n");

  const { StaticGameEngine, gameData } = window.AllRichGameEngine;
  const stateSubscribers = new Set();

  let engine = loadEngine();
  let backendConfig = loadBackendConfig();
  let serverSlots = [];
  let bridgeConfig = loadBridgeConfig();
  let bridgeSlotConfigs = loadBridgeSlotConfigs();
  let activeSlot = 1;
  let activePage = "home";
  let profilePromptShown = false;
  let flashMuted = false;
  let bridgeConnectivityState = { tested: false, healthy: false, mode: "proxy" };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function defaultBridgeConfig() {
    return {
      enabled: false,
      endpoint: "",
      apiKey: "",
      apiKeyHeader: "Authorization",
      model: "",
      timeoutMs: 15000,
      signEnabled: false,
      clientId: "",
      signVersion: "v1"
    };
  }

  function defaultBackendConfig() {
    return {
      baseUrl: DEFAULT_BACKEND_BASE_URL
    };
  }

  function loadBackendConfig() {
    try {
      const raw = localStorage.getItem(BACKEND_KEY);
      if (!raw) return defaultBackendConfig();
      const parsed = JSON.parse(raw);
      const normalizedBaseUrl = String(parsed.baseUrl || "").trim().replace(/\/+$/, "");
      return {
        baseUrl: normalizedBaseUrl || DEFAULT_BACKEND_BASE_URL
      };
    } catch (_) {
      return defaultBackendConfig();
    }
  }

  function saveBackendConfig(nextConfig) {
    backendConfig = {
      baseUrl: String(nextConfig.baseUrl || "").trim().replace(/\/+$/, "")
    };
    localStorage.setItem(BACKEND_KEY, JSON.stringify(backendConfig));
  }

  function loadBridgeConfig() {
    try {
      const raw = localStorage.getItem(BRIDGE_KEY);
      if (!raw) return defaultBridgeConfig();
      const parsed = JSON.parse(raw);
      return {
        enabled: !!parsed.enabled,
        endpoint: String(parsed.endpoint || "").trim(),
        apiKey: String(parsed.apiKey || "").trim(),
        apiKeyHeader: String(parsed.apiKeyHeader || "Authorization").trim() || "Authorization",
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
      apiKey: String(nextConfig.apiKey || "").trim(),
      apiKeyHeader: String(nextConfig.apiKeyHeader || "Authorization").trim() || "Authorization",
      model: String(nextConfig.model || "").trim(),
      timeoutMs: clamp(Number(nextConfig.timeoutMs || 15000), 3000, 60000),
      signEnabled: !!nextConfig.signEnabled,
      clientId: String(nextConfig.clientId || "").trim(),
      signVersion: String(nextConfig.signVersion || "v1").trim() || "v1"
    };
    localStorage.setItem(BRIDGE_KEY, JSON.stringify(bridgeConfig));
  }

  function loadBridgeSlotConfigs() {
    try {
      const raw = localStorage.getItem(BRIDGE_SLOT_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      return parsed;
    } catch (_) {
      return {};
    }
  }

  function persistBridgeSlotConfigs() {
    localStorage.setItem(BRIDGE_SLOT_KEY, JSON.stringify(bridgeSlotConfigs));
  }

  function getBridgeConfigForSlot(slot) {
    const key = String(Number(slot) || 1);
    const fromSlot = bridgeSlotConfigs[key];
    if (!fromSlot || typeof fromSlot !== "object") return null;
    return {
      enabled: !!fromSlot.enabled,
      endpoint: String(fromSlot.endpoint || "").trim(),
      apiKey: String(fromSlot.apiKey || "").trim(),
      apiKeyHeader: String(fromSlot.apiKeyHeader || "Authorization").trim() || "Authorization",
      model: String(fromSlot.model || "").trim(),
      timeoutMs: clamp(Number(fromSlot.timeoutMs || 15000), 3000, 60000),
      signEnabled: !!fromSlot.signEnabled,
      clientId: String(fromSlot.clientId || "").trim(),
      signVersion: String(fromSlot.signVersion || "v1").trim() || "v1"
    };
  }

  function setBridgeConfigForSlot(slot, config) {
    const key = String(Number(slot) || 1);
    bridgeSlotConfigs[key] = {
      enabled: !!config.enabled,
      endpoint: String(config.endpoint || "").trim(),
      apiKey: String(config.apiKey || "").trim(),
      apiKeyHeader: String(config.apiKeyHeader || "Authorization").trim() || "Authorization",
      model: String(config.model || "").trim(),
      timeoutMs: clamp(Number(config.timeoutMs || 15000), 3000, 60000),
      signEnabled: !!config.signEnabled,
      clientId: String(config.clientId || "").trim(),
      signVersion: String(config.signVersion || "v1").trim() || "v1"
    };
    persistBridgeSlotConfigs();
  }

  function deleteBridgeConfigForSlot(slot) {
    const key = String(Number(slot) || 1);
    if (Object.prototype.hasOwnProperty.call(bridgeSlotConfigs, key)) {
      delete bridgeSlotConfigs[key];
      persistBridgeSlotConfigs();
    }
  }

  function loadEngine() {
    // Unified mode: server is the source of truth, local engine is only a temporary shell until first sync.
    return StaticGameEngine.newGame();
  }

  function backendUrl(path) {
    const base = String(backendConfig.baseUrl || "").trim().replace(/\/+$/, "");
    return `${base}${path}`;
  }

  async function apiRequest(path, options = {}) {
    const response = await fetch(backendUrl(path), {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error((data && (data.message || data.error)) || `HTTP ${response.status}`);
    }
    return data;
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

  function applyBridgeAuthHeader(headers) {
    const key = String(bridgeConfig.apiKey || "").trim();
    const headerName = String(bridgeConfig.apiKeyHeader || "Authorization").trim() || "Authorization";
    if (!key) return;
    if (headerName.toLowerCase() === "authorization") {
      headers.Authorization = /^bearer\s+/i.test(key) ? key : `Bearer ${key}`;
      return;
    }
    headers[headerName] = key;
  }

  function detectBridgeMode(endpoint) {
    const safe = String(endpoint || "").trim().toLowerCase();
    if (!safe) return "proxy";
    if (safe.includes("open-resolve") || safe.includes("/open_resolve") || safe.includes("mode=health")) {
      return "proxy";
    }
    return "openai-compatible";
  }

  function normalizeOpenAiChatEndpoint(endpoint) {
    const raw = String(endpoint || "").trim();
    if (!raw) return "";
    const clean = raw.replace(/\/+$/, "");
    if (/\/chat\/completions$/i.test(clean)) {
      return clean;
    }
    return `${clean}/chat/completions`;
  }

  function extractChatText(payload) {
    if (!payload || typeof payload !== "object") return "";
    if (typeof payload.text === "string" && payload.text.trim()) return payload.text.trim();
    if (typeof payload.output === "string" && payload.output.trim()) return payload.output.trim();
    if (typeof payload.content === "string" && payload.content.trim()) return payload.content.trim();
    const choice = payload.choices && payload.choices[0];
    const content = choice && choice.message && choice.message.content;
    if (typeof content === "string") return content.trim();
    if (Array.isArray(content)) {
      return content
        .map((part) => (typeof part === "string" ? part : (part && part.text) || ""))
        .join("\n")
        .trim();
    }
    return "";
  }

  function extractJsonFromText(text) {
    const raw = String(text || "").trim();
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_) {
    }
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(raw.slice(start, end + 1));
        return parsed && typeof parsed === "object" ? parsed : null;
      } catch (_) {
      }
    }
    return null;
  }

  function sanitizeOptionText(text) {
    const safe = String(text || "").trim().replace(/\s+/g, " ");
    if (!safe) return "";
    const cleaned = safe.replace(/[A-Za-z_][A-Za-z0-9_\-:.]*/g, "").replace(/\s+/g, " ").trim();
    if (cleaned.length >= 8) return cleaned;
    return safe;
  }

  function sanitizeOptionItem(item) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const candidates = [item.text, item.option, item.action, item.title, item.description, item.content]
        .map((value) => String(value || "").trim())
        .filter(Boolean);
      if (candidates.length) return sanitizeOptionText(candidates[0]);
    }
    return sanitizeOptionText(String(item || ""));
  }

  function containsEnglishToken(text) {
    return /[A-Za-z]{2,}/.test(String(text || ""));
  }

  function localizeDisplayText(text) {
    let localized = String(text || "");
    const replacements = [
      [/\bmoney\b/gi, "资金"],
      [/\bparticles\b/gi, "微粒"],
      [/\bprosperity\b/gi, "共富"],
      [/\blaziness\b/gi, "躺平值"],
      [/\bsource_energy\b/gi, "源能"],
      [/\benergy\b/gi, "源能"],
      [/\beffects?\b/gi, "效果"],
      [/\breward\b/gi, "收益"],
      [/\bcost\b/gi, "成本"],
      [/\brisk\b/gi, "风险"],
      [/\boption\b/gi, "选项"],
      [/\baction\b/gi, "行动"]
    ];
    replacements.forEach(([pattern, value]) => {
      localized = localized.replace(pattern, value);
    });
    return localized;
  }

  function sanitizeResultText(text) {
    const localized = localizeDisplayText(text);
    if (!containsEnglishToken(localized)) return localized.trim();
    const cleaned = localized
      .replace(/[A-Za-z_][A-Za-z0-9_\-:.]*/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (cleaned.length >= 24) return cleaned;
    return "你完成了本轮行动，过程以务实推进为主，村民协作意愿上升，经营状态同步更新。";
  }

  function ensureOpenResultLength(text, scene, actionText, effects) {
    const safe = String(text || "").trim();
    if (safe.length >= 200) return safe;
    const fallback = engine.buildRichResultText(scene, actionText, effects);
    if (!safe) return fallback;
    const extended = `${safe}\n\n补充说明：你在“${scene}”推进“${actionText}”后，现场反馈显示协作效率与执行确定性都在上升。` +
      `本次结算：资金 ${effects.money >= 0 ? "+" : ""}${effects.money}，微粒 ${effects.particles >= 0 ? "+" : ""}${effects.particles}，` +
      `共富 ${effects.prosperity >= 0 ? "+" : ""}${effects.prosperity}，躺平值 ${effects.laziness >= 0 ? "+" : ""}${effects.laziness}。`;
    if (extended.length >= 200) return extended;
    return `${extended}\n\n${fallback}`;
  }

  function normalizeEffects(rawEffects, actionText) {
    const base = Object.assign({}, engine.deriveOpenEffects(actionText));
    const source = rawEffects && typeof rawEffects === "object" ? rawEffects : {};
    ["money", "particles", "prosperity", "laziness"].forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const parsed = Number(source[key]);
        if (!Number.isNaN(parsed)) {
          base[key] = Math.trunc(parsed);
        }
      }
    });
    return base;
  }

  function sanitizeRemoteResolvePayload(payload, scene, actionText) {
    const source = payload && typeof payload === "object" ? payload : {};
    const effects = normalizeEffects(source.effects, actionText);
    const rawText = source.text || source.result || source.output || source.content || "";
    const cleanedText = ensureOpenResultLength(sanitizeResultText(String(rawText || "")), scene, actionText, effects);
    const cleanedNext = Array.isArray(source.next_options || source.options)
      ? (source.next_options || source.options).map(sanitizeOptionItem).filter(Boolean).slice(0, 3)
      : [];
    return {
      text: cleanedText,
      effects,
      next_options: cleanedNext
    };
  }

  function getOpenModeContext() {
    const snapshot = engine.statusSnapshot();
    return Object.assign({}, snapshot, {
      player_name: engine.state.player_profile.name,
      player_identity: engine.state.player_profile.identity,
      player_return_reason: engine.state.player_profile.return_reason
    });
  }

  function buildOpenOptionsPayload(scene, goal) {
    return {
      mode: "open_options",
      instruction: "你是乡村经营文字游戏的叙事引擎。请给出3个中文行动选项，每项都要包含具体动作+预期后果，语气贴近‘重生归乡/系统激活/村庄生活’叙事风格，不要英文字段。",
      style_template: STYLE_TEMPLATE,
      scene,
      goal,
      player: {
        name: engine.state.player_profile.name || "刘洋",
        identity: engine.state.player_profile.identity || "回乡青年",
        return_reason: engine.state.player_profile.return_reason || "希望在乡村重建生活"
      },
      context: getOpenModeContext(),
      option_count: 3
    };
  }

  function buildOpenResolvePayload(scene, actionText) {
    return {
      mode: "open_resolve",
      instruction: "你是乡村经营文字游戏裁判。根据玩家行动输出结果与数值变化。文本必须有画面感与生活细节，风格参考‘回乡开篇叙事’，并体现角色关系、经营后果与次日可持续行动。",
      style_template: STYLE_TEMPLATE,
      scene,
      selected_action: actionText,
      player: {
        name: engine.state.player_profile.name || "刘洋",
        identity: engine.state.player_profile.identity || "回乡青年",
        return_reason: engine.state.player_profile.return_reason || "希望在乡村重建生活"
      },
      context: getOpenModeContext(),
      constraints: {
        world: "现代乡村经营",
        no_forced_romance: true,
        avoid_illegal: true,
        tone: "治愈、务实、有后果"
      },
      output_requirements: {
        text_length: "220-420中文字符",
        must_include: ["场景细节", "行动过程", "人物反馈", "经营后果"],
        no_english_keys: true
      }
    };
  }

  async function postBridgePayload(payload) {
    const mode = detectBridgeMode(bridgeConfig.endpoint);
    const controller = new AbortController();
    const securityMeta = buildSecurityMeta();
    const timeoutId = window.setTimeout(() => controller.abort(), bridgeConfig.timeoutMs);
    try {
      const headers = { "Content-Type": "application/json" };
      applyBridgeAuthHeader(headers);
      let response;
      let data;
      if (mode === "proxy") {
        if (securityMeta) {
          headers["X-TF-Timestamp"] = String(securityMeta.timestamp);
          headers["X-TF-Nonce"] = securityMeta.nonce;
          headers["X-TF-Signature"] = securityMeta.signature;
          if (securityMeta.clientId) headers["X-TF-Client-Id"] = securityMeta.clientId;
          if (securityMeta.signVersion) headers["X-TF-Sign-Version"] = securityMeta.signVersion;
        }
        response = await fetch(bridgeConfig.endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(Object.assign({}, payload, { model: bridgeConfig.model || undefined, security: securityMeta })),
          signal: controller.signal
        });
        data = await response.json().catch(() => ({}));
      } else {
        response = await fetch(normalizeOpenAiChatEndpoint(bridgeConfig.endpoint), {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: bridgeConfig.model || "qwen3-max",
            messages: [
              { role: "system", content: "你是乡村经营游戏引擎。请严格返回 JSON，不要返回额外解释。" },
              { role: "user", content: JSON.stringify(payload) }
            ],
            temperature: 0.7,
            stream: false
          }),
          signal: controller.signal
        });
        const parsed = await response.json().catch(() => ({}));
        data = extractJsonFromText(extractChatText(parsed)) || {};
      }
      if (!response.ok) {
        throw new Error((data && (data.message || data.error && data.error.message)) || `HTTP ${response.status}`);
      }
      return data || {};
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function generateRemoteOpenOptions(scene, goal) {
    const payload = await postBridgePayload(buildOpenOptionsPayload(scene, goal));
    const rawOptions = Array.isArray(payload.options) ? payload.options : [];
    const options = rawOptions.map(sanitizeOptionItem).filter(Boolean).slice(0, 3);
    if (!options.length) {
      throw new Error("接口返回中没有可用的行动建议");
    }
    engine.state.open_mode.last_scene = scene;
    engine.state.open_mode.last_goal = goal;
    engine.state.open_mode.last_options = options;
    engine.state.open_mode.options_ready = true;
    return options;
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
    if (flashMuted) return;
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
    renderAll();
    maybePromptProfile();
    if (flashMessage) showFlash(flashMessage);
    notifyStateSubscribers();
  }

  function hydrateEngineFromApiPayload(payload, flashMessage) {
    const statePayload = payload && payload.state && payload.state.raw_state
      ? payload.state.raw_state
      : (payload && payload.raw_state ? payload.raw_state : null);
    if (statePayload) {
      engine = new StaticGameEngine(statePayload);
      profilePromptShown = !!(engine.state && engine.state.open_mode && engine.state.open_mode.profile_saved);
    }
    if (payload && payload.state && Array.isArray(payload.state.save_slots)) {
      serverSlots = payload.state.save_slots.slice();
    }
    persistState(flashMessage || payload && payload.message || "");
    return payload;
  }

  async function syncFromBackend(flashMessage) {
    const data = await apiRequest("/api/viz/state", { method: "GET" });
    return hydrateEngineFromApiPayload(data, flashMessage);
  }

  async function runVizAction(action, params = {}, flashMessage) {
    const before = snapshotForDiff();
    const data = await apiRequest("/api/viz/action", {
      method: "POST",
      body: JSON.stringify({ action, params })
    });
    hydrateEngineFromApiPayload(data, flashMessage);
    const after = snapshotForDiff();
    const changes = diffSnapshots(before, after);
    if (activePage === "story" && changes.length) {
      displayResult(data.message || "操作完成。", changes);
    }
    return data;
  }

  async function runSlotAction(op, slot) {
    const data = await apiRequest(`/api/viz/slot/${op}`, {
      method: "POST",
      body: JSON.stringify({ slot })
    });
    const normalizedSlot = Number(slot) || 1;
    if (op === "save") {
      activeSlot = normalizedSlot;
      setBridgeConfigForSlot(normalizedSlot, bridgeConfig);
    } else if (op === "load") {
      activeSlot = normalizedSlot;
      const loadedBridgeConfig = getBridgeConfigForSlot(normalizedSlot);
      if (loadedBridgeConfig) {
        saveBridgeConfig(loadedBridgeConfig);
        bridgeConnectivityState = {
          tested: false,
          healthy: false,
          mode: detectBridgeMode(loadedBridgeConfig.endpoint)
        };
      }
    } else if (op === "delete") {
      deleteBridgeConfigForSlot(normalizedSlot);
      if (activeSlot === normalizedSlot) {
        bridgeConnectivityState = {
          tested: false,
          healthy: false,
          mode: detectBridgeMode(bridgeConfig.endpoint)
        };
      }
    }
    hydrateEngineFromApiPayload(data, data.message || `槽位 ${slot} 操作完成`);
    return data;
  }

  function notifyStateSubscribers() {
    stateSubscribers.forEach((callback) => {
      try {
        callback(engine);
      } catch (_) {
      }
    });
  }

  function subscribeState(callback) {
    if (typeof callback !== "function") {
      return () => {};
    }
    stateSubscribers.add(callback);
    try {
      callback(engine);
    } catch (_) {
    }
    return () => {
      stateSubscribers.delete(callback);
    };
  }

  function replaceEngine(nextEngine, flashMessage) {
    if (!nextEngine) return engine;
    engine = nextEngine;
    profilePromptShown = !!(engine.state && engine.state.open_mode && engine.state.open_mode.profile_saved);
    persistState(flashMessage);
    return engine;
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
    const apiKey = document.getElementById("bridge-api-key");
    const apiKeyHeader = document.getElementById("bridge-api-key-header");
    const model = document.getElementById("bridge-model");
    const timeout = document.getElementById("bridge-timeout");
    const signEnabled = document.getElementById("bridge-sign-enabled");
    const clientId = document.getElementById("bridge-client-id");
    const signVersion = document.getElementById("bridge-sign-version");
    const status = document.getElementById("bridge-status");
    if (!enabled || !endpoint || !apiKey || !apiKeyHeader || !model || !timeout || !signEnabled || !clientId || !signVersion || !status) return;
    enabled.checked = !!bridgeConfig.enabled;
    endpoint.value = bridgeConfig.endpoint || "";
    apiKey.value = bridgeConfig.apiKey || "";
    apiKeyHeader.value = bridgeConfig.apiKeyHeader || "Authorization";
    model.value = bridgeConfig.model || "";
    timeout.value = String(bridgeConfig.timeoutMs || 15000);
    signEnabled.checked = !!bridgeConfig.signEnabled;
    clientId.value = bridgeConfig.clientId || "";
    signVersion.value = bridgeConfig.signVersion || "v1";
    const mode = detectBridgeMode(bridgeConfig.endpoint);
    if (!(bridgeConfig.enabled && bridgeConfig.endpoint)) {
      status.textContent = "当前推理模式：规则文本兜底";
      return;
    }
    const modeText = mode === "proxy" ? "中转接口" : "LLM 兼容接口直连";
    const testedText = bridgeConnectivityState.tested
      ? (bridgeConnectivityState.healthy ? "，已连通" : "，待重测")
      : "，未测试";
    status.textContent = `当前推理模式：${modeText}${bridgeConfig.apiKey ? "（含密钥）" : ""}${testedText}｜仅保存在当前浏览器槽位（不写入服务器）`;
  }

  function renderBackendSettings() {
    const baseInput = document.getElementById("backend-base-url");
    const status = document.getElementById("backend-status");
    if (!baseInput || !status) return;
    baseInput.value = backendConfig.baseUrl || "";
    const target = backendConfig.baseUrl || window.location.origin;
    status.textContent = `当前后端：${target}`;
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
      { key: "stage", text: `阶段 ${snapshot.stage}` },
      { key: "money", text: `资金 ${snapshot.money}` },
      { key: "particle", text: `微粒 ${snapshot.particle}` },
      { key: "energy", text: `源能 ${snapshot.energy}` },
      { key: "prosperity", text: `共富 ${snapshot.prosperity}` },
      { key: "company", text: `公司 Lv${getCompanyLevel()}` }
    ];
    pills.innerHTML = entries.map((item) => `<span data-pill="${item.key}">${item.text}</span>`).join("");
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
        button.addEventListener("click", async () => {
          const [wage, dividend, fee, output, reward] = preset.values;
          try {
            const data = await apiRequest("/api/viz/balance/apply", {
              method: "POST",
              body: JSON.stringify({
                wage_per_employee: Number(wage),
                dividend_rate_percent: Number(dividend),
                processing_fee_multiplier: Number(fee),
                processing_output_multiplier: Number(output),
                order_reward_multiplier: Number(reward)
              })
            });
            hydrateEngineFromApiPayload(data, data.message || "已应用平衡参数。");
          } catch (error) {
            showFlash(`应用失败：${error && error.message ? error.message : "未知错误"}`);
          }
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
      populateSelect(form.plotId, engine.state.plots.map((plot) => ({ value: String(plot.plot_id) })), (item) => {
        const plotId = Number(item.value);
        const plot = engine.state.plots.find((p) => p.plot_id === plotId);
        if (!plot || !plot.crop_id) return `地块 ${plotId}（空闲）`;
        const crop = gameData.CROPS[plot.crop_id];
        const suffix = plot.ready_to_harvest ? "可收获" : `${plot.days_remaining} 天后成熟`;
        return `地块 ${plotId}（${crop.name}，${suffix}）`;
      });
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
      populateSelect(form.penId, engine.state.pens.map((pen) => ({ value: String(pen.pen_id) })), (item) => {
        const penId = Number(item.value);
        const pen = engine.state.pens.find((p) => p.pen_id === penId);
        if (!pen || !pen.livestock_id) return `棚舍 ${penId}（空闲）`;
        const livestock = gameData.LIVESTOCKS[pen.livestock_id];
        const suffix = pen.ready_to_collect ? "可收取" : `${pen.days_remaining} 天后产出`;
        return `棚舍 ${penId}（${livestock.name}，${suffix}）`;
      });
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
    const form = document.getElementById("order-form");
    if (list) {
      list.innerHTML = engine.orderReport().map((item) => `<li>${item}</li>`).join("");
    }
    if (form) {
      const orderItems = engine.state.active_orders
        .filter((order) => !order.completed)
        .map((order) => ({ value: order.order_id, title: order.title }));
      populateSelect(form.orderId, orderItems, (item) => {
        const target = engine.state.active_orders.find((order) => order.order_id === item.value);
        if (!target) return item.title || item.value;
        return `${target.title}（奖励 ${target.reward_money}元 / ${target.reward_particles}微粒）`;
      });
      form.querySelector("button[type='submit']").disabled = !orderItems.length;
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
      button.addEventListener("click", async () => {
        try {
          await runVizAction("interact", { character_id: characterId });
        } catch (error) {
          showFlash(`操作失败：${error && error.message ? error.message : "未知错误"}`);
        }
      });
      actions.appendChild(button);
    });
  }

  function renderSkillsModal() {
    const skillEntries = engine.availableSkills();
    const stageLabel = { startup: "躺平起步", scale_up: "产业升级", common_prosperity: "共同富裕" };
    const stageReached = (requiredStage) => {
      const rank = { startup: 0, scale_up: 1, common_prosperity: 2 };
      return (rank[engine.state.stage] || 0) >= (rank[requiredStage] || 0);
    };
    setHtml("skill-list", skillEntries.map((entry) => {
      const skill = entry.definition;
      const stageOk = stageReached(skill.required_stage);
      const energyOk = Number(engine.state.resources.source_energy || 0) >= Number(skill.energy_cost || 0);
      const stateText = entry.unlocked
        ? "已解锁"
        : `解锁条件：阶段≥${stageLabel[skill.required_stage] || skill.required_stage}，生命源能≥${skill.energy_cost}${stageOk && energyOk ? "（已满足）" : "（未满足）"}`;
      return `<li><strong>${skill.name}</strong><span class="state-tag">${stateText}</span><p>${skill.description}</p></li>`;
    }).join(""));
    const actions = document.getElementById("skill-actions");
    if (!actions) return;
    actions.innerHTML = "";
    skillEntries.filter((entry) => !entry.unlocked).forEach((entry) => {
      const canUnlock = stageReached(entry.definition.required_stage) && Number(engine.state.resources.source_energy || 0) >= Number(entry.definition.energy_cost || 0);
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = canUnlock ? `解锁：${entry.definition.name}` : `未满足：${entry.definition.name}`;
      button.disabled = !canUnlock;
      button.addEventListener("click", async () => {
        try {
          await runVizAction("unlock_skill", { skill_id: entry.skill_id });
        } catch (error) {
          showFlash(`操作失败：${error && error.message ? error.message : "未知错误"}`);
        }
      });
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
      button.addEventListener("click", async () => {
        try {
          await runVizAction("advance_partnership", { partner_type: key });
        } catch (error) {
          showFlash(`操作失败：${error && error.message ? error.message : "未知错误"}`);
        }
      });
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
        ? (engine.state.open_mode.last_options.length ? engine.state.open_mode.last_options : ["点击“重新生成行动建议”获取后端推理结果。"])
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
    const slots = serverSlots.length
      ? serverSlots.slice().sort((a, b) => Number(a.slot || 0) - Number(b.slot || 0))
      : Array.from({ length: 4 }, (_, idx) => ({ slot: idx + 1, exists: false }));

    slots.forEach((slotInfo) => {
      const i = Number(slotInfo.slot || 1);
      const exists = !!slotInfo.exists;
      const item = document.createElement("li");
      item.innerHTML = `<div class="slot-row"><span>槽位 ${i} ${exists ? "已占用" : "空"}</span><div class="slot-actions"></div></div>`;
      const actions = item.querySelector(".slot-actions");

      [
        ["存", async () => {
          try {
            await runSlotAction("save", i);
          } catch (error) {
            showFlash(`保存失败：${error && error.message ? error.message : "未知错误"}`);
          }
        }],
        ["读", async () => {
          try {
            await runSlotAction("load", i);
          } catch (error) {
            showFlash(`读取失败：${error && error.message ? error.message : "未知错误"}`);
          }
        }],
        ["删", async () => {
          try {
            await runSlotAction("delete", i);
          } catch (error) {
            showFlash(`删除失败：${error && error.message ? error.message : "未知错误"}`);
          }
        }]
      ].forEach(([label, handler]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.addEventListener("click", handler);
        actions.appendChild(button);
      });

      slotList.appendChild(item);
    });
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
    renderBackendSettings();
    renderBridgeSettings();
    renderSlots();
    showPage(activePage);
  }

  async function resolveOpenActionRemote(actionText) {
    if (!bridgeConfig.enabled || !bridgeConfig.endpoint) {
      throw new Error("bridge-not-enabled");
    }
    const scene = getSceneForTurn();
    const resolvePayload = await postBridgePayload(buildOpenResolvePayload(scene, actionText));
    const predictedNextScene = `刘家村，第 ${Number(engine.state.turn || 1) + 1} 天，清晨`;
    const nextGoal = engine.state.open_mode.last_goal || DEFAULT_GOAL;
    try {
      const nextOptions = await generateRemoteOpenOptions(predictedNextScene, nextGoal);
      resolvePayload.next_options = nextOptions;
    } catch (_) {
    }
    const cleanedPayload = sanitizeRemoteResolvePayload(resolvePayload, scene, actionText);
    const result = engine.applyRemoteOpenResolution(scene, actionText, cleanedPayload);
    engine.state.last_story_result = result;
    return result;
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
      const data = await apiRequest("/api/viz/open/play", {
        method: "POST",
        body: JSON.stringify({
          scene: getSceneForTurn(),
          open_action: actionText
        })
      });
      hydrateEngineFromApiPayload(data);
      const result = String(data.message || "推演完成");
      setText("open-result", result);
      setText("open-stat-delta", String(data.stat_delta || ""));
      displayResult(result, []);
    } finally {
      if (loading) loading.hidden = true;
      showLoading(false);
    }
  }

  function executeStoryCommand(commandText) {
    const before = snapshotForDiff();
    showLoading(true);
    apiRequest("/api/story/execute-command", {
      method: "POST",
      body: JSON.stringify({ command: commandText })
    })
      .then(async (data) => {
        await syncFromBackend();
        const after = snapshotForDiff();
        const changes = diffSnapshots(before, after);
        displayResult(String(data.result_text || "指令执行完成。"), changes);
      })
      .catch((error) => {
        showFlash(`执行失败：${error && error.message ? error.message : "未知错误"}`);
      })
      .finally(() => {
        showLoading(false);
      });
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

  async function refreshOpenOptions() {
    if (!engine.state.open_mode.profile_saved) {
      openDialog(PROFILE_MODAL_ID);
      return;
    }
    const scene = getSceneForTurn();
    const goal = engine.state.open_mode.last_goal || DEFAULT_GOAL;
    showLoading(true);
    try {
      const data = await apiRequest("/api/viz/open/suggest", {
        method: "POST",
        body: JSON.stringify({ scene, goal })
      });
      hydrateEngineFromApiPayload(data, "已刷新行动建议。");
    } catch (error) {
      showFlash(`刷新建议失败：${error && error.message ? error.message : "未知错误"}`);
    } finally {
      showLoading(false);
    }
  }

  function bindEvents() {
    document.getElementById("flash-close").addEventListener("click", () => {
      document.getElementById("flash").hidden = true;
      flashMuted = true;
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

    document.getElementById("btn-new-game").addEventListener("click", async () => {
      const data = await apiRequest("/api/viz/new-game", { method: "POST" });
      document.getElementById("projection-text").textContent = "";
      hydrateEngineFromApiPayload(data, "已重置为新开局。");
    });
    document.getElementById("btn-save-game").addEventListener("click", async () => {
      await runSlotAction("save", 1);
    });
    document.getElementById("settings-new-game").addEventListener("click", async () => {
      const data = await apiRequest("/api/viz/new-game", { method: "POST" });
      document.getElementById("projection-text").textContent = "";
      closeDialog(SETTINGS_MODAL_ID);
      hydrateEngineFromApiPayload(data, "已重置为新开局。");
    });
    document.getElementById("settings-save-game").addEventListener("click", async () => {
      await runSlotAction("save", 1);
    });

    document.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", async () => {
        const action = button.getAttribute("data-action");
        if (!action) return;
        try {
          await runVizAction(action, {});
        } catch (error) {
          showFlash(`操作失败：${error && error.message ? error.message : "未知错误"}`);
        }
      });
    });

    document.querySelectorAll("[data-open]").forEach((button) => {
      button.addEventListener("click", () => openDialog(button.getAttribute("data-open")));
    });
    document.querySelectorAll("[data-close]").forEach((button) => {
      button.addEventListener("click", () => closeDialog(button.closest("dialog").id));
    });

    document.getElementById("farm-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      await runVizAction("plant", { plot_id: Number(form.plotId.value), crop_id: form.cropId.value });
    });
    document.getElementById("ranch-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      await runVizAction("raise_livestock", { pen_id: Number(form.penId.value), livestock_id: form.livestockId.value });
    });
    document.getElementById("process-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      await runVizAction("process", { recipe_id: form.recipeId.value, batches: Number(form.batches.value || 1) });
    });
    document.getElementById("order-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      await runVizAction("fulfill_order", { order_id: form.orderId.value || "" });
    });

    document.querySelectorAll("[data-company]").forEach((button) => {
      button.addEventListener("click", async () => {
        const type = button.getAttribute("data-company");
        if (type === "prepare") return runVizAction("prepare_company", {});
        if (type === "hire") return runVizAction("hire", { count: 1 });
        if (type === "dividend") return runVizAction("dividends", {});
      });
    });

    document.getElementById("btn-expand-ranch").addEventListener("click", async () => runVizAction("expand_ranch", { blocks: 1 }));
    document.getElementById("btn-upgrade-workshop").addEventListener("click", async () => runVizAction("upgrade_workshop", {}));

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
    document.getElementById("btn-refresh-open-options").addEventListener("click", () => {
      refreshOpenOptions();
    });

    document.getElementById("profile-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      if (engine.state.open_mode.profile_saved) return;
      const form = event.currentTarget;
      const data = await apiRequest("/api/viz/profile/update", {
        method: "POST",
        body: JSON.stringify({
          player_name: form.playerName.value,
          player_identity: form.playerIdentity.value,
          player_return_reason: form.playerReturnReason.value
        })
      });
      hydrateEngineFromApiPayload(data);
      await refreshOpenOptions();
      closeDialog(PROFILE_MODAL_ID);
      persistState(data.message || "主角设定已保存");
    });

    document.getElementById("settings-save-backend").addEventListener("click", async () => {
      const base = String(document.getElementById("backend-base-url").value || "").trim();
      saveBackendConfig({ baseUrl: base });
      renderBackendSettings();
      try {
        await syncFromBackend("后端地址已保存并同步状态。");
      } catch (error) {
        showFlash(`后端连通失败：${error && error.message ? error.message : "未知错误"}`);
      }
    });

    document.getElementById("settings-test-backend").addEventListener("click", async () => {
      try {
        await syncFromBackend("后端连通性测试成功。");
      } catch (error) {
        showFlash(`后端连通性测试失败：${error && error.message ? error.message : "未知错误"}`);
      }
    });

    document.getElementById("settings-save-bridge").addEventListener("click", () => {
      const nextBridgeConfig = {
        enabled: document.getElementById("bridge-enabled").checked,
        endpoint: document.getElementById("bridge-endpoint").value,
        apiKey: document.getElementById("bridge-api-key").value,
        apiKeyHeader: document.getElementById("bridge-api-key-header").value,
        model: document.getElementById("bridge-model").value,
        timeoutMs: Number(document.getElementById("bridge-timeout").value || 15000),
        signEnabled: document.getElementById("bridge-sign-enabled").checked,
        clientId: document.getElementById("bridge-client-id").value,
        signVersion: document.getElementById("bridge-sign-version").value
      };
      saveBridgeConfig(nextBridgeConfig);
      setBridgeConfigForSlot(activeSlot, nextBridgeConfig);
      bridgeConnectivityState = {
        tested: false,
        healthy: false,
        mode: detectBridgeMode(document.getElementById("bridge-endpoint").value)
      };
      renderBridgeSettings();
      showFlash(`中转配置已保存到本地槽位 ${activeSlot}。`);
    });

    document.getElementById("settings-test-bridge").addEventListener("click", async () => {
      const endpoint = String(document.getElementById("bridge-endpoint").value || "").trim();
      const timeoutMs = clamp(Number(document.getElementById("bridge-timeout").value || 15000), 3000, 60000);
      if (!endpoint) {
        showFlash("请先填写中转 Endpoint。");
        return;
      }
      const mode = detectBridgeMode(endpoint);
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
      try {
        const securityMeta = buildSecurityMeta();
        const headers = { "Content-Type": "application/json" };
        applyBridgeAuthHeader(headers);
        let response;
        if (mode === "proxy") {
          if (securityMeta) {
            headers["X-TF-Timestamp"] = String(securityMeta.timestamp);
            headers["X-TF-Nonce"] = securityMeta.nonce;
            headers["X-TF-Signature"] = securityMeta.signature;
            if (securityMeta.clientId) headers["X-TF-Client-Id"] = securityMeta.clientId;
            if (securityMeta.signVersion) headers["X-TF-Sign-Version"] = securityMeta.signVersion;
          }
          response = await fetch(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify({ mode: "health", ping: "ok", security: securityMeta }),
            signal: controller.signal
          });
        } else {
          response = await fetch(normalizeOpenAiChatEndpoint(endpoint), {
            method: "POST",
            headers,
            body: JSON.stringify({
              model: String(document.getElementById("bridge-model").value || "qwen3-max").trim() || "qwen3-max",
              stream: false,
              messages: [
                { role: "system", content: "You are a health check assistant." },
                { role: "user", content: "Reply with OK." }
              ],
              max_tokens: 8
            }),
            signal: controller.signal
          });
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        saveBridgeConfig({
          enabled: document.getElementById("bridge-enabled").checked,
          endpoint: endpoint,
          apiKey: document.getElementById("bridge-api-key").value,
          apiKeyHeader: document.getElementById("bridge-api-key-header").value,
          model: document.getElementById("bridge-model").value,
          timeoutMs,
          signEnabled: document.getElementById("bridge-sign-enabled").checked,
          clientId: document.getElementById("bridge-client-id").value,
          signVersion: document.getElementById("bridge-sign-version").value
        });
        setBridgeConfigForSlot(activeSlot, bridgeConfig);
        bridgeConnectivityState = { tested: true, healthy: true, mode };
        renderBridgeSettings();
        showFlash(mode === "proxy" ? "中转接口连通性测试成功，当前推理模式已切换。" : "LLM 兼容接口连通性测试成功，当前推理模式已切换。");
      } catch (err) {
        bridgeConnectivityState = { tested: true, healthy: false, mode };
        renderBridgeSettings();
        const reason = err && err.name === "AbortError"
          ? "请求超时"
          : (err && err.message) || "未知错误";
        showFlash(`中转接口测试失败：${reason}。请检查地址、密钥、CORS 或网关配置。`);
      } finally {
        window.clearTimeout(timeoutId);
      }
    });

    document.getElementById("balance-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = await apiRequest("/api/viz/balance/apply", {
        method: "POST",
        body: JSON.stringify({
          wage_per_employee: Number(form.wagePerEmployee.value || 80),
          dividend_rate_percent: Number(form.dividendRate.value || 10),
          processing_fee_multiplier: Number(form.processingFeeMultiplier.value || 1),
          processing_output_multiplier: Number(form.processingOutputMultiplier.value || 1),
          order_reward_multiplier: Number(form.orderRewardMultiplier.value || 1)
        })
      });
      hydrateEngineFromApiPayload(data, data.message || "已应用平衡参数。");
    });

    document.getElementById("btn-projection").addEventListener("click", async () => {
      const data = await apiRequest("/api/viz/balance/replay", {
        method: "POST",
        body: JSON.stringify({ days: 7 })
      });
      const projection = data.replay || { days: 7, money_delta: 0, prosperity_delta: 0, energy_delta: 0, employees: 0 };
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

  window.AllRichStaticApp = {
    getEngine: () => engine,
    getGameData: () => gameData,
    subscribe: subscribeState,
    commit: (flashMessage) => {
      persistState(flashMessage);
      return engine;
    },
    replaceEngine,
    runVizAction,
    runSlotAction,
    syncFromBackend,
    apiRequest,
    showPage,
    showFlash,
    openDialog,
    closeDialog
  };

  bindEvents();
  renderAll();
  syncFromBackend()
    .catch((error) => {
      showFlash(`后端同步失败，当前使用本地展示状态：${error && error.message ? error.message : "未知错误"}`);
    })
    .finally(() => {
      maybePromptProfile();
    });
})();
