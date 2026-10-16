'use client';
import React, { useEffect, useState } from 'react';
import { Handshake, LayoutDashboard, Package, ShoppingBag, Users, Ticket, FileText, Settings, Shield, History, MessageSquare, Boxes, Plus, Upload, Download, Search, X, ArrowUpRight, Image as ImageIcon, Copy, Trash2, Save, TrendingUp, AlertCircle } from 'lucide-react';
import { api } from './store';
import {SupplierEditor} from './suppliers';
import { allowed, money, transitions } from '@/lib/commerce';
const sections: any[] = [['reports', 'Overview', LayoutDashboard], ['products', 'Products', Package], ['variants', 'Variants', Boxes], ['categories', 'Categories', Boxes], ['inventory', 'Inventory history', History], ['orders', 'Orders', ShoppingBag], ['customers', 'Customers', Users], ['support', 'Support cases', MessageSquare], ['suppliers','Supplier enquiries',Handshake], ['coupons', 'Coupons', Ticket], ['pages', 'Website pages', FileText], ['settings', 'Store & homepage', Settings], ['reviews', 'Reviews', MessageSquare], ['staff', 'Staff & permissions', Shield], ['audit', 'Audit log', History]];
const defaults: Record<string, any> = { products: { name: '', slug: '', sku: '', description: '', category: '', brand: 'PLUG BHAI', price: 0, sale: null, cost: 0, stock: 0, threshold: 5, status: 'draft', images: [], attributes: {}, featured: 0 }, categories: { name: '', slug: '', parent: null, position: 0 }, variants: { product_id: '', sku: '', name: '', price: 0, stock: 0 }, coupons: { code: '', kind: 'percent', value: 10, minimum: 0, usage_limit: 100, expires: new Date(Date.now() + 30 * 86400000).toISOString(), active: 1 }, pages: { title: '', slug: '', content: '', status: 'draft', seo: '' }, customers: { name: '', email: '', phone: '', address: '', city: '', notes: '', tags: '', consent: 0 }, support: { email: '', subject: '', message: '', status: 'Open', reminder: '', order_id: null, customer_id: null }, staff: { id: '', email: '', role: 'inventory' }, inventory: { productId: '', variantId: null, delta: 0, reason: '' } };
const columns: Record<string, string[]> = { suppliers:['company','contact','email','commission_type','status','created'], products: ['name', 'sku', 'category', 'price', 'stock', 'status'], categories: ['name', 'slug', 'parent', 'position'], variants: ['name', 'sku', 'product_id', 'price', 'stock'], inventory: ['product_id', 'delta', 'reason', 'created'], orders: ['id', 'name', 'total', 'status', 'payment_status', 'created'], customers: ['name', 'email', 'phone', 'order_count', 'lifetime_spend', 'tags'], coupons: ['code', 'kind', 'value', 'used', 'usage_limit', 'expires'], pages: ['title', 'slug', 'status'], support: ['subject', 'email', 'status', 'reminder'], reviews: ['name', 'rating', 'content', 'status', 'verified'], staff: ['email', 'id', 'role'], audit: ['actor', 'action', 'target', 'created'] };
const title = (s: string) => s.replaceAll('_', ' ').replace(/([A-Z])/g, ' $1').replace(/^./, x => x.toUpperCase());
function csv(rows: any[]) { if (!rows.length)
    return ''; const keys = Object.keys(rows[0]); const cell = (v: any) => '"' + String(v ?? '').replaceAll('"', '""') + '"'; return [keys.map(cell).join(','), ...rows.map(r => keys.map(k => cell(r[k])).join(','))].join('\r\n'); }
function parseCSV(s: string) { const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false; for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"') {
        if (quoted && s[i + 1] === '"') {
            cell += '"';
            i++;
        }
        else
            quoted = !quoted;
    }
    else if (c === ',' && !quoted) {
        row.push(cell);
        cell = '';
    }
    else if ((c === '\n' || c === '\r') && !quoted) {
        if (c === '\r' && s[i + 1] === '\n')
            i++;
        row.push(cell);
        if (row.some(Boolean))
            rows.push(row);
        row = [];
        cell = '';
    }
    else
        cell += c;
} if (quoted)
    throw new Error('CSV contains an unclosed quote.'); row.push(cell); if (row.some(Boolean))
    rows.push(row); const keys = rows.shift() || []; return rows.map(r => Object.fromEntries(keys.map((k, i) => [k, r[i] || '']))); }
