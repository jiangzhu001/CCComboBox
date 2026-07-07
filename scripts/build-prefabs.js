#!/usr/bin/env node
/**
 * CCComboBox 预制体构建脚本
 *
 * 通过 cocos-cli MCP API (端口 9531) 在编辑器中构建预制体。
 * 引用类型属性使用 { type: 'cc.Node'/'cc.Component', value: { uuid } } 格式。
 */

const H = require('./mcp-helpers');
const { callMCP, sleep } = H;

// ===== 主流程 =====

async function main() {
    console.log('========================================');
    console.log('  CCComboBox 预制体构建脚本');
    console.log('========================================\n');

    // 1. 创建并打开 TestScene
    console.log('--- 步骤 1: 创建并打开 TestScene ---');
    try {
        await H.createScene('TestScene', 'db://assets/scenes', '2d');
    } catch (e) {
        console.log('  (场景已存在或创建失败，继续)');
    }
    await sleep(1000);
    await H.openScene('db://assets/scenes/TestScene.scene');
    await sleep(2000);

    // 2. 构建 CCComboBoxItem 预制体
    console.log('\n--- 步骤 2: 构建 CCComboBoxItem 预制体 ---');
    await buildItemPrefab();
    await H.saveScene();
    await sleep(1000);

    // 3. 构建 CCComboBox 主预制体
    console.log('\n--- 步骤 3: 构建 CCComboBox 主预制体 ---');
    await buildMainPrefab();
    await H.saveScene();

    console.log('\n========================================');
    console.log('  ✓ 全部预制体构建完成！');
    console.log('========================================');
}

// ===== CCComboBoxItem 预制体 =====

async function buildItemPrefab() {
    const root = '/Canvas';
    const tmpName = 'ItemBuilder';
    const itemPath = `${root}/${tmpName}`;

    // 根节点：Empty
    await H.createNode(root, tmpName, 'Empty');
    await H.setProps(`${itemPath}/cc.UITransform`, { contentSize: { width: 288, height: 40 } });

    // Background：Sprite 节点
    await H.createNode(itemPath, 'Background', 'Sprite');
    const bgPath = `${itemPath}/Background`;
    await H.setProps(`${bgPath}/cc.UITransform`, { contentSize: { width: 288, height: 40 } });
    await H.setProps(`${bgPath}/cc.Sprite`, { sizeMode: 0, type: 0 });
    await H.updateNode(bgPath, { position: { x: 0, y: 0, z: 0 } });

    // Icon：Sprite 节点
    await H.createNode(itemPath, 'Icon', 'Sprite');
    const iconPath = `${itemPath}/Icon`;
    await H.setProps(`${iconPath}/cc.UITransform`, { contentSize: { width: 20, height: 20 } });
    await H.setProps(`${iconPath}/cc.Sprite`, { sizeMode: 0, type: 0 });
    await H.updateNode(iconPath, { position: { x: -126, y: 0, z: 0 } });
    await H.updateNode(iconPath, { active: false });

    // Label：Label 节点
    await H.createNode(itemPath, 'Label', 'Label');
    const labelPath = `${itemPath}/Label`;
    await H.setProps(`${labelPath}/cc.UITransform`, { contentSize: { width: 240, height: 40 } });
    await H.setProps(`${labelPath}/cc.Label`, {
        string: '选项',
        horizontalAlign: 0,
        verticalAlign: 1,
        fontSize: 14,
        lineHeight: 40,
    });
    await H.updateNode(labelPath, { position: { x: -96, y: 0, z: 0 } });

    // 添加 Button 组件
    await H.addComponent(itemPath, 'cc.Button');
    await H.setProps(`${itemPath}/cc.Button`, { transition: 0 });

    // 添加 CCComboBoxItem 组件
    await H.addComponent(itemPath, 'CCComboBoxItem');

    // 设置 CCComboBoxItem 引用
    // 注意：labelNode 虽然名字带 Node，但 @property type 是 Label（组件），
    // 所以必须用 setComponentRef 传组件 UUID，而非 setNodeRef 传节点 UUID。
    await H.setComponentRef(`${itemPath}/CCComboBoxItem`, 'labelNode', `${labelPath}/cc.Label`);
    // iconSprite: Sprite, backgroundSprite: Sprite → 组件引用
    await H.setComponentRef(`${itemPath}/CCComboBoxItem`, 'iconSprite', `${iconPath}/cc.Sprite`);
    await H.setComponentRef(`${itemPath}/CCComboBoxItem`, 'backgroundSprite', `${bgPath}/cc.Sprite`);

    // 保存为预制体（create-prefab-from-node 会把源节点重命名为预制体名）
    await H.createPrefab(itemPath, 'db://assets/CCComboBox/prefabs/CCComboBoxItem.prefab');
    await sleep(500);

    // 删除临时节点：createPrefab 后源节点被重命名为 "CCComboBoxItem"
    const prefabBaseName = 'CCComboBoxItem';
    await H.deleteNode(`${root}/${prefabBaseName}`);
}

