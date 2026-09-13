import {
  TRANSITIONS, computeRisk, effectiveStatus, exemptionExpired, transitionError,
  clonePolicy, fmtDate, Dep, DepStatus,
} from './src/types';
import { analyzeSnapshot, buildSnapshot, SNAPSHOT_VERSION } from './src/snapshot';
import {
  seedStore, histCommit, histUndo, histRedo, History,
  actAddProject, actDeleteProject, actAddDep, actAssignDeps,
  actTransitionDeps, actRemoveDeps, actApplyImport,
} from './src/store';

let failures = 0;
function eq(actual: unknown, expected: unknown, msg: string) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) { failures++; console.error(`FAIL ${msg}: got ${a}, want ${e}`); }
  else console.log(`ok ${msg}`);
}
function ok(cond: boolean, msg: string) { eq(cond, true, msg); }

const NOW = 1_800_000_000_000;
const mkDep = (over: Partial<Dep>): Dep => ({
  id: 1, name: 'x', version: '1.0.0', license: 'MIT', source: 'npm',
  projectId: 1, status: 'pending', note: '', exemption: null, updatedAt: NOW, ...over,
});

// ---- 流转表 ----
const all: DepStatus[] = ['pending', 'approved', 'exempted', 'rejected'];
for (const s of all) ok(!!transitionError(s, s)?.includes('重复'), `重复流转被拦截 ${s}`);
ok(!!transitionError('approved', 'exempted')?.includes('非法'), 'approved→exempted 非法');
ok(!!transitionError('rejected', 'approved')?.includes('非法'), 'rejected→approved 非法');
ok(!!transitionError('rejected', 'exempted')?.includes('非法'), 'rejected→exempted 非法');
eq(transitionError('pending', 'approved'), null, 'pending→approved 合法');
eq(transitionError('pending', 'exempted'), null, 'pending→exempted 合法');
eq(transitionError('pending', 'rejected'), null, 'pending→rejected 合法');
eq(transitionError('approved', 'pending'), null, 'approved→pending 合法');
eq(transitionError('approved', 'rejected'), null, 'approved→rejected 合法');
eq(transitionError('exempted', 'approved'), null, 'exempted→approved 合法');
eq(transitionError('rejected', 'pending'), null, 'rejected→pending 合法');
eq(Object.keys(TRANSITIONS).length, 4, '流转表覆盖全部状态');

// ---- 风险重算 ----
const closed = clonePolicy('closed');
ok(closed.banned.includes('GPL-3.0'), '闭源政策禁止 GPL-3.0');
eq(computeRisk(mkDep({ license: 'GPL-3.0' }), closed), 'high', '禁止许可=高风险');
eq(computeRisk(mkDep({ license: 'LGPL-3.0' }), closed), 'medium', 'duty 义务=需关注');
eq(computeRisk(mkDep({ license: 'MIT' }), closed), 'low', 'notice 义务=低风险');
eq(computeRisk(mkDep({ license: 'ISC' }), closed), 'low', '无义务=低风险');
eq(computeRisk(mkDep({ source: '镜像' }), { ...closed, scope: { sources: ['npm'] } }), null, '不在生效范围=不适用');
eq(computeRisk(mkDep({}), null), null, '未归入项目=不适用');
const internal = clonePolicy('internal');
eq(computeRisk(mkDep({ license: 'GPL-3.0' }), internal), 'medium', '内部政策下 GPL-3.0 仅提示义务');
eq(computeRisk(mkDep({ license: 'SSPL-1.0' }), internal), 'high', '内部政策禁止 SSPL');

// ---- 过期豁免 ----
const expiredDep = mkDep({ status: 'exempted', exemption: { reason: 'r', until: NOW - 1000 } });
ok(exemptionExpired(expiredDep, NOW), '过期豁免判定');
eq(effectiveStatus(expiredDep, NOW), 'pending', '过期豁免视同待复核');
const validDep = mkDep({ status: 'exempted', exemption: { reason: 'r', until: NOW + 1000 } });
ok(!exemptionExpired(validDep, NOW), '有效豁免未过期');
eq(effectiveStatus(validDep, NOW), 'exempted', '有效豁免保持豁免状态');

