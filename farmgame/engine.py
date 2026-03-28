from __future__ import annotations

import random
import re
from typing import Any, cast

from farmgame.balance import (
    CROPS,
    ITEMS,
    LIVESTOCKS,
    ORDER_DAILY_ROLL_INTERVAL,
    ORDER_TEMPLATES,
    PARTICLES_PER_ENERGY,
    RECIPES,
    RANCH_EXPANSION_BASE_COST,
    SKILLS,
    STAGE_LABELS,
    STAGE_REQUIREMENTS,
    STARTING_LEVEL,
    STARTING_STAGE,
    SYSTEM_LEVELS,
    WORKSHOP_OUTPUT_BONUS_RATE,
    WORKSHOP_PROCESSING_FEE_REDUCTION,
    WORKSHOP_UPGRADE_BASE_COST,
)
from farmgame.content import CHARACTERS, ENDING_TEXT, INTRO_LINES, STORY_CHAPTERS, TASKS
from farmgame.models import CharacterState, CompanyState, GameState, OrderState, PenState, PlotState, ResourceState, StatsState, SystemState, TaskDefinition, TaskState
from farmgame.narrative import generate_dynamic_story
from farmgame.narrative import generate_open_gameplay_options, resolve_open_gameplay_action
from farmgame.narrative import resolve_open_gameplay_action_fast
from farmgame.validators import validate_runtime_state



def _company_level_by_profit(total_profit: int) -> int:
    """Calculate company level based on total profit."""
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


