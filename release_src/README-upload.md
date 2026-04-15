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

- 本版本已切换为“前后端统一链路”：前端负责 UI，业务状态与规则结算统一走 Render 后端 API。
- `assets/engine.js` 仅用于前端状态结构与渲染适配，服务端返回 `raw_state` 后由前端回填显示。
- `assets/app.js` 与 `assets/static-viz.js` 负责页面渲染、交互绑定与 API 调用。
- 存档使用后端槽位 API（`/api/viz/slot/*`），不再以浏览器 `localStorage` 作为状态真源。

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
	- 启用且请求成功：用于可选的远端推理增强
	- 核心经营状态仍以 Render 后端接口为准
- 签名字段预留（可选开关）：
	- payload.security: `timestamp`、`nonce`、`signature`（占位）
	- headers: `X-TF-Timestamp`、`X-TF-Nonce`、`X-TF-Signature`
	- 可选附带：`X-TF-Client-Id`、`X-TF-Sign-Version`

建议上传前确认：

- ZIP 根目录直接包含 `index.html`
- `assets/engine.js` 与 `assets/app.js` 都已存在
- 设置页已配置后端 API 基地址（Render URL）
- Render 已配置 `ALLRICHAI_ALLOWED_ORIGINS`，允许 funloom 域名跨域访问

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
