from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any, cast
from urllib.error import URLError
from urllib.request import Request, urlopen


DEFAULT_CONFIG_PATH = Path("config") / "llm_api.json"

STYLE_TEMPLATE = (
    "风格样板（请模仿结构与语气，不要逐字照抄）：\n"
    "1) 开头先写场景气味与人物处境；\n"
    "2) 给出系统提示（如【叮！】、当前资源、目标）；\n"
    "3) 中段写行动经过与人物反馈；\n"
    "4) 结尾给出可执行的行动选择；\n"
    "5) 文字要有生活感，避免摘要口吻。\n"
    "示例语气关键词：重生归乡、村庄日常、泥土与青草味、系统激活、低压力但有后果。"
)


def test_llm_configuration() -> dict[str, Any]:
    config = _load_llm_config()
    endpoint = str(config.get("endpoint", "")).strip()
    api_key = str(config.get("api_key", "")).strip()
    if not endpoint:
        return {"ok": False, "message": "未配置 endpoint（请检查 llm_api.json）。"}
    if not api_key:
        return {"ok": False, "message": "未配置 API Key（请检查 llm_api.json）。"}

    timeout = _to_int(config.get("timeout_seconds", 10), 10)
    request_style = str(config.get("request_style", "legacy"))
    if request_style == "chat_completions":
        model = str(config.get("chat_model", config.get("model", "glm-5")))
        payload: dict[str, Any] = {
            "model": model,
            "messages": [
                {"role": "system", "content": "Return short connectivity response."},
                {"role": "user", "content": "reply with OK"},
            ],
            "temperature": 0,
        }
        parsed = _post_json(endpoint, api_key, payload, timeout)
        text = _extract_chat_text(parsed).strip()
        if parsed is None:
            return {"ok": False, "message": "接口请求失败（网络、地址或鉴权可能有误）。"}
        if text:
            return {
                "ok": True,
                "message": f"连通成功：{text[:80]}",
                "endpoint": endpoint,
                "model": model,
            }
        return {
            "ok": True,
            "message": "连通成功：接口可访问，但未提取到文本内容。",
            "endpoint": endpoint,
            "model": model,
        }

    parsed = _post_json(endpoint, api_key, {"ping": "ok"}, timeout)
    if parsed is None:
        return {"ok": False, "message": "接口请求失败（网络、地址或鉴权可能有误）。"}
    return {
        "ok": True,
        "message": "连通成功：已收到 JSON 响应。",
        "endpoint": endpoint,
        "model": str(config.get("model", "legacy")),
    }


def generate_dynamic_story(context: dict[str, Any], chapter_title: str, player_intent: str) -> str:
    config = _load_llm_config()
    if config["endpoint"]:
        remote = _call_remote_llm(config, context, chapter_title, player_intent)
        if remote:
            if "AI剧情草案" in remote:
                return remote
            return f"【AI剧情草案】{remote}"

    stage = context.get("stage", "未知阶段")
    money = context.get("money", 0)
    prosperity = context.get("prosperity", 0)
    return (
        f"【AI剧情草案】在{chapter_title}中，你选择了“{player_intent}”。"
        f"当前处于{stage}，资金约{money}，共富指数{prosperity}。"
        "系统判断这一步会强化主线推进，并触发后续任务节点。"
    )


def generate_open_gameplay_options(
    context: dict[str, Any],
    scene: str,
    player_goal: str,
    option_count: int = 3,
) -> list[str]:
    config = _load_llm_config()
    if config["endpoint"]:
        payload: dict[str, Any] = {
            "mode": "open_options",
            "instruction": (
                "你是乡村经营文字游戏的叙事引擎。"
                "请给出3个中文行动选项，每项都要包含具体动作+预期后果，"
                "语气贴近‘重生归乡/系统激活/村庄生活’叙事风格，不要英文字段。"
            ),
            "style_template": STYLE_TEMPLATE,
            "scene": scene,
            "goal": player_goal,
            "player": {
                "name": str(context.get("player_name", "刘洋")),
                "identity": str(context.get("player_identity", "回乡青年")),
                "return_reason": str(context.get("player_return_reason", "希望在乡村重建生活")),
            },
            "context": context,
            "option_count": 3,
        }
        parsed = _call_remote_llm_json(config, payload)
        if parsed:
            options = parsed.get("options")
            if isinstance(options, list):
                option_list = cast(list[Any], options)
                cleaned = [_sanitize_option_item(item) for item in option_list]
                cleaned = [item for item in cleaned if item]
                if len(cleaned) >= 3:
                    return cleaned[:3]

    turn = _to_int(context.get("turn", 1), 1)
    return _default_daily_options(turn)


