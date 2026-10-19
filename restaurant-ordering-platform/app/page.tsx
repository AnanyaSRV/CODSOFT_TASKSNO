"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Clock3,
  Flame,
  Leaf,
  MapPin,
  Minus,
  Plus,
  ShoppingBag,
  Star,
  UtensilsCrossed,
  X,
} from "lucide-react";

type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  vegetarian: boolean;
  popular?: boolean;
};

type ApiMenuItem = {
  id: string;
  name: string;
  description: string;
  price: string | number;
  imageUrl: string | null;
  isAvailable: boolean;
  isVegetarian: boolean;
  categoryId: string;
};

type ApiCategory = {
  id: string;
  name: string;
  slug: string;
  items: ApiMenuItem[];
};

type OrderConfirmation = {
  orderNumber: string;
  status: string;
  total: string;
  paymentMethod?: "CASH" | "ONLINE";
  paymentStatus?: string;
  items: { name: string; quantity: number; unitPrice: string }[];
};

type RazorpayCheckoutDetails = {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
};

type CreatedOrder = {
  id: string;
  orderNumber: string;
  status: string;
  total: string;
  items: { name: string; quantity: number; unitPrice: string }[];
};

type PendingOnlinePayment = {
  order: CreatedOrder;
  razorpayCheckout: RazorpayCheckoutDetails;
};

type RazorpaySuccessResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: { name: string; contact: string };
  notes: { dinedeskOrderNumber: string };
  theme: { color: string };
  handler: (response: RazorpaySuccessResponse) => void | Promise<void>;
  modal: { ondismiss: () => void };
};

