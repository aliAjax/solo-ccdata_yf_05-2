"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = BatchBar;
const jsx_runtime_1 = require("react/jsx-runtime");
const lucide_react_1 = require("lucide-react");
/** 批量操作栏：选中依赖后出现，所有操作合并为一步历史记录 */
function BatchBar({ count, projects, onAssign, onApprove, onExempt, onReject, onRemove, onClear }) {
    if (count === 0)
        return null;
    return ((0, jsx_runtime_1.jsxs)("div", { className: "batch-bar", children: [(0, jsx_runtime_1.jsxs)("b", { children: [count, " \u9879\u5DF2\u9009"] }), (0, jsx_runtime_1.jsxs)("select", { value: "", onChange: e => { if (e.target.value !== '')
                    onAssign(e.target.value === 'none' ? null : Number(e.target.value)); }, title: "\u6279\u91CF\u5F52\u5165\u9879\u76EE", children: [(0, jsx_runtime_1.jsx)("option", { value: "", disabled: true, children: "\u5F52\u5165\u9879\u76EE\u2026" }), projects.map(p => (0, jsx_runtime_1.jsx)("option", { value: p.id, children: p.name }, p.id)), (0, jsx_runtime_1.jsx)("option", { value: "none", children: "\u79FB\u51FA\u9879\u76EE\uFF08\u672A\u5F52\u5165\uFF09" })] }), (0, jsx_runtime_1.jsxs)("button", { className: "mini ok", onClick: onApprove, children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Check, { size: 13 }), "\u6279\u51C6"] }), (0, jsx_runtime_1.jsxs)("button", { className: "mini warn", onClick: onExempt, children: [(0, jsx_runtime_1.jsx)(lucide_react_1.ShieldQuestion, { size: 13 }), "\u8C41\u514D\u2026"] }), (0, jsx_runtime_1.jsxs)("button", { className: "mini danger", onClick: onReject, children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Ban, { size: 13 }), "\u9A73\u56DE"] }), (0, jsx_runtime_1.jsxs)("button", { className: "mini ghost", onClick: onRemove, children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { size: 13 }), "\u5220\u9664"] }), (0, jsx_runtime_1.jsxs)("button", { className: "mini ghost", onClick: onClear, children: [(0, jsx_runtime_1.jsx)(lucide_react_1.X, { size: 13 }), "\u53D6\u6D88\u9009\u62E9"] })] }));
}
