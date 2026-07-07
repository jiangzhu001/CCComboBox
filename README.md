# CCComboBox

一个基于 Cocos Creator 3.8+ 的现代下拉列表组件，支持虚拟列表、搜索过滤、键盘导航、图标显示等特性。设计风格参考 Element Plus / Ant Design。

## ✨ 特性

- **单选模式** —— 完整的选中态视觉与事件通知
- **虚拟列表** —— 基于 [LarkList](assets/script/list/List.ts) 实现，轻松支持 1000+ 数据流畅滚动
- **搜索过滤** —— 内置搜索框，实时过滤选项
- **键盘导航** —— 支持 ↑↓ 切换、Enter 确认、Esc 关闭
- **图标支持** —— 每个选项可配置独立图标
- **禁用项** —— 支持禁用单个选项，禁用项不可选中
- **动画过渡** —— 展开/收起带淡入淡出与缩放动画
- **点击外部关闭** —— 自动监听全局点击，点击下拉区域外自动收起
- **滚动到选中项** —— 展开时自动滚动定位到当前选中项
- **API 完备** —— 提供 `setItems` / `addItem` / `removeItem` / `clearItems` / `setSelectedByValue` 等方法

## 📦 目录结构

```
assets/
├── CCComboBox/                        # 组件主体
│   ├── prefabs/
│   │   ├── CCComboBox.prefab          # 主预制体（直接拖入场景使用）
│   │   └── CCComboBoxItem.prefab      # 选项项预制体（List 模板）
│   └── scripts/
│       ├── CCComboBox.ts              # 主组件
│       ├── CCComboBoxItem.ts          # 选项项组件（继承 ListItem）
│       ├── CCComboBoxItemData.ts      # 选项数据类
│       └── CCComboBoxEvent.ts         # 事件枚举
├── script/list/                       # 第三方虚拟列表（LarkList）
└── tests/
    └── CCComboBoxTest.ts              # 测试脚本
```

## 🚀 快速开始

### 1. 拖入预制体

将 `assets/CCComboBox/prefabs/CCComboBox.prefab` 拖入场景的 Canvas 下。

### 2. 设置数据

**方式一：编辑器配置**

在 CCComboBox 组件的 `items` 数组中添加 `CCComboBoxItemData`，填写 `label` 和 `value`。

**方式二：代码动态设置**

```typescript
import { CCComboBox } from './CCComboBox/scripts/CCComboBox';
import { CCComboBoxItemData } from './CCComboBox/scripts/CCComboBoxItemData';
import { CCComboBoxEvent } from './CCComboBox/scripts/CCComboBoxEvent';

// 获取组件
const comboBox = node.getComponent(CCComboBox);

// 设置选项
comboBox.setItems([
    new CCComboBoxItemData('北京', 'bj'),
    new CCComboBoxItemData('上海', 'sh'),
    new CCComboBoxItemData('广州', 'gz', { disabled: true }),
]);

// 监听选中事件
comboBox.node.on(CCComboBoxEvent.SELECTED_CHANGED, (index, item) => {
    console.log(`选中: ${item.label}, 值: ${item.value}`);
}, this);
```

## 📖 API 文档

### 属性（编辑器可配置）

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `items` | `CCComboBoxItemData[]` | `[]` | 选项数据列表 |
| `selectedIndex` | `number` | `-1` | 当前选中索引，-1 表示未选中 |
| `placeholder` | `string` | `'请选择'` | 未选中时显示的占位文本 |
| `maxVisibleItems` | `number` | `6` | 最大可见选项数量，超出后滚动 |
| `searchable` | `boolean` | `true` | 是否启用搜索框 |
| `disabled` | `boolean` | `false` | 是否禁用整个下拉列表 |

### 节点引用（由预制体自动绑定）

| 属性 | 类型 | 说明 |
|---|---|---|
| `buttonNode` | `Node` | 触发按钮节点 |
| `selectedLabel` | `Label` | 显示选中项文本 |
| `placeholderLabel` | `Label` | 占位文本 |
| `arrowNode` | `Node` | 下拉箭头（展开时旋转 180°） |
| `dropDownNode` | `Node` | 下拉面板容器 |
| `searchEditBox` | `EditBox` | 搜索输入框 |
| `list` | `List` | 虚拟列表组件 |
| `emptyLabel` | `Node` | 无匹配项提示 |

