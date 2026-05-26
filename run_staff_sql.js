import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function run() {
  const db = mysql.createPool({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
    database: "gesture_eats",
    multipleStatements: true
  });

  try {
    const sqlPath = path.join(process.cwd(), 'src/db/staff_schema.sql');
    const sqlFile = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Executing Staff Schema SQL...');
    await db.query(sqlFile);
    console.log('SQL executed successfully!');

    console.log('Inserting default staff...');
    const defaultStaff = [
      { id: 'S001', name: 'Admin Bagus', role: 'Admin', email: 'admin@tangolab.id', phone: '08111111', password: 'admin' },
      { id: 'S002', name: 'Kasir Siti', role: 'Kasir', email: 'kasir@tangolab.id', phone: '08222222', password: 'kasir' },
      { id: 'S003', name: 'Koki Budi', role: 'Koki', email: 'koki@tangolab.id', phone: '08333333', password: 'koki' },
    ];

    for (const s of defaultStaff) {
      await db.query(
        "INSERT IGNORE INTO staff (id, name, role, email, phone, password_hash, status) VALUES (?, ?, ?, ?, ?, ?, 'active')",
        [s.id, s.name, s.role, s.email, s.phone, hashPassword(s.password)]
      );
    }
    console.log('Default staff inserted successfully!');

  } catch (error) {
    console.error('Error executing SQL:', error);
  } finally {
    db.end();
  }
}

run();
