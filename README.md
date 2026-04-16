# 🧵 ELROHI — Sistema de Gestión de Producción

Sistema completo para gestión de producción de prendas de dotación empresarial.

## Stack
- **Frontend:** React 18 + Vite + Tailwind CSS
- **Backend:** Firebase (Auth + Firestore)
- **Deploy:** Vercel

---

## 🚀 Configuración paso a paso

### 1. Instalar dependencias

```bash
npm install
```

### 2. Crear proyecto en Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Crear nuevo proyecto → nombre: `elrohi`
3. Activar **Authentication** → Sign-in method → Email/Password → Habilitar
4. Activar **Firestore Database** → Create database → Start in **test mode** (luego aplicamos reglas)
5. Ve a Project Settings → General → Your Apps → Add App → Web
6. Copia el `firebaseConfig`

### 3. Configurar variables de entorno

```bash
cp .env.example .env
```

Llena el `.env` con los valores de tu Firebase:

```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=elrohi.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=elrohi
VITE_FIREBASE_STORAGE_BUCKET=elrohi.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

### 4. Crear usuarios en Firebase Auth

Ve a Firebase Console → Authentication → Users → Add User.

Crea estos 15 usuarios (todos con contraseña: `elrohi2024`):

| Email                       | Rol              |
|-----------------------------|------------------|
| gerente@elrohi.com          | Gerente General  |
| admin@elrohi.com            | Admin ELROHI     |
| nomina@elrohi.com           | Nómina           |
| despachos@elrohi.com        | Despachos        |
| corte@elrohi.com            | Área de Corte    |
| sat1@elrohi.com             | Admin Satélite 1 |
| sat2@elrohi.com             | Admin Satélite 2 |
| sat3@elrohi.com             | Admin Satélite 3 |
| op1@elrohi.com              | Operario 1       |
| op2@elrohi.com              | Operario 2       |
| op3@elrohi.com              | Operario 3       |
| op4@elrohi.com              | Operario 4       |
| tintoreria@elrohi.com       | Tintorería       |
| pespunte@elrohi.com         | Pespunte         |
| bodega@elrohi.com           | Bodega           |

> ⚠️ **Importante:** El UID que genera Firebase Auth debe coincidir con el ID en Firestore.
> Después de crear cada usuario en Auth, copia su UID y actualiza el campo `id` en `src/data/seed.js`.

**Alternativa rápida:** La app carga los datos de simulación automáticamente al primer inicio (sin usuarios de Auth). Luego crea los usuarios de Auth con los mismos UIDs que aparezcan en Firestore.

### 5. Aplicar reglas de Firestore

En Firebase Console → Firestore → Rules → pega el contenido de `firestore.rules`.

### 6. Correr en desarrollo

```bash
npm run dev
```

Abre http://localhost:5173 — al primer inicio carga los datos demo automáticamente.

---

## 🌐 Deploy en Vercel

### Opción A: Desde GitHub (recomendado)

1. Sube el proyecto a un repositorio GitHub
2. Ve a [vercel.com](https://vercel.com) → New Project → Import tu repo
3. En "Environment Variables" agrega todas las variables del `.env`
4. Click "Deploy"

### Opción B: Vercel CLI

```bash
npm install -g vercel
vercel
# Sigue las instrucciones, luego agrega las variables:
vercel env add VITE_FIREBASE_API_KEY
# (repite para cada variable)
vercel --prod
```

---

## 👥 Roles y accesos

| Rol              | Pantallas                                         |
|------------------|---------------------------------------------------|
| Gerente General  | Todo — panel, pedidos, lotes, satélites, inventario, nómina, config |
| Admin ELROHI     | Panel, pedidos, lotes, corte, satélites, inventario |
| Nómina           | Módulo de nómina                                  |
| Despachos        | Pedidos, inventario                               |
| Área de Corte    | Cola de corte                                     |
| Admin Satélite   | Mi taller (con tabs: resumen, operarios, tarifas), asignar ops |
| Operario         | Mis operaciones, mi quincena                      |
| Tintorería       | Área de tintorería                                |
| Pespunte         | Área de pespunte, mi quincena                     |
| Bodega           | Bodega y despacho                                 |

---

## 💡 Flujo de producción

```
Pedido → Inventario → Activar Lote → Corte → Asignar Satélite
  → Costura (operarios) → Tintorería → Validación → Pespunte → Bodega → Despacho
```

## 💰 Cálculo de nómina

```
Valor operación = precio_unitario × cantidad_piezas
Ejemplo: $1.200/pza × 400 piezas = $480.000
```

Cada satélite puede tener sus propias tarifas (editables desde "Mi Taller → Mis Tarifas").

---

## 📁 Estructura del proyecto

```
src/
├── App.jsx              # Router principal
├── firebase.js          # Firebase config
├── constants.js         # Roles, estados, tipos de prenda
├── utils.js             # Cálculos y helpers
├── contexts/
│   ├── AuthContext.jsx  # Firebase Auth
│   └── DataContext.jsx  # Firestore listeners
├── services/
│   └── db.js            # Todas las operaciones Firestore
├── components/
│   ├── Layout.jsx       # Layout + Sidebar + Header
│   └── ui.jsx           # Componentes reutilizables
├── screens/
│   ├── Login.jsx
│   ├── Dashboard.jsx
│   ├── Pedidos.jsx
│   ├── Lotes.jsx        # Lista + detalle del lote
│   ├── Taller.jsx       # Admin satélite (resumen/operarios/tarifas)
│   ├── AsignarOps.jsx   # Asignación de operaciones
│   ├── Operario.jsx     # Mis ops + mi quincena
│   ├── Produccion.jsx   # Corte, tintorería, pespunte, bodega
│   └── Otros.jsx        # Satélites, inventario, nómina, config
└── data/
    └── seed.js          # Datos iniciales de simulación
```
