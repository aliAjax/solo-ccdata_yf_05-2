import { useEffect, useRef, useState } from 'react';
import {
  AuditEntry, Dep, DepStatus, Exemption, ExemptionInput, KIND_LABEL, Policy, PolicyKind, Project,
  STATUS_LABEL, Store, clonePolicy, computeRisk, depKey, effectiveStatus, exemptionExpired, fmtDate, transitionError,
} from './types';
import { ImportAnalysis, buildSnapshot } from './snapshot';

const KEY = 'license-workbench:v1';
const OLD_KEY = 'license-lens';
const ACTOR = 'Zen Li';
const AUDIT_CAP = 1000;
const HISTORY_CAP = 60;
const DAY = 86400000;

export interface Toast { id: number; text: string; tone: 'ok' | 'warn' | 'error' }

// ---------- 历史（纯函数，可测试） ----------

export interface PastEntry { store: Store; label: string }
export interface History { past: PastEntry[]; future: PastEntry[]; current: Store }

export function histCommit(h: History, next: Store, label: string): History {
  return {
    past: [...h.past.slice(-(HISTORY_CAP - 1)), { store: h.current, label }],
    future: [],
    current: next,
  };
}

export function histUndo(h: History): { hist: History; label: string } | null {
  if (!h.past.length) return null;
  const last = h.past[h.past.length - 1];
  return {
    hist: {
      past: h.past.slice(0, -1),
      future: [{ store: h.current, label: last.label }, ...h.future].slice(0, HISTORY_CAP),
      current: last.store,
    },
    label: last.label,
  };
}

export function histRedo(h: History): { hist: History; label: string } | null {
  if (!h.future.length) return null;
  const first = h.future[0];
  return {
    hist: {
      past: [...h.past, { store: h.current, label: first.label }].slice(-HISTORY_CAP),
      future: h.future.slice(1),
      current: first.store,
    },
    label: first.label,
  };
}

// ---------- 动作（纯函数，可测试） ----------

export interface ActionResult {
  /** null 表示状态无变化，仅提示 */
  next: Store | null;
  label: string;
  message: string;
  tone: 'ok' | 'warn' | 'error';
}

function appendAudit(s: Store, entries: Array<Omit<AuditEntry, 'id'>>): Store {
  if (!entries.length) return s;
  let seq = s.seq;
  const audit = [...s.audit];
  for (const e of entries) audit.push({ ...e, id: seq++ });
  return { ...s, seq, audit: audit.slice(-AUDIT_CAP) };
}

export function actAddProject(s: Store, name: string, kind: PolicyKind, now: number): ActionResult {
  const id = s.seq;
  const project: Project = { id, name, policy: clonePolicy(kind), createdAt: now };
  let next: Store = { ...s, seq: id + 1, projects: [...s.projects, project] };
  next = appendAudit(next, [{
    at: now, actor: ACTOR, action: 'project.create',
    detail: `新建项目「${name}」，套用${KIND_LABEL[kind]}政策`, projectId: id, depId: null,
  }]);
  return { next, label: `新建项目「${name}」`, message: `项目「${name}」已创建，政策：${KIND_LABEL[kind]}`, tone: 'ok' };
}

export function actDeleteProject(s: Store, projectId: number, now: number): ActionResult {
  const project = s.projects.find(p => p.id === projectId);
  if (!project) return { next: null, label: '', message: '项目不存在', tone: 'error' };
  const affected = s.deps.filter(d => d.projectId === projectId).length;
  const deps = s.deps.map(d => d.projectId === projectId ? { ...d, projectId: null, updatedAt: now } : d);
  let next: Store = { ...s, projects: s.projects.filter(p => p.id !== projectId), deps };
  next = appendAudit(next, [{
    at: now, actor: ACTOR, action: 'project.delete',
    detail: `删除项目「${project.name}」，${affected} 个依赖移为未归入`, projectId: null, depId: null,
  }]);
  return {
    next, label: `删除项目「${project.name}」`,
    message: `项目「${project.name}」已删除${affected ? `，${affected} 个依赖移为未归入` : ''}`, tone: 'ok',
  };
}

