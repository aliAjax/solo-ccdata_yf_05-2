import { ReactNode, useRef, useState } from 'react';
import { AlertTriangle, FileUp, Plus, Trash2, X } from 'lucide-react';
import {
  KIND_LABEL, LICENSES, Obligation, Policy, PolicyKind, Project, SOURCES, clonePolicy, fmtTime,
} from '../types';
import { ImportAnalysis } from '../snapshot';

function Shell({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="backdrop" onClick={onClose}>
      <div className={wide ? 'modal wide' : 'modal'} onClick={e => e.stopPropagation()}>
        <div className="modal-head"><h2>{title}</h2><button onClick={onClose}><X size={18} /></button></div>
        {children}
      </div>
    </div>
  );
}

// ---------- 新建项目 ----------

const KIND_DESC: Record<PolicyKind, string> = {
  internal: '仅内部使用，限制最宽松',
  closed: '对外闭源分发，禁止 Copyleft',
  open: '以开源形式发布，禁止专有许可',
};

export function ProjectModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, kind: PolicyKind) => void }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<PolicyKind>('closed');
  return (
    <Shell title="新建项目" onClose={onClose}>
      <label>项目名称<input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="例如 Payment Service" /></label>
      <label>分发政策</label>
      <div className="kind-grid">
        {(Object.keys(KIND_LABEL) as PolicyKind[]).map(k => (
          <button key={k} className={kind === k ? 'kind-card active' : 'kind-card'} onClick={() => setKind(k)}>
            <b>{KIND_LABEL[k]}</b><small>{KIND_DESC[k]}</small>
          </button>
        ))}
      </div>
      <button className="primary full" disabled={!name.trim()} onClick={() => onCreate(name.trim(), kind)}>创建项目</button>
    </Shell>
  );
}

// ---------- 政策编辑器 ----------

