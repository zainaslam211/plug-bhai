/** Provider boundary. No online adapter is registered or simulated. */
export type PaymentState='pending'|'paid'|'failed'|'cancelled'|'refunded'|'partially_refunded';
export type PaymentIntent={orderId:string;amountPaisa:number;currency:'PKR';returnUrl:string;idempotencyKey:string};
export type VerifiedPaymentEvent={eventId:string;orderId:string;transactionReference:string;amountPaisa:number;currency:'PKR';state:PaymentState};
export interface PaymentProvider {
 readonly id:string;
 initiate(intent:PaymentIntent):Promise<{reference:string;redirectUrl:string}>;
 verifyWebhook(rawBody:Uint8Array,headers:Headers):Promise<VerifiedPaymentEvent>;
}
const providers=new Map<string,PaymentProvider>();
export function registerProvider(provider:PaymentProvider){providers.set(provider.id,provider)}
export function getProvider(id:string):PaymentProvider{const provider=providers.get(id);if(!provider)throw new Error(`${id} is not configured or verified. Online payments are unavailable.`);return provider}
export const paymentMethods=[{id:'cod',label:'Cash on delivery',status:'available'},{id:'bank',label:'Bank transfer',status:'requires-store-configuration'},{id:'easypaisa',label:'Easypaisa',status:'unconfigured'},{id:'jazzcash',label:'JazzCash',status:'unconfigured'},{id:'card',label:'Debit / credit card',status:'unconfigured'}] as const;
