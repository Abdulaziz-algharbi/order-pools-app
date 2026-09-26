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
import { activePanel, panelToRole } from "@/lib/panel";
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
  SupplierPayout,
  SupplierPayoutStatus,
  SupplierRemoveRequest,
  SupplierRequest,
} from "@/types/domain";

// `?as=<role>` for the endpoints whose visibility is the union of every
// role the caller holds (pools, deliveries, notifications): a RETAILER +
// SUPPLIER account browsing the supplier panel should only see its supplier
// side. Derived from the current URL, so every caller gets it for free.
// The backend only lets `as` narrow to a role the caller already holds.
function panelScope(): { as?: string } {
  const panel = activePanel();
  return panel ? { as: panelToRole(panel) } : {};
}

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

// Access/refresh tokens are set as httpOnly cookies by the backend — the
// response body carries no token for this layer to return.
export async function login(email: string, password: string): Promise<void> {
  await request("/auth/login", { method: "POST", body: { email, password }, auth: false });
}

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  companyName: string;
  password: string;
  /** Backend requires at least one already-created address id at registration time. */
  addresses: string[];
}

// Every account starts RETAILER-only (see AuthController.register) — there
// is no way to self-register as SUPPLIER; that's a separate promotion via
// createSupplierRequest() once signed in.
export async function register(input: RegisterInput): Promise<void> {
  await request("/auth/register", { method: "POST", body: input, auth: false });
}

export async function logout(): Promise<void> {
  await request("/auth/logout", { method: "POST" });
}

// The token from the emailed link. Public on the backend — the link may be
// opened while signed out, or on another device.
export async function verifyEmail(token: string): Promise<void> {
  await request("/auth/verify-email", { method: "POST", body: { token }, auth: false });
}

// Signed-in only. Rejects with 409 if already verified and 429 during the
// backend's resend cooldown — both carry a user-readable message.
export async function resendVerificationEmail(): Promise<string> {
  const res = await request<{ message: string }>("/auth/resend-verification", { method: "POST" });
  return res.message;
}

export async function fetchCurrentUser(): Promise<AppUser> {
  const res = await request<{ user: AppUser }>("/auth/me");
  return res.user;
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  companyName?: string;
  password?: string;
  commercialRegistration?: string | null;
  vatNumber?: string | null;
}

// Self-service only — never roles or email (see auth.schema.ts
// updateOwnProfileSchema). A supplied password is re-hashed server-side
// exactly as it is on register.
export async function updateMyProfile(patch: UpdateProfileInput): Promise<AppUser> {
  const res = await request<{ message: string; user: AppUser }>("/auth/me", {
    method: "PATCH",
    body: patch,
  });
  return res.user;
}