export function PolicyEditor({ project, onClose, onSave }: {
  project: Project;
  onClose: () => void;
  onSave: (policy: Policy) => void;
}) {
  const [policy, setPolicy] = useState<Policy>(() => JSON.parse(JSON.stringify(project.policy)) as Policy);
  const patch = (p: Partial<Policy>) => setPolicy(prev => ({ ...prev, ...p }));
  const toggleBanned = (l: string) => patch({
    banned: policy.banned.includes(l) ? policy.banned.filter(x => x !== l) : [...policy.banned, l],
  });
  const toggleSource = (s: string) => {
    const sources = policy.scope.sources.includes(s)
      ? policy.scope.sources.filter(x => x !== s)
      : [...policy.scope.sources, s];
    patch({ scope: { sources } });
  };
  const setObligation = (i: number, o: Partial<Obligation>) => {
    const obligations = policy.obligations.map((x, idx) => idx === i ? { ...x, ...o } : x);
    patch({ obligations });
  };
  const valid = policy.scope.sources.length > 0 && policy.exceptionDays >= 1;

  return (
    <Shell title={`编辑政策 · ${project.name}`} onClose={onClose} wide>
      <div className="policy-edit">
        <div className="pe-row">
          <label>政策类型</label>
          <div className="pe-kind">
            <select value={policy.kind} onChange={e => patch({ kind: e.target.value as PolicyKind })}>
              {(Object.keys(KIND_LABEL) as PolicyKind[]).map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
            <button className="outline" onClick={() => setPolicy(clonePolicy(policy.kind))}>套用{KIND_LABEL[policy.kind]}预设</button>
          </div>
        </div>

        <div className="pe-row">
          <label>禁止许可（命中即高风险）</label>
          <div className="chip-grid">
            {LICENSES.map(l => (
              <button key={l} className={policy.banned.includes(l) ? 'chip on' : 'chip'} onClick={() => toggleBanned(l)}>{l}</button>
            ))}
          </div>
        </div>

        <div className="pe-row">
          <label>附加义务（按许可证触发）</label>
          {policy.obligations.map((o, i) => (
            <div className="ob-row" key={i}>
              <select value={o.license} onChange={e => setObligation(i, { license: e.target.value })}>
                {LICENSES.map(l => <option key={l}>{l}</option>)}
              </select>
              <select value={o.level} onChange={e => setObligation(i, { level: e.target.value as Obligation['level'] })}>
                <option value="notice">提示</option>
                <option value="duty">义务（计为需关注）</option>
              </select>
              <input value={o.text} placeholder="义务说明" onChange={e => setObligation(i, { text: e.target.value })} />
              <button className="icon-btn" title="删除" onClick={() => patch({ obligations: policy.obligations.filter((_, idx) => idx !== i) })}><Trash2 size={14} /></button>
            </div>
          ))}
          <button className="outline small" onClick={() => patch({ obligations: [...policy.obligations, { license: 'MIT', text: '', level: 'notice' }] })}>
            <Plus size={13} />添加义务
          </button>
        </div>

        <div className="pe-row two-col">
          <div>
            <label>例外期限（豁免有效天数）</label>
            <input
              type="number" min={1} max={3650} value={policy.exceptionDays}
              onChange={e => patch({ exceptionDays: Math.max(1, Math.round(Number(e.target.value) || 1)) })}
            />
          </div>
          <div>
            <label>生效范围（按来源）</label>
            <div className="chip-grid">
              {SOURCES.map(s => (
                <button key={s} className={policy.scope.sources.includes(s) ? 'chip on teal' : 'chip'} onClick={() => toggleSource(s)}>{s}</button>
              ))}
            </div>
          </div>
        </div>

        {!valid && <p className="form-error"><AlertTriangle size={13} />生效范围至少选择一个来源，例外期限至少 1 天。</p>}
        <button className="primary full" disabled={!valid} onClick={() => onSave(policy)}>保存政策并重算风险</button>
      </div>
    </Shell>
  );
}

// ---------- 添加依赖 ----------

export function AddDepModal({ projects, defaultProjectId, isDuplicate, onClose, onAdd }: {
  projects: Project[];
  defaultProjectId: number | null;
  isDuplicate: (name: string, version: string) => boolean;
  onClose: () => void;
  onAdd: (input: { name: string; version: string; license: string; source: string; projectId: number | null }) => void;
}) {
  const [name, setName] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [license, setLicense] = useState('MIT');
  const [source, setSource] = useState(SOURCES[0]);
  const [projectId, setProjectId] = useState<number | null>(defaultProjectId);
  const [error, setError] = useState('');
  const submit = () => {
    const n = name.trim();
    if (!n) return;
    if (isDuplicate(n, version.trim() || '1.0.0')) {
      setError(`依赖 ${n}@${version.trim() || '1.0.0'} 已存在，不能重复添加`);
      return;
    }
    onAdd({ name: n, version: version.trim() || '1.0.0', license, source, projectId });
  };
  return (
    <Shell title="添加依赖" onClose={onClose}>
      <label>依赖名称<input autoFocus value={name} onChange={e => { setName(e.target.value); setError(''); }} placeholder="例如 date-fns" /></label>
      <label>版本<input value={version} onChange={e => setVersion(e.target.value)} /></label>
      <label>许可证
        <select value={license} onChange={e => setLicense(e.target.value)}>{LICENSES.map(l => <option key={l}>{l}</option>)}</select>
      </label>
      <label>来源
        <select value={source} onChange={e => setSource(e.target.value)}>{SOURCES.map(s => <option key={s}>{s}</option>)}</select>
      </label>
      <label>归入项目
        <select value={projectId === null ? 'none' : String(projectId)} onChange={e => setProjectId(e.target.value === 'none' ? null : Number(e.target.value))}>
          <option value="none">暂不归入</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      {error && <p className="form-error"><AlertTriangle size={13} />{error}</p>}
      <button className="primary full" disabled={!name.trim()} onClick={submit}>加入工作台（待复核）</button>
    </Shell>
  );
}

// ---------- 豁免 ----------

export function ExemptModal({ count, exceptionDays, onClose, onConfirm }: {
  count: number;
  exceptionDays: number;
  onClose: () => void;
  onConfirm: (reason: string, until: number) => void;
}) {
  const defaultDate = new Date(Date.now() + exceptionDays * 86400000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const [date, setDate] = useState(`${defaultDate.getFullYear()}-${pad(defaultDate.getMonth() + 1)}-${pad(defaultDate.getDate())}`);
  const [reason, setReason] = useState('');
  const until = new Date(`${date}T23:59:59`).getTime();
  const invalid = !date || Number.isNaN(until) || until <= Date.now();
  return (
    <Shell title={`豁免 ${count} 个依赖`} onClose={onClose}>
      <p className="modal-hint">豁免在例外期限内有效，到期后自动视同「待复核」。</p>
      <label>豁免理由<textarea autoFocus value={reason} onChange={e => setReason(e.target.value)} placeholder="例如：短期兼容方案，Q4 前替换为 MIT 许可的替代库" rows={3} /></label>
      <label>豁免截止（默认按政策例外期限 {exceptionDays} 天）<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
      {invalid && <p className="form-error"><AlertTriangle size={13} />截止日期必须晚于当前时间。</p>}
      <button className="primary full" disabled={invalid || !reason.trim()} onClick={() => onConfirm(reason.trim(), until)}>确认豁免</button>
    </Shell>
  );
}

// ---------- 导入快照 ----------

export function ImportModal({ analyze, onClose, onConfirm }: {
  analyze: (text: string) => ImportAnalysis;
  onClose: () => void;
  onConfirm: (analysis: ImportAnalysis) => void;
}) {
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
  const [fileName, setFileName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const readFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setAnalysis(analyze(String(reader.result ?? '')));
    reader.readAsText(file);
  };

  return (
    <Shell title="导入项目快照" onClose={onClose}>
      <input
        ref={inputRef} type="file" accept=".json,application/json" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ''; }}
      />
      <button className="outline full" onClick={() => inputRef.current?.click()}>
        <FileUp size={15} />{fileName || '选择快照文件（.json）'}
      </button>

      {analysis && !analysis.ok && (
        <div className="import-report error">
          <b><AlertTriangle size={14} /> 导入失败</b>
          <p>{analysis.error}</p>
          {analysis.conflicts.length > 0 && <ul>{analysis.conflicts.map((c, i) => <li key={i}>{c}</li>)}</ul>}
        </div>
      )}

      {analysis?.ok && (
        <div className="import-report">
          <div className="ir-grid">
            <div><label>快照版本</label><b>v{analysis.version}</b></div>
            <div><label>导出时间</label><b>{analysis.exportedAt ? fmtTime(analysis.exportedAt) : '—'}</b></div>
            <div><label>项目</label><b>{analysis.finalName}</b></div>
            <div><label>依赖 / 记录</label><b>{analysis.depCount} / {analysis.auditCount} 条</b></div>
          </div>
          {analysis.conflicts.length > 0 && (
            <div className="ir-conflicts">
              <b><AlertTriangle size={14} /> 检测到 {analysis.conflicts.length} 项冲突，将按以下方式处理：</b>
              <ul>{analysis.conflicts.map((c, i) => <li key={i}>{c}</li>)}</ul>
              {(analysis.skippedDeps ?? 0) > 0 && <p>共跳过 {analysis.skippedDeps} 个重复或无效依赖。</p>}
            </div>
          )}
          {analysis.conflicts.length === 0 && <p className="ir-clean">未检测到冲突，可直接导入。</p>}
        </div>
      )}

      <button className="primary full" disabled={!analysis?.ok} onClick={() => analysis && onConfirm(analysis)}>
        确认导入
      </button>
    </Shell>
  );
}
