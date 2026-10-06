import type {
  AdminOrderRecord,
  FulfillmentAuditLogEntry,
  FulfillmentEventType,
  InventoryReservationItem,
  InventoryReservationStatus,
  OrderDashboardMetrics,
  OrderInventoryDetail,
  OrderLifecycleStatus,
  OrderSummaryItem,
} from './types.ts';
import { isValidStatusTransition } from './order-service.ts';
import type { NotificationEventType, OrderNotificationRecord } from '../notification/types.ts';
import { notificationService } from '../notification/notification-service.ts';

export interface ProductStockItem {
  item_code: string;
  product_name: string;
  variant: string;
  on_hand: number;
  reserved: number;
  available: number; // Invariant: on_hand - reserved
}

const DEFAULT_STOCKS: ProductStockItem[] = [
  {
    item_code: 'CY-FG-PLO-500',
    product_name: 'Plain Pure Original',
    variant: '500ml',
    on_hand: 20,
    reserved: 0,
    available: 20,
  },
  {
    item_code: 'CY-FG-PLO-1000',
    product_name: 'Plain Pure Original',
    variant: '1 Liter',
    on_hand: 15,
    reserved: 0,
    available: 15,
  },
  {
    item_code: 'CY-FG-SBR-1000',
    product_name: 'Stroberi Summer Blush',
    variant: '1 Liter',
    on_hand: 25,
    reserved: 1,
    available: 24,
  },
  {
    item_code: 'CY-FG-MNG-250',
    product_name: 'Mangga Tropical Gold',
    variant: '250ml',
    on_hand: 30,
    reserved: 3,
    available: 27,
  },
  {
    item_code: 'CY-FG-MLN-1000',
    product_name: 'Melon Emerald Fresh',
    variant: '1 Liter',
    on_hand: 20,
    reserved: 0,
    available: 20,
  },
  {
    item_code: 'CY-FG-AGR-250',
    product_name: 'Anggur Royal Purple',
    variant: '250ml',
    on_hand: 20,
    reserved: 0,
    available: 20,
  },
  {
    item_code: 'CY-FG-VNL-1000',
    product_name: 'Vanila Creamy Dream',
    variant: '1 Liter',
    on_hand: 15,
    reserved: 0,
    available: 15,
  },
  {
    item_code: 'CY-FG-LCI-250',
    product_name: 'Leci Sweet Breeze',
    variant: '250ml',
    on_hand: 20,
    reserved: 0,
    available: 20,
  },
];

function createSeedNotification(
  orderId: string,
  orderNumber: string,
  event: NotificationEventType,
  phone: string,
  customerName: string,
  items: { product_name: string; variant: string; quantity: number }[],
  total: number,
  status: string,
  timestamp: string,
  idSuffix: string
): OrderNotificationRecord {
  const notif = notificationService.createManualNotification(
    {
      event,
      order_number: orderNumber,
      customer_name: customerName,
      recipient_phone: phone,
      items,
      total,
      status,
    },
    orderId
  );
  notif.id = `notif-seed-${idSuffix}`;
  notif.created_at = timestamp;
  return notif;
}

