import {
  AuditEntry, Dep, DepStatus, Exemption, LICENSES, Obligation, Policy, PolicyKind,
  POLICY_PRESETS, Project, SOURCES, depKey,
} from './types';

export const SNAPSHOT_FORMAT = 'license-workbench-snapshot';
export const SNAPSHOT_VERSION = 1;

/** 快照文件结构（v1）：政策 + 依赖状态 + 操作记录 */
export interface SnapshotFile {
  format: string;
  version: number;
  exportedAt: number;
  project: { name: string; policy: Policy };
  deps: Array<{
    name: string; version: string; license: string; source: string;
    status: DepStatus; note: string; exemption: Exemption | null; updatedAt: number;
  }>;
  audit: Array<{ at: number; actor: string; action: string; detail: string; depName: string | null }>;
}

export function buildSnapshot(project: Project, deps: Dep[], audit: AuditEntry[]): SnapshotFile {
  return {
    format: SNAPSHOT_FORMAT,
    version: SNAPSHOT_VERSION,
    exportedAt: Date.now(),
    project: { name: project.name, policy: project.policy },
    deps: deps.map(d => ({
      name: d.name, version: d.version, license: d.license, source: d.source,
      status: d.status, note: d.note, exemption: d.exemption, updatedAt: d.updatedAt,
    })),
    audit: audit
      .filter(a => a.projectId === project.id)
      .map(a => {
        const dep = a.depId != null ? deps.find(d => d.id === a.depId) : undefined;
        return { at: a.at, actor: a.actor, action: a.action, detail: a.detail, depName: dep ? dep.name : null };
      }),
  };
}

export interface ImportAnalysis {
  ok: boolean;
  error?: string;
  version?: number;
  exportedAt?: number;
  projectName?: string;
  finalName?: string;
  depCount?: number;
  auditCount?: number;
  skippedDeps?: number;
  conflicts: string[];
  snapshot?: SnapshotFile;
}

function sanitizePolicy(raw: unknown): Policy {
  const p = (raw ?? {}) as Partial<Policy>;
  const kind: PolicyKind = p.kind === 'internal' || p.kind === 'closed' || p.kind === 'open' ? p.kind : 'closed';
  const base = JSON.parse(JSON.stringify(POLICY_PRESETS[kind])) as Policy;
  if (Array.isArray(p.banned)) base.banned = p.banned.filter((l): l is string => typeof l === 'string' && LICENSES.includes(l));
  if (Array.isArray(p.obligations)) {
    base.obligations = p.obligations
      .filter((o): o is Obligation => !!o && typeof o.license === 'string' && typeof o.text === 'string')
      .map(o => ({ license: o.license, text: o.text, level: o.level === 'duty' ? 'duty' : 'notice' }));
  }
  if (typeof p.exceptionDays === 'number' && Number.isFinite(p.exceptionDays) && p.exceptionDays > 0) {
    base.exceptionDays = Math.min(3650, Math.round(p.exceptionDays));
  }
  if (p.scope && Array.isArray(p.scope.sources)) {
    const srcs = p.scope.sources.filter(s => typeof s === 'string' && SOURCES.includes(s));
    if (srcs.length) base.scope = { sources: srcs };
  }
  return base;
}

const VALID_STATUS: DepStatus[] = ['pending', 'approved', 'exempted', 'rejected'];

/**
 * 解析并分析快照：识别格式与版本，检测与现有工作区的冲突。
 * 不产生任何副作用；确认后由 store 应用。
 */
export function analyzeSnapshot(
  text: string,
  existing: { projectNames: string[]; depKeys: Set<string> },
): ImportAnalysis {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: '文件不是有效的 JSON', conflicts: [] };
  }
  const s = raw as Partial<SnapshotFile>;
  if (!s || typeof s !== 'object' || s.format !== SNAPSHOT_FORMAT) {
    return { ok: false, error: '无法识别的文件：缺少 license-workbench-snapshot 标识', conflicts: [] };
  }
  if (typeof s.version !== 'number') {
    return { ok: false, error: '快照缺少版本号', conflicts: [] };
  }
  if (s.version > SNAPSHOT_VERSION) {
    return { ok: false, error: `快照版本 v${s.version} 高于当前支持的 v${SNAPSHOT_VERSION}，请升级工作台`, conflicts: [] };
  }
  if (!s.project || typeof s.project.name !== 'string' || !s.project.name.trim()) {
    return { ok: false, error: '快照缺少项目信息', conflicts: [] };
  }
  if (!Array.isArray(s.deps)) {
    return { ok: false, error: '快照缺少依赖列表', conflicts: [] };
  }

  const conflicts: string[] = [];
  const projectName = s.project.name.trim();
  let finalName = projectName;
  if (existing.projectNames.includes(projectName)) {
    let i = 2;
    while (existing.projectNames.includes(`${projectName}（导入 ${i}）`)) i++;
    finalName = `${projectName}（导入）`;
    if (existing.projectNames.includes(finalName)) finalName = `${projectName}（导入 ${i}）`;
    conflicts.push(`项目名「${projectName}」已存在，将导入为「${finalName}」`);
  }

  const seen = new Set<string>();
  let skippedDeps = 0;
  const cleanDeps: SnapshotFile['deps'] = [];
  for (const d of s.deps) {
    if (!d || typeof d.name !== 'string' || !d.name.trim()) { skippedDeps++; continue; }
    const dep: SnapshotFile['deps'][number] = {
      name: d.name.trim(),
      version: typeof d.version === 'string' && d.version.trim() ? d.version.trim() : '0.0.0',
      license: typeof d.license === 'string' && LICENSES.includes(d.license) ? d.license : 'Unknown',
      source: typeof d.source === 'string' && SOURCES.includes(d.source) ? d.source : '手动',
      status: VALID_STATUS.includes(d.status) ? d.status : 'pending',
      note: typeof d.note === 'string' ? d.note : '',
      exemption: d.exemption && typeof d.exemption.until === 'number'
        ? { reason: String(d.exemption.reason ?? ''), until: d.exemption.until }
        : null,
      updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : Date.now(),
    };
    const key = depKey(dep.name, dep.version);
    if (seen.has(key)) { skippedDeps++; continue; }
    seen.add(key);
    if (existing.depKeys.has(key)) {
      skippedDeps++;
      conflicts.push(`依赖 ${dep.name}@${dep.version} 在工作区已存在，已跳过`);
      continue;
    }
    cleanDeps.push(dep);
  }
  if (cleanDeps.length === 0) {
    return { ok: false, error: '快照内没有可导入的依赖（全部重复或无效）', conflicts };
  }

  const cleanAudit = (Array.isArray(s.audit) ? s.audit : [])
    .filter(a => a && typeof a.at === 'number' && typeof a.action === 'string')
    .map(a => ({
      at: a.at,
      actor: typeof a.actor === 'string' ? a.actor : '导入',
      action: a.action,
      detail: typeof a.detail === 'string' ? a.detail : '',
      depName: typeof a.depName === 'string' ? a.depName : null,
    }));

  const snapshot: SnapshotFile = {
    format: SNAPSHOT_FORMAT,
    version: s.version,
    exportedAt: typeof s.exportedAt === 'number' ? s.exportedAt : Date.now(),
    project: { name: finalName, policy: sanitizePolicy(s.project.policy) },
    deps: cleanDeps,
    audit: cleanAudit,
  };

  return {
    ok: true,
    version: s.version,
    exportedAt: snapshot.exportedAt,
    projectName,
    finalName,
    depCount: cleanDeps.length,
    auditCount: cleanAudit.length,
    skippedDeps,
    conflicts,
    snapshot,
  };
}
