import {
    _decorator,
    Component,
    EditBox,
    EventHandler,
    EventTouch,
    find,
    input,
    Input,
    KeyCode,
    Label,
    Node,
    tween,
    UIOpacity,
    UITransform,
    Vec3,
} from 'cc';
import List, { SelectedType } from '../../script/list/List';
import { CCComboBoxItem } from './CCComboBoxItem';
import { CCComboBoxItemData } from './CCComboBoxItemData';
import { CCComboBoxEvent } from './CCComboBoxEvent';

const { ccclass, property } = _decorator;

/**
 * CCComboBox - Cocos Creator 下拉列表组件
 *
 * 基于第三方 List 虚拟列表实现，支持：
 *  · 单选 + 选中态视觉
 *  · 搜索过滤
 *  · 选项图标
 *  · 键盘导航（↑↓/Enter/Esc）
 *  · 点击外部自动关闭
 *  · 展开/收起动画
 *  · 滚动到选中项
 *  · 1000+ 数据虚拟渲染
 *
 * 使用方式：将 CCComboBox.prefab 拖入场景，设置 items 或调用 setItems() 即可。
 * 事件监听：comboBox.node.on(CCComboBoxEvent.SELECTED_CHANGED, cb, target)
 */
@ccclass('CCComboBox')
export class CCComboBox extends Component {
    // ==================== 数据属性 ====================
    @property({ type: [CCComboBoxItemData], tooltip: '选项数据列表' })
    public items: CCComboBoxItemData[] = [];

    @property({ tooltip: '当前选中索引，-1 表示未选中' })
    public selectedIndex: number = -1;

    @property({ tooltip: '未选中时显示的占位文本' })
    public placeholder: string = '请选择';

    @property({
        tooltip: '最大可见选项数量，超出后滚动。下拉面板高度 = 此值 × 选项高度',
        range: [3, 20, 1],
    })
    public maxVisibleItems: number = 6;

    @property({ tooltip: '是否启用搜索框' })
    public searchable: boolean = true;

    @property({ tooltip: '是否禁用整个下拉列表' })
    public disabled: boolean = false;

    // ==================== UI 节点引用 ====================
    @property({ type: Node, tooltip: '触发按钮节点（点击展开/收起）' })
    public buttonNode: Node | null = null;

    @property({ type: Label, tooltip: '显示选中项文本的 Label' })
    public selectedLabel: Label | null = null;

    @property({ type: Label, tooltip: '占位文本 Label（独立节点，颜色淡）' })
    public placeholderLabel: Label | null = null;

    @property({ type: Node, tooltip: '下拉箭头节点，展开时旋转 180°' })
    public arrowNode: Node | null = null;

    @property({ type: Node, tooltip: '下拉面板容器节点（默认 active=false）' })
    public dropDownNode: Node | null = null;

    @property({ type: EditBox, tooltip: '搜索输入框组件' })
    public searchEditBox: EditBox | null = null;

    @property({ type: List, tooltip: '第三方 List 组件引用（虚拟列表）' })
    public list: List | null = null;

    @property({ type: Node, tooltip: '搜索无结果时显示的"无匹配项"提示节点' })
    public emptyLabel: Node | null = null;

    // ==================== 内部状态 ====================
    private _isExpanded: boolean = false;
    private _filteredItems: CCComboBoxItemData[] = [];
    private _itemHeight: number = 40;
    private _ignoreNextGlobalClick: boolean = false;
    private _canvasNode: Node | null = null;

    // ==================== 生命周期 ====================
    protected onLoad(): void {
        this._canvasNode = find('Canvas');
        this._filteredItems = [...this.items];

        // 读取 item 高度（用于动态计算下拉面板高度）
        this._itemHeight = this._resolveItemHeight();

        this._initUI();
        this._initList();
        this._updateDisplay();
    }

    protected onDestroy(): void {
        this._unregisterButtonEvent();
        this._unregisterSearchEvent();
        this._unregisterGlobalClick();
        this._unregisterKeyboardEvent();
        this._unregisterListEvents();
    }

