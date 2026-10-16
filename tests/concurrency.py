"""Exercise transactional stock constraints with independent concurrent SQLite connections."""
import sqlite3, tempfile, pathlib, concurrent.futures
with tempfile.TemporaryDirectory() as folder:
    path=str(pathlib.Path(folder)/'concurrent.db')
    c=sqlite3.connect(path)
    
    for migration in sorted(pathlib.Path('drizzle').glob('*.sql')): c.executescript(migration.read_text())
    c.execute("INSERT INTO customers(id,name,phone) VALUES('customer','Test','03001234567')")
    c.execute("INSERT INTO products(id,name,slug,sku,category,price,stock,status) VALUES('p','Test','test','test','test',100,1,'published')")
    c.commit();c.close()
    def buy(n):
        d=sqlite3.connect(path,timeout=15)
        d.execute('PRAGMA foreign_keys=ON')
        try:
            with d:
                d.execute("UPDATE products SET stock=stock-1 WHERE id='p'")
                d.execute("INSERT INTO orders(id,idempotency_key,access_token,customer_id,payment,subtotal,discount,shipping,total,address) VALUES(?,?,?,'customer','cod',100,0,0,100,'{}')",(str(n),str(n),str(n)))
                d.execute("INSERT INTO order_items(id,order_id,product_id,name,sku,price,quantity) VALUES(?,?,'p','Test','test',100,1)",(str(n),str(n)))
            return True
        except sqlite3.IntegrityError:
            return False
        finally:
            d.close()
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        results=list(pool.map(buy,range(24)))
    c=sqlite3.connect(path)
    assert sum(results)==1,results
    assert c.execute('SELECT stock FROM products').fetchone()[0]==0
    assert c.execute('SELECT count(*) FROM orders').fetchone()[0]==1
    assert c.execute('SELECT count(*) FROM order_items').fetchone()[0]==1
    print('PASS: 24 simultaneous buyers, one item, one committed order, no overselling or orphan orders.')
    c.close()
