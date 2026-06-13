require('dotenv').config();
const express = require('express');
const path = require('path');
const pool = require('./db');

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

// ─── JEFES ────────────────────────────────────────────────────────────────────
app.get('/api/jefes', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM jefe ORDER BY id_jefe');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/jefes', async (req, res) => {
  try {
    const { numero, nombre, telefono } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO jefe (numero_jefe, nombre_jefe, telefono_jefe)
       VALUES ($1, $2, $3) RETURNING *`,
      [numero, nombre, telefono || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/jefes/:id', async (req, res) => {
  try {
    const { numero, nombre, telefono } = req.body;
    const { rows } = await pool.query(
      `UPDATE jefe SET numero_jefe=$1, nombre_jefe=$2, telefono_jefe=$3
       WHERE id_jefe=$4 RETURNING *`,
      [numero, nombre, telefono || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Jefe no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/jefes/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM jefe WHERE id_jefe=$1', [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Jefe no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PRODUCTOS ────────────────────────────────────────────────────────────────
app.get('/api/productos', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, j.nombre_jefe
      FROM producto p
      JOIN jefe j ON p.id_jefe = j.id_jefe
      ORDER BY p.codigo_producto
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/productos/:codigo', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM producto WHERE codigo_producto = $1',
      [req.params.codigo]
    );
    if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/productos', async (req, res) => {
  try {
    const { codigo, nombre, costo, precio, stock, id_jefe } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO producto (codigo_producto, nombre_producto, costo_adquisicion, precio_venta, stock_producto, id_jefe)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [codigo, nombre, costo, precio, stock ?? 0, id_jefe]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/productos/:codigo', async (req, res) => {
  try {
    const { nombre, costo, precio, stock, id_jefe } = req.body;
    const { rows } = await pool.query(
      `UPDATE producto
       SET nombre_producto=$1, costo_adquisicion=$2, precio_venta=$3,
           stock_producto=$4, id_jefe=$5
       WHERE codigo_producto=$6 RETURNING *`,
      [nombre, costo, precio, stock, id_jefe, req.params.codigo]
    );
    if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CLIENTES ─────────────────────────────────────────────────────────────────
app.get('/api/clientes', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM cliente ORDER BY nit_cliente');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/clientes', async (req, res) => {
  try {
    const { nit, nombre } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO cliente (nit_cliente, nombre_cliente)
       VALUES ($1, $2)
       ON CONFLICT (nit_cliente) DO UPDATE SET nombre_cliente = EXCLUDED.nombre_cliente
       RETURNING *`,
      [nit, nombre]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── VENTAS ───────────────────────────────────────────────────────────────────
app.get('/api/ventas', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT v.*, c.nombre_cliente
      FROM venta v
      LEFT JOIN cliente c ON v.nit_cliente = c.nit_cliente
      ORDER BY v.fecha_venta DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/ventas/:id', async (req, res) => {
  try {
    const ventaQ = await pool.query(
      `SELECT v.*, c.nombre_cliente
       FROM venta v
       LEFT JOIN cliente c ON v.nit_cliente = c.nit_cliente
       WHERE v.id_venta = $1`,
      [req.params.id]
    );
    if (!ventaQ.rows.length) return res.status(404).json({ error: 'Venta no encontrada' });

    const detalleQ = await pool.query(
      'SELECT * FROM detalle_venta WHERE id_venta = $1',
      [req.params.id]
    );

    res.json({ ...ventaQ.rows[0], detalle: detalleQ.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ventas', async (req, res) => {
  const { nit_cliente, efectivo, items } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const productos = [];
    for (const item of items) {
      const { rows } = await client.query(
        'SELECT * FROM producto WHERE codigo_producto = $1',
        [item.codigo]
      );
      if (!rows.length) throw new Error(`Producto ${item.codigo} no existe`);
      if (rows[0].stock_producto < item.cantidad)
        throw new Error(`Stock insuficiente para ${rows[0].nombre_producto}`);
      productos.push({ ...rows[0], cantidad: item.cantidad });
    }

    const total = productos.reduce((s, p) => s + p.precio_venta * p.cantidad, 0);
    const cambio = efectivo - total;
    if (cambio < 0) throw new Error('Efectivo insuficiente');

    const ventaRes = await client.query(
      `INSERT INTO venta (nit_cliente, total_venta, efectivo_recibido, cambio_venta)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [nit_cliente || 'CF', total, efectivo, cambio]
    );
    const venta = ventaRes.rows[0];

    for (const p of productos) {
      await client.query(
        `INSERT INTO detalle_venta (id_venta, codigo_producto, nombre_producto, cantidad, precio_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [venta.id_venta, p.codigo_producto, p.nombre_producto, p.cantidad, p.precio_venta, p.precio_venta * p.cantidad]
      );
      await client.query(
        'UPDATE producto SET stock_producto = stock_producto - $1 WHERE codigo_producto = $2',
        [p.cantidad, p.codigo_producto]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ ...venta, detalle: productos });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─── START ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));