def resolve_open_gameplay_action(
    context: dict[str, Any],
    scene: str,
    selected_action: str,
) -> dict[str, Any]:
    min_result_chars = 200
    config = _load_llm_config()
    if config["endpoint"]:
        payload: dict[str, Any] = {
            "mode": "open_resolve",
            "instruction": (
                "你是乡村经营文字游戏裁判。根据玩家行动输出结果与数值变化。"
                "文本必须有画面感与生活细节，风格参考‘回乡开篇叙事’，"
                "并体现角色关系、经营后果与次日可持续行动。"
            ),
            "style_template": STYLE_TEMPLATE,
            "scene": scene,
            "selected_action": selected_action,
            "player": {
                "name": str(context.get("player_name", "刘洋")),
                "identity": str(context.get("player_identity", "回乡青年")),
                "return_reason": str(context.get("player_return_reason", "希望在乡村重建生活")),
            },
            "context": context,
            "constraints": {
                "world": "现代乡村经营",
                "no_forced_romance": True,
                "avoid_illegal": True,
                "tone": "治愈、务实、有后果",
            },
            "output_requirements": {
                "text_length": "220-420中文字符",
                "must_include": [
                    "场景细节",
                    "行动过程",
                    "人物反馈",
                    "经营后果",
                ],
                "no_english_keys": True,
            },
        }
        parsed = _call_remote_llm_json(config, payload)
        if parsed:
            text = parsed.get("text") or parsed.get("output") or parsed.get("content")
            effects = parsed.get("effects", {})
            safe_effects = cast(dict[str, Any], effects) if isinstance(effects, dict) else {}
            normalized_effects = _normalized_effects(
                safe_effects,
                selected_action,
            )
            safe_text = _sanitize_result_text(str(text).strip()) if isinstance(text, str) else ""
            safe_text = _ensure_open_result_length(
                safe_text,
                min_result_chars,
                context,
                scene,
                selected_action,
                normalized_effects,
            )
            result: dict[str, Any] = {
                "text": safe_text,
                "effects": normalized_effects,
            }
            if result["text"]:
                return result

    fallback_effects = _derive_effects_from_action(selected_action)
    return {
        "text": _build_rich_result_text(context, scene, selected_action, fallback_effects),
        "effects": fallback_effects,
    }


def resolve_open_gameplay_action_fast(
    context: dict[str, Any],
    scene: str,
    selected_action: str,
) -> dict[str, Any]:
    """Fast local resolver used by simulator panel to keep per-command latency predictable."""
    safe_scene = scene.strip() or "刘家村村口"
    safe_action = selected_action.strip() or "先在村里散步并观察行情"
    effects = _derive_effects_from_action(safe_action)
    return {
        "text": _build_rich_result_text(context, safe_scene, safe_action, effects),
        "effects": effects,
    }


