import unittest
from urllib.parse import unquote

from farmgame.engine import GameEngine
from farmgame.validators import run_design_audit


class GameEngineTests(unittest.TestCase):
    def test_new_game_starts_with_two_plots(self) -> None:
        engine = GameEngine()
        self.assertEqual(len(engine.state.plots), 2)
        self.assertEqual(engine.state.stage, "startup")
        self.assertEqual(engine.state.turn, 1)
        self.assertEqual(engine.state.time, "清晨")
        self.assertEqual(engine.state.season, "初夏")
        self.assertEqual(engine.state.weather, "晴朗")
        self.assertEqual(engine.state.resources.money, 2000)
        self.assertEqual(engine.state.resources.particles, 30)
        self.assertEqual(engine.state.resources.laziness, 50)

    def test_plant_advance_and_harvest_updates_inventory(self) -> None:
        engine = GameEngine()
        result = engine.plant_crop(1, "vegetable")
        self.assertIn("播种成功", result)
        engine.advance_day()
        harvest_result = engine.harvest_all()
        self.assertIn("本次收获", harvest_result)
        self.assertEqual(engine.state.inventory.get("vegetable"), 2)

    def test_stream_sale_increases_revenue_and_favor(self) -> None:
        engine = GameEngine()
        engine.state.inventory["vegetable"] = 2
        result = engine.sell_inventory("stream")
        self.assertIn("直播", result)
        self.assertGreater(engine.state.resources.money, 1800)
        self.assertGreaterEqual(engine.state.characters["wang_nan"].favor, 2)

    def test_unlock_smart_irrigation_adds_plot(self) -> None:
        engine = GameEngine()
        engine.state.resources.source_energy = 3
        result = engine.unlock_skill("smart_irrigation")
        self.assertIn("已解锁技能", result)
        self.assertEqual(len(engine.state.plots), 3)
        self.assertEqual(len(engine.state.pens), 2)

    def test_livestock_collection_adds_products(self) -> None:
        engine = GameEngine()
        result = engine.raise_livestock(1, "hens")
        self.assertIn("养殖开始", result)
        engine.advance_day()
        engine.advance_day()
        collect_result = engine.collect_livestock_products()
        self.assertIn("已收取", collect_result)
        self.assertEqual(engine.state.inventory.get("egg"), 4)

    def test_processing_and_company_flow(self) -> None:
        engine = GameEngine()
        engine.state.stage = "scale_up"
        engine.state.resources.source_energy = 20
        engine.state.inventory["strawberry"] = 4
        engine.unlock_skill("processing_workshop")
        process_result = engine.process_goods("fruit_jam", 2)
        self.assertIn("已完成", process_result)
        engine.unlock_skill("village_company")
        prepare_result = engine.prepare_company()
        self.assertIn("已成立", prepare_result)
        hire_result = engine.hire_villagers(3)
        self.assertIn("已雇佣", hire_result)
        dividend_result = engine.distribute_dividends()
        self.assertIn("已完成分红", dividend_result)

    def test_expand_ranch_and_workshop_upgrade(self) -> None:
        engine = GameEngine()
        engine.state.resources.money = 20000
        expand_result = engine.expand_ranch(2)
        self.assertIn("扩栏成功", expand_result)
        self.assertEqual(engine.state.company.ranch_capacity, 3)
        engine.state.stage = "scale_up"
        engine.state.resources.source_energy = 20
        engine.unlock_skill("processing_workshop")
        workshop_result = engine.upgrade_workshop()
        self.assertIn("加工坊已升级", workshop_result)
        self.assertEqual(engine.state.company.workshop_level, 2)

    def test_order_generation_and_fulfillment(self) -> None:
        engine = GameEngine()
        self.assertGreaterEqual(len(engine.state.active_orders), 1)
        engine.state.inventory["vegetable"] = 10
        engine.state.inventory["egg"] = 10
        result = engine.fulfill_order("fresh_bundle")
        self.assertIn("订单交付成功", result)
        self.assertGreaterEqual(engine.state.stats.orders_completed, 1)

    def test_chapter_event_and_dynamic_text(self) -> None:
        engine = GameEngine()
        result = engine.trigger_chapter_event("v1c1", "farm_first")
        self.assertTrue("收获" in result or "播种" in result)
        text = engine.dynamic_chapter_text("v1c1", "先跑通循环")
        self.assertIn("AI剧情草案", text)

    def test_apply_balance_and_projection(self) -> None:
        engine = GameEngine()
        message = engine.apply_balance_config(120, 15, 0.9, 1.1, 1.2)
        self.assertIn("已更新", message)
        replay = engine.simulate_projection(3)
        self.assertEqual(replay["days"], 3)

    def test_daily_generation_updates_time_and_weather(self) -> None:
        engine = GameEngine()
        before_time = engine.state.time
        before_event = engine.state.event_text
        engine.advance_day()
        self.assertNotEqual(engine.state.time, before_time)
        self.assertTrue(engine.state.weather in {"晴朗", "多云", "小雨", "大雨", "微风"})
        self.assertNotEqual(engine.state.event_text, before_event)

    def test_audit_reports_known_design_conflicts(self) -> None:
        issues = run_design_audit()
        titles = {issue.title for issue in issues}
        self.assertIn("起始场景与源能场等级冲突", titles)
        self.assertIn("微粒到生命源能的兑换过慢", titles)


