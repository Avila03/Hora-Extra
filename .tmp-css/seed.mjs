// Cria um espaço com dados de exemplo para a comparação visual. Uso: node seed.mjs
import {createClient} from '@supabase/supabase-js';
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const PASS = process.env.HE_PASSWORD, SPACE = process.env.HE_SPACE || 'VISUAL E2E';
const day = n => new Date(Date.now() + n * 864e5).toLocaleDateString('en-CA', {timeZone: 'America/Sao_Paulo'});
async function client(email) {
  const c = createClient(URL, KEY, {auth: {persistSession: false}});
  const {data, error} = await c.auth.signInWithPassword({email, password: PASS});
  if (error) throw error;
  return {c, id: data.user.id};
}
const must = async (p, label) => { const {data, error} = await p; if (error) throw new Error(label + ': ' + error.message); return data; };
const {c: o, id: oid} = await client(process.env.HE_OWNER_EMAIL);
const {c: k, id: kid} = await client(process.env.HE_COLLAB_EMAIL);
const ws = crypto.randomUUID();
await must(o.from('workspaces').insert({id: ws, name: SPACE, created_by: oid}), 'workspace');
const token = await must(o.rpc('create_workspace_invite', {p_workspace: ws}), 'invite');
await must(k.rpc('join_workspace_by_link', {p_token: token}), 'join');
await must(k.rpc('set_my_display_name', {p_workspace: ws, p_name: 'Marina'}), 'name');
await must(o.rpc('set_my_display_name', {p_workspace: ws, p_name: 'Bruno'}), 'name');
const [adega, despensa] = [crypto.randomUUID(), crypto.randomUUID()];
await must(o.from('areas').insert([{id: adega, workspace_id: ws, name: 'Adega'}, {id: despensa, workspace_id: ws, name: 'Despensa'}]), 'areas');
const [cerveja, arroz, leite] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
await must(o.from('inventory_items').insert([
  {id: cerveja, workspace_id: ws, name: 'Cerveja lata', category: 'Bebidas', quantity: 24, min_quantity: 6, unit: 'un', area_id: adega, price: 4.5},
  {id: arroz, workspace_id: ws, name: 'Arroz', category: 'Alimentos', quantity: 1, min_quantity: 2, unit: 'kg', area_id: despensa},
  {id: leite, workspace_id: ws, name: 'Leite', category: 'Alimentos', quantity: 6, min_quantity: 2, unit: 'L', expires_on: day(5)},
]), 'stock');
await must(o.rpc('record_inventory_movement', {p_item_id: cerveja, p_delta: -2, p_reason: 'Geladeira'}), 'move');
const [e1, e2] = [crypto.randomUUID(), crypto.randomUUID()];
await must(o.from('events').insert([
  {id: e1, workspace_id: ws, title: 'Churrasco de sábado', event_date: day(4), start_time: '13:00', guests: 12, event_type: 'Churrasco', status: 'confirmed', notes: 'Chegar cedo para acender a churrasqueira.', menu_notes: 'Uma opção vegetariana.'},
  {id: e2, workspace_id: ws, title: 'Jantar de aniversário', event_date: day(-10), start_time: '20:00', guests: 8, event_type: 'Jantar', status: 'planning'},
]), 'events');
await must(o.from('menu_items').insert([
  {workspace_id: ws, event_id: e1, name: 'Picanha', quantity: 3, unit: 'kg', course: 'main'},
  {workspace_id: ws, event_id: e1, name: 'Farofa', quantity: 1, unit: 'kg', course: 'side', notes: 'da vó'},
  {workspace_id: ws, event_id: e1, name: 'Caipirinha', quantity: 20, unit: 'un', course: 'drink'},
]), 'menu');
await must(o.from('event_requirements').insert([
  {workspace_id: ws, event_id: e1, name: 'Garfos', quantity: 20, unit: 'un', is_done: true, assigned_to: null, inventory_item_id: null},
  {workspace_id: ws, event_id: e1, name: 'Copos', quantity: 20, unit: 'un', is_done: false, assigned_to: kid, inventory_item_id: null},
  {workspace_id: ws, event_id: e1, name: 'Cerveja gelada', quantity: 30, unit: 'un', is_done: false, assigned_to: null, inventory_item_id: cerveja},
]), 'reqs');
await must(o.from('shopping_items').insert([
  {workspace_id: ws, event_id: e1, name: 'Carvão', quantity: 2, unit: 'saco', status: 'purchased', assigned_to: null, estimated_unit_price: null},
  {workspace_id: ws, event_id: e1, name: 'Carne', quantity: 5, unit: 'kg', status: 'pending', assigned_to: kid, estimated_unit_price: 70},
  {workspace_id: ws, event_id: e1, name: 'Gelo', quantity: 3, unit: 'saco', status: 'pending', assigned_to: null, estimated_unit_price: null},
  {workspace_id: ws, event_id: e1, name: 'Pão de alho', quantity: 2, unit: 'pacote', status: 'received', assigned_to: null, estimated_unit_price: null},
]), 'shopping');
await must(o.from('tasks').insert([
  {workspace_id: ws, event_id: e1, title: 'Limpar a churrasqueira', event_phase: 'before', status: 'done', kind: 'general', assigned_to: null, due_on: null},
  {workspace_id: ws, event_id: e1, title: 'Buscar o gelo', event_phase: 'before', status: 'pending', kind: 'general', assigned_to: kid, due_on: day(3)},
  {workspace_id: ws, event_id: e1, title: 'Servir as bebidas', event_phase: 'during', status: 'in_progress', kind: 'general', assigned_to: oid, due_on: null},
  {workspace_id: ws, event_id: e1, title: 'Lavar a louça', event_phase: 'after', status: 'pending', kind: 'general', assigned_to: null, due_on: null},
  {workspace_id: ws, event_id: null, title: 'Trocar o filtro da água', event_phase: 'before', status: 'pending', kind: 'maintenance', assigned_to: null, due_on: day(10)},
  {workspace_id: ws, event_id: null, title: 'Comprar guardanapos', event_phase: 'before', status: 'pending', kind: 'purchase', assigned_to: null, due_on: null},
]), 'tasks');
await must(k.from('tasks').insert({workspace_id: ws, title: 'Conferir as cadeiras', assigned_to: oid, due_on: day(2)}), 'notify owner');
const [tacas, pratos, travessa] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
await must(o.from('assets').insert([
  {id: tacas, workspace_id: ws, name: 'Taças de vinho', quantity: 12, area_id: adega},
  {id: pratos, workspace_id: ws, name: 'Pratos rasos', quantity: 20, area_id: despensa},
  {id: travessa, workspace_id: ws, name: 'Travessa antiga', quantity: 2},
]), 'assets');
await must(o.rpc('record_asset_action', {p_asset_id: tacas, p_kind: 'loan', p_quantity: 3, p_person: 'Tia Maria', p_notes: null, p_loan_id: null, p_due_on: day(7), p_event_id: null}), 'loan');
await must(o.rpc('set_asset_archived', {p_asset_id: travessa, p_archived: true}), 'archive');
await must(o.rpc('finish_event', {p_event_id: e2, p_notes: 'Foi ótimo', p_leftovers: 'Sobrou bolo', p_damages_notes: 'Dois pratos', p_cleanup: 'Lavar toalhas',
  p_consumption: [{inventory_item_id: leite, consumed: 2, leftover: 1, deduct: true}], p_asset_damages: [{asset_id: pratos, quantity: 2}]}), 'closeout');
console.log('seeded', ws);
