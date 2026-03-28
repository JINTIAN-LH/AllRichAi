from __future__ import annotations
# pyright: reportUnusedFunction=false

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from flask import Flask, jsonify, redirect, render_template, request, url_for

from farmgame.balance import CROPS, ITEMS, LIVESTOCKS, RECIPES, SKILLS
from farmgame.content import CHARACTERS
from farmgame.engine import GameEngine
from farmgame.narrative import test_llm_configuration
from farmgame.storage import load_game, save_game

WEB_SAVE_PATH = Path("saves") / "web_save.json"
WEB_SLOT_DIR = Path("saves") / "web_slots"
WEB_SLOT_COUNT = 4
DEFAULT_LLM_CONFIG_PATH = Path("config") / "llm_api.json"

DAY1_PRESETS = [
    "沿村道走一圈，记录可用荒地位置",
    "拜访父亲，了解家里农田现状和工具",
    "去镇上调研蔬菜收购价格和当天需求",
]


def create_app() -> Flask:
    app = Flask(__name__)
    asset_version = str(int(datetime.now(timezone.utc).timestamp()))
    app.config["ASSET_VERSION"] = asset_version

    @app.context_processor
    def inject_asset_version():
        return {"asset_version": asset_version}

    @app.get("/")
    def index():
        engine = _load_engine()
        company_design = _build_company_design(engine)
        llm_config = _load_llm_config_for_form()
        last_opts = list(engine.state.open_mode.last_options)
        if engine.state.open_mode.profile_saved and not last_opts:
            scene = f"刘家村，第 {engine.state.turn} 天，清晨"
            goal = engine.state.open_mode.last_goal or "低压力推进经营并保持家庭关系稳定"
            last_opts = engine.open_mode_options(scene, goal)
            save_game(engine.state, WEB_SAVE_PATH)
        current_options = (last_opts[:3] if last_opts else DAY1_PRESETS)
        return render_template(
            "home.html",
            page="home",
            snapshot=engine.status_snapshot(),
            company_design=company_design,
            player_profile=engine.state.player_profile,
            open_mode=engine.open_mode_status(),
            current_options=current_options,
            next_modal=request.args.get("next_modal", ""),
            plots=engine.plot_report(),
            pens=engine.pen_report(),
            inventory=engine.inventory_report(),
            sellable_items=_build_sellable_items(engine),
            characters=engine.character_report(),
            tasks=engine.task_report(),
            company=engine.company_report(),
            orders=engine.order_report(),
            logs=engine.state.log[-8:],
            save_slots=_list_slots(),
            crops=engine.available_crops(),
            livestocks=engine.available_livestock(),
            recipes=engine.available_recipes(),
            crop_defs=CROPS,
            livestock_defs=LIVESTOCKS,
            recipe_defs=RECIPES,
            character_defs=CHARACTERS,
            skills=SKILLS,
            unlocked_skills=set(engine.state.system.unlocked_skills),
            llm_config=llm_config,
            flash_message=request.args.get("message", ""),
        )

    @app.get("/story")
    def story_board():
        return redirect(url_for("story_panel"))

    # ========== 全局面板推进模式 Start ==========
    @app.get("/story-panel")
    def story_panel():
        """全局面板推进模式主页"""
        engine = _load_engine()
        return render_template(
            "story_panel.html",
            page="story-panel",
            snapshot=engine.status_snapshot(),
            flash_message=request.args.get("message", ""),
        )

    @app.post("/api/story/execute-command")
    def api_execute_command():
        """执行当前指令并返回结果"""
        try:
            data = request.get_json() or {}
            command = data.get("command", "").strip()
            goal = data.get("goal", "低压力推进经营并保持家庭关系稳定")
            fixed_commands = {
                "1": "农业行动：查看自家田地",
                "2": "人物互动：和父亲聊天",
                "3": "电商行动：联系王楠",
                "4": "探索行动：出门逛村子",
                "5": "躺平休息：回房间睡觉摆烂",
                "6": "系统操作：打开躺平智辅面板",
            }
            
            if not command:
                return jsonify({"success": False, "error": "指令不能为空"}), 400

            selected_command = fixed_commands.get(command, command)
            
            engine = _load_engine()
            
            # 记录状态前的数值
            money_before = engine.state.resources.money
            particles_before = engine.state.resources.particles
            source_energy_before = engine.state.resources.source_energy
            laziness_before = engine.state.resources.laziness
            
            # 生成场景和执行指令
            scene = f"刘家村，第 {engine.state.turn} 天，清晨"
            
            # 执行指令并获取结果
            result = engine.play_panel_mode_action(scene, selected_command)
            
            # 记录到日志
            engine.add_log(f"→ {selected_command[:50]}")
            if result:
                engine.add_log(f"✓ {result[:80]}...")
            
            # 保存游戏状态
            save_game(engine.state, WEB_SAVE_PATH)
            
            # 计算数值变化
            stat_changes = {
                "资金": engine.state.resources.money - money_before,
                "微粒": engine.state.resources.particles - particles_before,
                "生命源能": engine.state.resources.source_energy - source_energy_before,
                "躺平意愿": engine.state.resources.laziness - laziness_before,
            }
            
            # 获取新状态
            new_snapshot = engine.status_snapshot()
            
            return jsonify({
                "success": True,
                "result_text": result or "指令执行完成",
                "stat_changes": stat_changes,
                "updated_state": {
                    "turn": new_snapshot.get("turn", 1),
                    "money": new_snapshot.get("money", 0),
                    "particles": new_snapshot.get("particles", 0),
                    "source_energy": new_snapshot.get("source_energy", 0),
                    "laziness": new_snapshot.get("laziness", 0),
                }
            })
        
        except Exception as e:
            return jsonify({
                "success": False,
                "error": f"执行失败: {str(e)}"
            }), 500

    @app.get("/api/story/panel-state")
    def api_panel_state():
        """获取当前全部面板数据"""
        try:
            engine = _load_engine()
            return jsonify({
                "success": True,
                "snapshot": engine.status_snapshot(),
                "logs": engine.state.log[-5:],
            })
        
        except Exception as e:
            return jsonify({
                "success": False,
                "error": f"获取数据失败: {str(e)}"
            }), 500
    
    # ========== 全局面板推进模式 End ==========

    @app.get("/balance")
    def balance_page():
        engine = _load_engine()
        company_design = _build_company_design(engine)
        return render_template(
            "balance.html",
            page="balance",
            snapshot=engine.status_snapshot(),
            company=engine.state.company,
            company_design=company_design,
            flash_message=request.args.get("message", ""),
            replay_result=request.args.get("replay_result", ""),
        )

    @app.post("/balance/apply")
    def balance_apply():
        engine = _load_engine()
        message = engine.apply_balance_config(
            wage_per_employee=int(request.form.get("wage_per_employee", "80")),
            dividend_rate_percent=float(request.form.get("dividend_rate_percent", "10")),
            processing_fee_multiplier=float(request.form.get("processing_fee_multiplier", "1.0")),
            processing_output_multiplier=float(request.form.get("processing_output_multiplier", "1.0")),
            order_reward_multiplier=float(request.form.get("order_reward_multiplier", "1.0")),
        )
        save_game(engine.state, WEB_SAVE_PATH)
        return redirect(url_for("balance_page", message=message))

    @app.post("/balance/replay")
    def balance_replay():
        engine = _load_engine()
        replay = engine.simulate_projection(int(request.form.get("days", "7")))
        replay_text = (
            f"未来 {replay['days']} 天预测：资金变化 {replay['money_delta']}，"
            f"共富变化 {replay['prosperity_delta']}，源能变化 {replay['energy_delta']}，"
            f"预计雇员 {replay['employees']}。"
        )
        return redirect(url_for("balance_page", replay_result=replay_text))

    @app.post("/api/open-mode/play")
    def api_open_mode_play():
        engine = _load_engine()
        if not engine.state.open_mode.profile_saved:
            return jsonify({"ok": False, "message": "请先完成主角设定。"}), 400
        scene = request.form.get("scene", "刘家村村口")
        selected_action = request.form.get("open_action", "先在村里散步并观察行情")
        result = _run_open_mode_play(engine, scene, selected_action)
        return jsonify({"ok": True, **result})

    @app.post("/action")
    def action():
        engine = _load_engine()
        action_name = request.form.get("action", "")
        next_page = request.form.get("next", "home")
        handlers: dict[str, Callable[[], str]] = {
            "new_game": lambda: _reset_game(),
            "save_game": lambda: _save_and_message(engine, "网页进度已保存。"),
            "save_llm_config": lambda: _save_llm_config_from_form(request.form),
            "harvest": lambda: engine.harvest_all(),
            "collect": lambda: engine.collect_livestock_products(),
            "sell_market": lambda: engine.sell_inventory("market"),
            "sell_stream": lambda: engine.sell_inventory("stream"),
            "advance_day": lambda: engine.advance_day(),
            "prepare_company": lambda: engine.prepare_company(),
            "dividends": lambda: engine.distribute_dividends(),
            "expand_ranch": lambda: engine.expand_ranch(int(request.form.get("blocks", "1"))),
            "upgrade_workshop": lambda: engine.upgrade_workshop(),
            "test_llm_config": _format_llm_test_message,
        }

        if action_name == "plant":
            message = engine.plant_crop(int(request.form["plot_id"]), request.form["crop_id"])
        elif action_name == "raise_livestock":
            message = engine.raise_livestock(int(request.form["pen_id"]), request.form["livestock_id"])
        elif action_name == "process":
            message = engine.process_goods(request.form["recipe_id"], int(request.form.get("batches", "1")))
        elif action_name == "interact":
            message = engine.interact(request.form["character_id"])
        elif action_name == "unlock_skill":
            message = engine.unlock_skill(request.form["skill_id"])
        elif action_name == "hire":
            message = engine.hire_villagers(int(request.form.get("count", "1")))
        elif action_name == "fulfill_order":
            order_input = request.form["order_id"].strip()
            matched_order_id = order_input
            for active_order in engine.state.active_orders:
                if not active_order.completed and active_order.title == order_input:
                    matched_order_id = active_order.order_id
                    break
            message = engine.fulfill_order(matched_order_id)
        elif action_name == "advance_partnership":
            partner_type = request.form.get("partner_type", "")
            message = engine.advance_partnership(partner_type)
        elif action_name == "update_profile":
            was_saved = engine.state.open_mode.profile_saved
            message = engine.update_player_profile(
                request.form.get("player_name", ""),
                request.form.get("player_identity", ""),
                request.form.get("player_return_reason", ""),
            )
            save_game(engine.state, WEB_SAVE_PATH)
            if not was_saved:
                return redirect(url_for("index", next_modal="modal-open", message=message))
            return redirect(url_for("index", message=message))
        elif action_name == "open_suggest":
            engine.open_mode_suggest(
                request.form.get("scene", "刘家村村口"),
                request.form.get("goal", "低压力推进经营"),
            )
            save_game(engine.state, WEB_SAVE_PATH)
            return redirect(url_for("index", next_modal="modal-open", message="已生成 LLM 行动建议，请选择执行。"))
        elif action_name == "open_play":
            result = _run_open_mode_play(
                engine,
                request.form.get("scene", "刘家村村口"),
                request.form.get("open_action", "先在村里散步并观察行情"),
            )
            message = str(result["message"])
            return redirect(url_for("index", next_modal="modal-open", message="推演完成，查看开放玩法面板。"))
        elif action_name == "save_slot":
            message = _save_slot(engine, int(request.form.get("slot", "1")))
        elif action_name == "load_slot":
            message = _load_slot_to_active(int(request.form.get("slot", "1")))
        elif action_name == "delete_slot":
            message = _delete_slot(int(request.form.get("slot", "1")))
        else:
            handler = handlers.get(action_name)
            message = handler() if handler else "未知操作。"

        if action_name != "new_game":
            save_game(engine.state, WEB_SAVE_PATH)
        if next_page == "story":
            return redirect(url_for("story_panel", message=message))
        if next_page == "balance":
            return redirect(url_for("balance_page", message=message))
        return redirect(url_for("index", message=message))

    _ = index
    _ = action
    _ = story_board
    _ = story_panel
    _ = api_execute_command
    _ = api_panel_state
    _ = balance_page
    _ = balance_apply
    _ = balance_replay
    return app


