# LibroYa — Requisitos del sistema

Tienda en línea de libros **físicos y electrónicos** con gestión de catálogo, inventario (stock), pagos con PayPal Sandbox y seguimiento de envíos en tiempo real.

Proyecto académico — Fundamentos de Sistemas de Información, Universidad de Antioquia, 2026-2.

---

## 1. Problema y contexto

Una librería independiente quiere vender en línea dos tipos de producto:

- **Libros físicos:** tienen inventario limitado (stock) y deben enviarse a una dirección.
- **Libros electrónicos (ebooks):** no tienen stock ni envío; tras el pago, el cliente obtiene acceso de descarga en su biblioteca personal.

El administrador necesita mantener el catálogo y el stock al día y despachar los pedidos físicos siguiendo su estado en un tablero visual. El cliente necesita saber en todo momento en qué va su envío sin tener que recargar la página.

---

## 2. Actores y roles

| Rol | Valor en BD | Qué puede hacer |
|-----|-------------|-----------------|
| Visitante | — (sin sesión) | Ver el catálogo y el detalle de un libro. No puede comprar. |
| Cliente | `cliente` | Registrarse, iniciar sesión, explorar catálogo, gestionar carrito, ingresar dirección de envío, pagar con PayPal, ver historial de pedidos con estado del envío en tiempo real y descargar sus ebooks comprados. |
| Administrador | `admin` | Gestionar el catálogo (crear, editar, desactivar libros), ajustar stock, ver alertas de stock bajo y operar el tablero Kanban de envíos. |

Reglas:
- El registro público **siempre** crea usuarios con rol `cliente`. El rol lo asigna el servidor, nunca el navegador.
- El usuario `admin` solo se crea mediante el script de seed.

---

## 3. Arquitectura obligatoria

Monorepo con dos aplicaciones separadas:

```
libroya/
├── web/      Next.js (App Router) — SOLO interfaz de usuario
└── server/   Node.js + Express + Socket.IO + Mongoose — TODAS las APIs REST y los WebSockets
```

- **Todas** las rutas de API y los WebSockets viven en el backend Express. No usar route handlers de Next.js para lógica de negocio.
- Socket.IO corre en el **mismo proceso** que Express.
- Base de datos: **MongoDB Atlas** mediante Mongoose.
- Autenticación con **JWT** emitido por el backend; contraseñas con hash (bcrypt).
- Pagos con **PayPal Orders API v2 (Sandbox)** llamada desde el backend.
- Frontend en el puerto **3000**, backend en el puerto **4000** (en producción, `process.env.PORT`).
- El backend expone `GET /health` que responde estado sin revelar configuración.

---

## 4. Modelo de datos (colecciones de MongoDB)

### 4.1 `users`
| Campo | Tipo | Reglas |
|-------|------|--------|
| name | string | requerido |
| email | string | requerido, único, en minúsculas |
| passwordHash | string | requerido; nunca se devuelve en respuestas |
| role | string | `cliente` \| `admin` |
| createdAt / updatedAt | date | timestamps automáticos |

### 4.2 `books`
| Campo | Tipo | Reglas |
|-------|------|--------|
| title | string | requerido |
| author | string | requerido |
| isbn | string | opcional, único si existe |
| description | string | |
| category | string | ej.: Novela, Ciencia, Historia, Infantil, Tecnología, Poesía |
| format | string | `fisico` \| `ebook` |
| price | number | positivo, en **USD** |
| coverUrl | string | URL de la portada |
| stock | number | entero ≥ 0. **Solo aplica a `fisico`**; en `ebook` se ignora |
| lowStockThreshold | number | por defecto 3; si `stock <= lowStockThreshold` se muestra alerta |
| ebookFileUrl | string | solo `ebook`; **nunca** se devuelve en el catálogo público, solo al comprador tras el pago |
| active | boolean | por defecto `true`; desactivar en lugar de borrar |
| createdAt / updatedAt | date | timestamps |

