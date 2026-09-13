"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = require("react");
const server_1 = require("react-dom/server");
const App_1 = __importDefault(require("./src/App"));
const DetailPane_1 = __importDefault(require("./src/ui/DetailPane"));
const types_1 = require("./src/types");
let failures = 0;
function ok(cond, msg) {
    if (!cond) {
        failures++;
        console.error(`FAIL ${msg}`);
    }
    else
        console.log(`ok ${msg}`);
}
function eq(actual, expected, msg) {
    const a = JSON.stringify(actual), e = JSON.stringify(expected);
    if (a !== e) {
        failures++;
        console.error(`FAIL ${msg}: got ${a}, want ${e}`);
    }
    else
        console.log(`ok ${msg}`);
}
class LS {
    constructor() {
        this.m = new Map();
    }
    getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
    setItem(k, v) { this.m.set(k, String(v)); }
    removeItem(k) { this.m.delete(k); }
    clear() { this.m.clear(); }
}
const ls = new LS();
globalThis.localStorage = ls;
// 1) 全新启动：种子数据渲染
let html = (0, server_1.renderToString)((0, react_1.createElement)(App_1.default));
ok(html.includes('Aurora Web'), '渲染首个项目');
ok(html.includes('闭源分发'), '显示政策类型徽标');
ok(html.includes('试验场 Sandbox'), '侧栏含空项目');
ok(html.includes('>空<'), '空项目徽标');
ok(html.includes('依赖清单'), '依赖表格渲染');
ok(html.includes('legacy-parser'), '种子依赖渲染');
ok(html.includes('豁免已过期'), '过期豁免标记渲染（ffmpeg-static）');
ok(html.includes('豁免过期'), '侧栏过期豁免入口');
ok(html.includes('高风险'), '风险统计渲染');
ok(html.includes('撤销') && html.includes('重做'), '撤销重做按钮渲染');
ok(html.includes('导出快照') && html.includes('导入快照'), '快照按钮渲染');
ok(html.includes('批量') || html.includes('待复核'), '状态文案渲染');
// 2) 旧版数据迁移
ls.clear();
ls.setItem('license-lens', JSON.stringify([
    { id: 1, name: 'react', version: '18.3.1', license: 'MIT', source: 'npm', status: 'ok', note: '宽松许可' },
    { id: 5, name: 'legacy-parser', version: '2.1.0', license: 'GPL-3.0', source: '手动', status: 'risk', note: '可能冲突' },
]));
html = (0, server_1.renderToString)((0, react_1.createElement)(App_1.default));
ok(html.includes('react'), '旧数据迁移：依赖保留');
ok(html.includes('Aurora Web'), '旧数据迁移：默认项目');
ok(!html.includes('试验场'), '迁移后不出现种子项目');
// 3) 损坏数据回退
ls.clear();
ls.setItem('license-workbench:v1', '{broken json!!!');
html = (0, server_1.renderToString)((0, react_1.createElement)(App_1.default));
ok(html.includes('Aurora Web'), '损坏数据回退到种子');
// 4) 持久化数据恢复（模拟刷新）
ls.clear();
ls.setItem('license-workbench:v1', JSON.stringify({
    seq: 10,
    projects: [{ id: 1, name: 'Persisted Proj', policy: { kind: 'open', banned: ['Unknown'], obligations: [], exceptionDays: 15, scope: { sources: ['npm'] } }, createdAt: 1 }],
    deps: [
        { id: 2, name: 'persisted-dep', version: '9.9.9', license: 'MIT', source: 'npm', projectId: 1, status: 'approved', note: '', exemption: null, updatedAt: 1 },
        { id: 3, name: 'exempt-dep', version: '1.0.0', license: 'LGPL-3.0', source: 'npm', projectId: 1, status: 'exempted', note: '', exemption: { reason: '等待替代', until: Date.now() + 10 * 86400000 }, updatedAt: 1 },
        { id: 4, name: 'expired-dep', version: '1.0.0', license: 'GPL-3.0', source: 'npm', projectId: 1, status: 'exempted', note: '', exemption: { reason: '旧豁免', until: Date.now() - 86400000 }, updatedAt: 1 },
    ],
    audit: [],
}));
html = (0, server_1.renderToString)((0, react_1.createElement)(App_1.default));
ok(html.includes('Persisted Proj'), '刷新后项目保留');
ok(html.includes('persisted-dep'), '刷新后依赖保留');
ok(html.includes('开源发布'), '刷新后政策保留');
ok(html.includes((0, types_1.fmtDate)(Date.now() + 10 * 86400000)) && html.includes('到期'), '刷新后有效豁免及到期日保留');
ok(html.includes('豁免已过期'), '刷新后过期豁免标记保留');
// 5) 详情面板：过期豁免按待复核参与流转
const NOW5 = Date.now();
const mkSsrDep = (over) => ({
    id: 1, name: 'x', version: '1.0.0', license: 'MIT', source: 'npm',
    projectId: null, status: 'pending', note: '', exemption: null, updatedAt: NOW5, ...over,
});
function transClass(h, label) {
    const re = /<button class="(trans[^"]*)"[^>]*>([\s\S]*?)<\/button>/g;
    let m;
    while ((m = re.exec(h))) {
        if (m[2].includes(label))
            return m[1];
    }
    return 'NOT_FOUND';
}
const noop = () => undefined;
const expiredPane = (0, server_1.renderToString)((0, react_1.createElement)(DetailPane_1.default, {
    dep: mkSsrDep({ status: 'exempted', exemption: { reason: '旧', until: NOW5 - 1000 } }),
    project: null, audit: [], now: NOW5, onClose: noop, onTransition: noop, onExempt: noop,
}));
ok(expiredPane.includes('豁免已过期'), '详情面板显示豁免已过期');
eq(transClass(expiredPane, '待复核'), 'trans current', '过期项当前状态显示为待复核');
eq(transClass(expiredPane, '豁免中'), 'trans', '过期项可重新申请豁免（不拦截）');
eq(transClass(expiredPane, '已批准'), 'trans', '过期项可批准');
const validPane = (0, server_1.renderToString)((0, react_1.createElement)(DetailPane_1.default, {
    dep: mkSsrDep({ status: 'exempted', exemption: { reason: '有效', until: NOW5 + 86400000 } }),
    project: null, audit: [], now: NOW5, onClose: noop, onTransition: noop, onExempt: noop,
}));
eq(transClass(validPane, '豁免中'), 'trans current', '有效豁免当前状态为豁免中');
const approvedPane = (0, server_1.renderToString)((0, react_1.createElement)(DetailPane_1.default, {
    dep: mkSsrDep({ status: 'approved' }),
    project: null, audit: [], now: NOW5, onClose: noop, onTransition: noop, onExempt: noop,
}));
eq(transClass(approvedPane, '豁免中'), 'trans blocked', '已批准→豁免中显示拦截');
eq(transClass(approvedPane, '已批准'), 'trans current', '已批准当前状态高亮');
console.log(failures === 0 ? '\nSSR ALL PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