export function actUpdatePolicy(s: Store, projectId: number, policy: Policy, now: number): ActionResult {
  const project = s.projects.find(p => p.id === projectId);
  if (!project) return { next: null, label: '', message: '项目不存在', tone: 'error' };
  let next: Store = { ...s, projects: s.projects.map(p => p.id === projectId ? { ...p, policy } : p) };
  next = appendAudit(next, [{
    at: now, actor: ACTOR, action: 'policy.update',
    detail: `更新政策：${KIND_LABEL[policy.kind]}，禁止 ${policy.banned.length} 项许可，附加义务 ${policy.obligations.length} 条，例外期限 ${policy.exceptionDays} 天，生效范围 ${policy.scope.sources.join('/')}`,
    projectId, depId: null,
  }]);
  return { next, label: `更新「${project.name}」政策`, message: `「${project.name}」政策已更新，风险已按新政策重算`, tone: 'ok' };
}

export function actAddDep(s: Store, input: { name: string; version: string; license: string; source: string; projectId: number | null }, now: number): ActionResult {
  const id = s.seq;
  const dep: Dep = {
    id, name: input.name, version: input.version, license: input.license, source: input.source,
    projectId: input.projectId, status: 'pending', note: '手动添加，待复核', exemption: null, updatedAt: now,
  };
  let next: Store = { ...s, seq: id + 1, deps: [...s.deps, dep] };
  const project = input.projectId === null ? null : s.projects.find(p => p.id === input.projectId);
  next = appendAudit(next, [{
    at: now, actor: ACTOR, action: 'dep.add',
    detail: `添加依赖 ${dep.name}@${dep.version}（${dep.license}）${project ? `，归入「${project.name}」` : '，未归入项目'}`,
    projectId: input.projectId, depId: id,
  }]);
  return { next, label: `添加依赖 ${dep.name}`, message: `已添加 ${dep.name}，状态：待复核`, tone: 'ok' };
}

/** 批量归入项目（或移出），归入后按目标项目政策重算风险 */
export function actAssignDeps(s: Store, ids: number[], projectId: number | null, now: number): ActionResult {
  const target = projectId === null ? null : s.projects.find(p => p.id === projectId);
  if (projectId !== null && !target) return { next: null, label: '', message: '目标项目不存在', tone: 'error' };
  const idSet = new Set(ids);
  const moving = s.deps.filter(d => idSet.has(d.id) && d.projectId !== projectId);
  const skipped = ids.length - moving.length;
  if (!moving.length) return { next: null, label: '', message: '所选依赖均已在目标位置，未发生变化', tone: 'warn' };
  const movingIds = new Set(moving.map(d => d.id));
  const deps = s.deps.map(d => movingIds.has(d.id) ? { ...d, projectId, updatedAt: now } : d);
  const targetName = target ? target.name : '未归入';
  let next: Store = { ...s, deps };
  next = appendAudit(next, moving.map(d => ({
    at: now, actor: ACTOR, action: target ? 'dep.assign' : 'dep.unassign',
    detail: target ? `归入项目「${target.name}」` : '移出项目，转为未归入',
    projectId, depId: d.id,
  })));
  let message: string;
  let tone: ActionResult['tone'] = 'ok';
  if (target) {
    const c = { high: 0, medium: 0, low: 0, na: 0 };
    for (const d of moving) {
      const r = computeRisk(d, target.policy);
      if (r === null) c.na++; else c[r === 'high' ? 'high' : r === 'medium' ? 'medium' : 'low']++;
    }
    const parts = [
      c.high ? `高风险 ${c.high}` : '',
      c.medium ? `需关注 ${c.medium}` : '',
      c.low ? `低风险 ${c.low}` : '',
      c.na ? `不在政策范围 ${c.na}` : '',
    ].filter(Boolean).join(' · ');
    message = `已将 ${moving.length} 项归入「${target.name}」并按其政策重算风险：${parts}`;
    if (c.high) tone = 'warn';
  } else {
    message = `已将 ${moving.length} 项移出项目`;
  }
  if (skipped) message += `（${skipped} 项原本就在目标位置）`;
  return { next, label: `批量归入 ${moving.length} 项 → ${targetName}`, message, tone };
}