def _load_engine() -> GameEngine:
    return GameEngine(load_game(WEB_SAVE_PATH))


def _run_open_mode_play(engine: GameEngine, scene: str, selected_action: str) -> dict[str, object]:
    money_b = engine.state.resources.money
    pros_b = engine.state.resources.prosperity
    ptcl_b = engine.state.resources.particles
    nrg_b = engine.state.resources.source_energy

    full_message = engine.play_open_mode_action(scene, selected_action)
    message = full_message.split("【次日可选行动】", 1)[0].strip()

    delta_parts: list[str] = []
    for lbl, bef, aft in [
        ("资金", money_b, engine.state.resources.money),
        ("共富", pros_b, engine.state.resources.prosperity),
        ("微粒", ptcl_b, engine.state.resources.particles),
        ("源能", nrg_b, engine.state.resources.source_energy),
    ]:
        d = aft - bef
        if d != 0:
            sign = "+" if d > 0 else ""
            delta_parts.append(f"{lbl} {sign}{d}")
    stat_delta = "  |  ".join(delta_parts) if delta_parts else "数值无变化"

    engine.state.open_mode.last_play_result = message
    engine.state.open_mode.last_stat_delta = stat_delta
    save_game(engine.state, WEB_SAVE_PATH)

    return {
        "message": message,
        "stat_delta": stat_delta,
        "next_options": list(engine.state.open_mode.last_options)[:3],
    }


