'use client';
import {useState} from 'react';
import {MapPin, Pencil, Trash2, Check, X, Plus} from 'lucide-react';

const friendly = error => error?.code === '23505' ? 'Já existe um local com esse nome.' : error?.message || 'Não foi possível salvar.';

export default function AreasManager({areas = [], items = [], assets = [], supabase, workspaceId, canEdit = false, canDelete = false, onRefresh, onNotify, onClose}) {
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [newName, setNewName] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const sorted = areas.slice().sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const usage = id => items.filter(i => i.area_id === id).length + assets.filter(a => a.area_id === id).length;

  async function run(action, success) {
    if (working) return false;
    setWorking(true); setError('');
    const {error: dbError, data} = await action();
    setWorking(false);
    if (dbError) { setError(friendly(dbError)); return false; }
    if (Array.isArray(data) && data.length === 0) { setError('Nada foi alterado. Atualize a página e tente novamente.'); return false; }
    await onRefresh(); onNotify(success);
    return true;
  }
  async function create(e) {
    e.preventDefault();
    const value = newName.trim();
    if (!canEdit || !value) return;
    if (await run(() => supabase.from('areas').insert({workspace_id: workspaceId, name: value}).select('id'), 'Local "' + value + '" criado.')) setNewName('');
  }
  async function rename(area) {
    const value = name.trim();
    if (!canEdit || !value || value === area.name) { setEditing(null); return; }
    if (await run(() => supabase.from('areas').update({name: value}).eq('workspace_id', workspaceId).eq('id', area.id).select('id'), 'Local renomeado.')) setEditing(null);
  }
  async function remove(area) {
    const used = usage(area.id);
    if (!canDelete || !window.confirm('Excluir o local "' + area.name + '"?' + (used ? ' ' + used + ' item(ns) guardado(s) nele ficarão sem local definido.' : ''))) return;
    await run(() => supabase.from('areas').delete().eq('workspace_id', workspaceId).eq('id', area.id).select('id'), 'Local excluído.');
  }

  return <div className="hx-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className="hx-dialog he-areas-dialog" role="dialog" aria-modal="true" aria-label="Locais de armazenamento">
      <div className="he-areas-head"><h2><MapPin size={20}/> Locais de armazenamento</h2><button type="button" className="hx-secondary" aria-label="Fechar" onClick={onClose}><X size={17}/></button></div>
      <p className="hx-muted">Onde ficam produtos, louças e utensílios da casa. {canDelete ? 'Ao excluir um local, os itens dele ficam sem local definido.' : 'Somente administradores excluem locais.'}</p>
      {canEdit && <form className="he-areas-new" onSubmit={create}>
        <input aria-label="Nome do novo local" maxLength={120} placeholder="Ex.: Despensa, Adega, Armário da varanda" value={newName} onChange={e => setNewName(e.target.value)}/>
        <button className="hx-primary" disabled={working || !newName.trim()}><Plus size={16}/> Adicionar local</button>
      </form>}
      {error && <p className="he-areas-error" role="alert">{error}</p>}
      <ul className="he-areas-list">
        {sorted.map(area => <li key={area.id} className="he-areas-row">
          {editing === area.id
            ? <form className="he-areas-edit" onSubmit={e => { e.preventDefault(); rename(area); }}>
                <input aria-label={'Novo nome para ' + area.name} autoFocus maxLength={120} value={name} onChange={e => setName(e.target.value)}/>
                <button className="hx-primary" disabled={working} aria-label="Salvar nome"><Check size={16}/></button>
                <button type="button" className="hx-secondary" aria-label="Cancelar" onClick={() => setEditing(null)}><X size={16}/></button>
              </form>
            : <>
                <div><strong>{area.name}</strong><small>{usage(area.id) === 1 ? '1 item' : usage(area.id) + ' itens'}</small></div>
                <div className="he-areas-actions">
                  {canEdit && <button type="button" className="hx-secondary" aria-label={'Renomear ' + area.name} onClick={() => { setEditing(area.id); setName(area.name); setError(''); }}><Pencil size={15}/></button>}
                  {canDelete && <button type="button" className="hx-secondary" aria-label={'Excluir local ' + area.name} disabled={working} onClick={() => remove(area)}><Trash2 size={15}/></button>}
                </div>
              </>}
        </li>)}
        {!sorted.length && <li className="he-areas-empty">Nenhum local cadastrado ainda.</li>}
      </ul>
    </div>
  </div>;
}