### 4.3 `orders`
| Campo | Tipo | Reglas |
|-------|------|--------|
| userId | ObjectId → users | dueño del pedido |
| items | array | `{ bookId, title, format, unitPrice, quantity }` — `title` y `unitPrice` son una **copia** tomada al crear el pedido |
| hasPhysical | boolean | true si al menos un ítem es `fisico` |
| shippingAddress | object | `{ fullName, street, city, phone, notes }` — **obligatoria solo si `hasPhysical`** |
| subtotal | number | calculado en el servidor |
| shippingCost | number | 0 si solo hay ebooks; tarifa fija (USD 4.99) si hay físicos |
| total | number | `subtotal + shippingCost`, calculado en el servidor |
| paymentStatus | string | `PENDIENTE_PAGO` → `PAGADO` \| `FALLIDO` \| `CANCELADO` |
| shipmentStatus | string | solo si `hasPhysical`: `PENDIENTE` → `PREPARANDO` → `ENVIADO` → `ENTREGADO` |
| shipmentHistory | array | `{ status, changedBy, changedAt }` — bitácora de cambios |
| createdAt / updatedAt | date | timestamps |

### 4.4 `payments`
| Campo | Tipo | Reglas |
|-------|------|--------|
| orderId | ObjectId → orders | |
| provider | string | `paypal` |
| providerOrderId | string | id de la orden en PayPal; único |
| captureId | string | id de la captura |
| amount | number | importe capturado |
| currency | string | `USD` |
| status | string | `CREATED` → `APPROVED` → `CAPTURED` \| `FAILED` |
| createdAt / updatedAt | date | timestamps |

No almacenar nunca datos de tarjeta.

---

## 5. Reglas de negocio críticas

1. **El precio lo decide el servidor.** Al crear un pedido, el frontend envía solo `{ bookId, quantity }` y la dirección. El backend consulta los precios en la BD, recalcula subtotal, envío y total, y guarda la copia del precio. Cualquier precio enviado por el navegador se ignora.
2. **Validación de stock al crear el pedido.** Si un libro físico no tiene stock suficiente, se rechaza con un mensaje claro.
3. **Descuento de stock atómico al pagar.** Al capturar el pago, el backend descuenta el stock con una actualización condicional (`stock >= cantidad`) **antes** de capturar en PayPal. Si no alcanza, no se captura y se informa al cliente. Si la captura en PayPal falla, se restituye el stock descontado.
4. **Un pedido solo queda pagado tras la captura verificada.** El backend comprueba en la respuesta de PayPal el estado `COMPLETED`, el importe, la moneda y que la orden corresponda al pedido. El navegador nunca marca un pedido como pagado.
5. **Idempotencia del pago.** Capturar dos veces la misma orden no debe producir dos cobros ni duplicar el pedido; la segunda solicitud devuelve el resultado ya conocido.
6. **Propiedad del pedido.** Un cliente solo puede ver, pagar o consultar sus propios pedidos.
7. **Máquina de estados de envío.** Solo el `admin` puede cambiar `shipmentStatus`, y solo avanzando un paso cada vez: `PENDIENTE → PREPARANDO → ENVIADO → ENTREGADO`. No se puede saltar estados ni retroceder. Solo pedidos pagados con libros físicos entran al tablero.
8. **Acceso a ebooks.** El `ebookFileUrl` solo se entrega al cliente que tiene un pedido **pagado** que incluye ese ebook.

---

## 6. Endpoints REST del backend

| Método y ruta | Propósito | Acceso |
|---------------|-----------|--------|
| GET `/health` | Estado del servicio | Público |
| POST `/api/auth/register` | Crear usuario (rol `cliente` asignado por el servidor) | Público |
| POST `/api/auth/login` | Iniciar sesión y obtener JWT | Público |
| GET `/api/auth/me` | Datos del usuario autenticado | Autenticado |
| GET `/api/books` | Catálogo con filtros `?category=&format=&q=` (sin `ebookFileUrl`) | Público |
| GET `/api/books/:id` | Detalle de un libro | Público |
| POST `/api/books` | Crear libro | `admin` |
| PATCH `/api/books/:id` | Editar o desactivar libro | `admin` |
| PATCH `/api/books/:id/stock` | Ajustar stock (`{ stock }` o `{ delta }`) | `admin` |
| GET `/api/admin/low-stock` | Libros físicos con stock bajo | `admin` |
| POST `/api/orders` | Crear pedido pendiente de pago (recalcula total) | `cliente` |
| GET `/api/orders/me` | Historial del cliente | `cliente` (solo propios) |
| GET `/api/orders` | Pedidos pagados con físicos, para el tablero | `admin` |
| PATCH `/api/orders/:id/shipment-status` | Avanzar estado de envío | `admin` |
| GET `/api/library` | Ebooks comprados con su enlace de descarga | `cliente` |
| POST `/api/payments/paypal/order` | Crear orden en PayPal para un pedido propio | `cliente` dueño |
| POST `/api/payments/paypal/capture` | Capturar pago, descontar stock y confirmar pedido | `cliente` dueño |