    // ==================== 公共 API ====================

    /** 获取当前选中项数据 */
    public get selectedItem(): CCComboBoxItemData | null {
        if (this.selectedIndex >= 0 && this.selectedIndex < this.items.length) {
            return this.items[this.selectedIndex];
        }
        return null;
    }

    /** 获取当前选中项的值 */
    public get selectedValue(): string | number | null {
        return this.selectedItem?.value ?? null;
    }

    /**
     * 通过索引设置选中项
     * @param index      目标索引（-1 表示清除选择）
     * @param emitEvent  是否派发 SELECTED_CHANGED 事件
     */
    public setSelectedIndex(index: number, emitEvent: boolean = true): void {
        if (index < -1 || index >= this.items.length) return;

        const oldIndex = this.selectedIndex;
        this.selectedIndex = index;

        // 同步 List 的 selectedId（仅当面板已展开时，List 才存在可见 item）
        if (this.list && this._isExpanded) {
            const filteredIndex = index >= 0 ? this._filteredItems.indexOf(this.items[index]) : -1;
            if (filteredIndex >= 0) {
                this.list.selectedId = filteredIndex;
            }
        }

        this._updateDisplay();

        if (emitEvent && oldIndex !== index) {
            this.node.emit(CCComboBoxEvent.SELECTED_CHANGED, this.selectedIndex, this.selectedItem);
        }
    }

    /**
     * 通过值设置选中项
     */
    public setSelectedByValue(value: string | number, emitEvent: boolean = true): void {
        const index = this.items.findIndex(item => item.value === value);
        if (index !== -1) {
            this.setSelectedIndex(index, emitEvent);
        }
    }

    /**
     * 设置选项数据
     * @param items         新选项数组
     * @param keepSelection 是否保留当前选择（若索引失效则清除）
     */
    public setItems(items: CCComboBoxItemData[], keepSelection: boolean = false): void {
        this.items = items;
        this._filteredItems = [...items];

        if (!keepSelection || this.selectedIndex >= items.length) {
            this.selectedIndex = -1;
        }

        if (this._isExpanded) {
            this._refreshList();
        }
        this._updateDisplay();
    }

    /**
     * 添加一个选项
     */
    public addItem(item: CCComboBoxItemData): void {
        this.items.push(item);
        this._filteredItems.push(item);
        if (this._isExpanded) {
            this._refreshList();
        }
    }

    /**
     * 移除指定索引的选项
     */
    public removeItem(index: number): void {
        if (index < 0 || index >= this.items.length) return;

        const wasSelected = this.selectedIndex === index;
        this.items.splice(index, 1);
        this._filteredItems = this._filteredItems.filter(it => it !== this.items[index]);

        // 调整选中索引
        if (wasSelected) {
            this.selectedIndex = -1;
        } else if (this.selectedIndex > index) {
            this.selectedIndex--;
        }

        if (this._isExpanded) {
            this._refreshList();
        }
        this._updateDisplay();
    }

    /**
     * 清空所有选项
     */
    public clearItems(): void {
        this.items = [];
        this._filteredItems = [];
        this.selectedIndex = -1;

        if (this._isExpanded) {
            this._refreshList();
        }
        this._updateDisplay();
    }

