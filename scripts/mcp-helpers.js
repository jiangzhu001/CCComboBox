#!/usr/bin/env node
/**
 * cocos-cli MCP API 公共辅助模块
 *
 * 封装常用的场景操作，处理组件路径解析、引用设置等复杂逻辑。
 */

const http = require('http');

const MCP_PORT = 9531;
const MCP_HOST = 'localhost';
const MCP_PATH = '/mcp';

let requestId = 0;

function callMCP(toolName, args) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            jsonrpc: '2.0', id: ++requestId, method: 'tools/call',
            params: { name: toolName, arguments: args },
        });
        const req = http.request({
            hostname: MCP_HOST, port: MCP_PORT, path: MCP_PATH, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream', 'Content-Length': Buffer.byteLength(body) },
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.error) { reject(new Error(`MCP error: ${JSON.stringify(json.error)}`)); return; }
                    const content = json.result?.content?.[0]?.text;
                    if (content) {
                        try {
                            const parsed = JSON.parse(content);
                            if (parsed.result && parsed.result.code && parsed.result.code !== 200) {
                                reject(new Error(`API error (${parsed.result.code}): ${parsed.result.reason || 'Unknown'}`));
                                return;
                            }
                            resolve(parsed);
                        } catch { resolve(content); }
                    } else { resolve(json.result); }
                } catch (e) { reject(new Error(`Parse error: ${e.message}\nRaw: ${data.slice(0, 500)}`)); }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * 查询节点信息（含组件列表）
 */