// ---- 快照导出/导入 ----
const project = { id: 7, name: 'Aurora Web', policy: closed, createdAt: NOW };
const deps: Dep[] = [
  mkDep({ id: 11, name: 'react', version: '18.3.1', status: 'approved', projectId: 7 }),
  mkDep({ id: 12, name: 'legacy-parser', version: '2.1.0', license: 'GPL-3.0', status: 'pending', projectId: 7 }),
];
const auditSrc = [
  { id: 21, at: NOW, actor: 'ZL', action: 'dep.transition', detail: '「待复核」→「已批准」', projectId: 7, depId: 11 },
  { id: 22, at: NOW, actor: 'ZL', action: 'policy.update', detail: '更新政策', projectId: 7, depId: null },
  { id: 23, at: NOW, actor: 'ZL', action: 'dep.add', detail: '其他项目', projectId: 8, depId: 99 },
];
const snap = buildSnapshot(project, deps, auditSrc);
eq(snap.format, 'license-workbench-snapshot', '快照格式标识');
eq(snap.version, SNAPSHOT_VERSION, '快照版本');
eq(snap.deps.length, 2, '快照含依赖');
eq(snap.audit.length, 2, '快照只含本项目操作记录');
eq(snap.audit[0].depName, 'react', '操作记录按名称引用依赖');
eq(snap.project.policy.banned, closed.banned, '快照含政策');

eq(analyzeSnapshot('not json', { projectNames: [], depKeys: new Set() }).ok, false, '非 JSON 被拒绝');
eq(analyzeSnapshot('{}', { projectNames: [], depKeys: new Set() }).ok, false, '缺少格式标识被拒绝');
const tooNew = analyzeSnapshot(JSON.stringify({ ...snap, version: 99 }), { projectNames: [], depKeys: new Set() });
eq(tooNew.ok, false, '过新版本被拒绝');
ok((tooNew.error ?? '').includes('v99'), '版本错误信息含版本号');

const clean = analyzeSnapshot(JSON.stringify(snap), { projectNames: [], depKeys: new Set() });
eq(clean.ok, true, '干净快照可导入');
eq(clean.conflicts.length, 0, '干净快照无冲突');
eq(clean.depCount, 2, '导入依赖数');

const dirty = analyzeSnapshot(JSON.stringify({
  ...snap,
  deps: [
    ...snap.deps,
    { name: 'react', version: '18.3.1', license: 'MIT', source: 'npm', status: 'approved', note: '', exemption: null, updatedAt: NOW },
    { name: 'evil', version: '6.6.6', license: 'WTFPL-2.0', source: '暗网', status: 'bogus', note: '', exemption: null, updatedAt: NOW },
  ],
}), { projectNames: ['Aurora Web'], depKeys: new Set(['react@18.3.1']) });
eq(dirty.ok, true, '有冲突仍可导入');
ok(dirty.finalName !== 'Aurora Web', '重名项目被改名');
ok(dirty.conflicts.some(c => c.includes('已存在')), '报告项目名冲突');
ok(dirty.conflicts.some(c => c.includes('react@18.3.1')), '报告依赖重复');
eq(dirty.depCount, 2, '重复依赖被跳过');
const evil = dirty.snapshot!.deps.find(d => d.name === 'evil')!;
eq(evil.license, 'Unknown', '未知许可证清洗为 Unknown');
eq(evil.source, '手动', '未知来源清洗为 手动');
eq(evil.status, 'pending', '非法状态清洗为 pending');

const allDup = analyzeSnapshot(JSON.stringify(snap), { projectNames: [], depKeys: new Set(['react@18.3.1', 'legacy-parser@2.1.0']) });
eq(allDup.ok, false, '全部重复时拒绝导入');

