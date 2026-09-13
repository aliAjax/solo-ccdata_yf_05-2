// ---------- 基础模型 ----------

export type PolicyKind = 'internal' | 'closed' | 'open';
export type DepStatus = 'pending' | 'approved' | 'exempted' | 'rejected';
export type Risk = 'low' | 'medium' | 'high';

/** 附加义务：命中指定许可证时触发；level=notice 仅提示，duty 计为中等风险 */
export interface Obligation {
  license: string;
  text: string;
  level: 'notice' | 'duty';
}

export interface Policy {
  kind: PolicyKind;
  /** 禁止许可：命中即高风险 */
  banned: string[];
  /** 附加义务：按许可证触发 */
  obligations: Obligation[];
  /** 例外期限：豁免默认有效天数 */
  exceptionDays: number;
  /** 生效范围：仅对这些来源的依赖生效 */
  scope: { sources: string[] };
}

export interface Project {
  id: number;
  name: string;
  policy: Policy;
  createdAt: number;
}

export interface Exemption {
  reason: string;
  /** 过期时间戳（ms） */
  until: number;
}

/** 豁免申请输入：until 为 null 时按各依赖所属项目的例外期限分别计算 */
export interface ExemptionInput {
  reason: string;
  until: number | null;
}

export interface Dep {
  id: number;
  name: string;
  version: string;
  license: string;
  source: string;
  projectId: number | null;
  status: DepStatus;
  note: string;
  exemption: Exemption | null;
  updatedAt: number;
}

export interface AuditEntry {
  id: number;
  at: number;
  actor: string;
  action: string;
  detail: string;
  projectId: number | null;
  depId: number | null;
}

export interface Store {
  seq: number;
  projects: Project[];
  deps: Dep[];
  audit: AuditEntry[];
}

// ---------- 常量 ----------

export const LICENSES = [
  'MIT', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', 'ISC',
  'MPL-2.0', 'LGPL-2.1', 'LGPL-3.0', 'GPL-2.0', 'GPL-3.0',
  'AGPL-3.0', 'EPL-2.0', 'CC0-1.0', 'CC-BY-NC-4.0', 'SSPL-1.0',
  'Unlicense', 'Proprietary', 'Unknown',
];

export const SOURCES = ['npm', '手动', '镜像', 'CI 扫描'];

export const STATUS_LABEL: Record<DepStatus, string> = {
  pending: '待复核',
  approved: '已批准',
  exempted: '豁免中',
  rejected: '已驳回',
};

export const KIND_LABEL: Record<PolicyKind, string> = {
  internal: '内部分发',
  closed: '闭源分发',
  open: '开源发布',
};

export const RISK_LABEL: Record<Risk, string> = { low: '低风险', medium: '需关注', high: '高风险' };

export const ACTION_LABEL: Record<string, string> = {
  'project.create': '新建项目',
  'project.delete': '删除项目',
  'policy.update': '更新政策',
  'dep.add': '添加依赖',
  'dep.assign': '批量归入',
  'dep.unassign': '移出项目',
  'dep.transition': '状态流转',
  'dep.remove': '删除依赖',
  'snapshot.import': '导入快照',
};

/** 合法流转表：重复（原地）与不在表内的流转一律拦截 */
export const TRANSITIONS: Record<DepStatus, DepStatus[]> = {
  pending: ['approved', 'exempted', 'rejected'],
  approved: ['pending', 'rejected'],
  exempted: ['pending', 'approved', 'rejected'],
  rejected: ['pending'],
};

export function transitionError(from: DepStatus, to: DepStatus): string | null {
  if (from === to) return `重复流转：已处于「${STATUS_LABEL[to]}」`;
  if (!TRANSITIONS[from].includes(to)) {
    return `非法流转：不能从「${STATUS_LABEL[from]}」直接变为「${STATUS_LABEL[to]}」`;
  }
  return null;
}

// ---------- 政策预设 ----------

export const POLICY_PRESETS: Record<PolicyKind, Policy> = {
  internal: {
    kind: 'internal',
    banned: ['CC-BY-NC-4.0', 'SSPL-1.0', 'Proprietary', 'Unknown'],
    obligations: [
      { license: 'GPL-3.0', text: '仅限内部使用，对外分发前必须重新评估', level: 'duty' },
      { license: 'AGPL-3.0', text: '禁止用于对外提供的网络服务', level: 'duty' },
      { license: 'LGPL-3.0', text: '修改库文件需记录变更说明', level: 'notice' },
      { license: 'BSD-3-Clause', text: '再发布需保留版权声明', level: 'notice' },
    ],
    exceptionDays: 90,
    scope: { sources: [...SOURCES] },
  },
  closed: {
    kind: 'closed',
    banned: ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0', 'SSPL-1.0', 'CC-BY-NC-4.0', 'Proprietary', 'Unknown'],
    obligations: [
      { license: 'LGPL-2.1', text: '需动态链接并允许用户替换库文件', level: 'duty' },
      { license: 'LGPL-3.0', text: '需动态链接并允许用户替换库文件', level: 'duty' },
      { license: 'MPL-2.0', text: '修改过的 MPL 文件需开源', level: 'duty' },
      { license: 'EPL-2.0', text: '衍生作品需以 EPL-2.0 发布', level: 'duty' },
      { license: 'MIT', text: '分发时需保留版权与许可声明', level: 'notice' },
      { license: 'BSD-3-Clause', text: '分发时需保留版权与许可声明', level: 'notice' },
      { license: 'Apache-2.0', text: '保留声明并附带 NOTICE 文件', level: 'notice' },
    ],
    exceptionDays: 30,
    scope: { sources: [...SOURCES] },
  },
  open: {
    kind: 'open',
    banned: ['Proprietary', 'CC-BY-NC-4.0', 'Unknown'],
    obligations: [
      { license: 'GPL-3.0', text: '衍生作品须以 GPL-3.0 开源', level: 'duty' },
      { license: 'AGPL-3.0', text: '网络服务也须开放源代码', level: 'duty' },
      { license: 'LGPL-3.0', text: '库本身的修改需开源', level: 'duty' },
      { license: 'Apache-2.0', text: '保留 NOTICE 与版权声明', level: 'notice' },
    ],
    exceptionDays: 60,
    scope: { sources: [...SOURCES] },
  },
};

export function clonePolicy(kind: PolicyKind): Policy {
  return JSON.parse(JSON.stringify(POLICY_PRESETS[kind])) as Policy;
}

// ---------- 派生计算 ----------

export function inScope(dep: Pick<Dep, 'source'>, policy: Policy): boolean {
  return policy.scope.sources.includes(dep.source);
}

export function exemptionExpired(dep: Dep, now: number): boolean {
  return dep.status === 'exempted' && !!dep.exemption && dep.exemption.until <= now;
}

/** 过期豁免视同待复核 */
export function effectiveStatus(dep: Dep, now: number): DepStatus {
  return exemptionExpired(dep, now) ? 'pending' : dep.status;
}

/** 按项目政策重算风险；未归入项目或不在生效范围返回 null（不适用） */
export function computeRisk(dep: Dep, policy: Policy | null): Risk | null {
  if (!policy || !inScope(dep, policy)) return null;
  if (policy.banned.includes(dep.license)) return 'high';
  const ob = policy.obligations.find(o => o.license === dep.license);
  if (ob && ob.level === 'duty') return 'medium';
  return 'low';
}

export function depKey(name: string, version: string): string {
  return `${name.trim().toLowerCase()}@${version.trim()}`;
}

export function fmtTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fmtDate(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
