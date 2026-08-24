// Frontend Razorpay payment adapter.
// Dynamically loads the Razorpay checkout script when a key is present.
// Falls back to a mock confirmation when no key is configured.

const RAZORPAY_KEY = import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined
const CHECKOUT_URL = 'https://checkout.razorpay.com/v1/checkout.js'

export type PaymentResult = { success: boolean; paymentId?: string; error?: string }

/** Load the Razorpay checkout script once. */
let checkoutLoaded = false
async function loadCheckout(): Promise<boolean> {
  if (checkoutLoaded) return true
  if (!RAZORPAY_KEY) return false
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = CHECKOUT_URL
    script.async = true
    script.onload = () => { checkoutLoaded = true; resolve(true) }
    script.onerror = () => resolve(false)
    document.head.appendChild(script)
  })
}

/** Open the Razorpay checkout modal for a given order. */
export async function openCheckout(options: {
  orderId: string
  amount: number
  name: string
  description: string
  prefill: { name: string; email: string }
  handler: (result: PaymentResult) => void
}): Promise<void> {
  const loaded = await loadCheckout()
  if (!loaded || !(window as { Razorpay?: unknown }).Razorpay) {
    // Mock fallback — simulate a successful payment.
    setTimeout(() => options.handler({ success: true, paymentId: `pay_mock_${Date.now()}` }), 800)
    return
  }

  const Razorpay = (window as unknown as { Razorpay: new (opts: unknown) => { open: () => void } }).Razorpay
  const rzp = new Razorpay({
    key: RAZORPAY_KEY,
    order_id: options.orderId,
    amount: options.amount * 100,
    currency: 'INR',
    name: options.name,
    description: options.description,
    prefill: options.prefill,
    theme: { color: '#8C3A36' },
    handler: (response: { razorpay_payment_id: string }) =>
      options.handler({ success: true, paymentId: response.razorpay_payment_id }),
    modal: {
      ondismiss: () => options.handler({ success: false, error: 'Payment cancelled' }),
    },
  })
  rzp.open()
}

export const isRazorpayEnabled = (): boolean => Boolean(RAZORPAY_KEY)