/** 批量状态流转：重复与非法流转逐项拦截，合法项一次性提交（一步撤销）。
 *  过期豁免按 effectiveStatus=待复核 参与流转，可重新申请豁免；
 *  豁免截止时间为 null 时按每个依赖所属项目的例外期限分别计算。 */
export function actTransitionDeps(s: Store, ids: number[], target: DepStatus, exemption: ExemptionInput | undefined, now: number): ActionResult {
  const idSet = new Set(ids);
  // 豁免参数对整批统一校验
  const exemptErr = target !== 'exempted' ? null
    : !exemption || !exemption.reason.trim() ? '缺少豁免信息'
    : exemption.until !== null && exemption.until <= now ? '豁免截止时间必须晚于当前时间'
    : null;
  const applied: Array<{ dep: Dep; from: DepStatus }> = [];
  const blocked: Array<{ dep: Dep; reason: string }> = [];
  for (const d of s.deps) {
    if (!idSet.has(d.id)) continue;
    const from = effectiveStatus(d, now);
    const err = transitionError(from, target) ?? exemptErr;
    if (err) blocked.push({ dep: d, reason: err });
    else applied.push({ dep: d, from });
  }
  if (!applied.length) {
    const first = blocked[0];
    return {
      next: null, label: '',
      message: `流转被拦截${blocked.length > 1 ? `（${blocked.length} 项）` : ''}：${first ? first.reason : '没有可执行的流转'}`,
      tone: 'error',
    };
  }
  const appliedIds = new Set(applied.map(a => a.dep.id));
  const daysFor = (d: Dep) => s.projects.find(p => p.id === d.projectId)?.policy.exceptionDays ?? 30;
  const resolveExemption = (d: Dep): Exemption => ({
    reason: exemption!.reason.trim(),
    until: exemption!.until ?? now + daysFor(d) * DAY,
  });
  const deps = s.deps.map(d => appliedIds.has(d.id)
    ? { ...d, status: target, exemption: target === 'exempted' ? resolveExemption(d) : d.exemption, updatedAt: now }
    : d);
  let next: Store = { ...s, deps };
  next = appendAudit(next, applied.map(({ dep: d, from }) => {
    const fromLabel = exemptionExpired(d, now) ? '豁免已过期' : STATUS_LABEL[from];
    const ex = target === 'exempted' ? resolveExemption(d) : null;
    return {
      at: now, actor: ACTOR, action: 'dep.transition',
      detail: `「${fromLabel}」→「${STATUS_LABEL[target]}」${ex ? `，豁免至 ${fmtDate(ex.until)}：${ex.reason}` : ''}`,
      projectId: d.projectId, depId: d.id,
    };
  }));
  let message = `已流转 ${applied.length} 项 → ${STATUS_LABEL[target]}`;
  if (target === 'exempted' && exemption) {
    message += exemption.until !== null ? `，统一截止 ${fmtDate(exemption.until)}` : '，按各项目例外期限分别生效';
  }
  let tone: ActionResult['tone'] = 'ok';
  if (blocked.length) {
    const reasons = [...new Set(blocked.map(b => b.reason))].join('；');
    message += `；拦截 ${blocked.length} 项：${reasons}`;
    tone = 'warn';
  }
  return { next, label: `批量流转 ${applied.length} 项 → ${STATUS_LABEL[target]}`, message, tone };
}

export function actRemoveDeps(s: Store, ids: number[], now: number): ActionResult {
  const idSet = new Set(ids);
  const removed = s.deps.filter(d => idSet.has(d.id));
  if (!removed.length) return { next: null, label: '', message: '没有选中的依赖', tone: 'warn' };
  let next: Store = { ...s, deps: s.deps.filter(d => !idSet.has(d.id)) };
  next = appendAudit(next, removed.map(d => ({
    at: now, actor: ACTOR, action: 'dep.remove',
    detail: `删除依赖 ${d.name}@${d.version}`, projectId: d.projectId, depId: null,
  })));
  return { next, label: `删除 ${removed.length} 个依赖`, message: `已删除 ${removed.length} 个依赖`, tone: 'ok' };
}

