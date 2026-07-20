const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const crypto = require('crypto');

function hashPassword(pwd) {
  return crypto.createHash('sha256').update(pwd).digest('hex');
}

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'inventory.db');

app.use(cors());
app.use(express.json());
app.get('/', (req, res) => {
  res.redirect('/pos');
});
app.use(express.static(path.join(__dirname, 'public')));
app.use('/pos', express.static(path.join(__dirname, '../sama-order-sale-point')));

let db;

// ========================
// DB HELPERS
// ========================
function saveDb() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function initDb() {
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sku TEXT UNIQUE NOT NULL,
      description TEXT,
      category_id INTEGER,
      price REAL NOT NULL DEFAULT 0,
      cost REAL NOT NULL DEFAULT 0,
      quantity INTEGER NOT NULL DEFAULT 0,
      low_stock_threshold INTEGER NOT NULL DEFAULT 10,
      unit TEXT DEFAULT 'pcs',
      supplier TEXT,
      location TEXT,
      status TEXT DEFAULT 'active',
      likes INTEGER DEFAULT 0,
      rating_sum REAL DEFAULT 0,
      rating_count INTEGER DEFAULT 0,
      image_url TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      note TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      payment_details TEXT,
      items TEXT,
      total_amount REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migration: Alter table if updating from previous version
  try { db.run("ALTER TABLE products ADD COLUMN likes INTEGER DEFAULT 0"); } catch(e){}
  try { db.run("ALTER TABLE products ADD COLUMN rating_sum REAL DEFAULT 0"); } catch(e){}
  try { db.run("ALTER TABLE products ADD COLUMN rating_count INTEGER DEFAULT 0"); } catch(e){}
  try { db.run("ALTER TABLE products ADD COLUMN image_url TEXT"); } catch(e){}
  try { db.run("ALTER TABLE orders ADD COLUMN items TEXT"); } catch(e){}

  // Seed default users if none exist
  try {
    const userCount = get("SELECT COUNT(*) as c FROM users").c;
    if (userCount === 0) {
      run("INSERT INTO users (username, email, password_hash, role, display_name) VALUES (?, ?, ?, ?, ?)",
        ['admin', 'admin@samahardware.com', hashPassword('admin'), 'admin', 'Sama Admin']);
      run("INSERT INTO users (username, email, password_hash, role, display_name) VALUES (?, ?, ?, ?, ?)",
        ['worker', 'worker@samahardware.com', hashPassword('worker'), 'worker', 'Sama Worker']);
      run("INSERT INTO users (username, email, password_hash, role, display_name) VALUES (?, ?, ?, ?, ?)",
        ['samainventory', 'samainventory@samahardware.com', hashPassword('samainventory1234'), 'inventory', 'Sama Inventory Manager']);
    }
  } catch (err) {
    console.error('Failed to seed users:', err.message);
  }

  // Ensure the new samainventory user is present and old SamaHardware is removed (migration)
  try {
    run("DELETE FROM users WHERE username = 'SamaHardware'");
    const hasSamainventory = get("SELECT COUNT(*) as c FROM users WHERE username = 'samainventory'").c;
    if (hasSamainventory === 0) {
      run("INSERT INTO users (username, email, password_hash, role, display_name) VALUES (?, ?, ?, ?, ?)",
        ['samainventory', 'samainventory@samahardware.com', hashPassword('samainventory1234'), 'inventory', 'Sama Inventory Manager']);
    }
  } catch (err) {
    console.error('Failed to migrate inventory credentials:', err.message);
  }

  // Seed categories if none exist
  try {
    const catCount = get("SELECT COUNT(*) as c FROM categories").c;
    if (catCount === 0) {
      run("INSERT INTO categories (name, description) VALUES ('Tools', 'Hardware tools and equipment')");
      run("INSERT INTO categories (name, description) VALUES ('Electrical', 'Electrical components and accessories')");
      run("INSERT INTO categories (name, description) VALUES ('Plumbing', 'Pipes, valves, and fittings')");
      run("INSERT INTO categories (name, description) VALUES ('Safety', 'Personal protective equipment and safety gear')");
    }
  } catch (err) {
    console.error('Failed to seed categories:', err.message);
  }

  // Get category IDs mapping
  const cats = all("SELECT * FROM categories");
  const catMap = {};
  cats.forEach(c => {
    catMap[c.name.toLowerCase()] = c.id;
  });

  // Seed products if they do not exist
  try {
    const prodCount = get("SELECT COUNT(*) as c FROM products WHERE sku LIKE 'HW%' OR sku LIKE 'EL%' OR sku LIKE 'PL%' OR sku LIKE 'SF%'").c;
    if (prodCount === 0) {
      const productsToSeed = [
        { sku: 'hw1', name: 'Power Drill 20V',         category: 'tools',      price: 89.99,  unit: 'pcs', description: 'Heavy duty 20V cordless power drill' },
        { sku: 'hw2', name: 'Angle Grinder 115mm',      category: 'tools',      price: 65.00,  unit: 'pcs', description: '115mm angle grinder for metal and masonry' },
        { sku: 'hw3', name: 'Circular Saw 185mm',        category: 'tools',      price: 120.00, unit: 'pcs', description: '185mm circular saw with laser guide' },
        { sku: 'hw4', name: 'Hammer Set (3pc)',          category: 'tools',      price: 32.50,  unit: 'set', description: '3-piece claw and mallet hammer set' },
        { sku: 'hw5', name: 'Screwdriver Set (8pc)',     category: 'tools',      price: 18.00,  unit: 'set', description: '8-piece magnetic screwdriver set' },
        { sku: 'el1', name: 'Circuit Breaker 20A',       category: 'electrical', price: 14.50,  unit: 'pcs', description: '20A single pole circuit breaker' },
        { sku: 'el2', name: 'Cable Reel 2.5mm (100m)',   category: 'electrical', price: 78.00,  unit: 'roll', description: '100m heavy duty extension cable reel' },
        { sku: 'el3', name: 'Junction Box (IP65)',        category: 'electrical', price: 8.75,   unit: 'pcs', description: 'IP65 waterproof electrical junction box' },
        { sku: 'el4', name: 'LED Flood Light 100W',      category: 'electrical', price: 35.00,  unit: 'pcs', description: '100W outdoor LED flood light' },
        { sku: 'el5', name: 'Conduit Pipe 20mm (3m)',    category: 'electrical', price: 4.20,   unit: 'pcs', description: '3m PVC conduit pipe 20mm diameter' },
        { sku: 'pl1', name: 'PVC Pipe 2" (3m)',          category: 'plumbing',   price: 6.50,   unit: 'pcs', description: '3m PVC plumbing pipe 2 inch diameter' },
        { sku: 'pl2', name: 'Gate Valve ½"',             category: 'plumbing',   price: 9.00,   unit: 'pcs', description: '1/2 inch brass gate valve' },
        { sku: 'pl3', name: 'Submersible Pump 0.5HP',    category: 'plumbing',   price: 145.00, unit: 'pcs', description: '0.5HP submersible water pump' },
        { sku: 'pl4', name: 'Pipe Fittings Pack (25pc)', category: 'plumbing',   price: 12.50,  unit: 'pack', description: '25-piece PVC pipe fittings elbow/tee pack' },
        { sku: 'sf1', name: 'Safety Helmet (EN397)',     category: 'safety',     price: 11.00,  unit: 'pcs', description: 'EN397 certified industrial safety helmet' },
        { sku: 'sf2', name: 'Work Gloves Cut-5',         category: 'safety',     price: 7.50,   unit: 'pair', description: 'Cut-resistant level 5 work gloves' },
        { sku: 'sf3', name: 'Hi-Vis Vest Class 2',       category: 'safety',     price: 8.00,   unit: 'pcs', description: 'Class 2 high visibility reflective safety vest' },
        { sku: 'sf4', name: 'Safety Goggles Anti-fog',   category: 'safety',     price: 5.25,   unit: 'pcs', description: 'Anti-fog protective safety goggles' }
      ];

      const initialStocks = [45, 30, 20, 55, 80, 62, 28, 90, 37, 110, 75, 43, 15, 88, 120, 66, 95, 50];

      productsToSeed.forEach((p, idx) => {
        const catId = catMap[p.category];
        const stock = initialStocks[idx] || 40;
        const prodId = run(
          `INSERT INTO products (name, sku, description, category_id, price, quantity, low_stock_threshold, unit)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [p.name, p.sku.toUpperCase(), p.description, catId, p.price, stock, 10, p.unit]
        );
        run('INSERT INTO stock_movements (product_id, type, quantity, note) VALUES (?, ?, ?, ?)', [
          prodId, 'in', stock, 'Initial stock seed'
        ]);
      });
    }
  } catch (err) {
    console.error('Failed to seed products:', err.message);
  }

  saveDb();
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  const rows = all(sql, params);
  return rows[0] || null;
}

function run(sql, params = []) {
  db.run(sql, params);
  const res = db.exec('SELECT last_insert_rowid() as id');
  return res[0]?.values[0][0];
}

// ========================
// STARTUP
// ========================
initSqlJs().then(SQL => {
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  initDb();

  app.listen(PORT, () => {
    console.log(`\n🚀 Inventory System running at http://localhost:${PORT}`);
    console.log(`📦 Database: inventory.db`);
    console.log(`🔗 Storefront: http://localhost:${PORT}`);
    console.log(`⚙️  Admin Board: http://localhost:${PORT}/admin`);
    console.log(`\nPress Ctrl+C to stop\n`);
  });
});

// ========================
// CATEGORIES
// ========================
app.get('/api/categories', (req, res) => {
  try {
    const cats = all(`
      SELECT c.id, c.name, c.description, c.created_at,
        (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.status = 'active') as product_count
      FROM categories c ORDER BY c.name ASC
    `);
    res.json({ success: true, data: cats });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/categories', (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
    const id = run('INSERT INTO categories (name, description) VALUES (?, ?)', [name.trim(), description || '']);
    saveDb();
    const cat = get('SELECT * FROM categories WHERE id = ?', [id]);
    res.json({ success: true, data: cat });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ success: false, message: 'Category already exists' });
    res.status(500).json({ success: false, message: e.message });
  }
});