const SEED_ORDERS: AdminOrderRecord[] = [
  {
    id: 'ord-seed-0001',
    order_number: 'CMY-20260926-0001',
    order_date: '2026-09-26T14:30:00.000Z',
    customer: {
      name: 'Budi Santoso',
      whatsapp: '08123456789',
      address: 'Jl. Bambu Apus No. 12, Cipayung, Jakarta Timur, DKI Jakarta 13890',
    },
    items: [
      {
        product_name: 'Plain Pure Original',
        variant: '500ml',
        quantity: 2,
        price: 15000,
      },
    ],
    cost: {
      subtotal: 30000,
      shipping_fee: 20000,
      cold_chain_fee: 5000,
      total_amount: 55000,
    },
    payment: {
      method: 'Manual QRIS',
      status: 'PENDING_PAYMENT',
      proof_status: 'waiting_verification',
      proof_url: '/images/payment-proof-placeholder.png',
    },
    order_status: 'WAITING_PAYMENT',
    delivery_method: 'Instant Courier (1-3 hours)',
    inventory: {
      reservation_id: 'res-seed-0001',
      status: 'AVAILABLE',
      summary_status: 'PENDING',
      items: [
        {
          product_name: 'Plain Pure Original',
          variant: '500ml',
          quantity: 2,
          available_stock: 20,
          reserved_quantity: 0,
          status: 'AVAILABLE',
        },
      ],
    },
    audit_logs: [],
    notifications: [
      createSeedNotification(
        'ord-seed-0001',
        'CMY-20260926-0001',
        'ORDER_CREATED',
        '08123456789',
        'Budi Santoso',
        [{ product_name: 'Plain Pure Original', variant: '500ml', quantity: 2 }],
        55000,
        'WAITING_PAYMENT',
        '2026-09-26T14:30:00.000Z',
        '01-1'
      ),
    ],
    created_at: '2026-09-26T14:30:00.000Z',
    updated_at: '2026-09-26T14:30:00.000Z',
  },
  {
    id: 'ord-seed-0002',
    order_number: 'CMY-20260926-0002',
    order_date: '2026-09-26T15:15:00.000Z',
    customer: {
      name: 'Siti Aminah',
      whatsapp: '08139876543',
      address: 'Jl. Fatmawati No. 45, Cilandak, Jakarta Selatan, DKI Jakarta 12430',
    },
    items: [
      {
        product_name: 'Stroberi Summer Blush',
        variant: '1 Liter',
        quantity: 1,
        price: 55000,
      },
    ],
    cost: {
      subtotal: 55000,
      shipping_fee: 15000,
      cold_chain_fee: 5000,
      total_amount: 75000,
    },
    payment: {
      method: 'Manual QRIS',
      status: 'PAID',
      proof_status: 'verified',
      verified_at: '2026-09-26T15:20:00.000Z',
    },
    order_status: 'PROCESSING',
    delivery_method: 'Same Day Delivery',
    inventory: {
      reservation_id: 'res-seed-0002',
      status: 'RESERVED',
      summary_status: 'READY',
      reserved_at: '2026-09-26T15:20:00.000Z',
      items: [
        {
          product_name: 'Stroberi Summer Blush',
          variant: '1 Liter',
          quantity: 1,
          available_stock: 24,
          reserved_quantity: 1,
          status: 'RESERVED',
        },
      ],
    },
    audit_logs: [
      {
        id: 'log-seed-02-1',
        order_id: 'ord-seed-0002',
        order_number: 'CMY-20260926-0002',
        event_type: 'ORDER_PAYMENT_CONFIRMED',
        description: 'Pembayaran dikonfirmasi manual via QRIS (Rp 75.000)',
        timestamp: '2026-09-26T15:20:00.000Z',
        actor: 'system',
      },
      {
        id: 'log-seed-02-2',
        order_id: 'ord-seed-0002',
        order_number: 'CMY-20260926-0002',
        event_type: 'INVENTORY_RESERVED',
        description: 'Stok direservasi: Stroberi Summer Blush 1 Liter x1 (FEFO lot allocation)',
        timestamp: '2026-09-26T15:20:01.000Z',
        actor: 'inventory_service',
      },
      {
        id: 'log-seed-02-3',
        order_id: 'ord-seed-0002',
        order_number: 'CMY-20260926-0002',
        event_type: 'ORDER_PROCESSING',
        description: 'Pesanan mulai disiapkan di Cold Room Hub Bambu Apus',
        timestamp: '2026-09-26T15:20:05.000Z',
        actor: 'admin_user',
      },
    ],
    notifications: [
      createSeedNotification(
        'ord-seed-0002',
        'CMY-20260926-0002',
        'ORDER_CREATED',
        '08139876543',
        'Siti Aminah',
        [{ product_name: 'Stroberi Summer Blush', variant: '1 Liter', quantity: 1 }],
        75000,
        'WAITING_PAYMENT',
        '2026-09-26T15:15:00.000Z',
        '02-1'
      ),
      createSeedNotification(
        'ord-seed-0002',
        'CMY-20260926-0002',
        'PAYMENT_CONFIRMED',
        '08139876543',
        'Siti Aminah',
        [{ product_name: 'Stroberi Summer Blush', variant: '1 Liter', quantity: 1 }],
        75000,
        'PAYMENT_CONFIRMED',
        '2026-09-26T15:20:00.000Z',
        '02-2'
      ),
      createSeedNotification(
        'ord-seed-0002',
        'CMY-20260926-0002',
        'ORDER_PROCESSING',
        '08139876543',
        'Siti Aminah',
        [{ product_name: 'Stroberi Summer Blush', variant: '1 Liter', quantity: 1 }],
        75000,
        'PROCESSING',
        '2026-09-26T15:20:05.000Z',
        '02-3'
      ),
    ],
    created_at: '2026-09-26T15:15:00.000Z',
    updated_at: '2026-09-26T15:20:00.000Z',
  },
  {
    id: 'ord-seed-0003',
    order_number: 'CMY-20260926-0003',
    order_date: '2026-09-26T16:00:00.000Z',
    customer: {
      name: 'Hendro Wijaya',
      whatsapp: '08571234567',
      address: 'Jl. Harapan Indah No. 8, Medan Satria, Kota Bekasi, Jawa Barat 17131',
    },
    items: [
      {
        product_name: 'Mangga Tropical Gold',
        variant: '250ml',
        quantity: 3,
        price: 15000,
      },
    ],
    cost: {
      subtotal: 45000,
      shipping_fee: 20000,
      cold_chain_fee: 5000,
      total_amount: 70000,
    },
    payment: {
      method: 'Transfer Bank (BCA)',
      status: 'PAID',
      proof_status: 'verified',
      verified_at: '2026-09-26T16:05:00.000Z',
    },
    order_status: 'READY_TO_SHIP',
    delivery_method: 'Instant Courier (1-3 hours)',
    inventory: {
      reservation_id: 'res-seed-0003',
      status: 'FULFILLED',
      summary_status: 'FULFILLED',
      reserved_at: '2026-09-26T16:05:00.000Z',
      fulfilled_at: '2026-09-26T16:10:00.000Z',
      items: [
        {
          product_name: 'Mangga Tropical Gold',
          variant: '250ml',
          quantity: 3,
          available_stock: 27,
          reserved_quantity: 3,
          status: 'FULFILLED',
        },
      ],
    },
    audit_logs: [
      {
        id: 'log-seed-03-1',
        order_id: 'ord-seed-0003',
        order_number: 'CMY-20260926-0003',
        event_type: 'ORDER_PAYMENT_CONFIRMED',
        description: 'Pembayaran dikonfirmasi manual via BCA (Rp 70.000)',
        timestamp: '2026-09-26T16:05:00.000Z',
        actor: 'system',
      },
      {
        id: 'log-seed-03-2',
        order_id: 'ord-seed-0003',
        order_number: 'CMY-20260926-0003',
        event_type: 'INVENTORY_RESERVED',
        description: 'Stok direservasi: Mangga Tropical Gold 250ml x3',
        timestamp: '2026-09-26T16:05:01.000Z',
        actor: 'inventory_service',
      },
      {
        id: 'log-seed-03-3',
        order_id: 'ord-seed-0003',
        order_number: 'CMY-20260926-0003',
        event_type: 'ORDER_PROCESSING',
        description: 'Pengemasan Cold Box & Ice Gel dilakukan',
        timestamp: '2026-09-26T16:06:00.000Z',
        actor: 'warehouse_staff',
      },
      {
        id: 'log-seed-03-4',
        order_id: 'ord-seed-0003',
        order_number: 'CMY-20260926-0003',
        event_type: 'ORDER_READY_TO_SHIP',
        description: 'Fulfillment inventaris selesai. Pesanan siap di-pickup driver kurir.',
        timestamp: '2026-09-26T16:10:00.000Z',
        actor: 'warehouse_staff',
      },
    ],
    notifications: [
      createSeedNotification(
        'ord-seed-0003',
        'CMY-20260926-0003',
        'ORDER_CREATED',
        '08571234567',
        'Hendro Wijaya',
        [{ product_name: 'Mangga Tropical Gold', variant: '250ml', quantity: 3 }],
        70000,
        'WAITING_PAYMENT',
        '2026-09-26T16:00:00.000Z',
        '03-1'
      ),
      createSeedNotification(
        'ord-seed-0003',
        'CMY-20260926-0003',
        'PAYMENT_CONFIRMED',
        '08571234567',
        'Hendro Wijaya',
        [{ product_name: 'Mangga Tropical Gold', variant: '250ml', quantity: 3 }],
        70000,
        'PAYMENT_CONFIRMED',
        '2026-09-26T16:05:00.000Z',
        '03-2'
      ),
      createSeedNotification(
        'ord-seed-0003',
        'CMY-20260926-0003',
        'ORDER_PROCESSING',
        '08571234567',
        'Hendro Wijaya',
        [{ product_name: 'Mangga Tropical Gold', variant: '250ml', quantity: 3 }],
        70000,
        'PROCESSING',
        '2026-09-26T16:06:00.000Z',
        '03-3'
      ),
      createSeedNotification(
        'ord-seed-0003',
        'CMY-20260926-0003',
        'ORDER_READY_TO_SHIP',
        '08571234567',
        'Hendro Wijaya',
        [{ product_name: 'Mangga Tropical Gold', variant: '250ml', quantity: 3 }],
        70000,
        'READY_TO_SHIP',
        '2026-09-26T16:10:00.000Z',
        '03-4'
      ),
    ],
    created_at: '2026-09-26T16:00:00.000Z',
    updated_at: '2026-09-26T16:10:00.000Z',
  },
  {
    id: 'ord-seed-0004',
    order_number: 'CMY-20260926-0004',
    order_date: '2026-09-26T10:00:00.000Z',
    customer: {
      name: 'Dewi Lestari',
      whatsapp: '08187654321',
      address: 'Jl. Margonda Raya No. 100, Beji, Kota Depok, Jawa Barat 16424',
    },
    items: [
      {
        product_name: 'Melon Emerald Fresh',
        variant: '1 Liter',
        quantity: 1,
        price: 55000,
      },
    ],
    cost: {
      subtotal: 55000,
      shipping_fee: 0,
      cold_chain_fee: 0,
      total_amount: 55000,
    },
    payment: {
      method: 'Manual QRIS',
      status: 'PAID',
      proof_status: 'verified',
      verified_at: '2026-09-26T10:05:00.000Z',
    },
    order_status: 'DELIVERED',
    delivery_method: 'Pickup Toko (Bambu Apus Hub)',
    inventory: {
      reservation_id: 'res-seed-0004',
      status: 'FULFILLED',
      summary_status: 'FULFILLED',
      reserved_at: '2026-09-26T10:05:00.000Z',
      fulfilled_at: '2026-09-26T12:30:00.000Z',
      items: [
        {
          product_name: 'Melon Emerald Fresh',
          variant: '1 Liter',
          quantity: 1,
          available_stock: 20,
          reserved_quantity: 1,
          status: 'FULFILLED',
        },
      ],
    },
    audit_logs: [
      {
        id: 'log-seed-04-1',
        order_id: 'ord-seed-0004',
        order_number: 'CMY-20260926-0004',
        event_type: 'ORDER_PAYMENT_CONFIRMED',
        description: 'Pembayaran dikonfirmasi (Rp 55.000)',
        timestamp: '2026-09-26T10:05:00.000Z',
        actor: 'system',
      },
      {
        id: 'log-seed-04-2',
        order_id: 'ord-seed-0004',
        order_number: 'CMY-20260926-0004',
        event_type: 'INVENTORY_RESERVED',
        description: 'Stok direservasi untuk pickup: Melon 1L x1',
        timestamp: '2026-09-26T10:05:01.000Z',
        actor: 'inventory_service',
      },
      {
        id: 'log-seed-04-3',
        order_id: 'ord-seed-0004',
        order_number: 'CMY-20260926-0004',
        event_type: 'ORDER_READY_TO_SHIP',
        description: 'Pesanan diambil oleh pelanggan di Hub Bambu Apus',
        timestamp: '2026-09-26T12:30:00.000Z',
        actor: 'admin_user',
      },
    ],
    notifications: [
      createSeedNotification(
        'ord-seed-0004',
        'CMY-20260926-0004',
        'ORDER_CREATED',
        '08187654321',
        'Dewi Lestari',
        [{ product_name: 'Melon Emerald Fresh', variant: '1 Liter', quantity: 1 }],
        55000,
        'WAITING_PAYMENT',
        '2026-09-26T10:00:00.000Z',
        '04-1'
      ),
      createSeedNotification(
        'ord-seed-0004',
        'CMY-20260926-0004',
        'PAYMENT_CONFIRMED',
        '08187654321',
        'Dewi Lestari',
        [{ product_name: 'Melon Emerald Fresh', variant: '1 Liter', quantity: 1 }],
        55000,
        'PAYMENT_CONFIRMED',
        '2026-09-26T10:05:00.000Z',
        '04-2'
      ),
      createSeedNotification(
        'ord-seed-0004',
        'CMY-20260926-0004',
        'ORDER_READY_TO_SHIP',
        '08187654321',
        'Dewi Lestari',
        [{ product_name: 'Melon Emerald Fresh', variant: '1 Liter', quantity: 1 }],
        55000,
        'READY_TO_SHIP',
        '2026-09-26T12:00:00.000Z',
        '04-3'
      ),
      createSeedNotification(
        'ord-seed-0004',
        'CMY-20260926-0004',
        'ORDER_DELIVERED',
        '08187654321',
        'Dewi Lestari',
        [{ product_name: 'Melon Emerald Fresh', variant: '1 Liter', quantity: 1 }],
        55000,
        'DELIVERED',
        '2026-09-26T12:30:00.000Z',
        '04-4'
      ),
    ],
    created_at: '2026-09-26T10:00:00.000Z',
    updated_at: '2026-09-26T12:30:00.000Z',
  },
  {
    id: 'ord-seed-0005',
    order_number: 'CMY-20260926-0005',
    order_date: '2026-09-26T11:30:00.000Z',
    customer: {
      name: 'Rian Kusuma',
      whatsapp: '08129988776',
      address: 'Jl. Salemba Raya No. 15, Senen, Jakarta Pusat, DKI Jakarta 10430',
    },
    items: [
      {
        product_name: 'Anggur Royal Purple',
        variant: '250ml',
        quantity: 2,
        price: 15000,
      },
    ],
    cost: {
      subtotal: 30000,
      shipping_fee: 15000,
      cold_chain_fee: 5000,
      total_amount: 50000,
    },
    payment: {
      method: 'Manual QRIS',
      status: 'FAILED',
      proof_status: 'rejected',
    },
    order_status: 'CANCELLED',
    delivery_method: 'Same Day Delivery',
    inventory: {
      reservation_id: 'res-seed-0005',
      status: 'RELEASED',
      summary_status: 'RELEASED',
      released_at: '2026-09-26T11:45:00.000Z',
      items: [
        {
          product_name: 'Anggur Royal Purple',
          variant: '250ml',
          quantity: 2,
          available_stock: 20,
          reserved_quantity: 0,
          status: 'RELEASED',
        },
      ],
    },
    audit_logs: [
      {
        id: 'log-seed-05-1',
        order_id: 'ord-seed-0005',
        order_number: 'CMY-20260926-0005',
        event_type: 'INVENTORY_RELEASED',
        description: 'Pesanan dibatalkan. Reservasi stok dilepaskan kembali.',
        timestamp: '2026-09-26T11:45:00.000Z',
        actor: 'admin_user',
      },
    ],
    notifications: [
      createSeedNotification(
        'ord-seed-0005',
        'CMY-20260926-0005',
        'ORDER_CREATED',
        '08129988776',
        'Rian Kusuma',
        [{ product_name: 'Anggur Royal Purple', variant: '250ml', quantity: 2 }],
        50000,
        'WAITING_PAYMENT',
        '2026-09-26T11:30:00.000Z',
        '05-1'
      ),
    ],
    created_at: '2026-09-26T11:30:00.000Z',
    updated_at: '2026-09-26T11:45:00.000Z',
  },
];

