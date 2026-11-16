# LibroYa

Tienda en línea de libros físicos y electrónicos con gestión de catálogo, inventario, pagos con PayPal Sandbox y seguimiento de envíos en tiempo real.

**Proyecto académico — Fundamentos de Sistemas de Información, Universidad de Antioquia, 2026-2.**

---

## Arquitectura

```
libroya/
├── web/      Next.js 14 (App Router) — Solo interfaz de usuario
└── server/   Node.js + Express + Socket.IO + Mongoose — APIs REST y WebSockets
```

- Frontend en el puerto **3000**, backend en el puerto **4000**.
- Base de datos: **MongoDB Atlas** (Mongoose).
- Autenticación: **JWT** (Bearer token en `localStorage`).
- Pagos: **PayPal Orders API v2 (Sandbox)**.

> **Limitación conocida:** Socket.IO no usa un adaptador de Redis, por lo que solo funciona correctamente con una única instancia del servidor. En un entorno de múltiples instancias se necesitaría `@socket.io/redis-adapter`.

---

## Prerrequisitos

- Node.js ≥ 20.0.0
- npm ≥ 10
- Una cuenta en [MongoDB Atlas](https://www.mongodb.com/atlas) con un cluster activo
- Una app en [PayPal Developer](https://developer.paypal.com/) (Sandbox)

---

## Configuración de variables de entorno

### Backend (`server/.env`)

Copia `server/.env.example` a `server/.env` y completa:

```env
MONGODB_URI=mongodb+srv://<usuario>:<contraseña>@cluster.mongodb.net/libroya
JWT_SECRET=una_cadena_aleatoria_larga_y_segura
JWT_EXPIRES_IN=1d
CLIENT_ORIGIN=http://localhost:3000
PORT=4000
PAYPAL_CLIENT_ID=tu_client_id_de_sandbox
PAYPAL_CLIENT_SECRET=tu_client_secret_de_sandbox
PAYPAL_API_BASE=https://api-m.sandbox.paypal.com
```

### Frontend (`web/.env.local`)

Copia `web/.env.example` a `web/.env.local` y completa:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_PAYPAL_CLIENT_ID=tu_client_id_de_sandbox
```

---

## Instalación

```bash
# Backend
cd server
npm install

# Frontend
cd ../web
npm install
```

---

## Ejecución en desarrollo

Abre dos terminales:

```bash
# Terminal 1 — Backend
cd server
npm run dev
# → http://localhost:4000

# Terminal 2 — Frontend
cd web
npm run dev
# → http://localhost:3000
```

Verifica que el backend está vivo:
```bash
curl http://localhost:4000/health
# {"status":"ok"}
```

---

## Seed de datos de prueba

*(Disponible a partir de la Entrega 5)*

```bash
cd server
npm run seed
```

Crea:
- Admin: `admin@libroya.com`
- Cliente: `cliente@libroya.com`
- ≥ 16 libros mezclando categorías y formatos

---

## Pruebas automatizadas

```bash
cd server
npm test
```

Ejecuta Vitest + Supertest contra una base de datos `libroya-test` aislada.

---

## Credenciales de demo

| Rol | Email | Contraseña |
|-----|-------|------------|
| Administrador | `admin@libroya.com` | Definida en `seed.js` |
| Cliente | `cliente@libroya.com` | Definida en `seed.js` |

---

## Entregas

| # | Nombre | Estado |
|---|--------|--------|
| 1 | Estructura base y autenticación | ✅ Completa |
| 2 | Catálogo, stock y carrito | ✅ Completa |
| 3 | Pedidos y pagos con PayPal | 🔜 Pendiente |
| 4 | WebSockets y tablero Kanban | 🔜 Pendiente |
| 5 | Seed, pruebas y README completo | 🔜 Pendiente |

---

## Solución de problemas

### Error `querySrv ECONNREFUSED` con URI `mongodb+srv://` en Windows / Node 24

**Síntoma:** El servidor arranca pero falla al conectar con MongoDB Atlas y lanza:

```
MongooseServerSelectionError: querySrv ECONNREFUSED _mongodb._tcp.<cluster>.mongodb.net
```

**Causa:** En Windows con Node.js 24, las consultas DNS SRV (que usa el esquema `mongodb+srv://`) son rechazadas por el resolver del sistema operativo en ciertos entornos.

**Solución:** Usa la cadena de conexión **Legacy** (`mongodb://`) con los tres hosts del replica set explícitos y `authSource=admin`. La encontrarás en MongoDB Atlas → Connect → Drivers → selecciona "Legacy connection string":

```
mongodb://usuario:contraseña@shard-00-00.xxxxx.mongodb.net:27017,shard-00-01.xxxxx.mongodb.net:27017,shard-00-02.xxxxx.mongodb.net:27017/?ssl=true&replicaSet=atlas-xxxxx-shard-0&authSource=admin&retryWrites=true&w=majority
```

Pega esa cadena completa en `server/.env` como valor de `MONGODB_URI`.

