async function run() {
  const payload = {
    customer_name: "Tamu Eksternal",
    items: [
      { name: "Paket Nasi Kuning", quantity: 2, price: 15000 },
      { name: "Kopi Hitam", quantity: 1, price: 5000 }
    ],
    payment_method: "QRIS_ShopeePay",
    payment_status: "lunas",
    total_price: 35000,
    external_id: "SMARTTAG-001",
    source: "smart_tag_qr"
  };

  try {
    const res = await fetch("http://localhost:3000/api/orders/external", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "tangolab-secret-key-2026"
      },
      body: JSON.stringify(payload)
    });
    const data = await res.text();
    console.log("Response:", res.status, data);
  } catch (error) {
    console.error(error);
  }
}

run();
