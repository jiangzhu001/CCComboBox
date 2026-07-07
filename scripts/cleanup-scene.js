#!/usr/bin/env node
/**
 * 清理场景中的废弃节点
 *
 * build-prefabs.js 在 createPrefab 后尝试删除临时节点，
 * 但 create-prefab-from-node 会把源节点重命名为预制体名，
 * 导致 deleteNode 按原名查找失败，留下废弃的预制体实例节点。
 */
const H = require('./mcp-helpers');

async function main() {
    console.log('--- 清理场景废弃节点 ---');
    const node = await H.queryNode('Canvas', true);
    const children = node?.children || [];
    console.log(`Canvas 当前有 ${children.length} 个子节点`);

    // 删除所有非 TestRoot 的子节点（TestRoot 是测试场景的根节点）
    for (const child of children) {
        const name = child.value?.name || child.name;
        if (name && name !== 'TestRoot') {
            console.log(`  删除: Canvas/${name}`);
            try {
                await H.deleteNode(`Canvas/${name}`);
            } catch (e) {
                console.log(`  ⚠ 删除失败: ${name} — ${e.message.slice(0, 60)}`);
            }
        }
    }

    // 也删除 TestRoot（会一起重建）
    try {
        await H.deleteNode('Canvas/TestRoot');
        console.log('  删除: Canvas/TestRoot');
    } catch (e) {
        console.log('  ⚠ TestRoot 不存在或删除失败');
    }

    await H.saveScene();
    console.log('  ✓ 场景清理完成');
}

main().catch(err => {
    console.error('错误:', err.message);
    process.exit(1);
});
