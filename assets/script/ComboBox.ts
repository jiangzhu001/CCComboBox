import { _decorator, CCInteger, Component, Node, tween, Vec3, UITransform, CCFloat } from "cc";
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

    /** 面板展开状态 */
    private _isExpanded: boolean = false;

    /** 数据列表 */
    private _items: T[] = [];

    /** 箭头原始旋转角度 */
    private _arrowOriginalRotation: number = 0;

    /** 按钮内容渲染回调（item 为 null 时表示显示默认状态） */
    buttonRenderer: ButtonRenderCallback<T> | null = null;

    /** 列表项渲染回调 */
    itemRenderer: ListItemRenderCallback<T> | null = null;

    onLoad() {
        this._initUI();
    }

    onDestroy() {
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

        // 更新面板高度
        this._updatePanelHeight();

        // 箭头旋转动画
        this._animateArrow(true);

        // 刷新列表
        this._refreshList();
    }

    /** 收起面板 */
    private _collapsePanel() {
        if (!this.selectPanel) return;

        this._isExpanded = false;
        this.selectPanel.active = false;

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

    /** 更新面板高度 */
    private _updatePanelHeight() {
        if (!this.selectPanel) return;

        const count = this._items.length > 0 ? Math.min(this._items.length, this.maxDisplayCount) : this.maxDisplayCount;
        const height = (count * (this.itemHeight + this.itemGap)) + this.topOffset + this.bottomOffset;

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
}