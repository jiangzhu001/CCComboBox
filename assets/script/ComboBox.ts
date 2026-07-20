import { _decorator, CCInteger, Component, Node, tween, Vec3, UITransform, CCFloat, EventTouch, Rect, Vec2, Graphics, Color, UIOpacity, v3 } from "cc";
import { ViewUtil } from "./ViewUtil";
import List from "./list/List";

const { ccclass, property, menu } = _decorator;

/** 按钮内容渲染回调（item 为 null 时表示显示默认状态） */
export type ButtonRenderCallback<T> = (btnNode: Node, item: T | null) => void;

/** 列表项渲染回调 */
export type ListItemRenderCallback<T> = (itemNode: Node, item: T, index: number) => void;

/**
 * 下拉框组件
 * 
 * 功能：
 * 1. 点击 selectMenu 展开/收起 selectPanel
 * 2. 选择后自动收起面板并更新显示内容
 * 3. 根据最大显示个数动态设置面板高度
 * 4. 提供泛型数据设置接口
 * 5. 通过渲染回调让业务方自定义 UI 更新逻辑
 *
 * 使用：
 * 1. 将此组件挂载在 comboBox 预制体根节点
 * 2. 在编辑器中配置各节点引用
 * 3. selectMenu 节点需添加 Button 组件
 * 4. list 的 item 模板需添加 Button 和 LarkListItem 组件（用于单选功能）
 * 5. 调用 setData() 方法设置列表数据
 * 6. 必须设置 buttonRenderer 和 itemRenderer 回调
 */
@ccclass('ComboBox')
@menu('Game/UI/ComboBox（下拉框）')
export class ComboBox<T = any> extends Component {
    @property({ type: Node, tooltip: "触发按钮节点（需添加 Button 组件）" })
    selectMenu: Node = null;

    @property({ type: Node, tooltip: "箭头图标节点（展开时旋转）" })
    arrow: Node = null;

    @property({ type: Node, tooltip: "下拉面板节点" })
    selectPanel: Node = null;

    @property({ type: List, tooltip: "LarkList 列表组件" })
    list: List = null;

    @property({ type: CCFloat, tooltip: "最大显示个数" })
    maxDisplayCount: number = 5;

    @property({ type: CCInteger, tooltip: "单项高度（像素）" })
    itemHeight: number = 100;

    @property({ type: CCInteger, tooltip: "顶部偏移量（像素）" })
    topOffset: number = 12;

    @property({ type: CCInteger, tooltip: "底部偏移量（像素）" })
    bottomOffset: number = 12;

    @property({ type: CCInteger, tooltip: "列表项间隙距离（像素）" })
    itemGap: number = 8;

    /** 触摸事件监听节点（用于检测点击外部区域关闭面板，未设置时使用 this.node） */
    touchTarget: Node = null;

    /** 面板展开状态 */
    private _isExpanded: boolean = false;

    /** 数据列表 */
    private _items: T[] = [];

    /** 箭头原始旋转角度 */
    private _arrowOriginalRotation: number = 0;

    /** 调试节点 - 按钮区域 */
    private _debugButtonNode: Node | null = null;

    /** 调试节点 - 面板区域 */
    private _debugPanelNode: Node | null = null;

    /** 按钮内容渲染回调（item 为 null 时表示显示默认状态） */
    buttonRenderer: ButtonRenderCallback<T> | null = null;

    /** 列表项渲染回调 */
    itemRenderer: ListItemRenderCallback<T> | null = null;

    onLoad() {
        this._initUI();
    }

    onDestroy() {
        // 清理全局事件监听
        const target = this.touchTarget || this.node;
        if (target) {
            target.off(Node.EventType.TOUCH_START, this._onGlobalTouchStart, this, true);
        }

        // 清理调试节点
        // this._removeDebugAreas();
    }