// ===== CCComboBox 主预制体 =====

async function buildMainPrefab() {
    const root = '/Canvas';
    const tmpName = 'ComboBoxBuilder';
    const comboPath = `${root}/${tmpName}`;

    // 根节点
    await H.createNode(root, tmpName, 'Empty');
    await H.setProps(`${comboPath}/cc.UITransform`, { contentSize: { width: 320, height: 40 } });
    await H.addComponent(comboPath, 'CCComboBox');

    // ===== Button 区 =====
    await H.createNode(comboPath, 'Button', 'Sprite');
    const btnPath = `${comboPath}/Button`;
    await H.setProps(`${btnPath}/cc.UITransform`, { contentSize: { width: 320, height: 40 } });
    await H.setProps(`${btnPath}/cc.Sprite`, { sizeMode: 0, type: 0 });

    // PlaceholderLabel
    await H.createNode(btnPath, 'PlaceholderLabel', 'Label');
    const phPath = `${btnPath}/PlaceholderLabel`;
    await H.setProps(`${phPath}/cc.UITransform`, { contentSize: { width: 280, height: 40 } });
    await H.setProps(`${phPath}/cc.Label`, {
        string: '请选择', horizontalAlign: 0, verticalAlign: 1, fontSize: 14, lineHeight: 40,
    });
    await H.updateNode(phPath, { position: { x: -140, y: 0, z: 0 } });

    // SelectedLabel
    await H.createNode(btnPath, 'SelectedLabel', 'Label');
    const selPath = `${btnPath}/SelectedLabel`;
    await H.setProps(`${selPath}/cc.UITransform`, { contentSize: { width: 280, height: 40 } });
    await H.setProps(`${selPath}/cc.Label`, {
        string: '', horizontalAlign: 0, verticalAlign: 1, fontSize: 14, lineHeight: 40,
    });
    await H.updateNode(selPath, { position: { x: -140, y: 0, z: 0 } });
    await H.updateNode(selPath, { active: false });

    // Arrow
    await H.createNode(btnPath, 'Arrow', 'Sprite');
    const arrowPath = `${btnPath}/Arrow`;
    await H.setProps(`${arrowPath}/cc.UITransform`, { contentSize: { width: 16, height: 16 } });
    await H.setProps(`${arrowPath}/cc.Sprite`, { sizeMode: 0, type: 0 });
    await H.updateNode(arrowPath, { position: { x: 142, y: 0, z: 0 } });

    // ===== DropDownList 区 =====
    await H.createNode(comboPath, 'DropDownList', 'Empty');
    const ddPath = `${comboPath}/DropDownList`;
    await H.setProps(`${ddPath}/cc.UITransform`, { contentSize: { width: 320, height: 280 } });
    await H.updateNode(ddPath, { position: { x: 0, y: -160, z: 0 } });
    await H.updateNode(ddPath, { active: false });

    // Panel
    await H.createNode(ddPath, 'Panel', 'Sprite');
    const panelPath = `${ddPath}/Panel`;
    await H.setProps(`${panelPath}/cc.UITransform`, { contentSize: { width: 320, height: 280 } });
    await H.setProps(`${panelPath}/cc.Sprite`, { sizeMode: 0, type: 0 });

    // SearchBox
    await H.createNode(ddPath, 'SearchBox', 'Sprite');
    const searchPath = `${ddPath}/SearchBox`;
    await H.setProps(`${searchPath}/cc.UITransform`, { contentSize: { width: 288, height: 32 } });
    await H.setProps(`${searchPath}/cc.Sprite`, { sizeMode: 0, type: 0 });
    await H.updateNode(searchPath, { position: { x: 0, y: 114, z: 0 } });

    // EditBox（SearchBox 子节点）
    await H.createNode(searchPath, 'EditBox', 'EditBox');
    const ebPath = `${searchPath}/EditBox`;
    await H.setProps(`${ebPath}/cc.UITransform`, { contentSize: { width: 280, height: 28 } });
    await H.setProps(`${ebPath}/cc.EditBox`, {
        string: '',
        placeholder: '搜索...',
    });

    // List（ScrollView 节点）
    await H.createNode(ddPath, 'List', 'ScrollView');
    const listPath = `${ddPath}/List`;
    await H.setProps(`${listPath}/cc.UITransform`, { contentSize: { width: 288, height: 200 } });
    await H.setProps(`${listPath}/cc.ScrollView`, { horizontal: false, vertical: true });
    await H.updateNode(listPath, { position: { x: 0, y: -16, z: 0 } });

    // content 子节点（ScrollView 的内容容器）
    await H.createNode(listPath, 'content', 'Empty');
    const contentPath = `${listPath}/content`;
    await H.setProps(`${contentPath}/cc.UITransform`, {
        anchorPoint: { x: 0.5, y: 1 },
        contentSize: { width: 288, height: 0 },
    });
    await H.updateNode(contentPath, { position: { x: 0, y: 100, z: 0 } });

    // ⚠️ 关键：LarkList 需要 content 上有 Layout 组件
    // Layout.type: VERTICAL (2) 表示垂直排列
    // Layout.resizeMode: CONTAINER (1) 表示容器自适应内容高度
    await H.addComponent(contentPath, 'cc.Layout');
    await H.setProps(`${contentPath}/cc.Layout`, {
        type: 2,           // VERTICAL 布局
        resizeMode: 1,     // CONTAINER 自适应
        paddingTop: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        paddingRight: 0,
        spacingY: 0,       // 项间距
        startAxis: 0,      // HORIZONTAL
        verticalDirection: 1, // TOP_TO_BOTTOM
        horizontalDirection: 0, // LEFT_TO_RIGHT
    });

    // 设置 ScrollView 的 content 引用（content 是节点引用）
    await H.setNodeRef(`${listPath}/cc.ScrollView`, 'content', contentPath);

    // 添加 List 组件（第三方虚拟列表，ccclass 名为 'LarkList'）
    await H.addComponent(listPath, 'LarkList');
    // CCComboBoxItem 预制体资源 UUID（用于 LarkList 的 tmpPrefab 模板）
    const ITEM_PREFAB_UUID = '8095a606-b29c-40db-9f69-5f26d2af0cb4';
    await H.setProps(`${listPath}/LarkList`, {
        virtual: true,
        selectedMode: 1,
        repeatEventSingle: true,
        // 模板类型：PREFAB (2)，配合 tmpPrefab 使用
        // 若不设置 tmpPrefab，LarkList 在 instantiate 时会报 _components null 错误
        templateType: 2,
        // 资源引用格式：{ uuid: 'assetUUID' }，参考 cocos-cli 测试用例
        tmpPrefab: { uuid: ITEM_PREFAB_UUID },
    });

    // EmptyLabel
    await H.createNode(ddPath, 'EmptyLabel', 'Label');
    const emptyPath = `${ddPath}/EmptyLabel`;
    await H.setProps(`${emptyPath}/cc.UITransform`, { contentSize: { width: 288, height: 40 } });
    await H.setProps(`${emptyPath}/cc.Label`, {
        string: '无匹配项', horizontalAlign: 1, verticalAlign: 1, fontSize: 14,
    });
    await H.updateNode(emptyPath, { position: { x: 0, y: -16, z: 0 } });
    await H.updateNode(emptyPath, { active: false });

    // ===== 设置 CCComboBox 组件引用 =====
    // 节点引用（Node 类型）
    await H.setNodeRef(`${comboPath}/CCComboBox`, 'buttonNode', btnPath);
    await H.setNodeRef(`${comboPath}/CCComboBox`, 'arrowNode', arrowPath);
    await H.setNodeRef(`${comboPath}/CCComboBox`, 'dropDownNode', ddPath);
    await H.setNodeRef(`${comboPath}/CCComboBox`, 'emptyLabel', emptyPath);

    // 组件引用（Label / EditBox / LarkList 类型）
    await H.setComponentRef(`${comboPath}/CCComboBox`, 'selectedLabel', `${selPath}/cc.Label`);
    await H.setComponentRef(`${comboPath}/CCComboBox`, 'placeholderLabel', `${phPath}/cc.Label`);
    await H.setComponentRef(`${comboPath}/CCComboBox`, 'searchEditBox', `${ebPath}/cc.EditBox`);
    await H.setComponentRef(`${comboPath}/CCComboBox`, 'list', `${listPath}/LarkList`);

    // 保存为预制体（create-prefab-from-node 会把源节点重命名为预制体名）
    await H.createPrefab(comboPath, 'db://assets/CCComboBox/prefabs/CCComboBox.prefab');
    await sleep(500);

    // 删除临时节点：createPrefab 后源节点被重命名为 "CCComboBox"
    await H.deleteNode(`${root}/CCComboBox`);
}

main().catch(err => {
    console.error('\n❌ 构建失败:', err.message);
    console.error(err.stack);
    process.exit(1);
});