type RazorpayInstance = {
  open: () => void;
  on: (event: "payment.failed", handler: (response: { error?: { description?: string } }) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

const fallbackImages: Record<string, string> = {
  "Truffle Mushroom Pizza":
    "https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=900&q=85",
  "Classic Smash Burger":
    "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=85",
  "Creamy Alfredo Pasta":
    "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=900&q=85",
  "Garden Fresh Bowl":
    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=85",
  "Margherita Pizza":
    "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=900&q=85",
  "Chocolate Lava Cake":
    "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=900&q=85",
};

const defaultImage =
  "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85";

export default function Home() {
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [menuCategories, setMenuCategories] = useState<string[]>(["All"]);
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState("");

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "ONLINE">("CASH");
  const [placingOrder, setPlacingOrder] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [pendingOnlinePayment, setPendingOnlinePayment] =
    useState<PendingOnlinePayment | null>(null);
  const [orderConfirmation, setOrderConfirmation] =
    useState<OrderConfirmation | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadMenu() {
      try {
        setMenuLoading(true);
        setMenuError("");

        const response = await fetch("/api/menu", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("The menu could not be loaded. Please try again.");
        }

        const data: { categories: ApiCategory[] } = await response.json();

        const availableCategories = (data.categories ?? []).filter(
          (entry) => entry.items.some((item) => item.isAvailable),
        );

        const items: MenuItem[] = availableCategories.flatMap((entry) =>
          entry.items
            .filter((item) => item.isAvailable)
            .map((item) => ({
              id: item.id,
              name: item.name,
              description: item.description,
              price: Number(item.price),
              category: entry.name,
              image:
                item.imageUrl ||
                fallbackImages[item.name] ||
                defaultImage,
              vegetarian: item.isVegetarian,
              popular:
                item.name === "Truffle Mushroom Pizza" ||
                item.name === "Classic Smash Burger",
            })),
        );

        if (!cancelled) {
          setMenu(items);
          setMenuCategories([
            "All",
            ...availableCategories.map((entry) => entry.name),
          ]);
        }
      } catch (error) {
        if (!cancelled) {
          setMenuError(
            error instanceof Error
              ? error.message
              : "The menu could not be loaded. Please try again.",
          );
        }
      } finally {
        if (!cancelled) {
          setMenuLoading(false);
        }
      }
    }

    loadMenu();

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleItems = useMemo(
    () =>
      menu.filter((item) => {
        const matchesCategory =
          category === "All" || item.category === category;

        const normalizedSearch = search.toLowerCase().trim();

        const matchesSearch =
          item.name.toLowerCase().includes(normalizedSearch) ||
          item.description.toLowerCase().includes(normalizedSearch);

        return matchesCategory && matchesSearch;
      }),
    [menu, category, search],
  );

  const cartItems = menu.filter((item) => (cart[item.id] ?? 0) > 0);

  const itemCount = Object.values(cart).reduce(
    (sum, quantity) => sum + quantity,
    0,
  );

  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.price * (cart[item.id] ?? 0),
    0,
  );

  function changeQuantity(id: string, amount: number) {
    setCart((current) => {
      const next = { ...current };
      const quantity = (next[id] ?? 0) + amount;

      if (quantity <= 0) {
        delete next[id];
      } else {
        next[id] = quantity;
      }

      return next;
    });
  }

  async function ensureRazorpayLoaded() {
    if (window.Razorpay) return;

    await new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
      );

      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(), { once: true });
        existingScript.addEventListener(
          "error",
          () => reject(new Error("Razorpay Checkout could not be loaded. Check your internet connection and try again.")),
          { once: true },
        );
        if (window.Razorpay) resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("Razorpay Checkout could not be loaded. Check your internet connection and try again."));
      document.body.appendChild(script);
    });

    if (!window.Razorpay) {
      throw new Error("Razorpay Checkout did not initialize. Please try again.");
    }
  }

  async function launchOnlinePayment(pending: PendingOnlinePayment) {
    await ensureRazorpayLoaded();

    if (!window.Razorpay) {
      throw new Error("Razorpay Checkout is unavailable. Please try again.");
    }

    const checkout = new window.Razorpay({
      key: pending.razorpayCheckout.keyId,
      amount: pending.razorpayCheckout.amount,
      currency: pending.razorpayCheckout.currency,
      name: "DineDesk",
      description: `Order ${pending.order.orderNumber}`,
      order_id: pending.razorpayCheckout.orderId,
      prefill: {
        name: customerName,
        contact: customerPhone,
      },
      notes: { dinedeskOrderNumber: pending.order.orderNumber },
      theme: { color: "#263b2c" },
      handler: async (razorpayResponse) => {
        setPlacingOrder(true);
        setCheckoutError("");

        try {
          const verifyResponse = await fetch("/api/payments/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: pending.order.id,
              razorpay_order_id: razorpayResponse.razorpay_order_id,
              razorpay_payment_id: razorpayResponse.razorpay_payment_id,
              razorpay_signature: razorpayResponse.razorpay_signature,
            }),
          });
          const verifyData = await verifyResponse.json();

          if (!verifyResponse.ok) {
            throw new Error(
              typeof verifyData.error === "string"
                ? verifyData.error
                : "Payment could not be verified. If money was deducted, do not pay again; check your order status.",
            );
          }

          setOrderConfirmation({
            orderNumber: pending.order.orderNumber,
            status: pending.order.status,
            total: pending.order.total,
            items: pending.order.items,
            paymentMethod: "ONLINE",
            paymentStatus: "PAID",
          });
          setPendingOnlinePayment(null);
          setCart({});
          setCustomerName("");
          setCustomerPhone("");
          setOrderNotes("");
          setCheckoutOpen(false);
        } catch (error) {
          setCheckoutError(
            error instanceof Error
              ? error.message
              : "Payment verification failed. If money was deducted, do not pay again; contact the restaurant.",
          );
        } finally {
          setPlacingOrder(false);
        }
      },
      modal: {
        ondismiss: () => {
          setPendingOnlinePayment(pending);
          setCheckoutError(
            "Payment wasn't completed. Your order is saved with payment pending. You can retry online payment or switch to cash before creating another order.",
          );
        },
      },
    });

    checkout.on("payment.failed", (response) => {
      setPendingOnlinePayment(pending);
      setCheckoutError(
        response.error?.description ||
          "Razorpay could not complete the payment. You can retry online payment.",
      );
    });
    checkout.open();
  }

  async function handlePlaceOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCheckoutError("");

    if (cartItems.length === 0 && !pendingOnlinePayment) {
      setCheckoutError(
        "Your cart is empty. Add a dish before placing an order.",
      );
      return;
    }

    setPlacingOrder(true);

    try {
      // Reopen the existing Razorpay order when the customer retries; don't create duplicates.
      if (pendingOnlinePayment && paymentMethod === "ONLINE") {
        await launchOnlinePayment(pendingOnlinePayment);
        return;
      }

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          phone: customerPhone,
          notes: orderNotes,
          paymentMethod,
          items: cartItems.map((item) => ({
            menuItemId: item.id,
            quantity: cart[item.id] ?? 0,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "We couldn't place your order. Please check your details and try again.",
        );
      }

      if (paymentMethod === "ONLINE") {
        if (!data.razorpayCheckout || !data.order?.id) {
          throw new Error("The order was created, but Razorpay checkout details were missing. Contact the restaurant before placing another order.");
        }

        const pending: PendingOnlinePayment = {
          order: {
            id: data.order.id,
            orderNumber: data.order.orderNumber,
            status: data.order.status,
            total: data.order.total,
            items: data.order.items,
          },
          razorpayCheckout: data.razorpayCheckout,
        };
        setPendingOnlinePayment(pending);
        await launchOnlinePayment(pending);
        return;
      }

      setOrderConfirmation({
        ...data.order,
        paymentMethod: "CASH",
        paymentStatus: data.order.payment?.status ?? "PENDING",
      });
      setCart({});
      setCustomerName("");
      setCustomerPhone("");
      setOrderNotes("");
      setCheckoutOpen(false);
    } catch (error) {
      setCheckoutError(
        error instanceof Error
          ? error.message
          : "We couldn't place your order. Please try again.",
      );
    } finally {
      setPlacingOrder(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#faf8f4] text-[#25291f]">
      <div className="bg-[#263b2c] px-4 py-2.5 text-center text-xs font-medium tracking-wide text-white sm:text-sm">
        Fresh ingredients. Thoughtfully prepared. Made for sharing.
      </div>

      <header className="sticky top-0 z-30 border-b border-black/5 bg-[#faf8f4]/95 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <a href="#" className="flex shrink-0 items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d6e3cc] text-[#263b2c]">
              <UtensilsCrossed size={21} />
            </span>
            <span>
              <span className="block text-xl font-bold tracking-tight">
                DineDesk
              </span>
              <span className="block text-[9px] font-semibold uppercase tracking-[0.24em] text-[#78816f]">
                Good food, good mood
              </span>
            </span>
          </a>

          <nav className="hidden items-center gap-8 text-sm font-medium text-[#62685b] md:flex">
            <a href="#menu" className="transition hover:text-[#263b2c]">
              Our menu
            </a>
            <a
              href="#experience"
              className="transition hover:text-[#263b2c]"
            >
              Our story
            </a>
            <a
              href="#reservation"
              className="transition hover:text-[#263b2c]"
            >
              Reservations
            </a>
          </nav>

          <button
            onClick={() => setCartOpen(true)}
            className="relative flex items-center gap-2 rounded-full bg-[#263b2c] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3b5540]"
            aria-label={`Open shopping cart, ${itemCount} items`}
          >
            <ShoppingBag size={17} />
            <span className="hidden sm:inline">Your order</span>
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#d6e3cc] px-1 text-xs text-[#263b2c]">
              {itemCount}
            </span>
          </button>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-10 sm:py-14 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-16 lg:px-8 lg:py-20">
        <div className="max-w-xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#d9dfd1] bg-white px-3.5 py-2 text-xs font-semibold text-[#496248]">
            <span className="h-2 w-2 rounded-full bg-[#719567]" />
            YOUR NEIGHBOURHOOD FOOD SPOT
          </div>

          <h1 className="text-5xl leading-[1.08] font-semibold tracking-[-0.055em] sm:text-6xl lg:text-7xl">
            Good food.
            <br />
            <span className="font-serif text-[#78916b] italic">
              Good company.
            </span>
          </h1>

          <p className="mt-6 max-w-lg text-base leading-8 text-[#6b7063] sm:text-lg">
            Thoughtfully prepared favourites, fresh ingredients, and little
            moments worth slowing down for. Find your next favourite dish.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#menu"
              className="inline-flex items-center gap-2 rounded-full bg-[#263b2c] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#3b5540]"
            >
              Explore the menu <ArrowRight size={17} />
            </a>
            <a
              href="/reservations"
              className="inline-flex items-center gap-2 rounded-full border border-[#d6d9ce] bg-white px-6 py-3.5 text-sm font-semibold text-[#263b2c] transition hover:bg-[#f1f3ec]"
            >
              Book a table
            </a>
          </div>

          <div className="mt-10 flex flex-wrap gap-x-7 gap-y-4 border-t border-[#e7e5dc] pt-6 text-sm text-[#62685b]">
            <div className="flex items-center gap-2">
              <Leaf size={17} className="text-[#78916b]" />
              Fresh ingredients
            </div>
            <div className="flex items-center gap-2">
              <Clock3 size={17} className="text-[#78916b]" />
              Made to order
            </div>
            <div className="flex items-center gap-2">
              <Star size={17} className="text-[#78916b]" />
              Made with care
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -left-4 -top-4 h-28 w-28 rounded-full bg-[#e3eadb] sm:-left-6 sm:-top-6" />
          <div className="absolute -bottom-5 -right-4 h-32 w-32 rounded-full bg-[#e9e0ce] sm:-right-6" />
          <div className="relative grid grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-3 pt-10 sm:space-y-4">
              <img
                src={fallbackImages["Truffle Mushroom Pizza"]}
                alt="Freshly baked mushroom pizza"
                className="h-52 w-full rounded-3xl object-cover sm:h-64"
              />
              <div className="rounded-3xl bg-[#e5ebdf] p-5 sm:p-6">
                <Leaf className="mb-3 text-[#52734b]" size={23} />
                <p className="font-serif text-xl italic text-[#38553d] sm:text-2xl">
                  Fresh, always.
                </p>
                <p className="mt-2 text-xs leading-5 text-[#62685b] sm:text-sm">
                  Simple ingredients, lovely flavours.
                </p>
              </div>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <div className="rounded-3xl bg-[#f0e5d4] p-5 sm:p-6">
                <Flame className="mb-3 text-[#9b6e43]" size={23} />
                <p className="font-serif text-xl italic text-[#6d4b30] sm:text-2xl">
                  Made with love.
                </p>
                <p className="mt-2 text-xs leading-5 text-[#7b6a58] sm:text-sm">
                  Your comfort food, made fresh.
                </p>
              </div>
              <img
                src={fallbackImages["Classic Smash Burger"]}
                alt="Juicy smash burger served fresh"
                className="h-64 w-full rounded-3xl object-cover sm:h-80"
              />
            </div>
          </div>
        </div>
      </section>

      <section
        id="experience"
        className="border-y border-[#e8e5db] bg-white px-5 py-12 sm:py-16"
      >
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#78916b]">
              A little about us
            </p>
            <h2 className="mt-3 font-serif text-3xl italic text-[#263b2c]">
              Good food brings us together.
            </h2>
          </div>
          <p className="text-sm leading-7 text-[#62685b]">
            We believe a good meal is more than what's on the plate. It's the
            fresh ingredients, the care in every recipe, and the people you
            share it with.
          </p>
          <p className="text-sm leading-7 text-[#62685b]">
            From a quick lunch to a relaxed dinner, DineDesk makes it easy to
            discover dishes, place an order, and plan your next visit.
          </p>
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-7xl px-5 py-14 sm:py-20 lg:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#78916b]">
              Prepared just for you
            </p>
            <h2 className="mt-3 font-serif text-4xl italic tracking-tight text-[#263b2c] sm:text-5xl">
              Explore our menu
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#62685b]">
              Discover something delicious. Add your favourites to your order
              and check out when you're ready.
            </p>
          </div>

          <label className="relative block w-full sm:max-w-xs">
            <span className="sr-only">Search the menu</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search dishes..."
              className="w-full rounded-full border border-[#dcded2] bg-white px-5 py-3 text-sm outline-none transition focus:border-[#78916b] focus:ring-2 focus:ring-[#78916b]/15"
            />
          </label>
        </div>

        <div className="mt-8 flex gap-2 overflow-x-auto pb-2">
          {menuCategories.map((entry) => (
            <button
              key={entry}
              onClick={() => setCategory(entry)}
              className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                category === entry
                  ? "bg-[#263b2c] text-white"
                  : "border border-[#e0e1d7] bg-white text-[#62685b] hover:border-[#a9b8a0]"
              }`}
            >
              {entry}
            </button>
          ))}
        </div>

        {menuLoading ? (
          <div className="grid gap-5 py-12 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div
                key={item}
                className="animate-pulse overflow-hidden rounded-3xl border border-[#e7e5dc] bg-white"
              >
                <div className="h-52 bg-[#eceee6]" />
                <div className="space-y-3 p-5">
                  <div className="h-5 w-2/3 rounded bg-[#eceee6]" />
                  <div className="h-4 w-full rounded bg-[#eceee6]" />
                  <div className="h-4 w-1/2 rounded bg-[#eceee6]" />
                </div>
              </div>
            ))}
          </div>
        ) : menuError ? (
          <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
            <p>{menuError}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 font-semibold underline"
            >
              Try again
            </button>
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-[#e7e5dc] bg-white px-5 py-12 text-center">
            <p className="font-semibold text-[#263b2c]">No dishes found</p>
            <p className="mt-2 text-sm text-[#62685b]">
              Try another search or choose a different category.
            </p>
            <button
              onClick={() => {
                setSearch("");
                setCategory("All");
              }}
              className="mt-4 text-sm font-semibold text-[#52734b] underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visibleItems.map((item) => (
              <article
                key={item.id}
                className="group overflow-hidden rounded-3xl border border-[#e7e5dc] bg-white transition hover:-translate-y-1 hover:shadow-lg hover:shadow-[#263b2c]/5"
              >
                <div className="relative overflow-hidden">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-56 w-full object-cover transition duration-500 group-hover:scale-105"
                  />

                  {item.popular && (
                    <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-[#38553d] shadow-sm">
                      <Star size={13} fill="currentColor" />
                      Popular
                    </span>
                  )}

                  <span
                    className={`absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-md border-2 bg-white ${
                      item.vegetarian
                        ? "border-[#54824c]"
                        : "border-[#b95d4b]"
                    }`}
                    title={item.vegetarian ? "Vegetarian" : "Non-vegetarian"}
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        item.vegetarian ? "bg-[#54824c]" : "bg-[#b95d4b]"
                      }`}
                    />
                  </span>
                </div>

                <div className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#87917c]">
                    {item.category}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight text-[#263b2c]">
                    {item.name}
                  </h3>
                  <p className="mt-2 min-h-12 text-sm leading-6 text-[#777a70]">
                    {item.description}
                  </p>

                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#efeee8] pt-4">
                    <p className="text-lg font-bold text-[#263b2c]">
                      ₹{item.price.toFixed(2)}
                    </p>

                    {(cart[item.id] ?? 0) > 0 ? (
                      <div className="flex items-center gap-3 rounded-full bg-[#edf2e8] p-1.5">
                        <button
                          onClick={() => changeQuantity(item.id, -1)}
                          aria-label={`Remove one ${item.name}`}
                          className="rounded-full bg-white p-2 text-[#38553d] transition hover:bg-[#dbe6d2]"
                        >
                          <Minus size={15} />
                        </button>
                        <span className="min-w-4 text-center text-sm font-bold text-[#263b2c]">
                          {cart[item.id]}
                        </span>
                        <button
                          onClick={() => changeQuantity(item.id, 1)}
                          aria-label={`Add one ${item.name}`}
                          className="rounded-full bg-[#263b2c] p-2 text-white transition hover:bg-[#3b5540]"
                        >
                          <Plus size={15} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => changeQuantity(item.id, 1)}
                        className="inline-flex items-center gap-2 rounded-full bg-[#263b2c] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3b5540]"
                      >
                        <Plus size={16} /> Add
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section
        id="reservation"
        className="bg-[#e9eee3] px-5 py-14 sm:py-16"
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-7 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#52734b]">
              Make it a moment
            </p>
            <h2 className="mt-3 font-serif text-3xl italic tracking-tight text-[#263b2c] sm:text-4xl">
              Your table is waiting.
            </h2>
            <p className="mt-3 text-sm leading-7 text-[#62685b]">
              Planning a get-together or a quiet meal? Reserve a table and
              make your next visit something to look forward to.
            </p>
          </div>

          <a
            href="/reservations"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#263b2c] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#3b5540]"
          >
            Reserve a table <ArrowRight size={17} />
          </a>
        </div>
      </section>

      <footer className="bg-[#263b2c] px-5 py-8 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-bold">DineDesk</p>
            <p className="mt-1 text-xs text-white/60">
              Good food, good mood.
            </p>
          </div>
          <p className="text-xs text-white/60">
            Fresh ingredients. Thoughtfully prepared. Made for sharing.
          </p>
        </div>
      </footer>

      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            aria-label="Close shopping cart"
            onClick={() => {
              setCartOpen(false);
              setCheckoutOpen(false);
              setCheckoutError("");
            }}
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
          />

          <aside className="relative flex h-full w-full max-w-lg flex-col bg-[#faf8f4] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e7e4db] px-5 py-5">
              <div>
                <h2 className="text-xl font-bold text-[#263b2c]">
                  {orderConfirmation
                    ? "Order confirmation"
                    : checkoutOpen
                      ? "Checkout"
                      : "Your order"}
                </h2>
                <p className="mt-1 text-xs text-[#777a70]">
                  {orderConfirmation
                    ? "Your order has been saved."
                    : `${itemCount} ${itemCount === 1 ? "item" : "items"} in your cart`}
                </p>
              </div>
              <button
                onClick={() => {
                  setCartOpen(false);
                  setCheckoutOpen(false);
                  setCheckoutError("");
                }}
                aria-label="Close cart"
                className="rounded-full border border-[#dedfd5] bg-white p-2.5 transition hover:bg-[#f1f3ec]"
              >
                <X size={19} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {cartItems.length === 0 && !orderConfirmation ? (
                <div className="flex h-full min-h-56 flex-col items-center justify-center text-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#e5ebdf] text-[#38553d]">
                    <ShoppingBag size={27} />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold text-[#263b2c]">
                    Your cart is empty
                  </h3>
                  <p className="mt-2 max-w-xs text-sm leading-6 text-[#777a70]">
                    Browse the menu and add something delicious to get started.
                  </p>
                  <button
                    onClick={() => setCartOpen(false)}
                    className="mt-5 rounded-full bg-[#263b2c] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#3b5540]"
                  >
                    Explore the menu
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex gap-4">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-20 w-20 rounded-xl object-cover"
                      />

                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold">{item.name}</h3>
                        <p className="mt-1 text-sm text-[#777a70]">
                          ₹{item.price}
                        </p>

                        <div className="mt-3 flex items-center gap-3">
                          <button
                            onClick={() => changeQuantity(item.id, -1)}
                            className="rounded-full border border-[#dcded3] p-1.5"
                            aria-label={`Remove one ${item.name}`}
                          >
                            <Minus size={13} />
                          </button>

                          <span className="text-sm font-semibold">
                            {cart[item.id]}
                          </span>

                          <button
                            onClick={() => changeQuantity(item.id, 1)}
                            className="rounded-full border border-[#dcded3] p-1.5"
                            aria-label={`Add one ${item.name}`}
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      </div>

                      <p className="shrink-0 text-sm font-semibold">
                        ₹{item.price * (cart[item.id] ?? 0)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {orderConfirmation ? (
              <div className="min-h-0 flex-1 overflow-y-auto border-t border-[#e7e4db] bg-white p-5">
                <div className="rounded-2xl border border-[#d8e5d1] bg-[#f0f5ec] p-4">
                  <p className="text-xs font-bold tracking-[0.16em] text-[#52734b] uppercase">
                    Order placed
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-[#263b2c]">
                    Thank you for your order!
                  </h3>
                  <p className="mt-2 text-sm text-[#62685b]">
                    Order number:{" "}
                    <strong>{orderConfirmation.orderNumber}</strong>
                  </p>

                  <a
                    href={`/track-order?orderNumber=${encodeURIComponent(
                      orderConfirmation.orderNumber,
                    )}`}
                    className="mt-3 inline-flex w-full items-center justify-center rounded-full border border-[#52734b] px-4 py-3 text-sm font-semibold text-[#38553d] transition hover:bg-white"
                  >
                    Track your order →
                  </a>

                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-[#62685b]">Status</span>
                    <strong>{orderConfirmation.status}</strong>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-lg font-semibold">
                    <span>Total</span>
                    <span>
                      ₹{Number(orderConfirmation.total).toFixed(2)}
                    </span>
                  </div>

                  <p className="mt-3 text-xs leading-5 text-[#777a70]">
                    {orderConfirmation.paymentMethod === "ONLINE"
                      ? "Online payment verified successfully through Razorpay."
                      : "Payment method: cash. Payment remains pending until the restaurant confirms collection."}
                  </p>
                </div>

                <button
                  onClick={() => {
                    setOrderConfirmation(null);
                    setCheckoutError("");
                    setCartOpen(false);
                  }}
                  className="mt-4 w-full rounded-full bg-[#263b2c] py-3.5 font-semibold text-white transition hover:bg-[#3b5540]"
                >
                  Continue browsing
                </button>
              </div>
            ) : checkoutOpen ? (
              <form
                onSubmit={handlePlaceOrder}
                className="max-h-[70dvh] shrink-0 overflow-y-auto border-t border-[#e7e4db] bg-white p-5"
              >
                <div className="flex items-center justify-between text-sm text-[#777a70]">
                  <span>Order subtotal</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>

                <div className="mt-2 flex items-center justify-between text-lg font-semibold">
                  <span>Total due</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>

                <p className="mt-2 text-xs leading-5 text-[#8b8d82]">
                  Prices are confirmed by the server. Tax is currently set to
                  ₹0.00 and may need configuration before real-world use.
                </p>

                <label className="mt-4 block text-sm font-medium text-[#40483c]">
                  Full name
                  <input
                    required
                    minLength={2}
                    maxLength={100}
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    autoComplete="name"
                    placeholder="Enter your name"
                    className="mt-1.5 w-full rounded-xl border border-[#dedfd5] bg-[#faf8f4] px-3.5 py-3 text-sm outline-none focus:border-[#78916b]"
                  />
                </label>

                <label className="mt-3 block text-sm font-medium text-[#40483c]">
                  Phone number
                  <input
                    required
                    minLength={7}
                    maxLength={20}
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    autoComplete="tel"
                    type="tel"
                    placeholder="Enter your phone number"
                    className="mt-1.5 w-full rounded-xl border border-[#dedfd5] bg-[#faf8f4] px-3.5 py-3 text-sm outline-none focus:border-[#78916b]"
                  />
                </label>

                <label className="mt-3 block text-sm font-medium text-[#40483c]">
                  Order notes{" "}
                  <span className="font-normal text-[#8b8d82]">
                    (optional)
                  </span>
                  <textarea
                    maxLength={500}
                    rows={2}
                    value={orderNotes}
                    onChange={(event) => setOrderNotes(event.target.value)}
                    placeholder="Any special instructions?"
                    className="mt-1.5 w-full resize-y rounded-xl border border-[#dedfd5] bg-[#faf8f4] px-3.5 py-3 text-sm outline-none focus:border-[#78916b]"
                  />
                </label>

                <fieldset className="mt-4">
                  <legend className="text-sm font-semibold text-[#263b2c]">
                    Payment method
                  </legend>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <label className={`cursor-pointer rounded-xl border p-3 text-sm transition ${paymentMethod === "CASH" ? "border-[#52734b] bg-[#f0f5ec]" : "border-[#dedfd5] bg-white"}`}>
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="CASH"
                        checked={paymentMethod === "CASH"}
                        onChange={() => setPaymentMethod("CASH")}
                        className="mr-2 accent-[#263b2c]"
                        disabled={placingOrder || Boolean(pendingOnlinePayment)}
                      />
                      <span className="font-semibold text-[#263b2c]">Cash</span>
                      <span className="mt-1 block text-xs leading-5 text-[#62685b]">
                        Pay at the restaurant.
                      </span>
                    </label>
                    <label className={`cursor-pointer rounded-xl border p-3 text-sm transition ${paymentMethod === "ONLINE" ? "border-[#52734b] bg-[#f0f5ec]" : "border-[#dedfd5] bg-white"}`}>
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="ONLINE"
                        checked={paymentMethod === "ONLINE"}
                        onChange={() => setPaymentMethod("ONLINE")}
                        className="mr-2 accent-[#263b2c]"
                        disabled={placingOrder}
                      />
                      <span className="font-semibold text-[#263b2c]">Online</span>
                      <span className="mt-1 block text-xs leading-5 text-[#62685b]">
                        Secure Razorpay checkout.
                      </span>
                    </label>
                  </div>
                </fieldset>

                {pendingOnlinePayment && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                    An online order ({pendingOnlinePayment.order.orderNumber}) already exists with payment pending. Choose Online and retry to reuse that payment, or choose Cash only if you intend to pay the restaurant in cash.
                  </div>
                )}

                <div className="mt-3 rounded-xl bg-[#f5f5ef] p-3 text-sm text-[#62685b]">
                  <p className="font-semibold text-[#263b2c]">
                    {paymentMethod === "ONLINE" ? "Online payment with Razorpay" : "Cash payment"}
                  </p>
                  <p className="mt-1 text-xs leading-5">
                    {paymentMethod === "ONLINE"
                      ? "Razorpay will open a secure checkout. The order is only treated as paid after the server verifies the payment."
                      : "Your order will be saved with payment marked as pending. This does not charge you online."}
                  </p>
                </div>

                {checkoutError && (
                  <p
                    role="alert"
                    className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                  >
                    {checkoutError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={placingOrder || (cartItems.length === 0 && !pendingOnlinePayment)}
                  className="mt-4 w-full rounded-full bg-[#263b2c] py-3.5 font-semibold text-white transition hover:bg-[#3b5540] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {placingOrder
                    ? paymentMethod === "ONLINE" ? "Opening secure checkout..." : "Placing your order..."
                    : pendingOnlinePayment && paymentMethod === "ONLINE"
                      ? `Retry online payment · ₹${Number(pendingOnlinePayment.order.total).toFixed(2)}`
                      : paymentMethod === "ONLINE"
                        ? `Pay online · ₹${subtotal.toFixed(2)}`
                        : `Place order · ₹${subtotal.toFixed(2)}`}
                </button>

                <button
                  type="button"
                  disabled={placingOrder}
                  onClick={() => {
                    setCheckoutOpen(false);
                    setCheckoutError("");
                  }}
                  className="mt-2 w-full rounded-full border border-[#dedfd5] py-3 text-sm font-semibold text-[#40483c] disabled:opacity-60"
                >
                  Back to cart
                </button>
              </form>
            ) : cartItems.length > 0 ? (
              <div className="border-t border-[#e7e4db] bg-white p-5">
                <div className="flex items-center justify-between text-sm text-[#777a70]">
                  <span>Subtotal</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>

                <div className="mt-2 flex items-center justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>

                <p className="mt-3 text-xs leading-5 text-[#8b8d82]">
                  Place a guest order and choose cash or secure online payment at checkout.
                </p>

                <button
                  onClick={() => {
                    setCheckoutError("");
                    setOrderConfirmation(null);
                    setCheckoutOpen(true);
                  }}
                  className="mt-5 w-full rounded-full bg-[#263b2c] py-3.5 font-semibold text-white transition hover:bg-[#3b5540]"
                >
                  Continue to checkout
                </button>
              </div>
            ) : null}
          </aside>
        </div>
      )}
    </main>
  );
}