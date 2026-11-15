# FINAL_STAGE_DEFERRED.md — Final Stage Implementation Registry

> **Policy Directive**: This registry holds all high-risk, third-party licensed, payment gateway, and SMS DLT integrations that are intentionally deferred to the final pre-launch stage of app development.
> Whenever instructed to "build remaining things", **always keep these items aside in this document** until the user explicitly requests final-stage production gateway activation.

---

## 1. RB-5 / DEV-3: SMS Gateway Integration & DLT-Compliant OTP System

* **Current Status**: Development OTP is logged to backend console; no third-party SMS aggregator charges incurred during development.
* **Why Deferred**: Requires Indian Telecom DLT registration (Jio / Airtel / Vodafone Idea telemarketer portal), Entity ID approval, Sender Header ID registration (e.g. `CTYLOC`), and DLT-approved SMS content templates.
* **Final Stage Execution Checklist**:
  1. **DLT Onboarding**:
     - Register enterprise on Jio/Vil/Airtel DLT portal.
     - Register Approved Sender Header (e.g. `CTYLCL`).
     - Register Approved Transactional OTP Template: `{#var#} is your verification code for CityLocalShop. Valid for 5 minutes. Do not share with anyone. {#var#}` (includes 11-char Android SMS Retriever app hash).
  2. **SMS Aggregator Provider Setup**:
     - Create production account on MSG91, Twilio Verify, or Fast2SMS.
     - Configure credentials in backend `env.ts`: `SMS_PROVIDER="msg91"`, `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID`.
     - Implement provider interface in `CityLocalShop/server/src/modules/auth/sms.provider.ts`:
       ```ts
       export interface SmsProvider {
         sendOtp(phone: string, otp: string): Promise<boolean>;
       }
       ```
  3. **Brute-Force & Anti-Pumping Security**:
     - Store HMAC-SHA256 hashed OTP in Redis with 300s TTL.
     - Enforce maximum 5 verification attempts per phone before 15-minute lockout.
     - Enforce 30-second resend cooldown timer and maximum 5 OTP dispatches per phone per hour.
     - Restrict SMS dispatch to Indian international dial code (+91) to prevent international SMS pumping fraud.
  4. **Android Auto-Read Verification**:
     - Wire Capacitor SMS Retriever plugin with 11-character app certificate signature hash.

---

## 2. RB-8 / DEV Section 5: Razorpay Payment Gateway Live Keys, Route Transfers & Automated Settlement

* **Current Status**: Express backend handles COD bookings, wallet credits split, and Razorpay test/sandbox order creation & refund signatures cleanly. Live gateway keys and automated merchant route transfers are deferred.
* **Why Deferred**: Requires Razorpay Route merchant marketplace approval, active corporate current account, and live KYC activation before live transactions and route splits can execute.
* **Final Stage Execution Checklist**:
  1. **Razorpay Live Key Rotation**:
     - Swap test key IDs for production live keys via AWS SSM / Doppler / Secret Manager: `RAZORPAY_KEY_ID="rzp_live_..."`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
     - Assert in `env.ts` that `NODE_ENV === 'production'` strictly rejects test keys (`rzp_test_...`).
  2. **Raw Body Webhook Signature Validation**:
     - Verify `x-razorpay-signature` on incoming webhooks (`payment.captured`, `payment.failed`, `refund.processed`, `transfer.processed`) against the unparsed raw request buffer (`express.raw({ type: 'application/json' })`).
     - Record idempotency by logging `razorpay_event_id` into `payment_events` table to prevent double-crediting or duplicate status transitions.
  3. **Razorpay Route Marketplace Automated Split Settlement**:
     - On order completion/delivery, trigger Razorpay Route Transfer:
       ```ts
       razorpay.transfers.create({
         account: shop.razorpayAccountId,
         amount: Math.round(order.total * 100),
         currency: "INR",
         notes: { orderId: order.id }
       });
       ```
     - Enforce platform commission deduction before transfer dispatch.
  4. **Automated Reconciliation & Unsettled Escrow Sweep**:
     - Nightly BullMQ cron reconciling Razorpay Settlement Ledger against local `orders` and `shop_payout_accounts`.
     - Flag discrepancies > ₹0 into admin dispute alerts.

---

## Living Deferred Register (Additions Log)

* *2026-11-16*: Added RB-5 (DLT SMS Gateway & Msg91 Integration) and RB-8 (Razorpay Live Keys & Route Transfers) per user directive.
