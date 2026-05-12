const express = require("express");
const fetch = require("node-fetch");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const TOKEN = process.env.SQUARE_TOKEN;
const ENV = process.env.SQUARE_ENV || "production";
const BASE =
  ENV === "sandbox"
    ? "https://connect.squareupsandbox.com"
    : "https://connect.squareup.com";

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/pickup-orders", async (req, res) => {
  if (!TOKEN || TOKEN === "YOUR_TOKEN_HERE") {
    return res.status(500).json({ error: "SQUARE_TOKEN not set in .env" });
  }

  try {
    const headers = {
      Authorization: `Bearer ${TOKEN}`,
      "Square-Version": "2024-04-17",
      "Content-Type": "application/json",
    };

    // Step 1: get locations
    const locRes = await fetch(`${BASE}/v2/locations`, { headers });
    const locData = await locRes.json();
    if (!locRes.ok) {
      return res.status(locRes.status).json({ error: locData.errors?.[0]?.detail || "Location fetch failed" });
    }

    const locationIds = (locData.locations || []).map((l) => l.id);
    if (!locationIds.length) {
      return res.json({ orders: [] });
    }

    // Step 2: search for open pickup orders
    const ordRes = await fetch(`${BASE}/v2/orders/search`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        location_ids: locationIds,
        query: {
          filter: {
            state_filter: { states: ["OPEN"] },
            fulfillment_filter: { fulfillment_types: ["PICKUP"] },
          },
          sort: { sort_field: "CREATED_AT", sort_order: "ASC" },
        },
        limit: 200,
      }),
    });

    const ordData = await ordRes.json();
    if (!ordRes.ok) {
      return res.status(ordRes.status).json({ error: ordData.errors?.[0]?.detail || "Orders fetch failed" });
    }

    const orders = (ordData.orders || []).map((o, i) => ({
      index: i + 1,
      id: o.id,
      subtotal: o.net_amounts?.total_money?.amount || o.total_money?.amount || 0,
      createdAt: o.created_at,
    }));

    res.json({ orders, env: ENV });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Square pickup chart running on port ${PORT}`);
});
