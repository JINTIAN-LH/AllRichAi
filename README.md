# 《躺平农场主：共同富裕计划》可运行原型

这是一个基于设计文档落地的 Python 多端原型，当前聚焦 Web 新版主玩法（主页、剧情看板、个人中心），底层共用同一套经营规则引擎。

## 已实现内容

- 主循环：状态查看、农场经营、人物互动、系统升级、任务推进、存档读档
- 经营循环：播种、养殖、推进天数、收获、加工、销售、直播带货
- 系统循环：微粒自动折算生命源能、技能解锁、阶段升级
- 产业循环：村办公司、雇佣村民、分红和品牌等级
- 产业深化：养殖扩栏、加工坊升级、订单系统、工资与利润池分红
- 剧情骨架：围绕家庭、导师、电商合作、共同富裕目标推进
- 任务体系：主线、支线、日常、成就四类任务自动结算
- 自检能力：内置设计逻辑审计，输出文档层面的主要冲突与当前实现的修正规则
- Web 界面：新版主页 / 剧情看板（全局面板）/ 个人中心三页面，底栏跳转
- 剧情看板：全局面板推进模式（状态、角色、事件、指令、结果）
- Ren'Py 桥接：三卷多章节脚本可直接调用 `GameEngine`

## 运行方式

```bash
c:/Users/LH/Desktop/developerEnvironment/AllRichAI/.venv/Scripts/python.exe -m farmgame
```

运行逻辑审计：

```bash
c:/Users/LH/Desktop/developerEnvironment/AllRichAI/.venv/Scripts/python.exe -m farmgame --audit
```

运行单元测试：

```bash
c:/Users/LH/Desktop/developerEnvironment/AllRichAI/.venv/Scripts/python.exe -m unittest discover -s tests
```

启动 Web 版：

```bash
c:/Users/LH/Desktop/developerEnvironment/AllRichAI/.venv/Scripts/python.exe run_web.py
```

Windows 一键启动（自动建虚拟环境并安装依赖）：

```bash
start_web.bat
```

仅检查环境不启动服务：

```bash
start_web.bat --check
```

## 静态发布（上传平台）

静态发布使用 `release_src` 作为发布源，通过脚本生成 `dist` 与上传包 `dist-static-upload.zip`。

当前静态版已经不是早期的“简化前端状态机试玩版”，而是“引擎版静态发布”：

- 浏览器内置 JS 游戏引擎，按主工程规则驱动种植、养殖、加工、订单、公司、技能、任务、合作与日结算
- 静态页面只是 UI 壳，核心状态与规则由前端引擎统一管理
- 存档使用浏览器 `localStorage`，支持当前进度和多槽位
- 可选接入中转接口补充开放玩法文本，但即使无后端也能完整运行经营主循环

基础构建：

```bash
build_dist.bat
```

构建前先把当前 `dist` 回写为新发布源：

```bash
build_dist.bat --from-current-dist
```

构建前先执行“动态工程 -> release_src”同步钩子：

```bash
build_dist.bat --sync-from-project
```

组合使用（先回写，再执行同步钩子，再构建打包）：

```bash
build_dist.bat --from-current-dist --sync-from-project
```

同步钩子文件是 `sync_to_release.py`，当前已内置第一版默认规则：自动同步 `docs/*.md`、根目录 Markdown（到 `docs/root`）、`saves` 下导出 JSON（到 `data/exports`）以及 `farmgame/static`（到 `assets/source-static`），并生成 `data/sync-manifest.json`。

静态发布核心文件：

- `index.html`：静态入口页与各玩法弹窗
- `assets/engine.js`：浏览器侧经营引擎（主工程规则迁移版）
- `assets/app.js`：静态 UI 控制器、存档、页面渲染与中转接口调用
- `README-upload.md`：上传和部署说明

## Git 常用流程（Windows）

首次克隆后设置身份（仅需一次）：

```bash
git config --global user.name "你的GitHub用户名"
git config --global user.email "你的GitHub邮箱"
```

日常提交与推送：

```bash
git status
git add .
git commit -m "feat: 你的变更说明"
git push
```

开发前先拉取远端更新：

```bash
git pull --rebase
```

查看最近提交：

```bash
git log --oneline -n 10
```

如果误提交了不该跟踪的文件（先改 `.gitignore`）：

```bash
git rm -r --cached .
git add .
git commit -m "chore: refresh tracked files by gitignore"
git push
```

