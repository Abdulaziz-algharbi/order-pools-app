import type { Payment, Pool, PoolParticipant } from "@/types/domain";

export function makePool(overrides: Partial<Pool> = {}): Pool {
  return {
    _id: "pool-1",
    productoffer_ref: "offer-1",
    productName: "Basmati Rice 25kg",
    productDescription: "Premium long grain",
    productImages: [],
    unit: "BOX",
    supplierName: "Gulf Foods",
    targetQuantity: 100,
    currentQuantity: 40,
    minimumContribution: 5,
    pricePerUnit: 12,
    startDate: "2026-09-01T00:00:00.000Z",
    endDate: "2026-10-01T00:00:00.000Z",
    status: "OPEN",
    supplierPaymentStatus: "NOT_PAID",
    participantCount: 3,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeParticipant(overrides: Partial<PoolParticipant> = {}): PoolParticipant {
  return {
    _id: "participant-1",
    user_ref: "user-1",
    pool_ref: "pool-1",
    payment_ref: "payment-1",
    address_ref: "address-1",
    quantity: 10,
    status: "WAITING",
    createdAt: "2026-09-02T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
    ...overrides,
  };
}

export function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    _id: "payment-1",
    pool_ref: "pool-1",
    poolParticipant_ref: "participant-1",
    user_ref: "user-1",
    amount: 120,
    currency: "OMR",
    thawaniSessionId: "sess-1",
    status: "COMPLETED",
    createdAt: "2026-09-02T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
    ...overrides,
  } as Payment;
}
