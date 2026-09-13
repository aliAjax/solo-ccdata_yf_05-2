import { ReactElement } from 'react';
import { AlertTriangle, Ban, Check, Clock3, FileCode2, Info, ShieldQuestion, X } from 'lucide-react';
import {
  ACTION_LABEL, AuditEntry, Dep, DepStatus, Project, RISK_LABEL, STATUS_LABEL,
  computeRisk, effectiveStatus, exemptionExpired, fmtDate, fmtTime, inScope, transitionError,
} from '../types';
import { licenseColor } from './DepTable';

interface Props {
  dep: Dep;
  project: Project | null;
  audit: AuditEntry[];
  now: number;
  onClose: () => void;
  onTransition: (target: DepStatus) => void;
  onExempt: () => void;
}

const STATUS_ORDER: DepStatus[] = ['pending', 'approved', 'exempted', 'rejected'];
const STATUS_ICON: Record<DepStatus, ReactElement> = {
  pending: <Clock3 size={13} />,
  approved: <Check size={13} />,
  exempted: <ShieldQuestion size={13} />,
  rejected: <Ban size={13} />,
};

export default function DetailPane({ dep, project, audit, now, onClose, onTransition, onExempt }: Props) {
  const policy = project ? project.policy : null;
  const risk = computeRisk(dep, policy);
  const expired = exemptionExpired(dep, now);
  const eff = effectiveStatus(dep, now);
  const obligation = policy?.obligations.find(o => o.license === dep.license) ?? null;
  const banned = !!policy && policy.banned.includes(dep.license);
  const scoped = !!policy && inScope(dep, policy);

  return (
    <div className="detail">
      <div className="detail-head">
        <div className="detail-icon" style={{ background: licenseColor(dep.license) + '1c', color: licenseColor(dep.license) }}>
          <FileCode2 size={20} />
        </div>
        <div><span>SELECTED DEPENDENCY</span><h2>{dep.name}</h2></div>
        <button className="close" onClick={onClose}><X size={16} /></button>
      </div>

      <div className="detail-grid four">
        <div><label>版本</label><b>{dep.version}</b></div>
        <div><label>来源</label><b>{dep.source}</b></div>
        <div><label>许可证</label><b>{dep.license}</b></div>
        <div><label>所属项目</label><b>{project ? project.name : '未归入'}</b></div>
      </div>

      <div className={`finding ${risk ?? 'na'}`}>
        <div className="finding-icon">{risk === 'low' ? <Check size={15} /> : <AlertTriangle size={15} />}</div>
        <div>
          <b>{!policy ? '未归入项目，未评估' : !scoped ? '不在政策生效范围内' : `按「${project!.name}」政策：${RISK_LABEL[risk!]}`}</b>
          <p>
            {!policy && '归入项目后将按该项目政策自动重算风险。'}
            {policy && !scoped && `来源「${dep.source}」未包含在政策生效范围（${policy.scope.sources.join('、')}）内。`}
            {policy && scoped && banned && `${dep.license} 在该政策的禁止许可清单中，建议替换或移除。`}
            {policy && scoped && !banned && obligation && `附加义务：${obligation.text}。`}
            {policy && scoped && !banned && !obligation && '未命中禁止许可或附加义务，可正常流转。'}
          </p>
        </div>
      </div>

      {dep.status === 'exempted' && dep.exemption && (
        <div className={expired ? 'exempt-box expired' : 'exempt-box'}>
          <div><Clock3 size={14} /><b>{expired ? '豁免已过期' : `豁免至 ${fmtDate(dep.exemption.until)}`}</b></div>
          <p>{dep.exemption.reason || '（未填写豁免理由）'}</p>
          {expired && <p className="warn-text">已超过例外期限，该依赖视同「待复核」，请重新流转。</p>}
        </div>
      )}

      <div className="trans-box">
        <label>状态流转{expired ? '（豁免已过期，按待复核参与流转）' : '（重复与非法流转将被拦截）'}</label>
        <div className="trans-row">
          {STATUS_ORDER.map(s => {
            const err = transitionError(eff, s);
            const current = eff === s;
            const cls = current ? 'trans current' : err ? 'trans blocked' : 'trans';
            return (
              <button
                key={s}
                className={cls}
                title={err ?? `流转为「${STATUS_LABEL[s]}」`}
                onClick={() => {
                  if (s === 'exempted' && !err) onExempt();
                  else onTransition(s);
                }}
              >
                {STATUS_ICON[s]}{STATUS_LABEL[s]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="history">
        <div className="history-head"><Info size={14} /><span>操作记录</span></div>
        {audit.length === 0 && <p className="muted-line">暂无记录</p>}
        {audit.map(a => (
          <div className="history-item" key={a.id}>
            <span className="history-time">{fmtTime(a.at)}</span>
            <span className="history-action">{ACTION_LABEL[a.action] ?? a.action}</span>
            <span className="history-detail">{a.detail} · {a.actor}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
