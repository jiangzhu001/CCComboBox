/**
 * CCComboBox 事件名枚举
 *
 * 全部使用枚举常量，避免硬编码字符串。
 * 监听方式：comboBox.node.on(CCComboBoxEvent.SELECTED_CHANGED, cb, target);
 */
export enum CCComboBoxEvent {
    /** 选中项变化事件 · 回调签名：(index: number, itemData: CCComboBoxItemData) => void */
    SELECTED_CHANGED = 'selected-changed',

    /** 下拉面板展开事件 · 回调签名：() => void */
    DROPDOWN_OPEN = 'dropdown-open',

    /** 下拉面板关闭事件 · 回调签名：() => void */
    DROPDOWN_CLOSE = 'dropdown-close',

    /** 搜索文本变化事件 · 回调签名：(searchText: string) => void */
    SEARCH_CHANGED = 'search-changed',
}