// ---- 历史栈 ----
const s0 = seedStore();
let h: History = { past: [], future: [], current: s0 };
const r1 = actAddProject(s0, 'Test Proj', 'open', NOW);
h = histCommit(h, r1.next!, r1.label);
eq(h.current.projects.length, s0.projects.length + 1, '提交后项目+1');
eq(h.past.length, 1, '历史+1');
const u1 = histUndo(h)!;
eq(u1.hist.current.projects.length, s0.projects.length, '撤销恢复项目数');
eq(u1.label, '新建项目「Test Proj」', '撤销返回标签');
const r2 = histRedo(u1.hist)!;
eq(r2.hist.current.projects.length, s0.projects.length + 1, '重做恢复项目+1');
eq(histUndo({ past: [], future: [], current: s0 }), null, '空历史撤销返回 null');
eq(histRedo({ past: [], future: [], current: s0 }), null, '空未来重做返回 null');

// ---- 批量流转：合法/重复/非法混合 ----
const seed = seedStore();
const aurora = seed.projects[0];
const auroraDeps = seed.deps.filter(d => d.projectId === aurora.id);
const pendingIds = auroraDeps.filter(d => d.status === 'pending').map(d => d.id);
const approvedIds = auroraDeps.filter(d => d.status === 'approved').map(d => d.id);
const rejectedIds = auroraDeps.filter(d => d.status === 'rejected').map(d => d.id);
ok(pendingIds.length > 0 && approvedIds.length > 0 && rejectedIds.length > 0, '种子含各状态依赖');
const mixed = [...pendingIds, approvedIds[0], rejectedIds[0]];
const tr = actTransitionDeps(seed, mixed, 'approved', undefined, NOW);
ok(tr.next !== null, '混合批量流转有结果');
eq(tr.tone, 'warn', '混合批量流转提示警告');
eq(tr.next!.deps.filter(d => mixed.includes(d.id) && d.status === 'approved').length, pendingIds.length + 1, '仅待复核项被批准（含原本已批准项）');
eq(tr.next!.deps.find(d => d.id === rejectedIds[0])!.status, 'rejected', '被拦截项状态不变');
ok(tr.message.includes('拦截 2 项'), '拦截计数正确');
ok(tr.message.includes('重复') && tr.message.includes('非法'), '拦截原因含重复与非法');

const allBlocked = actTransitionDeps(seed, [approvedIds[0]], 'approved', undefined, NOW);
eq(allBlocked.next, null, '全部拦截时不产生新状态');
eq(allBlocked.tone, 'error', '全部拦截提示错误');
ok(allBlocked.message.includes('重复流转'), '全拦截消息含原因');

const noExempt = actTransitionDeps(seed, pendingIds, 'exempted', undefined, NOW);
eq(noExempt.next, null, '缺少豁免信息时拦截');

const withExempt = actTransitionDeps(seed, pendingIds, 'exempted', { reason: '测试', until: NOW + 86400000 }, NOW);
ok(withExempt.next !== null, '带豁免信息可流转');
ok(withExempt.next!.deps.every(d => !pendingIds.includes(d.id) || d.exemption?.reason === '测试'), '豁免信息写入');

// ---- 大批量：一次提交 = 一步撤销 ----
const allIds = seed.deps.map(d => d.id);
let h2: History = { past: [], future: [], current: seed };
const bigAssign = actAssignDeps(seed, allIds, aurora.id, NOW);
h2 = histCommit(h2, bigAssign.next!, bigAssign.label);
eq(h2.current.deps.filter(d => d.projectId === aurora.id).length, allIds.length, '大批量归入生效');
eq(h2.past.length, 1, '大批量归入仅一步历史');
ok(bigAssign.message.includes('高风险'), '归入消息含风险重算结果');
const undoBig = histUndo(h2)!;
eq(undoBig.hist.current.deps.filter(d => d.projectId === aurora.id).length, auroraDeps.length, '一步撤销恢复全部');

const alreadyThere = actAssignDeps(seed, auroraDeps.map(d => d.id), aurora.id, NOW);
eq(alreadyThere.next, null, '全部已在目标项目时不产生变化');
eq(alreadyThere.tone, 'warn', '无变化提示警告');