class WebAppTests(unittest.TestCase):
    def test_index_and_advance_day_route(self) -> None:
        from farmgame.webapp import create_app

        app = create_app()
        app.testing = True
        client = app.test_client()
        response = client.get("/")
        self.assertEqual(response.status_code, 200)
        post_response = client.post("/action", data={"action": "advance_day"})
        self.assertEqual(post_response.status_code, 302)

    def test_web_slot_save_and_load(self) -> None:
        from farmgame.webapp import create_app

        app = create_app()
        app.testing = True
        client = app.test_client()
        save_resp = client.post("/action", data={"action": "save_slot", "slot": "1"})
        self.assertEqual(save_resp.status_code, 302)
        load_resp = client.post("/action", data={"action": "load_slot", "slot": "1"})
        self.assertEqual(load_resp.status_code, 302)

    def test_story_and_balance_pages(self) -> None:
        from farmgame.webapp import create_app

        app = create_app()
        app.testing = True
        client = app.test_client()
        story_resp = client.get("/story")
        self.assertEqual(story_resp.status_code, 302)
        self.assertIn("/story-panel", story_resp.headers.get("Location", ""))
        self.assertEqual(client.get("/story-panel").status_code, 200)

        panel_state_resp = client.get("/api/story/panel-state")
        self.assertEqual(panel_state_resp.status_code, 200)
        panel_payload = panel_state_resp.get_json()
        self.assertIsNotNone(panel_payload)
        snapshot = panel_payload.get("snapshot", {})
        for key in ["day", "time", "season", "weather", "systemLevel", "commands", "roles", "crops", "events"]:
            self.assertIn(key, snapshot)

        turn_before = snapshot.get("day")

        execute_resp = client.post(
            "/api/story/execute-command",
            json={"command": "躺平休息：今日摆烂", "goal": "低压力推进经营", "turn": 1},
        )
        self.assertEqual(execute_resp.status_code, 200)

        panel_state_after = client.get("/api/story/panel-state").get_json()
        self.assertIsNotNone(panel_state_after)
        turn_after = panel_state_after.get("snapshot", {}).get("day")
        if isinstance(turn_before, int) and isinstance(turn_after, int):
            self.assertEqual(turn_after, turn_before + 1)

        self.assertEqual(client.get("/balance").status_code, 200)
        apply_resp = client.post(
            "/balance/apply",
            data={
                "wage_per_employee": "90",
                "dividend_rate_percent": "12",
                "processing_fee_multiplier": "1.0",
                "processing_output_multiplier": "1.2",
                "order_reward_multiplier": "1.1",
            },
        )
        self.assertEqual(apply_resp.status_code, 302)

    def test_fulfill_order_accepts_pasted_order_line(self) -> None:
        from farmgame.engine import GameEngine
        from farmgame.storage import save_game
        from farmgame.webapp import WEB_SAVE_PATH, create_app

        engine = GameEngine()
        engine.state.inventory["vegetable"] = 10
        engine.state.inventory["egg"] = 10
        order_line = engine.order_report()[0]
        save_game(engine.state, WEB_SAVE_PATH)

        app = create_app()
        app.testing = True
        client = app.test_client()

        resp = client.post(
            "/action",
            data={"action": "fulfill_order", "order_id": order_line, "next": "home"},
        )
        self.assertEqual(resp.status_code, 302)
        location = unquote(resp.headers.get("Location", ""))
        self.assertIn("订单交付成功", location)

    def test_action_route_respects_next_page_redirect(self) -> None:
        from farmgame.webapp import create_app

        app = create_app()
        app.testing = True
        client = app.test_client()

        to_story = client.post("/action", data={"action": "advance_day", "next": "story"})
        self.assertEqual(to_story.status_code, 302)
        self.assertIn("/story-panel", to_story.headers.get("Location", ""))

        to_balance = client.post("/action", data={"action": "advance_day", "next": "balance"})
        self.assertEqual(to_balance.status_code, 302)
        self.assertIn("/balance", to_balance.headers.get("Location", ""))

    def test_story_panel_execute_command_validation_and_mapping(self) -> None:
        from farmgame.webapp import create_app

        app = create_app()
        app.testing = True
        client = app.test_client()

        bad_resp = client.post("/api/story/execute-command", json={})
        self.assertEqual(bad_resp.status_code, 400)
        bad_payload = bad_resp.get_json() or {}
        self.assertFalse(bad_payload.get("success", True))
        self.assertIn("指令不能为空", str(bad_payload.get("error", "")))

        ok_resp = client.post("/api/story/execute-command", json={"command": "1", "goal": "低压力推进经营"})
        self.assertEqual(ok_resp.status_code, 200)
        ok_payload = ok_resp.get_json() or {}
        self.assertTrue(ok_payload.get("success", False))
        self.assertIn("updated_state", ok_payload)
        self.assertIn("turn", ok_payload.get("updated_state", {}))

    def test_viz_endpoints_and_action_bridge(self) -> None:
        from farmgame.webapp import create_app

        app = create_app()
        app.testing = True
        client = app.test_client()

        viz_page = client.get("/viz")
        self.assertEqual(viz_page.status_code, 200)

        state_resp = client.get("/api/viz/state")
        self.assertEqual(state_resp.status_code, 200)
        state_payload = state_resp.get_json() or {}
        self.assertTrue(state_payload.get("ok", False))
        self.assertIn("state", state_payload)
        self.assertIn("snapshot", state_payload.get("state", {}))

        bad_action = client.post("/api/viz/action", json={"action": "unsupported_action", "params": {}})
        self.assertEqual(bad_action.status_code, 200)
        bad_payload = bad_action.get_json() or {}
        self.assertFalse(bad_payload.get("ok", True))
        self.assertIn("暂不支持", str(bad_payload.get("message", "")))

        ok_action = client.post("/api/viz/action", json={"action": "advance_day", "params": {}})
        self.assertEqual(ok_action.status_code, 200)
        ok_payload = ok_action.get_json() or {}
        self.assertTrue(ok_payload.get("ok", False))
        self.assertIn("state", ok_payload)

    def test_viz_story_open_and_slot_interactions(self) -> None:
        from farmgame.webapp import create_app

        app = create_app()
        app.testing = True
        client = app.test_client()

        suggest_resp = client.post(
            "/api/viz/open/suggest",
            json={"scene": "刘家村村口", "goal": "低压力推进经营并保持家庭关系稳定"},
        )
        self.assertEqual(suggest_resp.status_code, 200)
        suggest_payload = suggest_resp.get_json() or {}
        self.assertTrue(suggest_payload.get("ok", False))
        self.assertIn("options", suggest_payload)

        play_resp = client.post(
            "/api/viz/open/play",
            json={"scene": "刘家村村口", "open_action": "先在村里散步并观察行情"},
        )
        self.assertEqual(play_resp.status_code, 200)
        play_payload = play_resp.get_json() or {}
        self.assertTrue(play_payload.get("ok", False))
        self.assertIn("next_options", play_payload)

        dialog_resp = client.post("/api/viz/story/dialog", json={"chapter_id": "v1c1"})
        self.assertEqual(dialog_resp.status_code, 200)
        dialog_payload = dialog_resp.get_json() or {}
        self.assertTrue(dialog_payload.get("ok", False))
        self.assertIn("dialog", dialog_payload)

        choice_resp = client.post(
            "/api/viz/story/choice",
            json={"chapter_id": "v1c1", "choice_text": "先查看农场当前状况，再决定今天行动"},
        )
        self.assertEqual(choice_resp.status_code, 200)
        choice_payload = choice_resp.get_json() or {}
        self.assertTrue(choice_payload.get("ok", False))
        self.assertIn("result_text", choice_payload)

        save_slot_resp = client.post("/api/viz/slot/save", json={"slot": 1})
        self.assertEqual(save_slot_resp.status_code, 200)
        self.assertTrue((save_slot_resp.get_json() or {}).get("ok", False))

        load_slot_resp = client.post("/api/viz/slot/load", json={"slot": 1})
        self.assertEqual(load_slot_resp.status_code, 200)
        self.assertTrue((load_slot_resp.get_json() or {}).get("ok", False))

        delete_slot_resp = client.post("/api/viz/slot/delete", json={"slot": 1})
        self.assertEqual(delete_slot_resp.status_code, 200)
        self.assertTrue((delete_slot_resp.get_json() or {}).get("ok", False))


if __name__ == "__main__":
    unittest.main()