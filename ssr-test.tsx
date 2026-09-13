import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import App from './src/App';

let failures = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) { failures++; console.error(`FAIL ${msg}`); } else console.log(`ok ${msg}`);
}

class LS {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
const ls = new LS();
(globalThis as unknown as { localStorage: LS }).localStorage = ls;

// 1) 全新启动：种子数据渲染
let html = renderToString(createElement(App));
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
html = renderToString(createElement(App));
ok(html.includes('react'), '旧数据迁移：依赖保留');
ok(html.includes('Aurora Web'), '旧数据迁移：默认项目');
ok(!html.includes('试验场'), '迁移后不出现种子项目');

// 3) 损坏数据回退
ls.clear();
ls.setItem('license-workbench:v1', '{broken json!!!');
html = renderToString(createElement(App));
ok(html.includes('Aurora Web'), '损坏数据回退到种子');

// 4) 持久化数据恢复（模拟刷新）
ls.clear();
ls.setItem('license-workbench:v1', JSON.stringify({
  seq: 10,
  projects: [{ id: 1, name: 'Persisted Proj', policy: { kind: 'open', banned: ['Unknown'], obligations: [], exceptionDays: 15, scope: { sources: ['npm'] } }, createdAt: 1 }],
  deps: [{ id: 2, name: 'persisted-dep', version: '9.9.9', license: 'MIT', source: 'npm', projectId: 1, status: 'approved', note: '', exemption: null, updatedAt: 1 }],
  audit: [],
}));
html = renderToString(createElement(App));
ok(html.includes('Persisted Proj'), '刷新后项目保留');
ok(html.includes('persisted-dep'), '刷新后依赖保留');
ok(html.includes('开源发布'), '刷新后政策保留');

console.log(failures === 0 ? '\nSSR ALL PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