// ---- 删除项目：依赖移为未归入 ----
const del = actDeleteProject(seed, aurora.id, NOW);
ok(del.next!.projects.every(p => p.id !== aurora.id), '项目已删除');
ok(del.next!.deps.every(d => d.projectId !== aurora.id), '依赖移为未归入');

// ---- 导入应用：id 重映射 ----
const imp = actApplyImport(seed, clean, NOW);
ok(imp.next !== null, '导入产生新状态');
const newProj = imp.next!.projects[imp.next!.projects.length - 1];
eq(newProj.name, 'Aurora Web', '导入项目名');
ok(newProj.id !== 7, '项目 id 重映射');
const impDeps = imp.next!.deps.filter(d => d.projectId === newProj.id);
eq(impDeps.length, 2, '导入依赖数');
ok(impDeps.every(d => d.id !== 11 && d.id !== 12), '依赖 id 重映射');
const impAudit = imp.next!.audit.filter(a => a.projectId === newProj.id);
ok(impAudit.length >= 3, '导入操作记录+导入事件');
ok(impAudit.some(a => a.action === 'snapshot.import'), '记录导入事件本身');
const linked = impAudit.find(a => a.depId !== null);
ok(linked && impDeps.some(d => d.id === linked.depId), '操作记录关联到新依赖 id');

// ---- 种子数据不变量 ----
ok(seed.projects.some(p => !seed.deps.some(d => d.projectId === p.id)), '种子含空项目');
ok(seed.deps.some(d => exemptionExpired(d, Date.now())), '种子含过期豁免');
ok(seed.deps.some(d => d.status === 'exempted' && !exemptionExpired(d, Date.now())), '种子含有效豁免');
ok(seed.deps.some(d => d.projectId === null), '种子含未归入依赖');
const ids = new Set<number>();
let seqOk = true;
for (const list of [seed.projects, seed.deps, seed.audit] as Array<Array<{ id: number }>>) {
  for (const x of list) { if (ids.has(x.id) || x.id >= seed.seq) seqOk = false; ids.add(x.id); }
}
ok(seqOk, '种子 id 唯一且小于 seq');
eq(seed.projects.length, 4, '种子项目数');
ok(seed.deps.length >= 40, '种子依赖规模支持大批量演示');

// ---- 删除/添加依赖 ----
const rm = actRemoveDeps(seed, allIds.slice(0, 5), NOW);
eq(rm.next!.deps.length, seed.deps.length - 5, '批量删除依赖');
const add = actAddDep(seed, { name: 'new-lib', version: '1.0.0', license: 'MIT', source: 'npm', projectId: null }, NOW);
eq(add.next!.deps.length, seed.deps.length + 1, '添加依赖');
eq(add.next!.deps[add.next!.deps.length - 1].status, 'pending', '新依赖默认待复核');

// ---- 过期豁免按待复核参与流转 ----
const DAY_MS = 86400000;
const T = Date.now();
const expired1 = seed.deps.find(d => exemptionExpired(d, T))!;
eq(expired1.status, 'exempted', '过期项原始状态仍为豁免');
eq(effectiveStatus(expired1, T), 'pending', '过期项有效状态为待复核');

const dupPending = actTransitionDeps(seed, [expired1.id], 'pending', undefined, T);
eq(dupPending.next, null, '过期项→待复核视为重复被拦截');
ok(dupPending.message.includes('重复'), '过期项→待复核提示重复');

const expApprove = actTransitionDeps(seed, [expired1.id], 'approved', undefined, T);
ok(expApprove.next !== null, '过期项可直接批准');

