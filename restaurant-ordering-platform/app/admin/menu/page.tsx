"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ChefHat,
  CirclePlus,
  Edit3,
  Image as ImageIcon,
  LoaderCircle,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Search,
  Tags,
  Trash2,
  Utensils,
  X,
} from "lucide-react";

type Category = {
  id: string;
  name: string;
  slug: string;
};

type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number | string;
  imageUrl: string | null;
  isAvailable: boolean;
  isVegetarian: boolean;
  categoryId: string;
  category: Category;
};

type MenuResponse = {
  categories: (Category & { items: MenuItem[] })[];
};

type ItemForm = {
  name: string;
  description: string;
  price: string;
  categoryId: string;
  imageUrl: string;
  isVegetarian: boolean;
  isAvailable: boolean;
};

type CategoryForm = {
  id: string;
  name: string;
  slug: string;
};

const emptyItemForm: ItemForm = {
  name: "",
  description: "",
  price: "",
  categoryId: "",
  imageUrl: "",
  isVegetarian: false,
  isAvailable: true,
};

function money(value: number | string) {
  return `₹${Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function makeSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function AdminMenuPage() {
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [availabilityFilter, setAvailabilityFilter] = useState("ALL");

  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm>(emptyItemForm);

  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null,
  );
  const [categoryForm, setCategoryForm] = useState<CategoryForm>({
    id: "",
    name: "",
    slug: "",
  });

  const redirectToLogin = useCallback(() => {
    router.replace("/staff-login");
    router.refresh();
  }, [router]);

  const loadMenu = useCallback(
    async (quiet = false) => {
      if (quiet) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const sessionResponse = await fetch("/api/auth/me", {
          cache: "no-store",
        });

        if (
          sessionResponse.status === 401 ||
          sessionResponse.status === 403
        ) {
          redirectToLogin();
          return;
        }

        const sessionData = await sessionResponse.json();

        if (!sessionResponse.ok) {
          throw new Error(
            sessionData.error || "Could not verify your admin session.",
          );
        }

        if (sessionData.user?.role !== "ADMIN") {
          redirectToLogin();
          return;
        }

        setAuthorized(true);

        const response = await fetch("/api/menu", {
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Could not load the menu.");
        }

        const result = data as MenuResponse;

        setCategories(
          result.categories.map(({ id, name, slug }) => ({
            id,
            name,
            slug,
          })),
        );

        setItems(result.categories.flatMap((category) => category.items));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load menu.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [redirectToLogin],
  );

  useEffect(() => {
    void loadMenu();
  }, [loadMenu]);

  async function submitAction(payload: Record<string, unknown>) {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.status === 401 || response.status === 403) {
        redirectToLogin();
        return false;
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "The menu operation failed.");
      }

      setNotice(result.message || "Menu updated successfully.");
      await loadMenu(true);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "The menu operation failed.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function openNewItemForm() {
    if (categories.length === 0) {
      setError("Create a category before adding a dish.");
      setShowCategoryForm(true);
      setEditingCategoryId(null);
      setCategoryForm({ id: "", name: "", slug: "" });
      return;
    }

    setError("");
    setNotice("");
    setEditingItemId(null);
    setItemForm({
      ...emptyItemForm,
      categoryId: categories[0].id,
    });
    setShowItemForm(true);
  }

  function openEditItemForm(item: MenuItem) {
    setError("");
    setNotice("");
    setEditingItemId(item.id);
    setItemForm({
      name: item.name,
      description: item.description,
      price: String(item.price),
      categoryId: item.categoryId,
      imageUrl: item.imageUrl || "",
      isVegetarian: item.isVegetarian,
      isAvailable: item.isAvailable,
    });
    setShowItemForm(true);
  }

  async function saveItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!itemForm.categoryId) {
      setError("Select a category for this dish.");
      return;
    }

    const price = Number(itemForm.price);

    if (!Number.isFinite(price) || price <= 0) {
      setError("Enter a valid price greater than zero.");
      return;
    }

    const payload = {
      action: editingItemId ? "updateItem" : "createItem",
      ...(editingItemId ? { id: editingItemId } : {}),
      name: itemForm.name.trim(),
      description: itemForm.description.trim(),
      price,
      categoryId: itemForm.categoryId,
      imageUrl: itemForm.imageUrl.trim(),
      isVegetarian: itemForm.isVegetarian,
      isAvailable: itemForm.isAvailable,
    };

    const success = await submitAction(payload);

    if (success) {
      setShowItemForm(false);
      setEditingItemId(null);
      setItemForm(emptyItemForm);
    }
  }

  function openNewCategoryForm() {
    setError("");
    setNotice("");
    setEditingCategoryId(null);
    setCategoryForm({ id: "", name: "", slug: "" });
    setShowCategoryForm(true);
  }

  function openEditCategoryForm(category: Category) {
    setError("");
    setNotice("");
    setEditingCategoryId(category.id);
    setCategoryForm({
      id: category.id,
      name: category.name,
      slug: category.slug,
    });
    setShowCategoryForm(true);
  }

  async function saveCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = categoryForm.name.trim();

    if (!name) {
      setError("Enter a category name.");
      return;
    }

    const payload = {
      action: editingCategoryId ? "updateCategory" : "createCategory",
      ...(editingCategoryId ? { id: editingCategoryId } : {}),
      name,
      slug: categoryForm.slug.trim() || makeSlug(name),
    };

    const success = await submitAction(payload);

    if (success) {
      setShowCategoryForm(false);
      setEditingCategoryId(null);
      setCategoryForm({ id: "", name: "", slug: "" });
    }
  }

  async function toggleAvailability(item: MenuItem) {
    await submitAction({
      action: "toggleAvailability",
      id: item.id,
      isAvailable: !item.isAvailable,
    });
  }

  async function deleteItem(item: MenuItem) {
    const confirmed = window.confirm(
      `Delete "${item.name}"? If it is linked to an existing order, the system will prevent deletion. You can mark it unavailable instead.`,
    );

    if (!confirmed) return;

    await submitAction({
      action: "deleteItem",
      id: item.id,
    });
  }

  async function deleteCategory(category: Category) {
    const confirmed = window.confirm(
      `Delete category "${category.name}"? The category can only be deleted if it contains no dishes.`,
    );

    if (!confirmed) return;

    await submitAction({
      action: "deleteCategory",
      id: category.id,
    });
  }

  async function logout() {
    setLoggingOut(true);
    setError("");

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Could not log out. Please try again.");
      }

      router.replace("/staff-login");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log out.");
      setLoggingOut(false);
    }
  }

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      categoryFilter === "ALL" || item.categoryId === categoryFilter;

    const matchesAvailability =
      availabilityFilter === "ALL" ||
      (availabilityFilter === "AVAILABLE" && item.isAvailable) ||
      (availabilityFilter === "UNAVAILABLE" && !item.isAvailable);

    return matchesSearch && matchesCategory && matchesAvailability;
  });

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f5f0] text-[#263b2c]">
        <div className="text-center">
          <LoaderCircle size={34} className="mx-auto animate-spin" />
          <p className="mt-4 font-semibold">Verifying access and loading menu...</p>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f5f0] px-5 text-[#263b2c]">
        <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <AlertCircle size={32} className="mx-auto text-red-600" />
          <h1 className="mt-4 text-xl font-semibold">Admin access required</h1>
          <p className="mt-2 text-sm text-[#777a70]">
            Sign in with an administrator account to manage the restaurant menu.
          </p>
          <button
            onClick={redirectToLogin}
            className="mt-5 rounded-full bg-[#263b2c] px-5 py-3 text-sm font-semibold text-white"
          >
            Go to staff login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f5f0] text-[#263b2c]">
      <header className="bg-[#1d2c21] px-5 py-6 text-white sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/10 p-3">
              <ChefHat size={27} />
            </div>
            <div>
              <p className="text-xs font-bold tracking-[0.2em] text-[#c4d8b9] uppercase">
                DineDesk
              </p>
              <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
                Menu Management
              </h1>
              <p className="mt-1 text-sm text-white/70">
                Manage dishes, categories, prices, and availability.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => router.push("/admin")}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2.5 text-sm font-semibold hover:bg-white/10"
            >
              <ArrowLeft size={16} />
              Admin overview
            </button>
            <button
              onClick={() => void loadMenu(true)}
              disabled={refreshing || saving}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2.5 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={refreshing ? "animate-spin" : ""}
              />
              Refresh
            </button>
            <button
              onClick={() => void logout()}
              disabled={loggingOut}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2.5 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"
            >
              <LogOut size={16} />
              {loggingOut ? "Signing out..." : "Logout"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <AlertCircle size={20} className="shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
          >
            {notice}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#e6e3da] bg-white p-5">
            <p className="text-sm text-[#777a70]">Total dishes</p>
            <p className="mt-2 text-3xl font-bold">{items.length}</p>
          </div>
          <div className="rounded-2xl border border-[#e6e3da] bg-white p-5">
            <p className="text-sm text-[#777a70]">Available dishes</p>
            <p className="mt-2 text-3xl font-bold">
              {items.filter((item) => item.isAvailable).length}
            </p>
          </div>
          <div className="rounded-2xl border border-[#e6e3da] bg-white p-5">
            <p className="text-sm text-[#777a70]">Categories</p>
            <p className="mt-2 text-3xl font-bold">{categories.length}</p>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-[#e6e3da] bg-white p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <Tags size={22} className="text-[#66825d]" />
                <h2 className="text-xl font-semibold">Menu categories</h2>
              </div>
              <p className="mt-1 text-sm text-[#777a70]">
                Create and rename categories. Only empty categories can be deleted.
              </p>
            </div>
            <button
              onClick={openNewCategoryForm}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#263b2c] px-5 py-3 text-sm font-semibold text-white hover:bg-[#3b5540]"
            >
              <CirclePlus size={17} />
              Add category
            </button>
          </div>

          {categories.length === 0 ? (
            <p className="mt-5 rounded-xl bg-[#f8f7f2] p-6 text-center text-sm text-[#777a70]">
              No categories yet. Create one before adding dishes.
            </p>
          ) : (
            <div className="mt-5 flex flex-wrap gap-3">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center gap-3 rounded-xl border border-[#e6e3da] bg-[#f8f7f2] px-4 py-3"
                >
                  <div>
                    <p className="font-semibold">{category.name}</p>
                    <p className="text-xs text-[#777a70]">{category.slug}</p>
                  </div>
                  <button
                    title={`Edit ${category.name}`}
                    aria-label={`Edit ${category.name}`}
                    onClick={() => openEditCategoryForm(category)}
                    className="rounded-lg p-2 hover:bg-white"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    title={`Delete ${category.name}`}
                    aria-label={`Delete ${category.name}`}
                    onClick={() => void deleteCategory(category)}
                    disabled={saving}
                    className="rounded-lg p-2 text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <h2 className="text-xl font-semibold">Menu dishes</h2>
              <p className="mt-1 text-sm text-[#777a70]">
                Add new dishes, update details, and control availability.
              </p>
            </div>
            <button
              onClick={openNewItemForm}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#263b2c] px-5 py-3 text-sm font-semibold text-white hover:bg-[#3b5540]"
            >
              <Plus size={18} />
              Add dish
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <label className="relative block">
              <Search
                size={18}
                className="absolute top-1/2 left-4 -translate-y-1/2 text-[#777a70]"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search dishes..."
                className="w-full rounded-xl border border-[#dedfd5] bg-white py-3 pr-4 pl-11 text-sm outline-none focus:border-[#78916b]"
              />
            </label>

            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="rounded-xl border border-[#dedfd5] bg-white px-4 py-3 text-sm outline-none focus:border-[#78916b]"
            >
              <option value="ALL">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <select
              value={availabilityFilter}
              onChange={(event) => setAvailabilityFilter(event.target.value)}
              className="rounded-xl border border-[#dedfd5] bg-white px-4 py-3 text-sm outline-none focus:border-[#78916b]"
            >
              <option value="ALL">All availability</option>
              <option value="AVAILABLE">Available only</option>
              <option value="UNAVAILABLE">Unavailable only</option>
            </select>
          </div>

          {loading ? (
            <div className="mt-6 rounded-2xl bg-white p-10 text-center">
              Loading menu...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-[#d8d8cc] bg-white p-12 text-center">
              <Utensils
                size={36}
                className="mx-auto text-[#819778]"
              />
              <h3 className="mt-4 text-lg font-semibold">No dishes found</h3>
              <p className="mt-2 text-sm text-[#777a70]">
                Add a dish or change your search and filters.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filteredItems.map((item) => (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-2xl border border-[#e6e3da] bg-white shadow-sm"
                >
                  {item.imageUrl ? (
                    <div className="relative h-48 bg-[#f0eee8]">
                      {/* External dish images are optional; broken URLs show a fallback. */}
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="h-full w-full object-cover"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                      <div className="absolute inset-0 -z-0 flex items-center justify-center text-[#819778]">
                        <ImageIcon size={32} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-36 items-center justify-center bg-[#eef2e9] text-[#66825d]">
                      <Utensils size={38} />
                    </div>
                  )}

                  <div className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold">{item.name}</h3>
                        <p className="mt-1 text-xs text-[#777a70]">
                          {item.category.name}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          item.isAvailable
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {item.isAvailable ? "Available" : "Unavailable"}
                      </span>
                    </div>

                    <p className="mt-3 line-clamp-3 min-h-12 text-sm leading-6 text-[#777a70]">
                      {item.description}
                    </p>

                    <div className="mt-4 flex items-center justify-between gap-2">
                      <p className="text-xl font-bold">{money(item.price)}</p>
                      {item.isVegetarian && (
                        <span className="rounded-full border border-emerald-600 px-2 py-1 text-xs text-emerald-800">
                          Vegetarian
                        </span>
                      )}
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => openEditItemForm(item)}
                        disabled={saving}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-[#dedfd5] px-3 py-2.5 text-sm font-semibold hover:bg-[#f8f7f2] disabled:opacity-50"
                      >
                        <Edit3 size={15} />
                        Edit
                      </button>
                      <button
                        onClick={() => void toggleAvailability(item)}
                        disabled={saving}
                        className="rounded-full bg-[#263b2c] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[#3b5540] disabled:opacity-50"
                      >
                        {item.isAvailable ? "Mark unavailable" : "Make available"}
                      </button>
                    </div>

                    <button
                      onClick={() => void deleteItem(item)}
                      disabled={saving}
                      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full px-3 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 size={15} />
                      Delete dish
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {showItemForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="item-form-title"
            className="my-auto max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="item-form-title" className="text-xl font-bold">
                  {editingItemId ? "Edit dish" : "Add a dish"}
                </h2>
                <p className="mt-1 text-sm text-[#777a70]">
                  Fill in the dish details below.
                </p>
              </div>
              <button
                onClick={() => setShowItemForm(false)}
                aria-label="Close dish form"
                className="rounded-full p-2 hover:bg-[#f0eee8]"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={saveItem} className="mt-6 space-y-4">
              <div>
                <label htmlFor="item-name" className="mb-1.5 block text-sm font-semibold">
                  Dish name *
                </label>
                <input
                  id="item-name"
                  required
                  maxLength={120}
                  value={itemForm.name}
                  onChange={(event) =>
                    setItemForm({ ...itemForm, name: event.target.value })
                  }
                  className="w-full rounded-xl border border-[#dedfd5] px-4 py-3 text-sm outline-none focus:border-[#78916b]"
                  placeholder="e.g. Paneer Tikka"
                />
              </div>

              <div>
                <label htmlFor="item-description" className="mb-1.5 block text-sm font-semibold">
                  Description *
                </label>
                <textarea
                  id="item-description"
                  required
                  maxLength={1000}
                  rows={3}
                  value={itemForm.description}
                  onChange={(event) =>
                    setItemForm({
                      ...itemForm,
                      description: event.target.value,
                    })
                  }
                  className="w-full resize-y rounded-xl border border-[#dedfd5] px-4 py-3 text-sm outline-none focus:border-[#78916b]"
                  placeholder="Describe ingredients and flavour..."
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="item-price" className="mb-1.5 block text-sm font-semibold">
                    Price (₹) *
                  </label>
                  <input
                    id="item-price"
                    required
                    type="number"
                    min="0.01"
                    max="99999999"
                    step="0.01"
                    value={itemForm.price}
                    onChange={(event) =>
                      setItemForm({ ...itemForm, price: event.target.value })
                    }
                    className="w-full rounded-xl border border-[#dedfd5] px-4 py-3 text-sm outline-none focus:border-[#78916b]"
                    placeholder="249.00"
                  />
                </div>

                <div>
                  <label htmlFor="item-category" className="mb-1.5 block text-sm font-semibold">
                    Category *
                  </label>
                  <select
                    id="item-category"
                    required
                    value={itemForm.categoryId}
                    onChange={(event) =>
                      setItemForm({
                        ...itemForm,
                        categoryId: event.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-[#dedfd5] bg-white px-4 py-3 text-sm outline-none focus:border-[#78916b]"
                  >
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="item-image" className="mb-1.5 block text-sm font-semibold">
                  Image URL (optional)
                </label>
                <input
                  id="item-image"
                  type="url"
                  value={itemForm.imageUrl}
                  onChange={(event) =>
                    setItemForm({ ...itemForm, imageUrl: event.target.value })
                  }
                  className="w-full rounded-xl border border-[#dedfd5] px-4 py-3 text-sm outline-none focus:border-[#78916b]"
                  placeholder="https://example.com/dish.jpg"
                />
              </div>

              <div className="flex flex-wrap gap-5">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={itemForm.isVegetarian}
                    onChange={(event) =>
                      setItemForm({
                        ...itemForm,
                        isVegetarian: event.target.checked,
                      })
                    }
                    className="h-4 w-4 accent-[#263b2c]"
                  />
                  Vegetarian
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={itemForm.isAvailable}
                    onChange={(event) =>
                      setItemForm({
                        ...itemForm,
                        isAvailable: event.target.checked,
                      })
                    }
                    className="h-4 w-4 accent-[#263b2c]"
                  />
                  Available to customers
                </label>
              </div>

              <div className="flex flex-col-reverse gap-3 pt-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowItemForm(false)}
                  className="rounded-full border border-[#dedfd5] px-5 py-3 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#263b2c] px-5 py-3 text-sm font-semibold text-white hover:bg-[#3b5540] disabled:opacity-50"
                >
                  {saving ? (
                    <LoaderCircle size={17} className="animate-spin" />
                  ) : (
                    <Save size={17} />
                  )}
                  {saving ? "Saving..." : editingItemId ? "Save changes" : "Add dish"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {showCategoryForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-form-title"
            className="my-auto w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="category-form-title" className="text-xl font-bold">
                  {editingCategoryId ? "Edit category" : "Create category"}
                </h2>
                <p className="mt-1 text-sm text-[#777a70]">
                  Use a clear name that customers can understand.
                </p>
              </div>
              <button
                onClick={() => setShowCategoryForm(false)}
                aria-label="Close category form"
                className="rounded-full p-2 hover:bg-[#f0eee8]"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={saveCategory} className="mt-6 space-y-4">
              <div>
                <label htmlFor="category-name" className="mb-1.5 block text-sm font-semibold">
                  Category name *
                </label>
                <input
                  id="category-name"
                  required
                  maxLength={80}
                  value={categoryForm.name}
                  onChange={(event) =>
                    setCategoryForm({
                      ...categoryForm,
                      name: event.target.value,
                      slug:
                        editingCategoryId &&
                        categoryForm.slug === makeSlug(categoryForm.name)
                          ? makeSlug(event.target.value)
                          : categoryForm.slug,
                    })
                  }
                  className="w-full rounded-xl border border-[#dedfd5] px-4 py-3 text-sm outline-none focus:border-[#78916b]"
                  placeholder="e.g. Starters"
                />
              </div>

              <div>
                <label htmlFor="category-slug" className="mb-1.5 block text-sm font-semibold">
                  URL slug
                </label>
                <input
                  id="category-slug"
                  value={categoryForm.slug}
                  onChange={(event) =>
                    setCategoryForm({ ...categoryForm, slug: event.target.value })
                  }
                  className="w-full rounded-xl border border-[#dedfd5] px-4 py-3 text-sm outline-none focus:border-[#78916b]"
                  placeholder="Automatically generated from the name"
                />
                <p className="mt-1 text-xs text-[#777a70]">
                  Use lowercase letters, numbers, and hyphens.
                </p>
              </div>

              <div className="flex flex-col-reverse gap-3 pt-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowCategoryForm(false)}
                  className="rounded-full border border-[#dedfd5] px-5 py-3 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#263b2c] px-5 py-3 text-sm font-semibold text-white hover:bg-[#3b5540] disabled:opacity-50"
                >
                  {saving ? (
                    <LoaderCircle size={17} className="animate-spin" />
                  ) : (
                    <Save size={17} />
                  )}
                  {saving ? "Saving..." : "Save category"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
