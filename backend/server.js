require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

app.use(cors());
app.use(express.json({ limit: '1mb' }));

/* ---------- helpers ---------- */
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const str = (v, max = 255) => {
  const s = (v ?? '').toString().trim();
  return s ? s.slice(0, max) : null;
};
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

async function tx(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/* ---------- auth ---------- */
app.post('/api/auth/login', ah(async (req, res) => {
  const { username, password } = req.body || {};
  const [rows] = await pool.query('SELECT * FROM users WHERE username = ? AND is_active = 1', [String(username || '').trim()]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(String(password || ''), u.password_hash))) {
    throw new HttpError(401, 'Incorrect username or password.');
  }
  const user = { id: u.id, name: u.full_name, username: u.username, role: u.role };
  res.json({ token: jwt.sign(user, JWT_SECRET, { expiresIn: '12h' }), user });
}));

// Everything below this line needs a valid token
app.use('/api', (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Your session has ended. Please sign in again.' });
  }
});
const adminOnly = (req, res, next) =>
  req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Only an admin can do this.' });

app.get('/api/auth/me', (req, res) => res.json({ user: req.user }));

/* ---------- dashboard ---------- */
app.get('/api/dashboard', ah(async (req, res) => {
  const [[kpi]] = await pool.query(`
    SELECT
      CURDATE() AS today,
      (SELECT COUNT(*) FROM medicines WHERE is_active = 1) AS medicines,
      (SELECT COALESCE(SUM(quantity * cost_price), 0) FROM batches WHERE expiry_date >= CURDATE()) AS stock_value,
      (SELECT COUNT(*) FROM medicines m LEFT JOIN v_medicine_stock s ON s.medicine_id = m.id
         WHERE m.is_active = 1 AND COALESCE(s.stock, 0) <= m.reorder_level) AS low_stock,
      (SELECT COUNT(*) FROM batches WHERE quantity > 0 AND expiry_date < CURDATE()) AS expired_batches,
      (SELECT COUNT(*) FROM batches WHERE quantity > 0
         AND expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)) AS expiring_30,
      (SELECT COALESCE(SUM(total), 0) FROM sales WHERE DATE(created_at) = CURDATE()) AS today_sales,
      (SELECT COUNT(*) FROM sales WHERE DATE(created_at) = CURDATE()) AS today_bills,
      (SELECT COALESCE(SUM(total), 0) FROM sales WHERE DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)) AS yesterday_sales,
      (SELECT COALESCE(SUM(total), 0) FROM sales WHERE created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS month_sales
  `);

  const [daily] = await pool.query(`
    SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, SUM(total) AS total, COUNT(*) AS bills
    FROM sales WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
    GROUP BY day`);
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const base = new Date(kpi.today + 'T00:00:00Z');
  const sales7d = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(base); d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    const row = byDay.get(key);
    sales7d.push({ day: key, total: row ? row.total : 0, bills: row ? row.bills : 0 });
  }

  const [topSellers] = await pool.query(`
    SELECT m.id, m.name, m.strength, SUM(si.quantity) AS units, SUM(si.line_total) AS revenue
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    JOIN medicines m ON m.id = si.medicine_id
    WHERE s.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    GROUP BY m.id, m.name, m.strength
    ORDER BY units DESC LIMIT 5`);

  const [categoryValue] = await pool.query(`
    SELECT c.name, COALESCE(SUM(b.quantity * b.cost_price), 0) AS amount
    FROM categories c
    LEFT JOIN medicines m ON m.category_id = c.id AND m.is_active = 1
    LEFT JOIN batches b ON b.medicine_id = m.id AND b.expiry_date >= CURDATE()
    GROUP BY c.id, c.name HAVING amount > 0 ORDER BY amount DESC`);

  const batchCols = `b.id, b.batch_no, b.quantity, b.expiry_date, DATEDIFF(b.expiry_date, CURDATE()) AS days_left,
                     m.name, m.strength`;
  const [expired] = await pool.query(`
    SELECT ${batchCols} FROM batches b JOIN medicines m ON m.id = b.medicine_id
    WHERE b.quantity > 0 AND b.expiry_date < CURDATE() ORDER BY b.expiry_date DESC LIMIT 8`);
  const [expiring] = await pool.query(`
    SELECT ${batchCols} FROM batches b JOIN medicines m ON m.id = b.medicine_id
    WHERE b.quantity > 0 AND b.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 60 DAY)
    ORDER BY b.expiry_date LIMIT 8`);
  const [low] = await pool.query(`
    SELECT m.id, m.name, m.strength, m.reorder_level, COALESCE(s.stock, 0) AS stock
    FROM medicines m LEFT JOIN v_medicine_stock s ON s.medicine_id = m.id
    WHERE m.is_active = 1 AND COALESCE(s.stock, 0) <= m.reorder_level
    ORDER BY COALESCE(s.stock, 0) / GREATEST(m.reorder_level, 1), m.name LIMIT 8`);

  res.json({ kpi, sales7d, topSellers, categoryValue, attention: { expired, expiring, low } });
}));