// 单项重豁免：状态、到期日、记录一致
const expiredProj = seed.projects.find(p => p.id === expired1.projectId)!;
const re = actTransitionDeps(seed, [expired1.id], 'exempted', { reason: '重新申请豁免', until: null }, T);
ok(re.next !== null, '过期项可重新申请豁免');
const reDep = re.next!.deps.find(d => d.id === expired1.id)!;
eq(reDep.status, 'exempted', '重豁免后状态为豁免中');
eq(reDep.exemption!.reason, '重新申请豁免', '重豁免理由更新');
eq(reDep.exemption!.until, T + expiredProj.policy.exceptionDays * DAY_MS, '重豁免期限按所属项目政策');
ok(!exemptionExpired(reDep, T), '重豁免后不再过期');
const reAudit = re.next!.audit[re.next!.audit.length - 1];
ok(reAudit.detail.includes('豁免已过期') && reAudit.detail.includes('豁免中'), '重豁免记录含流转路径');
ok(reAudit.detail.includes('重新申请豁免') && reAudit.detail.includes(fmtDate(reDep.exemption!.until)), '重豁免记录含理由与到期日');

// ---- 混合项目批量豁免：按各自政策分别生效 ----
const [p0, p1, p2] = seed.projects; // closed=30 / internal=90 / open=60
const m0 = seed.deps.find(d => d.projectId === p0.id && d.status === 'pending')!;
const m1 = seed.deps.find(d => d.projectId === p1.id && d.status === 'pending')!;
const m2 = seed.deps.find(d => d.projectId === p2.id && d.status === 'pending')!;
const mixedBatch = actTransitionDeps(seed, [m0.id, m1.id, m2.id], 'exempted', { reason: '混合批量', until: null }, T);
ok(mixedBatch.next !== null, '混合项目批量豁免成功');
const untilOf = (id: number) => mixedBatch.next!.deps.find(d => d.id === id)!.exemption!.until;
eq(untilOf(m0.id), T + 30 * DAY_MS, '闭源项目按 30 天');
eq(untilOf(m1.id), T + 90 * DAY_MS, '内部项目按 90 天');
eq(untilOf(m2.id), T + 60 * DAY_MS, '开源项目按 60 天');
ok(mixedBatch.message.includes('分别生效'), '混合批量消息提示分别生效');
const mixedAudits = mixedBatch.next!.audit.slice(-3);
eq(mixedAudits.length, 3, '混合批量记录数');
ok(mixedAudits.find(a => a.depId === m0.id)!.detail.includes(fmtDate(untilOf(m0.id))), '记录含闭源项目到期日');
ok(mixedAudits.find(a => a.depId === m1.id)!.detail.includes(fmtDate(untilOf(m1.id))), '记录含内部项目到期日');
ok(mixedAudits.find(a => a.depId === m2.id)!.detail.includes(fmtDate(untilOf(m2.id))), '记录含开源项目到期日');

// 统一截止日期仍覆盖整批
const uni = actTransitionDeps(seed, [m0.id, m1.id], 'exempted', { reason: '统一', until: T + 7 * DAY_MS }, T);
ok(uni.next!.deps.every(d => ![m0.id, m1.id].includes(d.id) || d.exemption!.until === T + 7 * DAY_MS), '统一截止日期覆盖整批');

// 无效截止时间拦截
const badUntil = actTransitionDeps(seed, [m0.id], 'exempted', { reason: 'x', until: T - 1000 }, T);
eq(badUntil.next, null, '过去截止时间被拦截');
eq(badUntil.tone, 'error', '无效截止时间提示错误');
ok(badUntil.message.includes('截止时间'), '无效截止时间消息含原因');
const badUntilBatch = actTransitionDeps(seed, [m0.id, m1.id], 'exempted', { reason: 'x', until: T - 1000 }, T);
eq(badUntilBatch.next, null, '批量中无效截止时间整批拦截');

// 未归入项目按默认 30 天
const unassigned = seed.deps.find(d => d.projectId === null)!;
const unRes = actTransitionDeps(seed, [unassigned.id], 'exempted', { reason: 'x', until: null }, T);
eq(unRes.next!.deps.find(d => d.id === unassigned.id)!.exemption!.until, T + 30 * DAY_MS, '未归入项目按默认 30 天');

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
