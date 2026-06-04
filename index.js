require('dotenv').config();
const express = require('express');
const path = require('path');
const pool = require('./db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── JEFES ────────────────────────────────────────────────────────────────────
app.get('/api/jefes', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM JEFE ORDER BY ID_Jefe');
  res.json(rows);
});

app.post('/api/jefes', async (req, res) => {
  const { numero, nombre, telefono } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO JEFE (Numero_Jefe, Nombre_Jefe, Telefono_Jefe)
     VALUES ($1, $2, $3) RETURNING *`,
    [numero, nombre, telefono || null]
  );
  res.status(201).json(rows[0]);
});

app.put('/api/jefes/:id', async (req, res) => {
  const { numero, nombre, telefono } = req.body;
  const { rows } = await pool.query(
    `UPDATE JEFE SET Numero_Jefe=$1, Nombre_Jefe=$2, Telefono_Jefe=$3
     WHERE ID_Jefe=$4 RETURNING *`,
    [numero, nombre, telefono || null, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Jefe no encontrado' });
  res.json(rows[0]);
});

app.delete('/api/jefes/:id', async (req, res) => {
  const { rowCount } = await pool.query(
    'DELETE FROM JEFE WHERE ID_Jefe=$1', [req.params.id]
  );
  if (!rowCount) return res.status(404).json({ error: 'Jefe no encontrado' });
  res.json({ ok: true });
});

// ─── PRODUCTOS ────────────────────────────────────────────────────────────────
app.get('/api/productos', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT p.*, j.Nombre_Jefe
    FROM PRODUCTO p
    JOIN JEFE j ON p.ID_Jefe = j.ID_Jefe
    ORDER BY p.Codigo_Producto
  `);
  res.json(rows);
});

app.post('/api/productos', async (req, res) => {
  const { codigo, nombre, costo, precio, stock, id_jefe } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO PRODUCTO (Codigo_Producto, Nombre_Producto, Costo_Adquisicion, Precio_Venta, Stock_Producto, ID_Jefe)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [codigo, nombre, costo, precio, stock ?? 0, id_jefe]
  );
  res.status(201).json(rows[0]);
});

app.put('/api/productos/:codigo', async (req, res) => {
  const { nombre, costo, precio, stock, id_jefe } = req.body;
  const { rows } = await pool.query(
    `UPDATE PRODUCTO
     SET Nombre_Producto=$1, Costo_Adquisicion=$2, Precio_Venta=$3,
         Stock_Producto=$4, ID_Jefe=$5
     WHERE Codigo_Producto=$6 RETURNING *`,
    [nombre, costo, precio, stock, id_jefe, req.params.codigo]
  );
  if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(rows[0]);
});

app.get('/api/productos/:codigo', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM PRODUCTO WHERE Codigo_Producto = $1',
    [req.params.codigo]
  );
  if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(rows[0]);
});

// ─── CLIENTES ─────────────────────────────────────────────────────────────────
app.get('/api/clientes', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM CLIENTE ORDER BY NIT_Cliente');
  res.json(rows);
});

app.post('/api/clientes', async (req, res) => {
  const { nit, nombre } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO CLIENTE (NIT_Cliente, Nombre_Cliente) VALUES ($1, $2) ON CONFLICT (NIT_Cliente) DO UPDATE SET Nombre_Cliente = EXCLUDED.Nombre_Cliente RETURNING *',
    [nit, nombre]
  );
  res.status(201).json(rows[0]);
});

// ─── VENTAS ───────────────────────────────────────────────────────────────────
app.get('/api/ventas', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT v.*, c.Nombre_Cliente
    FROM VENTA v
    LEFT JOIN CLIENTE c ON v.NIT_Cliente = c.NIT_Cliente
    ORDER BY v.Fecha_Venta DESC
  `);
  res.json(rows);
});

app.get('/api/ventas/:id', async (req, res) => {
  const ventaQ = await pool.query(
    `SELECT v.*, c.Nombre_Cliente
     FROM VENTA v
     LEFT JOIN CLIENTE c ON v.NIT_Cliente = c.NIT_Cliente
     WHERE v.ID_Venta = $1`,
    [req.params.id]
  );
  if (!ventaQ.rows.length) return res.status(404).json({ error: 'Venta no encontrada' });

  const detalleQ = await pool.query(
    'SELECT * FROM DETALLE_VENTA WHERE ID_Venta = $1',
    [req.params.id]
  );

  res.json({ ...ventaQ.rows[0], detalle: detalleQ.rows });
});

app.post('/api/ventas', async (req, res) => {
  const { nit_cliente, efectivo, items } = req.body;
  // items: [{ codigo, cantidad }]

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify stock and gather prices
    const productos = [];
    for (const item of items) {
      const { rows } = await client.query(
        'SELECT * FROM PRODUCTO WHERE Codigo_Producto = $1',
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
      `INSERT INTO VENTA (NIT_Cliente, Total_Venta, Efectivo_Recibido, Cambio_Venta)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [nit_cliente || 'CF', total, efectivo, cambio]
    );
    const venta = ventaRes.rows[0];

    for (const p of productos) {
      await client.query(
        `INSERT INTO DETALLE_VENTA (ID_Venta, Codigo_Producto, Nombre_Producto, Cantidad, Precio_Unitario, Subtotal)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [venta.id_venta, p.codigo_producto, p.nombre_producto, p.cantidad, p.precio_venta, p.precio_venta * p.cantidad]
      );
      await client.query(
        'UPDATE PRODUCTO SET Stock_Producto = Stock_Producto - $1 WHERE Codigo_Producto = $2',
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
