async function run() {
  try {
    const res = await fetch("http://localhost:3000/api/orders/external/history", {
      method: "GET",
      headers: {
        "x-api-key": "tangolab-secret-key-2026"
      }
    });
    
    if (res.status === 200) {
      const data = await res.json();
      console.log("Success! Status:", res.status);
      console.log("Number of orders found:", data.length);
      if (data.length > 0) {
        console.log("First order sample with items:");
        console.dir(data[0], { depth: null });
      }
    } else {
      const text = await res.text();
      console.log("Failed! Status:", res.status, text);
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

run();