/** 应用导入分析：重映射 id，项目/依赖/操作记录一次性入库 */
export function actApplyImport(s: Store, analysis: ImportAnalysis, now: number): ActionResult {
  const snap = analysis.snapshot;
  if (!analysis.ok || !snap) return { next: null, label: '', message: '导入分析无效', tone: 'error' };
  let seq = s.seq;
  const pid = seq++;
  const project: Project = { id: pid, name: snap.project.name, policy: snap.project.policy, createdAt: now };
  const nameToId = new Map<string, number>();
  const newDeps: Dep[] = snap.deps.map(d => {
    const id = seq++;
    nameToId.set(d.name, id);
    return { ...d, id, projectId: pid };
  });
  const importedAudit: AuditEntry[] = snap.audit.map(a => ({
    id: seq++, at: a.at, actor: a.actor, action: a.action, detail: a.detail,
    projectId: pid, depId: a.depName ? nameToId.get(a.depName) ?? null : null,
  }));
  importedAudit.push({
    id: seq++, at: now, actor: ACTOR, action: 'snapshot.import',
    detail: `导入快照 v${analysis.version}「${snap.project.name}」：${newDeps.length} 个依赖、${snap.audit.length} 条历史记录`,
    projectId: pid, depId: null,
  });
  const next: Store = {
    seq,
    projects: [...s.projects, project],
    deps: [...s.deps, ...newDeps],
    audit: [...s.audit, ...importedAudit].slice(-AUDIT_CAP),
  };
  return {
    next, label: `导入快照「${project.name}」`,
    message: `已导入「${project.name}」：${newDeps.length} 个依赖，政策与操作记录已恢复`, tone: 'ok',
  };
}

// ---------- 种子数据 ----------

type SeedDep = [string, string, string, string, number | null, DepStatus, number?];

const SEED_DEPS: SeedDep[] = [
  // name, version, license, source, projectIdx, status, 豁免剩余天数(负=已过期)
  ['react', '18.3.1', 'MIT', 'npm', 0, 'approved'],
  ['react-dom', '18.3.1', 'MIT', 'npm', 0, 'approved'],
  ['lodash', '4.17.21', 'MIT', 'npm', 0, 'approved'],
  ['chart.js', '4.4.4', 'MIT', 'npm', 0, 'approved'],
  ['highlight.js', '11.10.0', 'BSD-3-Clause', 'npm', 0, 'approved'],
  ['axios', '1.7.7', 'MIT', 'npm', 0, 'approved'],
  ['zustand', '4.5.5', 'MIT', 'npm', 0, 'approved'],
  ['xlsx', '0.18.5', 'Apache-2.0', 'npm', 0, 'approved'],
  ['sharp', '0.33.5', 'Apache-2.0', 'npm', 0, 'approved'],
  ['date-fns', '3.6.0', 'MIT', 'npm', 0, 'pending'],
  ['electron-store', '8.2.0', 'MIT', 'npm', 0, 'pending'],
  ['node-sqlite3', '5.1.7', 'BSD-3-Clause', 'npm', 0, 'pending'],
  ['legacy-parser', '2.1.0', 'GPL-3.0', '手动', 0, 'pending'],
  ['qt-bridge', '1.4.0', 'LGPL-3.0', 'npm', 0, 'exempted', 20],
  ['ffmpeg-static', '5.2.0', 'GPL-3.0', 'npm', 0, 'exempted', -5],
  ['old-tooltip', '0.9.9', 'CC-BY-NC-4.0', '手动', 0, 'rejected'],

  ['apache-arrow', '17.0.0', 'Apache-2.0', 'npm', 1, 'approved'],
  ['kafka-client', '2.2.4', 'Apache-2.0', 'npm', 1, 'approved'],
  ['grpc-tools', '1.12.4', 'Apache-2.0', 'npm', 1, 'approved'],
  ['jsonlines', '4.0.0', 'MIT', 'npm', 1, 'approved'],
  ['mysql-connector', '8.4.0', 'GPL-2.0', 'npm', 1, 'pending'],
  ['avro-js', '2.1.0', 'MIT', 'CI 扫描', 1, 'pending'],
  ['airflow-dag', '1.0.0', 'Proprietary', '手动', 1, 'pending'],
  ['cron-utils', '9.0.0', 'Unknown', 'CI 扫描', 1, 'pending'],
  ['parquet-lite', '1.2.0', 'LGPL-2.1', '镜像', 1, 'exempted', 45],
  ['sspl-db', '4.4.0', 'SSPL-1.0', '镜像', 1, 'rejected'],

  ['okhttp', '4.12.0', 'Apache-2.0', 'npm', 2, 'approved'],
  ['retrofit', '2.11.0', 'Apache-2.0', 'npm', 2, 'approved'],
  ['gson', '2.11.0', 'Apache-2.0', 'npm', 2, 'approved'],
  ['cc0-assets', '1.1.0', 'CC0-1.0', 'npm', 2, 'approved'],
  ['unlicense-text', '0.3.0', 'Unlicense', 'npm', 2, 'approved'],
  ['realm-core', '14.0.0', 'Apache-2.0', 'npm', 2, 'pending'],
  ['mpl-bridge', '3.3.0', 'MPL-2.0', 'npm', 2, 'pending'],
  ['agpl-media', '3.0.1', 'AGPL-3.0', '手动', 2, 'pending'],
  ['gpl-vocoder', '2.2.0', 'GPL-3.0', 'npm', 2, 'exempted', -2],
  ['proprietary-font', '1.0.0', 'Proprietary', '手动', 2, 'rejected'],

  ['left-pad', '1.3.0', 'MIT', 'npm', null, 'pending'],
  ['colors-polyfill', '0.1.0', 'MIT', 'npm', null, 'pending'],
  ['bsd2-sha', '1.0.2', 'BSD-2-Clause', 'npm', null, 'pending'],
  ['isc-stream', '0.8.1', 'ISC', 'npm', null, 'pending'],
  ['epl-charset', '2.0.0', 'EPL-2.0', '镜像', null, 'pending'],
  ['vendor-sdk', '9.9.9', 'Unknown', '手动', null, 'pending'],
];

