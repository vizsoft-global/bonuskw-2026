"use client";

/**
 * Tap Web Checkout SDK v2, loaded from Tap's CDN as a self-contained bundle
 * (it ships its own React, so it does not fight our React 19). The bundle
 * exposes `window.TapPayments.renderCheckout(elementId, config)`.
 *
 * The config is signed server-side (`hashString`) so amount and webhook URL
 * cannot be edited in the browser. Only the publishable key lives here.
 */

export const TAP_CHECKOUT_SDK_URL = "https://tap-sdks.b-cdn.net/checkout/1.1.0/main.js";

export type TapCheckoutPaymentMethod =
  | "KNET"
  | "VISA"
  | "MASTERCARD"
  | "AMEX"
  | "MADA"
  | "APPLE_PAY"
  | "GOOGLE_PAY";

export type TapCheckoutError = {
  code?: string | number;
  message?: string;
  description?: string;
  [key: string]: unknown;
};

export type TapCheckoutConfig = {
  open: boolean;
  hashString: string;
  checkoutMode: "page" | "popup";
  isEmbedded?: boolean;
  amount: number;
  selectedCurrency: "KWD";
  supportedCurrencies: "AUTO" | "ALL" | string[];
  supportedPaymentMethods: "ALL" | TapCheckoutPaymentMethod[];
  paymentType: "WEB" | "CARD" | "DEVICE" | "ALL";
  language?: "en" | "ar";
  themeMode?: "light" | "dark" | "light_mono" | "dark_colored";
  gateway: { publicKey: string; merchantId?: string };
  customer: {
    id?: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    email: string;
    phone: { countryCode: string; number: string };
  };
  transaction: {
    mode: "charge";
    charge: {
      saveCard: boolean;
      threeDSecure: boolean;
      description?: string;
      statement_descriptor?: string;
      reference?: { transaction: string; order: string; idempotent?: string };
      metadata?: Record<string, string>;
      receipt?: { email: boolean; sms: boolean };
      redirect: { url: string };
      post?: string;
    };
  };
  order: {
    id?: string;
    amount: number;
    currency: "KWD";
    items: Array<{
      quantity: number;
      amount: number;
      currency: "KWD";
      name: string;
      description?: string;
      category?: "DIGITAL_GOODS" | "PHYSICAL_GOODS";
    }>;
  };
  cardOptions: {
    showBrands: boolean;
    showLoadingState: boolean;
    collectHolderName: boolean;
    preLoadCardName?: string;
    cardNameEditable: boolean;
    cardFundingSource?: "all" | "credit" | "debit";
    saveCardOption?: "all" | "merchant" | "tap" | "none";
    forceLtr?: boolean;
  };
  isApplePayAvailableOnClient?: boolean;
  onReady?: () => void;
  onSuccess?: (res: { chargeId: string }) => void;
  onError?: (error: TapCheckoutError) => void;
  onClose?: () => void;
  onDimensionChange?: (dimension: { width?: number; height?: number }) => void;
};

type TapPaymentsGlobal = {
  renderCheckout: (elementId: string, config: TapCheckoutConfig) => { unmount: () => void };
};

declare global {
  interface Window {
    TapPayments?: TapPaymentsGlobal;
  }
}

let loader: Promise<TapPaymentsGlobal> | null = null;

/** Injects the CDN script once and resolves with the SDK global. */
export function loadTapCheckout(): Promise<TapPaymentsGlobal> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Tap Checkout SDK is browser-only"));
  }
  if (window.TapPayments) return Promise.resolve(window.TapPayments);
  if (loader) return loader;

  loader = new Promise<TapPaymentsGlobal>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${TAP_CHECKOUT_SDK_URL}"]`,
    );
    const script = existing ?? document.createElement("script");
    const done = () => {
      if (window.TapPayments) resolve(window.TapPayments);
      else reject(new Error("Tap Checkout SDK loaded without TapPayments global"));
    };
    script.addEventListener("load", done, { once: true });
    script.addEventListener(
      "error",
      () => {
        loader = null;
        reject(new Error("Could not load Tap Checkout SDK"));
      },
      { once: true },
    );
    if (!existing) {
      script.src = TAP_CHECKOUT_SDK_URL;
      script.async = true;
      document.head.appendChild(script);
    }
  });
  return loader;
}

/** Shape returned by the admin `/api/checkout/create` when `mode: "sdk"`. */
export type CheckoutSdkPayload = {
  publicKey: string;
  merchantId: string;
  amount: number;
  currency: "KWD";
  transactionRef: string;
  orderRef: string;
  postUrl: string;
  redirectUrl: string;
  hashString: string;
  metadata: Record<string, string>;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: { countryCode: string; number: string };
  };
  items: Array<{ name: string; amount: number; quantity: number; description?: string }>;
};

export function buildTapCheckoutConfig(input: {
  sdk: CheckoutSdkPayload;
  language: "en" | "ar";
  paymentMethods: "ALL" | TapCheckoutPaymentMethod[];
  onSuccess: (res: { chargeId: string }) => void;
  onError: (error: TapCheckoutError) => void;
  onClose?: () => void;
  onReady?: () => void;
}): TapCheckoutConfig {
  const { sdk } = input;
  const publicKey = sdk.publicKey || process.env.NEXT_PUBLIC_TAP_PUBLIC_KEY || "";
  const merchantId = sdk.merchantId || process.env.NEXT_PUBLIC_TAP_MERCHANT_ID || undefined;
  return {
    open: true,
    hashString: sdk.hashString,
    // "page" redirects the tab to Tap's hosted page; "popup" renders the
    // checkout as an in-page dialog, which is the embedded experience we want.
    checkoutMode: "popup",
    amount: sdk.amount,
    selectedCurrency: "KWD",
    supportedCurrencies: ["KWD"],
    supportedPaymentMethods: input.paymentMethods,
    paymentType: "ALL",
    language: input.language,
    themeMode: "light",
    gateway: { publicKey, merchantId },
    customer: {
      firstName: sdk.customer.firstName || "Student",
      lastName: sdk.customer.lastName || "",
      email: sdk.customer.email || "student@bonuskw.com",
      phone: {
        countryCode: sdk.customer.phone.countryCode || "965",
        number: sdk.customer.phone.number || "00000000",
      },
    },
    transaction: {
      mode: "charge",
      charge: {
        saveCard: false,
        threeDSecure: true,
        description: `Order ${sdk.orderRef}`,
        statement_descriptor: "Bonus",
        reference: {
          transaction: sdk.transactionRef,
          order: sdk.orderRef,
          idempotent: sdk.orderRef,
        },
        metadata: sdk.metadata,
        receipt: { email: false, sms: true },
        redirect: { url: sdk.redirectUrl },
        post: sdk.postUrl,
      },
    },
    // `order.id` must be a Tap order id (ord_…), so it is left out; our order
    // id travels in charge.reference and charge.metadata instead.
    order: {
      amount: sdk.amount,
      currency: "KWD",
      items: sdk.items.map((item) => ({
        quantity: item.quantity,
        amount: item.amount,
        currency: "KWD",
        name: item.name,
        description: item.description,
        category: "DIGITAL_GOODS",
      })),
    },
    cardOptions: {
      showBrands: true,
      showLoadingState: true,
      collectHolderName: true,
      cardNameEditable: true,
      cardFundingSource: "all",
      saveCardOption: "none",
      forceLtr: input.language === "ar",
    },
    isApplePayAvailableOnClient: false,
    onReady: input.onReady,
    onSuccess: input.onSuccess,
    onError: input.onError,
    onClose: input.onClose,
  };
}
