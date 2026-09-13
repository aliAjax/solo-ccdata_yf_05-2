"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectModal = ProjectModal;
exports.PolicyEditor = PolicyEditor;
exports.AddDepModal = AddDepModal;
exports.ExemptModal = ExemptModal;
exports.ImportModal = ImportModal;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const types_1 = require("../types");
function Shell({ title, onClose, children, wide }) {
    return ((0, jsx_runtime_1.jsx)("div", { className: "backdrop", onClick: onClose, children: (0, jsx_runtime_1.jsxs)("div", { className: wide ? 'modal wide' : 'modal', onClick: e => e.stopPropagation(), children: [(0, jsx_runtime_1.jsxs)("div", { className: "modal-head", children: [(0, jsx_runtime_1.jsx)("h2", { children: title }), (0, jsx_runtime_1.jsx)("button", { onClick: onClose, children: (0, jsx_runtime_1.jsx)(lucide_react_1.X, { size: 18 }) })] }), children] }) }));
}
// ---------- 新建项目 ----------
const KIND_DESC = {
    internal: '仅内部使用，限制最宽松',
    closed: '对外闭源分发，禁止 Copyleft',
    open: '以开源形式发布，禁止专有许可',
};
function ProjectModal({ onClose, onCreate }) {
    const [name, setName] = (0, react_1.useState)('');
    const [kind, setKind] = (0, react_1.useState)('closed');
    return ((0, jsx_runtime_1.jsxs)(Shell, { title: "\u65B0\u5EFA\u9879\u76EE", onClose: onClose, children: [(0, jsx_runtime_1.jsxs)("label", { children: ["\u9879\u76EE\u540D\u79F0", (0, jsx_runtime_1.jsx)("input", { autoFocus: true, value: name, onChange: e => setName(e.target.value), placeholder: "\u4F8B\u5982 Payment Service" })] }), (0, jsx_runtime_1.jsx)("label", { children: "\u5206\u53D1\u653F\u7B56" }), (0, jsx_runtime_1.jsx)("div", { className: "kind-grid", children: Object.keys(types_1.KIND_LABEL).map(k => ((0, jsx_runtime_1.jsxs)("button", { className: kind === k ? 'kind-card active' : 'kind-card', onClick: () => setKind(k), children: [(0, jsx_runtime_1.jsx)("b", { children: types_1.KIND_LABEL[k] }), (0, jsx_runtime_1.jsx)("small", { children: KIND_DESC[k] })] }, k))) }), (0, jsx_runtime_1.jsx)("button", { className: "primary full", disabled: !name.trim(), onClick: () => onCreate(name.trim(), kind), children: "\u521B\u5EFA\u9879\u76EE" })] }));
}
// ---------- 政策编辑器 ----------
function PolicyEditor({ project, onClose, onSave }) {
    const [policy, setPolicy] = (0, react_1.useState)(() => JSON.parse(JSON.stringify(project.policy)));
    const patch = (p) => setPolicy(prev => ({ ...prev, ...p }));
    const toggleBanned = (l) => patch({
        banned: policy.banned.includes(l) ? policy.banned.filter(x => x !== l) : [...policy.banned, l],
    });
    const toggleSource = (s) => {
        const sources = policy.scope.sources.includes(s)
            ? policy.scope.sources.filter(x => x !== s)
            : [...policy.scope.sources, s];
        patch({ scope: { sources } });
    };
    const setObligation = (i, o) => {
        const obligations = policy.obligations.map((x, idx) => idx === i ? { ...x, ...o } : x);
        patch({ obligations });
    };
    const valid = policy.scope.sources.length > 0 && policy.exceptionDays >= 1;
    return ((0, jsx_runtime_1.jsx)(Shell, { title: `编辑政策 · ${project.name}`, onClose: onClose, wide: true, children: (0, jsx_runtime_1.jsxs)("div", { className: "policy-edit", children: [(0, jsx_runtime_1.jsxs)("div", { className: "pe-row", children: [(0, jsx_runtime_1.jsx)("label", { children: "\u653F\u7B56\u7C7B\u578B" }), (0, jsx_runtime_1.jsxs)("div", { className: "pe-kind", children: [(0, jsx_runtime_1.jsx)("select", { value: policy.kind, onChange: e => patch({ kind: e.target.value }), children: Object.keys(types_1.KIND_LABEL).map(k => (0, jsx_runtime_1.jsx)("option", { value: k, children: types_1.KIND_LABEL[k] }, k)) }), (0, jsx_runtime_1.jsxs)("button", { className: "outline", onClick: () => setPolicy((0, types_1.clonePolicy)(policy.kind)), children: ["\u5957\u7528", types_1.KIND_LABEL[policy.kind], "\u9884\u8BBE"] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "pe-row", children: [(0, jsx_runtime_1.jsx)("label", { children: "\u7981\u6B62\u8BB8\u53EF\uFF08\u547D\u4E2D\u5373\u9AD8\u98CE\u9669\uFF09" }), (0, jsx_runtime_1.jsx)("div", { className: "chip-grid", children: types_1.LICENSES.map(l => ((0, jsx_runtime_1.jsx)("button", { className: policy.banned.includes(l) ? 'chip on' : 'chip', onClick: () => toggleBanned(l), children: l }, l))) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "pe-row", children: [(0, jsx_runtime_1.jsx)("label", { children: "\u9644\u52A0\u4E49\u52A1\uFF08\u6309\u8BB8\u53EF\u8BC1\u89E6\u53D1\uFF09" }), policy.obligations.map((o, i) => ((0, jsx_runtime_1.jsxs)("div", { className: "ob-row", children: [(0, jsx_runtime_1.jsx)("select", { value: o.license, onChange: e => setObligation(i, { license: e.target.value }), children: types_1.LICENSES.map(l => (0, jsx_runtime_1.jsx)("option", { children: l }, l)) }), (0, jsx_runtime_1.jsxs)("select", { value: o.level, onChange: e => setObligation(i, { level: e.target.value }), children: [(0, jsx_runtime_1.jsx)("option", { value: "notice", children: "\u63D0\u793A" }), (0, jsx_runtime_1.jsx)("option", { value: "duty", children: "\u4E49\u52A1\uFF08\u8BA1\u4E3A\u9700\u5173\u6CE8\uFF09" })] }), (0, jsx_runtime_1.jsx)("input", { value: o.text, placeholder: "\u4E49\u52A1\u8BF4\u660E", onChange: e => setObligation(i, { text: e.target.value }) }), (0, jsx_runtime_1.jsx)("button", { className: "icon-btn", title: "\u5220\u9664", onClick: () => patch({ obligations: policy.obligations.filter((_, idx) => idx !== i) }), children: (0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { size: 14 }) })] }, i))), (0, jsx_runtime_1.jsxs)("button", { className: "outline small", onClick: () => patch({ obligations: [...policy.obligations, { license: 'MIT', text: '', level: 'notice' }] }), children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Plus, { size: 13 }), "\u6DFB\u52A0\u4E49\u52A1"] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "pe-row two-col", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { children: "\u4F8B\u5916\u671F\u9650\uFF08\u8C41\u514D\u6709\u6548\u5929\u6570\uFF09" }), (0, jsx_runtime_1.jsx)("input", { type: "number", min: 1, max: 3650, value: policy.exceptionDays, onChange: e => patch({ exceptionDays: Math.max(1, Math.round(Number(e.target.value) || 1)) }) })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { children: "\u751F\u6548\u8303\u56F4\uFF08\u6309\u6765\u6E90\uFF09" }), (0, jsx_runtime_1.jsx)("div", { className: "chip-grid", children: types_1.SOURCES.map(s => ((0, jsx_runtime_1.jsx)("button", { className: policy.scope.sources.includes(s) ? 'chip on teal' : 'chip', onClick: () => toggleSource(s), children: s }, s))) })] })] }), !valid && (0, jsx_runtime_1.jsxs)("p", { className: "form-error", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.AlertTriangle, { size: 13 }), "\u751F\u6548\u8303\u56F4\u81F3\u5C11\u9009\u62E9\u4E00\u4E2A\u6765\u6E90\uFF0C\u4F8B\u5916\u671F\u9650\u81F3\u5C11 1 \u5929\u3002"] }), (0, jsx_runtime_1.jsx)("button", { className: "primary full", disabled: !valid, onClick: () => onSave(policy), children: "\u4FDD\u5B58\u653F\u7B56\u5E76\u91CD\u7B97\u98CE\u9669" })] }) }));
}
// ---------- 添加依赖 ----------
function AddDepModal({ projects, defaultProjectId, isDuplicate, onClose, onAdd }) {
    const [name, setName] = (0, react_1.useState)('');
    const [version, setVersion] = (0, react_1.useState)('1.0.0');
    const [license, setLicense] = (0, react_1.useState)('MIT');
    const [source, setSource] = (0, react_1.useState)(types_1.SOURCES[0]);
    const [projectId, setProjectId] = (0, react_1.useState)(defaultProjectId);
    const [error, setError] = (0, react_1.useState)('');
    const submit = () => {
        const n = name.trim();
        if (!n)
            return;
        if (isDuplicate(n, version.trim() || '1.0.0')) {
            setError(`依赖 ${n}@${version.trim() || '1.0.0'} 已存在，不能重复添加`);
            return;
        }
        onAdd({ name: n, version: version.trim() || '1.0.0', license, source, projectId });
    };
    return ((0, jsx_runtime_1.jsxs)(Shell, { title: "\u6DFB\u52A0\u4F9D\u8D56", onClose: onClose, children: [(0, jsx_runtime_1.jsxs)("label", { children: ["\u4F9D\u8D56\u540D\u79F0", (0, jsx_runtime_1.jsx)("input", { autoFocus: true, value: name, onChange: e => { setName(e.target.value); setError(''); }, placeholder: "\u4F8B\u5982 date-fns" })] }), (0, jsx_runtime_1.jsxs)("label", { children: ["\u7248\u672C", (0, jsx_runtime_1.jsx)("input", { value: version, onChange: e => setVersion(e.target.value) })] }), (0, jsx_runtime_1.jsxs)("label", { children: ["\u8BB8\u53EF\u8BC1", (0, jsx_runtime_1.jsx)("select", { value: license, onChange: e => setLicense(e.target.value), children: types_1.LICENSES.map(l => (0, jsx_runtime_1.jsx)("option", { children: l }, l)) })] }), (0, jsx_runtime_1.jsxs)("label", { children: ["\u6765\u6E90", (0, jsx_runtime_1.jsx)("select", { value: source, onChange: e => setSource(e.target.value), children: types_1.SOURCES.map(s => (0, jsx_runtime_1.jsx)("option", { children: s }, s)) })] }), (0, jsx_runtime_1.jsxs)("label", { children: ["\u5F52\u5165\u9879\u76EE", (0, jsx_runtime_1.jsxs)("select", { value: projectId === null ? 'none' : String(projectId), onChange: e => setProjectId(e.target.value === 'none' ? null : Number(e.target.value)), children: [(0, jsx_runtime_1.jsx)("option", { value: "none", children: "\u6682\u4E0D\u5F52\u5165" }), projects.map(p => (0, jsx_runtime_1.jsx)("option", { value: p.id, children: p.name }, p.id))] })] }), error && (0, jsx_runtime_1.jsxs)("p", { className: "form-error", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.AlertTriangle, { size: 13 }), error] }), (0, jsx_runtime_1.jsx)("button", { className: "primary full", disabled: !name.trim(), onClick: submit, children: "\u52A0\u5165\u5DE5\u4F5C\u53F0\uFF08\u5F85\u590D\u6838\uFF09" })] }));
}
const DAY_MS = 86400000;
function ExemptModal({ count, groups, onClose, onConfirm }) {
    const [mode, setMode] = (0, react_1.useState)('policy');
    const pad = (n) => String(n).padStart(2, '0');
    const toInput = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
    const defaultDays = groups.length === 1 ? groups[0].days : 30;
    const [date, setDate] = (0, react_1.useState)(toInput(Date.now() + defaultDays * DAY_MS));
    const [reason, setReason] = (0, react_1.useState)('');
    const until = new Date(`${date}T23:59:59`).getTime();
    const invalid = mode === 'fixed' && (!date || Number.isNaN(until) || until <= Date.now());
    const mixed = groups.length > 1;
    return ((0, jsx_runtime_1.jsxs)(Shell, { title: `豁免 ${count} 个依赖`, onClose: onClose, children: [(0, jsx_runtime_1.jsxs)("p", { className: "modal-hint", children: ["\u8C41\u514D\u5728\u4F8B\u5916\u671F\u9650\u5185\u6709\u6548\uFF0C\u5230\u671F\u540E\u81EA\u52A8\u89C6\u540C\u300C\u5F85\u590D\u6838\u300D\uFF0C\u9700\u91CD\u65B0\u6D41\u8F6C\u3002", mixed && `本批依赖属于 ${groups.length} 个项目，可分别按各自例外期限生效。`] }), (0, jsx_runtime_1.jsxs)("div", { className: "mode-row", children: [(0, jsx_runtime_1.jsx)("button", { className: mode === 'policy' ? 'mode-btn active' : 'mode-btn', onClick: () => setMode('policy'), children: "\u6309\u9879\u76EE\u4F8B\u5916\u671F\u9650" }), (0, jsx_runtime_1.jsx)("button", { className: mode === 'fixed' ? 'mode-btn active' : 'mode-btn', onClick: () => setMode('fixed'), children: "\u7EDF\u4E00\u622A\u6B62\u65E5\u671F" })] }), mode === 'policy' && ((0, jsx_runtime_1.jsx)("div", { className: "exempt-groups", children: groups.map(g => ((0, jsx_runtime_1.jsxs)("div", { className: "eg-row", children: [(0, jsx_runtime_1.jsx)("b", { children: g.name }), (0, jsx_runtime_1.jsxs)("span", { children: [g.days, " \u5929 \u2192 \u622A\u6B62 ", (0, types_1.fmtDate)(Date.now() + g.days * DAY_MS)] }), (0, jsx_runtime_1.jsxs)("i", { children: [g.count, " \u9879"] })] }, g.name))) })), mode === 'fixed' && ((0, jsx_runtime_1.jsxs)("label", { children: ["\u8C41\u514D\u622A\u6B62", (0, jsx_runtime_1.jsx)("input", { type: "date", value: date, onChange: e => setDate(e.target.value) })] })), invalid && (0, jsx_runtime_1.jsxs)("p", { className: "form-error", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.AlertTriangle, { size: 13 }), "\u622A\u6B62\u65E5\u671F\u5FC5\u987B\u665A\u4E8E\u5F53\u524D\u65F6\u95F4\u3002"] }), (0, jsx_runtime_1.jsxs)("label", { children: ["\u8C41\u514D\u7406\u7531", (0, jsx_runtime_1.jsx)("textarea", { autoFocus: true, value: reason, onChange: e => setReason(e.target.value), placeholder: "\u4F8B\u5982\uFF1A\u77ED\u671F\u517C\u5BB9\u65B9\u6848\uFF0CQ4 \u524D\u66FF\u6362\u4E3A MIT \u8BB8\u53EF\u7684\u66FF\u4EE3\u5E93", rows: 3 })] }), (0, jsx_runtime_1.jsx)("button", { className: "primary full", disabled: invalid || !reason.trim(), onClick: () => onConfirm(reason.trim(), mode === 'policy' ? null : until), children: "\u786E\u8BA4\u8C41\u514D" })] }));
}
// ---------- 导入快照 ----------
function ImportModal({ analyze, onClose, onConfirm }) {
    const [analysis, setAnalysis] = (0, react_1.useState)(null);
    const [fileName, setFileName] = (0, react_1.useState)('');
    const inputRef = (0, react_1.useRef)(null);
    const readFile = (file) => {
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = () => setAnalysis(analyze(String(reader.result ?? '')));
        reader.readAsText(file);
    };
    return ((0, jsx_runtime_1.jsxs)(Shell, { title: "\u5BFC\u5165\u9879\u76EE\u5FEB\u7167", onClose: onClose, children: [(0, jsx_runtime_1.jsx)("input", { ref: inputRef, type: "file", accept: ".json,application/json", style: { display: 'none' }, onChange: e => { const f = e.target.files?.[0]; if (f)
                    readFile(f); e.target.value = ''; } }), (0, jsx_runtime_1.jsxs)("button", { className: "outline full", onClick: () => inputRef.current?.click(), children: [(0, jsx_runtime_1.jsx)(lucide_react_1.FileUp, { size: 15 }), fileName || '选择快照文件（.json）'] }), analysis && !analysis.ok && ((0, jsx_runtime_1.jsxs)("div", { className: "import-report error", children: [(0, jsx_runtime_1.jsxs)("b", { children: [(0, jsx_runtime_1.jsx)(lucide_react_1.AlertTriangle, { size: 14 }), " \u5BFC\u5165\u5931\u8D25"] }), (0, jsx_runtime_1.jsx)("p", { children: analysis.error }), analysis.conflicts.length > 0 && (0, jsx_runtime_1.jsx)("ul", { children: analysis.conflicts.map((c, i) => (0, jsx_runtime_1.jsx)("li", { children: c }, i)) })] })), analysis?.ok && ((0, jsx_runtime_1.jsxs)("div", { className: "import-report", children: [(0, jsx_runtime_1.jsxs)("div", { className: "ir-grid", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { children: "\u5FEB\u7167\u7248\u672C" }), (0, jsx_runtime_1.jsxs)("b", { children: ["v", analysis.version] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { children: "\u5BFC\u51FA\u65F6\u95F4" }), (0, jsx_runtime_1.jsx)("b", { children: analysis.exportedAt ? (0, types_1.fmtTime)(analysis.exportedAt) : '—' })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { children: "\u9879\u76EE" }), (0, jsx_runtime_1.jsx)("b", { children: analysis.finalName })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { children: "\u4F9D\u8D56 / \u8BB0\u5F55" }), (0, jsx_runtime_1.jsxs)("b", { children: [analysis.depCount, " / ", analysis.auditCount, " \u6761"] })] })] }), analysis.conflicts.length > 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "ir-conflicts", children: [(0, jsx_runtime_1.jsxs)("b", { children: [(0, jsx_runtime_1.jsx)(lucide_react_1.AlertTriangle, { size: 14 }), " \u68C0\u6D4B\u5230 ", analysis.conflicts.length, " \u9879\u51B2\u7A81\uFF0C\u5C06\u6309\u4EE5\u4E0B\u65B9\u5F0F\u5904\u7406\uFF1A"] }), (0, jsx_runtime_1.jsx)("ul", { children: analysis.conflicts.map((c, i) => (0, jsx_runtime_1.jsx)("li", { children: c }, i)) }), (analysis.skippedDeps ?? 0) > 0 && (0, jsx_runtime_1.jsxs)("p", { children: ["\u5171\u8DF3\u8FC7 ", analysis.skippedDeps, " \u4E2A\u91CD\u590D\u6216\u65E0\u6548\u4F9D\u8D56\u3002"] })] })), analysis.conflicts.length === 0 && (0, jsx_runtime_1.jsx)("p", { className: "ir-clean", children: "\u672A\u68C0\u6D4B\u5230\u51B2\u7A81\uFF0C\u53EF\u76F4\u63A5\u5BFC\u5165\u3002" })] })), (0, jsx_runtime_1.jsx)("button", { className: "primary full", disabled: !analysis?.ok, onClick: () => analysis && onConfirm(analysis), children: "\u786E\u8BA4\u5BFC\u5165" })] }));
}
