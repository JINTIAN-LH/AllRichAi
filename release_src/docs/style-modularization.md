# 样式模块化结构（AllRichAI）

## 目标
- 保持现有页面视觉不回退。
- 提供可扩展的模块目录，方便后续功能按模块接入。
- 将 `styles.css` / `story_panel.css` 作为统一入口，避免模板频繁改动。

## 目录
- `farmgame/static/styles.css`：全站入口（模块聚合器）。
- `farmgame/static/story_panel.css`：剧情页入口（模块聚合器）。
- `farmgame/static/css/core/tokens.css`：全局色板与变量。
- `farmgame/static/css/core/reset.css`：基础重置与排版基线。
- `farmgame/static/css/layout/base.css`：全局壳层与导航布局。
- `farmgame/static/css/components/common.css`：通用组件（卡片、表单、弹窗、侧抽屉等）。
- `farmgame/static/css/pages/home.css`：主页私有样式。
- `farmgame/static/css/pages/balance.css`：个人中心私有样式。
- `farmgame/static/css/pages/story.css`：剧情/地图/开放行动页面样式。
- `farmgame/static/css/story-panel/page.css`：新版剧情看板样式。

## 新功能接入建议
1. 先按功能归类创建模块文件：
   - 布局改动放 `layout/*.css`
   - 通用组件放 `components/*.css`
   - 页面私有样式放 `pages/*.css` 或 `story-panel/*.css`
2. 在入口文件中增加 `@import`，按“core -> layout -> components -> pages”顺序组织。
3. 页面特性优先放 `pages/*.css`，通用能力再下沉到 `components/common.css`。

## 当前状态
1. legacy 文件已移除，样式已全部模块化。
2. 新功能可直接在对应模块新增文件并接入入口，无需再编辑单一大文件。