/* ---------- categories ---------- */
app.get('/api/categories', ah(async (req, res) => {
  const [rows] = await pool.query('SELECT id, name FROM categories ORDER BY name');
  res.json(rows);
}));

async function categoryId(conn, name) {
  const clean = str(name, 80);
  if (!clean) return null;
  await conn.query('INSERT IGNORE INTO categories (name) VALUES (?)', [clean]);
  const [rows] = await conn.query('SELECT id FROM categories WHERE name = ?', [clean]);
  return rows[0].id;
}

/* ---------- medicines ---------- */
const MEDICINE_SELECT = `
  SELECT m.*, c.name AS category,
         COALESCE(s.stock, 0) AS stock, COALESCE(s.expired_qty, 0) AS expired_qty, s.next_expiry
  FROM medicines m
  LEFT JOIN categories c ON c.id = m.category_id
  LEFT JOIN v_medicine_stock s ON s.medicine_id = m.id`;

function medicinePayload(b) {
  const name = str(b.name, 150);
  if (!name) throw new HttpError(400, 'Enter the medicine name.');
  const price = Number(b.unit_price);
  if (!Number.isFinite(price) || price < 0) throw new HttpError(400, 'Enter a valid selling price.');
  const reorder = parseInt(b.reorder_level, 10);
  if (!Number.isInteger(reorder) || reorder < 0) throw new HttpError(400, 'Reorder level must be 0 or more.');
  const gst = b.gst_percent === '' || b.gst_percent == null ? 5 : Number(b.gst_percent);
  if (!Number.isFinite(gst) || gst < 0 || gst > 100) throw new HttpError(400, 'GST must be between 0 and 100.');
  return {
    sku: str(b.sku, 30),
    name,
    generic_name: str(b.generic_name, 150),
    manufacturer: str(b.manufacturer, 120),
    dosage_form: str(b.dosage_form, 40),
    strength: str(b.strength, 40),
    unit: str(b.unit, 20) || 'strip',
    unit_price: round2(price),
    gst_percent: gst,
    reorder_level: reorder,
    requires_prescription: b.requires_prescription ? 1 : 0,
    rack_location: str(b.rack_location, 40),
  };
}

app.get('/api/medicines', ah(async (req, res) => {
  const [rows] = await pool.query(`${MEDICINE_SELECT} WHERE m.is_active = 1 ORDER BY m.name`);
  res.json(rows);
}));

app.get('/api/medicines/:id/batches', ah(async (req, res) => {
  const [rows] = await pool.query(`
    SELECT b.*, sp.name AS supplier, DATEDIFF(b.expiry_date, CURDATE()) AS days_left
    FROM batches b LEFT JOIN suppliers sp ON sp.id = b.supplier_id
    WHERE b.medicine_id = ? ORDER BY b.expiry_date`, [req.params.id]);
  res.json(rows);
}));

