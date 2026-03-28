from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


def _str_list() -> list[str]:
    return []


def _str_int_dict() -> dict[str, int]:
    return {}


def _order_state_list() -> list[OrderState]:
    return []


@dataclass(slots=True)
class CropDefinition:
    crop_id: str
    name: str
    seed_cost: int
    sell_price: int
    grow_days: int
    yield_amount: int
    particle_reward: int
    unlock_stage: str


@dataclass(slots=True)
class ItemDefinition:
    item_id: str
    name: str
    sell_price: int
    category: str


@dataclass(slots=True)
class LivestockDefinition:
    livestock_id: str
    name: str
    buy_cost: int
    product_item_id: str
    cycle_days: int
    product_amount: int
    particle_reward: int
    unlock_stage: str


@dataclass(slots=True)
class RecipeDefinition:
    recipe_id: str
    name: str
    inputs: dict[str, int]
    output_item_id: str
    output_amount: int
    processing_fee: int
    unlock_stage: str


@dataclass(slots=True)
class OrderDefinition:
    order_id: str
    title: str
    required_items: dict[str, int]
    reward_money: int
    reward_prosperity: int
    reward_particles: int
    unlock_stage: str


@dataclass(slots=True)
class CharacterDefinition:
    character_id: str
    name: str
    role: str
    description: str
    favor_gain: int
    prosperity_gain: int
    money_gain: int
    particle_gain: int


@dataclass(slots=True)
class SkillDefinition:
    skill_id: str
    name: str
    energy_cost: int
    description: str
    required_stage: str


@dataclass(slots=True)
class TaskDefinition:
    task_id: str
    title: str
    category: str
    description: str
    target_type: str
    target_key: str
    target_value: int
    rewards: dict[str, Any]
    depends_on: list[str] = field(default_factory=_str_list)


@dataclass(slots=True)
class PlotState:
    plot_id: int
    crop_id: str | None = None
    days_remaining: int = 0
    ready_to_harvest: bool = False


@dataclass(slots=True)
class PenState:
    pen_id: int
    livestock_id: str | None = None
    days_remaining: int = 0
    ready_to_collect: bool = False


@dataclass(slots=True)
class ResourceState:
    money: int = 0
    particles: int = 0
    source_energy: int = 0
    prosperity: int = 0
    laziness: int = 0
    villager_support: int = 0
    family_harmony: int = 0
    land: float = 0.5


@dataclass(slots=True)
class SystemState:
    level: int = 1
    daily_particles: int = 0
    unlocked_skills: list[str] = field(default_factory=_str_list)


@dataclass(slots=True)
class CharacterState:
    favor: int = 0
    unlocked: bool = True


@dataclass(slots=True)
class StatsState:
    planted_count: int = 0
    harvest_count: int = 0
    interaction_count: int = 0
    stream_count: int = 0
    sales_revenue: int = 0
    processed_batches: int = 0
    villagers_hired: int = 0
    dividend_rounds: int = 0
    livestock_collections: int = 0
    orders_completed: int = 0
    ranch_expansions: int = 0
    workshop_upgrades: int = 0
    days_played: int = 1
    current_turn_planted: int = 0
    current_turn_interactions: int = 0
    current_turn_streamed: int = 0
    current_turn_processed: int = 0
    interactions_by_character: dict[str, int] = field(default_factory=_str_int_dict)


@dataclass(slots=True)
class CompanyState:
    unlocked: bool = False
    employees: int = 0
    dividend_rate: float = 0.0
    brand_level: int = 0
    cash_reserve: int = 0
    wage_per_employee: int = 80
    workshop_level: int = 1
    ranch_capacity: int = 1
    employee_morale: int = 60
    profit_pool: int = 0
    processing_fee_multiplier: float = 1.0
    processing_output_multiplier: float = 1.0
    order_reward_multiplier: float = 1.0
    support_score: int = 0  # Village support, increments from wage/dividend/help actions, 0-100
    brand_score: int = 0    # Brand recognition, increments from sales/marketing/collabs, 0-100


@dataclass(slots=True)
class OrderState:
    order_id: str
    title: str
    required_items: dict[str, int]
    reward_money: int
    reward_prosperity: int
    reward_particles: int
    completed: bool = False


@dataclass(slots=True)
class TaskState:
    completed: bool = False
    claimed: bool = False
    progress: int = 0


@dataclass(slots=True)
class PlayerProfile:
    name: str = "刘洋"
    identity: str = "回乡青年"
    return_reason: str = "考研失利后希望以低压力方式重建生活"


@dataclass(slots=True)
class OpenModeState:
    profile_saved: bool = False
    options_ready: bool = False
    last_scene: str = ""
    last_goal: str = ""
    last_options: list[str] = field(default_factory=_str_list)
    last_play_result: str = ""
    last_stat_delta: str = ""


@dataclass(slots=True)
class PartnershipState:
    """Track collaboration progress with 4 partner types: science, government, business, village collective."""
    science_progress: int = 0        # 科研合作进度 (0-100)
    government_progress: int = 0     # 政府合作进度 (0-100)
    business_progress: int = 0       # 企业合作进度 (0-100)
    village_progress: int = 0        # 村集体合作进度 (0-100)
    science_unlocked: bool = False   # 科研合作已解锁触发
    government_unlocked: bool = False # 政府合作已解锁触发
    business_unlocked: bool = False  # 企业合作已解锁触发
    village_unlocked: bool = False   # 村集体合作已解锁触发


@dataclass(slots=True)
class GameState:
    turn: int
    time: str
    season: str
    weather: str
    stage: str
    resources: ResourceState
    system: SystemState
    plots: list[PlotState]
    pens: list[PenState]
    inventory: dict[str, int]
    characters: dict[str, CharacterState]
    tasks: dict[str, TaskState]
    stats: StatsState
    company: CompanyState
    player_profile: PlayerProfile = field(default_factory=PlayerProfile)
    open_mode: OpenModeState = field(default_factory=OpenModeState)
    partnerships: PartnershipState = field(default_factory=PartnershipState)
    active_orders: list[OrderState] = field(default_factory=_order_state_list)
    event_text: str = ""
    flags: list[str] = field(default_factory=_str_list)
    log: list[str] = field(default_factory=_str_list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "GameState":
        return cls(
            turn=raw["turn"],
            time=str(raw.get("time", "清晨")),
            season=str(raw.get("season", "初夏")),
            weather=str(raw.get("weather", "晴朗")),
            stage=raw["stage"],
            resources=ResourceState(**raw["resources"]),
            system=SystemState(**raw["system"]),
            plots=[PlotState(**plot) for plot in raw["plots"]],
            pens=[PenState(**pen) for pen in raw.get("pens", [])],
            inventory=dict(raw["inventory"]),
            characters={
                character_id: CharacterState(**state)
                for character_id, state in raw["characters"].items()
            },
            tasks={task_id: TaskState(**task) for task_id, task in raw["tasks"].items()},
            stats=StatsState(**raw["stats"]),
            company=CompanyState(**raw.get("company", {})),
            player_profile=PlayerProfile(**raw.get("player_profile", {})),
            open_mode=OpenModeState(**raw.get("open_mode", {})),
            partnerships=PartnershipState(**raw.get("partnerships", {})),
            active_orders=[OrderState(**order) for order in raw.get("active_orders", [])],
            event_text=str(raw.get("event_text", "你刚回到老家，考研失败，身心俱疲，躺平智辅系统突然激活。")),
            flags=list(raw.get("flags", [])),
            log=list(raw.get("log", [])),
        )
