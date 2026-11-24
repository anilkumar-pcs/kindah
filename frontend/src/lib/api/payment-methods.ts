import { ApiError, apiFetch } from "@/lib/api/client";

export type PaymentMethod = {
  maskedVpa: string;
  version: number;
  status: "ACTIVE" | "INACTIVE";
  validationStatus: "SYNTAX_ONLY" | "PROVIDER_VALIDATED";
  privacyAckAt: string;
  updatedAt: string;
};

export async function getPaymentMethod(): Promise<PaymentMethod | null> {
  try {
    return await apiFetch<PaymentMethod>("/api/v1/me/payment-method");
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function savePaymentMethod(
  vpa: string,
  privacyAcknowledged: boolean,
): Promise<PaymentMethod> {
  return apiFetch<PaymentMethod>("/api/v1/me/payment-method", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vpa, privacyAcknowledged }),
  });
}
