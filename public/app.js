const API = '';
let carrito = [];
let modoProducto = 'crear';   // 'crear' | 'editar'
let codigoEditando = null;
let modoJefe = 'crear';       // 'crear' | 'editar'
let idJefeEditando = null;

// ─── NAVEGACIÓN ──────────────────────────────────────────────────────────────
function mostrarSeccion(id) {
  document.querySelectorAll('.seccion').forEach(s => s.classList.add('oculto'));
  document.getElementById(id).classList.remove('oculto');

  if (id === 'productos')    cargarProductos();
  if (id === 'responsables') cargarJefes();
  if (id === 'ventas')       cargarVentas();
  if (id === 'nueva-venta')  renderCarrito();
}

// ─── PRODUCTOS ────────────────────────────────────────────────────────────────
async function cargarProductos() {
  const { data } = await axios.get(`${API}/api/productos`);
  const cont = document.getElementById('lista-productos');
  cont.innerHTML = data.map(p => `
    <div class="card">
      <h3>${p.nombre_producto}</h3>
      <div class="codigo">${p.codigo_producto}</div>
      <div class="precio">Q ${Number(p.precio_venta).toFixed(2)}</div>
      <div class="stock">Stock: ${p.stock_producto} u.</div>
      <div class="jefe">Resp: ${p.nombre_jefe}</div>
      <button class="btn-editar" onclick="abrirEditarProducto('${p.codigo_producto}')">Editar</button>
    </div>
  `).join('');
}

// ── abrir modal en modo CREAR
async function abrirModalProducto() {
  modoProducto = 'crear';
  codigoEditando = null;
  document.getElementById('titulo-modal-producto').textContent = 'Agregar Producto';
  document.getElementById('np-codigo').disabled = false;
  document.getElementById('np-codigo').value = '';
  document.getElementById('np-nombre').value = '';
  document.getElementById('np-costo').value = '';
  document.getElementById('np-precio').value = '';
  document.getElementById('np-stock').value = 0;
  document.getElementById('msg-producto').textContent = '';
  await poblarSelectJefes('np-jefe');
  document.getElementById('modal-producto').classList.remove('oculto');
}

// ── abrir modal en modo EDITAR
async function abrirEditarProducto(codigo) {
  modoProducto = 'editar';
  codigoEditando = codigo;
  document.getElementById('titulo-modal-producto').textContent = 'Editar Producto';
  document.getElementById('msg-producto').textContent = '';

  const { data: p } = await axios.get(`${API}/api/productos/${codigo}`);
  await poblarSelectJefes('np-jefe', p.id_jefe);

  document.getElementById('np-codigo').value = p.codigo_producto;
  document.getElementById('np-codigo').disabled = true;
  document.getElementById('np-nombre').value = p.nombre_producto;
  document.getElementById('np-costo').value = p.costo_adquisicion;
  document.getElementById('np-precio').value = p.precio_venta;
  document.getElementById('np-stock').value = p.stock_producto;
  document.getElementById('modal-producto').classList.remove('oculto');
}

function cerrarModalProducto() {
  document.getElementById('modal-producto').classList.add('oculto');
  document.getElementById('np-codigo').disabled = false;
}

async function guardarProducto() {
  const msg = document.getElementById('msg-producto');
  const payload = {
    codigo:   document.getElementById('np-codigo').value.trim().toUpperCase(),
    nombre:   document.getElementById('np-nombre').value.trim(),
    costo:    parseFloat(document.getElementById('np-costo').value),
    precio:   parseFloat(document.getElementById('np-precio').value),
    stock:    parseInt(document.getElementById('np-stock').value) || 0,
    id_jefe:  parseInt(document.getElementById('np-jefe').value),
  };

  if (!payload.nombre || isNaN(payload.costo) || isNaN(payload.precio)) {
    msg.style.color = '#e53e3e';
    msg.textContent = 'Completa todos los campos obligatorios.';
    return;
  }

  try {
    if (modoProducto === 'crear') {
      if (!payload.codigo) { msg.style.color='#e53e3e'; msg.textContent='El código es obligatorio.'; return; }
      await axios.post(`${API}/api/productos`, payload);
    } else {
      await axios.put(`${API}/api/productos/${codigoEditando}`, payload);
    }
    cerrarModalProducto();
    cargarProductos();
  } catch (err) {
    msg.style.color = '#e53e3e';
    msg.textContent = err.response?.data?.error || 'Error al guardar producto';
  }
}

