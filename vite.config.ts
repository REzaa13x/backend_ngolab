import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const projectRoot = __dirname;
  // Folder bukti pembayaran dapat diatur lewat env; pola deny harus mengikutinya, karena pola tetap
  // tidak akan cocok bila nama direktorinya berbeda dari default.
  const configuredProofPath = process.env.PAYMENT_PROOF_PATH || env.PAYMENT_PROOF_PATH || '';
  const proofDirName = configuredProofPath.trim()
    ? path.basename(path.resolve(projectRoot, configuredProofPath.trim()))
    : '.tangolab-payment-proofs';
  // Nama direktori dapat berisi karakter glob; dilolosikan agar polanya tidak melebar atau rusak.
  const escapedProofDirName = proofDirName.replace(/[*?[\]{}()!+@]/g, '\\$&');
  // Pola hanya ditambahkan bila folder benar-benar berada di dalam root proyek; folder di luar root
  // tidak terjangkau oleh rung '/@fs/' sama sekali.
  const proofDirInsideRoot = (() => {
    const resolved = path.resolve(projectRoot, configuredProofPath.trim() || '.');
    const relative = path.relative(path.resolve(projectRoot), resolved);
    return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
  })();
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Rung '/@fs/' milik Vite dev dapat membaca berkas apa pun di bawah fs.allow tanpa
      // autentikasi. allow dipatok ke root proyek agar Vite tidak melebarkannya ke workspace root
      // (mis. folder induk yang punya package-lock.json), dan direktori rahasia ditolak eksplisit.
      fs: {
        strict: true,
        allow: [projectRoot],
        deny: [
          '**/.env*',
          '**/*.{crt,pem,key}',
          '**/.git/**',
          '**/storage/**',
          '**/uploads/payment-proofs/**',
          ...(proofDirInsideRoot ? [`**/${escapedProofDirName}/**`] : []),
        ],
      },
    },
  };
});