def _default_daily_options(turn: int) -> list[str]:
    if turn <= 1:
        return [
            "去村口小卖部和村民聊天，收集当天行情与闲置资源线索",
            "先完成一轮农田巡检和播种准备，确保明天能稳定收获",
            "联系王楠沟通短视频选题，试水一场低成本直播预热",
        ]
    if turn % 3 == 1:
        return [
            "优先处理生产：收获与播种衔接，保证现金流不断档",
            "优先处理关系：拜访家人和村干部，争取协同与政策支持",
            "优先处理销售：做一次集市或线上试卖，换取快速回款",
        ]
    if turn % 3 == 2:
        return [
            "把今天重点放在加工链路，尝试提升单位产出",
            "把今天重点放在订单履约，稳住信誉并积累品牌",
            "把今天重点放在人力协作，优化分工与执行节奏",
        ]
    return [
        "安排一次低风险公共投入，提升村民认可度和共富指数",
        "进行一次成本复盘，压缩不必要开支并回收现金",
        "尝试一次高收益动作，接受波动换取阶段性突破",
    ]


def _derive_effects_from_action(selected_action: str) -> dict[str, int]:
    text = selected_action.strip().lower()
    effects: dict[str, int]
    if any(k in text for k in ["直播", "带货", "销售", "集市", "电商"]):
        effects = {"money": 260, "particles": 90, "prosperity": 1, "laziness": -1}
    elif any(k in text for k in ["播种", "农田", "收获", "养殖", "加工"]):
        effects = {"money": 150, "particles": 160, "prosperity": 1, "laziness": -2}
    elif any(k in text for k in ["家人", "村民", "沟通", "拜访", "协同"]):
        effects = {"money": 80, "particles": 70, "prosperity": 3, "laziness": -1}
    elif any(k in text for k in ["复盘", "预算", "成本", "计划", "整理"]):
        effects = {"money": 120, "particles": 110, "prosperity": 2, "laziness": -1}
    elif any(k in text for k in ["扩张", "高收益", "冒险", "贷款", "投资"]):
        effects = {"money": 340, "particles": 40, "prosperity": -1, "laziness": -3}
    else:
        effects = {"money": 140, "particles": 100, "prosperity": 1, "laziness": -1}
    return effects


def _normalized_effects(raw_effects: dict[str, Any], selected_action: str) -> dict[str, int]:
    base = _derive_effects_from_action(selected_action)
    for key in ["money", "particles", "prosperity", "laziness"]:
        if key in raw_effects:
            base[key] = _to_int(raw_effects.get(key), base[key])
    return base


def _build_rich_result_text(
    context: dict[str, Any],
    scene: str,
    selected_action: str,
    effects: dict[str, int],
) -> str:
    name = str(context.get("player_name", "你"))
    money = effects.get("money", 0)
    particles = effects.get("particles", 0)
    prosperity = effects.get("prosperity", 0)
    laziness = effects.get("laziness", 0)
    return (
        f"{name}在“{scene}”执行了“{selected_action}”。白天你先和关键人物对齐了行动节奏，"
        "再把执行拆成可落地的两步，避免了无效忙碌。"
        "傍晚复盘时，村里对你的信任明显提高，后续合作也更顺畅。"
        f"本次行动即时结算：资金 {money:+d}，微粒 {particles:+d}，共富 {prosperity:+d}，躺平值 {laziness:+d}。"
    )


def _ensure_open_result_length(
    text: str,
    min_chars: int,
    context: dict[str, Any],
    scene: str,
    selected_action: str,
    effects: dict[str, int],
) -> str:
    safe_text = (text or "").strip()
    if len(safe_text) >= min_chars:
        return safe_text

    fallback = _build_rich_result_text(context, scene, selected_action, effects)
    if not safe_text:
        return fallback

    # Keep model output as the lead sentence, then append grounded consequences.
    extended = (
        f"{safe_text}"
        "\n\n"
        f"补充说明：你在“{scene}”推进“{selected_action}”后，"
        "现场反馈显示协作效率和执行确定性都在上升，"
        "短期现金流与中期口碑同时受影响。"
        f"本次结算：资金 {effects.get('money', 0):+d}，"
        f"微粒 {effects.get('particles', 0):+d}，"
        f"共富 {effects.get('prosperity', 0):+d}，"
        f"躺平值 {effects.get('laziness', 0):+d}。"
    )
    if len(extended) >= min_chars:
        return extended

    return f"{extended}\n\n{fallback}"


