# AVG 文本逐句映射表（章节-段落-事件-状态变更）

说明：本表将当前 AVG 核心段落映射到 Web/Ren'Py 共享的 `trigger_chapter_event` 事件。状态变更以引擎关键字段为准。

| 章节ID | 原文段落 | 事件ID | 触发动作 | 关键状态变更 |
|---|---|---|---|---|
| v1c1 | 考研三战失败、心力交瘁的我，再次睁开眼时——回到了刚毕业的夏天。 | farm_first | 播种-推进-收获 | `harvest_count +1`，库存增加，微粒增加 |
| v1c1 | 我只想回家，种田，躺平，安安静静过日子。 | family_first | 互动父亲 | `liu_huaizhi.favor +`，`prosperity +` |
| v1c2 | 【躺平智辅系统，启动成功。】 | mentor | 互动杨大振 | `interaction_count +1`，导师线任务推进 |
| v1c2 | 【生命源能场：当前等级 Lv1（城市）】 | stream | 互动王楠 | `wang_nan.favor +`，直播线前置推进 |
| v1c3 | 开通账号，直播农场日常，积累首批粉丝，获得第一桶金。 | stream_now | 直播销售 | `stream_count +1`，资金增长 |
| v1c3 | 系统提示：可返回房间，开启第一次种田规划。 | harvest_then_stream | 先收获再直播 | 库存清空后换现金，微粒折算源能 |
| v1c4 | 回来就好。我已经辞了基层的工作，准备在家搞农场。 | father_coop | 父亲协作线 | 家庭协作推进，父亲好感提升 |
| v1c4 | 姐，等我稳定了，一定接你回家。 | sister_plan | 姐姐回乡线 | 姐姐好感提升，支线推进 |
| v2c1 | 从农产品种植到初级加工（果干、果酱）再到品牌包装。 | produce_batch | 执行加工 | `processed_batches +`，品牌等级可能提升 |
| v2c1 | 产业链升级：搭建农产品加工、品牌、销售一体化体系。 | upgrade_workshop | 升级加工坊 | `workshop_level +1`，加工效率提升 |
| v2c2 | 公司运营：招募村民，制定分红规则，解决村民就业问题。 | hire | 雇佣村民 | `employees +`，`villagers_hired +` |
| v2c2 | 资源整合：对接高校、电商平台、政府资源。 | expand | 养殖扩栏 | `ranch_capacity +`，棚舍数量增加 |
| v2c3 | 成立村办公司，招募村民就业，制定分红机制。 | prepare_company | 成立公司 | `company.unlocked=True`，开启治理系统 |
| v2c3 | 帮助村里困难家庭，改善基础设施，获得政府认可。 | dividend | 发起分红 | `dividend_rounds +`，士气和共富指数提升 |
| v2c4 | 从品牌包装到销售渠道，逐步完善产业链。 | stream_brand | 品牌直播+履约 | 直播收益后订单交付，利润池增长 |
| v2c4 | 区域订单开始稳定流入。 | deliver_order | 交付订单 | `orders_completed +`，资金与微粒奖励 |
| v3c1 | 推广刘家村经验，带动周边乡村发展。 | deliver_order | 区域订单交付 | 区域影响力路径推进 |
| v3c1 | 形成区域农业产业集群，推进共同富裕。 | advance | 日结算推进 | 阶段资源自然增长 |
| v3c2 | 建设高标准农田、现代化工厂、新农人培训基地。 | public_project | 公共项目投入 | 资金减少，共富指数增加 |
| v3c2 | 提升农村整体发展水平，实现城乡差距消弭。 | research | 科研协同 | 导师/讲师互动推进，技术线增强 |
| v3c3 | 解锁“共同富裕”终极结局。 | ending | 终局结算 | 输出终局文案 |
| v3c3 | 继续经营后再结算。 | continue | 推进一天 | 维持沙盒可继续游玩 |
| v3c4 | 推广刘家村经验，带动周边乡村发展。 | replicate | 示范复制 | 资金与共富指数显著提升 |
| v3c4 | 形成区域农业产业集群，达成共同富裕路线闭环。 | invest_public | 公共投入 | 资金转换为长期共富增长 |

## 映射执行位置

- 章节定义：`farmgame/content.py` 中 `STORY_CHAPTERS`
- 事件触发：`farmgame/engine.py` 中 `trigger_chapter_event`
- Web 关卡执行：`farmgame/webapp.py` `/story/chapter/<id>/play`
- Ren'Py 关卡执行：`renpy_demo/script.rpy` `play_chapter` 与 `rg_play_event`