const SEED_PROJECTS: Array<[string, PolicyKind]> = [
  ['Aurora Web', 'closed'],
  ['Data Pipeline', 'internal'],
  ['Mobile SDK', 'open'],
  ['试验场 Sandbox', 'internal'],
];

export function seedStore(): Store {
  const now = Date.now();
  let seq = 1;
  const projects: Project[] = SEED_PROJECTS.map(([name, kind]) => ({
    id: seq++, name, policy: clonePolicy(kind), createdAt: now - 30 * DAY,
  }));
  const deps: Dep[] = SEED_DEPS.map(([name, version, license, source, pidx, status, exemptDays]) => {
    const exempted = status === 'exempted';
    const projectId = pidx === null ? null : projects[pidx].id;
    const exceptionDays = pidx === null ? 30 : projects[pidx].policy.exceptionDays;
    return {
      id: seq++, name, version, license, source, projectId, status,
      note: exempted ? '经评估暂时豁免，到期前需替换或转正' : '按项目政策评估',
      exemption: exempted
        ? { reason: '短期兼容方案，等待替代库', until: now + (exemptDays ?? exceptionDays) * DAY }
        : null,
      updatedAt: now - Math.floor((seq * 37) % 20) * DAY,
    };
  });
  const audit: AuditEntry[] = projects.map(p => ({
    id: seq++, at: p.createdAt, actor: ACTOR, action: 'project.create',
    detail: `新建项目「${p.name}」，套用${KIND_LABEL[p.policy.kind]}政策`, projectId: p.id, depId: null,
  }));
  return { seq, projects, deps, audit };
}

// ---------- 旧版迁移 ----------

