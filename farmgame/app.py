from __future__ import annotations

import argparse
from typing import cast

from farmgame.balance import CROPS, LIVESTOCKS, RECIPES, SKILLS
from farmgame.content import CHARACTERS
from farmgame.engine import GameEngine
from farmgame.storage import load_game, save_game
from farmgame.validators import run_design_audit


def main() -> None:
    parser = argparse.ArgumentParser(description="《躺平农场主：共同富裕计划》文字经营原型")
    parser.add_argument("--audit", action="store_true", help="输出设计逻辑审计结果")
    parser.add_argument("--new", action="store_true", help="忽略存档并开始新游戏")
    args = parser.parse_args()

    if args.audit:
        print_audit()
        return

    state = None if args.new else load_game()
    engine = GameEngine(state)
    run_cli(engine)


def print_audit() -> None:
    print("设计逻辑审计")
    print("=" * 36)
    for issue in run_design_audit():
        print(f"[{issue.severity.upper()}] {issue.title}")
        print(f"- 现象: {issue.detail}")
        print(f"- 处理: {issue.recommendation}")
        print()


def run_cli(engine: GameEngine) -> None:
    print("《躺平农场主：共同富裕计划》文字经营原型")
    print("输入数字执行操作，输入 0 保存并退出。")
    print()
    while True:
        print_status(engine)
        print("可选操作")
        print("1. 查看农场")
        print("2. 播种")
        print("3. 收获")
        print("4. 开始养殖")
        print("5. 收取养殖产物")
        print("6. 农产品加工")
        print("7. 销售到集市")
        print("8. 直播带货")
        print("9. 人物互动")
        print("10. 解锁系统技能")
        print("11. 村办公司")
        print("12. 查看任务")
        print("13. 推进一天")
        print("0. 保存并退出")
        choice = input("请选择: ").strip()

        if choice == "1":
            print_list("农场状态", engine.plot_report())
            print_list("养殖棚舍", engine.pen_report())
            print_list("仓库", engine.inventory_report())
        elif choice == "2":
            do_plant(engine)
        elif choice == "3":
            print(engine.harvest_all())
        elif choice == "4":
            do_raise_livestock(engine)
        elif choice == "5":
            print(engine.collect_livestock_products())
        elif choice == "6":
            do_process_goods(engine)
        elif choice == "7":
            print(engine.sell_inventory("market"))
        elif choice == "8":
            print(engine.sell_inventory("stream"))
        elif choice == "9":
            do_interact(engine)
        elif choice == "10":
            do_unlock(engine)
        elif choice == "11":
            do_company(engine)
        elif choice == "12":
            print_list("任务进度", engine.task_report())
        elif choice == "13":
            print(engine.advance_day())
            print(engine.ending_summary())
        elif choice == "0":
            path = save_game(engine.state)
            print(f"游戏已保存到 {path}")
            break
        else:
            print("无效输入，请重新选择。")

        print_list("最近事件", engine.state.log[-5:])
        print()


def print_status(engine: GameEngine) -> None:
    snapshot = engine.status_snapshot()
    print("=" * 36)
    print(f"第 {snapshot['turn']} 天 | 阶段: {snapshot['stage']}")
    print(
        f"资金 {snapshot['money']} | 微粒 {snapshot['particles']} | "
        f"生命源能 {snapshot['source_energy']} | 共富指数 {snapshot['prosperity']}"
    )
    skills = cast(list[str], snapshot["skills"] or ["无"])
    print(
        f"系统日收益 {snapshot['daily_particles']} 微粒 | 雇员 {snapshot['employees']} | "
        f"品牌 {snapshot['brand_level']} | 技能: {', '.join(skills)}"
    )


def print_list(title: str, rows: list[str]) -> None:
    print(title)
    for row in rows:
        print(f"- {row}")


def do_plant(engine: GameEngine) -> None:
    print_list("农田", engine.plot_report())
    print("可选作物")
    for crop_id, name in engine.available_crops().items():
        crop = CROPS[crop_id]
        print(f"- {crop_id}: {name}，种子 {crop.seed_cost}，成熟 {crop.grow_days} 天")
    try:
        plot_id = int(input("输入地块编号: ").strip())
    except ValueError:
        print("地块编号必须为数字。")
        return
    crop_id = input("输入作物编号: ").strip()
    print(engine.plant_crop(plot_id, crop_id))


def do_interact(engine: GameEngine) -> None:
    print_list("角色状态", engine.character_report())
    print("可互动角色")
    for character_id, definition in CHARACTERS.items():
        print(f"- {character_id}: {definition.name} / {definition.role}")
    character_id = input("输入角色编号: ").strip()
    print(engine.interact(character_id))


def do_raise_livestock(engine: GameEngine) -> None:
    print_list("棚舍", engine.pen_report())
    print("可选养殖品种")
    for livestock_id, name in engine.available_livestock().items():
        livestock = LIVESTOCKS[livestock_id]
        print(f"- {livestock_id}: {name}，购入 {livestock.buy_cost}，产出周期 {livestock.cycle_days} 天")
    try:
        pen_id = int(input("输入棚舍编号: ").strip())
    except ValueError:
        print("棚舍编号必须为数字。")
        return
    livestock_id = input("输入养殖编号: ").strip()
    print(engine.raise_livestock(pen_id, livestock_id))


def do_process_goods(engine: GameEngine) -> None:
    recipes = engine.available_recipes()
    if not recipes:
        print("当前没有可用的加工配方，请先解锁加工坊。")
        return
    print_list("当前库存", engine.inventory_report())
    print("可选加工配方")
    for recipe_id, name in recipes.items():
        recipe = RECIPES[recipe_id]
        print(f"- {recipe_id}: {name}，加工费 {recipe.processing_fee}，产出 {recipe.output_amount}")
    recipe_id = input("输入配方编号: ").strip()
    try:
        batches = int(input("输入加工批次: ").strip())
    except ValueError:
        print("加工批次必须为数字。")
        return
    print(engine.process_goods(recipe_id, batches))


def do_company(engine: GameEngine) -> None:
    print_list("公司状态", engine.company_report())
    print("1. 成立村办公司")
    print("2. 雇佣村民")
    print("3. 发起分红")
    choice = input("请选择公司操作: ").strip()
    if choice == "1":
        print(engine.prepare_company())
    elif choice == "2":
        try:
            count = int(input("输入雇佣人数: ").strip())
        except ValueError:
            print("雇佣人数必须为数字。")
            return
        print(engine.hire_villagers(count))
    elif choice == "3":
        print(engine.distribute_dividends())
    else:
        print("无效的公司操作。")


def do_unlock(engine: GameEngine) -> None:
    print("系统技能")
    for skill_id, skill in SKILLS.items():
        print(
            f"- {skill_id}: {skill.name}，消耗 {skill.energy_cost} 点生命源能，"
            f"阶段要求 {skill.required_stage}"
        )
    skill_id = input("输入技能编号: ").strip()
    print(engine.unlock_skill(skill_id))