async function queryNode(nodePath, includeComponents = true) {
    const normalizedPath = nodePath.replace(/^\//, '');
    const r = await callMCP('scene-query-node', {
        options: { path: normalizedPath, includeComponents },
    });
    return r?.result?.data || r?.data || null;
}

/**
 * 获取节点的 UUID（nodeId）
 */
async function getNodeUUID(nodePath) {
    const node = await queryNode(nodePath, false);
    if (!node?.nodeId) {
        throw new Error(`无法获取节点 UUID: ${nodePath}`);
    }
    return node.nodeId;
}

/**
 * 在节点上查找组件，返回组件信息
 * compCid 可以是 cid（如 'cc.UITransform'）、类名（如 'CCComboBox'）
 */
async function findComponent(nodePath, compCid) {
    const node = await queryNode(nodePath, true);
    const components = node?.components || [];
    // 1. 精确匹配 cid
    // 2. cid 前缀匹配（cc.UITransform 匹配 cc.UITransform_003）
    // 3. name 后缀匹配（自定义组件：name = "NodeName<ClassName>"）
    const found = components.find(c => c.cid === compCid) ||
                  components.find(c => c.cid && c.cid.startsWith(compCid + '_')) ||
                  components.find(c => c.name && c.name.endsWith(`<${compCid}>`));
    return found || null;
}

/**
 * 获取组件的真实 path（带后缀索引）
 */
async function resolveComponentPath(componentPath) {
    const normalizedPath = componentPath.replace(/^\//, '');
    const lastSlash = normalizedPath.lastIndexOf('/');
    const nodePath = normalizedPath.slice(0, lastSlash);
    const compCid = normalizedPath.slice(lastSlash + 1);
    const found = await findComponent(nodePath, compCid);
    if (!found) {
        const node = await queryNode(nodePath, true);
        const list = (node?.components || []).map(c => `${c.cid}(${c.name})`).join(',');
        throw new Error(`组件未找到: ${componentPath}（节点 ${nodePath} 上的组件: ${list}）`);
    }
    return found.path;
}

/**
 * 获取组件的 UUID
 */
async function getComponentUUID(componentPath) {
    const normalizedPath = componentPath.replace(/^\//, '');
    const lastSlash = normalizedPath.lastIndexOf('/');
    const nodePath = normalizedPath.slice(0, lastSlash);
    const compCid = normalizedPath.slice(lastSlash + 1);
    const found = await findComponent(nodePath, compCid);
    if (!found) {
        throw new Error(`组件未找到: ${componentPath}`);
    }
    return found.uuid;
}

// ===== 场景操作封装 =====

async function createNode(parentPath, name, nodeType = 'Empty') {
    await callMCP('scene-create-node-by-type', {
        options: { path: parentPath, name, nodeType, workMode: '2d' },
    });
    console.log(`  ✓ 创建节点: ${parentPath}/${name} (${nodeType})`);
}

async function createNodeFromPrefab(parentPath, name, dbURL) {
    await callMCP('scene-create-node-by-asset', { options: { path: parentPath, name, dbURL } });
    console.log(`  ✓ 实例化预制体: ${parentPath}/${name} ← ${dbURL}`);
}

async function addComponent(nodePath, component) {
    const normalizedPath = nodePath.replace(/^\//, '');
    try {
        await callMCP('scene-add-component', { addComponentInfo: { nodePath: normalizedPath, component } });
        console.log(`  ✓ 添加组件: ${nodePath} ← ${component}`);
    } catch (e) {
        console.log(`  ⚠ 添加组件跳过: ${nodePath} ← ${component} — ${e.message.slice(0, 60)}`);
    }
}

/**
 * 设置组件属性（普通值类型，如 contentSize, fontSize, string 等）
 * 引用类型请用 setNodeRef / setComponentRef
 */
async function setProps(componentPath, properties) {
    const realPath = await resolveComponentPath(componentPath);
    await callMCP('scene-set-component-property', {
        setPropertyOptions: { componentPath: realPath, properties },
    });
    const keys = Object.keys(properties).join(',');
    console.log(`  ✓ 设置属性: ${componentPath}.{${keys}}`);
}

/**
 * 设置节点引用属性
 *
 * 关键格式发现：cocos-cli 的 setProperty 实现见
 *   cocos-cli/src/core/scene/main-process/proxy/component-proxy.ts:58-79
 * API 会把传入的 value 直接作为 dump.value 使用，而 nodeDump.decode 读取
 * dump.value.uuid。因此引用属性的正确格式是 { uuid }，不是
 * { type: 'cc.Node', value: { uuid } }（后者会让 dump.value.uuid 变成 undefined
 * 从而被设为 null）。
 *
 * @param componentPath  目标组件路径（如 "Canvas/Node/CCComboBox"）
 * @param propName       属性名（如 "buttonNode"）
 * @param nodePath       被引用节点的路径（如 "Canvas/Node/Button"）
 */
async function setNodeRef(componentPath, propName, nodePath) {
    const realPath = await resolveComponentPath(componentPath);
    const uuid = await getNodeUUID(nodePath);
    await callMCP('scene-set-component-property', {
        setPropertyOptions: {
            componentPath: realPath,
            properties: { [propName]: { uuid } },
        },
    });
    console.log(`  ✓ 设置节点引用: ${componentPath}.${propName} ← ${nodePath} (uuid=${uuid})`);
}

/**
 * 设置组件引用属性
 *
 * 与 setNodeRef 同理：引用格式为 { uuid }，uuid 是被引用组件的 uuid。
 * 不需要传 type 字段，API 会用 propDef 中声明的类型。
 *
 * @param componentPath  目标组件路径
 * @param propName       属性名（如 "selectedLabel"）
 * @param refCompPath    被引用组件的路径（如 "Canvas/Node/Label/cc.Label"）
 */
async function setComponentRef(componentPath, propName, refCompPath) {
    const realPath = await resolveComponentPath(componentPath);
    const uuid = await getComponentUUID(refCompPath);
    await callMCP('scene-set-component-property', {
        setPropertyOptions: {
            componentPath: realPath,
            properties: { [propName]: { uuid } },
        },
    });
    console.log(`  ✓ 设置组件引用: ${componentPath}.${propName} ← ${refCompPath} (uuid=${uuid})`);
}

/**
 * 设置节点数组引用属性（如 buttonNodes: Node[]）
 *
 * 数组格式：直接传 [{ uuid }, { uuid }, ...]，API 会用 elementTypeData 包装。
 * 参考 cocos-cli 测试用例 component-proxy.testcase.ts:737-741。
 *
 * @param componentPath  目标组件路径
 * @param propName       属性名
 * @param nodePaths      被引用节点路径数组
 */
async function setNodeArrayRef(componentPath, propName, nodePaths) {
    const realPath = await resolveComponentPath(componentPath);
    const uuids = [];
    for (const p of nodePaths) {
        uuids.push(await getNodeUUID(p));
    }
    // 数组引用格式：直接传 [{ uuid }, ...]，API 会自动用 elementTypeData 包装
    const arrValue = uuids.map(uuid => ({ uuid }));
    await callMCP('scene-set-component-property', {
        setPropertyOptions: {
            componentPath: realPath,
            properties: { [propName]: arrValue },
        },
    });
    console.log(`  ✓ 设置节点数组引用: ${componentPath}.${propName} ← [${nodePaths.length} 个节点]`);
}

async function updateNode(path, properties) {
    const normalizedPath = path.replace(/^\//, '');
    await callMCP('scene-update-node', { options: { path: normalizedPath, properties } });
}

async function deleteNode(path) {
    const normalizedPath = path.replace(/^\//, '');
    try {
        await callMCP('scene-delete-node', { options: { path: normalizedPath } });
        console.log(`  ✓ 删除节点: ${path}`);
    } catch (e) {
        console.log(`  ⚠ 删除节点失败: ${path} — ${e.message.slice(0, 60)}`);
    }
}

async function saveScene() {
    await callMCP('scene-save', {});
    console.log(`  ✓ 保存场景`);
}

async function createPrefab(nodePath, dbURL) {
    const normalizedPath = nodePath.replace(/^\//, '');
    await callMCP('create-prefab-from-node', {
        options: { nodePath: normalizedPath, dbURL, overwrite: true },
    });
    console.log(`  ✓ 创建预制体: ${nodePath} → ${dbURL}`);
}

async function openScene(url) {
    await callMCP('scene-open', { options: { dbURLOrUUID: url } });
    console.log(`  ✓ 打开场景: ${url}`);
}

async function createScene(baseName, dbURL, templateType = '2d') {
    await callMCP('scene-create', { options: { baseName, dbURL, templateType } });
    console.log(`  ✓ 创建场景: ${baseName}`);
}

async function refreshAssets(dir) {
    await callMCP('assets-refresh', { dir });
    console.log(`  ✓ 刷新资源: ${dir}`);
}

module.exports = {
    callMCP,
    sleep,
    queryNode,
    getNodeUUID,
    findComponent,
    resolveComponentPath,
    getComponentUUID,
    createNode,
    createNodeFromPrefab,
    addComponent,
    setProps,
    setNodeRef,
    setComponentRef,
    setNodeArrayRef,
    updateNode,
    deleteNode,
    saveScene,
    createPrefab,
    openScene,
    createScene,
    refreshAssets,
};
