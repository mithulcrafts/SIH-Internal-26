import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const getAdmin = () => createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/functions\/v1\/campuspool-api/, "");
    const body = req.method === "POST" ? await req.json() : {};
    const supabase = getAdmin();

    if (path === "/auth/send-otp" && req.method === "POST") {
      const email = String(body.email ?? "").toLowerCase();
      if (!/^[^@\s]+@iiitm\.ac\.in$/.test(email)) return json({ error: "IIITM email required" }, 400);
      return json({ sent: true, expiresIn: 300 });
    }

    if (path === "/auth/verify-otp" && req.method === "POST") {
      if (body.otp !== "123456") return json({ error: "Invalid verification code" }, 401);
      return json({ token: `demo-${crypto.randomUUID()}`, user: { email: body.email, name: "IIITM Student" } });
    }

    if (path === "/pools/match" && req.method === "POST") {
      const vehicleType = body.vehicleType === "CAB_4" ? "CAB_4" : "AUTO_3";
      const { data: pool, error } = await supabase.from("pools").insert({ vehicle_type: vehicleType, max_capacity: vehicleType === "CAB_4" ? 4 : 3, status: "FULL", total_estimated_fare: vehicleType === "CAB_4" ? 276 : 204 }).select().maybeSingle();
      if (error) return json({ error: "Could not create pool" }, 500);
      return json({ pool, matchedRiders: vehicleType === "CAB_4" ? 4 : 3 });
    }

    const poolMatch = path.match(/^\/pools\/([^/]+)\/(sequence|split)$/);
    if (poolMatch && req.method === "POST") {
      if (poolMatch[2] === "sequence") return json({ sequence: ["BH-1", "Main Gate", "GH", body.destination ?? "Gwalior Railway Station"], etaMinutes: 25 });
      const total = Number(body.totalFare ?? 204);
      const riders = Number(body.riders ?? 3);
      return json({ shares: Array.from({ length: riders }, (_, index) => ({ stopSequence: index + 1, individualFare: Math.round((total / riders + index * 3) * 100) / 100 })) });
    }

    if (path === "/payments/mock-order" && req.method === "POST") return json({ orderId: `order_demo_${crypto.randomUUID()}`, amount: body.amount, currency: "INR" });
    if (path === "/payments/verify" && req.method === "POST") return json({ verified: true, paymentId: `pay_demo_${crypto.randomUUID()}` });

    if (path === "/uber/mock-dispatch" && req.method === "POST") return json({ driver: { name: "Ramesh Sharma", vehicle: "White Swift Dzire", number: "MP-07-AB-1234", phone: "+91 98765 43210", rating: 4.8 }, trackingUrl: `https://campuspool.local/track/${crypto.randomUUID()}` });

    if (path === "/safety/trigger-sos" && req.method === "POST") {
      const { error } = await supabase.from("safety_alerts").insert({ pool_id: body.poolId ?? null, latitude: body.latitude ?? null, longitude: body.longitude ?? null, alert_type: "SOS" });
      if (error) return json({ error: "Could not record safety alert" }, 500);
      return json({ dispatched: true, channels: ["SMS", "Call"], message: "Emergency contacts notified" });
    }

    return json({ error: "Route not found" }, 404);
  } catch {
    return json({ error: "Request could not be completed" }, 500);
  }
});