def _reset_game() -> str:
    engine = GameEngine()
    save_game(engine.state, WEB_SAVE_PATH)
    return "已重置为新的网页存档。"


def _save_and_message(engine: GameEngine, message: str) -> str:
    save_game(engine.state, WEB_SAVE_PATH)
    return message


def _slot_path(slot: int) -> Path:
    safe_slot = max(1, min(WEB_SLOT_COUNT, slot))
    WEB_SLOT_DIR.mkdir(parents=True, exist_ok=True)
    return WEB_SLOT_DIR / f"slot_{safe_slot}.json"


def _list_slots() -> list[dict[str, object]]:
    slots: list[dict[str, object]] = []
    for slot in range(1, WEB_SLOT_COUNT + 1):
        path = _slot_path(slot)
        slots.append(
            {
                "slot": slot,
                "exists": path.exists(),
                "updated": path.stat().st_mtime if path.exists() else None,
            }
        )
    return slots


def _save_slot(engine: GameEngine, slot: int) -> str:
    path = _slot_path(slot)
    save_game(engine.state, path)
    save_game(engine.state, WEB_SAVE_PATH)
    return f"已保存到网页存档槽位 {slot}。"


def _load_slot_to_active(slot: int) -> str:
    path = _slot_path(slot)
    loaded = load_game(path)
    if loaded is None:
        return f"槽位 {slot} 为空。"
    save_game(loaded, WEB_SAVE_PATH)
    return f"已读取槽位 {slot} 到当前网页进度。"