// ─── RESPONSABLES (JEFES) ────────────────────────────────────────────────────
async function cargarJefes() {
  const { data } = await axios.get(`${API}/api/jefes`);
  const tbody = document.getElementById('cuerpo-jefes');
  tbody.innerHTML = data.map(j => `
    <tr>
      <td>${j.id_jefe}</td>
      <td>${j.numero_jefe}</td>
      <td>${j.nombre_jefe}</td>
      <td>${j.telefono_jefe || '—'}</td>
      <td class="acciones">
        <button onclick="abrirEditarJefe(${j.id_jefe},'${esc(j.numero_jefe)}','${esc(j.nombre_jefe)}','${esc(j.telefono_jefe||'')}')">Editar</button>
        <button class="btn-eliminar" onclick="eliminarJefe(${j.id_jefe})">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

// ── abrir modal en modo CREAR
function abrirModalJefe() {
  modoJefe = 'crear';
  idJefeEditando = null;
  document.getElementById('titulo-modal-jefe').textContent = 'Agregar Responsable';
  document.getElementById('nj-numero').value = '';
  document.getElementById('nj-nombre').value = '';
  document.getElementById('nj-telefono').value = '';
  document.getElementById('msg-jefe').textContent = '';
  document.getElementById('modal-jefe').classList.remove('oculto');
}

// ── abrir modal en modo EDITAR
function abrirEditarJefe(id, numero, nombre, telefono) {
  modoJefe = 'editar';
  idJefeEditando = id;
  document.getElementById('titulo-modal-jefe').textContent = 'Editar Responsable';
  document.getElementById('nj-numero').value = numero;
  document.getElementById('nj-nombre').value = nombre;
  document.getElementById('nj-telefono').value = telefono;
  document.getElementById('msg-jefe').textContent = '';
  document.getElementById('modal-jefe').classList.remove('oculto');
}

function cerrarModalJefe() {
  document.getElementById('modal-jefe').classList.add('oculto');
}

async function guardarJefe() {
  const msg = document.getElementById('msg-jefe');
  const payload = {
    numero:   document.getElementById('nj-numero').value.trim(),
    nombre:   document.getElementById('nj-nombre').value.trim(),
    telefono: document.getElementById('nj-telefono').value.trim(),
  };

  if (!payload.numero || !payload.nombre) {
    msg.style.color = '#e53e3e';
    msg.textContent = 'Número y nombre son obligatorios.';
    return;
  }

  try {
    if (modoJefe === 'crear') {
      await axios.post(`${API}/api/jefes`, payload);
    } else {
      await axios.put(`${API}/api/jefes/${idJefeEditando}`, payload);
    }
    cerrarModalJefe();
    cargarJefes();
  } catch (err) {
    msg.style.color = '#e53e3e';
    msg.textContent = err.response?.data?.error || 'Error al guardar';
  }
}

async function eliminarJefe(id) {
  if (!confirm('¿Eliminar este responsable? Solo es posible si no tiene productos asignados.')) return;
  try {
    await axios.delete(`${API}/api/jefes/${id}`);
    cargarJefes();
  } catch (err) {
    alert(err.response?.data?.error || 'No se pudo eliminar');
  }
}

// ─── UTILIDADES ───────────────────────────────────────────────────────────────
function esc(str) { return String(str).replace(/'/g, "\\'"); }

async function poblarSelectJefes(selectId, seleccionado) {
  const { data: jefes } = await axios.get(`${API}/api/jefes`);
  const sel = document.getElementById(selectId);
  sel.innerHTML = jefes.map(j =>
    `<option value="${j.id_jefe}" ${j.id_jefe === seleccionado ? 'selected' : ''}>${j.nombre_jefe}</option>`
  ).join('');
}

// ─── CARRITO ──────────────────────────────────────────────────────────────────
async function agregarItem() {
  const codigo   = document.getElementById('cod-producto').value.trim().toUpperCase();
  const cantidad = parseInt(document.getElementById('cant-producto').value) || 1;
  if (!codigo) return;

  try {
    const { data } = await axios.get(`${API}/api/productos/${codigo}`);
    const existente = carrito.find(i => i.codigo === codigo);
    if (existente) {
      existente.cantidad += cantidad;
    } else {
      carrito.push({ codigo: data.codigo_producto, nombre: data.nombre_producto, precio: data.precio_venta, cantidad });
    }
    document.getElementById('cod-producto').value = '';
    document.getElementById('cant-producto').value = 1;
    renderCarrito();
  } catch {
    alert('Producto no encontrado');
  }
}

function quitarItem(codigo) {
  carrito = carrito.filter(i => i.codigo !== codigo);
  renderCarrito();
}

function renderCarrito() {
  const tbody = document.getElementById('cuerpo-carrito');
  tbody.innerHTML = carrito.map(i => `
    <tr>
      <td>${i.codigo}</td>
      <td>${i.nombre}</td>
      <td>Q ${Number(i.precio).toFixed(2)}</td>
      <td>${i.cantidad}</td>
      <td>Q ${(i.precio * i.cantidad).toFixed(2)}</td>
      <td><button onclick="quitarItem('${i.codigo}')">✕</button></td>
    </tr>
  `).join('');

  const total = carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);
  document.getElementById('total-venta').textContent = `Q ${total.toFixed(2)}`;
  calcularCambio();
}

function calcularCambio() {
  const total    = carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const efectivo = parseFloat(document.getElementById('efectivo').value) || 0;
  const cambio   = efectivo - total;
  document.getElementById('cambio-venta').textContent =
    `Q ${cambio >= 0 ? cambio.toFixed(2) : '---'}`;
}

// ─── REGISTRAR VENTA ─────────────────────────────────────────────────────────
async function registrarVenta() {
  if (!carrito.length) return;
  const efectivo = parseFloat(document.getElementById('efectivo').value);
  const total    = carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const msg      = document.getElementById('msg-venta');

  if (isNaN(efectivo) || efectivo < total) {
    msg.style.color = '#e53e3e';
    msg.textContent = 'Efectivo insuficiente o no ingresado.';
    return;
  }

  const payload = {
    nit_cliente: document.getElementById('nit-cliente').value.trim() || 'CF',
    efectivo,
    items: carrito.map(i => ({ codigo: i.codigo, cantidad: i.cantidad })),
  };

  try {
    const { data } = await axios.post(`${API}/api/ventas`, payload);
    msg.style.color = '#2f855a';
    msg.textContent = `Venta #${data.id_venta} registrada. Cambio: Q ${Number(data.cambio_venta).toFixed(2)}`;
    carrito = [];
    document.getElementById('efectivo').value = '';
    document.getElementById('nit-cliente').value = '';
    renderCarrito();
  } catch (err) {
    msg.style.color = '#e53e3e';
    msg.textContent = err.response?.data?.error || 'Error al registrar venta';
  }
}