    /** 展开下拉列表 */
    public expand(): void {
        if (this._isExpanded || this.disabled) return;

        this._isExpanded = true;

        // 重置过滤
        this._filteredItems = [...this.items];
        if (this.searchEditBox) {
            this.searchEditBox.string = '';
        }

        // 显示面板
        if (this.dropDownNode) {
            this.dropDownNode.active = true;
            // 面板淡入动画（使用 UIOpacity 组件控制透明度）
            const opacityComp = this._ensureUIOpacity(this.dropDownNode);
            this.dropDownNode.setScale(1, 0.92, 1);
            opacityComp.opacity = 0;
            tween(opacityComp)
                .to(0.18, { opacity: 255 })
                .start();
            tween(this.dropDownNode)
                .to(0.18, { scale: new Vec3(1, 1, 1) })
                .start();
        }

        // 箭头旋转
        if (this.arrowNode) {
            tween(this.arrowNode)
                .to(0.2, { eulerAngles: new Vec3(0, 0, 180) })
                .start();
        }

        // 刷新列表
        this._refreshList();

        // 滚动到选中项
        if (this.selectedIndex >= 0 && this.list) {
            const filteredIndex = this._filteredItems.indexOf(this.items[this.selectedIndex]);
            if (filteredIndex >= 0) {
                this.list.selectedId = filteredIndex;
                // 延迟一帧滚动，等待 List 完成布局
                this.scheduleOnce(() => {
                    this.list?.scrollTo(filteredIndex, 0.2);
                }, 0);
            }
        }

        // 聚焦搜索框
        if (this.searchable && this.searchEditBox) {
            this.scheduleOnce(() => this.searchEditBox?.focus(), 0.1);
        }

        this.node.emit(CCComboBoxEvent.DROPDOWN_OPEN);

        // 注册全局点击与键盘事件（延迟一帧，避免立即触发关闭）
        this._ignoreNextGlobalClick = true;
        this.scheduleOnce(() => {
            this._ignoreNextGlobalClick = false;
            this._registerGlobalClick();
            this._registerKeyboardEvent();
        }, 0);
    }

    /** 收起下拉列表 */
    public collapse(): void {
        if (!this._isExpanded) return;

        this._isExpanded = false;
        this._unregisterGlobalClick();
        this._unregisterKeyboardEvent();

        if (this.dropDownNode) {
            const opacityComp = this.dropDownNode.getComponent(UIOpacity);
            if (opacityComp) {
                tween(opacityComp)
                    .to(0.15, { opacity: 0 })
                    .start();
            }
            tween(this.dropDownNode)
                .to(0.15, { scale: new Vec3(1, 0.92, 1) })
                .call(() => {
                    if (this.dropDownNode) this.dropDownNode.active = false;
                })
                .start();
        }

        if (this.arrowNode) {
            tween(this.arrowNode)
                .to(0.2, { eulerAngles: new Vec3(0, 0, 0) })
                .start();
        }

        this.node.emit(CCComboBoxEvent.DROPDOWN_CLOSE);
    }

    /** 切换展开/收起状态 */
    public toggle(): void {
        if (this._isExpanded) this.collapse();
        else this.expand();
    }

    // ==================== 私有方法 ====================

    /**
     * 探测单个选项高度：优先用 List 模板节点的 UITransform.height，否则用默认值 40
     */
    private _resolveItemHeight(): number {
        // List 组件的 tmpNode / tmpPrefab 是模板，无法在 onLoad 时直接读到尺寸
        // 这里使用一个属性默认值；若实际 item 高度不同，可由预制体配置覆盖
        // （List 内部会基于真实模板尺寸计算布局，此值仅用于估算面板高度）
        return 40;
    }

    private _initUI(): void {
        if (this.dropDownNode) {
            this.dropDownNode.active = false;
        }
        if (this.emptyLabel) {
            this.emptyLabel.active = false;
        }
        if (this.placeholderLabel) {
            this.placeholderLabel.node.active = true;
        }
        if (this.selectedLabel) {
            this.selectedLabel.node.active = false;
        }
        if (this.searchEditBox && !this.searchable) {
            this.searchEditBox.node.active = false;
        }

        // 动态设置 List 节点高度 = maxVisibleItems × itemHeight
        if (this.list) {
            const listUt = this.list.node.getComponent(UITransform);
            if (listUt) {
                listUt.setContentSize(listUt.width, this.maxVisibleItems * this._itemHeight);
            }
        }

        this._registerButtonEvent();
        this._registerSearchEvent();
    }

