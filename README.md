# CCComboBox

一个适用于 Cocos Creator 3.x 的高性能下拉框组件，基于虚拟列表实现，支持泛型数据与完全自定义渲染。

## ✨ 特性

- 🎯 **泛型数据支持**  - 支持任意数据类型，业务方自由定义数据结构

- 🎨 **完全自定义渲染**  - 通过 `buttonRenderer` 和 `itemRenderer` 回调，业务方完全控制按钮和列表项的 UI 显示

- 📦 **虚拟列表内核**  - 基于 LarkList 实现高性能虚拟列表，海量数据也流畅

- ⚡ **内置单选**  - 选中态自动管理，切换时自动刷新上一项与当前项

- 🎭 **箭头动画**  - 展开收起时箭头自动旋转 180°，过渡自然

- 📐 **动态面板高度**  - 根据数据数量与 `maxDisplayCount` 自动计算面板高度，超出滚动

- 🌐 **全平台通用**  - 支持 Web / Android / iOS / 小游戏等所有平台

- 📦 **开箱即用**  - 提供示例场景与测试脚本，快速集成

## 🌐 在线预览

在线体验组件效果：[https://damp-bush-1af4.jiangzhu7230581.workers.dev/](https://damp-bush-1af4.jiangzhu7230581.workers.dev/)

## 仓库地址

[https://github.com/jiangzhu7230581-oss/CCComboBox](https://github.com/jiangzhu7230581-oss/CCComboBox)

## 📋 环境要求

- Cocos Creator 3.8.8 或更高版本
- TypeScript

## 🚀 快速开始

### 安装

#### 方式一：直接复制（推荐）

1. 下载或克隆本项目

2. 将 `assets` 目录下的以下文件复制到你的项目中：

    - `assets/script/ComboBox.ts` - 下拉框主组件
    - `assets/script/list/List.ts` - 虚拟列表组件（LarkList）
    - `assets/script/list/ListItem.ts` - 列表项组件（LarkListItem）
    - `assets/res/` - 示例所需图片资源（可选，按需替换为你自己的资源）

#### 方式二：导入整个项目

1. 下载本项目
2. 在 Cocos Creator 中打开项目，参考 `assets/scenes/TestScene.scene` 示例场景
3. 将需要的脚本与资源复制到你的项目中

### 基础用法

#### 1. 配置预制体节点结构

在场景或预制体中创建如下节点层级（节点名可自定义，需在 `ComboBox` 组件属性中绑定）：

```
ComboBox（根节点，挂载 ComboBox 组件）
├── selectMenu        触发按钮节点（需添加 Button 组件）
│    ├── lblName      按钮主文本
│    ├── lblId        按钮副文本
│    └── arrow        箭头图标节点
└── selectPanel       下拉面板节点
     └── view         ScrollView 视图（挂载 LarkList 组件）
          └── content
               └── item 模板节点（挂载 LarkListItem 与 Button 组件）
                    ├── unSelect  未选中态
                    └── select    选中态
```

#### 2. 在编辑器中配置 ComboBox 组件属性

将 `ComboBox` 组件挂载到根节点，并在属性检查器中绑定：

- **selectMenu**  - 触发按钮节点
- **arrow**  - 箭头图标节点（展开时旋转）
- **selectPanel**  - 下拉面板节点
- **list**  - LarkList 列表组件
- **maxDisplayCount**  - 最大显示个数（超出后滚动），默认 5
- **itemHeight**  - 单项高度（像素），默认 100
- **topOffset / bottomOffset**  - 面板上下内边距，默认 12
- **itemGap**  - 列表项间隙距离（像素），默认 8

> 菜单路径：`Game/UI/ComboBox（下拉框）`

#### 3. 在脚本中设置数据与渲染回调

```typescript
import { _decorator, Component, Label } from 'cc';
import { ComboBox } from './ComboBox';

const { ccclass, property } = _decorator;

interface MyData {
    name: string;
    id: string;
    icon: string;
}

@ccclass('ComboBoxTest')
export class ComboBoxTest extends Component {
    @property({ type: ComboBox, tooltip: "下拉列表组件" })
    comboBox: ComboBox = null;

    protected onEnable(): void {
        this._initComboBox();
    }

    private _initComboBox() {
        const items: MyData[] = [
            { name: '100元', id: '+8613760380453', icon: 'texture/deposit/iconBank' },
            { name: '200元', id: '+86137603804532', icon: 'texture/deposit/iconBank' },
            { name: '300元', id: '+861376038045323', icon: 'texture/deposit/iconBank' },
            // ...更多数据
        ];

        // 按钮内容渲染（item 为 null 时表示清空状态）
        this.comboBox.buttonRenderer = (btnNode, item) => {
            btnNode.getChildByName('lblName').getComponent(Label).string = item.name;
            btnNode.getChildByName('lblId').getComponent(Label).string = item.id;
        };

        // 列表项渲染
        this.comboBox.itemRenderer = (itemNode, data, index) => {
            if (!itemNode || !data) return;

            const unSelect = itemNode.getChildByName('unSelect');
            unSelect.getChildByName('lblName').getComponent(Label).string = data.name;
            unSelect.getChildByName('lblId').getComponent(Label).string = data.id;

            const select = itemNode.getChildByName('select');
            select.getChildByName('lblName').getComponent(Label).string = data.name;
            select.getChildByName('lblId').getComponent(Label).string = data.id;
        };

        // 设置数据并默认选中第一项
        this.comboBox.setData(items);
        this.comboBox.setSelected(0);
    }
}
```

#### 4. 使用示例场景快速测试

项目中提供了 `TestScene` 与 `ComboBoxTest` 组件，可以快速验证功能：

1. 打开 `assets/scenes/TestScene.scene`
2. 运行场景，点击下拉框按钮即可展开/收起面板
3. 选择某一项后面板自动收起，按钮内容同步更新

## 📚 API 文档

### ComboBox 主组件

#### 编辑器属性

| 属性 | 类型 | 说明 | 默认值 |
| --- | --- | --- | --- |
| `selectMenu` | `Node` | 触发按钮节点（需添加 Button 组件） | `null` |
| `arrow` | `Node` | 箭头图标节点（展开时旋转 180°） | `null` |
| `selectPanel` | `Node` | 下拉面板节点 | `null` |
| `list` | `List` | LarkList 列表组件 | `null` |
| `maxDisplayCount` | `number` | 最大显示个数（超出后滚动） | `5` |
| `itemHeight` | `number` | 单项高度（像素） | `100` |
| `topOffset` | `number` | 顶部偏移量（像素） | `12` |
| `bottomOffset` | `number` | 底部偏移量（像素） | `12` |
| `itemGap` | `number` | 列表项间隙距离（像素） | `8` |

#### 渲染回调

```typescript
/** 按钮内容渲染回调（item 为 null 时表示清空状态） */
type ButtonRenderCallback<T> = (btnNode: Node, item: T | null) => void;

/** 列表项渲染回调 */
type ListItemRenderCallback<T> = (itemNode: Node, item: T, index: number) => void;
```

#### 主要方法

```typescript
/**
 * 设置数据列表
 * @param items 数据项数组（设置后会自动调用 buttonRenderer 显示第一项）
 */
setData(items: T[]): void;

/**
 * 设置默认选中项
 * @param index 选中索引
 */
setSelected(index: number): void;

/**
 * 获取当前选中信息
 * @returns 选中信息对象，未选中时返回 null
 */
getSelected(): { index: number; item: T } | null;

/**
 * 获取当前选中索引
 * @returns 选中索引，未选中时返回 -1
 */
getSelectedIndex(): number;

/**
 * 获取当前选中项的数据
 * @returns 选中项的数据，未选中时返回 undefined
 */
getSelectedItem(): T | undefined;

/**
 * 获取所有数据项
 */
getItems(): T[];

/**
 * 切换面板展开/收起状态
 */
togglePanel(): void;

/**
 * 判断面板是否展开
 */
isExpanded(): boolean;

/**
 * 清空数据（重置按钮为默认状态并收起面板）
 */
clear(): void;
```

#### 交互行为

| 操作 | 行为 |
| --- | --- |
| 点击 `selectMenu` | 展开 / 收起下拉面板 |
| 面板展开 | 箭头旋转 180°，列表刷新 |
| 点击列表项 | 触发 `buttonRenderer` 更新按钮内容，面板自动收起 |
| 数据超出 `maxDisplayCount` | 面板内部可滚动 |

### List 虚拟列表组件（LarkList）

本项目下拉面板内置基于 `LarkList` 的高性能虚拟列表，支持以下特性（在 LarkList 组件属性检查器中配置）：

- **模板类型**  - 支持 Node 与 Prefab 两种模板
- **虚拟列表**  - 仅渲染可视区域内的 Item，海量数据也流畅
- **循环列表**  - 支持无限滚动
- **滑动模式**  - 普通 / 粘附 / 翻页
- **选择模式**  - 单选 / 多选 / 无
- **分帧渲染**  - 大量数据时按帧渲染，避免卡顿

> 下拉框场景下，请将 LarkList 的 `selectedMode` 设置为 `SINGLE`（单选）以配合 `ComboBox` 工作。

### ListItem 列表项组件（LarkListItem）

挂载于列表项模板节点上，配合 LarkList 实现选择功能：

- **selectedMode**  - 选择模式（NONE / TOGGLE / SWITCH）
- **selectedFlag**  - 被选标识节点
- **adaptiveSize**  - 是否自适应尺寸

## 📖 示例场景

### 示例 1：基础下拉框

最简单的用法，绑定节点 + 设置数据 + 渲染回调：

```typescript
this.comboBox.buttonRenderer = (btnNode, item) => {
    btnNode.getChildByName('lblName').getComponent(Label).string = item.name;
};
this.comboBox.itemRenderer = (itemNode, data, index) => {
    itemNode.getChildByName('lblName').getComponent(Label).string = data.name;
};
this.comboBox.setData(items);
this.comboBox.setSelected(0);
```

### 示例 2：获取选中项

```typescript
// 获取选中索引
const index = this.comboBox.getSelectedIndex();

// 获取选中数据
const item = this.comboBox.getSelectedItem();

// 获取选中信息（索引 + 数据）
const selected = this.comboBox.getSelected();
if (selected) {
    console.log('选中索引:', selected.index, '选中数据:', selected.item);
}
```

### 示例 3：动态更新数据

```typescript
// 重新设置数据后，按钮会自动显示第一项
this.comboBox.setData(newItems);

// 程序化设置选中项（不触发滚动）
this.comboBox.setSelected(2);
```

### 示例 4：清空数据

```typescript
// 清空数据，按钮回到默认状态（buttonRenderer 会被以 null 调用），面板自动收起
this.comboBox.clear();
```

### 示例 5：程序化控制面板

```typescript
// 主动展开/收起面板
this.comboBox.togglePanel();

// 判断当前是否展开
if (this.comboBox.isExpanded()) {
    // ...
}
```

## 🎯 注意事项

1. **节点绑定**  - `selectMenu`、`arrow`、`selectPanel`、`list` 必须在编辑器中正确绑定，否则面板无法展开

2. **Button 组件**  - `selectMenu` 节点必须添加 `Button` 组件以接收点击事件；列表项模板也需添加 `Button` 组件以支持选中

3. **LarkList 配置**  - 列表组件的 `selectedMode` 需设置为 `SINGLE`，`renderEvent` 与 `selectedEvent` 已由 `ComboBox` 内部接管，无需手动配置

4. **渲染回调必填**  - `buttonRenderer` 与 `itemRenderer` 必须设置，否则按钮与列表项不会显示内容

5. **itemHeight 一致性**  - `ComboBox` 的 `itemHeight` 应与列表项模板节点的实际高度保持一致，否则面板高度计算会不准确

6. **面板高度计算**  - 面板高度 = `min(数据数量, maxDisplayCount) * (itemHeight + itemGap) + topOffset + bottomOffset`

7. **数据驱动**  - 本组件基于虚拟列表，所有显示通过 `setData` 驱动，请勿直接操作 `list.numItems`

## 🔧 自定义样式

### 修改尺寸

在编辑器中直接修改 `ComboBox` 组件的属性：

```typescript
// 最大显示个数
comboBox.maxDisplayCount = 5;

// 单项高度
comboBox.itemHeight = 100;

// 上下内边距
comboBox.topOffset = 12;
comboBox.bottomOffset = 12;

// 项间隙
comboBox.itemGap = 8;
```

### 自定义按钮与列表项 UI

由于组件采用渲染回调模式，按钮与列表项的 UI 完全由业务方控制。你可以：

- 在 `buttonRenderer` 中修改按钮的文本、图标、颜色等
- 在 `itemRenderer` 中根据 `index` 为不同项设置不同样式
- 在列表项模板中同时配置 `select` 与 `unSelect` 两套显示，组件会自动切换

```typescript
// 自定义按钮渲染（含图标）
this.comboBox.buttonRenderer = (btnNode, item) => {
    btnNode.getChildByName('lblName').getComponent(Label).string = item.name;
    btnNode.getChildByName('lblId').getComponent(Label).string = item.id;
    // 更新图标...
};

// 自定义列表项渲染（含选中态）
this.comboBox.itemRenderer = (itemNode, data, index) => {
    const unSelect = itemNode.getChildByName('unSelect');
    const select = itemNode.getChildByName('select');

    // 同时更新选中态与未选中态的显示
    [unSelect, select].forEach(state => {
        state.getChildByName('lblName').getComponent(Label).string = data.name;
        state.getChildByName('lblId').getComponent(Label).string = data.id;
    });
};
```

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](https://github.com/jiangzhu7230581-oss/CCComboBox/blob/main/LICENSE) 文件

## 📮 联系方式

如有问题或建议，欢迎提交 Issue 或扫码联系。

<!-- 联系方式二维码（待补充） -->
<!-- <img src="contact-qr.png" width="200" alt="联系方式二维码" /> -->

## 🙏 致谢

- 虚拟列表内核参考了社区优秀的 LarkList 实现
- 基于 Cocos Creator 强大的引擎能力实现
