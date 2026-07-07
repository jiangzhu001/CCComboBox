import { _decorator, Component, Label, Node, tween, Vec3 } from 'cc';
import { CCComboBox } from '../CCComboBox/scripts/CCComboBox';
import { CCComboBoxEvent } from '../CCComboBox/scripts/CCComboBoxEvent';
import { CCComboBoxItemData } from '../CCComboBox/scripts/CCComboBoxItemData';

const { ccclass, property } = _decorator;

/**
 * CCComboBox 测试脚本
 *
 * 验证内容：
 *  · 基本选中/切换
 *  · 大数据量虚拟列表（1000 项）
 *  · 搜索过滤
 *  · 图标显示
 *  · 禁用项
 *  · 事件派发
 *  · API 调用（setSelectedByValue / addItem / removeItem / clearItems）
 */
@ccclass('CCComboBoxTest')
export class CCComboBoxTest extends Component {
    @property({ type: CCComboBox, tooltip: '下拉列表组件引用' })
    public comboBox: CCComboBox | null = null;

    @property({ type: Label, tooltip: '显示选中结果的 Label' })
    public resultLabel: Label | null = null;

    @property({ type: Label, tooltip: '显示当前数据量的 Label' })
    public countLabel: Label | null = null;

    @property({ tooltip: '初始数据条数' })
    public initialCount: number = 1000;

    // 按钮节点引用（通过节点名查找并绑定 TouchEnd 事件）
    @property({ type: [Node], tooltip: '控制按钮节点列表（按节点名识别动作）' })
    public buttonNodes: Node[] = [];

    protected onLoad(): void {
        if (!this.comboBox) {
            console.error('[Test] 未绑定 CCComboBox');
            return;
        }

        // 监听选中事件
        this.comboBox.node.on(CCComboBoxEvent.SELECTED_CHANGED, this.onSelectedChanged, this);
        this.comboBox.node.on(CCComboBoxEvent.DROPDOWN_OPEN, () => {
            this.log('▼ 下拉展开');
        });
        this.comboBox.node.on(CCComboBoxEvent.DROPDOWN_CLOSE, () => {
            this.log('▲ 下拉收起');
        });

        // 绑定按钮事件（按节点名匹配动作）
        this._bindButtons();

        // 初始化数据
        this.loadLargeData();
    }

    protected onDestroy(): void {
        if (this.comboBox) {
            this.comboBox.node.off(CCComboBoxEvent.SELECTED_CHANGED, this.onSelectedChanged, this);
        }
        this._unbindButtons();
    }

    /** 按节点名绑定按钮事件 */
    private _bindButtons(): void {
        const actions: Record<string, () => void> = {
            'BtnLoadLarge': this.loadLargeData,
            'BtnLoadSmall': this.loadSmallData,
            'BtnLoadIcon': this.loadIconData,
            'BtnSelectByValue': this.selectByValue,
            'BtnAddItem': this.addItem,
            'BtnRemoveLast': this.removeLastItem,
            'BtnClearAll': this.clearAll,
            'BtnExpand': this.expand,
            'BtnCollapse': this.collapse,
        };
        for (const btn of this.buttonNodes) {
            const action = actions[btn.name];
            if (action) {
                btn.on(Node.EventType.TOUCH_END, action, this);
            }
        }
    }

    private _unbindButtons(): void {
        for (const btn of this.buttonNodes) {
            btn.off(Node.EventType.TOUCH_END);
        }
    }

    // ==================== 数据加载方法 ====================

    /** 加载大数据量测试（1000 项，验证虚拟列表） */
    public loadLargeData(): void {
        const items: CCComboBoxItemData[] = [];
        for (let i = 0; i < this.initialCount; i++) {
            items.push(new CCComboBoxItemData(
                `选项 ${i + 1}`,
                i,
                { disabled: i % 50 === 49 },  // 每 50 项禁用 1 个
            ));
        }
        this.comboBox!.setItems(items);
        this.updateCount();
        this.log(`已加载 ${items.length} 项数据（虚拟列表）`);
    }

    /** 加载小数据量测试 */
    public loadSmallData(): void {
        const items: CCComboBoxItemData[] = [
            new CCComboBoxItemData('北京', 'bj'),
            new CCComboBoxItemData('上海', 'sh'),
            new CCComboBoxItemData('广州', 'gz'),
            new CCComboBoxItemData('深圳', 'sz'),
            new CCComboBoxItemData('杭州', 'hz'),
            new CCComboBoxItemData('成都（禁用）', 'cd', { disabled: true }),
        ];
        this.comboBox!.setItems(items);
        this.updateCount();
        this.log(`已加载 ${items.length} 项数据`);
    }

    /** 加载带图标的测试数据（需要先有 SpriteFrame 资源） */
    public loadIconData(): void {
        const items: CCComboBoxItemData[] = [
            new CCComboBoxItemData('苹果', 'apple'),
            new CCComboBoxItemData('香蕉', 'banana'),
            new CCComboBoxItemData('橙子', 'orange'),
            new CCComboBoxItemData('葡萄', 'grape'),
        ];
        // 注意：图标 SpriteFrame 需在编辑器中手动赋值，或动态加载
        // 这里仅设置文本，验证图标位预留正确
        this.comboBox!.setItems(items);
        this.updateCount();
        this.log('已加载带图标位的数据（图标需手动赋值）');
    }

    // ==================== API 测试方法 ====================

    /** 通过值设置选中项 */
    public selectByValue(): void {
        const targetValue = Math.floor(Math.random() * this.comboBox!.items.length);
        this.comboBox!.setSelectedByValue(targetValue);
        this.log(`通过值选中: value=${targetValue}`);
    }

    /** 添加一个新选项 */
    public addItem(): void {
        const newId = this.comboBox!.items.length;
        this.comboBox!.addItem(new CCComboBoxItemData(
            `新增项 ${newId + 1}`,
            `new_${newId}`,
        ));
        this.updateCount();
        this.log(`已添加项，当前共 ${this.comboBox!.items.length} 项`);
    }

    /** 移除最后一项 */
    public removeLastItem(): void {
        const count = this.comboBox!.items.length;
        if (count === 0) return;
        this.comboBox!.removeItem(count - 1);
        this.updateCount();
        this.log(`已移除最后一项，当前共 ${this.comboBox!.items.length} 项`);
    }

    /** 清空所有选项 */
    public clearAll(): void {
        this.comboBox!.clearItems();
        this.updateCount();
        this.log('已清空所有选项');
    }

    /** 展开下拉列表 */
    public expand(): void {
        this.comboBox!.expand();
    }

    /** 收起下拉列表 */
    public collapse(): void {
        this.comboBox!.collapse();
    }

    // ==================== 事件回调 ====================

    private onSelectedChanged(index: number, item: CCComboBoxItemData | null): void {
        if (item) {
            this.log(`✓ 选中: index=${index}, label="${item.label}", value=${item.value}`);
        } else {
            this.log(`✓ 取消选中 (index=${index})`);
        }
    }

    // ==================== 辅助方法 ====================

    private updateCount(): void {
        if (this.countLabel) {
            this.countLabel.string = `数据量: ${this.comboBox!.items.length}`;
        }
    }

    private log(msg: string): void {
        console.log(`[CCComboBoxTest] ${msg}`);
        if (this.resultLabel) {
            this.resultLabel.string = msg;
            // 简单的提示动画
            tween(this.resultLabel.node)
                .set({ scale: new Vec3(1.1, 1.1, 1) })
                .to(0.15, { scale: new Vec3(1, 1, 1) })
                .start();
        }
    }
}
