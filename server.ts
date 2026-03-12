import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// --- DATABASE INITIALIZATION ---
let useMock = false;
let pool: any = null;

// Simple in-memory mock for preview if MySQL is not available
const mockDb: any = {
  carreras: [
    { id: 1, nombre: 'Ingeniería de Sistemas', codigo: 'IS101', facultad: 'Facultad de Ingeniería', descripcion: 'Carrera enfocada en el desarrollo de software, redes y gestión de TI.', duracion_semestres: 10, estado: 'activa' },
    { id: 2, nombre: 'Administración de Empresas', codigo: 'ADM303', facultad: 'Ciencias Económicas', descripcion: 'Formación en gestión, finanzas y dirección de organizaciones.', duracion_semestres: 10, estado: 'activa' },
    { id: 3, nombre: 'Derecho', codigo: 'DER202', facultad: 'Ciencias Jurídicas', descripcion: 'Estudio de las leyes y el sistema judicial.', duracion_semestres: 10, estado: 'activa' },
    { id: 4, nombre: 'Psicología', codigo: 'PSI505', facultad: 'Facultad de Humanidades', descripcion: 'Estudio del comportamiento humano y procesos mentales.', duracion_semestres: 10, estado: 'activa' }
  ],
  materias: [
    { id: 1, nombre: 'Cálculo Diferencial', codigo: 'MAT101', creditos: 5, semestre: 1, descripcion: 'Fundamentos de cálculo para ingeniería.', carrera_id: 1, estado: 'activa', carrera_nombre: 'Ingeniería de Sistemas' },
    { id: 2, nombre: 'Programación I', codigo: 'PROG101', creditos: 4, semestre: 1, descripcion: 'Introducción a la lógica de programación.', carrera_id: 1, estado: 'activa', carrera_nombre: 'Ingeniería de Sistemas' },
    { id: 3, nombre: 'Contabilidad General', codigo: 'CON101', creditos: 4, semestre: 1, descripcion: 'Principios básicos de contabilidad.', carrera_id: 2, estado: 'activa', carrera_nombre: 'Administración de Empresas' }
  ],
  estudiantes: [
    { id: 1, nombres: 'Juan', apellidos: 'Pérez', tipo_documento: 'DNI', numero_documento: '12345678', correo: 'juan.perez@example.com', telefono: '987654321', fecha_nacimiento: '2002-05-15', direccion: 'Calle Falsa 123', carrera_id: 1, estado: 'activo', carrera_nombre: 'Ingeniería de Sistemas' },
    { id: 2, nombres: 'María', apellidos: 'García', tipo_documento: 'DNI', numero_documento: '87654321', correo: 'maria.garcia@example.com', telefono: '912345678', fecha_nacimiento: '2001-10-20', direccion: 'Av. Siempre Viva 742', carrera_id: 2, estado: 'activo', carrera_nombre: 'Administración de Empresas' }
  ]
};

async function initDb() {
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'u785806933_uniweb',
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0
  };

  try {
    // Try MySQL first
    pool = mysql.createPool(dbConfig);
    // Test connection
    const connection = await pool.getConnection();
    connection.release();
    console.log("✅ Connected to MySQL Database:", dbConfig.database);
  } catch (error: any) {
    console.error("❌ MySQL connection failed!");
    console.error("Error details:", error.message);
    console.warn("Falling back to In-Memory Mock for preview mode.");
    console.info("If you are in Hostinger, make sure your .env variables are correct.");
    useMock = true;
  }
}

// --- API HELPERS ---
async function query(sql: string, params: any[] = []) {
  if (useMock) {
    const sqlUpper = sql.trim().toUpperCase();
    
    if (sqlUpper.startsWith("SELECT")) {
      if (sqlUpper.includes("FROM CARRERAS")) return [mockDb.carreras];
      
      if (sqlUpper.includes("FROM MATERIAS")) {
        // Simple join simulation for mock
        return [mockDb.materias.map((m: any) => ({
          ...m,
          carrera_nombre: mockDb.carreras.find((c: any) => c.id === m.carrera_id)?.nombre || 'Desconocida'
        }))];
      }
      
      if (sqlUpper.includes("FROM ESTUDIANTES")) {
        // Simple join simulation for mock
        return [mockDb.estudiantes.map((e: any) => ({
          ...e,
          carrera_nombre: mockDb.carreras.find((c: any) => c.id === e.carrera_id)?.nombre || 'Desconocida'
        }))];
      }
      
      if (sqlUpper.includes("COUNT(*)")) {
        if (sqlUpper.includes("ESTUDIANTES")) return [[{ count: mockDb.estudiantes.length }]];
        if (sqlUpper.includes("CARRERAS")) return [[{ count: mockDb.carreras.length }]];
        if (sqlUpper.includes("MATERIAS")) return [[{ count: mockDb.materias.length }]];
      }
      return [[]];
    }
    
    if (sqlUpper.startsWith("INSERT")) {
      const table = sqlUpper.includes("CARRERAS") ? "carreras" : sqlUpper.includes("MATERIAS") ? "materias" : "estudiantes";
      const newId = mockDb[table].length > 0 ? Math.max(...mockDb[table].map((i: any) => i.id)) + 1 : 1;
      return [{ insertId: newId }];
    }
    
    return [{}];
  } else {
    return await pool.query(sql, params);
  }
}

