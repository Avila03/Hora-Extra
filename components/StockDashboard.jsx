'use client';

import {useEffect, useMemo, useState} from 'react';
import {
  AlertTriangle, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CalendarClock,
  CheckCircle2, ChevronRight, CircleDollarSign, Clock3, Package, PackagePlus,
  Search, SlidersHorizontal, Boxes, Coffee, UtensilsCrossed, SprayCan, Leaf,
  Pencil, Trash2, MapPin, X, Plus, Minus, History
} from 'lucide-react';

const categories=['Todos','Bebidas','Alimentos','Ingredientes','Temperos','Limpeza','Descartáveis','Outros'];
const metricDate=raw=>raw?new Date(raw+'T12:00:00'):null;
const formatDate=raw=>raw?metricDate(raw).toLocaleDateString('pt-BR'):'—';
const number=v=>Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:3});
const currency=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const isLow=p=>Number(p.quantity)<=Number(p.min_quantity);
const daysLeft=(raw)=>{
  if(!raw)return null;
  const d=metricDate(raw);if(!d||Number.isNaN(d.getTime()))return null;
  const today=new Date();today.setHours(12,0,0,0);
  return Math.round((d.getTime()-today.getTime())/86400000);
};
function productIcon(category) {
  if(category==='Bebidas')return Coffee;
  if(category==='Alimentos'||category==='Ingredientes')return UtensilsCrossed;
  if(category==='Temperos')return Leaf;
  if(category==='Limpeza')return SprayCan;
  return Boxes;
}
function availability(item) {
  if(Number(item.quantity)<=0)return {label:'Em falta',kind:'danger'};
  if(isLow(item))return {label:'Estoque baixo',kind:'warning'};
  return {label:'Em dia',kind:'success'};
}
function dateStatus(raw){
  const left=daysLeft(raw);
  if(left===null)return null;
  if(left<0)return {label:'Vencido',kind:'danger'};
  if(left===0)return {label:'Vence hoje',kind:'danger'};
  if(left<=30)return {label:'Vence em '+left+' dia'+(left===1?'':'s'),kind:'warning'};
  return null;
}