Todas las respuestas de error usan un formato uniforme `{ error: "mensaje" }` sin filtrar detalles internos.

---

## 7. Eventos WebSocket (Socket.IO)

El handshake debe autenticarse con el JWT. El servidor asigna las salas según el usuario; **no** se confía en un nombre de sala enviado por el navegador.

| Evento | Emisor → Sala | Uso |
|--------|---------------|-----|
| `order:paid` | Backend → sala `admins` | Un pedido con físicos fue pagado: aparece en el tablero |
| `shipment:updated` | Backend → sala `admins` y sala `user:<userId>` | Cambió el estado del envío: se mueve en el tablero y se actualiza el historial del cliente |
| `book:stockChanged` | Backend → todos | Cambió el stock de un libro: el catálogo refleja disponibilidad sin recargar |
| `connection:error` | Cliente/servidor | Mostrar estado de reconexión |

Enviar solo los datos mínimos necesarios; no difundir direcciones ni datos personales a otros usuarios.

---

## 8. Pantallas del frontend

**Públicas:** inicio con libros destacados, catálogo con filtros (categoría, formato físico/ebook, búsqueda por título o autor), detalle de libro con indicador de disponibilidad ("Quedan 2", "Agotado", "Descarga inmediata"), inicio de sesión y registro.

**Cliente:** carrito (cambiar cantidades, quitar; el formulario de dirección aparece solo si hay libros físicos), checkout con resumen y botones de PayPal, "Mis pedidos" con estado del envío actualizado en vivo, y "Mi biblioteca" con los ebooks comprados y su botón de descarga.

**Administrador:** gestión de catálogo (tabla con crear, editar, desactivar y ajustar stock, con alertas visuales de stock bajo) y tablero Kanban de envíos con columnas **Pendiente · Preparando · Enviado · Entregado**, arrastrar y soltar, y actualización en tiempo real.

Rutas protegidas por rol tanto en el frontend como, sobre todo, en el backend.

---

## 9. Diseño visual

Interfaz limpia, moderna y responsive, en español. Estética de **librería cálida**: fondo color papel (crema claro), texto tinta casi negra, acento verde botella y detalles en terracota. Tipografía serif elegante para títulos y sans-serif legible para el cuerpo. Las portadas de los libros son protagonistas en el catálogo.

---

## 10. Datos de prueba (seed)

- Usuario cliente: `cliente@libroya.com`
- Usuario administrador: `admin@libroya.com`
- Contraseñas de demo definidas en el script de seed (no reutilizar contraseñas personales).
- Al menos **16 libros**, mezclando categorías y formatos (más o menos mitad físicos y mitad ebooks), con precios en USD entre 4.99 y 39.99. Algunos físicos con stock bajo (1–3) y al menos uno agotado (0), para poder mostrar las alertas.
- Datos ficticios, sin información personal real.

---

## 11. Seguridad y configuración

- Secretos solo en `server/.env` (excluido de Git). Entregar `server/.env.example` y `web/.env.example` sin valores reales.
- Variables del backend: `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CLIENT_ORIGIN`, `PORT`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_API_BASE`.
- Variables del frontend: solo `NEXT_PUBLIC_API_URL` y `NEXT_PUBLIC_PAYPAL_CLIENT_ID` (públicas, nunca secretas).
- CORS limitado al origen exacto del frontend (`CLIENT_ORIGIN`).
- Validación de entrada en todos los endpoints (cantidades positivas, campos requeridos, dirección obligatoria si hay físicos).
- Manejo de errores centralizado; los logs no imprimen secretos.

---

## 12. Pruebas

Incluir pruebas automatizadas del backend (por ejemplo Vitest o Jest + Supertest) para, como mínimo: login correcto e incorrecto, acceso denegado por rol, creación de pedido con precio recalculado en el servidor, rechazo por stock insuficiente y transición de estado de envío inválida.

---

## 13. Fuera de alcance

Pagos reales (solo Sandbox), facturación e impuestos, cupones, notificaciones por correo o SMS, rastreo GPS del envío, devoluciones y reembolsos, multi-idioma, aplicación móvil nativa.