// --- API ROUTES ---

app.get("/api/carreras", async (req, res) => {
  try {
    const [rows] = await query("SELECT * FROM carreras");
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/carreras", async (req, res) => {
  try {
    const { nombre, codigo, facultad, descripcion, duracion_semestres, estado } = req.body;
    const [result]: any = await query(
      "INSERT INTO carreras (nombre, codigo, facultad, descripcion, duracion_semestres, estado) VALUES (?, ?, ?, ?, ?, ?)",
      [nombre, codigo, facultad, descripcion, duracion_semestres, estado]
    );
    res.status(201).json({ id: result.insertId, ...req.body });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/carreras/:id", async (req, res) => {
  try {
    const { nombre, codigo, facultad, descripcion, duracion_semestres, estado } = req.body;
    await query(
      "UPDATE carreras SET nombre = ?, codigo = ?, facultad = ?, descripcion = ?, duracion_semestres = ?, estado = ? WHERE id = ?",
      [nombre, codigo, facultad, descripcion, duracion_semestres, estado, req.params.id]
    );
    res.json({ id: req.params.id, ...req.body });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/carreras/:id", async (req, res) => {
  try {
    await query("DELETE FROM carreras WHERE id = ?", [req.params.id]);
    res.json({ message: "Carrera eliminada" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/materias", async (req, res) => {
  try {
    const [rows] = await query(`
      SELECT m.*, c.nombre as carrera_nombre 
      FROM materias m 
      JOIN carreras c ON m.carrera_id = c.id
    `);
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/materias", async (req, res) => {
  try {
    const { nombre, codigo, creditos, semestre, descripcion, carrera_id, estado } = req.body;
    const [result]: any = await query(
      "INSERT INTO materias (nombre, codigo, creditos, semestre, descripcion, carrera_id, estado) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [nombre, codigo, creditos, semestre, descripcion, carrera_id, estado]
    );
    res.status(201).json({ id: result.insertId, ...req.body });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/materias/:id", async (req, res) => {
  try {
    await query("DELETE FROM materias WHERE id = ?", [req.params.id]);
    res.json({ message: "Materia eliminada" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/estudiantes", async (req, res) => {
  try {
    const [rows] = await query(`
      SELECT e.*, c.nombre as carrera_nombre 
      FROM estudiantes e 
      JOIN carreras c ON e.carrera_id = c.id
    `);
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/estudiantes", async (req, res) => {
  try {
    const { nombres, apellidos, tipo_documento, numero_documento, correo, telefono, fecha_nacimiento, direccion, carrera_id, estado } = req.body;
    const [result]: any = await query(
      "INSERT INTO estudiantes (nombres, apellidos, tipo_documento, numero_documento, correo, telefono, fecha_nacimiento, direccion, carrera_id, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [nombres, apellidos, tipo_documento, numero_documento, correo, telefono, fecha_nacimiento, direccion, carrera_id, estado]
    );
    res.status(201).json({ id: result.insertId, ...req.body });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/estudiantes/:id", async (req, res) => {
  try {
    await query("DELETE FROM estudiantes WHERE id = ?", [req.params.id]);
    res.json({ message: "Estudiante eliminado" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/stats", async (req, res) => {
  try {
    const [est]: any = await query("SELECT COUNT(*) as count FROM estudiantes");
    const [car]: any = await query("SELECT COUNT(*) as count FROM carreras");
    const [mat]: any = await query("SELECT COUNT(*) as count FROM materias");
    res.json({ 
      totalEstudiantes: est[0].count, 
      totalCarreras: car[0].count, 
      totalMaterias: mat[0].count,
      isMock: useMock
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- VITE MIDDLEWARE ---

async function startServer() {
  await initDb();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