app.post('/api/medicines', ah(async (req, res) => {
  const p = medicinePayload(req.body || {});
  const id = await tx(async (conn) => {
    const catId = await categoryId(conn, req.body.category);
    const [r] = await conn.query(
      `INSERT INTO medicines (sku, name, generic_name, category_id, manufacturer, dosage_form, strength, unit,
                              unit_price, gst_percent, reorder_level, requires_prescription, rack_location)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [p.sku, p.name, p.generic_name, catId, p.manufacturer, p.dosage_form, p.strength, p.unit,
       p.unit_price, p.gst_percent, p.reorder_level, p.requires_prescription, p.rack_location]);
    if (!p.sku) {
      await conn.query('UPDATE medicines SET sku = ? WHERE id = ?', [`MED-${String(r.insertId).padStart(4, '0')}`, r.insertId]);
    }
    return r.insertId;
  });
  const [[row]] = await pool.query(`${MEDICINE_SELECT} WHERE m.id = ?`, [id]);
  res.status(201).json(row);
}));

app.put('/api/medicines/:id', ah(async (req, res) => {
  const p = medicinePayload(req.body || {});
  await tx(async (conn) => {
    const catId = await categoryId(conn, req.body.category);
    const [r] = await conn.query(
      `UPDATE medicines SET sku = COALESCE(?, sku), name=?, generic_name=?, category_id=?, manufacturer=?, dosage_form=?,
         strength=?, unit=?, unit_price=?, gst_percent=?, reorder_level=?, requires_prescription=?, rack_location=?
       WHERE id = ? AND is_active = 1`,
      [p.sku, p.name, p.generic_name, catId, p.manufacturer, p.dosage_form, p.strength, p.unit,
       p.unit_price, p.gst_percent, p.reorder_level, p.requires_prescription, p.rack_location, req.params.id]);
    if (!r.affectedRows) throw new HttpError(404, 'That medicine no longer exists.');
  });
  const [[row]] = await pool.query(`${MEDICINE_SELECT} WHERE m.id = ?`, [req.params.id]);
  res.json(row);
}));

// Medicines have sales history, so they are archived rather than erased.
app.delete('/api/medicines/:id', adminOnly, ah(async (req, res) => {
  const [r] = await pool.query('UPDATE medicines SET is_active = 0 WHERE id = ?', [req.params.id]);
  if (!r.affectedRows) throw new HttpError(404, 'That medicine no longer exists.');
  res.json({ ok: true });
}));

/* ---------- suppliers ---------- */
function supplierPayload(b) {
  const name = str(b.name, 120);
  if (!name) throw new HttpError(400, 'Enter the supplier name.');
  return {
    name, contact_person: str(b.contact_person, 100), phone: str(b.phone, 30),
    email: str(b.email, 120), address: str(b.address, 255),
  };
}

app.get('/api/suppliers', ah(async (req, res) => {
  const [rows] = await pool.query(`
    SELECT s.*,
      (SELECT COUNT(*) FROM purchases p WHERE p.supplier_id = s.id) AS purchase_count,
      (SELECT COALESCE(SUM(total_amount), 0) FROM purchases p WHERE p.supplier_id = s.id) AS purchase_total,
      (SELECT MAX(purchase_date) FROM purchases p WHERE p.supplier_id = s.id) AS last_purchase
    FROM suppliers s WHERE s.is_active = 1 ORDER BY s.name`);
  res.json(rows);
}));

app.post('/api/suppliers', ah(async (req, res) => {
  const p = supplierPayload(req.body || {});
  const [r] = await pool.query(
    'INSERT INTO suppliers (name, contact_person, phone, email, address) VALUES (?,?,?,?,?)',
    [p.name, p.contact_person, p.phone, p.email, p.address]);
  res.status(201).json({ id: r.insertId, ...p });
}));

app.put('/api/suppliers/:id', ah(async (req, res) => {
  const p = supplierPayload(req.body || {});
  const [r] = await pool.query(
    'UPDATE suppliers SET name=?, contact_person=?, phone=?, email=?, address=? WHERE id=? AND is_active=1',
    [p.name, p.contact_person, p.phone, p.email, p.address, req.params.id]);
  if (!r.affectedRows) throw new HttpError(404, 'That supplier no longer exists.');
  res.json({ id: Number(req.params.id), ...p });
}));

app.delete('/api/suppliers/:id', adminOnly, ah(async (req, res) => {
  await pool.query('UPDATE suppliers SET is_active = 0 WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));

/* ---------- batches & write-offs ---------- */
app.get('/api/batches', ah(async (req, res) => {
  const [rows] = await pool.query(`
    SELECT b.id, b.batch_no, b.quantity, b.cost_price, b.mfg_date, b.expiry_date, b.received_at,
           DATEDIFF(b.expiry_date, CURDATE()) AS days_left,
           m.id AS medicine_id, m.name AS medicine, m.strength, m.dosage_form, m.sku,
           sp.name AS supplier
    FROM batches b
    JOIN medicines m ON m.id = b.medicine_id
    LEFT JOIN suppliers sp ON sp.id = b.supplier_id
    WHERE b.quantity > 0 AND m.is_active = 1
    ORDER BY b.expiry_date, m.name`);
  res.json(rows);
}));

app.post('/api/batches/:id/writeoff', ah(async (req, res) => {
  const reason = str(req.body && req.body.reason, 150) || 'Written off';
  await tx(async (conn) => {
    const [[batch]] = await conn.query('SELECT id, quantity FROM batches WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!batch) throw new HttpError(404, 'That batch no longer exists.');
    if (batch.quantity === 0) throw new HttpError(409, 'This batch has no stock left.');
    await conn.query('UPDATE batches SET quantity = 0 WHERE id = ?', [batch.id]);
    await conn.query(
      'INSERT INTO stock_adjustments (batch_id, change_qty, reason, user_id) VALUES (?,?,?,?)',
      [batch.id, -batch.quantity, reason, req.user.id]);
  });
  res.json({ ok: true });
}));

/* ---------- purchases (stock in) ---------- */
app.get('/api/purchases', ah(async (req, res) => {
  const [rows] = await pool.query(`
    SELECT p.id, p.invoice_no, p.purchase_date, p.total_amount, p.notes, sp.name AS supplier,
           (SELECT COUNT(*) FROM purchase_items pi WHERE pi.purchase_id = p.id) AS line_count,
           (SELECT COALESCE(SUM(quantity), 0) FROM purchase_items pi WHERE pi.purchase_id = p.id) AS units
    FROM purchases p JOIN suppliers sp ON sp.id = p.supplier_id
    ORDER BY p.purchase_date DESC, p.id DESC LIMIT 300`);
  res.json(rows);
}));

app.get('/api/purchases/:id', ah(async (req, res) => {
  const [[p]] = await pool.query(
    `SELECT p.*, sp.name AS supplier FROM purchases p JOIN suppliers sp ON sp.id = p.supplier_id WHERE p.id = ?`,
    [req.params.id]);
  if (!p) throw new HttpError(404, 'Purchase not found.');
  const [items] = await pool.query(`
    SELECT pi.*, m.name, m.strength FROM purchase_items pi
    JOIN medicines m ON m.id = pi.medicine_id WHERE pi.purchase_id = ? ORDER BY pi.id`, [req.params.id]);
  res.json({ ...p, items });
}));

app.post('/api/purchases', ah(async (req, res) => {
  const b = req.body || {};
  const supplierId = Number(b.supplier_id);
  const items = Array.isArray(b.items) ? b.items : [];
  if (!supplierId) throw new HttpError(400, 'Choose a supplier.');
  if (!items.length) throw new HttpError(400, 'Add at least one medicine to receive.');
  const purchaseDate = isDate(b.purchase_date) ? b.purchase_date : new Date().toISOString().slice(0, 10);

  const id = await tx(async (conn) => {
    const [[sup]] = await conn.query('SELECT id FROM suppliers WHERE id = ? AND is_active = 1', [supplierId]);
    if (!sup) throw new HttpError(404, 'That supplier no longer exists.');

    const clean = items.map((it, i) => {
      const n = i + 1;
      const medicine_id = Number(it.medicine_id);
      const quantity = parseInt(it.quantity, 10);
      const cost = Number(it.cost_price);
      const batch_no = str(it.batch_no, 50);
      if (!medicine_id) throw new HttpError(400, `Line ${n}: choose a medicine.`);
      if (!batch_no) throw new HttpError(400, `Line ${n}: enter the batch number.`);
      if (!Number.isInteger(quantity) || quantity <= 0) throw new HttpError(400, `Line ${n}: quantity must be above zero.`);
      if (!Number.isFinite(cost) || cost < 0) throw new HttpError(400, `Line ${n}: enter a valid cost price.`);
      if (!isDate(it.expiry_date)) throw new HttpError(400, `Line ${n}: enter the expiry date.`);
      return { medicine_id, batch_no, quantity, cost_price: round2(cost), expiry_date: it.expiry_date,
               mfg_date: isDate(it.mfg_date) ? it.mfg_date : null };
    });
    const total = round2(clean.reduce((s, l) => s + l.quantity * l.cost_price, 0));

    const [p] = await conn.query(
      'INSERT INTO purchases (supplier_id, invoice_no, purchase_date, total_amount, notes, created_by) VALUES (?,?,?,?,?,?)',
      [supplierId, str(b.invoice_no, 50), purchaseDate, total, str(b.notes, 255), req.user.id]);

    for (const l of clean) {
      const [[med]] = await conn.query('SELECT id FROM medicines WHERE id = ? AND is_active = 1', [l.medicine_id]);
      if (!med) throw new HttpError(404, 'A medicine on this purchase no longer exists.');
      await conn.query(
        `INSERT INTO batches (medicine_id, supplier_id, purchase_id, batch_no, quantity, cost_price, mfg_date, expiry_date)
         VALUES (?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity), cost_price = VALUES(cost_price),
                                 expiry_date = VALUES(expiry_date), supplier_id = VALUES(supplier_id)`,
        [l.medicine_id, supplierId, p.insertId, l.batch_no, l.quantity, l.cost_price, l.mfg_date, l.expiry_date]);
      await conn.query(
        `INSERT INTO purchase_items (purchase_id, medicine_id, batch_no, quantity, cost_price, mfg_date, expiry_date)
         VALUES (?,?,?,?,?,?,?)`,
        [p.insertId, l.medicine_id, l.batch_no, l.quantity, l.cost_price, l.mfg_date, l.expiry_date]);
    }
    return p.insertId;
  });
  res.status(201).json({ id });
}));

/* ---------- sales (point of sale) ---------- */
async function getSale(id, db = pool) {
  const [[sale]] = await db.query(
    `SELECT s.*, u.full_name AS sold_by_name FROM sales s LEFT JOIN users u ON u.id = s.sold_by WHERE s.id = ?`, [id]);
  if (!sale) return null;
  const [items] = await db.query(`
    SELECT si.quantity, si.unit_price, si.gst_percent, si.line_total, m.name, m.strength, b.batch_no, b.expiry_date
    FROM sale_items si
    JOIN medicines m ON m.id = si.medicine_id
    JOIN batches b ON b.id = si.batch_id
    WHERE si.sale_id = ? ORDER BY si.id`, [id]);
  sale.items = items;
  return sale;
}

app.get('/api/sales', ah(async (req, res) => {
  const from = isDate(req.query.from) ? req.query.from : null;
  const to = isDate(req.query.to) ? req.query.to : null;
  const [rows] = await pool.query(`
    SELECT s.id, s.invoice_no, s.customer_name, s.payment_method, s.subtotal, s.tax, s.discount, s.total, s.created_at,
           (SELECT COALESCE(SUM(quantity), 0) FROM sale_items WHERE sale_id = s.id) AS units
    FROM sales s
    WHERE DATE(s.created_at) >= COALESCE(?, DATE_SUB(CURDATE(), INTERVAL 30 DAY))
      AND DATE(s.created_at) <= COALESCE(?, CURDATE())
    ORDER BY s.created_at DESC, s.id DESC LIMIT 1000`, [from, to]);
  res.json(rows);
}));

app.get('/api/sales/:id', ah(async (req, res) => {
  const sale = await getSale(req.params.id);
  if (!sale) throw new HttpError(404, 'Sale not found.');
  res.json(sale);
}));

app.post('/api/sales', ah(async (req, res) => {
  const b = req.body || {};
  const items = Array.isArray(b.items) ? b.items : [];
  if (!items.length) throw new HttpError(400, 'Add at least one medicine to the sale.');
  const method = ['Cash', 'UPI', 'Card'].includes(b.payment_method) ? b.payment_method : 'Cash';
  const discountPct = Math.min(100, Math.max(0, Number(b.discount_percent) || 0));

  const saleId = await tx(async (conn) => {
    // Merge repeated medicines into one requested quantity
    const wanted = new Map();
    for (const it of items) {
      const id = Number(it.medicine_id);
      const qty = parseInt(it.quantity, 10);
      if (!id || !Number.isInteger(qty) || qty <= 0) throw new HttpError(400, 'Each item needs a medicine and a quantity above zero.');
      wanted.set(id, (wanted.get(id) || 0) + qty);
    }

    const lines = [];
    let subtotal = 0, tax = 0;
    for (const [medId, qty] of wanted) {
      const [[med]] = await conn.query(
        'SELECT id, name, strength, unit_price, gst_percent FROM medicines WHERE id = ? AND is_active = 1', [medId]);
      if (!med) throw new HttpError(404, 'A medicine in this sale no longer exists.');

      // First-expiry-first-out: lock sellable batches, earliest expiry first
      const [batches] = await conn.query(
        `SELECT id, quantity FROM batches
         WHERE medicine_id = ? AND quantity > 0 AND expiry_date >= CURDATE()
         ORDER BY expiry_date, id FOR UPDATE`, [medId]);

      let remaining = qty;
      const allocations = [];
      for (const bt of batches) {
        if (remaining <= 0) break;
        const take = Math.min(bt.quantity, remaining);
        allocations.push({ batch_id: bt.id, qty: take });
        remaining -= take;
      }
      if (remaining > 0) {
        throw new HttpError(409,
          `Not enough stock for ${med.name}${med.strength ? ' ' + med.strength : ''}: ${qty - remaining} available, ${qty} requested.`);
      }
      for (const a of allocations) {
        const lineTotal = round2(a.qty * med.unit_price);
        subtotal += lineTotal;
        tax += (lineTotal * med.gst_percent) / 100;
        lines.push({ medicine_id: medId, batch_id: a.batch_id, quantity: a.qty,
                     unit_price: med.unit_price, gst_percent: med.gst_percent, line_total: lineTotal });
      }
    }

    subtotal = round2(subtotal);
    tax = round2(tax);
    const discount = round2(((subtotal + tax) * discountPct) / 100);
    const total = round2(subtotal + tax - discount);

    const [s] = await conn.query(
      `INSERT INTO sales (invoice_no, customer_name, customer_phone, payment_method, subtotal, tax, discount, total, sold_by)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [`TMP-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, str(b.customer_name, 100) || 'Walk-in',
       str(b.customer_phone, 30), method, subtotal, tax, discount, total, req.user.id]);
    await conn.query('UPDATE sales SET invoice_no = ? WHERE id = ?', [`INV-${String(s.insertId).padStart(6, '0')}`, s.insertId]);

    for (const l of lines) {
      await conn.query(
        `INSERT INTO sale_items (sale_id, medicine_id, batch_id, quantity, unit_price, gst_percent, line_total)
         VALUES (?,?,?,?,?,?,?)`,
        [s.insertId, l.medicine_id, l.batch_id, l.quantity, l.unit_price, l.gst_percent, l.line_total]);
      await conn.query('UPDATE batches SET quantity = quantity - ? WHERE id = ?', [l.quantity, l.batch_id]);
    }
    return s.insertId;
  });

  res.status(201).json(await getSale(saleId));
}));

/* ---------- static front end + errors ---------- */
app.use('/api', (req, res) => res.status(404).json({ error: 'Unknown API route.' }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'That value is already in use, for example a SKU already assigned to another medicine.' });
  }
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'The request could not be read.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server. Check the server log for details.' });
});

/* ---------- start ---------- */
async function ensureAdmin() {
  const [[row]] = await pool.query('SELECT COUNT(*) AS n FROM users');
  if (row.n === 0) {
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10);
    await pool.query(
      "INSERT INTO users (full_name, username, password_hash, role) VALUES ('Admin', 'admin', ?, 'admin')", [hash]);
    console.log('Created first admin account (username: admin).');
  }
}

(async () => {
  try {
    await pool.query('SELECT 1');
    await ensureAdmin();
    app.listen(PORT, () => console.log(`Medstock is running at http://localhost:${PORT}`));
  } catch (err) {
    console.error('\nCould not start. Check your MySQL settings in backend/.env and that schema.sql has been run.\n');
    console.error(err.message);
    process.exit(1);
  }
})();
