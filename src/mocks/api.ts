/**
 * API layer — thin, typed wrappers around the real backend
 * (order-pools-backend `/api/v1/*`). Pages/components only ever import
 * from this module, never call `lib/http` directly, so this stays the one
 * place that knows each endpoint's request/response shape.
 *
 * Response envelopes are NOT uniform across the backend — most
 * getById/list/update calls return `{ message, data }`, several `create`
 * calls return the raw saved document, and `/auth/me` returns `{ user }`
 * — each function below unwraps whatever its specific endpoint actually
 * sends (see order-pools-backend docs), not a single assumed shape.
 */
import { request } from "@/lib/http";
import type {
  Address,
  AppNotification,
  AppUser,
  Complaint,
  ComplaintPriority,
  ComplaintStatus,
  Delivery,
  DeliveryStatus,
  Payment,
  Pool,
  PoolParticipant,
  PoolStatus,
  ProductOffer,
  ProductOfferStatus,
  ProductOfferUnit,
  SupplierPaymentStatus,
  SupplierRequest,
} from "@/types/domain";

interface Envelope<T> {
  message: string;
  data: T;
  total?: number;
  page?: number;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function login(
  email: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  return request("/auth/login", { method: "POST", body: { email, password }, auth: false });
}

export async function logout(): Promise<void> {
  await request("/auth/logout", { method: "POST" });
}

export async function fetchCurrentUser(): Promise<AppUser> {
  const res = await request<{ user: AppUser }>("/auth/me");
  return res.user;
}

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------

export interface CreateAddressInput {
  location: string;
  region: string;
  city: string;
  street?: string;
}

export async function listMyAddresses(): Promise<Address[]> {
  const res = await request<Envelope<Address[]>>("/addresses");
  return res.data;
}

export async function createAddress(input: CreateAddressInput): Promise<Address> {
  return request<Address>("/addresses", { method: "POST", body: input });
}

// Unauthenticated on purpose — mirrors how a brand-new account creates its
// first address before it has a token (see AuthController.register). Used
// by createSupplierAccount() below so an admin can hand a new supplier an
// address without first inventing a user_ref for a user that doesn't
// exist yet.
async function createUnlinkedAddress(input: CreateAddressInput): Promise<Address> {
  return request<Address>("/addresses", { method: "POST", body: input, auth: false });
}

// ---------------------------------------------------------------------------
// Pools
// ---------------------------------------------------------------------------

export interface PoolFilter {
  status?: PoolStatus | PoolStatus[];
}

// The backend doesn't take a status query param (visibility is role-scoped
// server-side, but status filtering within what's visible is left to the
// caller) — filtered client-side over whatever the caller is allowed to see.
export async function listPools(filter?: PoolFilter): Promise<Pool[]> {
  const res = await request<Envelope<Pool[]>>("/pools");
  const pools = [...res.data].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  if (!filter?.status) return pools;
  const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
  return pools.filter((p) => statuses.includes(p.status));
}

export async function getPool(id: string): Promise<Pool> {
  const res = await request<Envelope<Pool>>(`/pools/${id}`);
  return res.data;
}

export interface CreatePoolInput {
  productoffer_ref: string;
  currentQuantity: number;
  minimumContribution: number;
  pricePerUnit: number;
  startDate?: string;
  endDate: string;
}

// ADMIN only, and only from an APPROVED offer — the backend snapshots the
// offer's display fields (name/description/image/unit) and its supplier's
// company name onto the pool itself at creation time.
export async function createPool(input: CreatePoolInput): Promise<Pool> {
  return request<Pool>("/pools", { method: "POST", body: input });
}

export interface UpdatePoolInput {
  currentQuantity?: number;
  minimumContribution?: number;
  pricePerUnit?: number;
  startDate?: string;
  endDate?: string;
  status?: PoolStatus;
  supplierPaymentStatus?: SupplierPaymentStatus;
}

export async function updatePool(id: string, patch: UpdatePoolInput): Promise<Pool> {
  const res = await request<Envelope<Pool>>(`/pools/${id}`, { method: "PATCH", body: patch });
  return res.data;
}

export async function expirePool(
  id: string,
): Promise<{ pool: Pool; refundsRequested: number; refundsFailed: number }> {
  const res = await request<{
    message: string;
    data: Pool;
    refundsRequested: number;
    refundsFailed: number;
  }>(`/pools/${id}/expire`, { method: "POST" });
  return { pool: res.data, refundsRequested: res.refundsRequested, refundsFailed: res.refundsFailed };
}

// ---------------------------------------------------------------------------
// Pool participants (joining/withdrawing) & payments
// ---------------------------------------------------------------------------

export async function listPoolParticipants(poolId: string): Promise<PoolParticipant[]> {
  const res = await request<Envelope<PoolParticipant[]>>("/participants", {
    query: { pool_ref: poolId },
  });
  return res.data;
}

// A retailer's own participation records across every pool they've joined.
export async function listMyParticipants(): Promise<PoolParticipant[]> {
  const res = await request<Envelope<PoolParticipant[]>>("/participants");
  return res.data;
}

export interface JoinPoolInput {
  pool_ref: string;
  address_ref: string;
  quantity: number;
}

export interface JoinPoolResult {
  participant: PoolParticipant;
  payment: { _id: string; amount: number; status: string };
  checkoutUrl: string;
}

// Reserves the quantity and opens a Thawani checkout session — the caller
// is expected to redirect the browser to `checkoutUrl` to actually pay.
export async function joinPool(input: JoinPoolInput): Promise<JoinPoolResult> {
  const res = await request<{
    message: string;
    data: PoolParticipant;
    payment: { _id: string; amount: number; status: string };
    checkoutUrl: string;
  }>("/participants", { method: "POST", body: input });
  return { participant: res.data, payment: res.payment, checkoutUrl: res.checkoutUrl };
}

export async function withdrawParticipant(id: string): Promise<void> {
  await request(`/participants/${id}`, { method: "DELETE" });
}

export async function getPayment(id: string): Promise<Payment> {
  const res = await request<Envelope<Payment>>(`/payments/${id}`);
  return res.data;
}

// Re-checks a payment's Thawani session and settles it if paid — this is
// what the checkout success/cancel landing page calls to reconcile.
export async function confirmPayment(id: string): Promise<Payment> {
  const res = await request<Envelope<Payment>>(`/payments/${id}/confirm`, { method: "POST" });
  return res.data;
}

export async function cancelPayment(id: string): Promise<Payment> {
  const res = await request<Envelope<Payment>>(`/payments/${id}/cancel`, { method: "POST" });
  return res.data;
}

// ---------------------------------------------------------------------------
// Deliveries
// ---------------------------------------------------------------------------

export async function listDeliveries(): Promise<Delivery[]> {
  const res = await request<Envelope<Delivery[]>>("/deliveries");
  return res.data;
}

export async function getDeliveryForPool(poolId: string): Promise<Delivery | undefined> {
  const deliveries = await listDeliveries();
  return deliveries.find((d) => d.pool_ref === poolId);
}

// ADMIN only. A pool must have already reached its target (TARGET_REACHED)
// before a delivery can be created for it.
export async function createDelivery(poolId: string): Promise<Delivery> {
  return request<Delivery>("/deliveries", { method: "POST", body: { pool_ref: poolId } });
}

export async function updateDeliveryStatus(
  id: string,
  deliveryStatus: DeliveryStatus,
): Promise<Delivery> {
  const body: { deliveryStatus: DeliveryStatus; deliveredAt?: string } = { deliveryStatus };
  if (deliveryStatus === "DELIVERED") body.deliveredAt = new Date().toISOString();
  const res = await request<Envelope<Delivery>>(`/deliveries/${id}`, { method: "PATCH", body });
  return res.data;
}

// ---------------------------------------------------------------------------
// Product offers (supplier wholesale listings, admin-reviewed)
// ---------------------------------------------------------------------------

export interface OfferFilter {
  status?: ProductOfferStatus | ProductOfferStatus[];
}

export async function listOffers(filter?: OfferFilter): Promise<ProductOffer[]> {
  const res = await request<Envelope<ProductOffer[]>>("/offers");
  const offers = [...res.data].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  if (!filter?.status) return offers;
  const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
  return offers.filter((o) => statuses.includes(o.status));
}

export async function getOffer(id: string): Promise<ProductOffer> {
  const res = await request<Envelope<ProductOffer>>(`/offers/${id}`);
  return res.data;
}

export interface CreateOfferInput {
  name: string;
  description: string;
  brand?: string | null;
  unit?: ProductOfferUnit;
  images?: string | null;
  wholeQuantity: number;
  price: number;
}

export async function createOffer(input: CreateOfferInput): Promise<ProductOffer> {
  return request<ProductOffer>("/offers", { method: "POST", body: input });
}

export interface UpdateOwnOfferInput {
  name?: string;
  description?: string;
  brand?: string | null;
  unit?: ProductOfferUnit;
  images?: string | null;
  wholeQuantity?: number;
  price?: number;
}

// The owning SUPPLIER's edit surface — product details/commercial terms.
export async function updateOwnOffer(id: string, patch: UpdateOwnOfferInput): Promise<ProductOffer> {
  const res = await request<Envelope<ProductOffer>>(`/offers/${id}`, { method: "PATCH", body: patch });
  return res.data;
}

// ADMIN's review surface — status/adminComment only.
export async function reviewOffer(
  id: string,
  patch: { status: ProductOfferStatus; adminComment?: string },
): Promise<ProductOffer> {
  const res = await request<Envelope<ProductOffer>>(`/offers/${id}`, { method: "PATCH", body: patch });
  return res.data;
}

export async function deleteOffer(id: string): Promise<void> {
  await request(`/offers/${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Complaints
// ---------------------------------------------------------------------------

export interface ComplaintFilter {
  status?: ComplaintStatus | ComplaintStatus[];
}

export async function listComplaints(filter?: ComplaintFilter): Promise<Complaint[]> {
  const res = await request<Envelope<Complaint[]>>("/complaints");
  if (!filter?.status) return res.data;
  const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
  return res.data.filter((c) => statuses.includes(c.status));
}

export interface CreateComplaintInput {
  pool_ref: string;
  title: string;
  description: string;
  priority?: ComplaintPriority;
}

export async function createComplaint(input: CreateComplaintInput): Promise<Complaint> {
  return request<Complaint>("/complaints", { method: "POST", body: input });
}

// The filer's own edit surface.
export async function updateOwnComplaint(
  id: string,
  patch: { title?: string; description?: string; priority?: ComplaintPriority },
): Promise<Complaint> {
  const res = await request<Envelope<Complaint>>(`/complaints/${id}`, { method: "PATCH", body: patch });
  return res.data;
}

// ADMIN's response surface.
export async function respondToComplaint(
  id: string,
  patch: { resolution?: string; status?: ComplaintStatus },
): Promise<Complaint> {
  const res = await request<Envelope<Complaint>>(`/complaints/${id}`, { method: "PATCH", body: patch });
  return res.data;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

// Always scoped to the caller by the backend — there's no userId param to
// pass; a non-admin's `recipients[]` also comes back redacted to just
// their own entry.
export async function listNotifications(): Promise<AppNotification[]> {
  const res = await request<Envelope<AppNotification[]>>("/notifications");
  return [...res.data].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function markNotificationRead(id: string, isRead = true): Promise<AppNotification> {
  const res = await request<Envelope<AppNotification>>(`/notifications/${id}`, {
    method: "PATCH",
    body: { isRead },
  });
  return res.data;
}

// ---------------------------------------------------------------------------
// Users, suppliers & retailers (admin management)
// ---------------------------------------------------------------------------

async function listUsers(): Promise<AppUser[]> {
  const res = await request<Envelope<AppUser[]>>("/users");
  return res.data;
}

export async function getUserById(id: string): Promise<AppUser> {
  const res = await request<{ message: string; data: AppUser }>(`/users/${id}`);
  return res.data;
}

export async function listSuppliers(): Promise<AppUser[]> {
  const users = await listUsers();
  return users
    .filter((u) => u.roles.includes("SUPPLIER"))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function listRetailers(): Promise<AppUser[]> {
  const users = await listUsers();
  return users
    .filter((u) => u.roles.includes("RETAILER"))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export interface CreateSupplierAccountInput {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  companyName: string;
  password: string;
  address: CreateAddressInput;
}

// Admin-created supplier accounts are pre-approved (skip the
// supplier-request review flow) — the backend requires at least one
// address on account creation, so this creates one (unlinked) first.
export async function createSupplierAccount(input: CreateSupplierAccountInput): Promise<AppUser> {
  const address = await createUnlinkedAddress(input.address);
  return request<AppUser>("/users", {
    method: "POST",
    body: {
      roles: ["SUPPLIER"],
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phoneNumber: input.phoneNumber,
      companyName: input.companyName,
      password: input.password,
      addresses: [address._id],
    },
  });
}

export async function deleteUser(id: string): Promise<void> {
  await request(`/users/${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Supplier requests (retailer -> supplier promotion)
// ---------------------------------------------------------------------------

export async function listSupplierRequests(): Promise<SupplierRequest[]> {
  const res = await request<Envelope<SupplierRequest[]>>("/supplier-requests");
  return [...res.data].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function createSupplierRequest(description: string): Promise<SupplierRequest> {
  const res = await request<{ message: string; data: SupplierRequest }>("/supplier-requests", {
    method: "POST",
    body: { description },
  });
  return res.data;
}

export async function decideSupplierRequest(
  id: string,
  patch: { status: "APPROVED" | "REJECTED"; adminComment?: string },
): Promise<SupplierRequest> {
  const res = await request<Envelope<SupplierRequest>>(`/supplier-requests/${id}`, {
    method: "PATCH",
    body: patch,
  });
  return res.data;
}
