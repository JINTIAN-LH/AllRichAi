(function (global) {
  const PARTICLES_PER_ENERGY = 1000;
  const STARTING_LEVEL = 2;
  const STARTING_STAGE = "startup";
  const ORDER_DAILY_ROLL_INTERVAL = 2;
  const RANCH_EXPANSION_BASE_COST = 700;
  const WORKSHOP_UPGRADE_BASE_COST = 1000;
  const WORKSHOP_PROCESSING_FEE_REDUCTION = 0.08;
  const WORKSHOP_OUTPUT_BONUS_RATE = 0.15;

  const SYSTEM_LEVELS = {
    1: { name: "城市感知", daily_particles: 30 },
    2: { name: "乡野部署", daily_particles: 300 },
    3: { name: "规模农场", daily_particles: 3000 }
  };

  const STAGE_LABELS = {
    startup: "躺平起步",
    scale_up: "产业升级",
    common_prosperity: "共同富裕"
  };

  const STAGE_REQUIREMENTS = {
    scale_up: { money: 5000, harvest_count: 4, favor_wang_nan: 8 },
    common_prosperity: { money: 12000, prosperity: 20, employees: 3, skill: "village_company" }
  };

  const CROPS = {
    watermelon: { crop_id: "watermelon", name: "西甜瓜", seed_cost: 120, sell_price: 220, grow_days: 2, yield_amount: 2, particle_reward: 180, unlock_stage: "startup" },
    vegetable: { crop_id: "vegetable", name: "时令蔬菜", seed_cost: 60, sell_price: 110, grow_days: 1, yield_amount: 2, particle_reward: 90, unlock_stage: "startup" },
    strawberry: { crop_id: "strawberry", name: "草莓", seed_cost: 200, sell_price: 360, grow_days: 2, yield_amount: 2, particle_reward: 260, unlock_stage: "scale_up" },
    rice: { crop_id: "rice", name: "优质水稻", seed_cost: 150, sell_price: 260, grow_days: 3, yield_amount: 3, particle_reward: 220, unlock_stage: "scale_up" }
  };

  const ITEMS = {
    watermelon: { item_id: "watermelon", name: "西甜瓜", sell_price: 220, category: "crop" },
    vegetable: { item_id: "vegetable", name: "时令蔬菜", sell_price: 110, category: "crop" },
    strawberry: { item_id: "strawberry", name: "草莓", sell_price: 360, category: "crop" },
    rice: { item_id: "rice", name: "优质水稻", sell_price: 260, category: "crop" },
    egg: { item_id: "egg", name: "土鸡蛋", sell_price: 65, category: "livestock" },
    milk: { item_id: "milk", name: "鲜牛奶", sell_price: 90, category: "livestock" },
    jam: { item_id: "jam", name: "草莓果酱", sell_price: 460, category: "processed" },
    dried_fruit: { item_id: "dried_fruit", name: "瓜果果干", sell_price: 320, category: "processed" },
    gift_box: { item_id: "gift_box", name: "共富礼盒", sell_price: 880, category: "processed" }
  };

  const LIVESTOCKS = {
    hens: { livestock_id: "hens", name: "散养土鸡", buy_cost: 280, product_item_id: "egg", cycle_days: 2, product_amount: 4, particle_reward: 130, unlock_stage: "startup" },
    cows: { livestock_id: "cows", name: "奶牛", buy_cost: 900, product_item_id: "milk", cycle_days: 3, product_amount: 3, particle_reward: 260, unlock_stage: "scale_up" }
  };

  const RECIPES = {
    fruit_jam: { recipe_id: "fruit_jam", name: "草莓果酱", inputs: { strawberry: 2 }, output_item_id: "jam", output_amount: 1, processing_fee: 120, unlock_stage: "scale_up" },
    dried_fruit: { recipe_id: "dried_fruit", name: "瓜果果干", inputs: { watermelon: 2 }, output_item_id: "dried_fruit", output_amount: 1, processing_fee: 100, unlock_stage: "scale_up" },
    gift_box: { recipe_id: "gift_box", name: "共富礼盒", inputs: { egg: 2, jam: 1, dried_fruit: 1 }, output_item_id: "gift_box", output_amount: 1, processing_fee: 180, unlock_stage: "common_prosperity" }
  };

  const SKILLS = {
    smart_irrigation: { skill_id: "smart_irrigation", name: "智能灌溉", energy_cost: 2, description: "解锁 1 块新地并提升作物生长效率。", required_stage: "startup" },
    live_boost: { skill_id: "live_boost", name: "直播流量加持", energy_cost: 3, description: "直播带货收益提升 20%。", required_stage: "startup" },
    automation_kit: { skill_id: "automation_kit", name: "自动化控制组件", energy_cost: 4, description: "每日推进时让所有未成熟作物额外减少 1 天成熟时间。", required_stage: "scale_up" },
    village_company: { skill_id: "village_company", name: "村办公司筹备", energy_cost: 6, description: "解锁共同富裕阶段，扩大分红与就业规模。", required_stage: "scale_up" },
    processing_workshop: { skill_id: "processing_workshop", name: "农产品加工坊", energy_cost: 5, description: "开放初级加工配方，并提升品牌附加值。", required_stage: "scale_up" }
  };

  const ORDER_TEMPLATES = {
    fresh_bundle: { order_id: "fresh_bundle", title: "城郊生鲜店补货", required_items: { vegetable: 4, egg: 2 }, reward_money: 2200, reward_prosperity: 2, reward_particles: 300, unlock_stage: "startup" },
    campus_milk: { order_id: "campus_milk", title: "高校后勤奶制品采购", required_items: { milk: 4, rice: 3 }, reward_money: 4200, reward_prosperity: 3, reward_particles: 500, unlock_stage: "scale_up" },
    ecom_combo: { order_id: "ecom_combo", title: "电商平台乡村助农专场", required_items: { jam: 2, dried_fruit: 2, gift_box: 1 }, reward_money: 7600, reward_prosperity: 5, reward_particles: 880, unlock_stage: "common_prosperity" }
  };

  const CHARACTERS = {
    liu_huaizhi: { character_id: "liu_huaizhi", name: "刘怀志", role: "父亲", description: "前基层公务员，熟悉本地资源和乡村治理。", favor_gain: 4, prosperity_gain: 1, money_gain: 200, particle_gain: 120 },
    liu_xiaoxue: { character_id: "liu_xiaoxue", name: "刘晓雪", role: "姐姐", description: "失聪人士，牵引家庭和科技助农支线。", favor_gain: 5, prosperity_gain: 2, money_gain: 0, particle_gain: 150 },
    yang_dazhen: { character_id: "yang_dazhen", name: "杨大振", role: "农学专家", description: "解决育种与科研合作问题。", favor_gain: 4, prosperity_gain: 1, money_gain: 0, particle_gain: 220 },
    wang_nan: { character_id: "wang_nan", name: "王楠", role: "电商伙伴", description: "负责直播带货与品牌运营。", favor_gain: 4, prosperity_gain: 2, money_gain: 150, particle_gain: 180 },
    zhao_jiangxin: { character_id: "zhao_jiangxin", name: "赵江新", role: "高校讲师", description: "提供自动化方案和高校资源。", favor_gain: 3, prosperity_gain: 1, money_gain: 0, particle_gain: 160 }
  };

  const TASKS = {
    main_first_harvest: { task_id: "main_first_harvest", title: "完成首次收获", category: "主线", description: "累计收获 2 次作物，证明农场循环能正常运转。", target_type: "stat", target_key: "harvest_count", target_value: 2, rewards: { money: 800, particles: 600 }, depends_on: [] },
    main_first_stream: { task_id: "main_first_stream", title: "完成首次直播带货", category: "主线", description: "完成 1 次直播，打通销售渠道。", target_type: "stat", target_key: "stream_count", target_value: 1, rewards: { money: 1000, favor: { wang_nan: 6 } }, depends_on: ["main_first_harvest"] },
    main_meet_mentor: { task_id: "main_meet_mentor", title: "建立导师联系", category: "主线", description: "与杨大振互动 2 次，启动科研支线。", target_type: "interaction", target_key: "yang_dazhen", target_value: 2, rewards: { source_energy: 1, particles: 400 }, depends_on: [] },
    side_support_sister: { task_id: "side_support_sister", title: "姐姐的回乡计划", category: "支线", description: "将刘晓雪好感提升到 10，推进家庭修复。", target_type: "favor", target_key: "liu_xiaoxue", target_value: 10, rewards: { source_energy: 1, prosperity: 3 }, depends_on: [] },
    side_partner_father: { task_id: "side_partner_father", title: "父子联手经营", category: "支线", description: "将刘怀志好感提升到 10，获得经营支持。", target_type: "favor", target_key: "liu_huaizhi", target_value: 10, rewards: { money: 600, particles: 300 }, depends_on: [] },
    daily_plant: { task_id: "daily_plant", title: "日常：播种 1 次", category: "日常", description: "本回合完成 1 次播种。", target_type: "turn_stat", target_key: "current_turn_planted", target_value: 1, rewards: { particles: 120 }, depends_on: [] },
    daily_chat: { task_id: "daily_chat", title: "日常：互动 1 次", category: "日常", description: "本回合与任意角色互动 1 次。", target_type: "turn_stat", target_key: "current_turn_interactions", target_value: 1, rewards: { particles: 120 }, depends_on: [] },
    daily_stream: { task_id: "daily_stream", title: "日常：直播 1 次", category: "日常", description: "本回合完成 1 次直播。", target_type: "turn_stat", target_key: "current_turn_streamed", target_value: 1, rewards: { particles: 180 }, depends_on: [] },
    achievement_harvest_master: { task_id: "achievement_harvest_master", title: "成就：丰收起步", category: "成就", description: "累计收获 6 次作物。", target_type: "stat", target_key: "harvest_count", target_value: 6, rewards: { source_energy: 2, prosperity: 2 }, depends_on: [] },
    main_processing: { task_id: "main_processing", title: "建立初级加工能力", category: "主线", description: "完成 2 批农产品加工，形成附加值闭环。", target_type: "stat", target_key: "processed_batches", target_value: 2, rewards: { money: 1200, prosperity: 2 }, depends_on: ["main_first_stream"] },
    main_hiring: { task_id: "main_hiring", title: "招募首批村民", category: "主线", description: "雇佣 3 名村民，验证村办公司雏形。", target_type: "stat", target_key: "villagers_hired", target_value: 3, rewards: { source_energy: 2, prosperity: 3 }, depends_on: ["main_processing"] },
    achievement_dividend: { task_id: "achievement_dividend", title: "成就：首次分红", category: "成就", description: "完成 1 次村民分红。", target_type: "stat", target_key: "dividend_rounds", target_value: 1, rewards: { source_energy: 2, prosperity: 4 }, depends_on: [] }
  };

  const INTRO_LINES = [
    "考研三战失利后，刘洋回到了刘家村。",
    "躺平智辅系统在强烈的回乡意愿下激活。",
    "你要在个人躺平和带动全村增收之间找到平衡。"
  ];

  const ENDING_TEXT = {
    startup: "你完成了从城市退场到乡村站稳脚跟的过渡。",
    scale_up: "你已经形成产业雏形，直播与科研开始协同。",
    common_prosperity: "村办公司和分红体系建立，共同富裕路线成型。"
  };

  const STORY_COMMANDS = [
    "农业行动：查看自家田地",
    "人物互动：和父亲聊天",
    "电商行动：联系王楠",
    "探索行动：出门逛村子",
    "躺平休息：回房间睡觉摆烂",
    "系统操作：打开躺平智辅面板"
  ];

  function stageRank(stage) {
    return { startup: 0, scale_up: 1, common_prosperity: 2 }[stage] || 0;
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function toInt(value, fallback) {
    const num = Number(value);
    return Number.isFinite(num) ? Math.trunc(num) : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function emptyTaskState() {
    const tasks = {};
    Object.keys(TASKS).forEach((taskId) => {
      tasks[taskId] = { completed: false, claimed: false, progress: 0 };
    });
    return tasks;
  }

  function emptyCharacterState() {
    const characters = {};
    Object.keys(CHARACTERS).forEach((characterId) => {
      characters[characterId] = { favor: 0, unlocked: true };
    });
    return characters;
  }

  function baseState() {
    return {
      turn: 1,
      time: "清晨",
      season: "初夏",
      weather: "晴朗",
      stage: STARTING_STAGE,
      resources: {
        money: 2000,
        particles: 30,
        source_energy: 0,
        prosperity: 0,
        laziness: 50,
        villager_support: 10,
        family_harmony: 80,
        land: 0.5
      },
      system: {
        level: STARTING_LEVEL,
        daily_particles: SYSTEM_LEVELS[STARTING_LEVEL].daily_particles,
        unlocked_skills: []
      },
      plots: [
        { plot_id: 1, crop_id: null, days_remaining: 0, ready_to_harvest: false },
        { plot_id: 2, crop_id: null, days_remaining: 0, ready_to_harvest: false }
      ],
      pens: [{ pen_id: 1, livestock_id: null, days_remaining: 0, ready_to_collect: false }],
      inventory: {},
      characters: emptyCharacterState(),
      tasks: emptyTaskState(),
      stats: {
        planted_count: 0,
        harvest_count: 0,
        interaction_count: 0,
        stream_count: 0,
        sales_revenue: 0,
        processed_batches: 0,
        villagers_hired: 0,
        dividend_rounds: 0,
        livestock_collections: 0,
        orders_completed: 0,
        ranch_expansions: 0,
        workshop_upgrades: 0,
        days_played: 1,
        current_turn_planted: 0,
        current_turn_interactions: 0,
        current_turn_streamed: 0,
        current_turn_processed: 0,
        interactions_by_character: {}
      },
      company: {
        unlocked: false,
        employees: 0,
        dividend_rate: 0,
        brand_level: 0,
        cash_reserve: 0,
        wage_per_employee: 80,
        workshop_level: 1,
        ranch_capacity: 1,
        employee_morale: 60,
        profit_pool: 0,
        processing_fee_multiplier: 1.0,
        processing_output_multiplier: 1.0,
        order_reward_multiplier: 1.0,
        support_score: 10,
        brand_score: 0
      },
      player_profile: {
        name: "刘洋",
        identity: "回乡青年",
        return_reason: "考研失利后希望以低压力方式重建生活"
      },
      open_mode: {
        profile_saved: false,
        options_ready: false,
        last_scene: "",
        last_goal: "",
        last_options: [],
        last_play_result: "",
        last_stat_delta: ""
      },
      partnerships: {
        science_progress: 0,
        government_progress: 0,
        business_progress: 0,
        village_progress: 0,
        science_unlocked: false,
        government_unlocked: false,
        business_unlocked: false,
        village_unlocked: false
      },
      active_orders: [],
      event_text: "你刚回到老家，考研失败，身心俱疲，躺平智辅系统突然激活。",
      flags: [],
      log: INTRO_LINES.slice(),
      last_story_result: ""
    };
  }

  function migrateLegacyState(raw) {
    const state = baseState();
    state.turn = toInt(raw.turn, 1);
    state.stage = raw.stage === "返乡起步" ? "startup" : raw.stage === "稳步扩张" ? "scale_up" : raw.stage === "公司成长期" ? "common_prosperity" : STARTING_STAGE;
    state.resources.money = toInt(raw.money, 2000);
    state.resources.particles = toInt(raw.particles, 30);
    state.resources.source_energy = toInt(raw.sourceEnergy, 0);
    state.resources.prosperity = toInt(raw.prosperity, 0);
    state.resources.laziness = toInt(raw.laziness, 50);
    state.resources.villager_support = toInt(raw.support, 10);
    state.company.unlocked = !!(raw.company && raw.company.unlocked);
    state.company.employees = toInt(raw.company && raw.company.employees, 0);
    state.company.dividend_rate = toInt(raw.company && raw.company.dividendRate, 10) / 100;
    state.company.wage_per_employee = toInt(raw.company && raw.company.wagePerEmployee, 80);
    state.company.brand_score = toInt(raw.brand, 0);
    state.plots = Array.isArray(raw.plots) ? raw.plots.map((plot, index) => ({
      plot_id: toInt(plot.id, index + 1),
      crop_id: plot.cropId === "cabbage" ? "vegetable" : plot.cropId === "tomato" ? "watermelon" : (plot.cropId || null),
      days_remaining: toInt(plot.days, 0),
      ready_to_harvest: toInt(plot.days, 0) <= 0 && !!plot.cropId
    })) : state.plots;
    state.pens = Array.isArray(raw.pens) ? raw.pens.map((pen, index) => ({
      pen_id: toInt(pen.id, index + 1),
      livestock_id: pen.livestockId === "chicken" ? "hens" : pen.livestockId === "goat" ? "cows" : (pen.livestockId || null),
      days_remaining: toInt(pen.days, 0),
      ready_to_collect: toInt(pen.days, 0) <= 0 && !!pen.livestockId
    })) : state.pens;
    state.inventory = deepClone(raw.inventory || {});
    state.log = Array.isArray(raw.logs) ? raw.logs.slice() : state.log;
    state.open_mode.last_play_result = String(raw.openMode && raw.openMode.lastResult || "");
    state.open_mode.last_options = Array.isArray(raw.openMode && raw.openMode.lastOptions) ? raw.openMode.lastOptions.slice(0, 3) : [];
    state.last_story_result = String(raw.lastStoryResult || "");
    return state;
  }

  function normalizeState(raw) {
    if (!raw || typeof raw !== "object") {
      return baseState();
    }
    if (!raw.resources || !raw.system) {
      return migrateLegacyState(raw);
    }

    const state = baseState();
    Object.assign(state, deepClone(raw));
    state.resources = Object.assign(baseState().resources, raw.resources || {});
    state.system = Object.assign(baseState().system, raw.system || {});
    state.company = Object.assign(baseState().company, raw.company || {});
    state.player_profile = Object.assign(baseState().player_profile, raw.player_profile || {});
    state.open_mode = Object.assign(baseState().open_mode, raw.open_mode || {});
    state.partnerships = Object.assign(baseState().partnerships, raw.partnerships || {});
    state.stats = Object.assign(baseState().stats, raw.stats || {});
    state.characters = Object.assign(emptyCharacterState(), raw.characters || {});
    state.tasks = Object.assign(emptyTaskState(), raw.tasks || {});
    state.plots = Array.isArray(raw.plots) ? raw.plots.map((plot, index) => ({
      plot_id: toInt(plot.plot_id ?? plot.id, index + 1),
      crop_id: plot.crop_id ?? plot.cropId ?? null,
      days_remaining: toInt(plot.days_remaining ?? plot.days, 0),
      ready_to_harvest: !!(plot.ready_to_harvest ?? plot.readyToHarvest)
    })) : state.plots;
    state.pens = Array.isArray(raw.pens) ? raw.pens.map((pen, index) => ({
      pen_id: toInt(pen.pen_id ?? pen.id, index + 1),
      livestock_id: pen.livestock_id ?? pen.livestockId ?? null,
      days_remaining: toInt(pen.days_remaining ?? pen.days, 0),
      ready_to_collect: !!(pen.ready_to_collect ?? pen.readyToCollect)
    })) : state.pens;
    state.active_orders = Array.isArray(raw.active_orders || raw.activeOrders)
      ? (raw.active_orders || raw.activeOrders).map((order) => ({
        order_id: order.order_id || order.orderId || order.title,
        title: order.title,
        required_items: deepClone(order.required_items || order.needs || {}),
        reward_money: toInt(order.reward_money ?? order.reward, 0),
        reward_prosperity: toInt(order.reward_prosperity, 0),
        reward_particles: toInt(order.reward_particles, 0),
        completed: !!order.completed
      }))
      : [];
    state.log = Array.isArray(raw.log || raw.logs) ? (raw.log || raw.logs).slice(-18) : state.log;
    state.last_story_result = String(raw.last_story_result || raw.lastStoryResult || "");
    if (!state.open_mode.profile_saved) {
      state.open_mode.profile_saved = true;
    }
    return state;
  }

  class StaticGameEngine {
    constructor(rawState) {
      this.state = normalizeState(rawState);
      if (!this.state.active_orders.length) {
        this._refreshOrders(true);
      }
      this.refreshTasks(false);
    }

    static newGame() {
      const engine = new StaticGameEngine(baseState());
      engine._refreshOrders(true);
      engine.refreshTasks(false);
      return engine;
    }

    clone() {
      return new StaticGameEngine(deepClone(this.state));
    }

    ensureOpenProfile() {
      this.state.open_mode.profile_saved = true;
    }

    addLog(message) {
      this.state.log.push(message);
      this.state.log = this.state.log.slice(-18);
    }

    statusSnapshot() {
      const companyStatus = this.state.company.unlocked ? "已注册" : "未注册";
      return {
        day: this.state.turn,
        time: this.state.time,
        season: this.state.season,
        weather: this.state.weather,
        systemLevel: this.state.system.level,
        money: this.state.resources.money,
        particle: this.state.resources.particles,
        energy: this.state.resources.source_energy,
        lazyWill: this.state.resources.laziness,
        villagerSupport: this.state.resources.villager_support,
        familyHarmony: this.state.resources.family_harmony,
        brand: this.state.company.brand_score,
        company: companyStatus,
        land: Number(this.state.resources.land).toFixed(2),
        roles: this.rolesPayload(),
        crops: this.cropStatusPayload(),
        events: this.state.event_text,
        commands: STORY_COMMANDS.slice(),
        turn: this.state.turn,
        stage: STAGE_LABELS[this.state.stage] || this.state.stage,
        particles: this.state.resources.particles,
        source_energy: this.state.resources.source_energy,
        prosperity: this.state.resources.prosperity,
        laziness: this.state.resources.laziness,
        employees: this.state.company.employees,
        dividend_rate: this.state.company.dividend_rate,
        brand_level: this.state.company.brand_level,
        workshop_level: this.state.company.workshop_level,
        ranch_capacity: this.state.company.ranch_capacity,
        wage_per_employee: this.state.company.wage_per_employee,
        employee_morale: this.state.company.employee_morale,
        active_orders: this.state.active_orders.filter((order) => !order.completed).length,
        skills: this.state.system.unlocked_skills.map((skillId) => SKILLS[skillId] ? SKILLS[skillId].name : skillId)
      };
    }

    cropStatusPayload() {
      const activePlot = this.state.plots.find((plot) => plot.crop_id);
      if (!activePlot || !activePlot.crop_id) {
        return { name: "无", stage: "未播种", daysLeft: 0, text: "无 | 未播种 | 剩余 0 天" };
      }
      const crop = CROPS[activePlot.crop_id];
      const stage = activePlot.ready_to_harvest ? "已成熟" : "生长中";
      return {
        name: crop.name,
        stage,
        daysLeft: activePlot.days_remaining,
        text: `${crop.name} | ${stage} | 剩余 ${activePlot.days_remaining} 天`
      };
    }

    rolesPayload() {
      const lazyMood = this.state.resources.laziness >= 45 ? "平静" : "紧张";
      return [
        { name: "刘洋", mood: lazyMood, energy: clamp(70 + this.state.resources.source_energy * 5, 0, 100) },
        { name: "王楠", favor: this.state.characters.wang_nan.favor, state: "待沟通电商策略" },
        { name: "父亲", favor: this.state.characters.liu_huaizhi.favor, state: "在家整理农具" },
        { name: "母亲", favor: 0, state: "准备早饭" },
        { name: "姐姐", favor: this.state.characters.liu_xiaoxue.favor, state: "省城打工" },
        { name: "杨大振", favor: this.state.characters.yang_dazhen.favor, state: "科研协同" },
        { name: "赵江新", favor: this.state.characters.zhao_jiangxin.favor, state: "高校资源对接" }
      ];
    }

    availableCrops() {
      const result = {};
      Object.keys(CROPS).forEach((cropId) => {
        const crop = CROPS[cropId];
        if (stageRank(this.state.stage) >= stageRank(crop.unlock_stage)) {
          result[cropId] = crop.name;
        }
      });
      return result;
    }

    availableLivestock() {
      const result = {};
      Object.keys(LIVESTOCKS).forEach((livestockId) => {
        const livestock = LIVESTOCKS[livestockId];
        if (stageRank(this.state.stage) >= stageRank(livestock.unlock_stage)) {
          result[livestockId] = livestock.name;
        }
      });
      return result;
    }

    availableRecipes() {
      if (!this.state.system.unlocked_skills.includes("processing_workshop")) {
        return {};
      }
      const result = {};
      Object.keys(RECIPES).forEach((recipeId) => {
        const recipe = RECIPES[recipeId];
        if (stageRank(this.state.stage) >= stageRank(recipe.unlock_stage)) {
          result[recipeId] = recipe.name;
        }
      });
      return result;
    }

    availableSkills() {
      return Object.keys(SKILLS).map((skillId) => ({
        skill_id: skillId,
        unlocked: this.state.system.unlocked_skills.includes(skillId),
        definition: SKILLS[skillId]
      }));
    }

    plotReport() {
      return this.state.plots.map((plot) => {
        if (!plot.crop_id) return `地块 ${plot.plot_id}: 空闲`;
        const crop = CROPS[plot.crop_id];
        const status = plot.ready_to_harvest ? "可收获" : `${plot.days_remaining} 天后成熟`;
        return `地块 ${plot.plot_id}: ${crop.name} - ${status}`;
      });
    }

    penReport() {
      return this.state.pens.map((pen) => {
        if (!pen.livestock_id) return `棚舍 ${pen.pen_id}: 空闲`;
        const livestock = LIVESTOCKS[pen.livestock_id];
        const status = pen.ready_to_collect ? "可收取" : `${pen.days_remaining} 天后产出`;
        return `棚舍 ${pen.pen_id}: ${livestock.name} - ${status}`;
      });
    }

    inventoryReport() {
      const keys = Object.keys(this.state.inventory);
      if (!keys.length) return ["仓库为空。"];
      return keys.map((itemId) => `${ITEMS[itemId] ? ITEMS[itemId].name : itemId} x${this.state.inventory[itemId]}`);
    }

    characterReport() {
      return Object.keys(CHARACTERS).map((characterId) => {
        const def = CHARACTERS[characterId];
        return `${def.name}(${def.role}) - 好感 ${this.state.characters[characterId].favor}`;
      });
    }

    companyReport() {
      const company = this.state.company;
      return [
        `公司状态: ${company.unlocked ? "已成立" : "未成立"}`,
        `雇佣人数: ${company.employees}`,
        `品牌等级: ${company.brand_level}`,
        `品牌热度: ${company.brand_score}`,
        `加工坊等级: ${company.workshop_level}`,
        `养殖容量: ${company.ranch_capacity}`,
        `基础日薪: ${company.wage_per_employee}`,
        `员工士气: ${company.employee_morale}`,
        `分红比例: ${Math.round(company.dividend_rate * 100)}%`,
        `公司储备金: ${company.cash_reserve}`,
        `可分配利润池: ${company.profit_pool}`,
        `村民支持度: ${company.support_score}`
      ];
    }

    partnershipReport() {
      return [
        `科研合作: ${this.state.partnerships.science_progress}% ${this.state.partnerships.science_unlocked ? "(已解锁)" : ""}`,
        `政府合作: ${this.state.partnerships.government_progress}% ${this.state.partnerships.government_unlocked ? "(已解锁)" : ""}`,
        `企业合作: ${this.state.partnerships.business_progress}% ${this.state.partnerships.business_unlocked ? "(已解锁)" : ""}`,
        `村集体合作: ${this.state.partnerships.village_progress}% ${this.state.partnerships.village_unlocked ? "(已解锁)" : ""}`
      ];
    }

    taskReport() {
      return Object.keys(TASKS).map((taskId) => {
        const definition = TASKS[taskId];
        const taskState = this.state.tasks[taskId];
        const progress = Math.min(taskState.progress, definition.target_value);
        const label = taskState.claimed ? "已完成" : "进行中";
        return `[${definition.category}] ${definition.title} - ${progress}/${definition.target_value} - ${label}`;
      });
    }

    orderReport() {
      const lines = this.state.active_orders
        .filter((order) => !order.completed)
        .map((order) => {
          const required = Object.keys(order.required_items)
            .map((itemId) => `${ITEMS[itemId] ? ITEMS[itemId].name : itemId}x${order.required_items[itemId]}`)
            .join("、");
          return `${order.order_id} | ${order.title} | 需求: ${required} | 奖励: ${order.reward_money}元/${order.reward_particles}微粒`;
        });
      return lines.length ? lines : ["暂无可执行订单。"];
    }

    _getPlot(plotId) {
      return this.state.plots.find((plot) => plot.plot_id === plotId) || null;
    }

    _getPen(penId) {
      return this.state.pens.find((pen) => pen.pen_id === penId) || null;
    }

    _autoConvertEnergy() {
      while (this.state.resources.particles >= PARTICLES_PER_ENERGY) {
        this.state.resources.particles -= PARTICLES_PER_ENERGY;
        this.state.resources.source_energy += 1;
      }
    }

    _getPartnershipMultipliers() {
      const effects = {
        processing_output: 1.0,
        order_reward: 1.0,
        sales: 1.0,
        support_gain: 1.0
      };
      if (this.state.partnerships.science_unlocked) effects.processing_output *= 1.2;
      if (this.state.partnerships.government_unlocked) effects.order_reward *= 1.15;
      if (this.state.partnerships.business_unlocked) effects.sales *= 1.25;
      if (this.state.partnerships.village_unlocked) effects.support_gain *= 1.5;
      return effects;
    }

    _computeSupportGain(baseAmount) {
      return Math.trunc(baseAmount * this._getPartnershipMultipliers().support_gain);
    }

    _resolveTaskProgress(definition) {
      if (definition.target_type === "stat" || definition.target_type === "turn_stat") {
        return toInt(this.state.stats[definition.target_key], 0);
      }
      if (definition.target_type === "favor") {
        return toInt(this.state.characters[definition.target_key].favor, 0);
      }
      if (definition.target_type === "interaction") {
        return toInt(this.state.stats.interactions_by_character[definition.target_key], 0);
      }
      return 0;
    }

    _applyRewards(rewards) {
      this.state.resources.money += toInt(rewards.money, 0);
      this.state.resources.particles += toInt(rewards.particles, 0);
      this.state.resources.source_energy += toInt(rewards.source_energy, 0);
      this.state.resources.prosperity += toInt(rewards.prosperity, 0);
      const favorRewards = rewards.favor || {};
      Object.keys(favorRewards).forEach((characterId) => {
        if (this.state.characters[characterId]) {
          this.state.characters[characterId].favor += toInt(favorRewards[characterId], 0);
        }
      });
      this._autoConvertEnergy();
    }

    refreshTasks(resetDaily) {
      Object.keys(TASKS).forEach((taskId) => {
        const definition = TASKS[taskId];
        const taskState = this.state.tasks[taskId];
        if (definition.category === "日常" && resetDaily) {
          taskState.completed = false;
          taskState.claimed = false;
          taskState.progress = 0;
        }
        if ((definition.depends_on || []).some((dependency) => !this.state.tasks[dependency].claimed)) {
          return;
        }
        const progress = this._resolveTaskProgress(definition);
        taskState.progress = progress;
        if (progress < definition.target_value || taskState.claimed) {
          return;
        }
        taskState.completed = true;
        taskState.claimed = true;
        this._applyRewards(definition.rewards);
        this.addLog(`任务完成：${definition.title}。`);
      });
    }

    plantCrop(plotId, cropId) {
      const crop = CROPS[cropId];
      if (!crop) return "不存在的作物编号。";
      const plot = this._getPlot(plotId);
      if (!plot) return "不存在的土地编号。";
      if (plot.crop_id) return "该土地已被占用。";
      if (this.state.resources.money < crop.seed_cost) return "资金不足，无法购买种子。";
      plot.crop_id = cropId;
      plot.days_remaining = crop.grow_days;
      plot.ready_to_harvest = false;
      this.state.resources.money -= crop.seed_cost;
      this.state.stats.planted_count += 1;
      this.state.stats.current_turn_planted += 1;
      this.addLog(`在 ${plotId} 号地播种了 ${crop.name}。`);
      this.refreshTasks(false);
      return `播种成功：${crop.name}，预计 ${crop.grow_days} 天成熟。`;
    }

    harvestAll() {
      const harvested = [];
      this.state.plots.forEach((plot) => {
        if (!plot.crop_id || !plot.ready_to_harvest) return;
        const crop = CROPS[plot.crop_id];
        this.state.inventory[crop.crop_id] = toInt(this.state.inventory[crop.crop_id], 0) + crop.yield_amount;
        this.state.resources.particles += crop.particle_reward;
        this.state.stats.harvest_count += 1;
        harvested.push(crop.name);
        plot.crop_id = null;
        plot.days_remaining = 0;
        plot.ready_to_harvest = false;
      });
      if (!harvested.length) return "当前没有可收获作物。";
      this._autoConvertEnergy();
      this.addLog(`完成收获：${harvested.join("、")}。`);
      this.refreshTasks(false);
      return `本次收获：${harvested.join("、")}。已入库并获得微粒奖励。`;
    }

    raiseLivestock(penId, livestockId) {
      const livestock = LIVESTOCKS[livestockId];
      if (!livestock) return "不存在的养殖品种。";
      const activePens = this.state.pens.filter((pen) => pen.livestock_id).length;
      if (activePens >= this.state.company.ranch_capacity) return "当前扩栏容量不足，请先进行养殖扩栏。";
      const pen = this._getPen(penId);
      if (!pen) return "不存在的棚舍编号。";
      if (pen.livestock_id) return "该棚舍已被占用。";
      if (this.state.resources.money < livestock.buy_cost) return "资金不足，无法购入该养殖品种。";
      pen.livestock_id = livestockId;
      pen.days_remaining = livestock.cycle_days;
      pen.ready_to_collect = false;
      this.state.resources.money -= livestock.buy_cost;
      this.addLog(`在 ${penId} 号棚舍购入了 ${livestock.name}。`);
      return `养殖开始：${livestock.name}，预计 ${livestock.cycle_days} 天后产出。`;
    }

    collectLivestockProducts() {
      const collected = [];
      this.state.pens.forEach((pen) => {
        if (!pen.livestock_id || !pen.ready_to_collect) return;
        const livestock = LIVESTOCKS[pen.livestock_id];
        const itemId = livestock.product_item_id;
        this.state.inventory[itemId] = toInt(this.state.inventory[itemId], 0) + livestock.product_amount;
        this.state.resources.particles += livestock.particle_reward;
        this.state.stats.livestock_collections += 1;
        collected.push(`${livestock.name}->${ITEMS[itemId].name} x${livestock.product_amount}`);
        pen.days_remaining = livestock.cycle_days;
        pen.ready_to_collect = false;
      });
      if (!collected.length) return "当前没有可收取的养殖产物。";
      this._autoConvertEnergy();
      this.refreshTasks(false);
      this.addLog("完成了一轮养殖产物收取。");
      return `已收取：${collected.join("、")}。`;
    }

    processGoods(recipeId, batches) {
      const recipe = RECIPES[recipeId];
      if (!recipe) return "不存在的加工配方。";
      if (!this.state.system.unlocked_skills.includes("processing_workshop")) return "尚未解锁加工坊。";
      if (stageRank(this.state.stage) < stageRank(recipe.unlock_stage)) return "当前阶段尚未开放该配方。";
      const safeBatches = Math.max(1, toInt(batches, 1));
      const feeDiscount = Math.max(0.6, 1 - (this.state.company.workshop_level - 1) * WORKSHOP_PROCESSING_FEE_REDUCTION);
      const actualFee = Math.trunc(recipe.processing_fee * feeDiscount * this.state.company.processing_fee_multiplier);
      const requiredMoney = actualFee * safeBatches;
      if (this.state.resources.money < requiredMoney) return "资金不足，无法支付加工费用。";
      for (const itemId of Object.keys(recipe.inputs)) {
        if (toInt(this.state.inventory[itemId], 0) < recipe.inputs[itemId] * safeBatches) {
          return `库存不足，缺少 ${ITEMS[itemId].name}。`;
        }
      }
      for (const itemId of Object.keys(recipe.inputs)) {
        this.state.inventory[itemId] -= recipe.inputs[itemId] * safeBatches;
        if (this.state.inventory[itemId] <= 0) delete this.state.inventory[itemId];
      }
      this.state.resources.money -= requiredMoney;
      const multipliers = this._getPartnershipMultipliers();
      let outputBonus = 1 + (this.state.company.workshop_level - 1) * WORKSHOP_OUTPUT_BONUS_RATE;
      outputBonus *= this.state.company.processing_output_multiplier;
      outputBonus *= multipliers.processing_output;
      const producedAmount = Math.max(1, Math.trunc(recipe.output_amount * safeBatches * outputBonus));
      this.state.inventory[recipe.output_item_id] = toInt(this.state.inventory[recipe.output_item_id], 0) + producedAmount;
      this.state.resources.prosperity += safeBatches;
      this.state.stats.processed_batches += safeBatches;
      this.state.stats.current_turn_processed += safeBatches;
      this.state.company.brand_level = Math.max(this.state.company.brand_level, 1);
      this.state.company.profit_pool += Math.trunc(requiredMoney * 0.25);
      this.addLog(`完成加工：${recipe.name} x${safeBatches}。`);
      this.refreshTasks(false);
      return `已完成 ${recipe.name} 加工 ${safeBatches} 批，产出 ${producedAmount}。`;
    }

    prepareCompany() {
      if (!this.state.system.unlocked_skills.includes("village_company")) return "尚未完成村办公司筹备技能解锁。";
      if (this.state.company.unlocked) return "村办公司已成立。";
      this.state.company.unlocked = true;
      this.state.company.dividend_rate = 0.1;
      this.state.company.brand_level = Math.max(this.state.company.brand_level, 1);
      this.state.company.wage_per_employee = 80;
      this.state.company.employee_morale = 68;
      this.state.company.cash_reserve += 1000;
      this.state.company.profit_pool += 400;
      this.state.resources.prosperity += 3;
      this.addLog("刘家村村办公司正式挂牌。");
      this.evaluateStageProgression();
      return "村办公司已成立，雇佣与分红系统开放。";
    }

    hireVillagers(count) {
      if (!this.state.company.unlocked) return "请先成立村办公司。";
      const safeCount = Math.max(1, toInt(count, 1));
      const supportMultiplier = 1 - this.state.company.support_score / 200;
      const hiringCost = Math.trunc(500 * safeCount * supportMultiplier);
      if (this.state.resources.money < hiringCost) return "资金不足，无法完成雇佣。";
      this.state.resources.money -= hiringCost;
      this.state.company.employees += safeCount;
      this.state.stats.villagers_hired += safeCount;
      this.state.resources.prosperity += safeCount * 2;
      this.state.company.cash_reserve += safeCount * 200;
      this.state.company.employee_morale = Math.min(100, this.state.company.employee_morale + safeCount);
      this.addLog(`新增雇佣村民 ${safeCount} 人。`);
      this.evaluateStageProgression();
      this.refreshTasks(false);
      return `已雇佣 ${safeCount} 名村民，就业与产能同步提升。`;
    }

    distributeDividends() {
      if (!this.state.company.unlocked) return "请先成立村办公司。";
      if (this.state.company.employees <= 0) return "当前没有可参与分红的村民。";
      const basePool = Math.min(this.state.company.profit_pool, this.state.resources.money);
      const baseDividend = Math.trunc(basePool * this.state.company.dividend_rate);
      if (baseDividend <= 0) return "当前没有足够利润用于分红。";
      this.state.resources.money -= baseDividend;
      this.state.company.profit_pool = Math.max(0, this.state.company.profit_pool - baseDividend);
      this.state.company.cash_reserve += Math.max(0, Math.trunc(baseDividend * 0.25));
      this.state.resources.prosperity += this.state.company.employees + this.state.company.brand_level;
      this.state.stats.dividend_rounds += 1;
      this.state.company.employee_morale = Math.min(100, this.state.company.employee_morale + 4);
      const supportGain = this._computeSupportGain(Math.min(5, Math.trunc(baseDividend / 10000) + 1));
      this.state.company.support_score = Math.min(100, this.state.company.support_score + supportGain);
      this.addLog(`完成了第 ${this.state.stats.dividend_rounds} 轮村民分红。`);
      this.refreshTasks(false);
      return `已完成分红，支出 ${baseDividend} 元，村民满意度提升。`;
    }

    expandRanch(blocks) {
      const safeBlocks = Math.max(1, toInt(blocks, 1));
      let totalCost = 0;
      for (let index = 0; index < safeBlocks; index += 1) {
        totalCost += RANCH_EXPANSION_BASE_COST + (this.state.company.ranch_capacity + index - 1) * 260;
      }
      if (this.state.resources.money < totalCost) return "资金不足，无法完成扩栏。";
      this.state.resources.money -= totalCost;
      const oldCapacity = this.state.company.ranch_capacity;
      this.state.company.ranch_capacity += safeBlocks;
      for (let i = 0; i < safeBlocks; i += 1) {
        this.state.pens.push({ pen_id: this.state.pens.length + 1, livestock_id: null, days_remaining: 0, ready_to_collect: false });
      }
      this.state.stats.ranch_expansions += safeBlocks;
      this.state.resources.prosperity += safeBlocks;
      this.addLog(`养殖扩栏完成：容量 ${oldCapacity} -> ${this.state.company.ranch_capacity}。`);
      return `扩栏成功，新增 ${safeBlocks} 个棚舍，总成本 ${totalCost} 元。`;
    }

    upgradeWorkshop() {
      if (!this.state.system.unlocked_skills.includes("processing_workshop")) return "请先解锁加工坊技能。";
      const nextLevel = this.state.company.workshop_level + 1;
      if (nextLevel > 5) return "加工坊已达到最高等级。";
      const cost = WORKSHOP_UPGRADE_BASE_COST + (nextLevel - 2) * 700;
      if (this.state.resources.money < cost) return "资金不足，无法升级加工坊。";
      this.state.resources.money -= cost;
      this.state.company.workshop_level = nextLevel;
      this.state.stats.workshop_upgrades += 1;
      this.state.resources.prosperity += 2;
      this.state.company.brand_level = Math.min(5, this.state.company.brand_level + 1);
      this.addLog(`加工坊升级至 Lv${nextLevel}，成本 ${cost} 元。`);
      return `加工坊已升级至 Lv${nextLevel}。`;
    }

    sellInventory(channel) {
      if (!Object.keys(this.state.inventory).length) return "仓库为空，没有可销售的农产品。";
      let total = 0;
      const soldLines = [];
      const skillMultiplier = channel === "stream" && this.state.system.unlocked_skills.includes("live_boost") ? 1.2 : 1.0;
      const baseMultiplier = channel === "stream" ? 1.1 : 1.0;
      const brandMultiplier = 1 + this.state.company.brand_score / 200;
      const businessMultiplier = this._getPartnershipMultipliers().sales;
      Object.keys(this.state.inventory).forEach((itemId) => {
        const amount = this.state.inventory[itemId];
        const item = ITEMS[itemId];
        const revenue = Math.trunc(item.sell_price * amount * baseMultiplier * skillMultiplier * brandMultiplier * businessMultiplier);
        total += revenue;
        soldLines.push(`${item.name} x${amount}`);
        delete this.state.inventory[itemId];
      });
      this.state.resources.money += total;
      this.state.stats.sales_revenue += total;
      this.state.company.profit_pool += Math.trunc(total * 0.3);
      let brandGain = Math.min(4, Math.max(1, Math.trunc(total / 50000)));
      if (channel === "stream") brandGain = Math.trunc(brandGain * 1.5);
      this.state.company.brand_score = Math.min(100, this.state.company.brand_score + brandGain);
      if (channel === "stream") {
        this.state.stats.stream_count += 1;
        this.state.stats.current_turn_streamed += 1;
        this.state.characters.wang_nan.favor += 2;
        this.state.resources.prosperity += 1;
        this.addLog("王楠协助完成了一场直播带货。");
      }
      this.refreshTasks(false);
      return `已通过${channel === "stream" ? "直播" : "集市"}售出 ${soldLines.join("、")}，收入 ${total} 元。`;
    }

    interact(characterId) {
      const definition = CHARACTERS[characterId];
      if (!definition) return "不存在的角色编号。";
      this.state.characters[characterId].favor += definition.favor_gain;
      this.state.resources.prosperity += definition.prosperity_gain;
      this.state.resources.money += definition.money_gain;
      this.state.resources.particles += definition.particle_gain;
      this.state.stats.interaction_count += 1;
      this.state.stats.current_turn_interactions += 1;
      this.state.stats.interactions_by_character[characterId] = toInt(this.state.stats.interactions_by_character[characterId], 0) + 1;
      this._autoConvertEnergy();
      this.addLog(`与 ${definition.name} 互动，关系有所提升。`);
      this.refreshTasks(false);
      return `与 ${definition.name} 交流完成，好感 +${definition.favor_gain}，共同富裕指数 +${definition.prosperity_gain}。`;
    }

    unlockSkill(skillId) {
      const skill = SKILLS[skillId];
      if (!skill) return "不存在的系统技能。";
      if (this.state.system.unlocked_skills.includes(skillId)) return "该技能已解锁。";
      if (stageRank(this.state.stage) < stageRank(skill.required_stage)) return "当前阶段尚未达到技能解锁条件。";
      if (this.state.resources.source_energy < skill.energy_cost) return "生命源能不足。";
      this.state.resources.source_energy -= skill.energy_cost;
      this.state.system.unlocked_skills.push(skillId);
      if (skillId === "smart_irrigation") {
        this.state.plots.push({ plot_id: this.state.plots.length + 1, crop_id: null, days_remaining: 0, ready_to_harvest: false });
        this.state.pens.push({ pen_id: this.state.pens.length + 1, livestock_id: null, days_remaining: 0, ready_to_collect: false });
      }
      if (skillId === "village_company") this.state.resources.prosperity += 5;
      if (skillId === "processing_workshop") this.state.company.brand_level = Math.max(this.state.company.brand_level, 1);
      this.addLog(`系统技能已解锁：${skill.name}。`);
      this.evaluateStageProgression();
      return `已解锁技能：${skill.name}。`;
    }

    fulfillOrder(orderIdOrTitle) {
      const target = this.state.active_orders.find((order) => !order.completed && (order.order_id === orderIdOrTitle || order.title === orderIdOrTitle));
      if (!target) return "不存在可交付的订单编号。";
      for (const itemId of Object.keys(target.required_items)) {
        if (toInt(this.state.inventory[itemId], 0) < target.required_items[itemId]) {
          return `库存不足，订单缺少 ${ITEMS[itemId].name}。`;
        }
      }
      for (const itemId of Object.keys(target.required_items)) {
        this.state.inventory[itemId] -= target.required_items[itemId];
        if (this.state.inventory[itemId] <= 0) delete this.state.inventory[itemId];
      }
      target.completed = true;
      const orderMultiplier = this.state.company.order_reward_multiplier * this._getPartnershipMultipliers().order_reward;
      const rewardMoney = Math.trunc(target.reward_money * orderMultiplier);
      const rewardParticles = Math.trunc(target.reward_particles * orderMultiplier);
      this.state.resources.money += rewardMoney;
      this.state.resources.particles += rewardParticles;
      this.state.resources.prosperity += target.reward_prosperity;
      this.state.company.profit_pool += Math.trunc(rewardMoney * 0.35);
      this.state.company.employee_morale = Math.min(100, this.state.company.employee_morale + 2);
      const brandGain = Math.min(3, Math.max(1, Math.trunc(rewardMoney / 100000)));
      this.state.company.brand_score = Math.min(100, this.state.company.brand_score + brandGain);
      this.state.stats.orders_completed += 1;
      this._autoConvertEnergy();
      this.refreshTasks(false);
      this.addLog(`完成订单：${target.title}。`);
      this._refreshOrders(false);
      return `订单交付成功：${target.title}。`;
    }

    advancePartnership(partnerType, costEnergy) {
      const safeCost = Math.max(1, toInt(costEnergy, 30));
      if (this.state.resources.source_energy < safeCost) return `能量不足，需要 ${safeCost}，当前仅有 ${this.state.resources.source_energy}。`;
      const mapping = {
        science: ["science_progress", "science_unlocked", "科研合作", 2],
        government: ["government_progress", "government_unlocked", "政府合作", 3],
        business: ["business_progress", "business_unlocked", "企业合作", 3],
        village_collective: ["village_progress", "village_unlocked", "村集体合作", 1]
      };
      const entry = mapping[partnerType];
      if (!entry) return "不存在的合作类型。";
      const companyLevel = this.companyLevelByProfit(this.state.resources.money + this.state.company.profit_pool);
      if (companyLevel < entry[3]) return `${entry[2]}需要公司达到 Lv${entry[3]} 才能开启。`;
      this.state.resources.source_energy -= safeCost;
      const progressField = entry[0];
      const unlockedField = entry[1];
      const currentProgress = this.state.partnerships[progressField];
      const newProgress = Math.min(100, currentProgress + 10);
      this.state.partnerships[progressField] = newProgress;
      if (newProgress === 100 && !this.state.partnerships[unlockedField]) {
        this.state.partnerships[unlockedField] = true;
        this.state.resources.prosperity += 3;
        this.state.company.support_score = Math.min(100, this.state.company.support_score + 3);
        this.addLog(`${entry[2]}达成，解锁长期加成。`);
        return `${entry[2]}已达成！解锁新的合作机遇。`;
      }
      this.addLog(`${entry[2]}进度推进至 ${newProgress}%。`);
      return `${entry[2]}进度：${currentProgress}% → ${newProgress}%`;
    }

    applyBalanceConfig(wagePerEmployee, dividendRatePercent, processingFeeMultiplier, processingOutputMultiplier, orderRewardMultiplier) {
      this.state.company.wage_per_employee = clamp(toInt(wagePerEmployee, 80), 40, 300);
      this.state.company.dividend_rate = clamp(Number(dividendRatePercent) / 100, 0.05, 0.4);
      this.state.company.processing_fee_multiplier = clamp(Number(processingFeeMultiplier), 0.5, 1.8);
      this.state.company.processing_output_multiplier = clamp(Number(processingOutputMultiplier), 0.7, 2.2);
      this.state.company.order_reward_multiplier = clamp(Number(orderRewardMultiplier), 0.6, 2.0);
      this.addLog("已应用经营平衡参数。");
      return "平衡参数已更新。";
    }

    simulateProjection(days) {
      const safeDays = clamp(toInt(days, 7), 1, 30);
      const preview = this.clone();
      const baselineMoney = preview.state.resources.money;
      const baselineProsperity = preview.state.resources.prosperity;
      const baselineEnergy = preview.state.resources.source_energy;
      for (let i = 0; i < safeDays; i += 1) {
        try {
          preview.advanceDay();
        } catch (_) {
          break;
        }
      }
      return {
        days: safeDays,
        money_delta: preview.state.resources.money - baselineMoney,
        prosperity_delta: preview.state.resources.prosperity - baselineProsperity,
        energy_delta: preview.state.resources.source_energy - baselineEnergy,
        employees: preview.state.company.employees
      };
    }

    _generateDailyWorld() {
      const timeSlots = ["清晨", "上午", "中午", "下午", "傍晚", "夜晚"];
      const weatherChoices = ["晴朗", "多云", "小雨", "大雨", "微风"];
      const seasonCycle = ["初夏", "盛夏", "初秋", "深秋", "初冬", "深冬", "初春", "晚春"];
      const currentIndex = Math.max(0, timeSlots.indexOf(this.state.time));
      this.state.time = timeSlots[(currentIndex + 1) % timeSlots.length];
      this.state.weather = weatherChoices[Math.floor(Math.random() * weatherChoices.length)];
      const seasonIndex = Math.min(Math.trunc((this.state.turn - 1) / 30), seasonCycle.length - 1);
      this.state.season = seasonCycle[seasonIndex];
      if (this.state.weather === "小雨" || this.state.weather === "大雨") {
        this.state.resources.family_harmony = Math.min(100, this.state.resources.family_harmony + 1);
      }
      if (this.state.company.unlocked) {
        this.state.resources.villager_support = Math.min(100, this.state.resources.villager_support + 1);
      }
      const events = [
        "父亲去田里看水渠，顺手把农具摆整齐了。",
        "母亲提醒你注意休息，别把身体拖垮。",
        "王楠发来语音，说短视频素材已经剪好。",
        "村口传来消息，明天集市会更热闹。"
      ];
      this.state.event_text = `${this.state.weather}的${this.state.time}，${events[Math.floor(Math.random() * events.length)]}`;
    }

    advanceDay() {
      this.state.turn += 1;
      this.state.stats.days_played += 1;
      this.state.resources.particles += this.state.system.daily_particles;
      this._generateDailyWorld();
      const speedBonus = this.state.system.unlocked_skills.includes("automation_kit") ? 1 : 0;
      this.state.plots.forEach((plot) => {
        if (!plot.crop_id || plot.ready_to_harvest) return;
        plot.days_remaining -= 1 + speedBonus;
        if (plot.days_remaining <= 0) {
          plot.days_remaining = 0;
          plot.ready_to_harvest = true;
        }
      });
      this.state.pens.forEach((pen) => {
        if (!pen.livestock_id || pen.ready_to_collect) return;
        pen.days_remaining -= 1;
        if (pen.days_remaining <= 0) {
          pen.days_remaining = 0;
          pen.ready_to_collect = true;
        }
      });
      if (this.state.company.unlocked && this.state.company.employees > 0) {
        const payroll = this.state.company.employees * this.state.company.wage_per_employee;
        if (this.state.resources.money >= payroll) {
          this.state.resources.money -= payroll;
          this.state.company.cash_reserve += Math.trunc(payroll * 0.2);
          this.state.company.employee_morale = Math.min(100, this.state.company.employee_morale + 1);
          const supportGain = this._computeSupportGain(Math.min(2, Math.max(1, Math.trunc(this.state.company.employees / 5))));
          this.state.company.support_score = Math.min(100, this.state.company.support_score + supportGain);
          this.addLog(`村办公司发放日常劳务支出 ${payroll} 元。`);
        } else {
          this.state.company.employee_morale = Math.max(0, this.state.company.employee_morale - 8);
          this.state.resources.prosperity = Math.max(0, this.state.resources.prosperity - 1);
          this.state.company.support_score = Math.max(0, this.state.company.support_score - 2);
          this.addLog("工资发放不足，村民士气下降。");
        }
      }
      if (this.state.company.unlocked && this.state.company.employee_morale < 30 && this.state.company.employees > 0) {
        this.state.company.employees -= 1;
        this.state.resources.prosperity = Math.max(0, this.state.resources.prosperity - 2);
        this.addLog("因士气过低，有村民退出公司。");
      }
      this._autoConvertEnergy();
      this._refreshOrders(false);
      this.evaluateStageProgression();
      this.state.stats.current_turn_planted = 0;
      this.state.stats.current_turn_interactions = 0;
      this.state.stats.current_turn_streamed = 0;
      this.state.stats.current_turn_processed = 0;
      this.refreshTasks(true);
      this.addLog("新的一天开始了，系统完成日常结算。");
      this.validateRuntimeState();
      return `第 ${this.state.turn} 天开始。今日自动获得 ${this.state.system.daily_particles} 微粒。`;
    }

    validateRuntimeState() {
      if (this.state.resources.money < 0) throw new Error("资金不应为负数。");
      if (this.state.resources.particles < 0) throw new Error("微粒不应为负数。");
      if (this.state.resources.source_energy < 0) throw new Error("生命源能不应为负数。");
      if (this.state.company.employees < 0) throw new Error("雇佣人数不应为负数。");
    }

    evaluateStageProgression() {
      if (this.state.stage === "startup") {
        const req = STAGE_REQUIREMENTS.scale_up;
        if (this.state.resources.money >= req.money && this.state.stats.harvest_count >= req.harvest_count && this.state.characters.wang_nan.favor >= req.favor_wang_nan) {
          this.state.stage = "scale_up";
          this.state.system.level = 3;
          this.state.system.daily_particles = SYSTEM_LEVELS[3].daily_particles;
          this.addLog("阶段升级：你已进入产业升级期。");
        }
      }
      if (this.state.stage === "scale_up") {
        const req = STAGE_REQUIREMENTS.common_prosperity;
        if (this.state.resources.money >= req.money && this.state.resources.prosperity >= req.prosperity && this.state.company.employees >= req.employees && this.state.system.unlocked_skills.includes(req.skill)) {
          this.state.stage = "common_prosperity";
          this.addLog("阶段升级：共同富裕路径已正式建立。");
        }
      }
    }

    _refreshOrders(force) {
      const activeOrders = this.state.active_orders.filter((order) => !order.completed);
      if (!force && this.state.turn % ORDER_DAILY_ROLL_INTERVAL !== 0) return;
      if (activeOrders.length >= 3) return;
      const pool = Object.keys(ORDER_TEMPLATES)
        .map((orderId) => ORDER_TEMPLATES[orderId])
        .filter((order) => stageRank(this.state.stage) >= stageRank(order.unlock_stage));
      if (!pool.length) return;
      const order = pool[(this.state.turn + activeOrders.length) % pool.length];
      if (this.state.active_orders.some((existing) => existing.order_id === order.order_id && !existing.completed)) return;
      this.state.active_orders.push({
        order_id: order.order_id,
        title: order.title,
        required_items: deepClone(order.required_items),
        reward_money: order.reward_money,
        reward_prosperity: order.reward_prosperity,
        reward_particles: order.reward_particles,
        completed: false
      });
      this.addLog(`新订单到达：${order.title}。`);
    }

    companyLevelByProfit(totalProfit) {
      if (totalProfit >= 1000000) return 5;
      if (totalProfit >= 500000) return 4;
      if (totalProfit >= 200000) return 3;
      if (totalProfit >= 50000) return 2;
      if (totalProfit >= 10000) return 1;
      return 0;
    }

    chapterProgress(chapterId) {
      const mapping = {
        v1c1: Math.min(100, this.state.stats.harvest_count * 40),
        v1c2: Math.min(100, this.state.stats.interaction_count * 20),
        v1c3: Math.min(100, this.state.stats.stream_count * 50),
        v1c4: Math.min(100, (this.state.characters.liu_huaizhi.favor + this.state.characters.liu_xiaoxue.favor) * 4),
        v2c1: Math.min(100, this.state.stats.processed_batches * 35),
        v2c2: Math.min(100, this.state.stats.ranch_expansions * 50),
        v2c3: Math.min(100, this.state.stats.villagers_hired * 20),
        v2c4: Math.min(100, this.state.stats.orders_completed * 30),
        v3c1: Math.min(100, this.state.stats.orders_completed * 25),
        v3c2: Math.min(100, this.state.resources.prosperity * 4),
        v3c3: Math.min(100, this.state.stats.dividend_rounds * 50),
        v3c4: Math.min(100, this.state.resources.prosperity * 3)
      };
      return mapping[chapterId] || 0;
    }

    updatePlayerProfile(name, identity, returnReason) {
      this.state.player_profile.name = String(name || this.state.player_profile.name).slice(0, 32);
      this.state.player_profile.identity = String(identity || this.state.player_profile.identity).slice(0, 64);
      this.state.player_profile.return_reason = String(returnReason || this.state.player_profile.return_reason).slice(0, 200);
      this.state.open_mode.profile_saved = true;
      this.state.open_mode.options_ready = false;
      this.state.open_mode.last_options = [];
      this.addLog(`主角设定已更新：${this.state.player_profile.name} / ${this.state.player_profile.identity}。`);
      return "主角设定已保存，后续推理将使用新设定。";
    }

    defaultDailyOptions(turn) {
      if (turn <= 1) {
        return [
          "去村口小卖部和村民聊天，收集当天行情与闲置资源线索",
          "先完成一轮农田巡检和播种准备，确保明天能稳定收获",
          "联系王楠沟通短视频选题，试水一场低成本直播预热"
        ];
      }
      if (turn % 3 === 1) {
        return [
          "优先处理生产：收获与播种衔接，保证现金流不断档",
          "优先处理关系：拜访家人和村干部，争取协同与政策支持",
          "优先处理销售：做一次集市或线上试卖，换取快速回款"
        ];
      }
      if (turn % 3 === 2) {
        return [
          "把今天重点放在加工链路，尝试提升单位产出",
          "把今天重点放在订单履约，稳住信誉并积累品牌",
          "把今天重点放在人力协作，优化分工与执行节奏"
        ];
      }
      return [
        "安排一次低风险公共投入，提升村民认可度和共富指数",
        "进行一次成本复盘，压缩不必要开支并回收现金",
        "尝试一次高收益动作，接受波动换取阶段性突破"
      ];
    }

    openModeOptions(scene, playerGoal) {
      if (!this.state.open_mode.profile_saved) {
        return ["请先完成主角设定，再生成行动建议。"];
      }
      const safeScene = String(scene || "刘家村村口").trim() || "刘家村村口";
      const safeGoal = String(playerGoal || "低压力推进经营并保持家庭关系稳定").trim() || "低压力推进经营并保持家庭关系稳定";
      const options = this.defaultDailyOptions(this.state.turn);
      this.state.open_mode.last_scene = safeScene;
      this.state.open_mode.last_goal = safeGoal;
      this.state.open_mode.last_options = options.slice(0, 3);
      this.state.open_mode.options_ready = true;
      return options;
    }

    deriveOpenEffects(selectedAction) {
      const text = String(selectedAction || "").trim().toLowerCase();
      if (["直播", "带货", "销售", "集市", "电商"].some((token) => text.includes(token))) {
        return { money: 260, particles: 90, prosperity: 1, laziness: -1 };
      }
      if (["播种", "农田", "收获", "养殖", "加工"].some((token) => text.includes(token))) {
        return { money: 150, particles: 160, prosperity: 1, laziness: -2 };
      }
      if (["家人", "村民", "沟通", "拜访", "协同"].some((token) => text.includes(token))) {
        return { money: 80, particles: 70, prosperity: 3, laziness: -1 };
      }
      if (["复盘", "预算", "成本", "计划", "整理"].some((token) => text.includes(token))) {
        return { money: 120, particles: 110, prosperity: 2, laziness: -1 };
      }
      if (["扩张", "高收益", "冒险", "贷款", "投资"].some((token) => text.includes(token))) {
        return { money: 340, particles: 40, prosperity: -1, laziness: -3 };
      }
      return { money: 140, particles: 100, prosperity: 1, laziness: -1 };
    }

    buildRichResultText(scene, selectedAction, effects) {
      const name = this.state.player_profile.name || "你";
      return `${name}在“${scene}”执行了“${selectedAction}”。白天你先和关键人物对齐了行动节奏，再把执行拆成可落地的两步，避免了无效忙碌。傍晚复盘时，村里对你的信任明显提高，后续合作也更顺畅。本次行动即时结算：资金 ${effects.money >= 0 ? "+" : ""}${effects.money}，微粒 ${effects.particles >= 0 ? "+" : ""}${effects.particles}，共富 ${effects.prosperity >= 0 ? "+" : ""}${effects.prosperity}，躺平值 ${effects.laziness >= 0 ? "+" : ""}${effects.laziness}。`;
    }

    applyOpenEffects(effects) {
      this.state.resources.money = Math.max(0, this.state.resources.money + toInt(effects.money, 0));
      this.state.resources.particles = Math.max(0, this.state.resources.particles + toInt(effects.particles, 0));
      this.state.resources.prosperity = Math.max(0, this.state.resources.prosperity + toInt(effects.prosperity, 0));
      this.state.resources.laziness = clamp(this.state.resources.laziness + toInt(effects.laziness, 0), 0, 100);
      this._autoConvertEnergy();
    }

    resolveOpenActionLocal(scene, selectedAction) {
      const safeScene = String(scene || "刘家村村口").trim() || "刘家村村口";
      const safeAction = String(selectedAction || "先在村里散步并观察行情").trim() || "先在村里散步并观察行情";
      const effects = this.deriveOpenEffects(safeAction);
      this.applyOpenEffects(effects);
      const text = this.buildRichResultText(safeScene, safeAction, effects);
      this.addLog(`开放玩法：${safeAction}`);
      this.addLog(text);
      const dayResult = this.advanceDay();
      const nextScene = `刘家村，第 ${this.state.turn} 天，清晨`;
      const nextGoal = this.state.open_mode.last_goal || "稳住现金流并推进主线";
      const nextOptions = this.openModeOptions(nextScene, nextGoal);
      this.state.open_mode.last_play_result = text;
      this.state.open_mode.last_stat_delta = `资金 ${effects.money >= 0 ? "+" : ""}${effects.money} | 共富 ${effects.prosperity >= 0 ? "+" : ""}${effects.prosperity} | 微粒 ${effects.particles >= 0 ? "+" : ""}${effects.particles}`;
      return `${text}\n【日结】${dayResult}\n【次日可选行动】\n${nextOptions.map((item, index) => `${index + 1}. ${item}`).join("\n")}`;
    }

    applyRemoteOpenResolution(scene, selectedAction, payload) {
      const effects = Object.assign(this.deriveOpenEffects(selectedAction), payload.effects || {});
      this.applyOpenEffects(effects);
      const rawText = String(payload.text || payload.result || payload.output || payload.content || "").trim();
      const safeText = rawText || this.buildRichResultText(scene, selectedAction, effects);
      this.addLog(`开放玩法（中转）：${selectedAction}`);
      this.addLog(safeText);
      const dayResult = this.advanceDay();
      const nextScene = `刘家村，第 ${this.state.turn} 天，清晨`;
      const nextGoal = this.state.open_mode.last_goal || "稳住现金流并推进主线";
      const nextOptions = Array.isArray(payload.next_options || payload.options)
        ? (payload.next_options || payload.options).map((item) => String(item || "").trim()).filter(Boolean).slice(0, 3)
        : this.openModeOptions(nextScene, nextGoal).slice(0, 3);
      this.state.open_mode.last_options = nextOptions;
      this.state.open_mode.last_play_result = safeText;
      return `${safeText}\n【日结】${dayResult}\n【次日可选行动】\n${nextOptions.map((item, index) => `${index + 1}. ${item}`).join("\n")}`;
    }

    playPanelModeAction(scene, selectedAction) {
      return this.resolveOpenActionLocal(scene, selectedAction).split("【次日可选行动】", 1)[0].trim();
    }

    endingSummary() {
      return ENDING_TEXT[this.state.stage] || ENDING_TEXT.startup;
    }
  }

  global.AllRichGameEngine = {
    StaticGameEngine,
    createNewGameState: () => StaticGameEngine.newGame().state,
    gameData: { CROPS, ITEMS, LIVESTOCKS, RECIPES, SKILLS, CHARACTERS, STAGE_LABELS, STORY_COMMANDS }
  };
})(window);