    /** 初始化 UI 状态 */
    private _initUI() {
        // 默认收起面板
        if (this.selectPanel) {
            this.selectPanel.active = false;
        }

        // 记录箭头原始角度
        if (this.arrow) {
            this._arrowOriginalRotation = this.arrow.eulerAngles.z;
        }
    }

    /** selectMenu 点击处理 */
    private onSelectMenuClick() {
        this.togglePanel();
    }

    /** 切换面板展开/收起 */
    togglePanel() {
        if (this._isExpanded) {
            this._collapsePanel();
        } else {
            this._expandPanel();
        }
    }

    /** 展开面板 */
    private _expandPanel() {
        if (!this.selectPanel || !this.list) return;

        this._isExpanded = true;
        this.selectPanel.active = true;

        // 在 touchTarget 上注册触摸事件监听
        const target = this.touchTarget || this.node;
        if (target) {
            target.on(Node.EventType.TOUCH_START, this._onGlobalTouchStart, this, true);
        }

        // 更新面板高度
        this._updatePanelHeight();

        // 箭头旋转动画
        this._animateArrow(true);

        // 刷新列表
        this._refreshList();

        // 创建调试可视化区域（在更新UI后）
        // this._createDebugAreas();
    }

    /** 收起面板 */
    private _collapsePanel() {
        if (!this.selectPanel) return;

        this._isExpanded = false;
        this.selectPanel.active = false;

        // 从 touchTarget 移除触摸事件监听
        const target = this.touchTarget || this.node;
        if (target) {
            target.off(Node.EventType.TOUCH_START, this._onGlobalTouchStart, this, true);
        }

        // 移除调试可视化区域
        // this._removeDebugAreas();

        // 箭头旋转动画
        this._animateArrow(false);
    }

    /** 箭头旋转动画 */
    private _animateArrow(expanded: boolean) {
        if (!this.arrow) return;

        const targetAngle = expanded ? this._arrowOriginalRotation + 180 : this._arrowOriginalRotation;
        tween(this.arrow)
            .to(0.2, { eulerAngles: new Vec3(0, 0, targetAngle) })
            .start();
    }

    /**
     * 全局触摸开始事件处理
     * [EN] Global touch start event handler
     */
    private _onGlobalTouchStart(event: EventTouch) {
        if (!this._isExpanded || !this.selectPanel) return;

        // 获取点击位置（UI坐标）
        const touchPos = event.getUILocation();

        // 判断是否点击在 selectPanel 区域内
        if (this._isPointInPanel(touchPos)) {
            // 点击在面板内，不做处理（让 List 处理）
            return;
        }

        // 判断是否点击在 selectMenu 按钮上
        if (this._isPointInButton(touchPos)) {
            // 点击在按钮上，不做处理（让按钮处理）
            return;
        }

        // 点击在空白区域，收起面板
        this._collapsePanel();
    }

    /**
     * 判断点是否在面板区域内
     * [EN] Check if point is in panel area
     */
    private _isPointInPanel(pos: Vec2): boolean {
        if (!this.selectPanel) return false;

        const uiTransform = this.selectPanel.getComponent(UITransform);
        if (!uiTransform) return false;

        // 获取面板的世界坐标（锚点位置）
        const panelWorldPos = this.selectPanel.getWorldPosition();
        const panelSize = uiTransform.contentSize;

        // 获取锚点
        const anchorX = uiTransform.anchorX;
        const anchorY = uiTransform.anchorY;

        // 构建面板的矩形区域（考虑锚点）
        const rect = new Rect(
            panelWorldPos.x - panelSize.width * anchorX,
            panelWorldPos.y - panelSize.height * anchorY,
            panelSize.width,
            panelSize.height
        );

        return rect.contains(pos);
    }