def _localize_display_text(text: str) -> str:
    if not text:
        return text
    localized = text
    replacements: list[tuple[str, str]] = [
        (r"\bmoney\b", "资金"),
        (r"\bparticles\b", "微粒"),
        (r"\bprosperity\b", "共富"),
        (r"\blaziness\b", "躺平值"),
        (r"\bsource_energy\b", "源能"),
        (r"\benergy\b", "源能"),
        (r"\beffects?\b", "效果"),
        (r"\breward\b", "收益"),
        (r"\bcost\b", "成本"),
        (r"\brisk\b", "风险"),
        (r"\boption\b", "选项"),
        (r"\baction\b", "行动"),
    ]
    for pattern, repl in replacements:
        localized = re.sub(pattern, repl, localized, flags=re.IGNORECASE)
    return localized


def _sanitize_option_text(text: str) -> str:
    localized = _localize_display_text(text)
    if not _contains_english_token(localized):
        return localized
    cleaned = re.sub(r"[A-Za-z_][A-Za-z0-9_\-:.]*", "", localized)
    cleaned = re.sub(r"\s+", "", cleaned)
    cleaned = cleaned.strip("，。；：|/- ")
    if len(cleaned) >= 8:
        return cleaned
    return "围绕当日经营目标执行一项稳健行动，兼顾现金流与关系协同"


def _sanitize_option_item(item: Any) -> str:
    # Some models return malformed objects like {'':'','':'xxx'}; extract usable text robustly.
    if isinstance(item, dict):
        raw_map = cast(dict[object, object], item)
        # 1) Prefer explicit textual fields.
        key_aliases = {
            "text",
            "option",
            "action",
            "title",
            "description",
            "content",
            "建议",
            "行动",
            "文本",
            "文案",
        }
        for k, v in raw_map.items():
            key_name = str(k).strip().lower()
            if key_name in key_aliases:
                candidate = _coerce_option_candidate(v)
                if candidate:
                    return _sanitize_option_text(candidate)

        # 2) Then pick best string candidate from values.
        candidates = [_coerce_option_candidate(v) for v in raw_map.values()]
        candidates = [c for c in candidates if c]
        readable = [c for c in candidates if _looks_like_readable_option(c)]
        if readable:
            return _sanitize_option_text(max(readable, key=len))
        if candidates:
            return _sanitize_option_text(max(candidates, key=len))

        # 3) As a final fallback, try keys.
        keys = [str(k).strip() for k in raw_map.keys() if str(k).strip()]
        readable_keys = [k for k in keys if _looks_like_readable_option(k)]
        if readable_keys:
            return _sanitize_option_text(max(readable_keys, key=len))
        return "围绕当日经营目标执行一项稳健行动，兼顾现金流与关系协同"
    raw = str(item).strip()
    if not raw:
        return ""
    parsed = _extract_json_from_text(raw)
    if isinstance(parsed, dict):
        return _sanitize_option_item(parsed)
    return _sanitize_option_text(raw)


def _coerce_option_candidate(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float, bool)):
        return ""
    if isinstance(value, dict) or isinstance(value, list):
        dumped = json.dumps(value, ensure_ascii=False)
        return dumped.strip()
    return str(value).strip()


def _looks_like_readable_option(text: str) -> bool:
    if not text:
        return False
    if re.fullmatch(r"[\d\s+\-*/.,:;{}\[\]()]+", text):
        return False
    # Prefer options containing Chinese text and enough semantic length.
    chinese_chars = re.findall(r"[\u4e00-\u9fff]", text)
    if len(chinese_chars) >= 4:
        return True
    return len(text) >= 10 and not _contains_english_token(text)


def _sanitize_result_text(text: str) -> str:
    localized = _localize_display_text(text)
    if not _contains_english_token(localized):
        return localized
    cleaned = re.sub(r"[A-Za-z_][A-Za-z0-9_\-:.]*", "", localized)
    cleaned = re.sub(r"\s+", "", cleaned)
    cleaned = cleaned.strip()
    if len(cleaned) >= 24:
        return cleaned
    return "你完成了本轮行动，过程以务实推进为主，村民协作意愿上升，经营状态同步更新。"