function download(name: string, content: string) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type: 'text/csv' })); a.download = name; a.click(); URL.revokeObjectURL(a.href); }
export default function Admin({ data, reload, toast }: any) {
    const [tab, setTab] = useState('reports'), [rows, setRows] = useState<any>(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [search, setSearch] = useState(''), [editing, setEditing] = useState<any>(null), [original, setOriginal] = useState<string | null>(null), [page, setPage] = useState(0), [selected, setSelected] = useState<string[]>([]), [detail, setDetail] = useState<any>(null), [sort, setSort] = useState('');
    const load = () => { setErr(''); setRows(null); api('admin/' + tab).then(setRows).catch(e => setErr(e.message)); };
    useEffect(() => { if (data.role) {
        load();
        setPage(0);
        setSearch('');
        setSelected([]);
    } }, [tab, data.role]);
    const act = async (fn: () => Promise<any>, message = 'Saved. Your changes are live.') => { setBusy(true); setErr(''); try {
        await fn();
        toast(message);
        load();
        reload();
        setEditing(null);
        setDetail(null);
    }
    catch (e: any) {
        setErr(e.message);
    }
    finally {
        setBusy(false);
    } };
    if (!data.user)
        return <main className="wrap narrow"><h1>Your store, in your hands.</h1><p>Sign in to access your protected dashboard.</p><a className="btn" target="_top" href="/signin-with-chatgpt?return_to=%2Fadmin">Sign in with ChatGPT</a></main>;
    if (!data.role)
        return <main className="wrap narrow"><h1>{data.setup ? 'Let’s set up your store.' : 'Staff access required.'}</h1>{data.setup ? <><p>This site is private to you. Claim the owner role to manage PLUG BHAI.</p><div className="panel"><h3>Your admin login</h3><p>Signed in as <strong>{data.user.email}</strong>.</p><p>Use this ChatGPT account to sign in. This store does not have a separate admin password to create or reset.</p></div><button className="btn" disabled={busy} onClick={() => act(() => api('bootstrap', 'POST', {}), 'Owner access is ready.')}>Set up my owner account</button></> : <><p>Ask the owner to grant your account a staff role.</p><p>Account ID: {data.user.id}</p></>}{err && <p className="error">{err}</p>}</main>;
    const edit = (row: any) => { setOriginal(row?.id || row?.code || null); let v = row ? { ...row } : { ...defaults[tab] }; if (tab === 'products') {
        v.images = typeof v.images === 'string' ? JSON.parse(v.images) : v.images;
        v.attributes = typeof v.attributes === 'string' ? JSON.parse(v.attributes) : v.attributes;
    } setEditing(v); };
    const list = Array.isArray(rows) ? rows.filter(r => JSON.stringify(r).toLowerCase().includes(search.toLowerCase())).sort((a, b) => sort ? String(a[sort] ?? '').localeCompare(String(b[sort] ?? ''), 'en', { numeric: true }) : 0) : [];
    const save = async () => { await act(() => api('admin/' + tab + (original && tab !== 'staff' ? '/' + encodeURIComponent(original) : ''), 'POST', editing)); };
    return <main className="admin-shell"><aside className="admin-sidebar"><div className="admin-brand"><img className="admin-wordmark" src="/plug-bhai-wordmark.png" alt="PLÜG BHAI"/><h2>Store studio<span>.</span></h2><span className="badge">{data.role}</span></div>{sections.filter(([key]) => allowed(data.role, key)).map(([key, label, Icon]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => { setTab(key); setEditing(null); setDetail(null); }}><Icon size={18}/>{label}</button>)}<a href="/" className="back-store">View storefront <ArrowUpRight size={17}/></a></aside><section className="admin-main"><div className="section-heading"><div><span className="eyebrow">YOUR BUSINESS, AT A GLANCE</span><h1>{sections.find(x => x[0] === tab)?.[1]}</h1></div><div className="toolbar-actions">{Array.isArray(rows) && <button className="btn outline small" onClick={() => download('plug-bhai-' + tab + '.csv', csv(rows))}><Download size={16}/> Export CSV</button>}{defaults[tab] && <button className="btn small" onClick={() => edit(null)}><Plus size={17}/>{tab === 'inventory' ? 'Adjust stock' : 'Add ' + (tab === 'staff' ? 'staff member' : tab.replace(/s$/, ''))}</button>}</div></div><div className="demo-notice"><AlertCircle size={17}/><span>Private store setup. Demo products are labeled. Online payment providers are unconfigured.</span></div>{err && <div className="error" role="alert">{err}</div>}
 {tab === 'reports' && rows && <><div className="panel admin-login-info"><h2>Your admin login</h2><p><strong>{data.user.email}</strong> · {data.role}</p><p>Sign in with this ChatGPT account at /admin. No separate store password is required. Staff permissions are managed in Staff & permissions.</p></div><div className="stat-grid"><div className="stat"><span>Delivered sales</span><strong>{money(rows.sales.total)}</strong><small>Based on delivered orders</small></div><div className="stat"><span>Delivered orders</span><strong>{rows.sales.count}</strong><small>All time</small></div><div className="stat"><span>Awaiting confirmation</span><strong>{rows.pending.count}</strong><small>Ready for a call from your team</small></div><div className="stat"><span>Low-stock products</span><strong>{rows.low.count}</strong><small>At or below stock threshold</small></div></div><div className="panel"><div className="section-heading"><h2>Recent orders</h2><button className="text-link" onClick={() => setTab('orders')}>Manage orders <ArrowUpRight size={17}/></button></div>{rows.orders.length ? <table><thead><tr><th>Order</th><th>Status</th><th>Total</th><th>Created</th></tr></thead><tbody>{rows.orders.map((o: any) => <tr key={o.id}><td>{o.id}</td><td><span className="badge">{o.status}</span></td><td>{money(o.total)}</td><td>{o.created}</td></tr>)}</tbody></table> : <div className="empty"><ShoppingBag size={38}/><h3>Your first order starts the story.</h3><p>New orders will appear here as soon as checkout is completed.</p></div>}</div><div className="admin-two"><div className="panel"><h2>Sales by day</h2>{rows.trend.length ? rows.trend.map((t: any) => <div className="summary-line" key={t.day}><span>{t.day}</span><strong>{money(t.total)}</strong></div>) : <p className="muted">Sales trends appear after your first delivered order.</p>}</div><div className="panel"><h2>Best sellers</h2>{rows.best.length ? rows.best.map((p: any) => <p key={p.name}>{p.name} · {p.quantity} sold</p>) : <p className="muted">No delivered sales yet. No invented numbers.</p>}</div></div><div className="panel"><h2>Launch preparation</h2><p>Set contact details, delivery charges and bank information in Store & homepage. Publish your policies, replace demo products, and verify a test order before accepting customers.</p><button className="btn outline" onClick={() => { if (confirm('Archive all demo products? Historical orders will be preserved.'))
        act(() => api('admin/seed', 'POST', { action: 'remove' }), 'Demo products archived.'); }}>Archive demo products</button></div></>}
 {tab === 'settings' && rows && <SettingsEditor value={rows} busy={busy} save={(v: any) => act(() => api('admin/settings', 'POST', v))}/>}
 {Array.isArray(rows) && <><div className="admin-table-toolbar"><div className="search-box"><Search size={17}/><input placeholder="Search this section…" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}/></div>{tab === 'products' && <label className="btn outline small"><Upload size={16}/> Import CSV<input type="file" accept=".csv" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f)
        return; try {
        const parsed = parseCSV(await f.text());
        if (parsed.length > 200)
            throw new Error('Import at most 200 products at once.');
        let n = 0;
        for (const r of parsed) {
            const body: any = { ...defaults.products, ...r };
            for (const key of ['price', 'stock', 'cost', 'threshold', 'featured'])
                body[key] = Number(body[key]);
            body.sale = body.sale === '' || body.sale === 'null' ? null : Number(body.sale);
            body.images = JSON.parse(body.images || '[]');
            body.attributes = JSON.parse(body.attributes || '{}');
            await api('admin/products' + (r.id ? '/' + encodeURIComponent(r.id) : ''), 'POST', body);
            n++;
        }
        toast(n + ' products imported.');
        load();
        reload();
    }
    catch (e: any) {
        setErr('Import stopped: ' + e.message + ' Earlier successful rows were saved.');
    } }}/></label>}{tab === 'products' && selected.length > 0 && <><span>{selected.length} selected</span><button className="btn outline small" onClick={() => { if (confirm('Archive selected products?'))
        act(async () => { for (const id of selected)
            await api('admin/products/' + id, 'DELETE'); setSelected([]); }); }}>Archive selected</button></>}</div><div className="table-scroll"><table><thead><tr>{tab === 'products' && <th />}{(columns[tab] || []).map(k => <th key={k}><button onClick={() => setSort(k)}>{title(k)} ↕</button></th>)}<th>Actions</th></tr></thead><tbody>{list.slice(page * 15, page * 15 + 15).map((r: any, i: number) => <tr key={r.id || r.code || i}>{tab === 'products' && <td><input aria-label="Select product" type="checkbox" checked={selected.includes(r.id)} onChange={e => setSelected(v => e.target.checked ? [...v, r.id] : v.filter(x => x !== r.id))}/></td>}{(columns[tab] || []).map(k => <td key={k}>{['price', 'total', 'lifetime_spend'].includes(k) ? money(r[k] || 0) : ['status', 'role', 'payment_status'].includes(k) ? <span className="badge">{r[k]}</span> : String(r[k] ?? '—').slice(0, 100)}</td>)}<td><div className="row-actions">{defaults[tab] && tab !== 'inventory' && <button onClick={() => edit(r)}>Edit</button>}{tab === 'products' && <><button title="Duplicate product" onClick={() => { edit({ ...r, id: null, sku: r.sku + '-COPY', slug: r.slug + '-copy', status: 'draft' }); setOriginal(null); }}><Copy size={15}/></button><button title="Archive product" onClick={() => { if (confirm('Archive ' + r.name + '? Historical orders remain intact.'))
        act(() => api('admin/products/' + r.id, 'DELETE')); }}><Trash2 size={15}/></button></>}{tab === 'suppliers' && <button onClick={()=>setDetail(r)}>Review</button>}{tab === 'orders' && <button onClick={() => api('admin/orders/' + r.id).then(setDetail).catch(e => setErr(e.message))}>Manage</button>}{tab === 'reviews' && <><button onClick={() => act(() => api('admin/reviews/' + r.id, 'POST', { status: 'approved' }))}>Approve</button><button onClick={() => act(() => api('admin/reviews/' + r.id, 'POST', { status: 'rejected' }))}>Reject</button></>}</div></td></tr>)}</tbody></table>{!list.length && <div className="empty"><Package size={32}/><h3>Nothing here yet.</h3><p>Your {tab} will appear here.</p></div>}</div><div className="pagination"><span>{list.length} records · Page {page + 1}</span><button disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button><button disabled={(page + 1) * 15 >= list.length} onClick={() => setPage(p => p + 1)}>Next</button></div></>}
 {!rows && !err && <div className="empty">Loading your store data…</div>}
 </section>{editing && <div className="modal-backdrop"><section className="editor-modal"><div className="section-heading"><h2>{original ? 'Edit' : 'Add'} {tab === 'inventory' ? 'stock adjustment' : tab.replace(/s$/, '')}</h2><button aria-label="Close editor" onClick={() => setEditing(null)}><X /></button></div><p className="muted">Money fields use paisa: 100 paisa = Rs. 1. Changes are validated on the server.</p>{err && <div className="error">{err}</div>}<form className="form" onSubmit={e => { e.preventDefault(); save(); }}>{Object.keys(defaults[tab]).filter(k => k !== 'cost' || ['owner', 'manager'].includes(data.role)).map(k => <Field key={k} field={k} value={editing[k]} set={(v: any) => setEditing((old: any) => ({ ...old, [k]: v }))} tab={tab} data={data}/>)}{tab === 'products' && <label className="upload-area"><ImageIcon size={23}/><span>Upload product images · PNG, JPEG, WebP · up to 5 MB each</span><input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={async (e) => { try {
        const urls: string[] = [];
        for (const f of Array.from(e.target.files || [])) {
            const form = new FormData();
            form.append('file', f);
            const result = await api('admin/upload', 'POST', form);
            urls.push(result.url);
        }
        setEditing((v: any) => ({ ...v, images: [...v.images, ...urls] }));
        toast('Images uploaded to permanent storage.');
    }
    catch (e: any) {
        setErr(e.message);
    } }}/></label>}<div className="editor-actions"><button type="button" className="btn outline" onClick={() => setEditing(null)}>Cancel</button><button className="btn" disabled={busy}><Save size={17}/>{busy ? 'Saving…' : 'Save changes'}</button></div></form></section></div>}{detail && tab==='suppliers' && <SupplierEditor entry={detail} close={()=>setDetail(null)} busy={busy} error={err} save={(value:any)=>act(()=>api('admin/suppliers/'+detail.id,'POST',value),'Supplier review saved.')}/>} {detail && tab!=='suppliers' && <OrderEditor detail={detail} close={() => setDetail(null)} busy={busy} save={(value: any) => act(() => api('admin/orders/' + detail.order.id, 'POST', value))} error={err}/>}</main>;
}
function Field({ field: k, value: v, set, tab, data }: any) { let opts: string[] | null = null; if (k === 'status')
    opts = tab === 'products' ? ['draft', 'published', 'archived', 'out-of-stock'] : tab === 'pages' ? ['draft', 'published'] : ['Open', 'In Progress', 'Waiting for Customer', 'Resolved']; if (k === 'role')
    opts = ['manager', 'orders', 'inventory', 'support', 'analyst']; if (k === 'kind')
    opts = ['percent', 'fixed', 'shipping']; if (k === 'category')
    return <label>Category<select value={v} onChange={e => set(e.target.value)} required><option value="">Choose category</option>{data.categories.map((c: any) => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label>; if (opts)
    return <label>{title(k)}<select value={v} onChange={e => set(e.target.value)}>{opts.map(x => <option key={x}>{x}</option>)}</select></label>; if (['images', 'attributes'].includes(k))
    return <JSONField label={k === 'images' ? 'Images (ordered URL list; first image is the cover)' : 'Attributes (compatibility, color, connector, size)'} value={v} set={set}/>; if (['description', 'content', 'notes', 'message', 'address'].includes(k))
    return <label>{title(k)}<textarea rows={k === 'content' ? 12 : 4} value={v ?? ''} onChange={e => set(e.target.value)}/></label>; const num = typeof v === 'number' || ['sale', 'cost', 'stock', 'price', 'delta', 'threshold'].includes(k); return <label>{title(k)}{['price', 'sale', 'cost', 'minimum'].includes(k) ? ' (paisa)' : ''}<input type={num ? 'number' : 'text'} value={v ?? ''} onChange={e => set(num ? (e.target.value === '' && k === 'sale' ? null : Number(e.target.value)) : e.target.value === '' && ['variantId', 'parent', 'order_id', 'customer_id'].includes(k) ? null : e.target.value)}/></label>; }
function JSONField({ label, value, set }: any) { const [text, setText] = useState(JSON.stringify(value, null, 2)), [error, setError] = useState(''); return <label>{label}<textarea rows={5} value={text} onChange={e => { setText(e.target.value); try {
    set(JSON.parse(e.target.value));
    setError('');
}
catch {
    setError('Enter valid JSON before saving.');
} }}/>{error && <span className="error">{error}</span>}</label>; }
function SettingsEditor({ value, busy, save }: any) { const [v, setV] = useState(value); const moneyKeys = ['shipping', 'freeShipping', 'taxBps']; return <form className="form settings-form" onSubmit={e => { e.preventDefault(); save(v); }}><div className="panel"><h2>Brand & homepage</h2><p className="muted">Update your hero, announcement, menus and homepage section order.</p>{['announcement', 'headline', 'subheadline', 'heroButton', 'heroUrl', 'heroImage'].map(k => <label key={k}>{title(k)}<textarea rows={k === 'subheadline' ? 3 : 2} value={v[k]} onChange={e => setV({ ...v, [k]: e.target.value })}/></label>)}{['sections', 'navigation', 'footerLinks'].map(k => <JSONField key={k} label={title(k)} value={v[k]} set={(val: any) => setV({ ...v, [k]: val })}/>)}</div><div className="panel"><h2>Store, delivery & tax</h2>{['phone', 'email', 'whatsapp', 'address', 'hours', 'instagram', 'delivery', ...moneyKeys].map(k => <label key={k}>{title(k)}{k === 'taxBps' ? ' (basis points; 100 = 1%)' : moneyKeys.includes(k) ? ' (paisa)' : ''}<input type={moneyKeys.includes(k) ? 'number' : 'text'} value={v[k]} onChange={e => setV({ ...v, [k]: moneyKeys.includes(k) ? Number(e.target.value) : e.target.value })}/></label>)}</div><div className="panel"><h2>Payments</h2><label className="check-label"><input type="checkbox" checked={v.bankEnabled} onChange={e => setV({ ...v, bankEnabled: e.target.checked })}/> Enable bank transfers with manual verification</label><label>Bank name, account title, IBAN and instructions<textarea value={v.bankDetails} onChange={e => setV({ ...v, bankDetails: e.target.value })}/></label><div className="gateway-setup"><h3>Online payment setup</h3>{[{name:'Debit / credit cards',text:'Choose your card payment gateway and complete merchant onboarding.'},{name:'JazzCash',text:'Use an approved JazzCash merchant payment integration.'},{name:'Easypaisa',text:'Use an approved Easypaisa merchant payment integration.'}].map(provider=><div className="gateway-row" key={provider.name}><div><strong>{provider.name}</strong><p>{provider.text}</p></div><span className="badge">Not configured</span></div>)}<p>These options are visible but disabled at checkout. Activation requires a server-side provider adapter, securely configured merchant credentials, verified callbacks, and a successful payment test. Saving bank instructions does not activate an online gateway.</p><p>Do not enter API keys or signing secrets in these public store settings.</p></div></div><button className="btn" disabled={busy}><Save size={18}/>{busy ? 'Saving…' : 'Save store settings'}</button></form>; }
function OrderEditor({ detail, close, busy, save, error }: any) { const o = detail.order; const [v, setV] = useState({ status: o.status, note: '', courier: o.courier, tracking: o.tracking, tracking_url: o.tracking_url, payment_status: o.payment_status, cod_collected: o.cod_collected }); const address = JSON.parse(o.address); return <div className="modal-backdrop"><section className="editor-modal"><div className="section-heading"><h2>Order {o.id}</h2><button onClick={close} aria-label="Close order"><X /></button></div><div className="print-area"><p>{address.name} · {address.phone}<br />{address.address}, {address.city}</p>{detail.items.map((i: any) => <div className="summary-line" key={i.id}><span>{i.quantity} × {i.name}<small> · {i.sku}</small></span><strong>{money(i.price * i.quantity)}</strong></div>)}<div className="summary-line"><span>Delivery</span>{money(o.shipping)}</div><div className="summary-line"><span>Discount</span>{money(o.discount)}</div><div className="summary-line"><span>Tax</span>{money(o.tax)}</div><div className="summary-line total"><strong>Total</strong><strong>{money(o.total)}</strong></div><p>Payment: {o.payment} · {o.payment_status}</p><p>Delivery instructions: {o.notes || 'None'}</p></div><button className="btn outline" onClick={() => window.print()}>Print invoice / packing summary</button><form className="form" onSubmit={e => { e.preventDefault(); save(v); }}><label>Status<select value={v.status} onChange={e => setV({ ...v, status: e.target.value })}>{[o.status, ...(transitions[o.status] || [])].map(x => <option key={x}>{x}</option>)}</select></label><label>Payment status<select value={v.payment_status} onChange={e => setV({ ...v, payment_status: e.target.value })}>{['pending', 'paid', 'failed', 'cancelled', 'refunded', 'partially_refunded'].map(x => <option key={x}>{x}</option>)}</select></label>{['courier', 'tracking', 'tracking_url', 'cod_collected'].map(k => <label key={k}>{title(k)}{k === 'cod_collected' ? ' (paisa)' : ''}<input type={k === 'cod_collected' ? 'number' : 'text'} value={(v as any)[k]} onChange={e => setV({ ...v, [k]: k === 'cod_collected' ? Number(e.target.value) : e.target.value })}/></label>)}<label>Timeline note (visible to the customer)<textarea value={v.note} onChange={e => setV({ ...v, note: e.target.value })}/></label>{error && <div className="error">{error}</div>}<button className="btn" disabled={busy}>Save order update</button></form><h3>Order timeline</h3>{detail.events.map((e: any) => <p key={e.id}><strong>{e.status}</strong> · {e.created}<br />{e.note}</p>)}</section></div>; }
