from __future__ import annotations

from dataclasses import dataclass

from farmgame.balance import PARTICLES_PER_ENERGY, SYSTEM_LEVELS


@dataclass(slots=True)
class AuditIssue:
    severity: str
    title: str
    detail: str
    recommendation: str


def run_design_audit() -> list[AuditIssue]:
    issues: list[AuditIssue] = []

    if SYSTEM_LEVELS[1]["daily_particles"] < SYSTEM_LEVELS[2]["daily_particles"]:
        issues.append(
            AuditIssue(
                severity="high",
                title="起始场景与源能场等级冲突",
                detail="设计文档主线一开场已回到刘家村并开始种田，但原始等级表将村庄高效率采集放在 Lv2，Lv1 仍绑定城市。",
                recommendation="实现层默认以 Lv2 作为回乡开局，避免新手期资源产出与剧情地点冲突。",
            )
        )

    if PARTICLES_PER_ENERGY >= 1000:
        issues.append(
            AuditIssue(
                severity="high",
                title="微粒到生命源能的兑换过慢",
                detail="若按 10000:1 且开局仅靠日收益 30 或 300 微粒，核心技能解锁会明显滞后于第一卷节奏。",
                recommendation="原型将兑换率下调为 1000:1，并保留任务直接奖励生命源能的路径。",
            )
        )

    issues.append(
        AuditIssue(
            severity="medium",
            title="长期叙事缺少时间压缩规则",
            detail="设计文档覆盖 20 年创业，但没有说明日循环、章节跳时和产业升级如何映射到具体回合。",
            recommendation="框架采用阶段制推进，先用条件触发代替逐年模拟。",
        )
    )
    issues.append(
        AuditIssue(
            severity="medium",
            title="共同富裕目标缺少量化指标",
            detail="文档强调带动全村富裕，但没有给出就业、分红、基础设施改善等数值门槛。",
            recommendation="原型增加 prosperity 指标，作为产业升级和终局判定的代理变量。",
        )
    )
    issues.append(
        AuditIssue(
            severity="low",
            title="自由输入与固定选项尚未统一",
            detail="文档支持大模型自由指令，但基础玩法主要以固定菜单描述。",
            recommendation="当前先实现稳定菜单流，后续可在 engine 层接入自然语言意图解析。",
        )
    )

    return issues


def validate_runtime_state(money: int, particles: int, source_energy: int, employees: int = 0) -> list[str]:
    problems: list[str] = []
    if money < 0:
        problems.append("资金不应为负数。")
    if particles < 0:
        problems.append("微粒不应为负数。")
    if source_energy < 0:
        problems.append("生命源能不应为负数。")
    if employees < 0:
        problems.append("雇佣人数不应为负数。")
    return problems