    /**
     * 判断点是否在按钮区域内
     * [EN] Check if point is in button area
     */
    private _isPointInButton(pos: Vec2): boolean {
        if (!this.selectMenu) return false;

        const uiTransform = this.selectMenu.getComponent(UITransform);
        if (!uiTransform) return false;

        // 获取按钮的世界坐标（锚点位置）
        const buttonWorldPos = this.selectMenu.getWorldPosition();
        const buttonSize = uiTransform.contentSize;

        // 获取锚点
        const anchorX = uiTransform.anchorX;
        const anchorY = uiTransform.anchorY;

        // 构建按钮的矩形区域（考虑锚点）
        const rect = new Rect(
            buttonWorldPos.x - buttonSize.width * anchorX,
            buttonWorldPos.y - buttonSize.height * anchorY,
            buttonSize.width,
            buttonSize.height
        );

        return rect.contains(pos);
    }

    /**
     * 创建调试可视化区域
     * [EN] Create debug visualization areas
     */
    private _createDebugAreas() {
        if (!this.node) return;

        // 创建按钮调试区域（红色半透明）
        if (this.selectMenu) {
            this._debugButtonNode = this._createDebugRect(
                this.selectMenu,
                new Color(255, 0, 0, 80),  // 红色，半透明
                "DebugButtonArea"
            );
            if (this._debugButtonNode) {
                this.node.addChild(this._debugButtonNode);
            }
        }

        // 创建面板调试区域（蓝色半透明）
        if (this.selectPanel) {
            this._debugPanelNode = this._createDebugRect(
                this.selectPanel,
                new Color(0, 0, 255, 80),  // 蓝色，半透明
                "DebugPanelArea"
            );
            if (this._debugPanelNode) {
                this.node.addChild(this._debugPanelNode);
            }
        }
    }

    /**
     * 创建调试矩形节点
     * [EN] Create debug rectangle node
     */
    private _createDebugRect(targetNode: Node, color: Color, name: string): Node | null {
        const uiTransform = targetNode.getComponent(UITransform);
        if (!uiTransform || !this.node) return null;

        // 创建节点
        const debugNode = new Node(name);

        // 添加 UITransform 组件
        const debugTransform = debugNode.addComponent(UITransform);
        const size = uiTransform.contentSize;
        debugTransform.setContentSize(size);

        // 设置与目标节点相同的锚点
        const anchorX = uiTransform.anchorX;
        const anchorY = uiTransform.anchorY;
        debugTransform.setAnchorPoint(anchorX, anchorY);

        // 添加 Graphics 组件绘制矩形
        const graphics = debugNode.addComponent(Graphics);

        // 设置填充颜色
        graphics.fillColor = color;

        // 绘制矩形（考虑锚点）
        const width = size.width;
        const height = size.height;
        // 矩形起点应该是左下角，相对于锚点的位置
        const rectX = -width * anchorX;
        const rectY = -height * anchorY;
        graphics.rect(rectX, rectY, width, height);
        graphics.fill();

        // 添加 UIOpacity 组件（确保半透明效果）
        debugNode.addComponent(UIOpacity);

        // 使用 ViewUtil 将目标节点坐标转换到 oops.gui.root 的本地坐标系
        const localPosInRoot = ViewUtil.calculateASpaceToBSpacePos(
            targetNode,
            this.node,
            v3(0, 0, 0)
        );

        // 调试日志
        console.log(`[ComboBox Debug] ${name}: localPos=(${localPosInRoot.x}, ${localPosInRoot.y}), size=(${width}, ${height}), anchor=(${anchorX}, ${anchorY})`);

        // 设置本地坐标
        debugNode.setPosition(localPosInRoot);

        // 设置层级（确保在最上层）
        debugNode.setSiblingIndex(9999);

        return debugNode;
    }

    /**
     * 移除调试可视化区域
     * [EN] Remove debug visualization areas
     */
    private _removeDebugAreas() {
        if (this._debugButtonNode) {
            this._debugButtonNode.destroy();
            this._debugButtonNode = null;
        }

        if (this._debugPanelNode) {
            this._debugPanelNode.destroy();
            this._debugPanelNode = null;
        }
    }

