import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { createRateLimit } from '../middleware/rateLimit.js';

type Dependencies = {key:()=>string;query:(sql:string,params?:unknown[])=>Promise<any>;verify:(password:string,hash:string)=>Promise<boolean>};
export function createDapuropsIntegration({key,query,verify}:Dependencies){
  const router=Router();
  const profile=(s:any)=>({id:s.id,name:s.name,email:s.email,phone:s.phone,role:s.role,status:s.status});
  router.use((req,res,next)=>{const expected=key();if(!expected)return res.status(503).json({message:'Integrasi belum dikonfigurasi.'});const supplied=req.get('x-api-key')||'';if(!supplied)return res.status(401).json({message:'Autentikasi integrasi diperlukan.'});const a=Buffer.from(supplied),b=Buffer.from(expected);if(a.length!==b.length||!timingSafeEqual(a,b))return res.status(403).json({message:'Autentikasi integrasi ditolak.'});res.setHeader('Cache-Control','no-store');next();});
  router.get('/staff',async(_req,res)=>{try{const [rows]=await query('SELECT id,name,email,phone,role,status FROM staff');res.json({staff:rows.map(profile)});}catch{res.status(503).json({message:'Data staf tidak tersedia.'});}});
  router.post('/login',createRateLimit(15*60*1000,100),async(req,res)=>{
    const {email,password}=req.body||{};
    if(typeof email!=='string'||email.length>150||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())||typeof password!=='string'||!password||password.length>128)return res.status(400).json({message:'Email dan password tidak valid.'});
    try{const [rows]=await query('SELECT id,name,email,phone,role,status,password_hash FROM staff WHERE email=? LIMIT 1',[email.trim().toLowerCase()]);const s=rows[0];if(!s||!await verify(password,s.password_hash))return res.status(401).json({message:'Email atau password salah.'});if(s.status!=='active')return res.status(403).json({message:'Akun staf tidak aktif.'});res.json({staff:profile(s)});}catch{res.status(503).json({message:'Login staf tidak tersedia.'});}
  });
  return router;
}
