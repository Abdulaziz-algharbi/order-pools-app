/**
 * Mock API layer.
 *
 * Every export here returns a Promise and is shaped the way a real HTTP call
 * would be (params in, plain data out). This is the ONLY module that should
 * need to change when the real backend is wired up — pages and components
 * should never reach into `seed.ts` directly.
 */
import type {
  AppNotification,
  AppUser,
  Complaint,
  ComplaintStatus,
  Join,
  Pool,
  PoolParticipant,
  SupplierOffer,
  SupplierOfferStatus,
  SupplierRequest,
  SupplierUser,
} from "@/types/domain";
import {
  admins,
  complaints as seedComplaints,
  joins as seedJoins,
  notifications as seedNotifications,
  poolParticipants as seedPoolParticipants,
  pools as seedPools,
  retailers,
  supplierOffers as seedSupplierOffers,
  supplierRequests as seedSupplierRequests,
  suppliers,
} from "@/mocks/seed";

const LATENCY_MS = 350;

function delay<T>(value: T, ms = LATENCY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

// In-memory mutable stores, seeded once per session.
const pools = clone(seedPools);
const participants = clone(seedPoolParticipants);
const joins = clone(seedJoins);
const offers = clone(seedSupplierOffers);
const complaints = clone(seedComplaints);
const notifications = clone(seedNotifications);
const supplierRequests = clone(seedSupplierRequests);
let supplierList: SupplierUser[] = clone(suppliers);

const allUsers: AppUser[] = [...retailers, ...suppliers, ...admins];

function genId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// Auth (mock only — no real backend yet)
// ---------------------------------------------------------------------------

export function getDemoAccounts(): Promise<AppUser[]> {
  return delay(clone(allUsers), 150);
}

export function findUserById(id: string): Promise<AppUser | undefined> {
  return delay(clone(allUsers.find((u) => u.id === id)), 150);
}

// ---------------------------------------------------------------------------
// Pools
// ---------------------------------------------------------------------------

export interface PoolFilter {
  status?: Pool["status"] | Pool["status"][];
  supplierId?: string;
  search?: string;
}

function matchesPoolFilter(pool: Pool, filter?: PoolFilter): boolean {
  if (!filter) return true;
  if (filter.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
    if (!statuses.includes(pool.status)) return false;
  }
  if (filter.supplierId && pool.supplierId !== filter.supplierId) return false;
  if (filter.search) {
    const q = filter.search.toLowerCase();
    if (
      !pool.productName.toLowerCase().includes(q) &&
      !pool.supplierName.toLowerCase().includes(q) &&
      !pool.category.toLowerCase().includes(q)
    ) {
      return false;
    }
  }
  return true;
}

export function listPools(filter?: PoolFilter): Promise<Pool[]> {
  return delay(clone(pools.filter((p) => matchesPoolFilter(p, filter))));
}

export function getPool(id: string): Promise<Pool | undefined> {
  return delay(clone(pools.find((p) => p.id === id)));
}

export function listPoolParticipants(poolId: string): Promise<PoolParticipant[]> {
  return delay(clone(participants.filter((p) => p.poolId === poolId)));
}

export interface JoinPoolInput {
  poolId: string;
  retailerId: string;
  retailerName: string;
  quantity: number;
}

export async function joinPool(input: JoinPoolInput): Promise<{ pool: Pool; join: Join }> {
  const pool = pools.find((p) => p.id === input.poolId);
  if (!pool) throw new Error("Pool not found");
  if (pool.status !== "active") throw new Error("This pool is no longer accepting contributions");
  if (input.quantity < pool.minContribution) {
    throw new Error(`Minimum contribution is ${pool.minContribution} ${pool.unit}`);
  }

  const remaining = pool.targetQuantity - pool.currentQuantity;
  const quantity = Math.min(input.quantity, remaining);

  pool.currentQuantity += quantity;
  pool.participantCount += 1;
  if (pool.currentQuantity >= pool.targetQuantity) {
    pool.status = "met";
  }

  const participant: PoolParticipant = {
    poolId: pool.id,
    retailerId: input.retailerId,
    retailerName: input.retailerName,
    quantity,
    joinedAt: new Date().toISOString(),
  };
  participants.push(participant);

  const join: Join = {
    id: genId("join"),
    poolId: pool.id,
    retailerId: input.retailerId,
    quantity,
    totalPrice: Math.round(quantity * pool.unitPrice * 100) / 100,
    joinedAt: participant.joinedAt,
  };
  joins.push(join);

  return delay({ pool: clone(pool), join: clone(join) });
}

export function listJoinsByRetailer(retailerId: string): Promise<Join[]> {
  return delay(clone(joins.filter((j) => j.retailerId === retailerId)));
}

export async function assignDelivery(
  poolId: string,
  driverName: string,
  driverPhone: string,
  estimatedArrival: string,
): Promise<Pool> {
  const pool = pools.find((p) => p.id === poolId);
  if (!pool) throw new Error("Pool not found");
  pool.status = "delivery_assigned";
  pool.delivery = {
    id: genId("del"),
    poolId,
    status: "assigned",
    driverName,
    driverPhone,
    assignedAt: new Date().toISOString(),
    estimatedArrival,
    updates: [
      {
        id: genId("upd"),
        timestamp: new Date().toISOString(),
        message: `Driver ${driverName} assigned by admin.`,
      },
    ],
  };
  return delay(clone(pool));
}

// ---------------------------------------------------------------------------
// Supplier offers
// ---------------------------------------------------------------------------

export interface OfferFilter {
  status?: SupplierOfferStatus | SupplierOfferStatus[];
  supplierId?: string;
}

function matchesOfferFilter(offer: SupplierOffer, filter?: OfferFilter): boolean {
  if (!filter) return true;
  if (filter.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
    if (!statuses.includes(offer.status)) return false;
  }
  if (filter.supplierId && offer.supplierId !== filter.supplierId) return false;
  return true;
}

export function listOffers(filter?: OfferFilter): Promise<SupplierOffer[]> {
  return delay(clone(offers.filter((o) => matchesOfferFilter(o, filter))));
}

export function getOffer(id: string): Promise<SupplierOffer | undefined> {
  return delay(clone(offers.find((o) => o.id === id)));
}

export interface CreateOfferInput {
  supplierId: string;
  supplierName: string;
  productName: string;
  productDescription: string;
  category: string;
  targetQuantity: number;
  unit: string;
  minContribution: number;
  unitPrice: number;
  proposedDeadline: string;
}

export async function createOffer(input: CreateOfferInput): Promise<SupplierOffer> {
  const offer: SupplierOffer = {
    id: genId("offer"),
    status: "pending_review",
    submittedAt: new Date().toISOString(),
    ...input,
  };
  offers.unshift(offer);
  return delay(clone(offer));
}

export type OfferDecision = "accepted" | "negotiation" | "refused";

export async function decideOffer(
  id: string,
  decision: OfferDecision,
  adminNote?: string,
): Promise<SupplierOffer> {
  const offer = offers.find((o) => o.id === id);
  if (!offer) throw new Error("Offer not found");
  offer.status = decision;
  offer.decidedAt = new Date().toISOString();
  if (adminNote) offer.adminNote = adminNote;

  if (decision === "accepted") {
    const pool: Pool = {
      id: genId("pool"),
      offerId: offer.id,
      supplierId: offer.supplierId,
      supplierName: offer.supplierName,
      productName: offer.productName,
      productDescription: offer.productDescription,
      productImageUrl: offer.productImageUrl,
      category: offer.category,
      targetQuantity: offer.targetQuantity,
      currentQuantity: 0,
      unit: offer.unit,
      minContribution: offer.minContribution,
      unitPrice: offer.unitPrice,
      startDate: new Date().toISOString(),
      deadline: offer.proposedDeadline,
      status: "active",
      participantCount: 0,
    };
    pools.unshift(pool);
  }

  return delay(clone(offer));
}

// ---------------------------------------------------------------------------
// Complaints
// ---------------------------------------------------------------------------

export interface ComplaintFilter {
  status?: ComplaintStatus | ComplaintStatus[];
  retailerId?: string;
}

function matchesComplaintFilter(c: Complaint, filter?: ComplaintFilter): boolean {
  if (!filter) return true;
  if (filter.status) {
    const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
    if (!statuses.includes(c.status)) return false;
  }
  if (filter.retailerId && c.retailerId !== filter.retailerId) return false;
  return true;
}

export function listComplaints(filter?: ComplaintFilter): Promise<Complaint[]> {
  return delay(clone(complaints.filter((c) => matchesComplaintFilter(c, filter))));
}

export interface CreateComplaintInput {
  retailerId: string;
  retailerName: string;
  poolId?: string;
  subject: string;
  description: string;
}

export async function createComplaint(input: CreateComplaintInput): Promise<Complaint> {
  const complaint: Complaint = {
    id: genId("comp"),
    status: "open",
    createdAt: new Date().toISOString(),
    ...input,
  };
  complaints.unshift(complaint);
  return delay(clone(complaint));
}

export async function respondToComplaint(
  id: string,
  response: string,
  status: ComplaintStatus,
): Promise<Complaint> {
  const complaint = complaints.find((c) => c.id === id);
  if (!complaint) throw new Error("Complaint not found");
  complaint.response = response;
  complaint.respondedAt = new Date().toISOString();
  complaint.status = status;
  return delay(clone(complaint));
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export function listNotifications(userId: string): Promise<AppNotification[]> {
  return delay(
    clone(
      notifications
        .filter((n) => n.userId === userId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    ),
  );
}

export async function markNotificationRead(id: string): Promise<void> {
  const n = notifications.find((n) => n.id === id);
  if (n) n.read = true;
  return delay(undefined, 100);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  notifications.filter((n) => n.userId === userId).forEach((n) => (n.read = true));
  return delay(undefined, 100);
}

// ---------------------------------------------------------------------------
// Suppliers & retailers (admin management)
// ---------------------------------------------------------------------------

export function listSuppliers(): Promise<SupplierUser[]> {
  return delay(clone(supplierList));
}

export function listRetailers() {
  return delay(clone(retailers));
}

export interface CreateSupplierInput {
  name: string;
  email: string;
  companyName: string;
  phone?: string;
  address?: string;
}

export async function createSupplier(input: CreateSupplierInput): Promise<SupplierUser> {
  const supplier: SupplierUser = {
    id: genId("sup"),
    role: "supplier",
    verified: true,
    createdAt: new Date().toISOString(),
    ...input,
  };
  supplierList = [supplier, ...supplierList];
  return delay(clone(supplier));
}

export async function deleteSupplier(id: string): Promise<void> {
  supplierList = supplierList.filter((s) => s.id !== id);
  return delay(undefined, 200);
}

export function listSupplierRequests(): Promise<SupplierRequest[]> {
  return delay(clone(supplierRequests));
}

export async function decideSupplierRequest(
  id: string,
  decision: "approved" | "rejected",
): Promise<SupplierRequest> {
  const req = supplierRequests.find((r) => r.id === id);
  if (!req) throw new Error("Request not found");
  req.status = decision;
  if (decision === "approved") {
    supplierList = [
      {
        id: genId("sup"),
        role: "supplier",
        name: req.applicantName,
        email: req.applicantEmail,
        companyName: req.companyName,
        verified: true,
        createdAt: new Date().toISOString(),
      },
      ...supplierList,
    ];
  }
  return delay(clone(req));
}