## 项目结构

```text
farmgame/
  __main__.py
  app.py
  balance.py
  content.py
  engine.py
  models.py
  storage.py
  validators.py
  webapp.py
  templates/
  static/
docs/
  logic-review.md
  module-design.md
renpy_demo/
  README.md
  script.rpy
tests/
  test_engine.py
```

模块说明见 `docs/module-design.md`，逻辑自检见 `docs/logic-review.md`。

## Web 多存档说明

- 网页当前活动存档：`saves/web_save.json`
- 网页槽位存档目录：`saves/web_slots/`
- 存档入口统一放在主页右上角“设置”按钮内

## Web 页面结构

1. 主页：经营操作、订单交付、公司治理、技能解锁
2. 剧情看板：全局面板推进、指令执行、结果回显
3. 个人中心：公司治理参数调优与阶段评估

## 引擎版静态页能力

- 主页：日常操作、农田、养殖、加工、订单、公司治理、仓库、人物互动、技能、合作推进、开放玩法
- 剧情页：使用同一套前端引擎进行剧情推进与日结算，不再是单独的轻量模拟页
- 个人中心：经营参数配置与未来天数预测
- 存档：支持当前进度和 4 个本地槽位

## 紧凑布局适配

- 桌面端默认启用“整页紧凑模式”：整页尽量不滚动，卡片内部滚动
- 移动端自动回退到常规流式布局，确保可读性

## 大模型推理剧情（可选）

- 默认会使用本地模板生成 AI 剧情草案
- 默认优先读取 JSON 配置文件：`config/llm_api.json`

```json
{
  "LLM_API_KEY": "你的API Key",
  "LLM_API_BASE": "https://open.bigmodel.cn/api/paas/v4",
  "LLM_MODEL": "glm-5",
  "LLM_CHAT_MODEL": "glm-5",
  "PORT": 3002,
  "timeout_seconds": 10
}
```

- 说明：
  - `LLM_API_BASE` 会自动拼接为 `.../chat/completions`
  - `PORT` 现在会直接控制 Web 启动端口（`run_web.py` 与 `start_web.bat` 都会读取）

- 端口优先级：
  - `ALLRICHAI_WEB_PORT`（环境变量）
  - `config/llm_api.json` 中的 `PORT`
  - 默认 `5000`

- 也可使用环境变量覆盖（优先级更高）：

```bash
set ALLRICHAI_LLM_ENDPOINT=http://your-llm-endpoint
set ALLRICHAI_LLM_API_KEY=your_key
set ALLRICHAI_LLM_TIMEOUT=10
```

- 可通过 `ALLRICHAI_LLM_CONFIG` 指定其他 JSON 路径：

```bash
set ALLRICHAI_LLM_CONFIG=C:\path\to\llm_api.json
```

- 远端接口需返回 JSON，支持 `text`、`output` 或 `content` 字段

- 对静态发布版补充说明：
  - 静态页不会直接读取本地 Python 配置文件
  - 静态页如需远端推理，请在“设置与存档”中填写中转 Endpoint
  - 若中转失败，仍会回退到本地前端引擎的开放玩法结算与文本兜底

## 新版开放玩法（兼容主页）

- 主页新增模块：`开放玩法（LLM）`
- 支持流程：输入场景与目标 -> LLM 生成行动建议 -> 输入行动 -> LLM 推演结果
- 与原主页经营按钮兼容，不会替代已有种植/养殖/订单/公司流程
- 在静态发布版中，开放玩法的数值结算同样会进入统一的前端经营引擎，并触发日推进、任务刷新与次日建议更新

API 返回建议格式：

```json
{ "options": ["行动A", "行动B", "行动C"] }
```

API 返回推演格式：

```json
{
  "text": "剧情结果文本",
  "effects": {
    "money": 120,
    "particles": 80,
    "prosperity": 1,
    "laziness": -1
  }
}
```

## Ren'Py 三卷流程

`renpy_demo/script.rpy` 已拆为三卷十二章节：

1. 第一卷：4 章（返乡、系统、直播、家庭协作）
2. 第二卷：4 章（加工、扩栏、公司化、订单履约）
3. 第三卷：4 章（区域订单、振兴、终局、示范复制）

## AVG 文本映射

- 逐句映射表见：`docs/avg-line-mapping.md`
- 包含章节ID、原文段落、事件ID、状态变更的对应关系
