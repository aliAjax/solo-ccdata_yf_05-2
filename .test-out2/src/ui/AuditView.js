"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AuditView;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const types_1 = require("../types");
/** 全局操作记录视图 */
function AuditView({ audit, projects }) {
    const [projectFilter, setProjectFilter] = (0, react_1.useState)('all');
    const nameOf = (id) => id === null ? '—' : projects.find(p => p.id === id)?.name ?? '（已删除项目）';
    const rows = (0, react_1.useMemo)(() => {
        const filtered = projectFilter === 'all'
            ? audit
            : audit.filter(a => String(a.projectId) === projectFilter);
        return [...filtered].sort((a, b) => b.at - a.at).slice(0, 300);
    }, [audit, projectFilter]);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "table-pane", children: [(0, jsx_runtime_1.jsxs)("div", { className: "pane-head", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", { children: "\u64CD\u4F5C\u8BB0\u5F55" }), (0, jsx_runtime_1.jsxs)("p", { children: ["\u9879\u76EE\u3001\u653F\u7B56\u4E0E\u4F9D\u8D56\u7684\u5168\u90E8\u64CD\u4F5C\u5386\u53F2\uFF08\u6700\u65B0 ", rows.length, " \u6761\uFF09"] })] }), (0, jsx_runtime_1.jsx)("div", { className: "tools", children: (0, jsx_runtime_1.jsxs)("select", { value: projectFilter, onChange: e => setProjectFilter(e.target.value), children: [(0, jsx_runtime_1.jsx)("option", { value: "all", children: "\u5168\u90E8\u9879\u76EE" }), projects.map(p => (0, jsx_runtime_1.jsx)("option", { value: String(p.id), children: p.name }, p.id))] }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "table", children: [(0, jsx_runtime_1.jsxs)("div", { className: "tr th audit-row", children: [(0, jsx_runtime_1.jsx)("span", { children: "\u65F6\u95F4" }), (0, jsx_runtime_1.jsx)("span", { children: "\u64CD\u4F5C" }), (0, jsx_runtime_1.jsx)("span", { children: "\u9879\u76EE" }), (0, jsx_runtime_1.jsx)("span", { children: "\u8BE6\u60C5" }), (0, jsx_runtime_1.jsx)("span", { children: "\u64CD\u4F5C\u8005" })] }), rows.map(a => ((0, jsx_runtime_1.jsxs)("div", { className: "tr audit-row", children: [(0, jsx_runtime_1.jsx)("span", { className: "muted", children: (0, types_1.fmtTime)(a.at) }), (0, jsx_runtime_1.jsx)("span", { children: (0, jsx_runtime_1.jsx)("i", { className: "audit-action", children: types_1.ACTION_LABEL[a.action] ?? a.action }) }), (0, jsx_runtime_1.jsx)("span", { className: "muted", children: nameOf(a.projectId) }), (0, jsx_runtime_1.jsx)("span", { children: a.detail }), (0, jsx_runtime_1.jsx)("span", { className: "muted", children: a.actor })] }, a.id))), rows.length === 0 && (0, jsx_runtime_1.jsx)("div", { className: "table-empty", children: "\u6682\u65E0\u64CD\u4F5C\u8BB0\u5F55" })] })] }));
}
