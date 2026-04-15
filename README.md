# 《躺平农场主：共同富裕计划》

一个基于 Python 的多端经营原型：
- CLI：规则验证与快速迭代
- Flask Web：主页 / 剧情看板 / 个人中心 / 可视化页
- 前端打包：本地工程直出 `dist`，用于静态前端部署

核心原则：经营规则只在引擎层维护，界面层不复制业务逻辑。

## 1. 快速开始

### 环境要求
- Python 3.11+
- Windows（可直接使用 `.bat` 脚本）

### 运行命令

```bash
python -m farmgame
```

```bash
python -m farmgame --audit
```

```bash
python -m unittest discover -s tests
```

```bash
python run_web.py
```

Windows 一键启动：

```bash
start_web.bat
```

仅检查环境：

```bash
start_web.bat --check
```

## 2. 项目结构（精简视图）

```text
farmgame/                 # 核心源码（唯一规则源）
  engine.py               # 规则执行层
  app.py                  # CLI 入口层
  webapp.py               # Flask 界面层
  models.py balance.py content.py validators.py
  static/ templates/

docs/                     # 主文档源
dist/                     # 构建产物（可删除重建）
saves/                    # 本地存档
tests/                    # unittest 测试
```

## 3. 架构约定

- 规则归属：`farmgame/engine.py`
- 界面职责：`farmgame/app.py` 与 `farmgame/webapp.py` 只做交互编排
- 存档语义：
  - CLI：`saves/savegame.json`
  - Web：`saves/web_save.json`
  - Web 槽位：`saves/web_slots/`
  - 静态页：浏览器 `localStorage`
- 文档源：优先修改根目录和 `docs/`

## 4. 前端打包（本地工程直出）

打包过程直接使用本地工程源：
- `farmgame/templates/viz_index.html` 作为静态入口模板
- `farmgame/static/viz/` 作为静态资源
- 构建后生成 `dist` 与 `dist-static-upload.zip`

### 常用命令

```bash
build_dist.bat
```

## 5. 部署（推荐）

### Render 后端

仓库已提供：`render.yaml`

关键配置：
- Build：`pip install -r requirements.txt`
- Start：`gunicorn --workers=2 --threads=4 --timeout=120 --bind=0.0.0.0:$PORT run_web:app`
- Health Check：`/`

端口优先级（`run_web.py`）：
1. `ALLRICHAI_WEB_PORT`
2. `PORT`（Render 等平台注入）
3. `config/llm_api.json` 里的 `PORT`
4. 默认 `5000`

建议环境变量：
- `LLM_API_KEY`
- `ALLRICHAI_LLM_ENDPOINT`（可选）
- `ALLRICHAI_LLM_TIMEOUT`（可选）
- `ALLRICHAI_ALLOWED_ORIGINS`（例如 `https://your-app.funloom.com`，多域名用逗号分隔）
- `ALLRICHAI_SAVE_ROOT`（建议持久化目录，例如 `/var/data/allrichai/saves`）
- `ALLRICHAI_RATE_LIMIT_ENABLED`（默认 `1`）

### funloom.ai 前端

```bash
build_dist.bat
```

将 `dist/` 上传为静态目录。

如需调用后端接口，在前端设置页填写 Render API 地址。

## 6. LLM 配置（可选）

默认配置文件：`config/llm_api.json`

环境变量覆盖示例：

```bash
set ALLRICHAI_LLM_ENDPOINT=http://your-llm-endpoint
set ALLRICHAI_LLM_API_KEY=your_key
set ALLRICHAI_LLM_TIMEOUT=10
set ALLRICHAI_LLM_CONFIG=C:\path\to\llm_api.json
```

## 7. 文档入口

- 模块设计：`docs/module-design.md`
- 逻辑审计：`docs/logic-review.md`
- 玩法核心：`docs/company-core-points.md`
- 剧情映射：`docs/avg-line-mapping.md`
- 样式拆分：`docs/style-modularization.md`
- 可视化冒烟清单：`docs/viz_smoke_checklist_2026-03-28.md`

## 8. 维护建议（最小复杂度）

- 只在 `farmgame/` 修改规则
- 只在根目录 `docs/` 写长期文档
- `dist/` 与压缩包视为构建结果，随时可重建
