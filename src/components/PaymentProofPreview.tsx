import React, { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { authFetch } from '../lib/authFetch';

const PROTECTED_PREFIX = '/uploads/payment-proofs/';

// Bukti pembayaran dilindungi requireRoles + Authorization header, sehingga <img src> biasa
// akan gagal 401. Ambil lewat authFetch lalu ubah menjadi object URL.
export function PaymentProofPreview({ url }: { url: string }) {
  const isProtected = url.startsWith(PROTECTED_PREFIX);
  const [previewUrl, setPreviewUrl] = useState<string | null>(isProtected ? null : url);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!url.startsWith(PROTECTED_PREFIX)) {
      setPreviewUrl(url);
      setFailed(false);
      return;
    }

    let active = true;
    let objectUrl: string | null = null;
    setPreviewUrl(null);
    setFailed(false);
    authFetch(url)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.blob();
      })
      .then(blob => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  if (failed) return <div className="p-4 text-xs font-bold text-rose-600">Bukti pembayaran tidak dapat dimuat.</div>;
  if (!previewUrl) return <div className="p-4 text-xs font-bold text-slate-400">Memuat bukti pembayaran...</div>;

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-100 shadow-inner group relative">
      <img
        src={previewUrl}
        alt="Bukti Transfer"
        className="w-full h-32 object-cover transition-all group-hover:scale-105"
        referrerPolicy="no-referrer"
      />
      <a
        href={previewUrl}
        target="_blank"
        rel="noreferrer"
        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <ExternalLink className="text-white" size={24} />
      </a>
    </div>
  );
}