### 方法

| 方法 | 签名 | 说明 |
|---|---|---|
| `setSelectedIndex` | `(index: number, emitEvent?: boolean) => void` | 通过索引设置选中项 |
| `setSelectedByValue` | `(value: string \| number, emitEvent?: boolean) => void` | 通过值设置选中项 |
| `setItems` | `(items: CCComboBoxItemData[], keepSelection?: boolean) => void` | 设置选项数据 |
| `addItem` | `(item: CCComboBoxItemData) => void` | 添加一个选项 |
| `removeItem` | `(index: number) => void` | 移除指定索引的选项 |
| `clearItems` | `() => void` | 清空所有选项 |
| `expand` | `() => void` | 展开下拉列表 |
| `collapse` | `() => void` | 收起下拉列表 |
| `toggle` | `() => void` | 切换展开/收起状态 |

### 事件

通过 `comboBox.node.on(eventName, callback, target)` 监听。

| 事件名 | 回调参数 | 说明 |
|---|---|---|
| `SELECTED_CHANGED` | `(index: number, item: CCComboBoxItemData \| null)` | 选中项变化 |
| `DROPDOWN_OPEN` | `()` | 下拉展开 |
| `DROPDOWN_CLOSE` | `()` | 下拉收起 |
| `SEARCH_CHANGED` | `(searchText: string)` | 搜索文本变化 |

### CCComboBoxItemData 数据类

```typescript
const item = new CCComboBoxItemData(
    '显示文本',           // label
    '关联值',             // value (string | number)
    {
        disabled: false,  // 是否禁用
        icon: null,       // SpriteFrame 图标
        tag: null,        // 用户自定义附加数据
    },
);
```

## 🎨 视觉设计

- **配色**：参考 Element Plus（边框 `#DCDFE6`，悬停 `#F5F7FA`，选中 `#ECF5FF`，主色 `#409EFF`）
- **圆角**：按钮 4px，下拉面板 8px
- **字号**：14px（选项文本），16px（按钮文本）
- **动画**：展开/收起 0.18s 淡入 + 0.92→1 缩放

## 🧪 测试场景

打开 `assets/scenes/TestScene.scene`，场景中包含：

- 一个 CCComboBox 实例
- 9 个控制按钮：加载大数据（1000 项）/ 小数据 / 图标数据、随机选中、添加/移除/清空、展开/收起
- 结果显示 Label（实时反馈选中项）
- 数据量 Label

运行场景后点击按钮即可验证各项功能。

## 🔧 技术实现

### 虚拟列表

采用第三方 [LarkList](assets/script/list/List.ts) 组件作为虚拟列表后端：
- `@requireComponent(ScrollView)`，复用 Cocos 原生 ScrollView
- 内置 `SelectedType.SINGLE` 单选模式
- 通过 `renderEvent` 回调按需渲染可见项
- 仅修改了 `List.ts` 一行：导出 `SelectedType` 枚举供外部使用

### 选项项

`CCComboBoxItem` 继承自 `ListItem`：
- 复用 List 的选中态管理
- 重写 `selected` setter，用背景色变化替代默认勾选标记
- 通过 `updateDisplay(data)` 方法在 `renderEvent` 回调中刷新显示

### 动画

使用 Cocos 3.x 的 `tween` + `UIOpacity` 实现淡入淡出，避免直接操作 Node.opacity（3.x 已废弃）。

## ⚠️ 注意事项

1. **Cocos Creator 版本**：3.8.8+（使用了 `UIOpacity`、`EditBox` 等 3.x API）
2. **List 组件依赖**：项目内已内置 `assets/script/list/`，请勿删除
3. **预制体引用**：CCComboBox.prefab 内部的节点引用已自动绑定，无需手动配置
4. **图标资源**：如需显示图标，请在 `CCComboBoxItemData.icon` 上赋值 `SpriteFrame`
5. **EditBox 字体**：搜索框字体大小由 EditBox 内部子 Label 决定，默认 16px，如需修改请在预制体中调整

## 📄 License

MIT