    private _initList(): void {
        if (!this.list) {
            console.warn('[CCComboBox] 未绑定 List 组件，下拉列表将无法工作');
            return;
        }

        // 配置 List 为单选模式 + 虚拟列表
        this.list.selectedMode = SelectedType.SINGLE;
        this.list.virtual = true;
        this.list.repeatEventSingle = true; // 允许重复点击同一项触发事件（用于外部业务）

        // 注册 renderEvent 与 selectedEvent（EventHandler 方式）
        this._registerListEvents();

        // 初始化数据条数
        this.list.numItems = this._filteredItems.length;
    }

    private _registerListEvents(): void {
        if (!this.list) return;

        // renderEvent：List 在需要渲染某个 item 时回调
        const renderHandler = new EventHandler();
        renderHandler.target = this.node;
        renderHandler.component = 'CCComboBox';
        renderHandler.handler = 'onItemRender';
        this.list.renderEvent = renderHandler;

        // selectedEvent：选中项变化时回调
        const selectedHandler = new EventHandler();
        selectedHandler.target = this.node;
        selectedHandler.component = 'CCComboBox';
        selectedHandler.handler = 'onItemSelected';
        this.list.selectedEvent = selectedHandler;
    }

    private _unregisterListEvents(): void {
        // EventHandler 是值类型，无需反注册
    }

    /**
     * List 的 renderEvent 回调
     * 签名：(item: Node, listId: number) => void
     * 注意：listId 是过滤后的索引
     */
    public onItemRender(item: Node, listId: number): void {
        const data = this._filteredItems[listId];
        if (!data) return;

        const itemComp = item.getComponent(CCComboBoxItem);
        if (itemComp) {
            itemComp.updateDisplay(data);
        }
    }

    /**
     * List 的 selectedEvent 回调
     * 签名：(item: Node, listId: number, oldListId?: number) => void
     * listId 是过滤后列表中的索引，需映射回原始 items 索引
     */
    public onItemSelected(_item: Node, listId: number): void {
        const filteredData = this._filteredItems[listId];
        if (!filteredData || filteredData.disabled) {
            // 禁用项不响应选中
            return;
        }

        const originalIndex = this.items.indexOf(filteredData);
        if (originalIndex < 0) return;

        const oldIndex = this.selectedIndex;
        this.selectedIndex = originalIndex;
        this._updateDisplay();

        if (oldIndex !== originalIndex) {
            this.node.emit(CCComboBoxEvent.SELECTED_CHANGED, this.selectedIndex, this.selectedItem);
        }

        // 选中后自动收起
        this.collapse();
    }

    private _registerButtonEvent(): void {
        if (this.buttonNode) {
            this.buttonNode.on(Node.EventType.TOUCH_END, this._onButtonClicked, this);
        }
    }

    private _unregisterButtonEvent(): void {
        if (this.buttonNode) {
            this.buttonNode.off(Node.EventType.TOUCH_END, this._onButtonClicked, this);
        }
    }

    private _onButtonClicked(event: EventTouch): void {
        event.propagationStopped = true;
        if (this.disabled) return;
        this.toggle();
    }

    private _registerSearchEvent(): void {
        if (this.searchEditBox) {
            this.searchEditBox.node.on('text-changed', this._onSearchTextChanged, this);
        }
    }

    private _unregisterSearchEvent(): void {
        if (this.searchEditBox) {
            this.searchEditBox.node.off('text-changed', this._onSearchTextChanged, this);
        }
    }

    private _onSearchTextChanged(editBox: EditBox): void {
        const searchText = editBox.string.trim().toLowerCase();

        if (searchText === '') {
            this._filteredItems = [...this.items];
        } else {
            this._filteredItems = this.items.filter(item =>
                item.label.toLowerCase().includes(searchText)
            );
        }

        this._refreshList();
        this.node.emit(CCComboBoxEvent.SEARCH_CHANGED, searchText);
    }