class AdminOrderStore {
  private orders: AdminOrderRecord[] = [];
  private stocks: Map<string, ProductStockItem> = new Map();

  constructor() {
    this.reset();
  }

  public reset(): void {
    // Deep clone seeds to prevent mutation across resets
    this.orders = JSON.parse(JSON.stringify(SEED_ORDERS)) as AdminOrderRecord[];

    this.stocks.clear();
    for (const item of DEFAULT_STOCKS) {
      const key = this.buildStockKey(item.product_name, item.variant);
      this.stocks.set(key, { ...item });
    }
  }

  private buildStockKey(productName: string, variant: string): string {
    const normName = productName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normVariant = variant.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${normName}__${normVariant}`;
  }

  public getStock(productName: string, variant: string): ProductStockItem | null {
    const key = this.buildStockKey(productName, variant);
    const found = this.stocks.get(key);
    return found ? { ...found } : null;
  }

  public setStock(
    productName: string,
    variant: string,
    onHand: number,
    reserved: number = 0
  ): void {
    if (onHand < 0 || reserved < 0) {
      throw new Error('Negative stock values are strictly prohibited (Task 7)');
    }
    const key = this.buildStockKey(productName, variant);
    const available = Math.max(0, onHand - reserved);
    const existing = this.stocks.get(key);

    this.stocks.set(key, {
      item_code: existing?.item_code || `CY-FG-${key.slice(0, 8).toUpperCase()}`,
      product_name: productName,
      variant,
      on_hand: onHand,
      reserved,
      available,
    });
  }

  /**
   * TASK 2: Stock Availability Check.
   * Checks whether requested quantity <= available stock for each order line.
   */
  public checkStockAvailability(items: OrderSummaryItem[]): {
    available: boolean;
    insufficientItem?: {
      product_name: string;
      variant: string;
      requested: number;
      available: number;
    };
  } {
    for (const item of items) {
      if (item.quantity <= 0) {
        return {
          available: false,
          insufficientItem: {
            product_name: item.product_name,
            variant: item.variant,
            requested: item.quantity,
            available: 0,
          },
        };
      }

      const key = this.buildStockKey(item.product_name, item.variant);
      const stock = this.stocks.get(key);

      // If item not yet tracked, default to available 20 for seamless operation
      const currentAvailable = stock ? stock.available : 20;

      if (item.quantity > currentAvailable) {
        return {
          available: false,
          insufficientItem: {
            product_name: item.product_name,
            variant: item.variant,
            requested: item.quantity,
            available: currentAvailable,
          },
        };
      }
    }

    return { available: true };
  }

  public getOrders(filter?: { status?: string; search?: string }): AdminOrderRecord[] {
    let result = [...this.orders];

    if (filter?.status && filter.status !== 'ALL' && filter.status !== 'all') {
      const normalizedStatus = filter.status.toUpperCase().replace(/\s+/g, '_');
      result = result.filter((o) => o.order_status === normalizedStatus);
    }

    if (filter?.search) {
      const q = filter.search.toLowerCase().trim();
      result = result.filter(
        (o) =>
          o.order_number.toLowerCase().includes(q) ||
          o.customer.name.toLowerCase().includes(q) ||
          o.customer.whatsapp.toLowerCase().includes(q) ||
          o.items.some((i) => i.product_name.toLowerCase().includes(q))
      );
    }

    // Sort descending by created_at
    return result.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  public getOrderById(idOrOrderNumber: string): AdminOrderRecord | null {
    const target = idOrOrderNumber.trim().toLowerCase();
    const found = this.orders.find(
      (o) => o.id.toLowerCase() === target || o.order_number.toLowerCase() === target
    );
    return found ? JSON.parse(JSON.stringify(found)) : null;
  }

  public addOrder(input: Partial<AdminOrderRecord>): AdminOrderRecord {
    const now = new Date().toISOString();
    const id = input.id || `ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const orderNumber = input.order_number || `CMY-${now.slice(0, 10).replace(/-/g, '')}-0001`;

    const existingIndex = this.orders.findIndex((o) => o.order_number === orderNumber);
    if (existingIndex >= 0) {
      return this.orders[existingIndex];
    }

    const items: OrderSummaryItem[] =
      input.items && input.items.length > 0
        ? input.items
        : [
            {
              product_name: 'Plain Pure Original',
              variant: '500ml',
              quantity: 1,
              price: 30000,
            },
          ];

    const inventoryItems: InventoryReservationItem[] = items.map((i) => {
      const stock = this.getStock(i.product_name, i.variant);
      return {
        product_name: i.product_name,
        variant: i.variant,
        quantity: i.quantity,
        available_stock: stock ? stock.available : 20,
        reserved_quantity: 0,
        status: 'AVAILABLE' as InventoryReservationStatus,
      };
    });

    const newOrder: AdminOrderRecord = {
      id,
      order_number: orderNumber,
      order_date: input.order_date || now,
      customer: {
        name: input.customer?.name || 'Pelanggan Callme',
        whatsapp: input.customer?.whatsapp || '08123456789',
        address: input.customer?.address || 'Jakarta Timur, DKI Jakarta',
      },
      items,
      cost: {
        subtotal: input.cost?.subtotal ?? 30000,
        shipping_fee: input.cost?.shipping_fee ?? 20000,
        cold_chain_fee: input.cost?.cold_chain_fee ?? 5000,
        total_amount: input.cost?.total_amount ?? 55000,
      },
      payment: {
        method: input.payment?.method || 'Manual QRIS',
        status: input.payment?.status || 'PENDING_PAYMENT',
        proof_status: input.payment?.proof_status || 'waiting_verification',
        proof_url: input.payment?.proof_url || '/images/payment-proof-placeholder.png',
        verified_at: input.payment?.verified_at,
      },
      order_status: input.order_status || 'WAITING_PAYMENT',
      delivery_method: input.delivery_method || 'Instant Courier (1-3 hours)',
      inventory: input.inventory || {
        reservation_id: `res-${id}`,
        status: 'AVAILABLE',
        summary_status: 'PENDING',
        items: inventoryItems,
      },
      audit_logs: input.audit_logs || [],
      notifications: input.notifications ? [...input.notifications] : [],
      created_at: input.created_at || now,
      updated_at: input.updated_at || now,
    };

    if (newOrder.notifications.length === 0) {
      this.appendNotification(newOrder, 'ORDER_CREATED');
    }

    this.orders.unshift(newOrder);
    return JSON.parse(JSON.stringify(newOrder));
  }