def _delete_slot(slot: int) -> str:
    path = _slot_path(slot)
    if not path.exists():
        return f"槽位 {slot} 本来就是空的。"
    path.unlink()
    return f"已删除槽位 {slot}。"


def _to_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _company_level_by_profit(total_profit: int) -> int:
    if total_profit >= 1_000_000:
        return 5
    if total_profit >= 500_000:
        return 4
    if total_profit >= 200_000:
        return 3
    if total_profit >= 50_000:
        return 2
    if total_profit >= 10_000:
        return 1
    return 0


def _build_sellable_items(engine: GameEngine) -> list[dict[str, object]]:
    category_names = {
        "crop": "种植类",
        "livestock": "养殖类",
        "processed": "加工类",
    }
    rows: list[dict[str, object]] = []
    for item_id, item_def in ITEMS.items():
        rows.append(
            {
                "item_id": item_id,
                "name": item_def.name,
                "category": category_names.get(item_def.category, item_def.category),
                "quantity": int(engine.state.inventory.get(item_id, 0)),
                "sell_price": item_def.sell_price,
            }
        )
    return rows


def _build_company_design(engine: GameEngine) -> dict[str, object]:
    snapshot = engine.status_snapshot()
    company = engine.state.company
    resources = engine.state.resources

    total_profit = _to_int(snapshot.get("money", 0), 0) + _to_int(company.profit_pool, 0)
    company_level = _company_level_by_profit(total_profit)
    # Use persistent scores from company state, capped at 0-100
    support_score = max(0, min(100, company.support_score))
    brand_score = max(0, min(100, company.brand_score))
    processing_categories = max(1, _to_int(company.workshop_level, 1))

    stage_goals: list[dict[str, object]] = [
        {
            "level": 1,
            "name": "初创期",
            "target": "完成首次规模化电商闭环，完成公司基础组织搭建。",
            "ready": total_profit >= 10_000 and _to_int(company.employees, 0) >= 3,
        },
        {
            "level": 2,
            "name": "成长期",
            "target": "累计盈利 50000+，解锁加工扩展与品牌基础能力。",
            "ready": total_profit >= 50_000 and resources.source_energy >= 5,
        },
        {
            "level": 3,
            "name": "规模化期",
            "target": "累计盈利 200000+，带动就业并形成品牌化运营。",
            "ready": total_profit >= 200_000 and _to_int(company.employees, 0) >= 10,
        },
        {
            "level": 4,
            "name": "区域标杆期",
            "target": "累计盈利 500000+，带动村民就业，拓展外部合作。",
            "ready": total_profit >= 500_000 and _to_int(company.employees, 0) >= 20,
        },
        {
            "level": 5,
            "name": "共富标杆期",
            "target": "累计盈利 1000000+，村民支持高位，具备复制能力。",
            "ready": total_profit >= 1_000_000 and support_score >= 95,
        },
    ]

    core_modules: list[dict[str, object]] = [
        {
            "name": "公司注册与组织搭建",
            "status": "已解锁" if company.unlocked else "待推进",
            "detail": "围绕总经理、电商、生产、加工、协同岗位推进轻量化运营。",
        },
        {
            "name": "农场供应链管理",
            "status": "稳定运行" if _to_int(snapshot.get("ranch_capacity", 0), 0) >= 1 else "待推进",
            "detail": "支持自种、协作、收购三类供给路径，兼容躺平自动化。",
        },
        {
            "name": "电商运营链路",
            "status": "可执行" if _to_int(snapshot.get("active_orders", 0), 0) >= 0 else "待推进",
            "detail": "直播与渠道销售联动，强调主题决策、定价与复购反馈。",
        },
        {
            "name": "农产品加工升级",
            "status": "进行中" if _to_int(company.workshop_level, 1) >= 2 else "基础阶段",
            "detail": "通过加工延长产业链，减少损耗并提高附加值。",
        },
        {
            "name": "村民管理与共富机制",
            "status": "进行中" if _to_int(company.employees, 0) > 0 else "待推进",
            "detail": "围绕招募、工资、分红、培训与支持度建立共赢机制。",
        },
        {
            "name": "系统辅助与风险管控",
            "status": "已启用" if engine.state.system.unlocked_skills else "待推进",
            "detail": "数据看板、预警与自动化操作减少重复负担。",
        },
        {
            "name": "合作拓展与品牌增长",
            "status": "已启动" if _to_int(company.brand_level, 0) >= 1 else "待推进",
            "detail": "科研、政府、企业、村集体合作构成中后期增长曲线。",
        },
    ]

    design_highlights: list[str] = [
        "躺平与奋斗双模式并行：自动化处理重复工作，玩家聚焦关键决策。",
        "全产业链闭环：种植-加工-渠道-分红-扩展形成可持续循环。",
        "共同富裕可量化：支持度、就业、分红与品牌增长共同驱动终局。",
        "LLM 决策友好：开放输入驱动剧情与经营结果生成，不锁定固定人设。",
    ]

    return {
        "company_level": company_level,
        "total_profit": total_profit,
        "support_score": support_score,
        "brand_score": brand_score,
        "processing_categories": processing_categories,
        "stage_goals": stage_goals,
        "core_modules": core_modules,
        "design_highlights": design_highlights,
        "partnerships": {
            "science": {
                "name": "科研合作",
                "progress": engine.state.partnerships.science_progress,
                "unlocked": engine.state.partnerships.science_unlocked
            },
            "government": {
                "name": "政府合作",
                "progress": engine.state.partnerships.government_progress,
                "unlocked": engine.state.partnerships.government_unlocked
            },
            "business": {
                "name": "企业合作",
                "progress": engine.state.partnerships.business_progress,
                "unlocked": engine.state.partnerships.business_unlocked
            },
            "village_collective": {
                "name": "村集体合作",
                "progress": engine.state.partnerships.village_progress,
                "unlocked": engine.state.partnerships.village_unlocked
            }
        }
    }


