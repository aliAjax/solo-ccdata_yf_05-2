"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sameRoute = sameRoute;
exports.default = Sidebar;
const jsx_runtime_1 = require("react/jsx-runtime");
const lucide_react_1 = require("lucide-react");
const types_1 = require("../types");
function sameRoute(a, b) {
    if (a.type !== b.type)
        return false;
    return a.type !== 'project' || (b.type === 'project' && a.id === b.id);
}
function Sidebar({ projects, deps, route, onRoute, onNewProject, onDeleteProject, now }) {
    const expiredCount = deps.filter(d => (0, types_1.exemptionExpired)(d, now)).length;
    return ((0, jsx_runtime_1.jsxs)("aside", { children: [(0, jsx_runtime_1.jsxs)("div", { className: "brand", children: [(0, jsx_runtime_1.jsx)("div", { className: "brand-icon", children: (0, jsx_runtime_1.jsx)(lucide_react_1.ShieldCheck, { size: 18 }) }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("b", { children: "License Lens" }), (0, jsx_runtime_1.jsx)("small", { children: "compliance workbench" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "nav-title", children: ["\u9879\u76EE", (0, jsx_runtime_1.jsx)("button", { className: "nav-add", title: "\u65B0\u5EFA\u9879\u76EE", onClick: onNewProject, children: (0, jsx_runtime_1.jsx)(lucide_react_1.FolderPlus, { size: 14 }) })] }), projects.map(p => {
                const list = deps.filter(d => d.projectId === p.id);
                const high = list.filter(d => (0, types_1.effectiveStatus)(d, now) === 'pending' && (0, types_1.computeRisk)(d, p.policy) === 'high').length;
                const active = sameRoute(route, { type: 'project', id: p.id });
                return ((0, jsx_runtime_1.jsxs)("button", { className: active ? 'nav active' : 'nav', onClick: () => onRoute({ type: 'project', id: p.id }), children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Layers3, { size: 15 }), (0, jsx_runtime_1.jsx)("span", { className: "nav-name", children: p.name }), list.length === 0 && (0, jsx_runtime_1.jsx)("i", { className: "badge empty", children: "\u7A7A" }), high > 0 && (0, jsx_runtime_1.jsx)("i", { className: "badge red", children: high }), (0, jsx_runtime_1.jsx)("span", { className: "nav-count", children: list.length }), (0, jsx_runtime_1.jsx)("span", { className: "nav-del", title: "\u5220\u9664\u9879\u76EE", onClick: e => {
                                e.stopPropagation();
                                if (window.confirm(`删除项目「${p.name}」？其 ${list.length} 个依赖将移为未归入。`))
                                    onDeleteProject(p.id);
                            }, children: (0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { size: 13 }) })] }, p.id));
            }), (0, jsx_runtime_1.jsx)("div", { className: "nav-title", children: "\u89C6\u56FE" }), (0, jsx_runtime_1.jsxs)("button", { className: route.type === 'all' ? 'nav active' : 'nav', onClick: () => onRoute({ type: 'all' }), children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Layers3, { size: 15 }), (0, jsx_runtime_1.jsx)("span", { className: "nav-name", children: "\u5168\u90E8\u4F9D\u8D56" }), (0, jsx_runtime_1.jsx)("span", { className: "nav-count", children: deps.length })] }), (0, jsx_runtime_1.jsxs)("button", { className: route.type === 'expired' ? 'nav active' : 'nav', onClick: () => onRoute({ type: 'expired' }), children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Clock3, { size: 15 }), (0, jsx_runtime_1.jsx)("span", { className: "nav-name", children: "\u8C41\u514D\u8FC7\u671F" }), expiredCount > 0 && (0, jsx_runtime_1.jsx)("i", { className: "badge red", children: expiredCount })] }), (0, jsx_runtime_1.jsxs)("button", { className: route.type === 'audit' ? 'nav active' : 'nav', onClick: () => onRoute({ type: 'audit' }), children: [(0, jsx_runtime_1.jsx)(lucide_react_1.ScrollText, { size: 15 }), (0, jsx_runtime_1.jsx)("span", { className: "nav-name", children: "\u64CD\u4F5C\u8BB0\u5F55" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "aside-bottom", children: [(0, jsx_runtime_1.jsxs)("div", { className: "mini-card", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.AlertTriangle, { size: 15 }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("b", { children: "\u6570\u636E\u5DF2\u672C\u5730\u4FDD\u5B58" }), (0, jsx_runtime_1.jsx)("small", { children: "\u5237\u65B0\u540E\u81EA\u52A8\u6062\u590D \u00B7 \u652F\u6301\u64A4\u9500/\u91CD\u505A" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "user", children: [(0, jsx_runtime_1.jsx)("div", { className: "avatar", children: "ZL" }), (0, jsx_runtime_1.jsx)("span", { children: "Zen Li" })] })] })] }));
}
