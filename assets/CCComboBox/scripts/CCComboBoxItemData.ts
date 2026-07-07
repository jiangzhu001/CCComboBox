import { _decorator, SpriteFrame } from 'cc';

const { ccclass, property } = _decorator;

/**
 * 下拉列表选项数据类
 *
 * 用于描述一个选项的展示与值信息，可通过 CCComboBox.items 数组在编辑器配置，
 * 也可在运行时通过 setItems / addItem 动态设置。
 */
@ccclass('CCComboBoxItemData')
export class CCComboBoxItemData {
    /** 显示文本 */
    @property
    public label: string = '';

    /** 关联值（类型安全：仅支持 string | number） */
    @property
    public value: string | number = '';

    /** 是否禁用此选项 */
    @property
    public disabled: boolean = false;

    /** 选项图标（可选，留空则不显示） */
    @property({ type: SpriteFrame })
    public icon: SpriteFrame | null = null;

    /** 用户自定义附加数据（不参与下拉列表业务逻辑，仅作扩展用） */
    @property
    public tag: unknown = null;

    constructor(
        label: string = '',
        value: string | number = '',
        opts: { disabled?: boolean; icon?: SpriteFrame | null; tag?: unknown } = {},
    ) {
        this.label = label;
        this.value = value;
        this.disabled = opts.disabled ?? false;
        this.icon = opts.icon ?? null;
        this.tag = opts.tag ?? null;
    }
}
