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
      { id: 'S001', name: 'Admin Tangolab', role: 'Super Admin', email: 'admin@gmail.com', phone: '08111111', password: '12345678' },
      { id: 'S002', name: 'Kasir Tangolab', role: 'Kasir', email: 'kasir@gmail.com', phone: '08222222', password: '12345678' },
      { id: 'S003', name: 'Koki Tangolab', role: 'Koki', email: 'koki@gmail.com', phone: '08333333', password: '12345678' },
    ];

    // Clear old default staff to avoid duplicate key errors and update passwords
    await db.query("DELETE FROM staff WHERE id IN ('S001', 'S002', 'S003') OR email IN ('admin@gmail.com', 'kasir@gmail.com', 'koki@gmail.com', 'admin@tangolab.id', 'kasir@tangolab.id', 'koki@tangolab.id')");

    for (const s of defaultStaff) {
      await db.query(
        "INSERT INTO staff (id, name, role, email, phone, password_hash, status) VALUES (?, ?, ?, ?, ?, ?, 'active')",
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
