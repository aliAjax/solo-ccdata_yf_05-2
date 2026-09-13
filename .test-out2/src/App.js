"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = App;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const store_1 = require("./store");
const snapshot_1 = require("./snapshot");
const Sidebar_1 = __importDefault(require("./ui/Sidebar"));
const DepTable_1 = __importDefault(require("./ui/DepTable"));
const BatchBar_1 = __importDefault(require("./ui/BatchBar"));
const DetailPane_1 = __importDefault(require("./ui/DetailPane"));
const AuditView_1 = __importDefault(require("./ui/AuditView"));
const modals_1 = require("./ui/modals");
const types_1 = require("./types");
const STATUS_FILTERS = ['全部', 'pending', 'approved', 'exempted', 'rejected'];
function App() {
    const wb = (0, store_1.useWorkbench)();
    const { store } = wb;
    const [route, setRoute] = (0, react_1.useState)(store.projects.length ? { type: 'project', id: store.projects[0].id } : { type: 'all' });
    const [modal, setModal] = (0, react_1.useState)(null);
    const [selected, setSelected] = (0, react_1.useState)(new Set());
    const [detailId, setDetailId] = (0, react_1.useState)(null);
    const [query, setQuery] = (0, react_1.useState)('');
    const [statusFilter, setStatusFilter] = (0, react_1.useState)('全部');
    const [now, setNow] = (0, react_1.useState)(Date.now());
    // 每分钟刷新一次，让豁免到期状态及时体现
    (0, react_1.useEffect)(() => {
        const t = setInterval(() => setNow(Date.now()), 60000);
        return () => clearInterval(t);
    }, []);
    const routeKey = route.type === 'project' ? `p${route.id}` : route.type;
    (0, react_1.useEffect)(() => {
        setSelected(new Set());
        setDetailId(null);
        setQuery('');
        setStatusFilter('全部');
    }, [routeKey]);
    // 当前项目被删除时回退到全部依赖
    const activeProject = route.type === 'project' ? store.projects.find(p => p.id === route.id) ?? null : null;
    (0, react_1.useEffect)(() => {
        if (route.type === 'project' && !activeProject)
            setRoute({ type: 'all' });
    }, [route, activeProject]);
    // 撤销/重做快捷键
    (0, react_1.useEffect)(() => {
        const handler = (e) => {
            const t = e.target;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT'))
                return;
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey)
                    wb.redo();
                else
                    wb.undo();
            }
            else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                wb.redo();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    });
    const routeDeps = (0, react_1.useMemo)(() => {
        if (route.type === 'project')
            return store.deps.filter(d => d.projectId === route.id);
        if (route.type === 'expired')
            return store.deps.filter(d => (0, types_1.exemptionExpired)(d, now));
        return store.deps;
    }, [store.deps, route, now]);
    const filtered = (0, react_1.useMemo)(() => routeDeps.filter(d => {
        if (statusFilter !== '全部' && (0, types_1.effectiveStatus)(d, now) !== statusFilter)
            return false;
        const q = query.trim().toLowerCase();
        return !q || `${d.name} ${d.version} ${d.license}`.toLowerCase().includes(q);
    }), [routeDeps, statusFilter, query, now]);
    const stats = (0, react_1.useMemo)(() => {
        const eff = routeDeps.map(d => ({ d, s: (0, types_1.effectiveStatus)(d, now) }));
        const policyOf = (projectId) => store.projects.find(p => p.id === projectId)?.policy ?? null;
        return {
            total: routeDeps.length,
            pending: eff.filter(x => x.s === 'pending').length,
            approved: eff.filter(x => x.s === 'approved').length,
            exempted: eff.filter(x => x.s === 'exempted').length,
            expired: routeDeps.filter(d => (0, types_1.exemptionExpired)(d, now)).length,
            rejected: eff.filter(x => x.s === 'rejected').length,
            high: eff.filter(x => x.s === 'pending' && (0, types_1.computeRisk)(x.d, policyOf(x.d.projectId)) === 'high').length,
            unassigned: routeDeps.filter(d => d.projectId === null).length,
        };
    }, [routeDeps, store.projects, now]);
    const toggle = (id) => setSelected(prev => {
        const n = new Set(prev);
        if (n.has(id))
            n.delete(id);
        else
            n.add(id);
        return n;
    });
    const toggleAll = (ids) => setSelected(prev => {
        const n = new Set(prev);
        if (ids.length && ids.every(id => n.has(id)))
            ids.forEach(id => n.delete(id));
        else
            ids.forEach(id => n.add(id));
        return n;
    });
    const selectedIds = [...selected];
    const batchDone = () => setSelected(new Set());
    const detailDep = detailId === null ? null : store.deps.find(d => d.id === detailId) ?? null;
    const detailAudit = (0, react_1.useMemo)(() => detailId === null ? [] : store.audit.filter(a => a.depId === detailId).sort((a, b) => b.at - a.at), [store.audit, detailId]);
    const exemptGroups = (ids) => {
        const map = new Map();
        for (const id of ids) {
            const d = store.deps.find(x => x.id === id);
            if (!d)
                continue;
            const p = d.projectId === null ? null : store.projects.find(x => x.id === d.projectId) ?? null;
            const key = p ? String(p.id) : 'none';
            const g = map.get(key) ?? { name: p ? p.name : '未归入项目（默认 30 天）', days: p ? p.policy.exceptionDays : 30, count: 0 };
            g.count++;
            map.set(key, g);
        }
        return [...map.values()];
    };
    const title = route.type === 'project' ? activeProject?.name ?? '项目'
        : route.type === 'all' ? '全部依赖'
            : route.type === 'expired' ? '豁免过期'
                : '操作记录';
    const score = stats.total === 0 ? null : Math.round((stats.approved / stats.total) * 100);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "shell", children: [(0, jsx_runtime_1.jsx)(Sidebar_1.default, { projects: store.projects, deps: store.deps, route: route, onRoute: setRoute, onNewProject: () => setModal({ type: 'project' }), onDeleteProject: wb.deleteProject, now: now }), (0, jsx_runtime_1.jsxs)("main", { children: [(0, jsx_runtime_1.jsxs)("header", { children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("div", { className: "crumb", children: ["WORKBENCH / ", (0, jsx_runtime_1.jsx)("b", { children: title.toUpperCase() })] }), (0, jsx_runtime_1.jsxs)("h1", { children: [title, activeProject && (0, jsx_runtime_1.jsx)("i", { className: `kind-badge ${activeProject.policy.kind}`, children: types_1.KIND_LABEL[activeProject.policy.kind] })] }), (0, jsx_runtime_1.jsxs)("p", { children: [route.type === 'project' && activeProject &&
                                                `禁止 ${activeProject.policy.banned.length} 项许可 · 附加义务 ${activeProject.policy.obligations.length} 条 · 例外期限 ${activeProject.policy.exceptionDays} 天 · 生效范围 ${activeProject.policy.scope.sources.join('/')}`, route.type === 'all' && '跨项目查看与批量归入，风险按各自项目政策计算。', route.type === 'expired' && '以下依赖的豁免已超过例外期限，视同待复核，请重新流转。', route.type === 'audit' && '项目、政策与依赖的全部操作历史。'] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "head-actions", children: [(0, jsx_runtime_1.jsxs)("button", { className: "outline", disabled: !wb.canUndo, onClick: wb.undo, title: "\u64A4\u9500 (Ctrl+Z)", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Undo2, { size: 15 }), "\u64A4\u9500"] }), (0, jsx_runtime_1.jsxs)("button", { className: "outline", disabled: !wb.canRedo, onClick: wb.redo, title: "\u91CD\u505A (Ctrl+Shift+Z)", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Redo2, { size: 15 }), "\u91CD\u505A"] }), activeProject && (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("button", { className: "outline", onClick: () => wb.exportSnapshot(activeProject.id), children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Download, { size: 15 }), "\u5BFC\u51FA\u5FEB\u7167"] }), (0, jsx_runtime_1.jsxs)("button", { className: "outline", onClick: () => setModal({ type: 'policy', projectId: activeProject.id }), children: [(0, jsx_runtime_1.jsx)(lucide_react_1.SlidersHorizontal, { size: 15 }), "\u7F16\u8F91\u653F\u7B56"] })] }), (0, jsx_runtime_1.jsxs)("button", { className: "outline", onClick: () => setModal({ type: 'import' }), children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Upload, { size: 15 }), "\u5BFC\u5165\u5FEB\u7167"] }), (0, jsx_runtime_1.jsxs)("button", { className: "primary", onClick: () => setModal({ type: 'addDep' }), children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Plus, { size: 16 }), "\u6DFB\u52A0\u4F9D\u8D56"] })] })] }), route.type !== 'audit' && (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("section", { className: "summary six", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("span", { children: "\u4F9D\u8D56\u603B\u6570" }), (0, jsx_runtime_1.jsx)("b", { children: stats.total }), (0, jsx_runtime_1.jsx)("small", { children: route.type === 'all' ? `未归入 ${stats.unassigned}` : '当前范围' })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("span", { children: "\u5F85\u590D\u6838" }), (0, jsx_runtime_1.jsx)("b", { className: "orange", children: stats.pending }), (0, jsx_runtime_1.jsxs)("small", { children: ["\u542B\u8FC7\u671F\u8C41\u514D ", stats.expired] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("span", { children: "\u9AD8\u98CE\u9669" }), (0, jsx_runtime_1.jsx)("b", { className: "red", children: stats.high }), (0, jsx_runtime_1.jsx)("small", { children: "\u5F85\u590D\u6838\u4E2D\u547D\u4E2D\u7981\u6B62\u8BB8\u53EF" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("span", { children: "\u8C41\u514D\u4E2D" }), (0, jsx_runtime_1.jsx)("b", { className: "teal", children: stats.exempted }), (0, jsx_runtime_1.jsx)("small", { children: "\u4F8B\u5916\u671F\u9650\u5185\u6709\u6548" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("span", { children: "\u5DF2\u6279\u51C6" }), (0, jsx_runtime_1.jsx)("b", { children: stats.approved }), (0, jsx_runtime_1.jsx)("small", { children: score === null ? '—' : `合规率 ${score}%` })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("span", { children: "\u5DF2\u9A73\u56DE" }), (0, jsx_runtime_1.jsx)("b", { className: "muted-b", children: stats.rejected }), (0, jsx_runtime_1.jsx)("small", { children: "\u9700\u66FF\u6362\u6216\u79FB\u9664" })] })] }), (0, jsx_runtime_1.jsxs)("section", { className: "workspace single", children: [(0, jsx_runtime_1.jsxs)("div", { className: "table-pane", children: [(0, jsx_runtime_1.jsxs)("div", { className: "pane-head", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", { children: route.type === 'expired' ? '过期豁免清单' : '依赖清单' }), (0, jsx_runtime_1.jsxs)("p", { children: [filtered.length, " / ", routeDeps.length, " \u9879", selected.size > 0 ? ` · 已选 ${selected.size} 项` : ''] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "tools", children: [(0, jsx_runtime_1.jsxs)("div", { className: "search", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Search, { size: 15 }), (0, jsx_runtime_1.jsx)("input", { value: query, onChange: e => setQuery(e.target.value), placeholder: "\u641C\u7D22\u4F9D\u8D56" })] }), (0, jsx_runtime_1.jsx)("select", { value: statusFilter, onChange: e => setStatusFilter(e.target.value), children: STATUS_FILTERS.map(s => (0, jsx_runtime_1.jsx)("option", { value: s, children: s === '全部' ? '全部状态' : types_1.STATUS_LABEL[s] }, s)) })] })] }), (0, jsx_runtime_1.jsx)(BatchBar_1.default, { count: selected.size, projects: store.projects, onAssign: pid => { wb.assignDeps(selectedIds, pid); batchDone(); }, onApprove: () => { wb.transitionDeps(selectedIds, 'approved'); batchDone(); }, onExempt: () => setModal({ type: 'exempt', ids: selectedIds }), onReject: () => { wb.transitionDeps(selectedIds, 'rejected'); batchDone(); }, onRemove: () => { wb.removeDeps(selectedIds); batchDone(); }, onClear: batchDone }), route.type === 'project' && activeProject && routeDeps.length === 0 ? ((0, jsx_runtime_1.jsxs)("div", { className: "empty-state", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Layers3, { size: 28 }), (0, jsx_runtime_1.jsxs)("b", { children: ["\u300C", activeProject.name, "\u300D\u8FD8\u662F\u7A7A\u9879\u76EE"] }), (0, jsx_runtime_1.jsx)("p", { children: "\u6DFB\u52A0\u65B0\u4F9D\u8D56\uFF0C\u6216\u5230\u300C\u5168\u90E8\u4F9D\u8D56\u300D\u4E2D\u52FE\u9009\u540E\u6279\u91CF\u5F52\u5165\u672C\u9879\u76EE\uFF0C\u98CE\u9669\u5C06\u6309\u672C\u9879\u76EE\u653F\u7B56\u81EA\u52A8\u91CD\u7B97\u3002" }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("button", { className: "primary", onClick: () => setModal({ type: 'addDep' }), children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Plus, { size: 15 }), "\u6DFB\u52A0\u4F9D\u8D56"] }), (0, jsx_runtime_1.jsx)("button", { className: "outline", onClick: () => setRoute({ type: 'all' }), children: "\u53BB\u5168\u90E8\u4F9D\u8D56\u6311\u9009" })] })] })) : ((0, jsx_runtime_1.jsx)(DepTable_1.default, { deps: filtered, projects: store.projects, showProject: route.type !== 'project', selected: selected, onToggle: toggle, onToggleAll: toggleAll, onOpen: id => setDetailId(id === detailId ? null : id), detailId: detailId, now: now }))] }), detailDep && ((0, jsx_runtime_1.jsx)(DetailPane_1.default, { dep: detailDep, project: store.projects.find(p => p.id === detailDep.projectId) ?? null, audit: detailAudit, now: now, onClose: () => setDetailId(null), onTransition: s => wb.transitionDeps([detailDep.id], s), onExempt: () => setModal({ type: 'exempt', ids: [detailDep.id] }) }))] })] }), route.type === 'audit' && (0, jsx_runtime_1.jsx)(AuditView_1.default, { audit: store.audit, projects: store.projects })] }), modal?.type === 'project' && ((0, jsx_runtime_1.jsx)(modals_1.ProjectModal, { onClose: () => setModal(null), onCreate: (name, kind) => {
                    const id = wb.addProject(name, kind);
                    setModal(null);
                    setRoute({ type: 'project', id });
                } })), modal?.type === 'policy' && (() => {
                const project = store.projects.find(p => p.id === modal.projectId);
                return project ? ((0, jsx_runtime_1.jsx)(modals_1.PolicyEditor, { project: project, onClose: () => setModal(null), onSave: policy => { wb.updatePolicy(project.id, policy); setModal(null); } })) : null;
            })(), modal?.type === 'addDep' && ((0, jsx_runtime_1.jsx)(modals_1.AddDepModal, { projects: store.projects, defaultProjectId: activeProject?.id ?? null, isDuplicate: (name, version) => store.deps.some(d => (0, types_1.depKey)(d.name, d.version) === (0, types_1.depKey)(name, version)), onClose: () => setModal(null), onAdd: input => {
                    wb.addDep(input);
                    setModal(null);
                    if (input.projectId !== null)
                        setRoute({ type: 'project', id: input.projectId });
                } })), modal?.type === 'exempt' && ((0, jsx_runtime_1.jsx)(modals_1.ExemptModal, { count: modal.ids.length, groups: exemptGroups(modal.ids), onClose: () => setModal(null), onConfirm: (reason, until) => {
                    wb.transitionDeps(modal.ids, 'exempted', { reason, until });
                    setModal(null);
                    batchDone();
                } })), modal?.type === 'import' && ((0, jsx_runtime_1.jsx)(modals_1.ImportModal, { analyze: text => (0, snapshot_1.analyzeSnapshot)(text, { projectNames: wb.existingProjectNames(), depKeys: wb.existingDepKeys() }), onClose: () => setModal(null), onConfirm: analysis => {
                    const pid = wb.applyImport(analysis);
                    setModal(null);
                    if (pid !== null)
                        setRoute({ type: 'project', id: pid });
                } })), (0, jsx_runtime_1.jsx)("div", { className: "toasts", children: wb.toasts.map(t => ((0, jsx_runtime_1.jsxs)("div", { className: `toast ${t.tone}`, children: [t.tone === 'ok' ? (0, jsx_runtime_1.jsx)(lucide_react_1.Check, { size: 14 }) : (0, jsx_runtime_1.jsx)(lucide_react_1.AlertTriangle, { size: 14 }), (0, jsx_runtime_1.jsx)("span", { children: t.text })] }, t.id))) }), (0, jsx_runtime_1.jsxs)("div", { className: "save-hint", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.ShieldCheck, { size: 12 }), "\u5DF2\u81EA\u52A8\u4FDD\u5B58"] })] }));
}
