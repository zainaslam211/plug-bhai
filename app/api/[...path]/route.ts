import {supplierSchema,supplierStatuses} from '@/lib/suppliers';
import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { allowed, calculate, defaultSettings, transitions } from '@/lib/commerce';
import { seedCategories, seedProducts, seedPages } from '@/lib/seed';
export const dynamic = 'force-dynamic';
const E = () => env as unknown as {
    DB: D1Database;
    BUCKET: R2Bucket;
    BOOTSTRAP_ENABLED?: string;
    BOOTSTRAP_OWNER_EMAIL?: string;
};
const db = () => E().DB;
const id = () => crypto.randomUUID();
const json = (x: any, status = 200) => Response.json(x, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const fail = (message: string, status = 400) => { throw Object.assign(new Error(message), { status }); };
async function one(sql: string, ...args: any[]) { return await db().prepare(sql).bind(...args).first<any>(); }
async function all(sql: string, ...args: any[]) { return (await db().prepare(sql).bind(...args).all<any>()).results; }
function identity(r: Request) { const uid = r.headers.get('oai-authenticated-user-id'); return uid ? { id: uid, email: r.headers.get('oai-authenticated-user-email') || '' } : null; }
async function role(r: Request) { const u = identity(r); if (!u)
    fail('Please sign in.', 401); return await one('SELECT * FROM staff WHERE id=?', u!.id); }
async function auth(r: Request, resource: string) { const s = await role(r); if (!s || !allowed(s.role, resource))
    fail('You do not have permission for this action.', 403); return s; }
async function audit(actor: string, action: string, target: string) { await db().prepare('INSERT INTO audit(id,actor,action,target) VALUES(?,?,?,?)').bind(id(), actor, action, target).run(); }
async function settings() { const row = await one("SELECT data FROM settings WHERE id='store'"); return { ...defaultSettings, ...(row ? JSON.parse(row.data) : {}) }; }
function product(p: any) { const { cost, ...safe } = p; return { ...safe, images: JSON.parse(p.images), attributes: JSON.parse(p.attributes) }; }
const short = z.string().trim().min(1).max(200);
const url = z.string().max(1000).refine(v => v === '' || (/^\/(?!\/)/.test(v)) || /^https:\/\//.test(v), 'Use a relative path or HTTPS URL.');
const productSchema = z.object({ name: short, slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), sku: short, description: z.string().max(10000).default(''), category: short, brand: short.default('PLUG BHAI'), price: z.number().int().min(0).max(100000000), sale: z.number().int().min(0).nullable().default(null), cost: z.number().int().min(0).default(0), stock: z.number().int().min(0).max(1000000), threshold: z.number().int().min(0).default(5), status: z.enum(['draft', 'published', 'archived', 'out-of-stock']), images: z.array(url).max(12).default([]), attributes: z.record(z.string().max(1000)).default({}), featured: z.number().int().min(0).max(1).default(0) }).refine(v => v.sale === null || v.sale <= v.price, 'Sale price must not exceed regular price.');
const schemas: Record<string, z.ZodTypeAny> = { products: productSchema, categories: z.object({ name: short, slug: z.string().regex(/^[a-z0-9-]+$/), parent: z.string().nullable().default(null), position: z.number().int().default(0) }), variants: z.object({ product_id: short, sku: short, name: short, price: z.number().int().nonnegative(), stock: z.number().int().nonnegative() }), coupons: z.object({ code: z.string().regex(/^[A-Z0-9_-]+$/), kind: z.enum(['percent', 'fixed', 'shipping']), value: z.number().int().nonnegative(), minimum: z.number().int().nonnegative(), usage_limit: z.number().int().min(1), expires: z.string().datetime(), active: z.number().min(0).max(1) }).refine(x => x.kind !== 'percent' || x.value <= 100), pages: z.object({ slug: z.string().regex(/^[a-z0-9-]+$/), title: short, content: z.string().max(50000), status: z.enum(['draft', 'published']), seo: z.string().max(300).default('') }), customers: z.object({ name: short, email: z.string().email().or(z.literal('')), phone: short, address: z.string().max(1000), city: short, notes: z.string().max(10000), tags: z.string().max(1000), consent: z.number().min(0).max(1) }), support: z.object({ email: z.string().email(), subject: short, message: z.string().max(10000), status: z.enum(['Open', 'In Progress', 'Waiting for Customer', 'Resolved']), reminder: z.string().max(100), order_id: z.string().nullable().default(null), customer_id: z.string().nullable().default(null) }) };
async function rate(r: Request, scope: string) { const key = scope + ':' + (identity(r)?.id || r.headers.get('cf-connecting-ip') || 'guest') + ':' + Math.floor(Date.now() / 60000); const row = await db().prepare('INSERT INTO rate_limits(id,count,expires) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count').bind(key, Date.now() + 120000).first<any>(); if (row.count > (scope === 'admin' ? 300 : 30))
    fail('Too many requests. Please try again in a minute.', 429); }
async function route(r: Request) {
    const u = new URL(r.url);
    const p = u.pathname.replace(/^\/api\//, '').split('/');
    const user = identity(r);
    const method = r.method;
    if (method !== 'GET') {
        if (r.headers.get('origin') !== u.origin)
            fail('Invalid request origin.', 403);
        await rate(r, p[0]);
    }
    if (p[0] === 'media' && method === 'GET') {
        const file = await E().BUCKET.get(p.slice(1).join('/'));
        if (!file)
            return new Response('Not found', { status: 404 });
        return new Response(file.body, { headers: { 'Content-Type': file.httpMetadata?.contentType || 'application/octet-stream', 'Cache-Control': 'public,max-age=31536000,immutable', 'X-Content-Type-Options': 'nosniff' } });
    }
    if (p[0] === 'bootstrap' && method === 'POST') {
        if (!user)
            fail('Sign in first.', 401);
        if (E().BOOTSTRAP_ENABLED !== 'true')
            fail('Owner setup is disabled.', 403);
        if (!E().BOOTSTRAP_OWNER_EMAIL || user!.email.toLowerCase() !== E().BOOTSTRAP_OWNER_EMAIL!.toLowerCase())
            fail('Owner setup is restricted to the designated owner.', 403);
        await db().prepare("INSERT INTO staff(id,email,role) SELECT ?,?,'owner' WHERE NOT EXISTS(SELECT 1 FROM staff WHERE role='owner')").bind(user!.id, user!.email).run();
        const s = await role(r);
        if (s?.role !== 'owner')
            fail('An owner already exists.', 403);
        return json({ ok: true });
    }
    if (p[0] === 'store' && method === 'GET') {
        if (E().BOOTSTRAP_ENABLED === 'true' && !await one("SELECT 1 FROM settings WHERE id='initialized'")) {
            await db().batch([...seedCategories.map((c, i) => db().prepare('INSERT OR IGNORE INTO categories(id,slug,name,position) VALUES(?,?,?,?)').bind(c[0], c[0], c[1], i)), ...seedProducts.map((p, i) => db().prepare("INSERT OR IGNORE INTO products(id,slug,sku,name,category,price,sale,stock,status,images,description,featured,demo) VALUES(?,?,?,?,?,?,?,?,'published',?,?,?,1)").bind(String(p[0]), String(p[0]), 'DEMO-' + (i + 1), p[1], p[2], p[4], p[3], 20, JSON.stringify(['/products/' + p[5] + '.svg']), p[6] + ' Demo product: specifications and compatibility must be verified before sale.', i < 4 ? 1 : 0)), ...seedPages.map(p => db().prepare("INSERT OR IGNORE INTO pages(id,slug,title,content,status) VALUES(?,?,?,?,'published')").bind(p[0], ...p)), db().prepare("INSERT OR IGNORE INTO settings(id,data) VALUES('initialized','true')")]);
        }
        const [s, c, ps, who, n] = await Promise.all([settings(), all('SELECT * FROM categories ORDER BY position'), all("SELECT * FROM products WHERE status IN ('published','out-of-stock') ORDER BY created DESC"), user ? role(r) : null, one("SELECT count(*) n FROM staff WHERE role='owner'")]);
        return json({ settings: s, categories: c, products: ps.map(product), user, role: who?.role || null, setup: E().BOOTSTRAP_ENABLED === 'true' && !!E().BOOTSTRAP_OWNER_EMAIL && user?.email.toLowerCase() === E().BOOTSTRAP_OWNER_EMAIL!.toLowerCase() && !n.n });
    }
    if (p[0] === 'product' && method === 'GET') {
        const item = await one("SELECT * FROM products WHERE slug=? AND status IN ('published','out-of-stock')", p[1]);
        if (!item)
            fail('Product not found.', 404);
        return json({ product: product(item), variants: await all('SELECT * FROM variants WHERE product_id=?', item.id), reviews: await all("SELECT name,rating,content,verified FROM reviews WHERE product_id=? AND status='approved'", item.id) });
    }
    if (p[0] === 'page' && method === 'GET') {
        return json(await one("SELECT * FROM pages WHERE slug=? AND status='published'", p[1]) || { title: 'Page not found', content: 'This page is not published yet.' }, 200);
    }
    if (p[0] === 'personal') {
        if (!user)
            fail('Sign in first.', 401);
        if (method === 'GET')
            return json(await one('SELECT * FROM personal WHERE id=?', user!.id) || { cart: '[]', wishlist: '[]' });
        const body = z.object({ cart: z.array(z.object({ productId: short, variantId: z.string().nullable().optional(), quantity: z.number().int().min(1).max(99) })).max(100), wishlist: z.array(short).max(200) }).parse(await r.json());
        await db().prepare('INSERT INTO personal(id,cart,wishlist) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET cart=excluded.cart,wishlist=excluded.wishlist').bind(user!.id, JSON.stringify(body.cart), JSON.stringify(body.wishlist)).run();
        return json({ ok: true });
    }
    if(p[0]==='suppliers'&&method==='POST'){
        const b=supplierSchema.parse(await r.json());
        const ref='SUP-'+id().replaceAll('-','').slice(0,12).toUpperCase();
        await db().prepare('INSERT INTO supplier_enquiries(id,request_key,company,contact,email,phone,city,website,catalog,products,commission_type,commission_value,fulfillment,message,consent) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,1) ON CONFLICT(request_key) DO NOTHING').bind(ref,b.requestKey,b.company,b.contact,b.email.toLowerCase(),b.phone,b.city,b.website,b.catalog,b.products,b.commissionType,b.commissionType==='negotiable'?null:Math.round(b.commissionValue!*100),b.fulfillment,b.message).run();
        const saved=await one('SELECT id FROM supplier_enquiries WHERE request_key=?',b.requestKey);
        return json({reference:saved.id},201);
    }
    if (p[0] === 'newsletter' && method === 'POST') {
        const b = z.object({ email: z.string().email(), consent: z.literal(true) }).parse(await r.json());
        await db().prepare('INSERT INTO subscribers(email,consent) VALUES(?,1) ON CONFLICT(email) DO NOTHING').bind(b.email.toLowerCase()).run();
        return json({ ok: true });
    }
    if (p[0] === 'support' && method === 'POST') {
        const b = z.object({ email: z.string().email(), subject: short, message: z.string().min(5).max(10000) }).parse(await r.json());
        await db().prepare('INSERT INTO support(id,email,subject,message) VALUES(?,?,?,?)').bind(id(), b.email, b.subject, b.message).run();
        return json({ ok: true });
    }
    if (p[0] === 'review' && method === 'POST') {
        if (!user)
            fail('Sign in to submit a review.', 401);
        const b = z.object({ productId: short, rating: z.number().int().min(1).max(5), content: z.string().min(5).max(2000), name: short }).parse(await r.json());
        const verified = await one("SELECT 1 FROM orders o JOIN order_items i ON i.order_id=o.id WHERE o.user_id=? AND i.product_id=? AND o.status='Delivered'", user!.id, b.productId);
        await db().prepare('INSERT INTO reviews(id,product_id,user_id,name,rating,content,verified) VALUES(?,?,?,?,?,?,?)').bind(id(), b.productId, user!.id, b.name, b.rating, b.content, verified ? 1 : 0).run();
        return json({ ok: true });
    }
    if (p[0] === 'quote' || p[0] === 'checkout') {
        if (method !== 'POST')
            fail('Method not allowed', 405);
        const b = z.object({ items: z.array(z.object({ productId: short, variantId: z.string().nullable().optional(), quantity: z.number().int().min(1).max(99) })).min(1).max(50), coupon: z.string().max(50).default(''), name: short.optional(), phone: z.string().regex(/^(\+92|0)3\d{9}$/, 'Use a Pakistani mobile number, e.g. 03001234567.').optional(), email: z.string().email().or(z.literal('')).optional(), city: short.optional(), address: z.string().min(10).max(1000).optional(), instructions: z.string().max(1000).default(''), payment: z.enum(['cod', 'bank', 'card', 'jazzcash', 'easypaisa']).default('cod'), key: z.string().uuid().optional(), consent: z.boolean().default(false) }).parse(await r.json());
        if (p[0] === 'checkout' && ['card','jazzcash','easypaisa'].includes(b.payment)) fail('This online payment method is not configured. Choose cash on delivery or an enabled bank transfer.');
        if (p[0] === 'checkout' && b.key) {
            const done = await one('SELECT id,access_token FROM orders WHERE idempotency_key=?', b.key);
            if (done)
                return json(done);
        }
        const merged = new Map<string, any>();
        for (const item of b.items) {
            const key = item.productId + ':' + (item.variantId || '');
            const current = merged.get(key);
            merged.set(key, { ...item, quantity: item.quantity + (current?.quantity || 0) });
        }
        const lines = [];
        for (const item of merged.values()) {
            if (item.quantity > 99)
                fail('Maximum quantity is 99.');
            const prod = await one("SELECT * FROM products WHERE id=? AND status='published'", item.productId);
            if (!prod)
                fail('A product is no longer available.');
            const vs = await all('SELECT * FROM variants WHERE product_id=?', prod.id);
            const variant = item.variantId ? vs.find(v => v.id === item.variantId) : null;
            if (vs.length && !variant)
                fail('Choose a valid product variant.');
            if ((variant?.stock ?? prod.stock) < item.quantity)
                fail(prod.name + ' does not have enough stock.');
            lines.push({ ...item, name: prod.name + (variant ? ' · ' + variant.name : ''), sku: variant?.sku || prod.sku, price: variant?.price ?? prod.sale ?? prod.price });
        }
        const s = await settings();
        const subtotal = lines.reduce((n, i) => n + i.price * i.quantity, 0);
        const coupon = b.coupon ? await one('SELECT * FROM coupons WHERE code=?', b.coupon.toUpperCase()) : null;
        if (b.coupon && !coupon)
            fail('Coupon not found.');
        const totals = calculate(subtotal, coupon, subtotal >= s.freeShipping ? 0 : s.shipping, s.taxBps);
        if (p[0] === 'quote')
            return json({ ...totals, lines });
        if (!b.name || !b.phone || !b.city || !b.address || !b.key)
            fail('Complete all required delivery details.');
        if (b.payment === 'bank' && !s.bankEnabled)
            fail('Bank transfer has not been configured.');
        const existing = await one('SELECT id,access_token FROM orders WHERE idempotency_key=?', b.key);
        if (existing)
            return json(existing);
        const oid = 'PB-' + id().slice(0, 8).toUpperCase(), cid = id(), access = id() + id();
        const stmts: D1PreparedStatement[] = [];
        // Each guard, stock change, order and snapshot commits as one D1 batch.
        const guardIds:string[]=[];
        function guard(query:string,args:any[]){const gid=id();guardIds.push(gid);stmts.push(db().prepare('INSERT INTO operation_guards(id,ok) SELECT ?,CASE WHEN ('+query+') THEN 1 ELSE 0 END').bind(gid,...args));}
        for(const i of lines){
            guard("EXISTS(SELECT 1 FROM products WHERE id=? AND status='published')",[i.productId]);
            if(i.variantId){guard('EXISTS(SELECT 1 FROM variants WHERE id=? AND product_id=?)',[i.variantId,i.productId]);stmts.push(db().prepare('UPDATE variants SET stock=stock-? WHERE id=?').bind(i.quantity,i.variantId));}
            else{guard('NOT EXISTS(SELECT 1 FROM variants WHERE product_id=?)',[i.productId]);stmts.push(db().prepare('UPDATE products SET stock=stock-? WHERE id=?').bind(i.quantity,i.productId));}
            stmts.push(db().prepare('INSERT INTO stock_movements(product_id,variant_id,delta,reason) VALUES(?,?,?,?)').bind(i.productId,i.variantId||null,-i.quantity,'Order '+oid));
        }
        if(coupon){guard("EXISTS(SELECT 1 FROM coupons WHERE code=? AND active=1 AND used<usage_limit AND datetime(expires)>datetime('now') AND minimum<=?)",[coupon.code,totals.subtotal]);stmts.push(db().prepare('UPDATE coupons SET used=used+1 WHERE code=?').bind(coupon.code));}
        stmts.push(db().prepare('INSERT INTO customers(id,user_id,name,email,phone,address,city,consent) VALUES(?,?,?,?,?,?,?,?)').bind(cid, user?.id || null, b.name, b.email || '', b.phone, b.address, b.city, b.consent ? 1 : 0), db().prepare('INSERT INTO orders(id,idempotency_key,access_token,customer_id,user_id,payment,subtotal,discount,shipping,tax,total,coupon,address,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(oid, b.key, access, cid, user?.id || null, b.payment, totals.subtotal, totals.discount, totals.shipping, totals.tax, totals.total, coupon?.code || null, JSON.stringify({ name: b.name, phone: b.phone, city: b.city, address: b.address }), b.instructions), ...lines.map(i => db().prepare('INSERT INTO order_items(id,order_id,product_id,variant_id,name,sku,price,quantity) VALUES(?,?,?,?,?,?,?,?)').bind(id(), oid, i.productId, i.variantId || null, i.name, i.sku, i.price, i.quantity)), db().prepare('INSERT INTO order_events(id,order_id,status,note) VALUES(?,?,?,?)').bind(id(), oid, 'Pending Confirmation', 'Order received. Awaiting store confirmation.'));
        stmts.push(...guardIds.map(gid=>db().prepare('DELETE FROM operation_guards WHERE id=?').bind(gid)));

        try {
            await db().batch(stmts);
        }
        catch (e) {
            const previous = await one('SELECT id,access_token FROM orders WHERE idempotency_key=?', b.key);
            if (previous)
                return json(previous);
            fail('Order could not be placed. Stock or coupon availability changed. Please refresh and try again.', 409);
        }
        return json({ id: oid, access_token: access }, 201);
    }
    if (p[0] === 'orders' && method === 'GET') {
        if (p[1]) {
            const order = await one('SELECT * FROM orders WHERE id=?', p[1]);
            if (!order || !(order.access_token === u.searchParams.get('token') || (user && order.user_id === user.id)))
                fail('Order not found. Use your private tracking link or sign in to your account.', 404);
            const { access_token, idempotency_key, ...safe } = order;
            return json({ ...safe, items: await all('SELECT * FROM order_items WHERE order_id=?', order.id), events: await all('SELECT * FROM order_events WHERE order_id=? ORDER BY created', order.id) });
        }
        if (!user)
            fail('Sign in to view orders.', 401);
        return json(await all('SELECT id,status,total,created FROM orders WHERE user_id=? ORDER BY created DESC', user!.id));
    }
    if (p[0] === 'admin') {
        const resource = p[1] || 'reports';
        const staff = await auth(r, resource === 'seed' ? 'settings' : resource === 'upload' ? 'products' : resource);
        if(resource==='suppliers'){
            if(method==='GET')return json(await all('SELECT id,company,contact,email,phone,city,website,catalog,products,commission_type,commission_value,fulfillment,message,status,notes,created,updated FROM supplier_enquiries ORDER BY created DESC LIMIT 500'));
            if(method!=='POST'||!p[2])fail('Method not allowed.',405);
            const b=z.object({status:z.enum(supplierStatuses),notes:z.string().max(10000)}).parse(await r.json());
            if(!await one('SELECT 1 FROM supplier_enquiries WHERE id=?',p[2]))fail('Enquiry not found.',404);
            await db().batch([db().prepare("UPDATE supplier_enquiries SET status=?,notes=?,updated=CURRENT_TIMESTAMP WHERE id=?").bind(b.status,b.notes,p[2]),db().prepare('INSERT INTO audit(id,actor,action,target) VALUES(?,?,?,?)').bind(id(),staff.id,'review supplier enquiry',p[2])]);
            return json({ok:true});
        }
        if (resource === 'upload' && method === 'POST') {
            const f = (await r.formData()).get('file');
            if (!(f instanceof File) || f.size > 5 * 1024 * 1024)
                fail('Choose an image smaller than 5 MB.');
            const file = f as File, bytes = new Uint8Array(await file.arrayBuffer());
            const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
            const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
            const webp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
            if (!png && !jpeg && !webp)
                fail('Only PNG, JPEG, and WebP images are accepted.');
            const key = 'products/' + id() + '.' + (png ? 'png' : jpeg ? 'jpg' : 'webp');
            await E().BUCKET.put(key, bytes, { httpMetadata: { contentType: png ? 'image/png' : jpeg ? 'image/jpeg' : 'image/webp' } });
            await audit(staff.id, 'upload', key);
            return json({ url: '/api/media/' + key });
        }
        if (resource === 'seed' && method === 'POST') {
            const action = (await r.json() as any).action;
            if (action === 'remove') {
                await db().prepare("UPDATE products SET status='archived' WHERE demo=1").run();
                return json({ ok: true });
            }
            if (await one('SELECT 1 FROM products LIMIT 1'))
                fail('Seed only runs on an empty catalog.');
            await db().batch([...seedCategories.map((c, i) => db().prepare('INSERT INTO categories(id,slug,name,position) VALUES(?,?,?,?)').bind(c[0], c[0], c[1], i)), ...seedProducts.map((p, i) => db().prepare("INSERT INTO products(id,slug,sku,name,category,price,sale,stock,status,images,description,featured,demo) VALUES(?,?,?,?,?,?,?,?,'published',?,?,?,1)").bind(String(p[0]), String(p[0]), 'DEMO-' + (i + 1), p[1], p[2], p[4], p[3], 20, JSON.stringify(['/products/' + p[5] + '.svg']), p[6] + ' Demo product: specifications and compatibility must be verified before sale.', i < 4 ? 1 : 0)), ...seedPages.map(p => db().prepare("INSERT INTO pages(id,slug,title,content,status) VALUES(?,?,?,?,'published')").bind(id(), ...p))]);
            await audit(staff.id, 'seed', 'catalog');
            return json({ ok: true });
        }
        if (resource === 'settings') {
            if (method === 'GET')
                return json(await settings());
            const b = z.object({ announcement: z.string().max(300), headline: z.string().max(150), subheadline: z.string().max(500), heroButton: short, heroUrl: url, heroImage: url, shipping: z.number().int().nonnegative(), freeShipping: z.number().int().nonnegative(), delivery: z.string().max(500), taxBps: z.number().int().min(0).max(10000), bankEnabled: z.boolean(), bankDetails: z.string().max(2000), phone: z.string().max(50), email: z.string().email().or(z.literal('')), whatsapp: z.string().regex(/^\d*$/), address: z.string().max(1000), hours: z.string().max(500), instagram: url, sections: z.array(z.enum(['categories', 'featured', 'promo', 'new'])).max(4), footerLinks: z.array(z.object({ label: short, url })).max(20), navigation: z.array(z.object({ label: short, url })).max(10) }).parse(await r.json());
            if (b.bankEnabled && !b.bankDetails)
                fail('Add bank account details before enabling transfers.');
            await db().prepare("INSERT INTO settings(id,data) VALUES('store',?) ON CONFLICT(id) DO UPDATE SET data=excluded.data").bind(JSON.stringify(b)).run();
            await audit(staff.id, 'update', 'settings');
            return json({ ok: true });
        }
        if (resource === 'reports' && method === 'GET') {
            return json({ sales: await one("SELECT coalesce(sum(total),0) total,count(*) count FROM orders WHERE status='Delivered'"), pending: await one("SELECT count(*) count FROM orders WHERE status='Pending Confirmation'"), low: await one('SELECT count(*) count FROM products WHERE stock<=threshold'), orders: await all('SELECT id,status,total,payment_status,created FROM orders ORDER BY created DESC LIMIT 10'), trend: await all("SELECT date(created) day,sum(total) total FROM orders WHERE status='Delivered' GROUP BY date(created) ORDER BY day DESC LIMIT 30"), best: await all("SELECT i.name,sum(i.quantity) quantity FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.status='Delivered' GROUP BY i.product_id ORDER BY quantity DESC LIMIT 5") });
        }
        if (resource === 'orders') {
            if (method === 'GET') {
                if (p[2])
                    return json({ order: await one('SELECT * FROM orders WHERE id=?', p[2]), items: await all('SELECT * FROM order_items WHERE order_id=?', p[2]), events: await all('SELECT * FROM order_events WHERE order_id=? ORDER BY created', p[2]) });
                return json(await all('SELECT o.*,c.name,c.phone FROM orders o JOIN customers c ON c.id=o.customer_id ORDER BY created DESC LIMIT 500'));
            }
            const b = z.object({ status: short, note: z.string().max(2000).default(''), courier: z.string().max(100).default(''), tracking: z.string().max(100).default(''), tracking_url: url.default(''), payment_status: z.enum(['pending', 'paid', 'failed', 'cancelled', 'refunded', 'partially_refunded']), cod_collected: z.number().int().nonnegative() }).parse(await r.json());
            const old = await one('SELECT * FROM orders WHERE id=?', p[2]);
            if (!old)
                fail('Order not found', 404);
            if (b.status !== old.status && !transitions[old.status]?.includes(b.status))
                fail('This order status transition is not allowed.');
            if (b.payment_status !== old.payment_status && !['owner', 'manager'].includes(staff.role))
                fail('Payment verification requires an owner or store manager.', 403);
            if (b.cod_collected > old.total)
                fail('Collected amount exceeds the order total.');
            const gid=id();
            const statements=[db().prepare('INSERT INTO operation_guards(id,ok) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM orders WHERE id=? AND status=? AND payment_status=?) THEN 1 ELSE 0 END').bind(gid,p[2],old.status,old.payment_status)];
            if(b.status!==old.status&&['Cancelled','Returned'].includes(b.status)){
                statements.push(db().prepare('UPDATE products SET stock=stock+coalesce((SELECT sum(quantity) FROM order_items WHERE order_id=? AND product_id=products.id AND variant_id IS NULL),0) WHERE id IN(SELECT product_id FROM order_items WHERE order_id=? AND variant_id IS NULL)').bind(p[2],p[2]));
                statements.push(db().prepare('UPDATE variants SET stock=stock+coalesce((SELECT sum(quantity) FROM order_items WHERE order_id=? AND variant_id=variants.id),0) WHERE id IN(SELECT variant_id FROM order_items WHERE order_id=?)').bind(p[2],p[2]));
                statements.push(db().prepare("INSERT INTO stock_movements(product_id,variant_id,delta,reason) SELECT product_id,variant_id,quantity,? FROM order_items WHERE order_id=?").bind('Restocked '+p[2],p[2]));
            }
            statements.push(db().prepare('UPDATE orders SET status=?,courier=?,tracking=?,tracking_url=?,payment_status=?,cod_collected=? WHERE id=?').bind(b.status,b.courier,b.tracking,b.tracking_url,b.payment_status,b.cod_collected,p[2]),db().prepare('INSERT INTO order_events(id,order_id,status,note) VALUES(?,?,?,?)').bind(id(),p[2],b.status,b.note),db().prepare('DELETE FROM operation_guards WHERE id=?').bind(gid));
            await db().batch(statements);
            await audit(staff.id, 'update order', p[2]);
            return json({ ok: true });
        }
        if (resource === 'inventory') {
            if (method === 'GET')
                return json(await all('SELECT * FROM stock_movements ORDER BY id DESC LIMIT 500'));
            const b = z.object({ productId: short, variantId: z.string().nullable().default(null), delta: z.number().int().min(-100000).max(100000), reason: z.string().min(3).max(500) }).parse(await r.json());
            const target = b.variantId ? 'variants' : 'products';
            const key = b.variantId || b.productId;
            if (!await one('SELECT id FROM ' + target + ' WHERE id=?', key))
                fail('Product or variant not found.');
            await db().batch([db().prepare('UPDATE ' + target + ' SET stock=stock+? WHERE id=?').bind(b.delta, key), db().prepare('INSERT INTO stock_movements(product_id,variant_id,delta,reason) VALUES(?,?,?,?)').bind(b.productId, b.variantId, b.delta, b.reason)]);
            await audit(staff.id, 'stock adjustment', key);
            return json({ ok: true });
        }
        if (resource === 'staff') {
            if (method === 'GET')
                return json(await all('SELECT * FROM staff'));
            const b = z.object({ id: short, email: z.string().email(), role: z.enum(['manager', 'orders', 'inventory', 'support', 'analyst']) }).parse(await r.json());
            if (await one("SELECT 1 FROM staff WHERE id=? AND role='owner'", b.id))
                fail('The owner role cannot be changed here.');
            await db().prepare('INSERT INTO staff(id,email,role) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET role=excluded.role,email=excluded.email').bind(b.id, b.email, b.role).run();
            await audit(staff.id, 'staff role', b.id);
            return json({ ok: true });
        }
        if (resource === 'audit' && method === 'GET')
            return json(await all('SELECT * FROM audit ORDER BY created DESC LIMIT 500'));
        if (resource === 'reviews') {
            if (method === 'GET')
                return json(await all('SELECT * FROM reviews'));
            const b = z.object({ status: z.enum(['approved', 'rejected', 'pending']) }).parse(await r.json());
            await db().prepare('UPDATE reviews SET status=? WHERE id=?').bind(b.status, p[2]).run();
            await audit(staff.id, 'moderate review', p[2]);
            return json({ ok: true });
        }
        if (schemas[resource]) {
            if (method === 'GET') {
                let rows = await all('SELECT * FROM ' + resource + ' ORDER BY ' + (resource === 'coupons' ? 'code' : 'id') + ' LIMIT 500');
                if (resource === 'customers')
                    rows = await all("SELECT c.*,coalesce((SELECT sum(o.total) FROM orders o WHERE (o.user_id=c.user_id OR o.customer_id=c.id) AND o.status='Delivered'),0) lifetime_spend,(SELECT count(*) FROM orders o WHERE o.user_id=c.user_id OR o.customer_id=c.id) order_count FROM customers c ORDER BY created DESC LIMIT 500");
                if (resource === 'products' && !['owner', 'manager'].includes(staff.role))
                    rows = rows.map(({ cost, ...rest }) => rest);
                return json(rows);
            }
            if (method === 'DELETE') {
                if (resource === 'products') {
                    await db().prepare("UPDATE products SET status='archived' WHERE id=?").bind(p[2]).run();
                }
                else if (['categories', 'variants'].includes(resource)) {
                    if (resource === 'categories' && await one('SELECT 1 FROM products WHERE category=?', p[2]))
                        fail('Move products out of this category first.');
                    await db().prepare('DELETE FROM ' + resource + ' WHERE id=?').bind(p[2]).run();
                }
                else
                    fail('Use archive or draft status instead.');
                await audit(staff.id, 'archive/delete ' + resource, p[2]);
                return json({ ok: true });
            }
            const b = schemas[resource].parse(await r.json()) as any;
            if (resource === 'products') {
                if (!['owner', 'manager'].includes(staff.role)) {
                    const old = p[2] ? await one('SELECT cost FROM products WHERE id=?', p[2]) : null;
                    b.cost = old?.cost || 0;
                }
                b.images = JSON.stringify(b.images);
                b.attributes = JSON.stringify(b.attributes);
            }
            const key = resource === 'coupons' ? 'code' : 'id';
            const itemId = key === 'code' ? b.code : (p[2] || id());
            const previous = p[2] ? await one('SELECT * FROM ' + resource + ' WHERE ' + key + '=?', p[2]) : null;
            const data = { ...b, [key]: itemId };
            const columns = Object.keys(data);
            const stmts = [db().prepare('INSERT INTO ' + resource + '(' + columns.join(',') + ') VALUES(' + columns.map(() => '?').join(',') + ') ON CONFLICT(' + key + ') DO UPDATE SET ' + columns.filter(c => c !== key).map(c => c + '=excluded.' + c).join(',')).bind(...Object.values(data) as any[])];
            if (resource === 'products' && b.stock !== (previous?.stock || 0))
                stmts.push(db().prepare('INSERT INTO stock_movements(product_id,delta,reason) VALUES(?,?,?)').bind(itemId, b.stock - (previous?.stock || 0), 'Catalog edit'));
            await db().batch(stmts);
            await audit(staff.id, 'save ' + resource, itemId);
            return json({ id: itemId });
        }
    }
    fail('Not found', 404);
}
async function handle(r: Request) { try {
    return await route(r);
}
catch (e: any) {
    if (e instanceof z.ZodError)
        return json({ error: e.issues.map(i => i.path.join('.') + ': ' + i.message).join('; ') }, 400);
    return json({ error: e.status ? e.message : 'The request could not be completed. Check for duplicate SKUs, invalid references, or insufficient stock.' }, e.status || 400);
} }
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
