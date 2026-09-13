import { AlertTriangle, Check, Minus } from 'lucide-react';
import { Dep, Project, RISK_LABEL, STATUS_LABEL, computeRisk, effectiveStatus, exemptionExpired, fmtDate } from '../types';

interface Props {
  deps: Dep[];
  projects: Project[];
  showProject: boolean;
  selected: Set<number>;
  onToggle: (id: number) => void;
  onToggleAll: (ids: number[]) => void;
  onOpen: (id: number) => void;
  detailId: number | null;
  now: number;
}

const LICENSE_COLORS: Record<string, string> = {
  MIT: '#35b995', 'BSD-2-Clause': '#6d9ee8', 'BSD-3-Clause': '#6d9ee8', 'Apache-2.0': '#b18ee4',
  ISC: '#35b995', 'MPL-2.0': '#e8a06d', 'LGPL-2.1': '#e8a06d', 'LGPL-3.0': '#e8a06d',
  'GPL-2.0': '#ec8c75', 'GPL-3.0': '#ec8c75', 'AGPL-3.0': '#e06a5a', 'EPL-2.0': '#e8a06d',
  'CC0-1.0': '#7ec8a9', 'CC-BY-NC-4.0': '#d06a8a', 'SSPL-1.0': '#d06a8a',
  Unlicense: '#7ec8a9', Proprietary: '#c05555', Unknown: '#999999',
};

export function licenseColor(license: string): string {
  return LICENSE_COLORS[license] ?? '#888888';
}

export default function DepTable({ deps, projects, showProject, selected, onToggle, onToggleAll, onOpen, detailId, now }: Props) {
  const projectOf = (id: number | null) => projects.find(p => p.id === id) ?? null;
  const allChecked = deps.length > 0 && deps.every(d => selected.has(d.id));
  const someChecked = deps.some(d => selected.has(d.id));

  return (
    <div className="table">
      <div className={showProject ? 'tr th wide' : 'tr th'}>
        <span className="cell-check" onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={allChecked}
            ref={el => { if (el) el.indeterminate = !allChecked && someChecked; }}
            onChange={() => onToggleAll(deps.map(d => d.id))}
            title="全选当前列表"
          />
        </span>
        <span>依赖名称</span><span>版本</span><span>许可证</span>
        {showProject && <span>项目</span>}
        <span>风险</span><span>状态</span>
      </div>
      {deps.map(d => {
        const project = projectOf(d.projectId);
        const risk = computeRisk(d, project ? project.policy : null);
        const expired = exemptionExpired(d, now);
        const eff = effectiveStatus(d, now);
        const checked = selected.has(d.id);
        return (
          <div
            key={d.id}
            className={`tr${showProject ? ' wide' : ''}${d.id === detailId ? ' selected' : ''}${checked ? ' checked' : ''}`}
            onClick={() => onOpen(d.id)}
            role="button"
            tabIndex={0}
          >
            <span className="cell-check" onClick={e => e.stopPropagation()}>
              <input type="checkbox" checked={checked} onChange={() => onToggle(d.id)} />
            </span>
            <span className="dep-name"><span className="pkg-dot" />{d.name}</span>
            <span className="muted">{d.version}</span>
            <span>
              <i className="license" style={{ color: licenseColor(d.license), background: licenseColor(d.license) + '18' }}>{d.license}</i>
            </span>
            {showProject && <span className="muted">{project ? project.name : '未归入'}</span>}
            <span>
              {risk === null
                ? <i className="risk na">不适用</i>
                : <i className={`risk ${risk}`}>{risk === 'high' ? <AlertTriangle size={11} /> : risk === 'low' ? <Check size={11} /> : <Minus size={11} />}{RISK_LABEL[risk]}</i>}
            </span>
            <span>
              {expired
                ? <i className="st expired">豁免已过期</i>
                : <i className={`st ${eff}`}>
                    {STATUS_LABEL[d.status]}
                    {d.status === 'exempted' && d.exemption ? ` · ${fmtDate(d.exemption.until)} 到期` : ''}
                  </i>}
            </span>
          </div>
        );
      })}
      {deps.length === 0 && <div className="table-empty">没有匹配的依赖</div>}
    </div>
  );
}
