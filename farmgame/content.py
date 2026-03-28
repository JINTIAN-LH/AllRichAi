from __future__ import annotations

from farmgame.models import CharacterDefinition, TaskDefinition

CHARACTERS = {
    "liu_huaizhi": CharacterDefinition(
        character_id="liu_huaizhi",
        name="刘怀志",
        role="父亲",
        description="前基层公务员，熟悉本地资源和乡村治理。",
        favor_gain=4,
        prosperity_gain=1,
        money_gain=200,
        particle_gain=120,
    ),
    "liu_xiaoxue": CharacterDefinition(
        character_id="liu_xiaoxue",
        name="刘晓雪",
        role="姐姐",
        description="失聪人士，牵引家庭和科技助农支线。",
        favor_gain=5,
        prosperity_gain=2,
        money_gain=0,
        particle_gain=150,
    ),
    "yang_dazhen": CharacterDefinition(
        character_id="yang_dazhen",
        name="杨大振",
        role="农学专家",
        description="解决育种与科研合作问题。",
        favor_gain=4,
        prosperity_gain=1,
        money_gain=0,
        particle_gain=220,
    ),
    "wang_nan": CharacterDefinition(
        character_id="wang_nan",
        name="王楠",
        role="电商伙伴",
        description="负责直播带货与品牌运营。",
        favor_gain=4,
        prosperity_gain=2,
        money_gain=150,
        particle_gain=180,
    ),
    "zhao_jiangxin": CharacterDefinition(
        character_id="zhao_jiangxin",
        name="赵江新",
        role="高校讲师",
        description="提供自动化方案和高校资源。",
        favor_gain=3,
        prosperity_gain=1,
        money_gain=0,
        particle_gain=160,
    ),
}

TASKS = {
    "main_first_harvest": TaskDefinition(
        task_id="main_first_harvest",
        title="完成首次收获",
        category="主线",
        description="累计收获 2 次作物，证明农场循环能正常运转。",
        target_type="stat",
        target_key="harvest_count",
        target_value=2,
        rewards={"money": 800, "particles": 600},
    ),
    "main_first_stream": TaskDefinition(
        task_id="main_first_stream",
        title="完成首次直播带货",
        category="主线",
        description="完成 1 次直播，打通销售渠道。",
        target_type="stat",
        target_key="stream_count",
        target_value=1,
        rewards={"money": 1000, "favor": {"wang_nan": 6}},
        depends_on=["main_first_harvest"],
    ),
    "main_meet_mentor": TaskDefinition(
        task_id="main_meet_mentor",
        title="建立导师联系",
        category="主线",
        description="与杨大振互动 2 次，启动科研支线。",
        target_type="interaction",
        target_key="yang_dazhen",
        target_value=2,
        rewards={"source_energy": 1, "particles": 400},
    ),
    "side_support_sister": TaskDefinition(
        task_id="side_support_sister",
        title="姐姐的回乡计划",
        category="支线",
        description="将刘晓雪好感提升到 10，推进家庭修复。",
        target_type="favor",
        target_key="liu_xiaoxue",
        target_value=10,
        rewards={"source_energy": 1, "prosperity": 3},
    ),
    "side_partner_father": TaskDefinition(
        task_id="side_partner_father",
        title="父子联手经营",
        category="支线",
        description="将刘怀志好感提升到 10，获得经营支持。",
        target_type="favor",
        target_key="liu_huaizhi",
        target_value=10,
        rewards={"money": 600, "particles": 300},
    ),
    "daily_plant": TaskDefinition(
        task_id="daily_plant",
        title="日常：播种 1 次",
        category="日常",
        description="本回合完成 1 次播种。",
        target_type="turn_stat",
        target_key="current_turn_planted",
        target_value=1,
        rewards={"particles": 120},
    ),
    "daily_chat": TaskDefinition(
        task_id="daily_chat",
        title="日常：互动 1 次",
        category="日常",
        description="本回合与任意角色互动 1 次。",
        target_type="turn_stat",
        target_key="current_turn_interactions",
        target_value=1,
        rewards={"particles": 120},
    ),
    "daily_stream": TaskDefinition(
        task_id="daily_stream",
        title="日常：直播 1 次",
        category="日常",
        description="本回合完成 1 次直播。",
        target_type="turn_stat",
        target_key="current_turn_streamed",
        target_value=1,
        rewards={"particles": 180},
    ),
    "achievement_harvest_master": TaskDefinition(
        task_id="achievement_harvest_master",
        title="成就：丰收起步",
        category="成就",
        description="累计收获 6 次作物。",
        target_type="stat",
        target_key="harvest_count",
        target_value=6,
        rewards={"source_energy": 2, "prosperity": 2},
    ),
    "main_processing": TaskDefinition(
        task_id="main_processing",
        title="建立初级加工能力",
        category="主线",
        description="完成 2 批农产品加工，形成附加值闭环。",
        target_type="stat",
        target_key="processed_batches",
        target_value=2,
        rewards={"money": 1200, "prosperity": 2},
        depends_on=["main_first_stream"],
    ),
    "main_hiring": TaskDefinition(
        task_id="main_hiring",
        title="招募首批村民",
        category="主线",
        description="雇佣 3 名村民，验证村办公司雏形。",
        target_type="stat",
        target_key="villagers_hired",
        target_value=3,
        rewards={"source_energy": 2, "prosperity": 3},
        depends_on=["main_processing"],
    ),
    "achievement_dividend": TaskDefinition(
        task_id="achievement_dividend",
        title="成就：首次分红",
        category="成就",
        description="完成 1 次村民分红。",
        target_type="stat",
        target_key="dividend_rounds",
        target_value=1,
        rewards={"source_energy": 2, "prosperity": 4},
    ),
}

