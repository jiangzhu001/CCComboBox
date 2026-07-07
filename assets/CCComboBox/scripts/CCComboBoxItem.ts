import { _decorator, Color, Label, Node, Sprite } from 'cc';
import ListItem from '../../script/list/ListItem';
import { CCComboBoxItemData } from './CCComboBoxItemData';

const { ccclass, property } = _decorator;

/**
 * 下拉列表选项项组件
 *
 * 继承自第三方 List 组件的 ListItem，复用其点击/选中管理逻辑，
 * 重写选中视觉为「整行背景色切换」，符合现代下拉列表 UI 习惯。
 *
 * 由 List 的 renderEvent 回调驱动 updateDisplay() 来刷新内容；
 * 由 ListItem.selected setter 驱动状态色切换。
 *
 * 节点结构要求（CCComboBoxItem.prefab）：
 *   CCComboBoxItem (Node + Button + CCComboBoxItem 组件)
 *   ├── Background (Sprite)  - 全填充，用于状态色
 *   ├── Icon (Sprite)        - 可选图标
 *   └── Label (Label)        - 选项文本
 */
@ccclass('CCComboBoxItem')
export class CCComboBoxItem extends ListItem {
    /** 文本组件引用 */
    @property({ type: Label, tooltip: '选项文本 Label 组件' })
    public labelNode: Label | null = null;

    /** 图标 Sprite 组件引用（可选） */
    @property({ type: Sprite, tooltip: '选项图标 Sprite 组件（可选）' })
    public iconSprite: Sprite | null = null;

    /** 背景 Sprite 组件引用（用于状态色切换） */
    @property({ type: Sprite, tooltip: '背景 Sprite 组件，用于状态色切换' })
    public backgroundSprite: Sprite | null = null;

    /** 正常状态背景色（透明） */
    @property
    public normalColor: Color = new Color(255, 255, 255, 0);

    /** 悬停状态背景色 #F5F7FA */
    @property
    public hoverColor: Color = new Color(245, 247, 250, 255);

    /** 选中状态背景色 #ECF5FF */
    @property
    public selectedColor: Color = new Color(236, 245, 255, 255);

    /** 禁用状态背景色（透明） */
    @property
    public disabledColor: Color = new Color(255, 255, 255, 0);

    /** 正常文字颜色 #606266 */
    @property
    public normalTextColor: Color = new Color(96, 98, 102, 255);

    /** 选中文字颜色 #409EFF */
    @property
    public selectedTextColor: Color = new Color(64, 158, 255, 255);

    /** 禁用文字颜色 #C0C4CC */
    @property
    public disabledTextColor: Color = new Color(192, 196, 204, 255);

    private _data: CCComboBoxItemData | null = null;
    private _isHovering: boolean = false;

    public onLoad(): void {
        // 注册触摸事件用于 hover 效果
        this.node.on(Node.EventType.MOUSE_ENTER, this._onMouseEnter, this);
        this.node.on(Node.EventType.MOUSE_LEAVE, this._onMouseLeave, this);
    }

    public onDestroy(): void {
        this.node.off(Node.EventType.MOUSE_ENTER, this._onMouseEnter, this);
        this.node.off(Node.EventType.MOUSE_LEAVE, this._onMouseLeave, this);
    }

    /**
     * 更新选项显示内容（由 List 的 renderEvent 回调触发）
     */
    public updateDisplay(data: CCComboBoxItemData): void {
        this._data = data;

        if (this.labelNode) {
            this.labelNode.string = data.label;
        }

        if (this.iconSprite) {
            if (data.icon) {
                this.iconSprite.spriteFrame = data.icon;
                this.iconSprite.node.active = true;
            } else {
                this.iconSprite.node.active = false;
            }
        }

        this._refreshAppearance();
    }

    /**
     * 获取当前数据
     */
    public get data(): CCComboBoxItemData | null {
        return this._data;
    }

    /**
     * 重写选中状态 setter：切换背景色与文字色
     * （父类 ListItem.selected 默认通过 selectedFlag 节点显示，不符合下拉列表视觉）
     */
    public override set selected(val: boolean) {
        (this as unknown as { _selected: boolean })._selected = val;
        this._refreshAppearance();
    }

    public override get selected(): boolean {
        return (this as unknown as { _selected: boolean })._selected;
    }

    private _onMouseEnter(): void {
        if (this._data?.disabled) return;
        this._isHovering = true;
        this._refreshAppearance();
    }

    private _onMouseLeave(): void {
        this._isHovering = false;
        this._refreshAppearance();
    }

    /**
     * 根据当前状态（选中/悬停/禁用）刷新背景与文字色
     */
    private _refreshAppearance(): void {
        if (!this._data) return;

        const isDisabled = this._data.disabled;
        const isSelected = this.selected;
        const isHover = this._isHovering && !isDisabled && !isSelected;

        // 背景色
        if (this.backgroundSprite) {
            let bg: Color;
            if (isDisabled) bg = this.disabledColor;
            else if (isSelected) bg = this.selectedColor;
            else if (isHover) bg = this.hoverColor;
            else bg = this.normalColor;
            this.backgroundSprite.color = bg;
        }

        // 文字色
        if (this.labelNode) {
            let tc: Color;
            if (isDisabled) tc = this.disabledTextColor;
            else if (isSelected) tc = this.selectedTextColor;
            else tc = this.normalTextColor;
            this.labelNode.color = tc;
        }
    }
}
