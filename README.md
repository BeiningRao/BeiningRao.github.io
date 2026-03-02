# zotero-auto-ingest-organizer

一个 Zotero 7 插件示例，用于：

1. 定时扫描下载目录中的 PDF；
2. 自动导入到 Zotero；
3. 根据标题到 Crossref 拉取元数据（含摘要）；
4. 根据“标题 + 摘要”关键词自动归入集合（文件夹）；
5. 自动创建“摘要笔记”并挂到条目下。

## 安装（开发模式）

1. 打开 Zotero 7。
2. 进入 `工具 -> 插件`。
3. 右上角齿轮选择 `Install Add-on From File...`。
4. 将 `addon/` 打包成 `.xpi` 后安装。

> 打包方式：在 `addon` 目录内执行 `zip -r ../zotero-auto-ingest-organizer.xpi .`

## 默认行为

- 扫描目录：`~/Downloads`
- 扫描频率：30 秒
- 支持文件：`.pdf`

## 自动分类规则

关键词到集合路径映射位于 `addon/chrome/content/bootstrap.js`：

- `llm` -> `AI/LLM`
- `transformer` -> `AI/NLP`
- `medical` -> `Medical/Clinical`
- `vision` -> `CV`

可按你的学科方向修改。

## 注意事项

- 这是“可运行的最小原型”，用于快速验证流程。
- 元数据依赖 Crossref 数据质量；如标题不规范，命中率会下降。
- 若你希望“下载瞬间”而非“定时扫描”导入，可进一步接入浏览器 connector 下载事件或系统文件监听（不同平台实现不同）。