INTRO_LINES = [
    "考研三战失利后，刘洋回到了刘家村。",
    "躺平智辅系统在强烈的回乡意愿下激活。",
    "你要在个人躺平和带动全村增收之间找到平衡。",
]

ENDING_TEXT = {
    "startup": "你完成了从城市退场到乡村站稳脚跟的过渡。",
    "scale_up": "你已经形成产业雏形，直播与科研开始协同。",
    "common_prosperity": "村办公司和分红体系建立，共同富裕路线成型。",
}

STORY_CHAPTERS: dict[str, dict[str, object]] = {
    "v1c1": {
        "volume": 1,
        "title": "重生归乡",
        "unlock_stage": "startup",
        "avg_segments": [
            "【平行世界·麓湖市·刘家村】考研三战失败、心力交瘁的我，再次睁开眼时——回到了刚毕业的夏天。",
            "前世我拼命内卷、考研、求职，最后把自己逼到崩溃。",
            "我只想回家，种田，躺平，安安静静过日子。",
        ],
        "choices": {
            "farm_first": "先去地里播种，跑通第一轮循环",
            "family_first": "先和家人沟通，稳定后方",
        },
    },
    "v1c2": {
        "volume": 1,
        "title": "系统激活",
        "unlock_stage": "startup",
        "avg_segments": [
            "【检测到强烈躺平心理……】",
            "【躺平智辅系统，启动成功。】",
            "【生命源能场：当前等级 Lv1（城市）】",
        ],
        "choices": {
            "mentor": "联系杨大振教授，启动科研线",
            "stream": "联动王楠准备首次直播",
        },
    },
    "v1c3": {
        "volume": 1,
        "title": "首次直播",
        "unlock_stage": "startup",
        "avg_segments": [
            "开通账号，直播农场日常，积累首批粉丝，获得第一桶金。",
            "系统提示：可返回房间，开启第一次种田规划。",
        ],
        "choices": {
            "stream_now": "直接开播带货",
            "harvest_then_stream": "先收获再开播",
        },
    },
    "v1c4": {
        "volume": 1,
        "title": "家庭协作",
        "unlock_stage": "startup",
        "avg_segments": [
            "回来就好。我已经辞了基层的工作，准备在家搞农场。",
            "姐，等我稳定了，一定接你回家。",
            "这一世，我终于可以为自己而活了。",
        ],
        "choices": {
            "father_coop": "父子联手经营",
            "sister_plan": "推进姐姐回乡计划",
        },
    },
    "v2c1": {
        "volume": 2,
        "title": "加工线起步",
        "unlock_stage": "scale_up",
        "avg_segments": [
            "产业链升级：搭建农产品加工、品牌、销售一体化体系。",
            "从农产品种植到初级加工（果干、果酱）再到品牌包装。",
        ],
        "choices": {
            "upgrade_workshop": "优先升级加工坊",
            "produce_batch": "先做一批加工品",
        },
    },
    "v2c2": {
        "volume": 2,
        "title": "养殖扩栏",
        "unlock_stage": "scale_up",
        "avg_segments": [
            "公司运营：招募村民，制定分红规则，解决村民就业问题。",
            "资源整合：对接高校、电商平台、政府资源。",
        ],
        "choices": {
            "expand": "扩大养殖容量",
            "hire": "先扩充团队",
        },
    },
    "v2c3": {
        "volume": 2,
        "title": "公司化运营",
        "unlock_stage": "scale_up",
        "avg_segments": [
            "成立村办公司，招募村民就业，制定分红机制。",
            "帮助村里困难家庭，改善基础设施，获得政府认可。",
        ],
        "choices": {
            "prepare_company": "成立公司并试运行",
            "dividend": "先做一轮分红稳定预期",
        },
    },
    "v2c4": {
        "volume": 2,
        "title": "订单履约",
        "unlock_stage": "scale_up",
        "avg_segments": [
            "从品牌包装到销售渠道，逐步完善产业链。",
            "资源整合后，区域订单开始稳定流入。",
        ],
        "choices": {
            "deliver_order": "优先履约订单",
            "stream_brand": "先做品牌直播再履约",
        },
    },
    "v3c1": {
        "volume": 3,
        "title": "区域订单",
        "unlock_stage": "common_prosperity",
        "avg_segments": [
            "推广刘家村经验，带动周边乡村发展。",
            "形成区域农业产业集群，推进共同富裕。",
        ],
        "choices": {
            "deliver_order": "交付区域订单",
            "advance": "先推进一天观察结算",
        },
    },
    "v3c2": {
        "volume": 3,
        "title": "乡村振兴",
        "unlock_stage": "common_prosperity",
        "avg_segments": [
            "建设高标准农田、现代化工厂、新农人培训基地。",
            "提升农村整体发展水平，实现城乡差距消弭。",
        ],
        "choices": {
            "public_project": "投入基础设施和培训",
            "research": "深化科研与技术协同",
        },
    },
    "v3c3": {
        "volume": 3,
        "title": "终局：共同富裕",
        "unlock_stage": "common_prosperity",
        "avg_segments": [
            "解锁“共同富裕”终极结局，解锁全图鉴、全成就。",
            "生成游戏专属结局剧情。",
        ],
        "choices": {
            "ending": "进入终局结算",
            "continue": "继续经营后再结算",
        },
    },
    "v3c4": {
        "volume": 3,
        "title": "示范复制",
        "unlock_stage": "common_prosperity",
        "avg_segments": [
            "推广刘家村经验，带动周边乡村发展。",
            "形成区域农业产业集群，达成共同富裕路线闭环。",
        ],
        "choices": {
            "replicate": "输出示范模式",
            "invest_public": "追加公共投入",
        },
    },
}
