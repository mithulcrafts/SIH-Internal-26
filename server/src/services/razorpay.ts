// Server-side Razorpay adapter.
// Creates orders via razorpay.orders.create and verifies HMAC SHA256
// payment signatures. Falls back to mock responses when keys are absent.

import crypto from 'crypto'
import Razorpay from 'razorpay'

const KEY_ID = process.env.RAZORPAY_KEY_ID
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET
const razorpay = KEY_ID && KEY_SECRET ? new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET }) : null

export const isRazorpayEnabled = (): boolean => razorpay !== null

/** Create a Razorpay order. Returns { orderId, amount } or a mock. */
export async function createOrder(amount: number, currency = 'INR'): Promise<{ orderId: string; amount: number }> {
  if (!razorpay) return { orderId: `order_mock_${crypto.randomUUID()}`, amount }
  const order = await razorpay.orders.create({ amount: amount * 100, currency, payment_capture: true })
  return { orderId: order.id, amount: Number(order.amount) / 100 }
}

/** Verify the HMAC SHA256 signature from Razorpay webhook or checkout. */
export function verifySignature(params: { orderId: string; paymentId: string; signature: string }): boolean {
  if (!KEY_SECRET) return true
  const body = `${params.orderId}|${params.paymentId}`
  const expected = crypto.createHmac('sha256', KEY_SECRET).update(body).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(params.signature))
}

/** Verify a webhook payload signature. */
export function verifyWebhook(rawBody: string, signature: string): boolean {
  if (!KEY_SECRET) return true
  const expected = crypto.createHmac('sha256', KEY_SECRET).update(rawBody).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}