def _contains_english_token(text: str) -> bool:
    return bool(re.search(r"[A-Za-z]{2,}", text))


def _call_remote_llm(
    config: dict[str, Any],
    context: dict[str, Any],
    chapter_title: str,
    player_intent: str,
) -> str | None:
    endpoint = str(config.get("endpoint", ""))
    api_key = str(config.get("api_key", ""))
    timeout = _to_int(config.get("timeout_seconds", 10), 10)
    request_style = str(config.get("request_style", "legacy"))
    if request_style == "chat_completions":
        model = str(config.get("model", "glm-5"))
        payload = {
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "你是乡村经营文字游戏叙事引擎，请输出高质量中文剧情文本。"
                        "文风参考：重生归乡、村庄气息、系统提示、生活细节与经营后果并重。"
                        "不要输出英文键名，不要只写摘要。\n"
                        f"{STYLE_TEMPLATE}"
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "chapter": chapter_title,
                            "intent": player_intent,
                            "player": {
                                "name": str(context.get("player_name", "刘洋")),
                                "identity": str(context.get("player_identity", "回乡青年")),
                                "return_reason": str(context.get("player_return_reason", "希望在乡村重建生活")),
                            },
                            "context": context,
                            "requirements": (
                                "输出 260-520 字中文剧情；"
                                "开头有场景氛围，中段有行动与互动，结尾给出状态变化提示；"
                                "语言自然，贴近‘躺平农场主’开篇示例风格。"
                            ),
                            "style_template": STYLE_TEMPLATE,
                        },
                        ensure_ascii=False,
                    ),
                },
            ],
            "temperature": 0.7,
        }
        parsed = _post_json(endpoint, api_key, payload, timeout)
        text = _extract_chat_text(parsed).strip()
        return text if text else None

    payload: dict[str, Any] = {
        "instruction": (
            "请基于经营状态生成 260-520 字中文剧情。"
            "要包含：场景氛围、行动经过、人物反馈、经营后果、次日可选动作引导。"
        ),
        "chapter": chapter_title,
        "intent": player_intent,
        "style_template": STYLE_TEMPLATE,
        "player": {
            "name": str(context.get("player_name", "刘洋")),
            "identity": str(context.get("player_identity", "回乡青年")),
            "return_reason": str(context.get("player_return_reason", "希望在乡村重建生活")),
        },
        "context": context,
    }
    parsed = _post_json(endpoint, api_key, payload, timeout)
    if not parsed:
        return None
    text = parsed.get("text") or parsed.get("output") or parsed.get("content")
    if isinstance(text, str) and text.strip():
        return text.strip()
    return None


def _call_remote_llm_json(config: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any] | None:
    endpoint = str(config.get("endpoint", ""))
    api_key = str(config.get("api_key", ""))
    timeout = _to_int(config.get("timeout_seconds", 10), 10)
    request_style = str(config.get("request_style", "legacy"))

    if request_style == "chat_completions":
        model = str(config.get("chat_model", config.get("model", "glm-5")))
        chat_payload: dict[str, Any] = {
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": "你是乡村经营游戏引擎。请严格返回 JSON，不要返回额外解释。",
                },
                {
                    "role": "user",
                    "content": json.dumps(payload, ensure_ascii=False),
                },
            ],
            "temperature": 0.7,
        }
        parsed = _post_json(endpoint, api_key, chat_payload, timeout)
        text = _extract_chat_text(parsed)
        json_obj = _extract_json_from_text(text)
        return json_obj if json_obj else None

    parsed = _post_json(endpoint, api_key, payload, timeout)
    if isinstance(parsed, dict):
        return parsed
    return None


