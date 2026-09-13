import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Check, Download, Layers3, Plus, Redo2, Search,
  ShieldCheck, SlidersHorizontal, Undo2, Upload,
} from 'lucide-react';
import { useWorkbench } from './store';
import { analyzeSnapshot } from './snapshot';
import Sidebar, { Route } from './ui/Sidebar';
import DepTable from './ui/DepTable';
import BatchBar from './ui/BatchBar';
import DetailPane from './ui/DetailPane';
import AuditView from './ui/AuditView';
import { AddDepModal, ExemptGroup, ExemptModal, ImportModal, PolicyEditor, ProjectModal } from './ui/modals';
import {
  DepStatus, KIND_LABEL, STATUS_LABEL, computeRisk, depKey, effectiveStatus, exemptionExpired,
} from './types';

type Modal =
  | { type: 'project' }
  | { type: 'policy'; projectId: number }
  | { type: 'addDep' }
  | { type: 'exempt'; ids: number[] }
  | { type: 'import' };

const STATUS_FILTERS: Array<'全部' | DepStatus> = ['全部', 'pending', 'approved', 'exempted', 'rejected'];

export default function App() {
  const wb = useWorkbench();
  const { store } = wb;
  const [route, setRoute] = useState<Route>(
    store.projects.length ? { type: 'project', id: store.projects[0].id } : { type: 'all' },
  );
  const [modal, setModal] = useState<Modal | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [detailId, setDetailId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'全部' | DepStatus>('全部');
  const [now, setNow] = useState(Date.now());

  // 每分钟刷新一次，让豁免到期状态及时体现
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const routeKey = route.type === 'project' ? `p${route.id}` : route.type;
  useEffect(() => {
    setSelected(new Set());
    setDetailId(null);
    setQuery('');
    setStatusFilter('全部');
  }, [routeKey]);

  // 当前项目被删除时回退到全部依赖
  const activeProject = route.type === 'project' ? store.projects.find(p => p.id === route.id) ?? null : null;
  useEffect(() => {
    if (route.type === 'project' && !activeProject) setRoute({ type: 'all' });
  }, [route, activeProject]);

  // 撤销/重做快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) wb.redo(); else wb.undo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        wb.redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const routeDeps = useMemo(() => {
    if (route.type === 'project') return store.deps.filter(d => d.projectId === route.id);
    if (route.type === 'expired') return store.deps.filter(d => exemptionExpired(d, now));
    return store.deps;
  }, [store.deps, route, now]);

  const filtered = useMemo(() => routeDeps.filter(d => {
    if (statusFilter !== '全部' && effectiveStatus(d, now) !== statusFilter) return false;
    const q = query.trim().toLowerCase();
    return !q || `${d.name} ${d.version} ${d.license}`.toLowerCase().includes(q);
  }), [routeDeps, statusFilter, query, now]);

  const stats = useMemo(() => {
    const eff = routeDeps.map(d => ({ d, s: effectiveStatus(d, now) }));
    const policyOf = (projectId: number | null) => store.projects.find(p => p.id === projectId)?.policy ?? null;
    return {
      total: routeDeps.length,
      pending: eff.filter(x => x.s === 'pending').length,
      approved: eff.filter(x => x.s === 'approved').length,
      exempted: eff.filter(x => x.s === 'exempted').length,
      expired: routeDeps.filter(d => exemptionExpired(d, now)).length,
      rejected: eff.filter(x => x.s === 'rejected').length,
      high: eff.filter(x => x.s === 'pending' && computeRisk(x.d, policyOf(x.d.projectId)) === 'high').length,
      unassigned: routeDeps.filter(d => d.projectId === null).length,
    };
  }, [routeDeps, store.projects, now]);

  const toggle = (id: number) => setSelected(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const toggleAll = (ids: number[]) => setSelected(prev => {
    const n = new Set(prev);
    if (ids.length && ids.every(id => n.has(id))) ids.forEach(id => n.delete(id));
    else ids.forEach(id => n.add(id));
    return n;
  });

  const selectedIds = [...selected];
  const batchDone = () => setSelected(new Set());

  const detailDep = detailId === null ? null : store.deps.find(d => d.id === detailId) ?? null;
  const detailAudit = useMemo(
    () => detailId === null ? [] : store.audit.filter(a => a.depId === detailId).sort((a, b) => b.at - a.at),
    [store.audit, detailId],
  );

  const exemptGroups = (ids: number[]): ExemptGroup[] => {
    const map = new Map<string, ExemptGroup>();
    for (const id of ids) {
      const d = store.deps.find(x => x.id === id);
      if (!d) continue;
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

  return (
    <div className="shell">
      <Sidebar
        projects={store.projects}
        deps={store.deps}
        route={route}
        onRoute={setRoute}
        onNewProject={() => setModal({ type: 'project' })}
        onDeleteProject={wb.deleteProject}
        now={now}
      />

      <main>
        <header>
          <div>
            <div className="crumb">WORKBENCH / <b>{title.toUpperCase()}</b></div>
            <h1>
              {title}
              {activeProject && <i className={`kind-badge ${activeProject.policy.kind}`}>{KIND_LABEL[activeProject.policy.kind]}</i>}
            </h1>
            <p>
              {route.type === 'project' && activeProject &&
                `禁止 ${activeProject.policy.banned.length} 项许可 · 附加义务 ${activeProject.policy.obligations.length} 条 · 例外期限 ${activeProject.policy.exceptionDays} 天 · 生效范围 ${activeProject.policy.scope.sources.join('/')}`}
              {route.type === 'all' && '跨项目查看与批量归入，风险按各自项目政策计算。'}
              {route.type === 'expired' && '以下依赖的豁免已超过例外期限，视同待复核，请重新流转。'}
              {route.type === 'audit' && '项目、政策与依赖的全部操作历史。'}
            </p>
          </div>
          <div className="head-actions">
            <button className="outline" disabled={!wb.canUndo} onClick={wb.undo} title="撤销 (Ctrl+Z)"><Undo2 size={15} />撤销</button>
            <button className="outline" disabled={!wb.canRedo} onClick={wb.redo} title="重做 (Ctrl+Shift+Z)"><Redo2 size={15} />重做</button>
            {activeProject && <>
              <button className="outline" onClick={() => wb.exportSnapshot(activeProject.id)}><Download size={15} />导出快照</button>
              <button className="outline" onClick={() => setModal({ type: 'policy', projectId: activeProject.id })}><SlidersHorizontal size={15} />编辑政策</button>
            </>}
            <button className="outline" onClick={() => setModal({ type: 'import' })}><Upload size={15} />导入快照</button>
            <button className="primary" onClick={() => setModal({ type: 'addDep' })}><Plus size={16} />添加依赖</button>
          </div>
        </header>

        {route.type !== 'audit' && <>
          <section className="summary six">
            <div><span>依赖总数</span><b>{stats.total}</b><small>{route.type === 'all' ? `未归入 ${stats.unassigned}` : '当前范围'}</small></div>
            <div><span>待复核</span><b className="orange">{stats.pending}</b><small>含过期豁免 {stats.expired}</small></div>
            <div><span>高风险</span><b className="red">{stats.high}</b><small>待复核中命中禁止许可</small></div>
            <div><span>豁免中</span><b className="teal">{stats.exempted}</b><small>例外期限内有效</small></div>
            <div><span>已批准</span><b>{stats.approved}</b><small>{score === null ? '—' : `合规率 ${score}%`}</small></div>
            <div><span>已驳回</span><b className="muted-b">{stats.rejected}</b><small>需替换或移除</small></div>
          </section>

          <section className="workspace single">
            <div className="table-pane">
              <div className="pane-head">
                <div>
                  <h2>{route.type === 'expired' ? '过期豁免清单' : '依赖清单'}</h2>
                  <p>{filtered.length} / {routeDeps.length} 项{selected.size > 0 ? ` · 已选 ${selected.size} 项` : ''}</p>
                </div>
                <div className="tools">
                  <div className="search"><Search size={15} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索依赖" /></div>
                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as '全部' | DepStatus)}>
                    {STATUS_FILTERS.map(s => <option key={s} value={s}>{s === '全部' ? '全部状态' : STATUS_LABEL[s]}</option>)}
                  </select>
                </div>
              </div>

              <BatchBar
                count={selected.size}
                projects={store.projects}
                onAssign={pid => { wb.assignDeps(selectedIds, pid); batchDone(); }}
                onApprove={() => { wb.transitionDeps(selectedIds, 'approved'); batchDone(); }}
                onExempt={() => setModal({ type: 'exempt', ids: selectedIds })}
                onReject={() => { wb.transitionDeps(selectedIds, 'rejected'); batchDone(); }}
                onRemove={() => { wb.removeDeps(selectedIds); batchDone(); }}
                onClear={batchDone}
              />

              {route.type === 'project' && activeProject && routeDeps.length === 0 ? (
                <div className="empty-state">
                  <Layers3 size={28} />
                  <b>「{activeProject.name}」还是空项目</b>
                  <p>添加新依赖，或到「全部依赖」中勾选后批量归入本项目，风险将按本项目政策自动重算。</p>
                  <div>
                    <button className="primary" onClick={() => setModal({ type: 'addDep' })}><Plus size={15} />添加依赖</button>
                    <button className="outline" onClick={() => setRoute({ type: 'all' })}>去全部依赖挑选</button>
                  </div>
                </div>
              ) : (
                <DepTable
                  deps={filtered}
                  projects={store.projects}
                  showProject={route.type !== 'project'}
                  selected={selected}
                  onToggle={toggle}
                  onToggleAll={toggleAll}
                  onOpen={id => setDetailId(id === detailId ? null : id)}
                  detailId={detailId}
                  now={now}
                />
              )}
            </div>

            {detailDep && (
              <DetailPane
                dep={detailDep}
                project={store.projects.find(p => p.id === detailDep.projectId) ?? null}
                audit={detailAudit}
                now={now}
                onClose={() => setDetailId(null)}
                onTransition={s => wb.transitionDeps([detailDep.id], s)}
                onExempt={() => setModal({ type: 'exempt', ids: [detailDep.id] })}
              />
            )}
          </section>
        </>}

        {route.type === 'audit' && <AuditView audit={store.audit} projects={store.projects} />}
      </main>

      {modal?.type === 'project' && (
        <ProjectModal
          onClose={() => setModal(null)}
          onCreate={(name, kind) => {
            const id = wb.addProject(name, kind);
            setModal(null);
            setRoute({ type: 'project', id });
          }}
        />
      )}
      {modal?.type === 'policy' && (() => {
        const project = store.projects.find(p => p.id === (modal as { projectId: number }).projectId);
        return project ? (
          <PolicyEditor
            project={project}
            onClose={() => setModal(null)}
            onSave={policy => { wb.updatePolicy(project.id, policy); setModal(null); }}
          />
        ) : null;
      })()}
      {modal?.type === 'addDep' && (
        <AddDepModal
          projects={store.projects}
          defaultProjectId={activeProject?.id ?? null}
          isDuplicate={(name, version) => store.deps.some(d => depKey(d.name, d.version) === depKey(name, version))}
          onClose={() => setModal(null)}
          onAdd={input => {
            wb.addDep(input);
            setModal(null);
            if (input.projectId !== null) setRoute({ type: 'project', id: input.projectId });
          }}
        />
      )}
      {modal?.type === 'exempt' && (
        <ExemptModal
          count={(modal as { ids: number[] }).ids.length}
          groups={exemptGroups((modal as { ids: number[] }).ids)}
          onClose={() => setModal(null)}
          onConfirm={(reason, until) => {
            wb.transitionDeps((modal as { ids: number[] }).ids, 'exempted', { reason, until });
            setModal(null);
            batchDone();
          }}
        />
      )}
      {modal?.type === 'import' && (
        <ImportModal
          analyze={text => analyzeSnapshot(text, { projectNames: wb.existingProjectNames(), depKeys: wb.existingDepKeys() })}
          onClose={() => setModal(null)}
          onConfirm={analysis => {
            const pid = wb.applyImport(analysis);
            setModal(null);
            if (pid !== null) setRoute({ type: 'project', id: pid });
          }}
        />
      )}

      <div className="toasts">
        {wb.toasts.map(t => (
          <div key={t.id} className={`toast ${t.tone}`}>
            {t.tone === 'ok' ? <Check size={14} /> : <AlertTriangle size={14} />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>

      <div className="save-hint"><ShieldCheck size={12} />已自动保存</div>
    </div>
  );
}