function migrateOld(oldDeps: Array<Record<string, unknown>>): Store {
  const now = Date.now();
  let seq = 1;
  const project: Project = { id: seq++, name: 'Aurora Web', policy: clonePolicy('closed'), createdAt: now };
  const statusMap: Record<string, DepStatus> = { ok: 'approved', warn: 'pending', risk: 'pending' };
  const deps: Dep[] = oldDeps
    .filter(d => d && typeof d.name === 'string')
    .map(d => ({
      id: seq++,
      name: String(d.name),
      version: typeof d.version === 'string' ? d.version : '1.0.0',
      license: typeof d.license === 'string' ? d.license : 'Unknown',
      source: typeof d.source === 'string' ? d.source : '手动',
      projectId: project.id,
      status: statusMap[String(d.status)] ?? 'pending',
      note: typeof d.note === 'string' ? d.note : '',
      exemption: null,
      updatedAt: now,
    }));
  const audit: AuditEntry[] = [{
    id: seq++, at: now, actor: ACTOR, action: 'project.create',
    detail: `从 License Lens 升级迁移 ${deps.length} 个依赖`, projectId: project.id, depId: null,
  }];
  return { seq, projects: [project], deps, audit };
}

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Store;
      if (s && typeof s.seq === 'number' && Array.isArray(s.projects) && Array.isArray(s.deps) && Array.isArray(s.audit)) {
        return s;
      }
    }
    const old = localStorage.getItem(OLD_KEY);
    if (old) {
      const arr = JSON.parse(old);
      if (Array.isArray(arr) && arr.length) return migrateOld(arr);
    }
  } catch { /* 数据损坏时回退到种子数据 */ }
  return seedStore();
}

// ---------- Hook（薄封装） ----------

export function useWorkbench() {
  const [hist, setHist] = useState<History>(() => ({ past: [], future: [], current: loadStore() }));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(0);
  const store = hist.current;

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* 存储满时静默失败 */ }
  }, [store]);

  const notify = (text: string, tone: Toast['tone'] = 'ok') => {
    const id = ++toastSeq.current;
    setToasts(ts => [...ts.slice(-4), { id, text, tone }]);
    setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), 4200);
  };

  const run = (r: ActionResult): boolean => {
    if (r.next) setHist(h => histCommit(h, r.next!, r.label));
    notify(r.message, r.tone);
    return r.next !== null;
  };

  const undo = () => {
    const r = histUndo(hist);
    if (!r) return;
    setHist(r.hist);
    notify(`已撤销：${r.label}`);
  };

  const redo = () => {
    const r = histRedo(hist);
    if (!r) return;
    setHist(r.hist);
    notify(`已重做：${r.label}`);
  };

  const exportSnapshot = (projectId: number) => {
    const project = store.projects.find(p => p.id === projectId);
    if (!project) return;
    const deps = store.deps.filter(d => d.projectId === projectId);
    const snapshot = buildSnapshot(project, deps, store.audit);
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${project.name.replace(/\s+/g, '-')}-snapshot-v${snapshot.version}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    notify(`已导出「${project.name}」快照：${deps.length} 个依赖、含政策与操作记录`);
  };

  return {
    store, toasts, notify,
    canUndo: hist.past.length > 0, canRedo: hist.future.length > 0, undo, redo,
    addProject: (name: string, kind: PolicyKind) => {
      const r = actAddProject(store, name, kind, Date.now());
      run(r);
      return r.next ? r.next.projects[r.next.projects.length - 1].id : -1;
    },
    deleteProject: (projectId: number) => run(actDeleteProject(store, projectId, Date.now())),
    updatePolicy: (projectId: number, policy: Policy) => run(actUpdatePolicy(store, projectId, policy, Date.now())),
    addDep: (input: { name: string; version: string; license: string; source: string; projectId: number | null }) =>
      run(actAddDep(store, input, Date.now())),
    assignDeps: (ids: number[], projectId: number | null) => run(actAssignDeps(store, ids, projectId, Date.now())),
    transitionDeps: (ids: number[], target: DepStatus, exemption?: ExemptionInput) =>
      run(actTransitionDeps(store, ids, target, exemption, Date.now())),
    removeDeps: (ids: number[]) => run(actRemoveDeps(store, ids, Date.now())),
    exportSnapshot,
    applyImport: (analysis: ImportAnalysis): number | null => {
      const r = actApplyImport(store, analysis, Date.now());
      run(r);
      return r.next ? r.next.projects[r.next.projects.length - 1].id : null;
    },
    existingDepKeys: () => new Set(store.deps.map(d => depKey(d.name, d.version))),
    existingProjectNames: () => store.projects.map(p => p.name),
  };
}