def _format_llm_test_message() -> str:
    result = test_llm_configuration()
    status = "成功" if bool(result.get("ok")) else "失败"
    message = str(result.get("message", "未知结果"))
    endpoint = str(result.get("endpoint", ""))
    model = str(result.get("model", ""))
    tail = ""
    if endpoint:
        tail += f" | endpoint: {endpoint}"
    if model:
        tail += f" | model: {model}"
    return f"LLM 配置测试{status}：{message}{tail}"


def _llm_config_path() -> Path:
    raw = os.getenv("ALLRICHAI_LLM_CONFIG", str(DEFAULT_LLM_CONFIG_PATH))
    return Path(raw).expanduser()


def _load_llm_config_for_form() -> dict[str, Any]:
    path = _llm_config_path()
    data: dict[str, Any] = {}
    if path.exists():
        try:
            parsed = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(parsed, dict):
                data = parsed
        except (OSError, ValueError, json.JSONDecodeError):
            data = {}

    endpoint = str(data.get("endpoint", "")).strip()
    api_base = str(data.get("api_base", data.get("LLM_API_BASE", ""))).strip()
    if not endpoint and api_base:
        endpoint = f"{api_base.rstrip('/')}/chat/completions"

    timeout = _to_int(data.get("timeout_seconds", 10), 10)
    timeout = max(3, min(timeout, 60))
    model = str(data.get("model", data.get("LLM_MODEL", "glm-5"))).strip() or "glm-5"
    chat_model = str(data.get("chat_model", data.get("LLM_CHAT_MODEL", model))).strip() or model

    return {
        "api_key": str(data.get("api_key", data.get("LLM_API_KEY", ""))).strip(),
        "api_base": api_base,
        "endpoint": endpoint,
        "model": model,
        "chat_model": chat_model,
        "timeout_seconds": timeout,
    }


