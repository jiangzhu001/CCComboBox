#!/usr/bin/env node
/**
 * CCComboBox 测试场景构建脚本
 *
 * 在 TestScene 中创建测试 UI：
 *   - CCComboBox 预制体实例
 *   - 结果显示 Label / 数据量 Label
 *   - 控制按钮面板（9 个按钮）
 *   - 挂载 CCComboBoxTest 脚本并设置引用
 */

const H = require('./mcp-helpers');
const { sleep } = H;

// ===== 按钮定义 =====
const BUTTONS = [
    { name: 'BtnLoadLarge',      label: '加载大数据' },
    { name: 'BtnLoadSmall',      label: '加载小数据' },
    { name: 'BtnLoadIcon',       label: '加载图标数据' },
    { name: 'BtnSelectByValue',  label: '随机选中' },
    { name: 'BtnAddItem',        label: '添加项' },
    { name: 'BtnRemoveLast',     label: '移除最后' },
    { name: 'BtnClearAll',       label: '清空' },
    { name: 'BtnExpand',         label: '展开' },
    { name: 'BtnCollapse',       label: '收起' },
];

// ===== 主流程 =====
async function main() {
    console.log('========================================');
    console.log('  CCComboBox 测试场景构建');
    console.log('========================================\n');

    // 刷新资源（确保新创建的脚本被识别）
    await H.refreshAssets('db://assets/tests');
    await sleep(1000);

    // 打开场景
    console.log('\n--- 打开 TestScene ---');
    await H.openScene('db://assets/scenes/TestScene.scene');
    await sleep(1500);

    // 清理旧的测试节点
    console.log('\n--- 清理旧节点 ---');
    await H.deleteNode('Canvas/TestRoot');

    // 创建 TestRoot
    console.log('\n--- 创建测试 UI ---');
    await H.createNode('Canvas', 'TestRoot', 'Empty');
    const root = '/Canvas/TestRoot';
    await H.setProps(`${root}/cc.UITransform`, { contentSize: { width: 960, height: 640 } });

    // Title
    await H.createNode(root, 'Title', 'Label');
    const titlePath = `${root}/Title`;
    await H.setProps(`${titlePath}/cc.UITransform`, { contentSize: { width: 400, height: 40 } });
    await H.setProps(`${titlePath}/cc.Label`, {
        string: 'CCComboBox 组件测试',
        horizontalAlign: 1, verticalAlign: 1, fontSize: 28, lineHeight: 40,
    });
    await H.updateNode(titlePath, { position: { x: 0, y: 280, z: 0 } });

    // CountLabel（数据量显示）
    await H.createNode(root, 'CountLabel', 'Label');
    const countPath = `${root}/CountLabel`;
    await H.setProps(`${countPath}/cc.UITransform`, { contentSize: { width: 300, height: 30 } });
    await H.setProps(`${countPath}/cc.Label`, {
        string: '数据量: 0', horizontalAlign: 1, verticalAlign: 1, fontSize: 16, lineHeight: 30,
    });
    await H.updateNode(countPath, { position: { x: 0, y: 230, z: 0 } });

    // CCComboBox 预制体实例
    await H.createNodeFromPrefab(root, 'ComboBoxInstance', 'db://assets/CCComboBox/prefabs/CCComboBox.prefab');
    const comboPath = `${root}/ComboBoxInstance`;
    await H.updateNode(comboPath, { position: { x: 0, y: 170, z: 0 } });

    // ResultLabel（选中结果显示）
    await H.createNode(root, 'ResultLabel', 'Label');
    const resultPath = `${root}/ResultLabel`;
    await H.setProps(`${resultPath}/cc.UITransform`, { contentSize: { width: 600, height: 40 } });
    await H.setProps(`${resultPath}/cc.Label`, {
        string: '请选择选项查看结果',
        horizontalAlign: 1, verticalAlign: 1, fontSize: 16, lineHeight: 40,
    });
    await H.updateNode(resultPath, { position: { x: 0, y: 100, z: 0 } });

    // ButtonPanel（按钮容器）
    await H.createNode(root, 'ButtonPanel', 'Empty');
    const panelPath = `${root}/ButtonPanel`;
    await H.setProps(`${panelPath}/cc.UITransform`, { contentSize: { width: 900, height: 120 } });
    await H.updateNode(panelPath, { position: { x: 0, y: -220, z: 0 } });

    // 创建 9 个按钮（3 行 3 列）
    const btnWidth = 140;
    const btnHeight = 40;
    const gapX = 20;
    const gapY = 16;
    const cols = 3;
    const rows = Math.ceil(BUTTONS.length / cols);
    const totalWidth = cols * btnWidth + (cols - 1) * gapX;
    const totalHeight = rows * btnHeight + (rows - 1) * gapY;

    const btnNodePaths = [];
    for (let i = 0; i < BUTTONS.length; i++) {
        const btn = BUTTONS[i];
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = -totalWidth / 2 + btnWidth / 2 + col * (btnWidth + gapX);
        const y = totalHeight / 2 - btnHeight / 2 - row * (btnHeight + gapY);

        // 按钮节点（Sprite 背景）
        await H.createNode(panelPath, btn.name, 'Sprite');
        const btnPath = `${panelPath}/${btn.name}`;
        btnNodePaths.push(btnPath);
        await H.setProps(`${btnPath}/cc.UITransform`, { contentSize: { width: btnWidth, height: btnHeight } });
        await H.setProps(`${btnPath}/cc.Sprite`, { sizeMode: 0, type: 0 });
        await H.updateNode(btnPath, { position: { x, y, z: 0 } });

        // Button 组件
        await H.addComponent(btnPath, 'cc.Button');
        await H.setProps(`${btnPath}/cc.Button`, { transition: 0 });

        // 按钮文字
        await H.createNode(btnPath, 'Label', 'Label');
        const lblPath = `${btnPath}/Label`;
        await H.setProps(`${lblPath}/cc.UITransform`, { contentSize: { width: btnWidth, height: btnHeight } });
        await H.setProps(`${lblPath}/cc.Label`, {
            string: btn.label, horizontalAlign: 1, verticalAlign: 1, fontSize: 16, lineHeight: btnHeight,
        });
        await H.updateNode(lblPath, { position: { x: 0, y: 0, z: 0 } });
    }

    // 挂载 CCComboBoxTest 脚本
    console.log('\n--- 挂载测试脚本 ---');
    await H.addComponent(root, 'CCComboBoxTest');

    // 设置脚本引用
    console.log('\n--- 设置脚本引用 ---');
    // 普通属性
    await H.setProps(`${root}/CCComboBoxTest`, { initialCount: 1000 });
    // 组件引用
    await H.setComponentRef(`${root}/CCComboBoxTest`, 'comboBox', `${comboPath}/CCComboBox`);
    await H.setComponentRef(`${root}/CCComboBoxTest`, 'resultLabel', `${resultPath}/cc.Label`);
    await H.setComponentRef(`${root}/CCComboBoxTest`, 'countLabel', `${countPath}/cc.Label`);
    // 节点数组引用
    await H.setNodeArrayRef(`${root}/CCComboBoxTest`, 'buttonNodes', btnNodePaths);

    // 保存场景
    console.log('\n--- 保存场景 ---');
    await H.saveScene();

    console.log('\n========================================');
    console.log('  ✓ 测试场景构建完成！');
    console.log('========================================');
}

main().catch(err => {
    console.error('\n❌ 构建失败:', err.message);
    console.error(err.stack);
    process.exit(1);
});