export default function StockDashboard({
 items=[], movements=[], areas=[], memberships=[], canEdit=false, canDelete=false, focusItemId=null,
 onAdd, onEdit, onDelete, onMove
}){
 const [search,setSearch]=useState('');
 const [category,setCategory]=useState('Todos');
 const [quickFilter,setQuickFilter]=useState('all');
 const [showAllMovements,setShowAllMovements]=useState(false);
 const [movement,setMovement]=useState(null);
 const [qty,setQty]=useState('1');
 const [reason,setReason]=useState('');
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{
  if(!focusItemId)return;
  setSearch('');setCategory('Todos');setQuickFilter('all');
  const frame=requestAnimationFrame(()=>document.getElementById('he-stock-'+focusItemId)?.scrollIntoView({behavior:'smooth',block:'center'}));
  return()=>cancelAnimationFrame(frame);
 },[focusItemId]);
 const areasById=useMemo(()=>Object.fromEntries(areas.map(x=>[x.id,x.name])),[areas]);
 const membersById=useMemo(()=>Object.fromEntries(memberships.map(x=>[x.user_id,x.display_name||'Membro'])),[memberships]);
 const low=items.filter(isLow);
 const expiring=items.filter(p=>{const d=daysLeft(p.expires_on);return d!==null&&d<=30;});
 const today=new Date().toLocaleDateString('pt-BR');
 const movedToday=movements.filter(m=>new Date(m.created_at).toLocaleDateString('pt-BR')===today).length;
 const stockValue=items.reduce((sum,p)=>sum+Number(p.quantity||0)*Number(p.price||0),0);
 const filtered=useMemo(()=>items.filter(p=>{
   const matchesCategory=category==='Todos'||(p.category||'Outros')===category;
   const s=search.trim().toLocaleLowerCase('pt-BR');
   const matchesSearch=!s||[p.name,p.category,p.unit,areasById[p.area_id]].some(x=>String(x||'').toLocaleLowerCase('pt-BR').includes(s));
   const d=daysLeft(p.expires_on);
   const matchesQuick=quickFilter==='all'||(quickFilter==='low'&&isLow(p))||(quickFilter==='expiry'&&d!==null&&d<=30);
   return matchesCategory&&matchesSearch&&matchesQuick;
 }).sort((a,b)=>{
   const rank=p=>Number(p.quantity)<=0?0:isLow(p)?1:daysLeft(p.expires_on)!==null&&daysLeft(p.expires_on)<=30?2:3;
   return rank(a)-rank(b)||a.name.localeCompare(b.name,'pt-BR');
 }),[items,category,search,quickFilter,areasById]);
 const byItem=useMemo(()=>Object.fromEntries(items.map(p=>[p.id,p])),[items]);
 const recent=movements.slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));

 function beginMovement(item,direction) {
   setMovement({item,direction});
   setQty('1');setReason('');setError('');
 }
 async function submitMovement(e) {
   e.preventDefault();
   const value=Number(qty.replace(',','.'));
   if(!Number.isFinite(value)||value<=0){setError('Informe uma quantidade válida.');return;}
   if(movement.direction<0&&value>Number(movement.item.quantity)){setError('Quantidade maior que o estoque disponível.');return;}
   if(!reason.trim()){setError('Informe o motivo da movimentação.');return;}
   setSaving(true);setError('');
   const ok=await onMove(movement.item,movement.direction*value,reason.trim());
   setSaving(false);
   if(ok)setMovement(null);
   else setError('Não foi possível registrar. Verifique o aviso e tente novamente.');
 }
 return <div className="stock-v2">
   <div className="stock-intro"><div className="stock-intro-icon"><Package size={25}/></div><div><h2>Seu estoque, sempre organizado</h2><p>Acompanhe quantidades, vencimentos e movimentações em um só lugar.</p></div></div>

   <div className="stock-metrics">
     <button type="button" className={'stock-metric stock-metric-danger '+(quickFilter==='low'?'selected':'')} onClick={()=>setQuickFilter(quickFilter==='low'?'all':'low')}><span><AlertTriangle size={19}/> Itens em baixa</span><strong>{low.length}</strong><small>Precisam de reposição <ChevronRight size={15}/></small></button>
     <button type="button" className={'stock-metric stock-metric-warning '+(quickFilter==='expiry'?'selected':'')} onClick={()=>setQuickFilter(quickFilter==='expiry'?'all':'expiry')}><span><CalendarClock size={19}/> Atenção à validade</span><strong>{expiring.length}</strong><small>Vencidos ou em até 30 dias <ChevronRight size={15}/></small></button>
     <div className="stock-metric stock-metric-green"><span><ArrowLeftRight size={19}/> Movimentações hoje</span><strong>{movedToday}</strong><small>Entradas e saídas registradas</small></div>
     <div className="stock-metric stock-metric-mint"><span><CircleDollarSign size={19}/> Valor em estoque</span><strong className="stock-money">{currency(stockValue)}</strong><small>Somente produtos com preço</small></div>
   </div>

   {low.length>0&&<button type="button" className="stock-alert" onClick={()=>{setQuickFilter('low');setCategory('Todos')}}><AlertTriangle size={20}/><span><strong>Reabastecimento necessário</strong><small>{low.length} {low.length===1?'produto precisa':'produtos precisam'} de atenção. Toque para visualizar.</small></span><ChevronRight size={18}/></button>}

   <div className="stock-toolbar"><div className="stock-search"><Search size={19}/><input aria-label="Buscar produto" placeholder="Buscar produto, categoria ou local..." value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button aria-label="Limpar busca" onClick={()=>setSearch('')}><X size={17}/></button>}</div>{canEdit&&<button className="stock-create" onClick={onAdd}><PackagePlus size={19}/> Adicionar produto</button>}</div>
   <div className="stock-filter-title"><SlidersHorizontal size={16}/> Categorias <span>{filtered.length} de {items.length} itens</span></div>
   <div className="stock-chips" aria-label="Filtrar categoria">{categories.map(c=><button key={c} type="button" aria-pressed={category===c} className={category===c?'active':''} onClick={()=>setCategory(c)}>{c}</button>)}</div>

   {quickFilter!=='all'&&<button className="stock-reset" onClick={()=>setQuickFilter('all')}>Exibindo {quickFilter==='low'?'estoque baixo':'produtos próximos do vencimento'} · Limpar filtro <X size={14}/></button>}

   <div className="stock-section-heading"><div><h3>Produtos cadastrados</h3><p>Gerencie o que está disponível no espaço.</p></div></div>
   <div className="stock-products">
     {filtered.map(item=>{
       const Icon=productIcon(item.category);
       const status=availability(item);
       const expiry=dateStatus(item.expires_on);
       const place=areasById[item.area_id]||'Sem local definido';
       return <article id={'he-stock-'+item.id} className={'stock-product '+(focusItemId===item.id?'he-notice-focused':'')} key={item.id}>
         <div className="stock-product-header"><div className="stock-product-ident"><div className="stock-product-icon"><Icon size={24}/></div><div><h4>{item.name}</h4><p>{item.category||'Outros'}</p></div></div><span className={'stock-badge '+status.kind}>{status.label}</span></div>
         <div className="stock-product-details">
           <div><span>Quantidade</span><strong className={status.kind!=='success'?'attention':''}>{number(item.quantity)} <small>{item.unit||'un'}</small></strong></div>
           <div><span>Estoque mínimo</span><strong>{number(item.min_quantity)} <small>{item.unit||'un'}</small></strong></div>
           <div><span>Local</span><strong className="stock-location"><MapPin size={13}/>{place}</strong></div>
         </div>
         {item.expires_on&&<div className="stock-expiry"><span><CalendarClock size={15}/> Validade: {formatDate(item.expires_on)}</span>{expiry&&<span className={'stock-badge '+expiry.kind}>{expiry.label}</span>}</div>}
         <div className="stock-product-actions">
          {canEdit&&<><button className="stock-in" onClick={()=>beginMovement(item,1)}><Plus size={16}/> Entrada</button><button className="stock-out" onClick={()=>beginMovement(item,-1)} disabled={Number(item.quantity)<=0}><Minus size={16}/> Saída</button><button className="stock-icon-action" aria-label={'Editar '+item.name} title="Editar produto" onClick={()=>onEdit(item)}><Pencil size={17}/></button></>}
          {canDelete&&<button className="stock-icon-action delete" aria-label={'Excluir '+item.name} title="Excluir produto" onClick={()=>onDelete(item)}><Trash2 size={17}/></button>}
          {!canEdit&&<span className="stock-view-only">Acesso de consulta</span>}
         </div>
       </article>;
     })}
     {!filtered.length&&<div className="stock-empty"><Package size={36}/><strong>Nenhum produto encontrado</strong><p>{items.length?'Experimente ajustar os filtros ou a busca.':'Cadastre seu primeiro produto para começar a controlar o estoque.'}</p>{!items.length&&canEdit&&<button className="stock-create" onClick={onAdd}><Plus size={17}/> Cadastrar produto</button>}</div>}
   </div>

   <section className="stock-history"><div className="stock-section-heading"><div><h3><History size={19}/> Movimentações recentes</h3><p>Histórico de entradas e saídas, com data e responsável.</p></div>{recent.length>5&&<button className="stock-history-more" onClick={()=>setShowAllMovements(!showAllMovements)}>{showAllMovements?'Mostrar menos':'Ver todas'} <ChevronRight size={16}/></button>}</div>
      {recent.slice(0,showAllMovements?recent.length:5).map(m=>{const positive=Number(m.delta)>0;return <div className="stock-history-row" key={m.id}><span className={'stock-history-icon '+(positive?'positive':'negative')}>{positive?<ArrowDownLeft size={18}/>:<ArrowUpRight size={18}/>}</span><div><strong>{byItem[m.inventory_item_id]?.name||'Produto removido'}</strong><p>{m.reason} · {membersById[m.created_by]||'Usuário'} · {new Date(m.created_at).toLocaleString('pt-BR')}</p></div><b className={positive?'positive':'negative'}>{positive?'+':''}{number(m.delta)} {byItem[m.inventory_item_id]?.unit||''}</b></div>})}
      {!recent.length&&<p className="stock-history-empty">As entradas e saídas aparecerão aqui após a primeira movimentação.</p>}
   </section>

   {canEdit&&<button className="stock-fab" onClick={onAdd}><Plus size={21}/> Novo produto</button>}

   {movement&&<div className="stock-modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setMovement(null)}><div className="stock-modal" role="dialog" aria-modal="true" aria-labelledby="stock-modal-title">
      <div className="stock-modal-heading"><div><span className={'stock-modal-type '+(movement.direction>0?'positive':'negative')}>{movement.direction>0?'Entrada no estoque':'Saída do estoque'}</span><h3 id="stock-modal-title">{movement.item.name}</h3><p>Saldo atual: {number(movement.item.quantity)} {movement.item.unit||'un'}</p></div><button aria-label="Fechar" onClick={()=>setMovement(null)}><X size={19}/></button></div>
      <form onSubmit={submitMovement}><label>Quantidade ({movement.item.unit||'un'})<input required autoFocus min="0.001" step="any" type="number" value={qty} onChange={e=>setQty(e.target.value)}/></label><label>Motivo<input required maxLength={250} placeholder={movement.direction>0?'Ex.: Compra para reposição':'Ex.: Consumo no evento'} value={reason} onChange={e=>setReason(e.target.value)}/></label>{error&&<p className="stock-modal-error">{error}</p>}<div className="stock-modal-footer"><button type="button" className="stock-cancel" onClick={()=>setMovement(null)}>Cancelar</button><button type="submit" className="stock-submit" disabled={saving}>{saving?'Salvando...':'Confirmar '+(movement.direction>0?'entrada':'saída')}</button></div></form>
    </div></div>}
 </div>;
}
