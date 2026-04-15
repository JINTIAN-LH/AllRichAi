# 躺平农场主可视化系统 - 快速启动指南

## 项目简介

这是一个为"躺平农场主"游戏开发的完整可视化解决方案，将原本基于命令行的文本游戏转换为具有丰富图形界面的现代化游戏体验。

## 快速开始

### 1. 环境准备
确保您的系统已安装：
- Python 3.7+
- Flask框架
- Node.js (可选，用于开发工具)

### 2. 项目结构
```
farmgame/
├── static/
│   └── viz/              # 可视化系统文件
│       ├── css/          # 样式文件
│       ├── js/           # JavaScript文件  
│       ├── components/   # 可视化组件
│       └── README.md     # 系统说明
├── templates/
│   └── viz_index.html    # 主游戏模板
└── app.py               # Flask应用入口
```

### 3. 集成步骤

#### 步骤1: 替换模板文件
将 `farmgame/templates/viz_index.html` 替换为您的主游戏模板文件。

#### 步骤2: 确保API接口可用
系统依赖以下Flask路由：
```python
@app.get('/api/viz/state')
def api_viz_state():
  # 返回可视化层状态

@app.post('/api/viz/action')
def api_viz_action():
  # 执行可视化动作（播种/收获/出售等）

@app.post('/api/viz/slot/save')
def api_viz_slot_save():
  # 保存到指定槽位

@app.post('/api/viz/slot/load')
def api_viz_slot_load():
  # 从指定槽位读取

@app.post('/api/viz/slot/delete')
def api_viz_slot_delete():
  # 删除指定槽位

@app.post('/api/viz/open/suggest')
def api_viz_open_suggest():
  # 获取开放玩法建议

@app.post('/api/viz/open/play')
def api_viz_open_play():
  # 执行开放玩法动作
```

#### 步骤3: 启动服务器
```bash
python app.py
```

#### 步骤4: 访问游戏
在浏览器中打开 `http://localhost:5000` 即可开始游戏。

## 功能使用指南

### 1. 农场操作
- **种植**: 点击空闲地块，然后点击"种植"按钮
- **收获**: 点击成熟作物，然后点击"收获"按钮  
- **浇水**: 选择作物后点击"浇水"按钮
- **施肥**: 选择作物后点击"施肥"按钮

### 2. 仓库管理
- **切换标签**: 点击"种子"、"作物"、"工具"标签查看不同物品
- **使用物品**: 点击物品下方的"使用"按钮
- **出售作物**: 点击作物下方的"出售"按钮

### 3. 任务系统
- **查看任务**: 在任务面板中查看当前任务
- **完成任务**: 点击"完成"按钮领取奖励

### 4. 数据可视化
- **收益趋势**: 查看历史收益变化
- **资源分布**: 了解各类资源占比
- **经营效率**: 监控农场运营状况

### 5. 剧情系统
- **浏览剧情**: 在剧情时间线中查看故事进展
- **参与对话**: 点击章节节点进入对话
- **做出选择**: 选择对话选项影响剧情发展

### 6. 存档系统
- **保存游戏**: 点击"快速保存"或选择特定槽位保存
- **加载游戏**: 从存档槽位读取游戏进度
- **管理存档**: 删除不需要的存档

### 7. 开放玩法
- **输入计划**: 在开放玩法面板输入您的想法
- **获取建议**: 点击"获取建议"获得AI推荐
- **执行计划**: 点击"执行计划"查看结果

## 自定义配置

### 1. 修改样式
编辑以下CSS文件来自定义外观：
- `base.css`: 基础样式和布局
- `panel.css`: 面板组件样式  
- `anim.css`: 动画样式
- `story.css`: 剧情样式

### 2. 扩展功能
通过以下JavaScript文件扩展功能：
- `farmInteract.js`: 农场交互逻辑
- `warehouseInteract.js`: 仓库交互逻辑
- `taskInteract.js`: 任务交互逻辑

### 3. 添加动画
使用动画引擎添加新的动画效果：
```javascript
// 示例：添加自定义动画
AnimEngine.triggerAnimation('custom', element, {
  duration: 1000,
  easing: 'ease-in-out',
  properties: {
    transform: 'scale(1.2)',
    opacity: 0.8
  }
});
```

## 常见问题

### Q1: 页面加载后显示空白
**A**: 检查Flask服务器是否正常运行，确保API接口可用。

### Q2: 状态没有实时更新
**A**: 检查网络连接，确认`/api/viz/state`接口返回正确的JSON数据。

### Q3: 动画效果卡顿
**A**: 检查浏览器兼容性，建议使用现代浏览器如Chrome、Firefox或Edge。

### Q4: 无法执行游戏动作
**A**: 确认`/api/viz/action`接口正确实现，返回标准格式的响应数据。

### Q5: 数据可视化图表不显示
**A**: 检查Chart.js库是否正确加载，确认数据格式符合图表要求。

## 性能优化

### 1. 状态同步频率
默认每2秒同步一次状态，可根据需要调整：
```javascript
StateSync.POLL_INTERVAL = 3000; // 3秒同步一次
```

### 2. 动画性能
在低性能设备上可禁用部分动画效果：
```javascript
AnimEngine.GLOBAL_ANIMATION_ENABLED = false; // 禁用全局动画
```

### 3. 粒子效果
根据设备性能调整粒子数量：
```javascript
ParticleEffect.MAX_PARTICLES = 50; // 限制最大粒子数
```

## 开发调试

### 1. 控制台日志
启用详细日志以便调试：
```javascript
window.DEBUG_MODE = true; // 在控制台中启用调试信息
```

### 2. 网络监控
在浏览器开发者工具中监控网络请求，确认API调用正常。

### 3. 错误处理
系统会捕获并显示错误信息，便于定位问题。

## 扩展建议

### 1. 新增游戏模式
- 复制现有的交互逻辑文件
- 修改游戏规则和UI显示
- 集成到主模板中

### 2. 增加新功能模块
- 创建新的组件HTML文件
- 编写对应的JavaScript交互逻辑
- 添加CSS样式
- 在主模板中集成

### 3. 国际化支持
- 提取界面文案到配置文件
- 实现多语言切换逻辑
- 适配RTL布局（如需要）

## 技术支持

如遇到技术问题，请参考：
- `README.md`: 详细系统说明
- `SYSTEM_ARCHITECTURE.md`: 架构设计文档
- `PROJECT_SUMMARY.md`: 项目总结报告

## 版权声明

本可视化系统遵循原始项目的许可协议，代码仅供学习和非商业用途使用。