"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = DetailPane;
const jsx_runtime_1 = require("react/jsx-runtime");
const lucide_react_1 = require("lucide-react");
const types_1 = require("../types");
const DepTable_1 = require("./DepTable");
const STATUS_ORDER = ['pending', 'approved', 'exempted', 'rejected'];
const STATUS_ICON = {
    pending: (0, jsx_runtime_1.jsx)(lucide_react_1.Clock3, { size: 13 }),
    approved: (0, jsx_runtime_1.jsx)(lucide_react_1.Check, { size: 13 }),
    exempted: (0, jsx_runtime_1.jsx)(lucide_react_1.ShieldQuestion, { size: 13 }),
    rejected: (0, jsx_runtime_1.jsx)(lucide_react_1.Ban, { size: 13 }),
};
function DetailPane({ dep, project, audit, now, onClose, onTransition, onExempt }) {
    const policy = project ? project.policy : null;
    const risk = (0, types_1.computeRisk)(dep, policy);
    const expired = (0, types_1.exemptionExpired)(dep, now);
    const eff = (0, types_1.effectiveStatus)(dep, now);
    const obligation = policy?.obligations.find(o => o.license === dep.license) ?? null;
    const banned = !!policy && policy.banned.includes(dep.license);
    const scoped = !!policy && (0, types_1.inScope)(dep, policy);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "detail", children: [(0, jsx_runtime_1.jsxs)("div", { className: "detail-head", children: [(0, jsx_runtime_1.jsx)("div", { className: "detail-icon", style: { background: (0, DepTable_1.licenseColor)(dep.license) + '1c', color: (0, DepTable_1.licenseColor)(dep.license) }, children: (0, jsx_runtime_1.jsx)(lucide_react_1.FileCode2, { size: 20 }) }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("span", { children: "SELECTED DEPENDENCY" }), (0, jsx_runtime_1.jsx)("h2", { children: dep.name })] }), (0, jsx_runtime_1.jsx)("button", { className: "close", onClick: onClose, children: (0, jsx_runtime_1.jsx)(lucide_react_1.X, { size: 16 }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "detail-grid four", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { children: "\u7248\u672C" }), (0, jsx_runtime_1.jsx)("b", { children: dep.version })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { children: "\u6765\u6E90" }), (0, jsx_runtime_1.jsx)("b", { children: dep.source })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { children: "\u8BB8\u53EF\u8BC1" }), (0, jsx_runtime_1.jsx)("b", { children: dep.license })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { children: "\u6240\u5C5E\u9879\u76EE" }), (0, jsx_runtime_1.jsx)("b", { children: project ? project.name : '未归入' })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: `finding ${risk ?? 'na'}`, children: [(0, jsx_runtime_1.jsx)("div", { className: "finding-icon", children: risk === 'low' ? (0, jsx_runtime_1.jsx)(lucide_react_1.Check, { size: 15 }) : (0, jsx_runtime_1.jsx)(lucide_react_1.AlertTriangle, { size: 15 }) }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("b", { children: !policy ? '未归入项目，未评估' : !scoped ? '不在政策生效范围内' : `按「${project.name}」政策：${types_1.RISK_LABEL[risk]}` }), (0, jsx_runtime_1.jsxs)("p", { children: [!policy && '归入项目后将按该项目政策自动重算风险。', policy && !scoped && `来源「${dep.source}」未包含在政策生效范围（${policy.scope.sources.join('、')}）内。`, policy && scoped && banned && `${dep.license} 在该政策的禁止许可清单中，建议替换或移除。`, policy && scoped && !banned && obligation && `附加义务：${obligation.text}。`, policy && scoped && !banned && !obligation && '未命中禁止许可或附加义务，可正常流转。'] })] })] }), dep.status === 'exempted' && dep.exemption && ((0, jsx_runtime_1.jsxs)("div", { className: expired ? 'exempt-box expired' : 'exempt-box', children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Clock3, { size: 14 }), (0, jsx_runtime_1.jsx)("b", { children: expired ? '豁免已过期' : `豁免至 ${(0, types_1.fmtDate)(dep.exemption.until)}` })] }), (0, jsx_runtime_1.jsx)("p", { children: dep.exemption.reason || '（未填写豁免理由）' }), expired && (0, jsx_runtime_1.jsx)("p", { className: "warn-text", children: "\u5DF2\u8D85\u8FC7\u4F8B\u5916\u671F\u9650\uFF0C\u8BE5\u4F9D\u8D56\u89C6\u540C\u300C\u5F85\u590D\u6838\u300D\uFF0C\u8BF7\u91CD\u65B0\u6D41\u8F6C\u3002" })] })), (0, jsx_runtime_1.jsxs)("div", { className: "trans-box", children: [(0, jsx_runtime_1.jsxs)("label", { children: ["\u72B6\u6001\u6D41\u8F6C", expired ? '（豁免已过期，按待复核参与流转）' : '（重复与非法流转将被拦截）'] }), (0, jsx_runtime_1.jsx)("div", { className: "trans-row", children: STATUS_ORDER.map(s => {
                            const err = (0, types_1.transitionError)(eff, s);
                            const current = eff === s;
                            const cls = current ? 'trans current' : err ? 'trans blocked' : 'trans';
                            return ((0, jsx_runtime_1.jsxs)("button", { className: cls, title: err ?? `流转为「${types_1.STATUS_LABEL[s]}」`, onClick: () => {
                                    if (s === 'exempted' && !err)
                                        onExempt();
                                    else
                                        onTransition(s);
                                }, children: [STATUS_ICON[s], types_1.STATUS_LABEL[s]] }, s));
                        }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "history", children: [(0, jsx_runtime_1.jsxs)("div", { className: "history-head", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Info, { size: 14 }), (0, jsx_runtime_1.jsx)("span", { children: "\u64CD\u4F5C\u8BB0\u5F55" })] }), audit.length === 0 && (0, jsx_runtime_1.jsx)("p", { className: "muted-line", children: "\u6682\u65E0\u8BB0\u5F55" }), audit.map(a => ((0, jsx_runtime_1.jsxs)("div", { className: "history-item", children: [(0, jsx_runtime_1.jsx)("span", { className: "history-time", children: (0, types_1.fmtTime)(a.at) }), (0, jsx_runtime_1.jsx)("span", { className: "history-action", children: types_1.ACTION_LABEL[a.action] ?? a.action }), (0, jsx_runtime_1.jsxs)("span", { className: "history-detail", children: [a.detail, " \u00B7 ", a.actor] })] }, a.id)))] })] }));
}