app.put('/api/categories/:id', (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
    run('UPDATE categories SET name = ?, description = ? WHERE id = ?', [name.trim(), description || '', +req.params.id]);
    saveDb();
    const cat = get('SELECT * FROM categories WHERE id = ?', [+req.params.id]);
    res.json({ success: true, data: cat });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/categories/:id', (req, res) => {
  try {
    const row = get('SELECT COUNT(*) as c FROM products WHERE category_id = ?', [+req.params.id]);
    if (row && row.c > 0) return res.status(400).json({ success: false, message: 'Cannot delete category with existing products' });
    run('DELETE FROM categories WHERE id = ?', [+req.params.id]);
    saveDb();
    res.json({ success: true, message: 'Category deleted' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ========================
// PRODUCTS
// ========================
app.get('/api/products', (req, res) => {
  try {
    const { search, category, status, low_stock } = req.query;
    let sql = `
      SELECT p.*, c.name as category_name,
        CASE WHEN p.rating_count > 0 THEN ROUND(CAST(p.rating_sum AS REAL) / p.rating_count, 1) ELSE 0 END as rating
      FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE 1=1
    `;
    const params = [];
    if (search) { sql += ` AND (p.name LIKE ? OR p.sku LIKE ? OR p.supplier LIKE ?)`; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (category) { sql += ` AND p.category_id = ?`; params.push(+category); }
    if (status) { sql += ` AND p.status = ?`; params.push(status); }
    if (low_stock === 'true') { sql += ` AND p.quantity <= p.low_stock_threshold`; }
    sql += ` ORDER BY p.updated_at DESC`;
    res.json({ success: true, data: all(sql, params) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/products/:id', (req, res) => {
  try {
    const product = get(`
      SELECT p.*, c.name as category_name,
        CASE WHEN p.rating_count > 0 THEN ROUND(CAST(p.rating_sum AS REAL) / p.rating_count, 1) ELSE 0 END as rating
      FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?
    `, [+req.params.id]);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    const movements = all('SELECT * FROM stock_movements WHERE product_id = ? ORDER BY created_at DESC LIMIT 20', [+req.params.id]);
    res.json({ success: true, data: { ...product, movements } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/products', (req, res) => {
  try {
    const { name, sku, description, category_id, price, cost, quantity, low_stock_threshold, unit, supplier, location, image_url } = req.body;
    if (!name || !sku) return res.status(400).json({ success: false, message: 'Name and SKU are required' });
    const id = run(
      `INSERT INTO products (name, sku, description, category_id, price, cost, quantity, low_stock_threshold, unit, supplier, location, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name.trim(), sku.trim().toUpperCase(), description || '', category_id || null,
       parseFloat(price) || 0, parseFloat(cost) || 0, parseInt(quantity) || 0,
       parseInt(low_stock_threshold) || 10, unit || 'pcs', supplier || '', location || '', image_url || '']
    );
    if (parseInt(quantity) > 0) {
      run('INSERT INTO stock_movements (product_id, type, quantity, note) VALUES (?, ?, ?, ?)', [id, 'in', parseInt(quantity), 'Initial stock']);
    }
    saveDb();
    const product = get(`
      SELECT p.*, c.name as category_name,
        CASE WHEN p.rating_count > 0 THEN ROUND(CAST(p.rating_sum AS REAL) / p.rating_count, 1) ELSE 0 END as rating
      FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?
    `, [id]);
    res.json({ success: true, data: product });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ success: false, message: 'SKU already exists' });
    res.status(500).json({ success: false, message: e.message });
  }
});

app.put('/api/products/:id', (req, res) => {
  try {
    const { name, sku, description, category_id, price, cost, low_stock_threshold, unit, supplier, location, status, image_url } = req.body;
    run(`UPDATE products SET name=?, sku=?, description=?, category_id=?, price=?, cost=?, low_stock_threshold=?, unit=?, supplier=?, location=?, status=?, image_url=?, updated_at=datetime('now') WHERE id=?`,
      [name.trim(), sku.trim().toUpperCase(), description || '', category_id || null,
       parseFloat(price) || 0, parseFloat(cost) || 0,
       parseInt(low_stock_threshold) || 10, unit || 'pcs', supplier || '', location || '',
       status || 'active', image_url || '', +req.params.id]
    );
    saveDb();
    const product = get(`
      SELECT p.*, c.name as category_name,
        CASE WHEN p.rating_count > 0 THEN ROUND(CAST(p.rating_sum AS REAL) / p.rating_count, 1) ELSE 0 END as rating
      FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?
    `, [+req.params.id]);
    res.json({ success: true, data: product });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/products/:id', (req, res) => {
  try {
    run('DELETE FROM stock_movements WHERE product_id = ?', [+req.params.id]);
    run('DELETE FROM products WHERE id = ?', [+req.params.id]);
    saveDb();
    res.json({ success: true, message: 'Product deleted' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/products/:id/stock', (req, res) => {
  try {
    const { type, quantity, note } = req.body;
    if (!type || !quantity) return res.status(400).json({ success: false, message: 'Type and quantity required' });
    const product = get('SELECT * FROM products WHERE id = ?', [+req.params.id]);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    let newQty = product.quantity;
    if (type === 'in') newQty += parseInt(quantity);
    else if (type === 'out') {
      if (product.quantity < parseInt(quantity)) return res.status(400).json({ success: false, message: 'Insufficient stock' });
      newQty -= parseInt(quantity);
    } else if (type === 'set') {
      newQty = parseInt(quantity);
    }

    run(`UPDATE products SET quantity = ?, updated_at = datetime('now') WHERE id = ?`, [newQty, +req.params.id]);
    run('INSERT INTO stock_movements (product_id, type, quantity, note) VALUES (?, ?, ?, ?)', [+req.params.id, type, parseInt(quantity), note || '']);
    saveDb();

    const updated = get(`
      SELECT p.*, c.name as category_name,
        CASE WHEN p.rating_count > 0 THEN ROUND(CAST(p.rating_sum AS REAL) / p.rating_count, 1) ELSE 0 END as rating
      FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?
    `, [+req.params.id]);
    res.json({ success: true, data: updated });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ========================
// CUSTOMER ACTIONS (LIKE, RATE, CHECKOUT)
// ========================
app.post('/api/products/:id/like', (req, res) => {
  try {
    const id = +req.params.id;
    const product = get('SELECT * FROM products WHERE id = ?', [id]);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    run('UPDATE products SET likes = likes + 1 WHERE id = ?', [id]);
    saveDb();

    const updated = get(`
      SELECT p.*, CASE WHEN p.rating_count > 0 THEN ROUND(CAST(p.rating_sum AS REAL) / p.rating_count, 1) ELSE 0 END as rating
      FROM products p WHERE p.id = ?
    `, [id]);
    res.json({ success: true, data: updated });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/products/:id/unlike', (req, res) => {
  try {
    const id = +req.params.id;
    const product = get('SELECT * FROM products WHERE id = ?', [id]);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    run('UPDATE products SET likes = CASE WHEN likes > 0 THEN likes - 1 ELSE 0 END WHERE id = ?', [id]);
    saveDb();

    const updated = get(`
      SELECT p.*, CASE WHEN p.rating_count > 0 THEN ROUND(CAST(p.rating_sum AS REAL) / p.rating_count, 1) ELSE 0 END as rating
      FROM products p WHERE p.id = ?
    `, [id]);
    res.json({ success: true, data: updated });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/products/:id/rate', (req, res) => {
  try {
    const id = +req.params.id;
    const { rating } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be a number between 1 and 5' });
    }

    const product = get('SELECT * FROM products WHERE id = ?', [id]);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    run('UPDATE products SET rating_sum = rating_sum + ?, rating_count = rating_count + 1 WHERE id = ?', [parseFloat(rating), id]);
    saveDb();

    const updated = get(`
      SELECT p.*, CASE WHEN p.rating_count > 0 THEN ROUND(CAST(p.rating_sum AS REAL) / p.rating_count, 1) ELSE 0 END as rating
      FROM products p WHERE p.id = ?
    `, [id]);
    res.json({ success: true, data: updated });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/products/:id/rate-update', (req, res) => {
  try {
    const id = +req.params.id;
    const { oldRating, newRating } = req.body;
    if (!oldRating || !newRating || oldRating < 1 || oldRating > 5 || newRating < 1 || newRating > 5) {
      return res.status(400).json({ success: false, message: 'Ratings must be between 1 and 5' });
    }

    const product = get('SELECT * FROM products WHERE id = ?', [id]);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    run('UPDATE products SET rating_sum = rating_sum - ? + ? WHERE id = ?', [parseFloat(oldRating), parseFloat(newRating), id]);
    saveDb();

    const updated = get(`
      SELECT p.*, CASE WHEN p.rating_count > 0 THEN ROUND(CAST(p.rating_sum AS REAL) / p.rating_count, 1) ELSE 0 END as rating
      FROM products p WHERE p.id = ?
    `, [id]);
    res.json({ success: true, data: updated });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/products/:id/unrate', (req, res) => {
  try {
    const id = +req.params.id;
    const { rating } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating value is required to unrate' });
    }

    const product = get('SELECT * FROM products WHERE id = ?', [id]);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    run(`UPDATE products SET 
         rating_sum = CASE WHEN rating_sum >= ? THEN rating_sum - ? ELSE 0 END, 
         rating_count = CASE WHEN rating_count > 0 THEN rating_count - 1 ELSE 0 END 
         WHERE id = ?`, [parseFloat(rating), parseFloat(rating), id]);
    saveDb();

    const updated = get(`
      SELECT p.*, CASE WHEN p.rating_count > 0 THEN ROUND(CAST(p.rating_sum AS REAL) / p.rating_count, 1) ELSE 0 END as rating
      FROM products p WHERE p.id = ?
    `, [id]);
    res.json({ success: true, data: updated });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/orders', (req, res) => {
  try {
    const { items, customer_name, customer_phone, payment_method, payment_details, total_amount } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No items in order' });
    }

    // Verify all products exist and have sufficient stock
    for (const item of items) {
      const prod = get('SELECT * FROM products WHERE id = ?', [item.id]);
      if (!prod) return res.status(404).json({ success: false, message: `Product not found: ID ${item.id}` });
      if (prod.quantity < item.qty) {
        return res.status(400).json({ success: false, message: `Insufficient stock for "${prod.name}". Available: ${prod.quantity}` });
      }
    }

    // Process order
    for (const item of items) {
      const prod = get('SELECT * FROM products WHERE id = ?', [item.id]);
      const newQty = prod.quantity - item.qty;
      run('UPDATE products SET quantity = ?, updated_at = datetime(\'now\') WHERE id = ?', [newQty, item.id]);
      run('INSERT INTO stock_movements (product_id, type, quantity, note) VALUES (?, ?, ?, ?)', [
        item.id,
        'out',
        item.qty,
        `Customer Checkout Order (Qty: ${item.qty}) - Paid via ${payment_method || 'Unknown'}`
      ]);
    }

    // Record order in orders table
    const detailsStr = payment_details ? (typeof payment_details === 'string' ? payment_details : JSON.stringify(payment_details)) : '';
    const itemsStr = items ? JSON.stringify(items) : '';
    const orderId = run(`
      INSERT INTO orders (customer_name, customer_phone, payment_method, payment_details, items, total_amount)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [customer_name || 'Anonymous', customer_phone || 'N/A', payment_method || 'N/A', detailsStr, itemsStr, total_amount || 0]);

    saveDb();
    res.json({ success: true, message: 'Order placed successfully!', orderId });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/pos-orders', (req, res) => {
  try {
    const { items, customer_name, customer_phone, payment_method, payment_details, total_amount } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No items in order' });
    }

    const detailsStr = payment_details ? (typeof payment_details === 'string' ? payment_details : JSON.stringify(payment_details)) : '';
    const itemsStr = JSON.stringify(items);
    const orderId = run(`
      INSERT INTO orders (customer_name, customer_phone, payment_method, payment_details, items, total_amount)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      customer_name || 'Anonymous',
      customer_phone || 'N/A',
      payment_method || 'Sale Point (Ksh)',
      detailsStr,
      itemsStr,
      parseFloat(total_amount) || 0
    ]);

    // Deduct stock levels for matching SKUs in SQLite
    for (const item of items) {
      const prod = get('SELECT * FROM products WHERE UPPER(sku) = ?', [item.id.toUpperCase()]);
      if (prod) {
        const newQty = Math.max(0, prod.quantity - item.qty);
        run('UPDATE products SET quantity = ?, updated_at = datetime(\'now\') WHERE id = ?', [newQty, prod.id]);
        run('INSERT INTO stock_movements (product_id, type, quantity, note) VALUES (?, ?, ?, ?)', [
          prod.id, 'out', item.qty, `POS Checkout (Order ID: #${orderId})`
        ]);
      }
    }

    saveDb();
    res.json({ success: true, message: 'Sale Point order recorded and inventory synced.', orderId });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POS restock sync
app.post('/api/pos/restock', (req, res) => {
  try {
    const { productId, quantity } = req.body;
    if (!productId || !quantity) return res.status(400).json({ success: false, message: 'productId and quantity are required' });
    
    const prod = get('SELECT * FROM products WHERE UPPER(sku) = ?', [productId.toUpperCase()]);
    if (!prod) return res.status(404).json({ success: false, message: 'Product not found in inventory' });

    const newQty = prod.quantity + parseInt(quantity);
    run('UPDATE products SET quantity = ?, updated_at = datetime(\'now\') WHERE id = ?', [newQty, prod.id]);
    run('INSERT INTO stock_movements (product_id, type, quantity, note) VALUES (?, ?, ?, ?)', [
      prod.id, 'in', parseInt(quantity), 'POS Restock Sync'
    ]);
    saveDb();
    res.json({ success: true, newQty });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// POS reset sync
app.post('/api/pos/reset', (req, res) => {
  try {
    const productsToReset = [
      { sku: 'HW1', stock: 45 }, { sku: 'HW2', stock: 30 }, { sku: 'HW3', stock: 20 },
      { sku: 'HW4', stock: 55 }, { sku: 'HW5', stock: 80 }, { sku: 'EL1', stock: 62 },
      { sku: 'EL2', stock: 28 }, { sku: 'EL3', stock: 90 }, { sku: 'EL4', stock: 37 },
      { sku: 'EL5', stock: 110 }, { sku: 'PL1', stock: 75 }, { sku: 'PL2', stock: 43 },
      { sku: 'PL3', stock: 15 }, { sku: 'PL4', stock: 88 }, { sku: 'SF1', stock: 120 },
      { sku: 'SF2', stock: 66 }, { sku: 'SF3', stock: 95 }, { sku: 'SF4', stock: 50 }
    ];

    productsToReset.forEach(p => {
      const prod = get('SELECT * FROM products WHERE UPPER(sku) = ?', [p.sku]);
      if (prod) {
        run('UPDATE products SET quantity = ?, updated_at = datetime(\'now\') WHERE id = ?', [p.stock, prod.id]);
        run('INSERT INTO stock_movements (product_id, type, quantity, note) VALUES (?, ?, ?, ?)', [
          prod.id, 'set', p.stock, 'POS Stock Reset Sync'
        ]);
      }
    });

    saveDb();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get('/api/admin/orders', (req, res) => {
  try {
    const orders = all('SELECT * FROM orders ORDER BY created_at DESC');
    res.json({ success: true, data: orders });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ========================
// DASHBOARD STATS
// ========================
app.get('/api/stats', (req, res) => {
  try {
    const totalProducts = get("SELECT COUNT(*) as c FROM products WHERE status = 'active'").c;
    const totalCategories = get("SELECT COUNT(*) as c FROM categories").c;
    const lowStock = get("SELECT COUNT(*) as c FROM products WHERE quantity <= low_stock_threshold AND status = 'active'").c;
    const outOfStock = get("SELECT COUNT(*) as c FROM products WHERE quantity = 0 AND status = 'active'").c;
    const totalValue = get("SELECT SUM(cost * quantity) as v FROM products WHERE status = 'active'").v || 0;
    const recentMovements = all(`
      SELECT sm.*, p.name as product_name, p.sku
      FROM stock_movements sm JOIN products p ON p.id = sm.product_id
      ORDER BY sm.created_at DESC LIMIT 8
    `);
    const lowStockProducts = all(`
      SELECT p.*, c.name as category_name FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.quantity <= p.low_stock_threshold AND p.status = 'active'
      ORDER BY p.quantity ASC LIMIT 5
    `);
    res.json({ success: true, data: { totalProducts, totalCategories, lowStock, outOfStock, totalValue, recentMovements, lowStockProducts } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/analytics/stats', (req, res) => {
  try {
    const orders = all("SELECT total_amount, items, created_at FROM orders");
    const products = all("SELECT sku, name, category_id, (SELECT name FROM categories WHERE id = category_id) as category_name FROM products");
    
    const prodMap = {};
    products.forEach(p => {
      if (p.sku) prodMap[p.sku.toUpperCase()] = p.category_name || 'Uncategorized';
    });
    
    let totalSales = 0;
    const categorySales = {};
    const productSalesCount = {};
    const monthlySales = {};
    
    orders.forEach(o => {
      totalSales += o.total_amount;
      
      let itemsList = [];
      try {
        itemsList = JSON.parse(o.items || '[]');
      } catch (e) {}
      
      if (Array.isArray(itemsList)) {
        itemsList.forEach(item => {
          const qty = parseInt(item.qty) || 0;
          const price = parseFloat(item.price) || 0;
          const itemTotal = qty * price;
          const skuUpper = (item.id || '').toUpperCase();
          const category = prodMap[skuUpper] || 'Uncategorized';
          
          categorySales[category] = (categorySales[category] || 0) + itemTotal;
          productSalesCount[item.name] = (productSalesCount[item.name] || 0) + qty;
        });
      }
      
      if (o.created_at) {
        const dateStr = o.created_at;
        const monthStr = dateStr.slice(0, 7); // "YYYY-MM"
        monthlySales[monthStr] = (monthlySales[monthStr] || 0) + o.total_amount;
      }
    });
    
    const categoryBreakdown = Object.keys(categorySales).map(cat => ({
      category: cat,
      sales: parseFloat(categorySales[cat].toFixed(2))
    }));
    
    const salesTrend = Object.keys(monthlySales).map(m => ({
      month: m,
      sales: parseFloat(monthlySales[m].toFixed(2))
    })).sort((a, b) => a.month.localeCompare(b.month));
    
    const topProducts = Object.keys(productSalesCount).map(name => ({
      name,
      quantity: productSalesCount[name]
    })).sort((a, b) => b.quantity - a.quantity).slice(0, 5);
    
    res.json({
      success: true,
      data: {
        totalSales: parseFloat(totalSales.toFixed(2)),
        totalOrders: orders.length,
        categoryBreakdown,
        salesTrend,
        topProducts
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ========================
// MOVEMENTS
// ========================
app.get('/api/movements', (req, res) => {
  try {
    const movements = all(`
      SELECT sm.*, p.name as product_name, p.sku
      FROM stock_movements sm JOIN products p ON p.id = sm.product_id
      ORDER BY sm.created_at DESC LIMIT 100
    `);
    res.json({ success: true, data: movements });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ========================
// AUTHENTICATION API
// ========================
app.post('/api/auth/register', (req, res) => {
  try {
    const { username, email, password, role, displayName } = req.body;
    if (!username || !email || !password || !role) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    const hashedPassword = hashPassword(password);
    const existing = get("SELECT * FROM users WHERE username = ? OR email = ?", [username, email]);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Username or email already exists' });
    }
    const id = run("INSERT INTO users (username, email, password_hash, role, display_name) VALUES (?, ?, ?, ?, ?)",
      [username.trim().toLowerCase(), email.trim().toLowerCase(), hashedPassword, role, displayName || username]);
    saveDb();
    
    res.json({
      success: true,
      message: 'User registered successfully',
      user: { id, username, email, role, displayName: displayName || username }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { username, email, password } = req.body;
    const identify = username || email;
    if (!identify || !password) {
      return res.status(400).json({ success: false, message: 'Username/email and password required' });
    }
    const hashedPassword = hashPassword(password);
    const user = get("SELECT * FROM users WHERE (username = ? OR email = ?) AND password_hash = ?", 
      [identify.trim().toLowerCase(), identify.trim().toLowerCase(), hashedPassword]);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid username/email or password' });
    }
    res.json({
      success: true,
      token: `sama-session-token-${user.id}-${Date.now()}`,
      user: {
        username: user.username,
        email: user.email,
        role: user.role,
        displayName: user.display_name
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/admin/login', (req, res) => {
  try {
    const { username, email, password } = req.body;
    const hashedPassword = hashPassword(password);
    const identify = username || email;
    
    const user = get("SELECT * FROM users WHERE (username = ? OR email = ?) AND password_hash = ?", 
      [identify, identify, hashedPassword]);
      
    if (user && (user.role === 'admin' || user.role === 'inventory')) {
      return res.json({ 
        success: true, 
        token: `sama-session-token-${user.id}-${Date.now()}`,
        user: {
          username: user.username,
          email: user.email,
          role: user.role,
          displayName: user.display_name
        }
      });
    }
    return res.status(401).json({ success: false, message: 'Invalid credentials or unauthorized role' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ========================
// ROUTING
// ========================

// Explicitly serve admin index for admin routes
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// Default fallback to storefront
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
