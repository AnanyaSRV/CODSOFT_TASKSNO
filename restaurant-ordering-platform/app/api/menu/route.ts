import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth/require-staff";

export async function GET() {
  try {
    const categories = await prisma.menuCategory.findMany({
      orderBy: { name: "asc" },
      include: {
        items: {
          where: { isAvailable: true },
          orderBy: { name: "asc" },
        },
      },
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Failed to load menu:", error);

    return NextResponse.json(
      { error: "Unable to load the menu right now." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const access = await requireStaff(["ADMIN"]);

  if (access.response) {
    return access.response;
  }

  try {
    const body = await request.json();
    const action = body.action;

    if (action === "createCategory") {
      const name =
        typeof body.name === "string" ? body.name.trim() : "";

      const slugInput =
        typeof body.slug === "string" ? body.slug.trim() : "";

      if (!name || name.length > 80) {
        return NextResponse.json(
          { error: "Category name is required and must be at most 80 characters." },
          { status: 400 },
        );
      }

      const slug =
        slugInput ||
        name
          .toLowerCase()
          .normalize("NFKD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");

      if (!slug || slug.length > 100) {
        return NextResponse.json(
          { error: "Please provide a valid category slug." },
          { status: 400 },
        );
      }

      const category = await prisma.menuCategory.create({
        data: { name, slug },
      });

      return NextResponse.json({ category }, { status: 201 });
    }

    if (action === "updateCategory") {
      const id = typeof body.id === "string" ? body.id : "";
      const name =
        typeof body.name === "string" ? body.name.trim() : "";
      const slugInput =
        typeof body.slug === "string" ? body.slug.trim() : "";

      if (!id || !name || name.length > 80) {
        return NextResponse.json(
          { error: "A category ID and valid name are required." },
          { status: 400 },
        );
      }

      const slug =
        slugInput ||
        name
          .toLowerCase()
          .normalize("NFKD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");

      if (!slug || slug.length > 100) {
        return NextResponse.json(
          { error: "Please provide a valid category slug." },
          { status: 400 },
        );
      }

      const category = await prisma.menuCategory.update({
        where: { id },
        data: { name, slug },
      });

      return NextResponse.json({ category });
    }

    if (action === "createItem") {
      const name =
        typeof body.name === "string" ? body.name.trim() : "";
      const description =
        typeof body.description === "string"
          ? body.description.trim()
          : "";
      const categoryId =
        typeof body.categoryId === "string" ? body.categoryId : "";
      const imageUrl =
        typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
      const price = Number(body.price);

      if (
        !name ||
        name.length > 120 ||
        !description ||
        description.length > 1000 ||
        !categoryId ||
        !Number.isFinite(price) ||
        price <= 0 ||
        price > 99999999
      ) {
        return NextResponse.json(
          { error: "Enter a valid name, description, category, and positive price." },
          { status: 400 },
        );
      }

      if (
        imageUrl &&
        (!/^https?:\/\//i.test(imageUrl) || imageUrl.length > 2000)
      ) {
        return NextResponse.json(
          { error: "Image URL must be a valid HTTP or HTTPS URL." },
          { status: 400 },
        );
      }

      const category = await prisma.menuCategory.findUnique({
        where: { id: categoryId },
        select: { id: true },
      });

      if (!category) {
        return NextResponse.json(
          { error: "The selected category does not exist." },
          { status: 400 },
        );
      }

      const item = await prisma.menuItem.create({
        data: {
          name,
          description,
          price,
          categoryId,
          imageUrl: imageUrl || null,
          isAvailable: body.isAvailable !== false,
          isVegetarian: body.isVegetarian === true,
        },
        include: { category: true },
      });

      return NextResponse.json({ item }, { status: 201 });
    }

    if (action === "updateItem") {
      const id = typeof body.id === "string" ? body.id : "";
      const name =
        typeof body.name === "string" ? body.name.trim() : "";
      const description =
        typeof body.description === "string"
          ? body.description.trim()
          : "";
      const categoryId =
        typeof body.categoryId === "string" ? body.categoryId : "";
      const imageUrl =
        typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
      const price = Number(body.price);

      if (
        !id ||
        !name ||
        name.length > 120 ||
        !description ||
        description.length > 1000 ||
        !categoryId ||
        !Number.isFinite(price) ||
        price <= 0 ||
        price > 99999999
      ) {
        return NextResponse.json(
          { error: "Enter a valid item ID, name, description, category, and positive price." },
          { status: 400 },
        );
      }

      if (
        imageUrl &&
        (!/^https?:\/\//i.test(imageUrl) || imageUrl.length > 2000)
      ) {
        return NextResponse.json(
          { error: "Image URL must be a valid HTTP or HTTPS URL." },
          { status: 400 },
        );
      }

      const [existingItem, category] = await Promise.all([
        prisma.menuItem.findUnique({
          where: { id },
          select: { id: true },
        }),
        prisma.menuCategory.findUnique({
          where: { id: categoryId },
          select: { id: true },
        }),
      ]);

      if (!existingItem) {
        return NextResponse.json(
          { error: "Menu item not found." },
          { status: 404 },
        );
      }

      if (!category) {
        return NextResponse.json(
          { error: "The selected category does not exist." },
          { status: 400 },
        );
      }

      const item = await prisma.menuItem.update({
        where: { id },
        data: {
          name,
          description,
          price,
          categoryId,
          imageUrl: imageUrl || null,
          isVegetarian: body.isVegetarian === true,
          isAvailable: body.isAvailable === true,
        },
        include: { category: true },
      });

      return NextResponse.json({ item });
    }

    if (action === "toggleAvailability") {
      const id = typeof body.id === "string" ? body.id : "";
      const isAvailable = body.isAvailable;

      if (!id || typeof isAvailable !== "boolean") {
        return NextResponse.json(
          { error: "An item ID and availability value are required." },
          { status: 400 },
        );
      }

      const item = await prisma.menuItem.update({
        where: { id },
        data: { isAvailable },
        include: { category: true },
      });

      return NextResponse.json({ item });
    }

    if (action === "deleteItem") {
      const id = typeof body.id === "string" ? body.id : "";

      if (!id) {
        return NextResponse.json(
          { error: "A menu item ID is required." },
          { status: 400 },
        );
      }

      const item = await prisma.menuItem.findUnique({
        where: { id },
        select: { id: true, name: true },
      });

      if (!item) {
        return NextResponse.json(
          { error: "Menu item not found." },
          { status: 404 },
        );
      }

      const linkedOrderItems = await prisma.orderItem.count({
        where: { menuItemId: id },
      });

      if (linkedOrderItems > 0) {
        return NextResponse.json(
          {
            error:
              "This dish appears in existing orders. Mark it unavailable instead of deleting it.",
          },
          { status: 409 },
        );
      }

      await prisma.menuItem.delete({ where: { id } });

      return NextResponse.json({
        success: true,
        message: `${item.name} was deleted.`,
      });
    }

    if (action === "deleteCategory") {
      const id = typeof body.id === "string" ? body.id : "";

      if (!id) {
        return NextResponse.json(
          { error: "A category ID is required." },
          { status: 400 },
        );
      }

      const category = await prisma.menuCategory.findUnique({
        where: { id },
        include: { _count: { select: { items: true } } },
      });

      if (!category) {
        return NextResponse.json(
          { error: "Category not found." },
          { status: 404 },
        );
      }

      if (category._count.items > 0) {
        return NextResponse.json(
          {
            error:
              "This category still contains dishes. Move or delete its dishes before deleting the category.",
          },
          { status: 409 },
        );
      }

      await prisma.menuCategory.delete({ where: { id } });

      return NextResponse.json({
        success: true,
        message: `${category.name} was deleted.`,
      });
    }

    return NextResponse.json(
      { error: "Unknown menu management action." },
      { status: 400 },
    );
  } catch (error) {
    console.error("Menu management error:", error);

    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "";

    if (code === "P2002") {
      return NextResponse.json(
        { error: "That category name or slug is already in use." },
        { status: 409 },
      );
    }

    if (code === "P2025") {
      return NextResponse.json(
        { error: "The requested menu record was not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Menu management request failed." },
      { status: 500 },
    );
  }
}
