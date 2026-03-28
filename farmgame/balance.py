from __future__ import annotations

from farmgame.models import CropDefinition, ItemDefinition, LivestockDefinition, OrderDefinition, RecipeDefinition, SkillDefinition

PARTICLES_PER_ENERGY = 1000

STAGE_ORDER = ["startup", "scale_up", "common_prosperity"]

SYSTEM_LEVELS: dict[int, dict[str, int | str]] = {
    1: {"name": "城市感知", "daily_particles": 30},
    2: {"name": "乡野部署", "daily_particles": 300},
    3: {"name": "规模农场", "daily_particles": 3000},
}

STARTING_LEVEL = 2
STARTING_STAGE = "startup"

STAGE_LABELS = {
    "startup": "躺平起步",
    "scale_up": "产业升级",
    "common_prosperity": "共同富裕",
}

CROPS = {
    "watermelon": CropDefinition(
        crop_id="watermelon",
        name="西甜瓜",
        seed_cost=120,
        sell_price=220,
        grow_days=2,
        yield_amount=2,
        particle_reward=180,
        unlock_stage="startup",
    ),
    "vegetable": CropDefinition(
        crop_id="vegetable",
        name="时令蔬菜",
        seed_cost=60,
        sell_price=110,
        grow_days=1,
        yield_amount=2,
        particle_reward=90,
        unlock_stage="startup",
    ),
    "strawberry": CropDefinition(
        crop_id="strawberry",
        name="草莓",
        seed_cost=200,
        sell_price=360,
        grow_days=2,
        yield_amount=2,
        particle_reward=260,
        unlock_stage="scale_up",
    ),
    "rice": CropDefinition(
        crop_id="rice",
        name="优质水稻",
        seed_cost=150,
        sell_price=260,
        grow_days=3,
        yield_amount=3,
        particle_reward=220,
        unlock_stage="scale_up",
    ),
}

ITEMS = {
    "watermelon": ItemDefinition("watermelon", "西甜瓜", 220, "crop"),
    "vegetable": ItemDefinition("vegetable", "时令蔬菜", 110, "crop"),
    "strawberry": ItemDefinition("strawberry", "草莓", 360, "crop"),
    "rice": ItemDefinition("rice", "优质水稻", 260, "crop"),
    "egg": ItemDefinition("egg", "土鸡蛋", 65, "livestock"),
    "milk": ItemDefinition("milk", "鲜牛奶", 90, "livestock"),
    "jam": ItemDefinition("jam", "草莓果酱", 460, "processed"),
    "dried_fruit": ItemDefinition("dried_fruit", "瓜果果干", 320, "processed"),
    "gift_box": ItemDefinition("gift_box", "共富礼盒", 880, "processed"),
}

LIVESTOCKS = {
    "hens": LivestockDefinition(
        livestock_id="hens",
        name="散养土鸡",
        buy_cost=280,
        product_item_id="egg",
        cycle_days=2,
        product_amount=4,
        particle_reward=130,
        unlock_stage="startup",
    ),
    "cows": LivestockDefinition(
        livestock_id="cows",
        name="奶牛",
        buy_cost=900,
        product_item_id="milk",
        cycle_days=3,
        product_amount=3,
        particle_reward=260,
        unlock_stage="scale_up",
    ),
}

RECIPES = {
    "fruit_jam": RecipeDefinition(
        recipe_id="fruit_jam",
        name="草莓果酱",
        inputs={"strawberry": 2},
        output_item_id="jam",
        output_amount=1,
        processing_fee=120,
        unlock_stage="scale_up",
    ),
    "dried_fruit": RecipeDefinition(
        recipe_id="dried_fruit",
        name="瓜果果干",
        inputs={"watermelon": 2},
        output_item_id="dried_fruit",
        output_amount=1,
        processing_fee=100,
        unlock_stage="scale_up",
    ),
    "gift_box": RecipeDefinition(
        recipe_id="gift_box",
        name="共富礼盒",
        inputs={"egg": 2, "jam": 1, "dried_fruit": 1},
        output_item_id="gift_box",
        output_amount=1,
        processing_fee=180,
        unlock_stage="common_prosperity",
    ),
}

SKILLS = {
    "smart_irrigation": SkillDefinition(
        skill_id="smart_irrigation",
        name="智能灌溉",
        energy_cost=2,
        description="解锁 1 块新地并提升作物生长效率。",
        required_stage="startup",
    ),
    "live_boost": SkillDefinition(
        skill_id="live_boost",
        name="直播流量加持",
        energy_cost=3,
        description="直播带货收益提升 20%。",
        required_stage="startup",
    ),
    "automation_kit": SkillDefinition(
        skill_id="automation_kit",
        name="自动化控制组件",
        energy_cost=4,
        description="每日推进时让所有未成熟作物额外减少 1 天成熟时间。",
        required_stage="scale_up",
    ),
    "village_company": SkillDefinition(
        skill_id="village_company",
        name="村办公司筹备",
        energy_cost=6,
        description="解锁共同富裕阶段，扩大分红与就业规模。",
        required_stage="scale_up",
    ),
    "processing_workshop": SkillDefinition(
        skill_id="processing_workshop",
        name="农产品加工坊",
        energy_cost=5,
        description="开放初级加工配方，并提升品牌附加值。",
        required_stage="scale_up",
    ),
}

STAGE_REQUIREMENTS: dict[str, dict[str, int | str]] = {
    "scale_up": {"money": 5000, "harvest_count": 4, "favor_wang_nan": 8},
    "common_prosperity": {
        "money": 12000,
        "prosperity": 20,
        "employees": 3,
        "skill": "village_company",
    },
}

RANCH_EXPANSION_BASE_COST = 700
WORKSHOP_UPGRADE_BASE_COST = 1000
WORKSHOP_PROCESSING_FEE_REDUCTION = 0.08
WORKSHOP_OUTPUT_BONUS_RATE = 0.15
ORDER_DAILY_ROLL_INTERVAL = 2

ORDER_TEMPLATES = {
    "fresh_bundle": OrderDefinition(
        order_id="fresh_bundle",
        title="城郊生鲜店补货",
        required_items={"vegetable": 4, "egg": 2},
        reward_money=2200,
        reward_prosperity=2,
        reward_particles=300,
        unlock_stage="startup",
    ),
    "campus_milk": OrderDefinition(
        order_id="campus_milk",
        title="高校后勤奶制品采购",
        required_items={"milk": 4, "rice": 3},
        reward_money=4200,
        reward_prosperity=3,
        reward_particles=500,
        unlock_stage="scale_up",
    ),
    "ecom_combo": OrderDefinition(
        order_id="ecom_combo",
        title="电商平台乡村助农专场",
        required_items={"jam": 2, "dried_fruit": 2, "gift_box": 1},
        reward_money=7600,
        reward_prosperity=5,
        reward_particles=880,
        unlock_stage="common_prosperity",
    ),
}
