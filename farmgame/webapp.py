from __future__ import annotations
# pyright: reportUnusedFunction=false

import json
import os
from datetime import datetime, timezone
from http import HTTPStatus
from pathlib import Path
from typing import Any, Callable

from flask_cors import CORS
from flask import Flask, jsonify, redirect, render_template, request, url_for
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.exceptions import HTTPException

from farmgame.balance import CROPS, ITEMS, LIVESTOCKS, RECIPES, SKILLS
from farmgame.content import CHARACTERS, TASKS
from farmgame.engine import GameEngine
from farmgame.narrative import test_llm_configuration
from farmgame.storage import load_game, save_game

SAVE_ROOT = Path(os.getenv("ALLRICHAI_SAVE_ROOT", "saves")).expanduser()
WEB_SAVE_PATH = SAVE_ROOT / "web_save.json"
WEB_SLOT_DIR = SAVE_ROOT / "web_slots"
WEB_SLOT_COUNT = 4
DEFAULT_LLM_CONFIG_PATH = Path("config") / "llm_api.json"

DAY1_PRESETS = [
    "沿村道走一圈，记录可用荒地位置",
    "拜访父亲，了解家里农田现状和工具",
    "去镇上调研蔬菜收购价格和当天需求",
]


def create_app() -> Flask:
    app = Flask(__name__)
    _ensure_save_dirs()

    allowed_origins = _load_allowed_origins()
    CORS(
        app,
        resources={r"/api/*": {"origins": allowed_origins}},
        methods=["GET", "POST", "OPTIONS"],
        allow_headers=[
            "Content-Type",
            "Authorization",
            "X-TF-Timestamp",
            "X-TF-Nonce",
            "X-TF-Signature",
            "X-TF-Client-Id",
            "X-TF-Sign-Version",
        ],
        max_age=3600,
    )

    limiter = Limiter(
        key_func=get_remote_address,
        app=app,
        default_limits=[],
        storage_uri=os.getenv("ALLRICHAI_RATE_LIMIT_STORAGE", "memory://"),
        enabled=os.getenv("ALLRICHAI_RATE_LIMIT_ENABLED", "1") == "1",
    )
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

    @app.get("/viz")
    def viz_index():
        """可视化版本主页"""
        engine = _load_engine()
        company_design = _build_company_design(engine)
        return render_template(
            "viz_index.html",
            page="viz",
            snapshot=engine.status_snapshot(),
            company_design=company_design,
            player_profile=engine.state.player_profile,
            open_mode=engine.open_mode_status(),
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
        )

    # ========== 可视化融合专用 JSON API Start ==========
    @app.get("/api/viz/state")
    @limiter.limit("240/minute")
    def api_viz_state():
        engine = _load_engine()
        return jsonify(
            {
                "ok": True,
                "state": _build_viz_state_payload(engine),
            }
        )

    @app.post("/api/viz/action")
    @limiter.limit("120/minute")
    def api_viz_action():
        data = request.get_json(silent=True) or {}
        action_name = str(data.get("action", "")).strip()
        params = data.get("params") or {}
        if not isinstance(params, dict):
            params = {}

        engine = _load_engine()
        ok, message = _execute_viz_action(engine, action_name, params)
        save_game(engine.state, WEB_SAVE_PATH)
        return jsonify(
            {
                "ok": ok,
                "success": ok,
                "message": message,
                "state": _build_viz_state_payload(engine),
            }
        )

    @app.post("/api/viz/slot/save")
    @limiter.limit("60/minute")
    def api_viz_slot_save():
        data = request.get_json(silent=True) or {}
        slot = _to_int(data.get("slot", 1), 1)
        engine = _load_engine()
        message = _save_slot(engine, slot)
        return jsonify(
            {
                "ok": True,
                "success": True,
                "message": message,
                "state": _build_viz_state_payload(engine),
            }
        )

    @app.post("/api/viz/slot/load")
    @limiter.limit("60/minute")
    def api_viz_slot_load():
        data = request.get_json(silent=True) or {}
        slot = _to_int(data.get("slot", 1), 1)
        message = _load_slot_to_active(slot)
        engine = _load_engine()
        ok = "为空" not in message
        return jsonify(
            {
                "ok": ok,
                "success": ok,
                "message": message,
                "state": _build_viz_state_payload(engine),
            }
        )

    @app.post("/api/viz/slot/delete")
    @limiter.limit("30/minute")
    def api_viz_slot_delete():
        data = request.get_json(silent=True) or {}
        slot = _to_int(data.get("slot", 1), 1)
        path = _slot_path(slot)
        if path.exists():
            path.unlink()
            message = f"已删除槽位 {slot}。"
            ok = True
        else:
            message = f"槽位 {slot} 为空。"
            ok = False
        engine = _load_engine()
        return jsonify(
            {
                "ok": ok,
                "success": ok,
                "message": message,
                "state": _build_viz_state_payload(engine),
            }
        )

    @app.post("/api/viz/open/suggest")
    @limiter.limit("60/minute")
    def api_viz_open_suggest():
        data = request.get_json(silent=True) or {}
        scene = str(data.get("scene", "刘家村村口"))
        goal = str(data.get("goal", "低压力推进经营并保持家庭关系稳定"))
        engine = _load_engine()
        options = engine.open_mode_options(scene, goal)
        save_game(engine.state, WEB_SAVE_PATH)
        return jsonify(
            {
                "ok": True,
                "success": True,
                "message": "已生成行动建议。",
                "options": options[:3],
                "state": _build_viz_state_payload(engine),
            }
        )

    @app.post("/api/viz/open/play")
    @limiter.limit("60/minute")
    def api_viz_open_play():
        data = request.get_json(silent=True) or {}
        scene = str(data.get("scene", "刘家村村口"))
        selected_action = str(data.get("open_action", "先在村里散步并观察行情"))
        engine = _load_engine()
        result = _run_open_mode_play(engine, scene, selected_action)
        return jsonify(
            {
                "ok": True,
                "success": True,
                "message": str(result.get("message", "")),
                "stat_delta": str(result.get("stat_delta", "")),
                "next_options": list(result.get("next_options", []))[:3],
                "state": _build_viz_state_payload(engine),
            }
        )

    @app.post("/api/viz/story/dialog")
    @limiter.limit("60/minute")
    def api_viz_story_dialog():
        data = request.get_json(silent=True) or {}
        chapter_id = str(data.get("chapter_id", "v1c1")).strip() or "v1c1"
        engine = _load_engine()
        return jsonify(
            {
                "ok": True,
                "success": True,
                "chapter_id": chapter_id,
                "dialog": _build_story_dialog_payload(chapter_id),
                "state": _build_viz_state_payload(engine),
            }
        )

    @app.post("/api/viz/story/choice")
    @limiter.limit("60/minute")
    def api_viz_story_choice():
        data = request.get_json(silent=True) or {}
        chapter_id = str(data.get("chapter_id", "v1c1")).strip() or "v1c1"
        choice_text = str(data.get("choice_text", "继续推进剧情")).strip() or "继续推进剧情"
        engine = _load_engine()
        result = _run_story_choice(engine, chapter_id, choice_text)
        return jsonify({"ok": True, "success": True, **result, "state": _build_viz_state_payload(engine)})

    @app.post("/api/viz/profile/update")
    @limiter.limit("30/minute")
    def api_viz_profile_update():
        data = request.get_json(silent=True) or {}
        engine = _load_engine()
        message = engine.update_player_profile(
            str(data.get("player_name", "")),
            str(data.get("player_identity", "")),
            str(data.get("player_return_reason", "")),
        )
        save_game(engine.state, WEB_SAVE_PATH)
        return jsonify(
            {
                "ok": True,
                "success": True,
                "message": message,
                "state": _build_viz_state_payload(engine),
            }
        )

    @app.post("/api/viz/new-game")
    @limiter.limit("20/minute")
    def api_viz_new_game():
        engine = GameEngine()
        save_game(engine.state, WEB_SAVE_PATH)
        return jsonify(
            {
                "ok": True,
                "success": True,
                "message": "已重置为新开局。",
                "state": _build_viz_state_payload(engine),
            }
        )

    @app.post("/api/viz/balance/apply")
    @limiter.limit("30/minute")
    def api_viz_balance_apply():
        data = request.get_json(silent=True) or {}
        engine = _load_engine()
        message = engine.apply_balance_config(
            wage_per_employee=_to_int(data.get("wage_per_employee", 80), 80),
            dividend_rate_percent=float(data.get("dividend_rate_percent", 10)),
            processing_fee_multiplier=float(data.get("processing_fee_multiplier", 1.0)),
            processing_output_multiplier=float(data.get("processing_output_multiplier", 1.0)),
            order_reward_multiplier=float(data.get("order_reward_multiplier", 1.0)),
        )
        save_game(engine.state, WEB_SAVE_PATH)
        return jsonify(
            {
                "ok": True,
                "success": True,
                "message": message,
                "state": _build_viz_state_payload(engine),
            }
        )

    @app.post("/api/viz/balance/replay")
    @limiter.limit("30/minute")
    def api_viz_balance_replay():
        data = request.get_json(silent=True) or {}
        engine = _load_engine()
        replay = engine.simulate_projection(_to_int(data.get("days", 7), 7))
        replay_text = (
            f"未来 {replay['days']} 天预测：资金变化 {replay['money_delta']}，"
            f"共富变化 {replay['prosperity_delta']}，源能变化 {replay['energy_delta']}，"
            f"预计雇员 {replay['employees']}。"
        )
        return jsonify(
            {
                "ok": True,
                "success": True,
                "message": replay_text,
                "replay": replay,
                "state": _build_viz_state_payload(engine),
            }
        )

    # ========== 可视化融合专用 JSON API End ==========

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
    @limiter.limit("60/minute")
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
    @limiter.limit("180/minute")
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
    @limiter.limit("60/minute")
    def api_open_mode_play():
        engine = _load_engine()
        if not engine.state.open_mode.profile_saved:
            return jsonify({"ok": False, "message": "请先完成主角设定。"}), 400
        scene = request.form.get("scene", "刘家村村口")
        selected_action = request.form.get("open_action", "先在村里散步并观察行情")
        result = _run_open_mode_play(engine, scene, selected_action)
        return jsonify({"ok": True, **result})

    @app.post("/action")
    @limiter.limit("120/minute")
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
            matched_order_id = _resolve_order_input(engine, order_input)
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

    @app.errorhandler(404)
    def handle_not_found(_: Exception):
        if request.path.startswith("/api/"):
            return jsonify({"ok": False, "success": False, "message": "接口不存在。"}), HTTPStatus.NOT_FOUND
        return "Not Found", HTTPStatus.NOT_FOUND

    @app.errorhandler(429)
    def handle_rate_limited(_: Exception):
        if request.path.startswith("/api/"):
            return (
                jsonify({"ok": False, "success": False, "message": "请求过于频繁，请稍后再试。"}),
                HTTPStatus.TOO_MANY_REQUESTS,
            )
        return "Too Many Requests", HTTPStatus.TOO_MANY_REQUESTS

    @app.errorhandler(Exception)
    def handle_unexpected_error(error: Exception):
        if isinstance(error, HTTPException):
            status = error.code or HTTPStatus.INTERNAL_SERVER_ERROR
            if request.path.startswith("/api/"):
                return (
                    jsonify({"ok": False, "success": False, "message": error.description or "请求失败。"}),
                    status,
                )
            return error

        app.logger.exception("Unhandled exception on %s", request.path)
        if request.path.startswith("/api/"):
            return (
                jsonify({"ok": False, "success": False, "message": "服务器内部错误。"}),
                HTTPStatus.INTERNAL_SERVER_ERROR,
            )
        return "Internal Server Error", HTTPStatus.INTERNAL_SERVER_ERROR

    return app