    /** 更新面板高度 */
    private _updatePanelHeight() {
        if (!this.selectPanel) return;

        const count = this._items.length > 0 ? Math.min(this._items.length, this.maxDisplayCount) : this.maxDisplayCount;
        const height = count * (this.itemHeight) + (count - 1) * this.itemGap + this.topOffset + this.bottomOffset;

        const ut = this.selectPanel.getComponent(UITransform);
        if (ut) {
            ut.setContentSize(ut.width, height);
        }
    }

    /** 刷新列表 */
    private _refreshList() {
        if (!this.list) return;

        this.list.numItems = this._items.length;
    }

    /** 列表项渲染 */
    private onItemRender(item: Node, index: number) {
        if (!item || index >= this._items.length) return;

        const data = this._items[index];

        // 调用业务方的渲染回调
        if (this.itemRenderer) {
            this.itemRenderer(item, data, index);
        }
    }

    /** 列表项选中处理（由 LarkList 的 selectedEvent 触发） */
    private onItemSelected(item: Node, index: number) {
        if (index < 0 || index >= this._items.length || isNaN(index)) return;

        // 调用业务方的按钮渲染回调
        if (this.buttonRenderer && this.selectMenu) {
            this.buttonRenderer(this.selectMenu, this._items[index]);
        }

        // 收起面板
        this._collapsePanel();
    }

    // ==================== 公共接口 ====================

    /**
     * 设置数据列表
     * @param items 数据项数组
     */
    setData(items: T[]): void {
        this._items = items || [];

        // 更新按钮显示
        if (this.buttonRenderer && this.selectMenu) {
            this.buttonRenderer(this.selectMenu, this._items[0]);
        }

        // 如果面板已展开，刷新列表
        if (this._isExpanded) {
            this._updatePanelHeight();
            this._refreshList();
        }
    }

    /**
     * 设置默认选中项
     * @param index 选中索引
     */
    setSelected(index: number): void {
        if (index < 0 || index >= this._items.length) return;

        this.list.selectedId = index;

        // 更新按钮显示
        if (this.buttonRenderer && this.selectMenu) {
            this.buttonRenderer(this.selectMenu, this._items[index]);
        }
    }

    /**
     * 获取当前选中信息
     * @returns 选中信息对象，未选中时返回 null
     */
    getSelected(): { index: number; item: T } | null {
        if (this.list.selectedId < 0 || this.list.selectedId >= this._items.length) {
            return null;
        }

        return {
            index: this.list.selectedId,
            item: this._items[this.list.selectedId]
        };
    }

    /**
     * 获取当前选中索引
     * @returns 选中索引，未选中时返回 -1
     */
    getSelectedIndex(): number {
        return this.list.selectedId;
    }

    /**
     * 获取当前选中项的数据
     * @returns 选中项的数据，未选中时返回 undefined
     */
    getSelectedItem(): T | undefined {
        const selected = this.getSelected();
        return selected ? selected.item : undefined;
    }

    /**
     * 获取所有数据项
     * @returns 数据项数组
     */
    getItems(): T[] {
        return this._items;
    }

    /**
     * 判断面板是否展开
     * @returns 展开状态
     */
    isExpanded(): boolean {
        return this._isExpanded;
    }

    /**
     * 清空数据
     */
    clear(): void {
        this._items = [];

        // 重置按钮显示为默认状态
        if (this.buttonRenderer && this.selectMenu) {
            this.buttonRenderer(this.selectMenu, null);
        }

        if (this._isExpanded) {
            this._collapsePanel();
        }
    }

    /**
     * 设置触摸事件监听节点
     * @param node 触摸事件监听节点（用于检测点击外部区域关闭面板）
     */
    setTouchTarget(node: Node): void {
        this.touchTarget = node;
    }
}