def _save_llm_config_from_form(form: Any) -> str:
    path = _llm_config_path()
    incoming_json = str(form.get("llm_config_json", "")).strip()

    if incoming_json:
        try:
            parsed = json.loads(incoming_json)
            if not isinstance(parsed, dict):
                return "保存失败：JSON 必须是对象结构。"
            data = dict(parsed)
        except (ValueError, json.JSONDecodeError):
            return "保存失败：JSON 格式不合法。"
    else:
        data: dict[str, Any] = {}
        if path.exists():
            try:
                existing = json.loads(path.read_text(encoding="utf-8"))
                if isinstance(existing, dict):
                    data = dict(existing)
            except (OSError, ValueError, json.JSONDecodeError):
                data = {}

        api_key = str(form.get("llm_api_key", "")).strip()
        api_base = str(form.get("llm_api_base", "")).strip()
        endpoint = str(form.get("llm_endpoint", "")).strip()
        model = str(form.get("llm_model", "")).strip() or "glm-5"
        chat_model = str(form.get("llm_chat_model", "")).strip() or model
        timeout = _to_int(form.get("llm_timeout_seconds", 10), 10)
        timeout = max(3, min(timeout, 60))

        if not endpoint and api_base:
            endpoint = f"{api_base.rstrip('/')}/chat/completions"
        if endpoint and not api_base and endpoint.endswith("/chat/completions"):
            api_base = endpoint[: -len("/chat/completions")]

        data.update(
            {
                "api_key": api_key,
                "LLM_API_KEY": api_key,
                "api_base": api_base,
                "LLM_API_BASE": api_base,
                "endpoint": endpoint,
                "model": model,
                "LLM_MODEL": model,
                "chat_model": chat_model,
                "LLM_CHAT_MODEL": chat_model,
                "timeout_seconds": timeout,
            }
        )

    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    except OSError:
        return "保存失败：写入配置文件时发生错误。"

    endpoint = str(data.get("endpoint", "")).strip()
    model = str(data.get("chat_model", data.get("model", ""))).strip()
    tail = ""
    if endpoint:
        tail += f" endpoint: {endpoint}"
    if model:
        tail += f" | model: {model}"
    return f"LLM 配置已保存并加载。{tail}".strip()


app = create_app()