def _load_engine() -> GameEngine:
    return GameEngine(load_game(WEB_SAVE_PATH))


def _load_allowed_origins() -> str | list[str]:
    raw = os.getenv("ALLRICHAI_ALLOWED_ORIGINS", "*").strip()
    if not raw or raw == "*":
        return "*"
    origins = [item.strip() for item in raw.split(",") if item.strip()]
    return origins or "*"


def _ensure_save_dirs() -> None:
    WEB_SAVE_PATH.parent.mkdir(parents=True, exist_ok=True)
    WEB_SLOT_DIR.mkdir(parents=True, exist_ok=True)


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


def _build_story_dialog_payload(chapter_id: str) -> dict[str, Any]:
    dialog_map: dict[str, dict[str, Any]] = {
        "v1c1": {
            "character": {"name": "系统提示", "status": "引导", "avatar": "🤖"},
            "text": "欢迎来到刘家村。你将从返乡青年起步，逐步推进农场经营与村庄共富。",
            "options": [
                {"text": "先查看农场当前状况，再决定今天行动"},
                {"text": "先和家人交流，稳定支持度"},
                {"text": "先做一次低风险经营动作，积累首笔收益"},
            ],
        },
        "v1c2": {
            "character": {"name": "父亲", "status": "关心", "avatar": "👴"},
            "text": "这片地还能做起来，关键是节奏稳。别急着扩张，先把基本盘做好。",
            "options": [
                {"text": "优先播种并控制投入"},
                {"text": "先观察市场，再决定作物结构"},
                {"text": "先做一天探索，收集村里信息"},
            ],
        },
        "v2c1": {
            "character": {"name": "王楠", "status": "合作", "avatar": "🧑‍💼"},
            "text": "如果要扩大收益，可以尝试加工链路，但要注意现金流与供应稳定。",
            "options": [
                {"text": "小规模试加工，验证毛利"},
                {"text": "先扩供应，再考虑加工"},
                {"text": "先拉通线上销售渠道"},
            ],
        },
    }
    return dialog_map.get(chapter_id, dialog_map["v1c1"])


