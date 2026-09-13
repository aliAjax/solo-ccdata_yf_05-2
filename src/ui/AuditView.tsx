import { useMemo, useState } from 'react';
import { ACTION_LABEL, AuditEntry, Project, fmtTime } from '../types';

interface Props {
  audit: AuditEntry[];
  projects: Project[];
}

/** 全局操作记录视图 */
export default function AuditView({ audit, projects }: Props) {
  const [projectFilter, setProjectFilter] = useState('all');
  const nameOf = (id: number | null) => id === null ? '—' : projects.find(p => p.id === id)?.name ?? '（已删除项目）';

  const rows = useMemo(() => {
    const filtered = projectFilter === 'all'
      ? audit
      : audit.filter(a => String(a.projectId) === projectFilter);
    return [...filtered].sort((a, b) => b.at - a.at).slice(0, 300);
  }, [audit, projectFilter]);

  return (
    <div className="table-pane">
      <div className="pane-head">
        <div><h2>操作记录</h2><p>项目、政策与依赖的全部操作历史（最新 {rows.length} 条）</p></div>
        <div className="tools">
          <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}>
            <option value="all">全部项目</option>
            {projects.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
          </select>
        </div>
      </div>
      <div className="table">
        <div className="tr th audit-row">
          <span>时间</span><span>操作</span><span>项目</span><span>详情</span><span>操作者</span>
        </div>
        {rows.map(a => (
          <div className="tr audit-row" key={a.id}>
            <span className="muted">{fmtTime(a.at)}</span>
            <span><i className="audit-action">{ACTION_LABEL[a.action] ?? a.action}</i></span>
            <span className="muted">{nameOf(a.projectId)}</span>
            <span>{a.detail}</span>
            <span className="muted">{a.actor}</span>
          </div>
        ))}
        {rows.length === 0 && <div className="table-empty">暂无操作记录</div>}
      </div>
    </div>
  );
}