class GameEngine:
    def __init__(self, state: GameState | None = None):
        self.state = state or self.new_game()

    @staticmethod
    def new_game() -> GameState:
        tasks = {task_id: TaskState() for task_id in TASKS}
        characters = {character_id: CharacterState() for character_id in CHARACTERS}
        state = GameState(
            turn=1,
            time="清晨",
            season="初夏",
            weather="晴朗",
            stage=STARTING_STAGE,
            resources=ResourceState(
                money=2000,
                particles=30,
                source_energy=0,
                prosperity=0,
                laziness=50,
                villager_support=10,
                family_harmony=80,
                land=0.5,
            ),
            system=SystemState(
                level=STARTING_LEVEL,
                daily_particles=cast(int, SYSTEM_LEVELS[STARTING_LEVEL]["daily_particles"]),
                unlocked_skills=[],
            ),
            plots=[PlotState(plot_id=1), PlotState(plot_id=2)],
            pens=[PenState(pen_id=1)],
            inventory={},
            characters=characters,
            tasks=tasks,
            stats=StatsState(),
            company=CompanyState(),
            active_orders=[],
            event_text="你刚回到老家，考研失败，身心俱疲，躺平智辅系统突然激活。",
            log=list(INTRO_LINES),
        )
        state.company.support_score = 10
        engine = GameEngine(state)
        engine._refresh_orders(force=True)
        engine.refresh_tasks()
        return engine.state

    def add_log(self, message: str) -> None:
        self.state.log.append(message)
        self.state.log = self.state.log[-10:]

    def status_snapshot(self) -> dict[str, object]:
        company_status = "已注册" if self.state.company.unlocked else "未注册"
        crop_status = self._crop_status_payload()
        roles = self._roles_payload()
        commands = self._fixed_commands()
        return {
            # spec-aligned fields
            "day": self.state.turn,
            "time": self.state.time,
            "season": self.state.season,
            "weather": self.state.weather,
            "systemLevel": self.state.system.level,
            "money": self.state.resources.money,
            "particle": self.state.resources.particles,
            "energy": self.state.resources.source_energy,
            "lazyWill": self.state.resources.laziness,
            "villagerSupport": self.state.resources.villager_support,
            "familyHarmony": self.state.resources.family_harmony,
            "brand": self.state.company.brand_score,
            "company": company_status,
            "land": round(self.state.resources.land, 2),
            "roles": roles,
            "crops": crop_status,
            "events": self.state.event_text,
            "commands": commands,
            # legacy fields (for existing pages)
            "turn": self.state.turn,
            "stage": STAGE_LABELS[self.state.stage],
            "money": self.state.resources.money,
            "particles": self.state.resources.particles,
            "source_energy": self.state.resources.source_energy,
            "prosperity": self.state.resources.prosperity,
            "laziness": self.state.resources.laziness,
            "daily_particles": self.state.system.daily_particles,
            "employees": self.state.company.employees,
            "dividend_rate": self.state.company.dividend_rate,
            "brand_level": self.state.company.brand_level,
            "workshop_level": self.state.company.workshop_level,
            "ranch_capacity": self.state.company.ranch_capacity,
            "wage_per_employee": self.state.company.wage_per_employee,
            "employee_morale": self.state.company.employee_morale,
            "active_orders": len([o for o in self.state.active_orders if not o.completed]),
            "skills": [SKILLS[skill_id].name for skill_id in self.state.system.unlocked_skills],
            "player_name": self.state.player_profile.name,
            "player_identity": self.state.player_profile.identity,
            "player_return_reason": self.state.player_profile.return_reason,
        }

    @staticmethod
    def _fixed_commands() -> list[str]:
        return [
            "1. 农业行动：查看自家田地",
            "2. 人物互动：和父亲聊天",
            "3. 电商行动：联系王楠",
            "4. 探索行动：出门逛村子",
            "5. 躺平休息：回房间睡觉摆烂",
            "6. 系统操作：打开躺平智辅面板",
        ]

    def _crop_status_payload(self) -> dict[str, object]:
        active_plot = next((plot for plot in self.state.plots if plot.crop_id), None)
        if not active_plot or not active_plot.crop_id:
            return {"name": "无", "stage": "未播种", "daysLeft": 0, "text": "无 | 未播种 | 剩余 0 天"}
        crop_name = CROPS[active_plot.crop_id].name
        if active_plot.ready_to_harvest:
            stage = "已成熟"
        else:
            stage = "生长中"
        return {
            "name": crop_name,
            "stage": stage,
            "daysLeft": active_plot.days_remaining,
            "text": f"{crop_name} | {stage} | 剩余 {active_plot.days_remaining} 天",
        }

    def _roles_payload(self) -> list[dict[str, object]]:
        liu_yang_mood = "平静" if self.state.resources.laziness >= 45 else "紧张"
        return [
            {"name": "刘洋", "mood": liu_yang_mood, "energy": max(0, min(100, 70 + self.state.resources.source_energy * 5))},
            {"name": "王楠", "favor": self.state.characters.get("wang_nan", CharacterState()).favor, "state": "待沟通电商策略"},
            {"name": "父亲", "favor": self.state.characters.get("liu_huaizhi", CharacterState()).favor, "state": "在家整理农具"},
            {"name": "母亲", "favor": self.state.characters.get("li_mei", CharacterState()).favor, "state": "准备早饭"},
            {"name": "姐姐", "favor": self.state.characters.get("liu_xiaoxue", CharacterState()).favor, "state": "省城打工"},
            {"name": "杨大振", "favor": self.state.characters.get("yang_dazhen", CharacterState()).favor, "state": "未结识"},
            {"name": "刘怀均", "favor": self.state.characters.get("liu_huaizhi", CharacterState()).favor, "state": "村口务农"},
        ]

    def _generate_daily_world(self) -> None:
        time_slots = ["清晨", "上午", "中午", "下午", "傍晚", "夜晚"]
        weather_choices = ["晴朗", "多云", "小雨", "大雨", "微风"]
        season_cycle = ["初夏", "盛夏", "初秋", "深秋", "初冬", "深冬", "初春", "晚春"]

        try:
            idx = time_slots.index(self.state.time)
        except ValueError:
            idx = 0
        self.state.time = time_slots[(idx + 1) % len(time_slots)]
        self.state.weather = random.choice(weather_choices)

        season_idx = min((self.state.turn - 1) // 30, len(season_cycle) - 1)
        self.state.season = season_cycle[season_idx]

        if self.state.weather in {"小雨", "大雨"}:
            self.state.resources.family_harmony = min(100, self.state.resources.family_harmony + 1)
        if self.state.company.unlocked:
            self.state.resources.villager_support = min(100, self.state.resources.villager_support + 1)

        role_events = [
            "父亲去田里看水渠，顺手把农具摆整齐了。",
            "母亲提醒你注意休息，别把身体拖垮。",
            "王楠发来语音，说短视频素材已经剪好。",
            "村口传来消息，明天集市会更热闹。",
        ]
        self.state.event_text = f"{self.state.weather}的{self.state.time}，{random.choice(role_events)}"

    def update_player_profile(self, name: str, identity: str, return_reason: str) -> str:
        if self.state.open_mode.profile_saved:
            return "主角设定已在首次流程中锁定；如需修改请新开局。"
        self.state.player_profile.name = (name.strip() or self.state.player_profile.name)[:32]
        self.state.player_profile.identity = (identity.strip() or self.state.player_profile.identity)[:64]
        self.state.player_profile.return_reason = (
            return_reason.strip() or self.state.player_profile.return_reason
        )[:200]
        self.state.open_mode.profile_saved = True
        self.state.open_mode.options_ready = False
        self.state.open_mode.last_options = []
        self.add_log(
            f"主角设定已更新：{self.state.player_profile.name} / {self.state.player_profile.identity}。"
        )
        return "主角设定已保存，后续 LLM 推理将使用新设定。"

    def open_mode_status(self) -> dict[str, object]:
        return {
            "profile_saved": self.state.open_mode.profile_saved,
            "options_ready": self.state.open_mode.options_ready,
            "can_play": self.state.open_mode.profile_saved,
            "last_scene": self.state.open_mode.last_scene,
            "last_goal": self.state.open_mode.last_goal,
            "last_options": list(self.state.open_mode.last_options),
            "last_play_result": self.state.open_mode.last_play_result,
            "last_stat_delta": self.state.open_mode.last_stat_delta,
        }

    def chapter_cards(self) -> list[dict[str, object]]:
        cards: list[dict[str, object]] = []
        for chapter_id, chapter in STORY_CHAPTERS.items():
            unlock_stage = cast(str, chapter["unlock_stage"])
            unlocked = self._stage_rank(self.state.stage) >= self._stage_rank(unlock_stage)
            progress = self._chapter_progress(chapter_id)
            stars = 0
            if progress >= 35:
                stars = 1
            if progress >= 70:
                stars = 2
            if progress >= 100:
                stars = 3
            cards.append(
                {
                    "chapter_id": chapter_id,
                    "volume": chapter["volume"],
                    "title": chapter["title"],
                    "unlocked": unlocked,
                    "progress": progress,
                    "stars": stars,
                    "completion_hint": self.chapter_completion_hint(chapter_id),
                    "avg_segments": chapter["avg_segments"],
                }
            )
        cards.sort(key=lambda item: cast(str, item["chapter_id"]))
        return cards

    def chapter_completion_hint(self, chapter_id: str) -> str:
        hints = {
            "v1c1": "完成一次播种-推进-收获循环，或触发家庭协作线。",
            "v1c2": "与导师/电商伙伴互动，解锁系统支援。",
            "v1c3": "完成至少一次直播带货。",
            "v1c4": "父亲与姐姐协作线至少触发其一。",
            "v2c1": "完成加工坊升级或一批加工产出。",
            "v2c2": "完成扩栏或雇佣动作。",
            "v2c3": "成立公司并推动分红或招工。",
            "v2c4": "完成订单履约。",
            "v3c1": "完成区域订单交付或推进日结算。",
            "v3c2": "执行公共项目或科研协同。",
            "v3c3": "触发终局结算或继续经营。",
            "v3c4": "完成示范复制或追加公共投入。",
        }
        return hints.get(chapter_id, "完成章节核心事件。")

    @staticmethod
    def chapter_star_rules() -> list[str]:
        return [
            "1星：章节进度达到 35%",
            "2星：章节进度达到 70%",
            "3星：章节进度达到 100%",
            "章节进度由对应经营指标自动计算。",
        ]

    def available_crops(self) -> dict[str, str]:
        return {
            crop_id: crop.name
            for crop_id, crop in CROPS.items()
            if self._stage_rank(self.state.stage) >= self._stage_rank(crop.unlock_stage)
        }

    def plant_crop(self, plot_id: int, crop_id: str) -> str:
        crop = CROPS.get(crop_id)
        if crop is None:
            return "不存在的作物编号。"
        plot = self._get_plot(plot_id)
        if plot is None:
            return "不存在的土地编号。"
        if plot.crop_id is not None:
            return "该土地已被占用。"
        if self.state.resources.money < crop.seed_cost:
            return "资金不足，无法购买种子。"

        plot.crop_id = crop_id
        plot.days_remaining = crop.grow_days
        plot.ready_to_harvest = False
        self.state.resources.money -= crop.seed_cost
        self.state.stats.planted_count += 1
        self.state.stats.current_turn_planted += 1
        self.add_log(f"在 {plot_id} 号地播种了 {crop.name}。")
        self.refresh_tasks()
        return f"播种成功：{crop.name}，预计 {crop.grow_days} 天成熟。"

    def harvest_all(self) -> str:
        harvested: list[str] = []
        for plot in self.state.plots:
            if not plot.crop_id or not plot.ready_to_harvest:
                continue
            crop = CROPS[plot.crop_id]
            self.state.inventory[crop.crop_id] = self.state.inventory.get(crop.crop_id, 0) + crop.yield_amount
            self.state.resources.particles += crop.particle_reward
            self.state.stats.harvest_count += 1
            harvested.append(crop.name)
            plot.crop_id = None
            plot.days_remaining = 0
            plot.ready_to_harvest = False

        if not harvested:
            return "当前没有可收获作物。"

        self._auto_convert_energy()
        self.add_log(f"完成收获：{'、'.join(harvested)}。")
        self.refresh_tasks()
        return f"本次收获：{'、'.join(harvested)}。已入库并获得微粒奖励。"

    def available_livestock(self) -> dict[str, str]:
        return {
            livestock_id: livestock.name
            for livestock_id, livestock in LIVESTOCKS.items()
            if self._stage_rank(self.state.stage) >= self._stage_rank(livestock.unlock_stage)
        }

    def raise_livestock(self, pen_id: int, livestock_id: str) -> str:
        livestock = LIVESTOCKS.get(livestock_id)
        if livestock is None:
            return "不存在的养殖品种。"
        active_pens = len([pen for pen in self.state.pens if pen.livestock_id is not None])
        if active_pens >= self.state.company.ranch_capacity:
            return "当前扩栏容量不足，请先进行养殖扩栏。"
        pen = self._get_pen(pen_id)
        if pen is None:
            return "不存在的棚舍编号。"
        if pen.livestock_id is not None:
            return "该棚舍已被占用。"
        if self.state.resources.money < livestock.buy_cost:
            return "资金不足，无法购入该养殖品种。"

        pen.livestock_id = livestock_id
        pen.days_remaining = livestock.cycle_days
        pen.ready_to_collect = False
        self.state.resources.money -= livestock.buy_cost
        self.add_log(f"在 {pen_id} 号棚舍购入了 {livestock.name}。")
        return f"养殖开始：{livestock.name}，预计 {livestock.cycle_days} 天后产出。"

    def collect_livestock_products(self) -> str:
        collected: list[str] = []
        for pen in self.state.pens:
            if not pen.livestock_id or not pen.ready_to_collect:
                continue
            livestock = LIVESTOCKS[pen.livestock_id]
            item_id = livestock.product_item_id
            self.state.inventory[item_id] = self.state.inventory.get(item_id, 0) + livestock.product_amount
            self.state.resources.particles += livestock.particle_reward
            self.state.stats.livestock_collections += 1
            collected.append(f"{livestock.name}->{ITEMS[item_id].name} x{livestock.product_amount}")
            pen.days_remaining = livestock.cycle_days
            pen.ready_to_collect = False

        if not collected:
            return "当前没有可收取的养殖产物。"

        self._auto_convert_energy()
        self.refresh_tasks()
        self.add_log("完成了一轮养殖产物收取。")
        return f"已收取：{'、'.join(collected)}。"

    def available_recipes(self) -> dict[str, str]:
        if "processing_workshop" not in self.state.system.unlocked_skills:
            return {}
        return {
            recipe_id: recipe.name
            for recipe_id, recipe in RECIPES.items()
            if self._stage_rank(self.state.stage) >= self._stage_rank(recipe.unlock_stage)
        }

    def process_goods(self, recipe_id: str, batches: int = 1) -> str:
        recipe = RECIPES.get(recipe_id)
        if recipe is None:
            return "不存在的加工配方。"
        if "processing_workshop" not in self.state.system.unlocked_skills:
            return "尚未解锁加工坊。"
        if self._stage_rank(self.state.stage) < self._stage_rank(recipe.unlock_stage):
            return "当前阶段尚未开放该配方。"
        if batches <= 0:
            return "加工批次数必须大于 0。"

        fee_discount = 1 - (self.state.company.workshop_level - 1) * WORKSHOP_PROCESSING_FEE_REDUCTION
        fee_discount = max(0.6, fee_discount)
        actual_fee = int(recipe.processing_fee * fee_discount * self.state.company.processing_fee_multiplier)
        required_money = actual_fee * batches
        if self.state.resources.money < required_money:
            return "资金不足，无法支付加工费用。"
        for item_id, amount in recipe.inputs.items():
            if self.state.inventory.get(item_id, 0) < amount * batches:
                return f"库存不足，缺少 {ITEMS[item_id].name}。"

        for item_id, amount in recipe.inputs.items():
            self.state.inventory[item_id] -= amount * batches
            if self.state.inventory[item_id] == 0:
                del self.state.inventory[item_id]
        self.state.resources.money -= required_money
        multipliers = self._get_partnership_multipliers()
        output_bonus = 1 + (self.state.company.workshop_level - 1) * WORKSHOP_OUTPUT_BONUS_RATE
        output_bonus *= self.state.company.processing_output_multiplier
        output_bonus *= multipliers['processing_output']
        produced_amount = max(1, int(recipe.output_amount * batches * output_bonus))
        self.state.inventory[recipe.output_item_id] = self.state.inventory.get(recipe.output_item_id, 0) + produced_amount
        self.state.resources.prosperity += batches
        self.state.stats.processed_batches += batches
        self.state.stats.current_turn_processed += batches
        self.state.company.brand_level = max(self.state.company.brand_level, 1)
        self.state.company.profit_pool += int(required_money * 0.25)
        self.add_log(f"完成加工：{recipe.name} x{batches}。")
        self.refresh_tasks()
        return f"已完成 {recipe.name} 加工 {batches} 批，产出 {produced_amount}。"

    def prepare_company(self) -> str:
        if "village_company" not in self.state.system.unlocked_skills:
            return "尚未完成村办公司筹备技能解锁。"
        if self.state.company.unlocked:
            return "村办公司已成立。"
        self.state.company.unlocked = True
        self.state.company.dividend_rate = 0.1
        self.state.company.brand_level = max(self.state.company.brand_level, 1)
        self.state.company.wage_per_employee = 80
        self.state.company.employee_morale = 68
        self.state.company.cash_reserve += 1000
        self.state.company.profit_pool += 400
        self.state.resources.prosperity += 3
        self.add_log("刘家村村办公司正式挂牌。")
        self.evaluate_stage_progression()
        return "村办公司已成立，雇佣与分红系统开放。"

    def hire_villagers(self, count: int) -> str:
        if not self.state.company.unlocked:
            return "请先成立村办公司。"
        if count <= 0:
            return "雇佣人数必须大于 0。"
        # Support score affects hiring cost: higher support = lower cost (up to 50% discount at 100)
        support_multiplier = 1 - (self.state.company.support_score / 200.0)
        hiring_cost = int(500 * count * support_multiplier)
        if self.state.resources.money < hiring_cost:
            return "资金不足，无法完成雇佣。"
        self.state.resources.money -= hiring_cost
        self.state.company.employees += count
        self.state.stats.villagers_hired += count
        self.state.resources.prosperity += count * 2
        self.state.company.cash_reserve += count * 200
        self.state.company.employee_morale = min(100, self.state.company.employee_morale + count)
        self.add_log(f"新增雇佣村民 {count} 人。")
        self.evaluate_stage_progression()
        self.refresh_tasks()
        return f"已雇佣 {count} 名村民，就业与产能同步提升。"

    def distribute_dividends(self) -> str:
        if not self.state.company.unlocked:
            return "请先成立村办公司。"
        if self.state.company.employees <= 0:
            return "当前没有可参与分红的村民。"
        base_pool = min(self.state.company.profit_pool, self.state.resources.money)
        base_dividend = int(base_pool * self.state.company.dividend_rate)
        if base_dividend <= 0:
            return "当前没有足够利润用于分红。"

        self.state.resources.money -= base_dividend
        self.state.company.profit_pool = max(0, self.state.company.profit_pool - base_dividend)
        self.state.company.cash_reserve += max(0, int(base_dividend * 0.25))
        self.state.resources.prosperity += self.state.company.employees + self.state.company.brand_level
        self.state.stats.dividend_rounds += 1
        self.state.company.employee_morale = min(100, self.state.company.employee_morale + 4)
        support_gain = min(5, base_dividend // 10000 + 1)
        support_gain = self._compute_support_gain(support_gain)
        self.state.company.support_score = min(100, self.state.company.support_score + support_gain)
        self.add_log(f"完成了第 {self.state.stats.dividend_rounds} 轮村民分红。")
        self.refresh_tasks()
        return f"已完成分红，支出 {base_dividend} 元，村民满意度提升。"

    def expand_ranch(self, blocks: int = 1) -> str:
        if blocks <= 0:
            return "扩栏数量必须大于 0。"
        total_cost = 0
        for index in range(blocks):
            level_cost = RANCH_EXPANSION_BASE_COST + (self.state.company.ranch_capacity + index - 1) * 260
            total_cost += level_cost
        if self.state.resources.money < total_cost:
            return "资金不足，无法完成扩栏。"

        self.state.resources.money -= total_cost
        old_capacity = self.state.company.ranch_capacity
        self.state.company.ranch_capacity += blocks
        for _ in range(blocks):
            self.state.pens.append(PenState(pen_id=len(self.state.pens) + 1))
        self.state.stats.ranch_expansions += blocks
        self.state.resources.prosperity += blocks
        self.add_log(f"养殖扩栏完成：容量 {old_capacity} -> {self.state.company.ranch_capacity}。")
        return f"扩栏成功，新增 {blocks} 个棚舍，总成本 {total_cost} 元。"

    def upgrade_workshop(self) -> str:
        if "processing_workshop" not in self.state.system.unlocked_skills:
            return "请先解锁加工坊技能。"
        next_level = self.state.company.workshop_level + 1
        if next_level > 5:
            return "加工坊已达到最高等级。"
        cost = WORKSHOP_UPGRADE_BASE_COST + (next_level - 2) * 700
        if self.state.resources.money < cost:
            return "资金不足，无法升级加工坊。"

        self.state.resources.money -= cost
        self.state.company.workshop_level = next_level
        self.state.stats.workshop_upgrades += 1
        self.state.resources.prosperity += 2
        self.state.company.brand_level = min(5, self.state.company.brand_level + 1)
        self.add_log(f"加工坊升级至 Lv{next_level}，成本 {cost} 元。")
        return f"加工坊已升级至 Lv{next_level}。"

    def advance_partnership(self, partner_type: str, cost_energy: int = 30) -> str:
        """Progress a partnership by consuming energy. Partner types: science, government, business, village_collective."""
        if self.state.resources.source_energy < cost_energy:
            return f"能量不足，需要 {cost_energy}，当前仅有 {self.state.resources.source_energy}。"
        
        partnerships = self.state.partnerships
        
        if partner_type == "science":
            progress_field = "science_progress"
            unlocked_field = "science_unlocked"
            partner_name = "科研合作"
        elif partner_type == "government":
            progress_field = "government_progress"
            unlocked_field = "government_unlocked"
            partner_name = "政府合作"
        elif partner_type == "business":
            progress_field = "business_progress"
            unlocked_field = "business_unlocked"
            partner_name = "企业合作"
        elif partner_type == "village_collective":
            progress_field = "village_progress"
            unlocked_field = "village_unlocked"
            partner_name = "村集体合作"
        else:
            return "不存在的合作类型。"
        
        # Check if partnership type is unlocked based on company level
        company_level = _company_level_by_profit(
            self.state.resources.money + self.state.company.profit_pool
        )
        required_levels = {
            "science": 2,
            "government": 3,
            "business": 3,
            "village_collective": 1,
        }
        
        if company_level < required_levels.get(partner_type, 5):
            return f"{partner_name}需要公司达到 Lv{required_levels.get(partner_type)} 才能开启。"
        
        # Consume energy and advance progress
        self.state.resources.source_energy -= cost_energy
        current_progress = getattr(partnerships, progress_field)
        new_progress = min(100, current_progress + 10)
        setattr(partnerships, progress_field, new_progress)
        
        # Mark as unlocked when reaching 100
        if new_progress == 100 and not getattr(partnerships, unlocked_field):
            setattr(partnerships, unlocked_field, True)
            self.state.resources.prosperity += 3
            self.state.company.support_score = min(100, self.state.company.support_score + 3)
            
            # Apply partner-specific unlock bonuses
            if partner_type == "science":
                self.add_log(f"{partner_name}达成！解锁加工收益提升 +20%。")
            elif partner_type == "government":
                self.add_log(f"{partner_name}达成！解锁订单奖励提升 +15%。")
            elif partner_type == "business":
                self.add_log(f"{partner_name}达成！解锁销售加成提升 +25%。")
            elif partner_type == "village_collective":
                self.add_log(f"{partner_name}达成！解锁村民支持度增长速度提升 +50%。")
            
            return f"{partner_name}已达成！解锁新的合作机遇。"
        
        self.add_log(f"{partner_name}进度推进至 {new_progress}%。")
        return f"{partner_name}进度：{current_progress}% → {new_progress}%"

    def order_report(self) -> list[str]:
        active_orders = [order for order in self.state.active_orders if not order.completed]
        if not active_orders:
            return ["暂无可执行订单。"]
        lines: list[str] = []
        for order in active_orders:
            required = "、".join(f"{ITEMS[item_id].name}x{amount}" for item_id, amount in order.required_items.items())
            lines.append(
                f"{order.order_id} | {order.title} | 需求: {required} | 奖励: {order.reward_money}元/{order.reward_particles}微粒"
            )
        return lines

    def fulfill_order(self, order_id: str) -> str:
        target = None
        for order in self.state.active_orders:
            if order.order_id == order_id and not order.completed:
                target = order
                break
        if target is None:
            return "不存在可交付的订单编号。"

        for item_id, amount in target.required_items.items():
            if self.state.inventory.get(item_id, 0) < amount:
                return f"库存不足，订单缺少 {ITEMS[item_id].name}。"

        for item_id, amount in target.required_items.items():
            self.state.inventory[item_id] -= amount
            if self.state.inventory[item_id] == 0:
                del self.state.inventory[item_id]

        target.completed = True
        multipliers = self._get_partnership_multipliers()
        order_multiplier = self.state.company.order_reward_multiplier * multipliers['order_reward']
        reward_money = int(target.reward_money * order_multiplier)
        reward_particles = int(target.reward_particles * order_multiplier)
        self.state.resources.money += reward_money
        self.state.resources.particles += target.reward_particles
        self.state.resources.prosperity += target.reward_prosperity
        self.state.resources.particles += reward_particles - target.reward_particles
        self.state.company.profit_pool += int(reward_money * 0.35)
        self.state.company.employee_morale = min(100, self.state.company.employee_morale + 2)
        brand_gain = min(3, max(1, reward_money // 100000))
        self.state.company.brand_score = min(100, self.state.company.brand_score + brand_gain)
        self.state.stats.orders_completed += 1
        self._auto_convert_energy()
        self.refresh_tasks()
        self.add_log(f"完成订单：{target.title}。")
        self._refresh_orders(force=False)
        return f"订单交付成功：{target.title}。"

    def _get_partnership_multipliers(self):
        """计算合作伙伴加成效果"""
        effects = {
            'processing_output': 1.0,
            'order_reward': 1.0,
            'sales': 1.0,
            'support_gain': 1.0
        }
        
        if self.state.partnerships.science_unlocked:
            effects['processing_output'] *= 1.20
        if self.state.partnerships.government_unlocked:
            effects['order_reward'] *= 1.15
        if self.state.partnerships.business_unlocked:
            effects['sales'] *= 1.25
        if self.state.partnerships.village_unlocked:
            effects['support_gain'] *= 1.50
            
        return effects

    def _compute_support_gain(self, base_amount: int) -> int:
        """计算支持度增长（包括村集体合作伙伴加成）"""
        multipliers = self._get_partnership_multipliers()
        return int(base_amount * multipliers['support_gain'])

    def apply_balance_config(
        self,
        wage_per_employee: int,
        dividend_rate_percent: float,
        processing_fee_multiplier: float,
        processing_output_multiplier: float,
        order_reward_multiplier: float,
    ) -> str:
        self.state.company.wage_per_employee = max(40, min(300, wage_per_employee))
        self.state.company.dividend_rate = max(0.05, min(0.4, dividend_rate_percent / 100))
        self.state.company.processing_fee_multiplier = max(0.5, min(1.8, processing_fee_multiplier))
        self.state.company.processing_output_multiplier = max(0.7, min(2.2, processing_output_multiplier))
        self.state.company.order_reward_multiplier = max(0.6, min(2.0, order_reward_multiplier))
        self.add_log("已应用经营平衡参数。")
        return "平衡参数已更新。"

    def simulate_projection(self, days: int) -> dict[str, int]:
        days = max(1, min(30, days))
        preview = GameState.from_dict(self.state.to_dict())
        engine = GameEngine(preview)
        baseline_money = engine.state.resources.money
        baseline_prosperity = engine.state.resources.prosperity
        baseline_energy = engine.state.resources.source_energy
        for _ in range(days):
            try:
                engine.advance_day()
            except ValueError:
                break
        return {
            "days": days,
            "money_delta": engine.state.resources.money - baseline_money,
            "prosperity_delta": engine.state.resources.prosperity - baseline_prosperity,
            "energy_delta": engine.state.resources.source_energy - baseline_energy,
            "employees": engine.state.company.employees,
        }

    def trigger_chapter_event(self, chapter_id: str, choice_id: str) -> str:
        if chapter_id not in STORY_CHAPTERS:
            return "未知章节。"

        if chapter_id == "v1c1":
            if choice_id == "farm_first":
                self.plant_crop(1, "vegetable")
                self.advance_day()
                return self.harvest_all()
            if choice_id == "family_first":
                return self.interact("liu_huaizhi")

        if chapter_id == "v1c2":
            if choice_id == "mentor":
                return self.interact("yang_dazhen")
            if choice_id == "stream":
                return self.interact("wang_nan")

        if chapter_id == "v1c3":
            if choice_id == "stream_now":
                return self.sell_inventory("stream")
            if choice_id == "harvest_then_stream":
                self.harvest_all()
                return self.sell_inventory("stream")

        if chapter_id == "v1c4":
            if choice_id == "father_coop":
                self.interact("liu_huaizhi")
                return "家庭协作线推进：父子经营协同提升。"
            if choice_id == "sister_plan":
                self.interact("liu_xiaoxue")
                return "家庭协作线推进：姐姐回乡计划进入执行阶段。"

        if chapter_id.startswith("v2"):
            self.state.stage = "scale_up"
            self.state.resources.source_energy += 8
            self.state.resources.money += 3200

        if chapter_id == "v2c1":
            if "processing_workshop" not in self.state.system.unlocked_skills:
                self.unlock_skill("processing_workshop")
            self.state.inventory["strawberry"] = self.state.inventory.get("strawberry", 0) + 4
            if choice_id == "upgrade_workshop":
                return self.upgrade_workshop()
            if choice_id == "produce_batch":
                return self.process_goods("fruit_jam", 1)

        if chapter_id == "v2c2":
            if choice_id == "expand":
                return self.expand_ranch(1)
            if choice_id == "hire":
                if not self.state.company.unlocked:
                    self.unlock_skill("village_company")
                    self.prepare_company()
                return self.hire_villagers(2)

        if chapter_id == "v2c3":
            if "village_company" not in self.state.system.unlocked_skills:
                self.unlock_skill("village_company")
            self.prepare_company()
            self.hire_villagers(3)
            if choice_id == "dividend":
                return self.distribute_dividends()
            return "公司运营结构已完成搭建。"

        if chapter_id == "v2c4":
            self.state.inventory["vegetable"] = self.state.inventory.get("vegetable", 0) + 6
            self.state.inventory["egg"] = self.state.inventory.get("egg", 0) + 4
            if choice_id == "deliver_order":
                return self.fulfill_order("fresh_bundle")
            if choice_id == "stream_brand":
                self.sell_inventory("stream")
                return self.fulfill_order("fresh_bundle")

        if chapter_id.startswith("v3"):
            self.state.stage = "common_prosperity"
            if not self.state.company.unlocked:
                if "village_company" not in self.state.system.unlocked_skills:
                    self.state.resources.source_energy += 8
                    self.unlock_skill("village_company")
                self.prepare_company()
                self.hire_villagers(3)

        if chapter_id == "v3c1":
            self.state.inventory["vegetable"] = self.state.inventory.get("vegetable", 0) + 6
            self.state.inventory["egg"] = self.state.inventory.get("egg", 0) + 4
            if choice_id == "deliver_order":
                return self.fulfill_order("fresh_bundle")
            return self.advance_day()

        if chapter_id == "v3c2":
            if choice_id == "public_project":
                self.state.resources.money += 2000
                self.state.resources.prosperity += 3
                self.add_log("完成一项乡村公共设施改造。")
                return "基础设施项目已落地，共富指数上升。"
            if choice_id == "research":
                self.interact("yang_dazhen")
                self.interact("zhao_jiangxin")
                return "科研协同强化，技术溢出带动产业效率。"

        if chapter_id == "v3c3":
            if choice_id == "ending":
                return self.ending_summary()
            if choice_id == "continue":
                return self.advance_day()

        if chapter_id == "v3c4":
            if choice_id == "replicate":
                self.state.resources.prosperity += 5
                self.state.resources.money += 3200
                self.add_log("示范复制成功，周边乡村完成首轮落地。")
                return "示范复制完成，区域影响力显著提升。"
            if choice_id == "invest_public":
                invest = min(2000, self.state.resources.money)
                self.state.resources.money -= invest
                self.state.resources.prosperity += 4
                self.add_log("完成新一轮公共设施投入。")
                return "公共投入已执行，长期共富能力增强。"

        return "该选项暂未配置事件。"

    def dynamic_chapter_text(self, chapter_id: str, player_intent: str) -> str:
        chapter = STORY_CHAPTERS.get(chapter_id)
        title = cast(str, chapter["title"]) if chapter else "未知章节"
        return generate_dynamic_story(self.status_snapshot(), title, player_intent)

    def open_mode_options(self, scene: str, player_goal: str) -> list[str]:
        if not self.state.open_mode.profile_saved:
            return ["请先保存主角设定，再生成行动建议。"]
        safe_scene = scene.strip() or "刘家村村口"
        safe_goal = player_goal.strip() or "低压力推进经营并保持家庭关系稳定"
        options = generate_open_gameplay_options(self.status_snapshot(), safe_scene, safe_goal, option_count=3)
        self.state.open_mode.last_scene = safe_scene
        self.state.open_mode.last_goal = safe_goal
        self.state.open_mode.last_options = options[:3]
        self.state.open_mode.options_ready = True
        return options

    def open_mode_suggest(self, scene: str, player_goal: str) -> str:
        options = self.open_mode_options(scene, player_goal)
        lines = [f"{idx + 1}. {item}" for idx, item in enumerate(options)]
        return "LLM 生成行动建议：" + " | ".join(lines)

    def play_open_mode_action(self, scene: str, selected_action: str) -> str:
        if not self.state.open_mode.profile_saved:
            return "请先完成主角设定。"
        safe_scene = scene.strip() or "刘家村村口"
        safe_action = selected_action.strip() or "先在村里散步并观察行情"
        resolved = resolve_open_gameplay_action(self.status_snapshot(), safe_scene, safe_action)
        text = self._strip_llm_tail_sections(str(resolved.get("text", "你完成了行动。")))
        effects = resolved.get("effects", {})
        if isinstance(effects, dict):
            self._apply_open_effects(effects)
        self.add_log(f"开放玩法：{safe_action}")
        self.add_log(text)
        day_result = self.advance_day()

        # 每推进一天，自动刷新下一天的三项行动建议。
        next_scene = f"刘家村，第 {self.state.turn} 天，清晨"
        next_goal = self.state.open_mode.last_goal or "稳住现金流并推进主线"
        next_options = self.open_mode_options(next_scene, next_goal)

        self.refresh_tasks()
        option_lines = [f"{idx + 1}. {item}" for idx, item in enumerate(next_options[:3])]
        options_block = "\n".join(option_lines)
        return f"{text}\n【日结】{day_result}\n【次日可选行动】\n{options_block}"

    def play_panel_mode_action(self, scene: str, selected_action: str) -> str:
        safe_scene = scene.strip() or "刘家村村口"
        safe_action = selected_action.strip() or "先在村里散步并观察行情"
        resolved = resolve_open_gameplay_action_fast(self.status_snapshot(), safe_scene, safe_action)
        text = self._strip_llm_tail_sections(str(resolved.get("text", "你完成了行动。")))
        effects = resolved.get("effects", {})
        if isinstance(effects, dict):
            self._apply_open_effects(effects)
        self.add_log(f"模拟器行动：{safe_action}")
        self.add_log(text)
        day_result = self.advance_day()
        self.refresh_tasks()
        return f"{text}\n【日结】{day_result}"

    @staticmethod
    def _strip_llm_tail_sections(text: str) -> str:
        raw = (text or "").strip()
        if not raw:
            return "你完成了行动。"
        marker = re.search(r"(?:【次日可选行动】|次日可选行动\s*[：:]?|次日可选\s*[：:]?|【日结】)", raw)
        if marker:
            trimmed = raw[: marker.start()].strip()
            if trimmed:
                return trimmed
        return raw

    def _apply_open_effects(self, effects: dict[str, object]) -> None:
        money = self._as_int_default(effects.get("money"), 0)
        particles = self._as_int_default(effects.get("particles"), 0)
        prosperity = self._as_int_default(effects.get("prosperity"), 0)
        laziness = self._as_int_default(effects.get("laziness"), 0)

        self.state.resources.money = max(0, self.state.resources.money + money)
        self.state.resources.particles = max(0, self.state.resources.particles + particles)
        self.state.resources.prosperity = max(0, self.state.resources.prosperity + prosperity)
        self.state.resources.laziness = max(0, min(100, self.state.resources.laziness + laziness))
        self._auto_convert_energy()

    @staticmethod
    def _as_int_default(value: object, default: int) -> int:
        try:
            return int(cast(object, value))
        except (TypeError, ValueError):
            return default

    def sell_inventory(self, channel: str = "market") -> str:
        if not self.state.inventory:
            return "仓库为空，没有可销售的农产品。"

        total = 0
        sold_lines: list[str] = []
        multiplier = 1.2 if channel == "stream" and "live_boost" in self.state.system.unlocked_skills else 1.0
        base_multiplier = 1.1 if channel == "stream" else 1.0
        # Use brand_score (0-100) for sales multiplier: 100 score = 50% bonus
        brand_multiplier = 1 + (self.state.company.brand_score / 200.0)
        partnership_multipliers = self._get_partnership_multipliers()
        business_multiplier = partnership_multipliers['sales']

        for item_id, amount in list(self.state.inventory.items()):
            item = ITEMS[item_id]
            revenue = int(item.sell_price * amount * base_multiplier * multiplier * brand_multiplier * business_multiplier)
            total += revenue
            sold_lines.append(f"{item.name} x{amount}")
            del self.state.inventory[item_id]

        self.state.resources.money += total
        self.state.stats.sales_revenue += total
        self.state.company.profit_pool += int(total * 0.3)
        brand_gain = min(4, max(1, total // 50000))
        if channel == "stream":
            brand_gain = int(brand_gain * 1.5)
        self.state.company.brand_score = min(100, self.state.company.brand_score + brand_gain)
        if channel == "stream":
            self.state.stats.stream_count += 1
            self.state.stats.current_turn_streamed += 1
            self.state.characters["wang_nan"].favor += 2
            self.state.resources.prosperity += 1
            self.add_log("王楠协助完成了一场直播带货。")

        self.refresh_tasks()
        return f"已通过{'直播' if channel == 'stream' else '集市'}售出 {'、'.join(sold_lines)}，收入 {total} 元。"

    def interact(self, character_id: str) -> str:
        definition = CHARACTERS.get(character_id)
        if definition is None:
            return "不存在的角色编号。"
        character_state = self.state.characters[character_id]
        character_state.favor += definition.favor_gain
        self.state.resources.prosperity += definition.prosperity_gain
        self.state.resources.money += definition.money_gain
        self.state.resources.particles += definition.particle_gain
        self.state.stats.interaction_count += 1
        self.state.stats.current_turn_interactions += 1
        self.state.stats.interactions_by_character[character_id] = (
            self.state.stats.interactions_by_character.get(character_id, 0) + 1
        )
        self._auto_convert_energy()
        self.add_log(f"与 {definition.name} 互动，关系有所提升。")
        self.refresh_tasks()
        return (
            f"与 {definition.name} 交流完成，好感 +{definition.favor_gain}，"
            f"共同富裕指数 +{definition.prosperity_gain}。"
        )

    def unlock_skill(self, skill_id: str) -> str:
        skill = SKILLS.get(skill_id)
        if skill is None:
            return "不存在的系统技能。"
        if skill_id in self.state.system.unlocked_skills:
            return "该技能已解锁。"
        if self._stage_rank(self.state.stage) < self._stage_rank(skill.required_stage):
            return "当前阶段尚未达到技能解锁条件。"
        if self.state.resources.source_energy < skill.energy_cost:
            return "生命源能不足。"

        self.state.resources.source_energy -= skill.energy_cost
        self.state.system.unlocked_skills.append(skill_id)
        if skill_id == "smart_irrigation":
            self.state.plots.append(PlotState(plot_id=len(self.state.plots) + 1))
            self.state.pens.append(PenState(pen_id=len(self.state.pens) + 1))
        if skill_id == "village_company":
            self.state.resources.prosperity += 5
        if skill_id == "processing_workshop":
            self.state.company.brand_level = max(self.state.company.brand_level, 1)
        self.add_log(f"系统技能已解锁：{skill.name}。")
        self.evaluate_stage_progression()
        return f"已解锁技能：{skill.name}。"

    def advance_day(self) -> str:
        self.state.turn += 1
        self.state.stats.days_played += 1
        self.state.resources.particles += self.state.system.daily_particles
        self._generate_daily_world()

        speed_bonus = 1 if "automation_kit" in self.state.system.unlocked_skills else 0
        for plot in self.state.plots:
            if not plot.crop_id or plot.ready_to_harvest:
                continue
            plot.days_remaining -= 1 + speed_bonus
            if plot.days_remaining <= 0:
                plot.days_remaining = 0
                plot.ready_to_harvest = True

        for pen in self.state.pens:
            if not pen.livestock_id or pen.ready_to_collect:
                continue
            pen.days_remaining -= 1
            if pen.days_remaining <= 0:
                pen.days_remaining = 0
                pen.ready_to_collect = True

        if self.state.company.unlocked and self.state.company.employees > 0:
            payroll = self.state.company.employees * self.state.company.wage_per_employee
            if self.state.resources.money >= payroll:
                self.state.resources.money -= payroll
                self.state.company.cash_reserve += int(payroll * 0.2)
                self.state.company.employee_morale = min(100, self.state.company.employee_morale + 1)
                support_gain = min(2, max(1, self.state.company.employees // 5))
                support_gain = self._compute_support_gain(support_gain)
                self.state.company.support_score = min(100, self.state.company.support_score + support_gain)
                self.add_log(f"村办公司发放日常劳务支出 {payroll} 元。")
            else:
                self.state.company.employee_morale = max(0, self.state.company.employee_morale - 8)
                self.state.resources.prosperity = max(0, self.state.resources.prosperity - 1)
                self.state.resources.money = max(0, self.state.resources.money)
                self.state.company.support_score = max(0, self.state.company.support_score - 2)
                self.add_log("工资发放不足，村民士气下降。")

        if self.state.company.unlocked and self.state.company.employee_morale < 30 and self.state.company.employees > 0:
            self.state.company.employees -= 1
            self.state.resources.prosperity = max(0, self.state.resources.prosperity - 2)
            self.add_log("因士气过低，有村民退出公司。")

        self._auto_convert_energy()
        self._refresh_orders(force=False)
        self.evaluate_stage_progression()
        self.state.stats.current_turn_planted = 0
        self.state.stats.current_turn_interactions = 0
        self.state.stats.current_turn_streamed = 0
        self.state.stats.current_turn_processed = 0
        self.refresh_tasks(reset_daily=True)
        self.add_log("新的一天开始了，系统完成日常结算。")

        problems = validate_runtime_state(
            self.state.resources.money,
            self.state.resources.particles,
            self.state.resources.source_energy,
            self.state.company.employees,
        )
        if problems:
            raise ValueError("；".join(problems))

        return (
            f"第 {self.state.turn} 天开始。今日自动获得 {self.state.system.daily_particles} 微粒。"
        )

    def evaluate_stage_progression(self) -> None:
        if self.state.stage == "startup":
            requirements = STAGE_REQUIREMENTS["scale_up"]
            if (
                self.state.resources.money >= self._as_int(requirements["money"])
                and self.state.stats.harvest_count >= self._as_int(requirements["harvest_count"])
                and self.state.characters["wang_nan"].favor >= self._as_int(requirements["favor_wang_nan"])
            ):
                self.state.stage = "scale_up"
                self.state.system.level = 3
                self.state.system.daily_particles = cast(int, SYSTEM_LEVELS[3]["daily_particles"])
                self.add_log("阶段升级：你已进入产业升级期。")
        if self.state.stage == "scale_up":
            requirements = STAGE_REQUIREMENTS["common_prosperity"]
            if (
                self.state.resources.money >= self._as_int(requirements["money"])
                and self.state.resources.prosperity >= self._as_int(requirements["prosperity"])
                and self.state.company.employees >= self._as_int(requirements["employees"])
                and cast(str, requirements["skill"]) in self.state.system.unlocked_skills
            ):
                self.state.stage = "common_prosperity"
                self.add_log("阶段升级：共同富裕路径已正式建立。")

    def refresh_tasks(self, reset_daily: bool = False) -> None:
        for task_id, definition in TASKS.items():
            task_state = self.state.tasks[task_id]
            if definition.category == "日常" and reset_daily:
                task_state.completed = False
                task_state.claimed = False
                task_state.progress = 0

            if any(not self.state.tasks[dependency].claimed for dependency in definition.depends_on):
                continue

            progress = self._resolve_task_progress(definition)
            task_state.progress = progress
            if progress < definition.target_value or task_state.claimed:
                continue

            task_state.completed = True
            task_state.claimed = True
            self._apply_rewards(definition.rewards)
            self.add_log(f"任务完成：{definition.title}。")

    def task_report(self) -> list[str]:
        lines: list[str] = []
        for task_id, definition in TASKS.items():
            task_state = self.state.tasks[task_id]
            progress = min(task_state.progress, definition.target_value)
            state_label = "已完成" if task_state.claimed else "进行中"
            lines.append(
                f"[{definition.category}] {definition.title} - {progress}/{definition.target_value} - {state_label}"
            )
        return lines

    def plot_report(self) -> list[str]:
        lines: list[str] = []
        for plot in self.state.plots:
            if not plot.crop_id:
                lines.append(f"地块 {plot.plot_id}: 空闲")
                continue
            crop = CROPS[plot.crop_id]
            status = "可收获" if plot.ready_to_harvest else f"{plot.days_remaining} 天后成熟"
            lines.append(f"地块 {plot.plot_id}: {crop.name} - {status}")
        return lines

    def pen_report(self) -> list[str]:
        lines: list[str] = []
        for pen in self.state.pens:
            if not pen.livestock_id:
                lines.append(f"棚舍 {pen.pen_id}: 空闲")
                continue
            livestock = LIVESTOCKS[pen.livestock_id]
            status = "可收取" if pen.ready_to_collect else f"{pen.days_remaining} 天后产出"
            lines.append(f"棚舍 {pen.pen_id}: {livestock.name} - {status}")
        return lines

    def order_report(self) -> list[str]:
        lines: list[str] = []
        for order in self.state.active_orders:
            if order.completed:
                continue
            required = ", ".join(
                f"{ITEMS[item_id].name}x{amount}" for item_id, amount in order.required_items.items()
            )
            lines.append(
                f"{order.title} | 需求: {required} | 奖励: {order.reward_money}元/{order.reward_particles}微粒"
            )
        return lines or ["暂无可交付订单。"]

    def inventory_report(self) -> list[str]:
        if not self.state.inventory:
            return ["仓库为空。"]
        return [f"{ITEMS[item_id].name} x{amount}" for item_id, amount in self.state.inventory.items()]

    def character_report(self) -> list[str]:
        return [
            f"{definition.name}({definition.role}) - 好感 {self.state.characters[character_id].favor}"
            for character_id, definition in CHARACTERS.items()
        ]

    def company_report(self) -> list[str]:
        company = self.state.company
        status = "已成立" if company.unlocked else "未成立"
        return [
            f"公司状态: {status}",
            f"雇佣人数: {company.employees}",
            f"品牌等级: {company.brand_level}",
            f"加工坊等级: {company.workshop_level}",
            f"养殖容量: {company.ranch_capacity}",
            f"基础日薪: {company.wage_per_employee}",
            f"员工士气: {company.employee_morale}",
            f"分红比例: {int(company.dividend_rate * 100)}%",
            f"公司储备金: {company.cash_reserve}",
            f"可分配利润池: {company.profit_pool}",
        ]

    def ending_summary(self) -> str:
        return ENDING_TEXT[self.state.stage]

    def _resolve_task_progress(self, definition: TaskDefinition) -> int:
        if definition.target_type in {"stat", "turn_stat"}:
            return int(getattr(self.state.stats, definition.target_key))
        if definition.target_type == "favor":
            return self.state.characters[definition.target_key].favor
        if definition.target_type == "interaction":
            return self.state.stats.interactions_by_character.get(definition.target_key, 0)
        return 0

    def _apply_rewards(self, rewards: dict[str, Any]) -> None:
        self.state.resources.money += self._as_int(rewards.get("money", 0))
        self.state.resources.particles += self._as_int(rewards.get("particles", 0))
        self.state.resources.source_energy += self._as_int(rewards.get("source_energy", 0))
        self.state.resources.prosperity += self._as_int(rewards.get("prosperity", 0))
        favor_rewards = rewards.get("favor", {})
        favor_mapping = cast(dict[str, Any], favor_rewards)
        for character_id, favor in favor_mapping.items():
            self.state.characters[character_id].favor += self._as_int(favor)
        self._auto_convert_energy()

    @staticmethod
    def _as_int(value: Any) -> int:
        if isinstance(value, bool):
            return int(value)
        if isinstance(value, int):
            return value
        if isinstance(value, float):
            return int(value)
        if isinstance(value, str):
            return int(value)
        raise TypeError(f"Cannot convert value to int: {value!r}")

    def _auto_convert_energy(self) -> None:
        while self.state.resources.particles >= PARTICLES_PER_ENERGY:
            self.state.resources.particles -= PARTICLES_PER_ENERGY
            self.state.resources.source_energy += 1

    def _get_plot(self, plot_id: int) -> PlotState | None:
        for plot in self.state.plots:
            if plot.plot_id == plot_id:
                return plot
        return None

    def _get_pen(self, pen_id: int) -> PenState | None:
        for pen in self.state.pens:
            if pen.pen_id == pen_id:
                return pen
        return None

    def _refresh_orders(self, force: bool) -> None:
        active_orders = [order for order in self.state.active_orders if not order.completed]
        if not force and self.state.turn % ORDER_DAILY_ROLL_INTERVAL != 0:
            return
        if len(active_orders) >= 3:
            return

        pool = [
            order
            for order in ORDER_TEMPLATES.values()
            if self._stage_rank(self.state.stage) >= self._stage_rank(order.unlock_stage)
        ]
        if not pool:
            return
        order = pool[(self.state.turn + len(active_orders)) % len(pool)]
        if any(existing.order_id == order.order_id and not existing.completed for existing in self.state.active_orders):
            return
        self.state.active_orders.append(
            OrderState(
                order_id=order.order_id,
                title=order.title,
                required_items=dict(order.required_items),
                reward_money=order.reward_money,
                reward_prosperity=order.reward_prosperity,
                reward_particles=order.reward_particles,
            )
        )
        self.add_log(f"新订单到达：{order.title}。")

    def _chapter_progress(self, chapter_id: str) -> int:
        mapping = {
            "v1c1": min(100, self.state.stats.harvest_count * 40),
            "v1c2": min(100, self.state.stats.interaction_count * 20),
            "v1c3": min(100, self.state.stats.stream_count * 50),
            "v2c1": min(100, self.state.stats.processed_batches * 35),
            "v2c2": min(100, self.state.stats.ranch_expansions * 50),
            "v2c3": min(100, self.state.stats.villagers_hired * 20),
            "v3c1": min(100, self.state.stats.orders_completed * 25),
            "v3c2": min(100, self.state.resources.prosperity * 4),
            "v3c3": min(100, self.state.stats.dividend_rounds * 50),
            "v1c4": min(100, (self.state.characters["liu_huaizhi"].favor + self.state.characters["liu_xiaoxue"].favor) * 4),
            "v2c4": min(100, self.state.stats.orders_completed * 30),
            "v3c4": min(100, self.state.resources.prosperity * 3),
        }
        return mapping.get(chapter_id, 0)

    @staticmethod
    def _stage_rank(stage: str) -> int:
        order = {"startup": 0, "scale_up": 1, "common_prosperity": 2}
        return order[stage]