def _run_story_choice(engine: GameEngine, chapter_id: str, choice_text: str) -> dict[str, Any]:
    money_before = engine.state.resources.money
    particles_before = engine.state.resources.particles
    energy_before = engine.state.resources.source_energy
    laziness_before = engine.state.resources.laziness

    scene = f"刘家村，第 {engine.state.turn} 天，剧情节点 {chapter_id}"
    command = f"剧情推进：{choice_text}"
    result_text = engine.play_panel_mode_action(scene, command)

    engine.add_log(f"[剧情] {chapter_id} -> {choice_text[:40]}")
    save_game(engine.state, WEB_SAVE_PATH)

    stat_changes = {
        "资金": engine.state.resources.money - money_before,
        "微粒": engine.state.resources.particles - particles_before,
        "生命源能": engine.state.resources.source_energy - energy_before,
        "躺平意愿": engine.state.resources.laziness - laziness_before,
    }
    return {
        "chapter_id": chapter_id,
        "result_text": result_text or "剧情推进完成。",
        "stat_changes": stat_changes,
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


def _resolve_order_input(engine: GameEngine, order_input: str) -> str:
    """Resolve user-provided order text to order_id.

    Supports order_id, title, and copied order line text from UI.
    """
    raw = order_input.strip()
    if not raw:
        return raw

    title_hint = raw.split("|", 1)[0].strip()
    active_orders = [order for order in engine.state.active_orders if not order.completed]

    for order in active_orders:
        if raw == order.order_id:
            return order.order_id
        if raw == order.title or title_hint == order.title:
            return order.order_id

    for order in active_orders:
        if order.title and order.title in raw:
            return order.order_id

    return raw


def _seed_to_crop(seed_type: str) -> str:
    seed_map = {
        "wheat_seed": "vegetable",
        "corn_seed": "watermelon",
        "rice_seed": "rice",
    }
    return seed_map.get(seed_type, seed_type)


def _execute_viz_action(engine: GameEngine, action_name: str, params: dict[str, Any]) -> tuple[bool, str]:
    action = action_name.strip()
    try:
        if action == "plant":
            plot_id = _to_int(params.get("plot_id", params.get("plotId", 1)), 1)
            crop_id = str(params.get("crop_id", params.get("cropId", ""))).strip()
            if not crop_id:
                crop_id = _seed_to_crop(str(params.get("seed_type", "vegetable")))
            return True, engine.plant_crop(plot_id, crop_id)
        if action == "harvest":
            return True, engine.harvest_all()
        if action in {"water", "fertilize"}:
            return True, "已完成田间护理。"
        if action == "collect":
            return True, engine.collect_livestock_products()
        if action == "sell_item":
            return True, engine.sell_inventory("market")
        if action == "use_item":
            return True, "已使用道具。"
        if action == "sell_market":
            return True, engine.sell_inventory("market")
        if action == "sell_stream":
            return True, engine.sell_inventory("stream")
        if action == "advance_day":
            return True, engine.advance_day()
        if action == "raise_livestock":
            pen_id = _to_int(params.get("pen_id", params.get("penId", 1)), 1)
            livestock_id = str(params.get("livestock_id", params.get("livestockId", ""))).strip()
            if not livestock_id:
                return False, "缺少 livestock_id。"
            return True, engine.raise_livestock(pen_id, livestock_id)
        if action == "process":
            recipe_id = str(params.get("recipe_id", params.get("recipeId", ""))).strip()
            batches = _to_int(params.get("batches", 1), 1)
            if not recipe_id:
                return False, "缺少 recipe_id。"
            return True, engine.process_goods(recipe_id, batches)
        if action == "upgrade_workshop":
            return True, engine.upgrade_workshop()
        if action == "expand_ranch":
            blocks = _to_int(params.get("blocks", 1), 1)
            return True, engine.expand_ranch(blocks)
        if action == "interact":
            character_id = str(params.get("character_id", params.get("characterId", ""))).strip()
            if not character_id:
                return False, "缺少 character_id。"
            return True, engine.interact(character_id)
        if action == "complete_task":
            engine.refresh_tasks()
            return True, "任务状态已刷新。"
        if action == "unlock_skill":
            skill_id = str(params.get("skill_id", params.get("skillId", ""))).strip()
            if not skill_id:
                return False, "缺少 skill_id。"
            return True, engine.unlock_skill(skill_id)
        if action == "prepare_company":
            return True, engine.prepare_company()
        if action == "hire":
            count = _to_int(params.get("count", 1), 1)
            return True, engine.hire_villagers(count)
        if action == "dividends":
            return True, engine.distribute_dividends()
        if action == "fulfill_order":
            order_id = str(params.get("order_id", params.get("orderId", ""))).strip()
            if not order_id:
                return False, "缺少 order_id。"
            return True, engine.fulfill_order(_resolve_order_input(engine, order_id))
    except Exception as exc:  # pragma: no cover - defensive for bridge safety
        return False, f"执行失败: {exc}"

    return False, f"暂不支持的动作: {action}"


def _build_viz_state_payload(engine: GameEngine) -> dict[str, Any]:
    snapshot = engine.status_snapshot()
    inventory_rows: dict[str, dict[str, Any]] = {}
    for item_id, qty in engine.state.inventory.items():
        item_def = ITEMS.get(item_id)
        inventory_rows[item_id] = {
            "id": item_id,
            "name": item_def.name if item_def else item_id,
            "count": int(qty),
            "quantity": int(qty),
            "type": item_def.category if item_def else "item",
            "price": item_def.sell_price if item_def else 0,
        }

    tasks_payload: dict[str, dict[str, Any]] = {}
    for task_id, task_state in engine.state.tasks.items():
        task_def = TASKS.get(task_id)
        total = int(task_def.target_value) if task_def else 1
        progress = int(min(task_state.progress, total))
        status = "completed" if task_state.claimed else ("in_progress" if task_state.completed else "available")
        tasks_payload[task_id] = {
            "task_id": task_id,
            "name": task_def.title if task_def else task_id,
            "title": task_def.title if task_def else task_id,
            "description": task_def.description if task_def else "",
            "status": status,
            "progress": {"current": progress, "total": total},
            "rewards": task_def.rewards if task_def else {},
        }

    farm_plots: list[dict[str, Any]] = []
    for plot in engine.state.plots:
        farm_plots.append(
            {
                "plot_id": plot.plot_id,
                "crop_id": plot.crop_id,
                "days_remaining": plot.days_remaining,
                "ready_to_harvest": plot.ready_to_harvest,
                "status": "mature" if plot.ready_to_harvest else ("planted" if plot.crop_id else "empty"),
            }
        )

    return {
        "raw_state": engine.state.to_dict(),
        "money": int(snapshot.get("money", 0)),
        "particles": int(snapshot.get("particles", 0)),
        "land": float(snapshot.get("land", 0.0)),
        "turn": int(snapshot.get("turn", 1)),
        "day": int(snapshot.get("day", snapshot.get("turn", 1))),
        "season": str(snapshot.get("season", "初夏")),
        "weather": str(snapshot.get("weather", "晴朗")),
        "stage": str(snapshot.get("stage", "躺平起步")),
        "source_energy": int(snapshot.get("source_energy", 0)),
        "prosperity": int(snapshot.get("prosperity", 0)),
        "inventory": inventory_rows,
        "tasks": tasks_payload,
        "farm_plots": farm_plots,
        "plot_report": engine.plot_report(),
        "pen_report": engine.pen_report(),
        "order_report": engine.order_report(),
        "task_report": engine.task_report(),
        "save_slots": _list_slots(),
        "snapshot": snapshot,
    }


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