# Agent Note: 侧边栏状态与活动指示器

Status: implemented

[English](2026-08-31-sidebar-state-and-activity-indicators.md) | 中文

## Problem

侧边栏通过一个 10px 的 `StateDot` 传达会话状态，其运行状态是一个黯淡的蓝色像素追逐动画（基础透明度 0.15），在侧边栏尺寸下几乎不可见。空闲会话完全不渲染任何点，因此列表没有持久化的逐行状态信号；工作区在其内部有会话运行时也没有任何信号。

## Decision

每个侧边栏会话行都渲染一个 `StateDot` 状态指示器；只有临时的空白行不渲染。状态为：绿 `done` 表示空闲或已完成，琥珀 `warning` 表示待交互（审批、提问、计划审阅），品红 `ongoing` 表示运行中（自身或子代理后代），红 `error` 用于携带错误的界面。`ongoing` 状态从 3×3 像素矩阵重新设计为八盏灯围绕柔光核心顺时针追逐的圆环。

活动色为品红，新增为 `--dsw-static-fuchsia-500` 并通过新的语义别名 `--dsw-alias-state-ongoing-primary`（浅色与深色）暴露。`StateDot` 将组件级 `--dsh-state-ongoing` 固定到该别名。当工作区组内存在任意运行中的可见会话（`GroupNode.hasActivity`，由成员自身 `running` 或其 `runningSubagentCount` 派生）时，其文件夹图标以活动色渲染并带 `folder-activity` 闪烁（透明度 1 → 0.4，1.2s），在 `prefers-reduced-motion` 下禁用。

## Consequences

会话行现在携带持久化的状态信号，而非仅在活动或已完成未查看时显示点；此前笔记中的完成提醒集合保持不变，本笔记拥有发生变更的行渲染。`ongoing` 颜色从 DeepSeek 蓝改为品红，贯穿所有 `StateDot` 消费方（终端卡片、子代理、任务、工作流运行），因为该原语是共享的。数据、协议或配置格式均无变更：`GroupNode.hasActivity` 与 `containsCurrent` 一样是派生的呈现事实。

## Alternatives considered

- **保留蓝色像素追逐，仅放大。** 已拒绝：所请求的活动色是强烈的品红，所请求的形状是圆形光环；蓝色仍是品牌强调色，而像素矩阵在小尺寸下读起来像静态方块。
- **在文件夹上叠加活动徽标。** 已拒绝：文件夹本身应表达活动，因此它闪烁而非携带独立徽标。

## Related

- [侧边栏会话完成提醒点](2026-08-06-session-completed-done-dot.zh.md) —— 本笔记「始终可见的点」所基于的完成提醒集合。
