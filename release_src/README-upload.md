# 静态发布版上传说明

本目录已满足：
- 入口文件：`index.html`
- 资源相对路径：`./assets/styles.css`、`./assets/engine.js`、`./assets/app.js`
- 可按 ZIP 或文件夹直接上传

## 上传前检查

1. 确认 ZIP 根目录直接包含 `index.html`。
2. 不要把上层目录一起压进去（避免 `AllRichAI/dist/index.html` 这种层级）。
3. 上传后默认打开首页即可体验三页核心交互。

## 说明

- 本版本为“引擎版静态发布”，不依赖 Python/Flask 后端。
- `assets/engine.js` 提供浏览器侧经营引擎，负责状态、规则、日结算、任务、订单、公司、技能与合作系统。
- `assets/app.js` 负责页面渲染、交互绑定、槽位存档和中转接口调用。
- 存档使用浏览器 `localStorage`，支持当前进度与多槽位。

可直接体验的主要系统：

- 经营循环：播种、养殖、收获、加工、销售、推进天数
- 经营扩展：订单履约、公司治理、雇佣、分红、扩栏、加工坊升级
- 成长系统：技能解锁、阶段升级、任务结算、合作推进
- 交互系统：人物互动、仓库总览、开放玩法

## 第二阶段：中转接口开关（已接入）

- 在“设置与存档”里可启用中转接口：
	- 开关：是否启用远端推理
	- Endpoint：中转服务地址
	- model（可选）：传给中转服务
	- timeout：前端请求超时
- 运行逻辑：
	- 启用且请求成功：使用中转返回文本与效果，并接入前端经营引擎统一结算
	- 请求失败：自动回退到本地前端引擎的开放玩法文本与规则结算，不中断玩法
- 签名字段预留（可选开关）：
	- payload.security: `timestamp`、`nonce`、`signature`（占位）
	- headers: `X-TF-Timestamp`、`X-TF-Nonce`、`X-TF-Signature`
	- 可选附带：`X-TF-Client-Id`、`X-TF-Sign-Version`

建议上传前确认：

- ZIP 根目录直接包含 `index.html`
- `assets/engine.js` 与 `assets/app.js` 都已存在
- 如需开放玩法远端推理，目标平台需允许浏览器跨域访问你的中转服务

建议中转响应（JSON）格式：

```json
{
	"text": "剧情文本...",
	"effects": {
		"money": 120,
		"particles": 80,
		"prosperity": 1,
		"laziness": -1
	},
	"next_options": ["行动A", "行动B", "行动C"]
}
```