    /**
     * 刷新 List 的数据条数与选中态
     */
    private _refreshList(): void {
        if (!this.list) return;

        this.list.numItems = this._filteredItems.length;

        // 更新空状态提示
        if (this.emptyLabel) {
            this.emptyLabel.active = this._filteredItems.length === 0;
        }

        // 同步选中态到过滤后的索引
        if (this.selectedIndex >= 0) {
            const filteredIndex = this._filteredItems.indexOf(this.items[this.selectedIndex]);
            if (filteredIndex >= 0) {
                this.list.selectedId = filteredIndex;
            }
        }
    }

    private _updateDisplay(): void {
        const hasSelection = this.selectedIndex >= 0 && this.selectedIndex < this.items.length;

        if (this.placeholderLabel) {
            this.placeholderLabel.node.active = !hasSelection;
        }
        if (this.selectedLabel) {
            this.selectedLabel.node.active = hasSelection;
            if (hasSelection) {
                this.selectedLabel.string = this.items[this.selectedIndex].label;
            }
        }
    }

    // ==================== 全局点击关闭 ====================

    /**
     * 确保节点上有 UIOpacity 组件（用于淡入淡出动画）
     */
    private _ensureUIOpacity(node: Node): UIOpacity {
        return node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
    }

    private _registerGlobalClick(): void {
        if (!this._canvasNode) return;
        this._canvasNode.on(Node.EventType.TOUCH_END, this._onGlobalClick, this);
    }

    private _unregisterGlobalClick(): void {
        if (!this._canvasNode) return;
        this._canvasNode.off(Node.EventType.TOUCH_END, this._onGlobalClick, this);
    }

    private _onGlobalClick(event: EventTouch): void {
        if (this._ignoreNextGlobalClick) return;

        const target = event.target as Node;
        if (this._isNodeInside(target, this.node)) {
            return;
        }
        this.collapse();
    }

    private _isNodeInside(child: Node | null, parent: Node): boolean {
        let node: Node | null = child;
        while (node) {
            if (node === parent) return true;
            node = node.parent;
        }
        return false;
    }

    // ==================== 键盘导航 ====================

    private _registerKeyboardEvent(): void {
        input.on(Input.EventType.KEY_DOWN, this._onKeyDown, this);
    }

    private _unregisterKeyboardEvent(): void {
        input.off(Input.EventType.KEY_DOWN, this._onKeyDown, this);
    }

    private _onKeyDown(event: any): void {
        if (!this._isExpanded) return;

        switch (event.keyCode) {
            case KeyCode.ARROW_DOWN:
                this._moveSelection(1);
                event.propagationStopped = true;
                break;
            case KeyCode.ARROW_UP:
                this._moveSelection(-1);
                event.propagationStopped = true;
                break;
            case KeyCode.ENTER:
                if (this.selectedIndex >= 0) {
                    this.collapse();
                }
                event.propagationStopped = true;
                break;
            case KeyCode.ESCAPE:
                this.collapse();
                event.propagationStopped = true;
                break;
        }
    }

    /**
     * 键盘上下移动选中项（跳过禁用项）
     */
    private _moveSelection(delta: number): void {
        if (this.items.length === 0) return;

        let nextIndex = this.selectedIndex;
        const step = delta > 0 ? 1 : -1;
        const limit = this.items.length;

        for (let i = 0; i < limit; i++) {
            nextIndex += step;
            if (nextIndex < 0) { nextIndex = 0; break; }
            if (nextIndex >= this.items.length) { nextIndex = this.items.length - 1; break; }
            if (!this.items[nextIndex].disabled) break;
        }

        if (nextIndex !== this.selectedIndex) {
            this.setSelectedIndex(nextIndex, true);
            // 滚动到新选中项
            if (this.list && this._isExpanded) {
                const filteredIndex = this._filteredItems.indexOf(this.items[nextIndex]);
                if (filteredIndex >= 0) {
                    this.list.scrollTo(filteredIndex, 0.15);
                }
            }
        }
    }
}