// ─── HISTORIAL ───────────────────────────────────────────────────────────────
async function cargarVentas() {
  const { data } = await axios.get(`${API}/api/ventas`);
  const tbody = document.getElementById('cuerpo-ventas');
  tbody.innerHTML = data.map(v => `
    <tr>
      <td>${v.id_venta}</td>
      <td>${new Date(v.fecha_venta).toLocaleString('es-GT')}</td>
      <td>${v.nombre_cliente || v.nit_cliente}</td>
      <td>Q ${Number(v.total_venta).toFixed(2)}</td>
      <td>Q ${Number(v.efectivo_recibido).toFixed(2)}</td>
      <td>Q ${Number(v.cambio_venta).toFixed(2)}</td>
      <td><button onclick="verDetalle(${v.id_venta})">Ver</button></td>
    </tr>
  `).join('');
}

async function verDetalle(id) {
  const { data } = await axios.get(`${API}/api/ventas/${id}`);
  const cuerpo = document.getElementById('modal-cuerpo');
  cuerpo.innerHTML = `
    <p><strong>Cliente:</strong> ${data.nombre_cliente || data.nit_cliente}</p>
    <p><strong>Fecha:</strong> ${new Date(data.fecha_venta).toLocaleString('es-GT')}</p>
    <table>
      <thead><tr><th>Producto</th><th>Precio</th><th>Cant.</th><th>Subtotal</th></tr></thead>
      <tbody>
        ${data.detalle.map(d => `
          <tr>
            <td>${d.nombre_producto}</td>
            <td>Q ${Number(d.precio_unitario).toFixed(2)}</td>
            <td>${d.cantidad}</td>
            <td>Q ${Number(d.subtotal).toFixed(2)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <p style="margin-top:.75rem"><strong>Total:</strong> Q ${Number(data.total_venta).toFixed(2)}</p>
    <p><strong>Efectivo:</strong> Q ${Number(data.efectivo_recibido).toFixed(2)}</p>
    <p><strong>Cambio:</strong> Q ${Number(data.cambio_venta).toFixed(2)}</p>
  `;
  document.getElementById('modal').classList.remove('oculto');
}

function cerrarModal() {
  document.getElementById('modal').classList.add('oculto');
}

// ─── INICIO ──────────────────────────────────────────────────────────────────
mostrarSeccion('productos');