// A RETAILER-only caller is deleted immediately (deleted: true). A caller
// holding SUPPLIER instead opens a SupplierRemoveRequest for admin review
// — their account is untouched until that's approved (deleted: false; see
// AuthController.remove).
export async function removeAccount(reason: string): Promise<{ deleted: boolean }> {
  const res = await request<{ message: string; data?: unknown }>("/auth/remove", {
    method: "DELETE",
    body: { reason },
  });
  return { deleted: !res.data };
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

export async function updateAddress(
  id: string,
  patch: Partial<CreateAddressInput>,
): Promise<Address> {
  const res = await request<Envelope<Address>>(`/addresses/${id}`, {
    method: "PATCH",
    body: patch,
  });
  return res.data;
}

export async function deleteAddress(id: string): Promise<void> {
  await request(`/addresses/${id}`, { method: "DELETE" });
}

// Unauthenticated on purpose — mirrors how a brand-new account creates its
// first address before it has a token (see AuthController.register). Used
// by register() (via SignupPage) and createSupplierAccount() below, both
// of which need an address id before a user/token exists to own it.
export async function createUnlinkedAddress(input: CreateAddressInput): Promise<Address> {
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
  const res = await request<Envelope<Pool[]>>("/pools", { query: panelScope() });
  const pools = [...res.data].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  if (!filter?.status) return pools;
  const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
  return pools.filter((p) => statuses.includes(p.status));
}

export async function getPool(id: string): Promise<Pool> {
  const res = await request<Envelope<Pool>>(`/pools/${id}`, { query: panelScope() });
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

// Role-scoped server-side: a non-admin only ever sees their own payments;
// ADMIN sees every payment platform-wide (AdminPaymentsPage uses the same
// call under the listPayments alias below for that reason).
export async function listMyPayments(): Promise<Payment[]> {
  const res = await request<Envelope<Payment[]>>("/payments");
  return res.data;
}

export const listPayments = listMyPayments;

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

// ADMIN only. Re-requests a failed refund against Thawani — only valid
// from REFUND_FAILED.
export async function retryRefund(id: string): Promise<Payment> {
  const res = await request<Envelope<Payment>>(`/payments/${id}/retry-refund`, { method: "POST" });
  return res.data;
}

// ADMIN only. A deliberately manual confirmation (Thawani's refund-status
// response schema isn't confirmed from documentation — see
// thawani.gateway.ts) — only valid from REFUND_PENDING, after the admin has
// checked the Thawani merchant dashboard themselves.
export async function confirmRefund(id: string): Promise<Payment> {
  const res = await request<Envelope<Payment>>(`/payments/${id}/confirm-refund`, { method: "POST" });
  return res.data;
}

// ---------------------------------------------------------------------------
// Deliveries
// ---------------------------------------------------------------------------

export async function listDeliveries(): Promise<Delivery[]> {
  const res = await request<Envelope<Delivery[]>>("/deliveries", { query: panelScope() });
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
// their own entry. Also scoped to the current panel (panelScope): each
// panel shows its own notifications plus panel-agnostic ones.
export async function listNotifications(): Promise<AppNotification[]> {
  const res = await request<Envelope<AppNotification[]>>("/notifications", {
    query: panelScope(),
  });
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

export interface CreateSupplierRequestInput {
  description: string;
  commercialRegistration: string;
  /** Optional — VAT registration is only mandatory above a turnover threshold. */
  vatNumber?: string;
}

export async function createSupplierRequest(
  input: CreateSupplierRequestInput,
): Promise<SupplierRequest> {
  const res = await request<{ message: string; data: SupplierRequest }>("/supplier-requests", {
    method: "POST",
    body: input,
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

// ---------------------------------------------------------------------------
// Supplier removal requests (supplier -> account closure, ADMIN review)
// ---------------------------------------------------------------------------

// No create — a request only ever exists as a side effect of DELETE
// /auth/remove for a caller holding SUPPLIER (see AuthController.remove).
export async function listSupplierRemoveRequests(): Promise<SupplierRemoveRequest[]> {
  const res = await request<Envelope<SupplierRemoveRequest[]>>("/supplier-remove-requests");
  return [...res.data].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

// Approving deletes the requester's User + Auth records outright.
export async function decideSupplierRemoveRequest(
  id: string,
  patch: { status: "APPROVED" | "REJECTED"; adminComment?: string },
): Promise<SupplierRemoveRequest> {
  const res = await request<Envelope<SupplierRemoveRequest>>(`/supplier-remove-requests/${id}`, {
    method: "PATCH",
    body: patch,
  });
  return res.data;
}

// ---------------------------------------------------------------------------
// Supplier payouts
// ---------------------------------------------------------------------------

// Role-scoped server-side: ADMIN sees every payout, SUPPLIER only payouts
// for pools built from their own offers.
export async function listPayouts(): Promise<SupplierPayout[]> {
  const res = await request<Envelope<SupplierPayout[]>>("/payouts");
  return [...res.data].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

// ADMIN only — records the actual (manual, off-Thawani) transfer.
// paidAt is auto-stamped server-side on a transition into COMPLETED
// unless supplied explicitly.
export async function recordPayout(
  id: string,
  patch: { status?: SupplierPayoutStatus; transactionReference?: string; paidAt?: string },
): Promise<SupplierPayout> {
  const res = await request<Envelope<SupplierPayout>>(`/payouts/${id}`, {
    method: "PATCH",
    body: patch,
  });
  return res.data;
}
