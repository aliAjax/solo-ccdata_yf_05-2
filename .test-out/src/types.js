"use strict";
// ---------- 基础模型 ----------
Object.defineProperty(exports, "__esModule", { value: true });
exports.POLICY_PRESETS = exports.TRANSITIONS = exports.ACTION_LABEL = exports.RISK_LABEL = exports.KIND_LABEL = exports.STATUS_LABEL = exports.SOURCES = exports.LICENSES = void 0;
exports.transitionError = transitionError;
exports.clonePolicy = clonePolicy;
exports.inScope = inScope;
exports.exemptionExpired = exemptionExpired;
exports.effectiveStatus = effectiveStatus;
exports.computeRisk = computeRisk;
exports.depKey = depKey;
exports.fmtTime = fmtTime;
exports.fmtDate = fmtDate;
// ---------- 常量 ----------
exports.LICENSES = [
    'MIT', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', 'ISC',
    'MPL-2.0', 'LGPL-2.1', 'LGPL-3.0', 'GPL-2.0', 'GPL-3.0',
    'AGPL-3.0', 'EPL-2.0', 'CC0-1.0', 'CC-BY-NC-4.0', 'SSPL-1.0',
    'Unlicense', 'Proprietary', 'Unknown',
];
exports.SOURCES = ['npm', '手动', '镜像', 'CI 扫描'];
exports.STATUS_LABEL = {
    pending: '待复核',
    approved: '已批准',
    exempted: '豁免中',
    rejected: '已驳回',
};
exports.KIND_LABEL = {
    internal: '内部分发',
    closed: '闭源分发',
    open: '开源发布',
};
exports.RISK_LABEL = { low: '低风险', medium: '需关注', high: '高风险' };
exports.ACTION_LABEL = {
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
exports.TRANSITIONS = {
    pending: ['approved', 'exempted', 'rejected'],
    approved: ['pending', 'rejected'],
    exempted: ['pending', 'approved', 'rejected'],
    rejected: ['pending'],
};
function transitionError(from, to) {
    if (from === to)
        return `重复流转：已处于「${exports.STATUS_LABEL[to]}」`;
    if (!exports.TRANSITIONS[from].includes(to)) {
        return `非法流转：不能从「${exports.STATUS_LABEL[from]}」直接变为「${exports.STATUS_LABEL[to]}」`;
    }
    return null;
}
// ---------- 政策预设 ----------
exports.POLICY_PRESETS = {
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
        scope: { sources: [...exports.SOURCES] },
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
        scope: { sources: [...exports.SOURCES] },
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
        scope: { sources: [...exports.SOURCES] },
    },
};
function clonePolicy(kind) {
    return JSON.parse(JSON.stringify(exports.POLICY_PRESETS[kind]));
}
// ---------- 派生计算 ----------
function inScope(dep, policy) {
    return policy.scope.sources.includes(dep.source);
}
function exemptionExpired(dep, now) {
    return dep.status === 'exempted' && !!dep.exemption && dep.exemption.until <= now;
}
/** 过期豁免视同待复核 */
function effectiveStatus(dep, now) {
    return exemptionExpired(dep, now) ? 'pending' : dep.status;
}
/** 按项目政策重算风险；未归入项目或不在生效范围返回 null（不适用） */
function computeRisk(dep, policy) {
    if (!policy || !inScope(dep, policy))
        return null;
    if (policy.banned.includes(dep.license))
        return 'high';
    const ob = policy.obligations.find(o => o.license === dep.license);
    if (ob && ob.level === 'duty')
        return 'medium';
    return 'low';
}
function depKey(name, version) {
    return `${name.trim().toLowerCase()}@${version.trim()}`;
}
function fmtTime(ts) {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fmtDate(ts) {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
