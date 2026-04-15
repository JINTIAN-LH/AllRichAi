# 躺平农场主 - 可视化系统

## 概述

这是一个为"躺平农场主"游戏开发的可视化界面系统，旨在为原本基于命令行的文本游戏提供直观的图形界面。系统采用前后端分离架构，前端使用纯JavaScript、CSS和HTML，后端保持原有的Python Flask框架。

## 设计理念

- **非侵入性**：不修改原始游戏核心逻辑，仅添加可视化层
- **实时同步**：通过状态同步机制确保UI与游戏状态一致
- **模块化架构**：各功能模块独立开发，便于维护和扩展
- **响应式设计**：适配不同屏幕尺寸，支持桌面和移动设备

## 技术栈

- **前端**：JavaScript (ES6+)、CSS3、HTML5
- **可视化库**：Chart.js (数据可视化)
- **动画效果**：CSS3 动画、Web Animations API
- **后端**：Python Flask (保持原样)
- **数据格式**：JSON

## 目录结构

```
farmgame/static/viz/
├── css/                    # 样式文件
│   ├── base.css           # 基础样式和布局
│   ├── panel.css          # 面板组件样式
│   ├── anim.css           # 动画样式
│   └── story.css          # 剧情可视化样式
├── js/                     # JavaScript文件
│   ├── engineBridge.js    # 引擎桥接层
│   ├── stateSync.js       # 状态同步管理
│   ├── animEngine.js      # 动画引擎
│   ├── particleEffect.js  # 粒子效果系统
│   ├── farmInteract.js    # 农场交互逻辑
│   ├── warehouseInteract.js # 仓库交互逻辑
│   ├── taskInteract.js    # 任务交互逻辑
│   ├── statusBind.js      # 状态绑定逻辑
│   ├── chartManager.js    # 图表管理器
│   ├── storyViz.js        # 剧情可视化
│   ├── saveViz.js         # 存档可视化
│   └── openPlayViz.js     # 开放玩法可视化
├── components/             # 可视化组件
│   ├── FarmDashboard.html # 农场仪表板
│   ├── StatusBar.html     # 状态栏
│   ├── WarehousePanel.html # 仓库面板
│   ├── TaskPanel.html     # 任务面板
│   ├── DataVizPanel.html  # 数据可视化面板
│   ├── StoryTimeline.html # 剧情时间线
│   ├── StoryDialog.html   # 剧情对话
│   ├── StoryResult.html   # 剧情结果
│   ├── SaveVizPanel.html  # 存档管理
│   └── OpenPlayViz.html   # 开放玩法
└── templates/
    └── viz_index.html     # 主游戏模板
```

## 核心功能

### 1. 实时状态同步
- 定期从后端获取游戏状态
- 自动更新UI元素以反映最新状态
- 支持状态变更回调机制

### 2. 农场可视化
- 直观展示农田、作物生长状态
- 支持拖拽操作进行种植、收获
- 实时动画反馈

### 3. 仓库管理
- 可视化库存管理
- 物品分类展示
- 快速存取操作

### 4. 任务系统
- 任务进度可视化
- 任务奖励预览
- 一键完成任务

### 5. 数据可视化
- 收益趋势图表
- 资源分布饼图
- 经营效率指标

### 6. 剧情系统
- 剧情时间线展示
- 角色对话面板
- 选择分支系统

### 7. 存档系统
- 多槽位存档管理
- 存档预览信息
- 快速保存/读取

### 8. 开放玩法
- AI驱动的自由规划
- 行动建议系统
- 执行结果推演

## 动画与视觉效果

### CSS3 动画
- 元素过渡效果
- 加载动画
- 状态变化动画

### 粒子效果
- 收获时的粒子飞溅
- 升级时的庆祝效果
- 交互反馈粒子

### Web Animations API
- 复杂的自定义动画
- 精确的时间控制
- 平滑的动画过渡

## 性能优化

- **虚拟滚动**：对于大量数据项使用虚拟滚动
- **防抖节流**：减少不必要的API调用
- **懒加载**：按需加载组件和资源
- **内存管理**：及时清理事件监听器和定时器

## 扩展性

- **插件架构**：易于添加新功能模块
- **主题系统**：支持外观主题切换
- **国际化**：预留多语言支持接口
- **配置化**：通过配置文件控制行为

## API 接口

前端通过以下接口与后端通信：

- `GET /api/viz/state` - 获取游戏状态
- `POST /api/viz/action` - 执行游戏动作
- `POST /api/viz/slot/save` - 保存到指定存档槽位
- `POST /api/viz/slot/load` - 从指定存档槽位读取
- `POST /api/viz/slot/delete` - 删除指定存档槽位
- `POST /api/viz/open/suggest` - 获取开放玩法建议
- `POST /api/viz/open/play` - 执行开放玩法动作

## 开发规范

- 使用ES6+语法
- 遵循模块化开发模式
- 统一的代码风格和命名约定
- 完整的错误处理机制

## 测试策略

- 单元测试覆盖核心逻辑
- 集成测试验证组件协作
- 用户体验测试确保交互流畅

## 部署说明

1. 将viz目录部署到静态资源服务器
2. 确保Flask后端API接口正常运行
3. 配置CORS允许前端访问
4. 生产环境启用缓存优化

## 维护指南

- 定期更新依赖库
- 监控性能指标
- 收集用户反馈
- 持续优化用户体验

## 版权声明

本项目遵循原始项目的许可协议，可视化部分代码版权归开发者所有。