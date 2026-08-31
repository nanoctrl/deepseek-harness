# Agent Note: 过期的客户端 Bundle 外部依赖漂移

Status: implemented

[English](2026-08-29-stale-client-bundle-externals-drift.md) | 中文

## 问题

2026-08-29，web-app harness 在启动时导入 `@deepseek-ai/dsh-api-remotes` 加载器条目失败：`client-modules: require("zod") missed the module table — not a platform seed word, not a materialized module, and no registered package factory`。被提供的 `lib/client.js` 在一份完整内联的 zod 副本之前带有一个孤立的 `let zod = require("zod");`。该 bundle 产生于向客户端入口接入三个新包期间的中间构建状态；对 Client face 的一次干净重建产出的 bundle 不包含任何 `require()` 调用。

客户端加载器只对平台 seed、已物化模块和已注册的 bundle 工厂解析 `require()`。构建预设（`packages/client/tsdown.client.ts` 的 `clientConfig`）会把未显式向模块表请求的一切内联——其注释点名了 zod——因此一个未被请求的说明符以 `require()` 形式残留在客户端 bundle 中，始终是构建期的外部依赖漂移。修复不需要改动代码：运行时错误本身就是设计上的响亮失败检测，重建即移除了孤立的 require。

## 决策

预防是操作层面的，记录在此作为诊断规则而非新增门禁：

- 健康的客户端 bundle 除了平台 seed 词和包自身 `dsh.client.external` 请求之外，不包含任何 `require()`。对于未请求任何项的 `dsh-api-remotes`，健康数量为零：`grep -o 'require("[^"]*")' lib/client.js` 必须无输出。
- 向客户端入口接入新包之后（`src/client/index.ts` 中的新导入、新 workspace 依赖、重新生成的 `/remote` 契约），在启动 harness 前重建 Client face。
- 当启动报告缺失说明符时，先检查被提供的 bundle 中的孤立 `require()`；加载器诊断已经指明了说明符和可能的原因。

运行时保持响亮失败，bundle 纯性门禁继续拒绝未被请求的 `@deepseek-ai/*` 导入，并且不新增构建产物扫描门禁：该漂移只存在于从未提交的构建输出中，而启动期错误已经指明确切的说明符。

## 备选方案

**将 zod 加入平台 seed。** 否决：seed 保留给每个 bundle 共享的平台单例模块（react、cordis、UI slot 与 primitive 包）。zod 是每个 bundle 必须内联的普通依赖；在冻结的模块表中共享实例没有收益，还会侵蚀「未被请求的一切必须内联」规则。

**在 `lib/client.js` 产物上增加构建产物扫描门禁。** 否决：该失败模式是永远不会进入提交的中间构建状态，启动期检查已经以确切的说明符响亮失败，而为运行时免费检测到的漂移对所有产物再扫一遍不划算。

**让加载器容忍未知 require（自动拉取或惰性桩）。** 否决：工厂形式的 CJS `require()` 是同步的，而 bundle 到达是异步的，容忍会把失败推迟为插件生命周期后期的 undefined 导出——一个延迟的、失去上下文的失败，取代了启动期诊断。

## 影响

- 该失败模式及其诊断已记录在案：缺失说明符的启动错误在排查代码之前先指向构建漂移。
- 预防是一次重建步骤，而非一项检查——中间构建状态在客户端启动前仍不可见。
- 交叉引用：[生成契约构建笔记](2026-08-08-api-remotes-generated-contract-build.zh.md) 拥有导致中间状态的双面构建顺序；[客户端插件加载模型](../architecture/2026-07-23-client-plugin-loading-model.zh.md) 拥有响亮失败行为背后的加载器解析分支。
