import { Ban, Check, ShieldQuestion, Trash2, X } from 'lucide-react';
import { Project } from '../types';

interface Props {
  count: number;
  projects: Project[];
  onAssign: (projectId: number | null) => void;
  onApprove: () => void;
  onExempt: () => void;
  onReject: () => void;
  onRemove: () => void;
  onClear: () => void;
}

/** 批量操作栏：选中依赖后出现，所有操作合并为一步历史记录 */
export default function BatchBar({ count, projects, onAssign, onApprove, onExempt, onReject, onRemove, onClear }: Props) {
  if (count === 0) return null;
  return (
    <div className="batch-bar">
      <b>{count} 项已选</b>
      <select
        value=""
        onChange={e => { if (e.target.value !== '') onAssign(e.target.value === 'none' ? null : Number(e.target.value)); }}
        title="批量归入项目"
      >
        <option value="" disabled>归入项目…</option>
        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        <option value="none">移出项目（未归入）</option>
      </select>
      <button className="mini ok" onClick={onApprove}><Check size={13} />批准</button>
      <button className="mini warn" onClick={onExempt}><ShieldQuestion size={13} />豁免…</button>
      <button className="mini danger" onClick={onReject}><Ban size={13} />驳回</button>
      <button className="mini ghost" onClick={onRemove}><Trash2 size={13} />删除</button>
      <button className="mini ghost" onClick={onClear}><X size={13} />取消选择</button>
    </div>
  );
}