def _load_llm_config() -> dict[str, Any]:
    config_path = Path(os.getenv("ALLRICHAI_LLM_CONFIG", str(DEFAULT_CONFIG_PATH))).expanduser()
    file_config = _read_config_file(config_path)

    endpoint = str(file_config.get("endpoint", "")).strip()
    api_key = str(file_config.get("api_key", file_config.get("LLM_API_KEY", ""))).strip()
    timeout = _to_int(file_config.get("timeout_seconds", 10), 10)
    api_base = str(file_config.get("api_base", file_config.get("LLM_API_BASE", ""))).strip()
    model = str(file_config.get("model", file_config.get("LLM_MODEL", "glm-5"))).strip() or "glm-5"
    chat_model = (
        str(file_config.get("chat_model", file_config.get("LLM_CHAT_MODEL", model))).strip() or model
    )
    port = _to_int(file_config.get("PORT", 5000), 5000)

    if not endpoint and api_base:
        endpoint = f"{api_base.rstrip('/')}/chat/completions"

    # Environment variables can override file config when needed.
    endpoint = os.getenv("ALLRICHAI_LLM_ENDPOINT", endpoint).strip()
    api_key = os.getenv("ALLRICHAI_LLM_API_KEY", api_key).strip()
    timeout = _to_int(os.getenv("ALLRICHAI_LLM_TIMEOUT", str(timeout)), timeout)
    if os.getenv("LLM_API_BASE", "").strip() and not os.getenv("ALLRICHAI_LLM_ENDPOINT", "").strip():
        endpoint = f"{os.getenv('LLM_API_BASE', '').strip().rstrip('/')}/chat/completions"
    model = os.getenv("LLM_MODEL", model).strip() or model
    chat_model = os.getenv("LLM_CHAT_MODEL", chat_model).strip() or chat_model

    request_style = "chat_completions" if endpoint.endswith("/chat/completions") else "legacy"

    return {
        "endpoint": endpoint,
        "api_key": api_key,
        "timeout_seconds": max(3, min(timeout, 60)),
        "model": model,
        "chat_model": chat_model,
        "port": port,
        "request_style": request_style,
    }


def _read_config_file(config_path: Path) -> dict[str, Any]:
    if not config_path.exists():
        return {}
    try:
        raw = config_path.read_text(encoding="utf-8")
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return cast(dict[str, Any], parsed)
    except (OSError, ValueError, json.JSONDecodeError):
        return {}
    return {}


def _post_json(endpoint: str, api_key: str, payload: dict[str, Any], timeout: int) -> dict[str, Any] | None:
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    request = Request(endpoint, data=json.dumps(payload, ensure_ascii=False).encode("utf-8"), headers=headers, method="POST")
    try:
        with urlopen(request, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                return cast(dict[str, Any], parsed)
    except (OSError, URLError, TimeoutError, ValueError, json.JSONDecodeError):
        return None
    return None


def _extract_chat_text(parsed: dict[str, Any] | None) -> str:
    if not isinstance(parsed, dict):
        return ""
    choices = parsed.get("choices", [])
    if isinstance(choices, list) and choices:
        choice_items = cast(list[Any], choices)
        first = choice_items[0]
        if isinstance(first, dict):
            message = cast(dict[str, Any], first).get("message", {})
            if isinstance(message, dict):
                content = cast(dict[str, Any], message).get("content", "")
                if isinstance(content, str):
                    return content
    text = parsed.get("text") or parsed.get("output") or parsed.get("content")
    return text if isinstance(text, str) else ""


def _extract_json_from_text(text: str) -> dict[str, Any] | None:
    if not text:
        return None
    raw = text.strip()
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return cast(dict[str, Any], parsed)
    except (ValueError, json.JSONDecodeError):
        pass

    start = raw.find("{")
    end = raw.rfind("}")
    if start >= 0 and end > start:
        candidate = raw[start : end + 1]
        try:
            parsed = json.loads(candidate)
            if isinstance(parsed, dict):
                return cast(dict[str, Any], parsed)
        except (ValueError, json.JSONDecodeError):
            return None
    return None


def _to_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default
