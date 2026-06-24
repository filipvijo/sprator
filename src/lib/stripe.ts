import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  _stripe = new Stripe(key, {
    apiVersion: "2025-04-30.basil" as Stripe.LatestApiVersion,
  });
  return _stripe;
}

/**
 * Sync active subscriptions from Stripe into the local DB.
 * Returns the count of subscriptions synced.
 */
export async function syncSubscriptions(): Promise<number> {
  const stripe = getStripe();
  const { getDb } = await import("./db");
  const db = getDb();

  const subs = await stripe.subscriptions.list({
    status: "active",
    limit: 100,
  });

  const upsert = db.prepare(`
    INSERT INTO subscriptions (id, stripe_sub_id, name, monthly_cost, status, agent_flag)
    VALUES (@id, @stripe_sub_id, @name, @monthly_cost, @status, @agent_flag)
    ON CONFLICT(id) DO UPDATE SET
      stripe_sub_id=@stripe_sub_id, name=@name, monthly_cost=@monthly_cost,
      status=@status, updated_at=datetime('now')
  `);

  let count = 0;
  for (const sub of subs.data) {
    const product = await stripe.products.retrieve(sub.items.data[0]?.price?.product as string).catch(() => null);
    const name = product?.name || "Unknown Subscription";
    const monthlyCost = (sub.items.data[0]?.price?.unit_amount || 0) / 100;
    upsert.run({
      id: `sub_local_${sub.id}`,
      stripe_sub_id: sub.id,
      name,
      monthly_cost: monthlyCost,
      status: "active",
      agent_flag: null,
    });
    count++;
  }

  return count;
}

/**
 * Cancel a Stripe subscription by its local ID.
 * Returns the Stripe cancellation result.
 */
export async function cancelSubscription(localSubId: string): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  const { getDb } = await import("./db");
  const db = getDb();

  const row = db.prepare("SELECT stripe_sub_id FROM subscriptions WHERE id = ?").get(localSubId) as
    | { stripe_sub_id: string }
    | undefined;

  if (!row?.stripe_sub_id) {
    throw new Error(`No Stripe subscription found for local ID: ${localSubId}`);
  }

  const cancelled = await stripe.subscriptions.cancel(row.stripe_sub_id);

  db.prepare(`
    UPDATE subscriptions SET status='cancelled', updated_at=datetime('now') WHERE id=?
  `).run(localSubId);

  return cancelled;
}

/**
 * List recent failed payment invoices from Stripe.
 */
export async function fetchFailedPayments(): Promise<Stripe.Invoice[]> {
  const stripe = getStripe();
  const list = await stripe.invoices.list({
    limit: 50,
    status: "open",
  });
  return list.data.filter(
    (inv) => inv.attempt_count > 0 && inv.paid === false
  );
}

/**
 * Create a Stripe payment link for a specific amount (used in dunning recovery).
 */
export async function createPaymentLink(
  amount: number,
  customerName: string,
  description: string
): Promise<Stripe.PaymentLink> {
  const stripe = getStripe();

  const price = await stripe.prices.create({
    unit_amount: Math.round(amount * 100),
    currency: "usd",
    product_data: {
      name: description,
    },
  });

  return stripe.paymentLinks.create({
    line_items: [{ price: price.id, quantity: 1 }],
    metadata: { customer_name: customerName, source: "sprator_dunning" },
  });
}
