"use strict";
// Server-side Razorpay adapter.
// Creates orders via razorpay.orders.create and verifies HMAC SHA256
// payment signatures. Falls back to mock responses when keys are absent.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRazorpayEnabled = void 0;
exports.createOrder = createOrder;
exports.verifySignature = verifySignature;
exports.verifyWebhook = verifyWebhook;
const crypto_1 = __importDefault(require("crypto"));
const razorpay_1 = __importDefault(require("razorpay"));
const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const razorpay = KEY_ID && KEY_SECRET ? new razorpay_1.default({ key_id: KEY_ID, key_secret: KEY_SECRET }) : null;
const isRazorpayEnabled = () => razorpay !== null;
exports.isRazorpayEnabled = isRazorpayEnabled;
/** Create a Razorpay order. Returns { orderId, amount } or a mock. */
async function createOrder(amount, currency = 'INR') {
    if (!razorpay)
        return { orderId: `order_mock_${crypto_1.default.randomUUID()}`, amount };
    const order = await razorpay.orders.create({ amount: amount * 100, currency, payment_capture: true });
    return { orderId: order.id, amount: Number(order.amount) / 100 };
}
/** Verify the HMAC SHA256 signature from Razorpay webhook or checkout. */
function verifySignature(params) {
    if (!KEY_SECRET)
        return true;
    const body = `${params.orderId}|${params.paymentId}`;
    const expected = crypto_1.default.createHmac('sha256', KEY_SECRET).update(body).digest('hex');
    return crypto_1.default.timingSafeEqual(Buffer.from(expected), Buffer.from(params.signature));
}
/** Verify a webhook payload signature. */
function verifyWebhook(rawBody, signature) {
    if (!KEY_SECRET)
        return true;
    const expected = crypto_1.default.createHmac('sha256', KEY_SECRET).update(rawBody).digest('hex');
    return crypto_1.default.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
//# sourceMappingURL=razorpay.js.map