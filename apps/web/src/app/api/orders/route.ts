import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendPushToUser } from "@/lib/push";

type OrderInput = {
  items?: unknown;
  addressId?: unknown;
  addressText?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  instructions?: unknown;
  recipientName?: unknown;
  recipientPhone?: unknown;
  payerParty?: unknown;
  paymentMethod?: unknown;
  scheduledFor?: unknown;
  customerName?: unknown;
  customerPhone?: unknown;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedOrderErrors = new Set([
  "Invalid customer.",
  "Choose who will pay.",
  "Choose an available payment method.",
  "Recipient payment is available on delivery only.",
  "Choose a future delivery time.",
  "Your cart is invalid.",
  "Each cylinder size can appear only once in the cart.",
  "Complete your profile before ordering.",
  "That saved address is unavailable.",
  "Enter a valid delivery address and map location.",
  "A map location is required for delivery.",
  "This address is outside Mobsol’s active delivery areas.",
  "Delivery pricing is not configured for this area.",
  "Your cart contains an invalid item.",
  "Cylinder quantity must be between 1 and 10.",
  "A selected cylinder is no longer available.",
  "Enter the recipient’s name and a valid phone number.",
]);

function isOptionalText(value: unknown, maxLength: number): value is string | undefined {
  return value === undefined || (typeof value === "string" && value.length <= maxLength);
}

export async function GET(request: Request) {
  const accessToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return NextResponse.json({ error: "Sign in to view your orders." }, { status: 401 });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !publicKey || !serviceKey) return NextResponse.json({ error: "Orders are not configured." }, { status: 503 });
  const auth = createClient(supabaseUrl, publicKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: authData, error: authError } = await auth.auth.getUser(accessToken);
  if (authError || !authData.user) return NextResponse.json({ error: "Your session is invalid or expired." }, { status: 401 });
  const db = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await db.from("orders")
    .select("id, order_number, recipient_name, recipient_phone, gas_subtotal_kobo, delivery_fee_kobo, total_kobo, payment_status, payment_method, delivery_status, created_at, delivery_address_snapshot, delivery_location, order_items(weight_kg_snapshot, quantity)")
    .eq("customer_id", authData.user.id).order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: "We couldn’t load your orders." }, { status: 500 });
  const orders = (data ?? []).map((order) => {
    const rawLocation = order.delivery_location;
    let coordinates: { latitude: number; longitude: number } | null = null;
    if (rawLocation && typeof rawLocation === "object" && "coordinates" in rawLocation) {
      const point = rawLocation as { coordinates?: unknown };
      if (Array.isArray(point.coordinates) && Number.isFinite(point.coordinates[0]) && Number.isFinite(point.coordinates[1])) {
        coordinates = { longitude: Number(point.coordinates[0]), latitude: Number(point.coordinates[1]) };
      }
    } else if (typeof rawLocation === "string" && /^[0-9a-f]+$/i.test(rawLocation)) {
      try {
        const bytes = Buffer.from(rawLocation, "hex");
        const littleEndian = bytes[0] === 1;
        const type = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(1, littleEndian);
        const hasSrid = (type & 0x20000000) !== 0;
        const offset = hasSrid ? 9 : 5;
        if ((type & 0xff) === 1 && bytes.length >= offset + 16) {
          const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
          const longitude = view.getFloat64(offset, littleEndian);
          const latitude = view.getFloat64(offset + 8, littleEndian);
          if (Number.isFinite(latitude) && Number.isFinite(longitude)) coordinates = { latitude, longitude };
        }
      } catch { /* Older rows may not return a readable point. */ }
    }
    const { delivery_location: _deliveryLocation, ...safeOrder } = order;
    return { ...safeOrder, delivery_coordinates: coordinates };
  });
  return NextResponse.json({ orders });
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    return NextResponse.json({ error: "Sign in to place an order." }, { status: 401 });
  }
  const requestId = request.headers.get("idempotency-key");
  if (!requestId || !uuidPattern.test(requestId)) {
    return NextResponse.json({ error: "Send a valid Idempotency-Key UUID." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !publicKey || !serviceKey) {
    return NextResponse.json({ error: "Ordering is not configured on this server." }, { status: 503 });
  }

  let input: OrderInput;
  try {
    input = await request.json() as OrderInput;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const authClient = createClient(supabaseUrl, publicKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return NextResponse.json({ error: "Your session is invalid or expired. Sign in again." }, { status: 401 });
  }

  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 3) {
    return NextResponse.json({ error: "Your cart is invalid." }, { status: 400 });
  }
  const items: { product_id: string; quantity: number }[] = [];
  const productIds = new Set<string>();
  for (const item of input.items) {
    if (!item || typeof item !== "object") {
      return NextResponse.json({ error: "Your cart contains an invalid item." }, { status: 400 });
    }
    const productId = (item as Record<string, unknown>).productId;
    const quantity = (item as Record<string, unknown>).quantity;
    if (typeof productId !== "string" || !uuidPattern.test(productId)
      || !Number.isInteger(quantity) || (quantity as number) < 1 || (quantity as number) > 10
      || productIds.has(productId)) {
      return NextResponse.json({ error: "Your cart contains an invalid item." }, { status: 400 });
    }
    productIds.add(productId);
    items.push({ product_id: productId, quantity: quantity as number });
  }

  if (input.addressId !== undefined && (typeof input.addressId !== "string" || !uuidPattern.test(input.addressId))) {
    return NextResponse.json({ error: "Choose a valid saved address." }, { status: 400 });
  }
  if (!isOptionalText(input.addressText, 500) || !isOptionalText(input.instructions, 1000)
    || !isOptionalText(input.customerName, 160) || !isOptionalText(input.customerPhone, 40)
    || !isOptionalText(input.recipientName, 160) || !isOptionalText(input.recipientPhone, 40)) {
    return NextResponse.json({ error: "One or more order details are invalid." }, { status: 400 });
  }
  if (input.payerParty !== "customer" && input.payerParty !== "recipient") {
    return NextResponse.json({ error: "Choose who will pay." }, { status: 400 });
  }
  if (input.paymentMethod !== "paystack" && input.paymentMethod !== "cash" && input.paymentMethod !== "pos") {
    return NextResponse.json({ error: "Choose an available payment method." }, { status: 400 });
  }
  if (input.paymentMethod === "paystack" && !process.env.PAYSTACK_SECRET_KEY) {
    return NextResponse.json({ error: "Paystack is not configured on this server yet. Your order was not placed." }, { status: 503 });
  }
  if (input.scheduledFor !== undefined
    && (typeof input.scheduledFor !== "string" || !Number.isFinite(Date.parse(input.scheduledFor)))) {
    return NextResponse.json({ error: "Choose a valid delivery time." }, { status: 400 });
  }
  const latitude = input.latitude;
  const longitude = input.longitude;
  if (input.addressId === undefined && (typeof input.addressText !== "string"
    || typeof latitude !== "number" || !Number.isFinite(latitude)
    || latitude < -90 || latitude > 90
    || typeof longitude !== "number" || !Number.isFinite(longitude)
    || longitude < -180 || longitude > 180)) {
    return NextResponse.json({ error: "Enter a delivery address and choose its map location." }, { status: 400 });
  }

  const serverClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  if (typeof input.customerName === "string" && input.customerName.trim().length >= 2
    && typeof input.customerPhone === "string" && input.customerPhone.replace(/\D/g, "").length >= 7) {
    const { error: profileError } = await serverClient.from("profiles").upsert({
      id: authData.user.id, full_name: input.customerName.trim(), phone: input.customerPhone.trim(),
    });
    if (profileError) return NextResponse.json({ error: "Couldn’t save your profile details." }, { status: 500 });
  }
  const { data, error } = await serverClient.rpc("create_customer_order", {
    p_customer_id: authData.user.id,
    p_request_id: requestId,
    p_items: items,
    p_address_id: input.addressId ?? null,
    p_address_text: input.addressId === undefined ? input.addressText as string : null,
    p_latitude: input.addressId === undefined ? latitude as number : null,
    p_longitude: input.addressId === undefined ? longitude as number : null,
    p_instructions: input.instructions ?? null,
    p_recipient_name: input.recipientName ?? null,
    p_recipient_phone: input.recipientPhone ?? null,
    p_payer_party: input.payerParty,
    p_payment_method: input.paymentMethod,
    p_scheduled_for: input.scheduledFor ?? null,
  });

  if (error) {
    const message = allowedOrderErrors.has(error.message)
      ? error.message
      : "We couldn’t place the order. Please try again.";
    const status = error.message.includes("outside Mobsol") ? 422
      : error.message.includes("no longer available") ? 409 : 400;
    if (!allowedOrderErrors.has(error.message)) {
      console.error("create_customer_order failed", { code: error.code });
    }
    return NextResponse.json({ error: message }, { status });
  }

  const order = Array.isArray(data) ? data[0] : null;
  if (!order) {
    return NextResponse.json({ error: "We couldn’t confirm your order. Please contact support before retrying." }, { status: 502 });
  }
  await sendPushToUser(authData.user.id, { title: "Mobsol order received", body: `Order #${order.order_number} is in. We’ll keep you updated as it moves along.`, url: "/?tab=Orders", tag: `order-received-${order.id}` }).catch((pushError) => console.error("order push notification failed", pushError));
  return NextResponse.json({ order }, { status: 201 });
}