  /**
   * Helper: Appends audit log to order (Task 6: Do not delete history).
   */
  private appendAuditLog(
    order: AdminOrderRecord,
    eventType: FulfillmentEventType,
    description: string,
    actor: string = 'system',
    metadata?: Record<string, unknown>
  ): void {
    const entry: FulfillmentAuditLogEntry = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      order_id: order.id,
      order_number: order.order_number,
      event_type: eventType,
      description,
      timestamp: new Date().toISOString(),
      actor,
      ...(metadata ? { metadata } : {}),
    };
    order.audit_logs.push(entry);
  }

  /**
   * Helper: Dispatches and appends a WhatsApp notification to the order (Phase 1.7C.18 Task 6).
   */
  public appendNotification(
    order: AdminOrderRecord,
    event: NotificationEventType
  ): OrderNotificationRecord {
    const record = notificationService.createManualNotification(
      {
        event,
        order_number: order.order_number,
        customer_name: order.customer.name,
        recipient_phone: order.customer.whatsapp,
        items: order.items.map((i) => ({
          product_name: i.product_name,
          variant: i.variant,
          quantity: i.quantity,
          price: i.price,
        })),
        total: order.cost.total_amount,
        status: order.order_status,
        delivery_method: order.delivery_method,
      },
      order.id
    );

    if (!order.notifications) {
      order.notifications = [];
    }
    order.notifications.push(record);
    return record;
  }

  /**
   * Helper: Reserves stock for confirmed order (Task 1 & Task 4).
   */
  private executeStockReservation(
    order: AdminOrderRecord,
    actor: string = 'inventory_service'
  ): void {
    const now = new Date().toISOString();

    for (const item of order.items) {
      if (item.quantity <= 0) {
        throw new Error('Quantity to reserve must be greater than zero (Task 7)');
      }
      const key = this.buildStockKey(item.product_name, item.variant);
      let stock = this.stocks.get(key);
      if (!stock) {
        stock = {
          item_code: `CY-FG-${key.slice(0, 8).toUpperCase()}`,
          product_name: item.product_name,
          variant: item.variant,
          on_hand: 20,
          reserved: 0,
          available: 20,
        };
        this.stocks.set(key, stock);
      }

      // Reserve required quantity
      stock.reserved += item.quantity;
      stock.available = Math.max(0, stock.on_hand - stock.reserved);
    }

    // Update order inventory details (Task 3 & 5)
    order.inventory.status = 'RESERVED';
    order.inventory.summary_status = 'READY';
    order.inventory.reserved_at = now;

    order.inventory.items = order.items.map((item) => {
      const stock = this.stocks.get(this.buildStockKey(item.product_name, item.variant));
      return {
        product_name: item.product_name,
        variant: item.variant,
        quantity: item.quantity,
        available_stock: stock ? stock.available : 0,
        reserved_quantity: item.quantity,
        status: 'RESERVED',
      };
    });

    const itemDesc = order.items.map((i) => `${i.product_name} ${i.variant} x${i.quantity}`).join(', ');
    this.appendAuditLog(
      order,
      'INVENTORY_RESERVED',
      `Stok berhasil direservasi: ${itemDesc} (Status: RESERVED)`,
      actor
    );
  }

  /**
   * Helper: Fulfills stock on dispatch (Task 4: READY_TO_SHIP -> Stock fulfillment completed).
   */
  private executeStockFulfillment(
    order: AdminOrderRecord,
    actor: string = 'inventory_service'
  ): void {
    const now = new Date().toISOString();

    for (const item of order.items) {
      const key = this.buildStockKey(item.product_name, item.variant);
      const stock = this.stocks.get(key);
      if (stock) {
        // Complete fulfillment: deduct both on_hand and reserved
        stock.on_hand = Math.max(0, stock.on_hand - item.quantity);
        stock.reserved = Math.max(0, stock.reserved - item.quantity);
        stock.available = Math.max(0, stock.on_hand - stock.reserved);
      }
    }

    order.inventory.status = 'FULFILLED';
    order.inventory.summary_status = 'FULFILLED';
    order.inventory.fulfilled_at = now;

    for (const invItem of order.inventory.items) {
      invItem.status = 'FULFILLED';
    }

    this.appendAuditLog(
      order,
      'ORDER_READY_TO_SHIP',
      'Fulfillment inventaris selesai. Kemasan rantai dingin siap dikirim.',
      actor
    );
  }

  /**
   * Helper: Releases stock on cancellation (Task 3: RESERVED -> RELEASED).
   */
  private executeStockRelease(
    order: AdminOrderRecord,
    actor: string = 'inventory_service'
  ): void {
    const now = new Date().toISOString();

    if (order.inventory.status === 'RESERVED') {
      for (const item of order.items) {
        const key = this.buildStockKey(item.product_name, item.variant);
        const stock = this.stocks.get(key);
        if (stock) {
          stock.reserved = Math.max(0, stock.reserved - item.quantity);
          stock.available = Math.max(0, stock.on_hand - stock.reserved);
        }
      }

      order.inventory.status = 'RELEASED';
      order.inventory.summary_status = 'RELEASED';
      order.inventory.released_at = now;

      for (const invItem of order.inventory.items) {
        invItem.status = 'RELEASED';
        invItem.reserved_quantity = 0;
      }

      this.appendAuditLog(
        order,
        'INVENTORY_RELEASED',
        'Pesanan dibatalkan. Reservasi stok dilepaskan kembali ke inventaris.',
        actor
      );
    } else {
      order.inventory.status = 'RELEASED';
      order.inventory.summary_status = 'RELEASED';
      order.inventory.released_at = now;

      for (const invItem of order.inventory.items) {
        invItem.status = 'RELEASED';
        invItem.reserved_quantity = 0;
      }

      this.appendAuditLog(
        order,
        'INVENTORY_RELEASED',
        'Pesanan dibatalkan sebelum reservasi stok diproses.',
        actor
      );
    }
  }

  public updateOrderStatus(
    idOrOrderNumber: string,
    targetStatus: OrderLifecycleStatus,
    actor: string = 'admin_user'
  ): { success: boolean; order?: AdminOrderRecord; error?: string } {
    const target = idOrOrderNumber.trim().toLowerCase();
    const index = this.orders.findIndex(
      (o) => o.id.toLowerCase() === target || o.order_number.toLowerCase() === target
    );

    if (index === -1) {
      return { success: false, error: 'Pesanan tidak ditemukan' };
    }

    const currentOrder = this.orders[index];

    // Enforce Task 3 transitions strictly
    if (!isValidStatusTransition(currentOrder.order_status, targetStatus)) {
      return {
        success: false,
        error: `Transisi status tidak valid dari ${currentOrder.order_status} ke ${targetStatus}`,
      };
    }

    // TASK 2: Stock Availability Check before payment confirmation
    if (targetStatus === 'PAYMENT_CONFIRMED' && currentOrder.order_status === 'WAITING_PAYMENT') {
      const check = this.checkStockAvailability(currentOrder.items);
      if (!check.available && check.insufficientItem) {
        const ins = check.insufficientItem;
        return {
          success: false,
          error: `Stok tidak mencukupi untuk item [${ins.product_name} ${ins.variant}]. Tersedia: ${ins.available}, Diminta: ${ins.requested}`,
        };
      }
    }

    currentOrder.order_status = targetStatus;
    currentOrder.updated_at = new Date().toISOString();

    // TASK 4: Connect order status transitions with inventory events & TASK 6: WhatsApp Notifications
    if (targetStatus === 'PAYMENT_CONFIRMED') {
      if (currentOrder.payment.status !== 'PAID') {
        currentOrder.payment.status = 'PAID';
        currentOrder.payment.proof_status = 'verified';
        currentOrder.payment.verified_at = new Date().toISOString();
      }

      this.appendAuditLog(
        currentOrder,
        'ORDER_PAYMENT_CONFIRMED',
        `Pembayaran pesanan dikonfirmasi (Rp ${currentOrder.cost.total_amount.toLocaleString('id-ID')})`,
        actor
      );

      // TASK 1: Inventory Reservation Event
      this.executeStockReservation(currentOrder, actor);

      // Phase 1.7C.18 Task 6: Connect PAYMENT_CONFIRMED notification
      this.appendNotification(currentOrder, 'PAYMENT_CONFIRMED');
    } else if (targetStatus === 'PROCESSING') {
      this.appendAuditLog(
        currentOrder,
        'ORDER_PROCESSING',
        'Pesanan mulai disiapkan di gudang (Cold Chain fulfillment).',
        actor
      );
      // Phase 1.7C.18 Task 6: Connect ORDER_PROCESSING notification
      this.appendNotification(currentOrder, 'ORDER_PROCESSING');
    } else if (targetStatus === 'READY_TO_SHIP') {
      this.executeStockFulfillment(currentOrder, actor);
      // Phase 1.7C.18 Task 6: Connect ORDER_READY_TO_SHIP notification
      this.appendNotification(currentOrder, 'ORDER_READY_TO_SHIP');
    } else if (targetStatus === 'DELIVERED') {
      // Phase 1.7C.18 Task 6: Connect ORDER_DELIVERED notification
      this.appendNotification(currentOrder, 'ORDER_DELIVERED');
    } else if (targetStatus === 'CANCELLED') {
      this.executeStockRelease(currentOrder, actor);
    }

    return {
      success: true,
      order: JSON.parse(JSON.stringify(currentOrder)),
    };
  }

  public verifyPayment(
    idOrOrderNumber: string,
    action: 'confirm' | 'reject',
    actor: string = 'admin_user'
  ): { success: boolean; order?: AdminOrderRecord; error?: string } {
    const target = idOrOrderNumber.trim().toLowerCase();
    const index = this.orders.findIndex(
      (o) => o.id.toLowerCase() === target || o.order_number.toLowerCase() === target
    );

    if (index === -1) {
      return { success: false, error: 'Pesanan tidak ditemukan' };
    }

    const currentOrder = this.orders[index];
    const now = new Date().toISOString();

    if (action === 'confirm') {
      // TASK 2: Stock Availability Check before payment confirmation
      const check = this.checkStockAvailability(currentOrder.items);
      if (!check.available && check.insufficientItem) {
        const ins = check.insufficientItem;
        return {
          success: false,
          error: `Stok tidak mencukupi untuk item [${ins.product_name} ${ins.variant}]. Tersedia: ${ins.available}, Diminta: ${ins.requested}`,
        };
      }

      currentOrder.payment.status = 'PAID';
      currentOrder.payment.proof_status = 'verified';
      currentOrder.payment.verified_at = now;

      this.appendAuditLog(
        currentOrder,
        'ORDER_PAYMENT_CONFIRMED',
        `Bukti bayar disetujui manual (Rp ${currentOrder.cost.total_amount.toLocaleString('id-ID')})`,
        actor
      );

      // Automatically advance status to PAYMENT_CONFIRMED if waiting
      if (currentOrder.order_status === 'WAITING_PAYMENT') {
        currentOrder.order_status = 'PAYMENT_CONFIRMED';
        // TASK 1: Inventory Reservation Event
        this.executeStockReservation(currentOrder, actor);
        // Phase 1.7C.18 Task 6: Connect PAYMENT_CONFIRMED notification
        this.appendNotification(currentOrder, 'PAYMENT_CONFIRMED');
      }
    } else {
      currentOrder.payment.status = 'FAILED';
      currentOrder.payment.proof_status = 'rejected';
      currentOrder.payment.verified_at = now;

      this.appendAuditLog(
        currentOrder,
        'ORDER_PAYMENT_CONFIRMED',
        'Bukti pembayaran ditolak oleh admin.',
        actor
      );
    }

    currentOrder.updated_at = now;

    return {
      success: true,
      order: JSON.parse(JSON.stringify(currentOrder)),
    };
  }


  public getDashboardMetrics(): OrderDashboardMetrics {
    const today = new Date().toISOString().slice(0, 10);

    let todayOrders = 0;
    let waitingPayment = 0;
    let processing = 0;
    let readyToShip = 0;
    let completedOrders = 0;
    let cancelledOrders = 0;
    let totalRevenue = 0;

    for (const o of this.orders) {
      if (o.created_at.startsWith(today)) {
        todayOrders++;
      }

      switch (o.order_status) {
        case 'WAITING_PAYMENT':
          waitingPayment++;
          break;
        case 'PROCESSING':
        case 'PAYMENT_CONFIRMED':
          processing++;
          break;
        case 'READY_TO_SHIP':
          readyToShip++;
          break;
        case 'DELIVERED':
          completedOrders++;
          totalRevenue += o.cost.total_amount;
          break;
        case 'CANCELLED':
          cancelledOrders++;
          break;
      }
    }

    if (todayOrders === 0 && this.orders.length > 0) {
      todayOrders = this.orders.length;
    }

    return {
      today_orders: todayOrders,
      waiting_payment: waitingPayment,
      processing: processing,
      ready_to_ship: readyToShip,
      completed_orders: completedOrders,
      cancelled_orders: cancelledOrders,
      total_revenue: totalRevenue,
    };
  }
}

// Global singleton instance
const globalForAdminOrders = globalThis as unknown as { adminOrderStore?: AdminOrderStore };

export const adminOrderStore =
  globalForAdminOrders.adminOrderStore || new AdminOrderStore();

if (process.env.NODE_ENV !== 'production') {
  globalForAdminOrders.adminOrderStore = adminOrderStore;
}
