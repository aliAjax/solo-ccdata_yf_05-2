import { AlertTriangle, Clock3, FolderPlus, Layers3, ScrollText, ShieldCheck, Trash2 } from 'lucide-react';
import { Dep, Project, computeRisk, effectiveStatus, exemptionExpired } from '../types';

export type Route =
  | { type: 'project'; id: number }
  | { type: 'all' }
  | { type: 'expired' }
  | { type: 'audit' };

export function sameRoute(a: Route, b: Route): boolean {
  if (a.type !== b.type) return false;
  return a.type !== 'project' || (b.type === 'project' && a.id === b.id);
}

interface Props {
  projects: Project[];
  deps: Dep[];
  route: Route;
  onRoute: (r: Route) => void;
  onNewProject: () => void;
  onDeleteProject: (id: number) => void;
  now: number;
}

export default function Sidebar({ projects, deps, route, onRoute, onNewProject, onDeleteProject, now }: Props) {
  const expiredCount = deps.filter(d => exemptionExpired(d, now)).length;
  return (
    <aside>
      <div className="brand">
        <div className="brand-icon"><ShieldCheck size={18} /></div>
        <div><b>License Lens</b><small>compliance workbench</small></div>
      </div>

      <div className="nav-title">
        项目
        <button className="nav-add" title="新建项目" onClick={onNewProject}><FolderPlus size={14} /></button>
      </div>
      {projects.map(p => {
        const list = deps.filter(d => d.projectId === p.id);
        const high = list.filter(d => effectiveStatus(d, now) === 'pending' && computeRisk(d, p.policy) === 'high').length;
        const active = sameRoute(route, { type: 'project', id: p.id });
        return (
          <button key={p.id} className={active ? 'nav active' : 'nav'} onClick={() => onRoute({ type: 'project', id: p.id })}>
            <Layers3 size={15} />
            <span className="nav-name">{p.name}</span>
            {list.length === 0 && <i className="badge empty">空</i>}
            {high > 0 && <i className="badge red">{high}</i>}
            <span className="nav-count">{list.length}</span>
            <span
              className="nav-del" title="删除项目"
              onClick={e => {
                e.stopPropagation();
                if (window.confirm(`删除项目「${p.name}」？其 ${list.length} 个依赖将移为未归入。`)) onDeleteProject(p.id);
              }}
            ><Trash2 size={13} /></span>
          </button>
        );
      })}

      <div className="nav-title">视图</div>
      <button className={route.type === 'all' ? 'nav active' : 'nav'} onClick={() => onRoute({ type: 'all' })}>
        <Layers3 size={15} /><span className="nav-name">全部依赖</span><span className="nav-count">{deps.length}</span>
      </button>
      <button className={route.type === 'expired' ? 'nav active' : 'nav'} onClick={() => onRoute({ type: 'expired' })}>
        <Clock3 size={15} /><span className="nav-name">豁免过期</span>
        {expiredCount > 0 && <i className="badge red">{expiredCount}</i>}
      </button>
      <button className={route.type === 'audit' ? 'nav active' : 'nav'} onClick={() => onRoute({ type: 'audit' })}>
        <ScrollText size={15} /><span className="nav-name">操作记录</span>
      </button>

      <div className="aside-bottom">
        <div className="mini-card">
          <AlertTriangle size={15} />
          <div><b>数据已本地保存</b><small>刷新后自动恢复 · 支持撤销/重做</small></div>
        </div>
        <div className="user"><div className="avatar">ZL</div><span>Zen Li</span></div>
      </div>
    </aside>
  );
}
