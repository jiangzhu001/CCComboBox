#!/usr/bin/env node
/**
 * 检查当前场景的节点结构
 */
const H = require('./mcp-helpers');

async function main() {
    console.log('--- 查询 Canvas 节点 ---');
    try {
        const node = await H.queryNode('Canvas', true);
        if (node) {
            console.log('Canvas 子节点:');
            for (const child of (node.children || [])) {
                console.log(`  - ${child.value?.name || child.name || JSON.stringify(child).slice(0, 80)}`);
            }
            console.log('Canvas 组件:');
            for (const comp of (node.components || [])) {
                console.log(`  - ${comp.cid} (${comp.name}) path=${comp.path}`);
            }
        } else {
            console.log('Canvas 节点未找到');
        }
    } catch (e) {
        console.log('查询失败:', e.message);
    }

    // 查询 CCComboBox 预制体的引用状态
    console.log('\n--- 查询 CCComboBox.prefab 引用状态 ---');
    try {
        // 先检查预制体是否在场景中作为实例存在
        const result = await H.callMCP('scene-query-node', {
            options: { path: 'Canvas', includeComponents: false },
        });
        console.log('query result:', JSON.stringify(result).slice(0, 500));
    } catch (e) {
        console.log('查询失败:', e.message);
    }
}

main().catch(err => {
    console.error('错误:', err.message);
    process.exit(1);
});
