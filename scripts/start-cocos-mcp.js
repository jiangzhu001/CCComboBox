#!/usr/bin/env node
/**
 * Cocos CLI MCP Server 启动脚本
 * 支持共享目录和项目内目录两种模式
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// 项目路径
const PROJECT_PATH = path.join(__dirname, '..');

// cocos-cli 路径优先级：
// 1. Documents 目录下的共享版本（其他项目可共用）
// 2. 项目内的 tools 目录
// 3. Home 目录下的版本
const COCOS_CLI_PATHS = [
    path.join(require('os').homedir(), 'Documents', 'cocos-cli', 'dist', 'cli.js'), // ~/Documents/cocos-cli（共享）
    path.join(PROJECT_PATH, 'tools', 'cocos-cli', 'dist', 'cli.js'),                // 项目内
    path.join(require('os').homedir(), 'cocos-cli', 'dist', 'cli.js'),              // ~/cocos-cli
];

// 查找可用的 cocos-cli
let cocosCliPath = null;
for (const p of COCOS_CLI_PATHS) {
    if (fs.existsSync(p)) {
        cocosCliPath = p;
        break;
    }
}

if (!cocosCliPath) {
    console.error('错误: 未找到 cocos-cli');
    console.error('');
    console.error('请先安装 cocos-cli:');
    console.error('  cd ~/Documents && git clone https://github.com/cocos/cocos-cli.git');
    console.error('  cd cocos-cli && npm run init && npm install && npm run build');
    console.error('');
    process.exit(1);
}

// 配置
const CONFIG = {
    cocosCliPath: cocosCliPath,
    projectPath: PROJECT_PATH,
    port: 9527
};

console.log('========================================');
console.log('  Cocos CLI MCP Server 启动器');
console.log('========================================');
console.log(`cocos-cli: ${cocosCliPath}`);
console.log(`项目路径: ${CONFIG.projectPath}`);
console.log(`端口: ${CONFIG.port}`);
console.log('');
console.log('提示: MCP Server URL 会显示在启动日志中');
console.log('      通常为 http://localhost:9528/mcp');
console.log('');

// 启动 MCP server
const args = [
    'start-mcp-server',
    '--project', CONFIG.projectPath,
    '--port', String(CONFIG.port)
];

const server = spawn('node', [CONFIG.cocosCliPath, ...args], {
    stdio: 'inherit',
    cwd: CONFIG.projectPath
});

server.on('error', (err) => {
    console.error('启动失败:', err.message);
    process.exit(1);
});

server.on('exit', (code) => {
    if (code !== 0 && code !== null) {
        console.error(`服务器退出，代码: ${code}`);
    }
    process.exit(code || 0);
});

// 处理终止信号
process.on('SIGINT', () => {
    console.log('\n正在停止服务器...');
    server.kill('SIGINT');
});

process.on('SIGTERM', () => {
    server.kill('SIGTERM');
});