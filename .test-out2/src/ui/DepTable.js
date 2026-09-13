"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.licenseColor = licenseColor;
exports.default = DepTable;
const jsx_runtime_1 = require("react/jsx-runtime");
const lucide_react_1 = require("lucide-react");
const types_1 = require("../types");
const LICENSE_COLORS = {
    MIT: '#35b995', 'BSD-2-Clause': '#6d9ee8', 'BSD-3-Clause': '#6d9ee8', 'Apache-2.0': '#b18ee4',
    ISC: '#35b995', 'MPL-2.0': '#e8a06d', 'LGPL-2.1': '#e8a06d', 'LGPL-3.0': '#e8a06d',
    'GPL-2.0': '#ec8c75', 'GPL-3.0': '#ec8c75', 'AGPL-3.0': '#e06a5a', 'EPL-2.0': '#e8a06d',
    'CC0-1.0': '#7ec8a9', 'CC-BY-NC-4.0': '#d06a8a', 'SSPL-1.0': '#d06a8a',
    Unlicense: '#7ec8a9', Proprietary: '#c05555', Unknown: '#999999',
};
function licenseColor(license) {
    return LICENSE_COLORS[license] ?? '#888888';
}
function DepTable({ deps, projects, showProject, selected, onToggle, onToggleAll, onOpen, detailId, now }) {
    const projectOf = (id) => projects.find(p => p.id === id) ?? null;
    const allChecked = deps.length > 0 && deps.every(d => selected.has(d.id));
    const someChecked = deps.some(d => selected.has(d.id));
    return ((0, jsx_runtime_1.jsxs)("div", { className: "table", children: [(0, jsx_runtime_1.jsxs)("div", { className: showProject ? 'tr th wide' : 'tr th', children: [(0, jsx_runtime_1.jsx)("span", { className: "cell-check", onClick: e => e.stopPropagation(), children: (0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: allChecked, ref: el => { if (el)
                                el.indeterminate = !allChecked && someChecked; }, onChange: () => onToggleAll(deps.map(d => d.id)), title: "\u5168\u9009\u5F53\u524D\u5217\u8868" }) }), (0, jsx_runtime_1.jsx)("span", { children: "\u4F9D\u8D56\u540D\u79F0" }), (0, jsx_runtime_1.jsx)("span", { children: "\u7248\u672C" }), (0, jsx_runtime_1.jsx)("span", { children: "\u8BB8\u53EF\u8BC1" }), showProject && (0, jsx_runtime_1.jsx)("span", { children: "\u9879\u76EE" }), (0, jsx_runtime_1.jsx)("span", { children: "\u98CE\u9669" }), (0, jsx_runtime_1.jsx)("span", { children: "\u72B6\u6001" })] }), deps.map(d => {
                const project = projectOf(d.projectId);
                const risk = (0, types_1.computeRisk)(d, project ? project.policy : null);
                const expired = (0, types_1.exemptionExpired)(d, now);
                const eff = (0, types_1.effectiveStatus)(d, now);
                const checked = selected.has(d.id);
                return ((0, jsx_runtime_1.jsxs)("div", { className: `tr${showProject ? ' wide' : ''}${d.id === detailId ? ' selected' : ''}${checked ? ' checked' : ''}`, onClick: () => onOpen(d.id), role: "button", tabIndex: 0, children: [(0, jsx_runtime_1.jsx)("span", { className: "cell-check", onClick: e => e.stopPropagation(), children: (0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: checked, onChange: () => onToggle(d.id) }) }), (0, jsx_runtime_1.jsxs)("span", { className: "dep-name", children: [(0, jsx_runtime_1.jsx)("span", { className: "pkg-dot" }), d.name] }), (0, jsx_runtime_1.jsx)("span", { className: "muted", children: d.version }), (0, jsx_runtime_1.jsx)("span", { children: (0, jsx_runtime_1.jsx)("i", { className: "license", style: { color: licenseColor(d.license), background: licenseColor(d.license) + '18' }, children: d.license }) }), showProject && (0, jsx_runtime_1.jsx)("span", { className: "muted", children: project ? project.name : '未归入' }), (0, jsx_runtime_1.jsx)("span", { children: risk === null
                                ? (0, jsx_runtime_1.jsx)("i", { className: "risk na", children: "\u4E0D\u9002\u7528" })
                                : (0, jsx_runtime_1.jsxs)("i", { className: `risk ${risk}`, children: [risk === 'high' ? (0, jsx_runtime_1.jsx)(lucide_react_1.AlertTriangle, { size: 11 }) : risk === 'low' ? (0, jsx_runtime_1.jsx)(lucide_react_1.Check, { size: 11 }) : (0, jsx_runtime_1.jsx)(lucide_react_1.Minus, { size: 11 }), types_1.RISK_LABEL[risk]] }) }), (0, jsx_runtime_1.jsx)("span", { children: expired
                                ? (0, jsx_runtime_1.jsx)("i", { className: "st expired", children: "\u8C41\u514D\u5DF2\u8FC7\u671F" })
                                : (0, jsx_runtime_1.jsxs)("i", { className: `st ${eff}`, children: [types_1.STATUS_LABEL[d.status], d.status === 'exempted' && d.exemption ? ` · ${(0, types_1.fmtDate)(d.exemption.until)} 到期` : ''] }) })] }, d.id));
            }), deps.length === 0 && (0, jsx_runtime_1.jsx)("div", { className: "table-empty", children: "\u6CA1\u6709\u5339\u914D\u7684\u4F9D\u8D56" })] }));
}
