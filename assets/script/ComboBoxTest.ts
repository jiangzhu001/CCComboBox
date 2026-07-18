import { _decorator, Component, Label } from "cc";
import { ComboBox } from "./ComboBox";

const { ccclass, property } = _decorator;

interface MyData {
    name: string;
    id:string;
    icon: string;
}
@ccclass('ComboBoxTest')
export class ComboBoxTest extends Component {
    @property({ type: ComboBox, tooltip: "下拉列表组件" })
    comboBox: ComboBox = null;

    protected onEnable(): void {
        this._initComboBox();
    }

    _initComboBox() {
        const items: MyData[] = [
            { name: '100元', id: '+8613760380453', icon: 'texture/deposit/iconBank' },
            { name: '200元', id: '+86137603804532', icon: 'texture/deposit/iconBank' },
            { name: '300元', id: '+861376038045323', icon: 'texture/deposit/iconBank' },
            { name: '400元', id: '+861376038045324', icon: 'texture/deposit/iconBank' },
            { name: '500元', id: '+861376038045325', icon: 'texture/deposit/iconBank' },
            { name: '600元', id: '+861376038045326', icon: 'texture/deposit/iconBank' },
            { name: '700元', id: '+861376038045327', icon: 'texture/deposit/iconBank' },
            { name: '800元', id: '+861376038045328', icon: 'texture/deposit/iconBank' },
            { name: '900元', id: '+861376038045329', icon: 'texture/deposit/iconBank' },
            { name: '1000元', id: '+861376038045330', icon: 'texture/deposit/iconBank' },
        ];
        
        //业务侧根据数据选择按钮UI渲染
        this.comboBox.buttonRenderer = (btnNode, item) => {
            btnNode.getChildByName('lblName').getComponent(Label).string = item.name;
            btnNode.getChildByName('lblId').getComponent(Label).string = item.id;
            //更新图标
        };

        //业务侧根据数据列表项UI渲染
        this.comboBox.itemRenderer = (itemNode, data, index) => {
            if (!itemNode || !data) return;
            const item = data;

            const unSelect = itemNode.getChildByName('unSelect');
            unSelect.getChildByName('lblName').getComponent(Label).string = item.name;
            unSelect.getChildByName('lblId').getComponent(Label).string = item.id;
        
            const select = itemNode.getChildByName('select');
            select.getChildByName('lblName').getComponent(Label).string = item.name;
            select.getChildByName('lblId').getComponent(Label).string = item.id;
            //更新图标

        };
        this.comboBox.setData(items);
        this.comboBox.setSelected(0);
    }
}
