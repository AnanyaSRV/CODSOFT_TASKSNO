
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const categories = [
  {
    name: "Indian",
    slug: "indian",
    items: [
      {
        name: "Paneer Tikka",
        description: "Smoky marinated paneer with peppers and mint chutney.",
        price: 249,
        isVegetarian: true,
        imageUrl: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=900&q=85",
      },
      {
        name: "Masala Dosa",
        description: "Crispy rice crepe filled with spiced potato, served with sambar.",
        price: 179,
        isVegetarian: true,
        imageUrl: "https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=900&q=85",
      },
      {
        name: "Chicken Biryani",
        description: "Fragrant basmati rice layered with spiced chicken and herbs.",
        price: 329,
        isVegetarian: false,
        imageUrl: "https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?auto=format&fit=crop&w=900&q=85",
      },
      {
        name: "Butter Chicken",
        description: "Tender chicken in a creamy tomato and butter sauce.",
        price: 349,
        isVegetarian: false,
        imageUrl: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=900&q=85",
      },
      {
        name: "Garlic Naan",
        description: "Soft tandoor-baked flatbread brushed with garlic butter.",
        price: 69,
        isVegetarian: true,
        imageUrl: "https://images.unsplash.com/photo-1697155406014-04dc649b0953?auto=format&fit=crop&w=900&q=85",
      },
      {
        name: "Gulab Jamun",
        description: "Warm milk-solid dumplings soaked in cardamom syrup.",
        price: 99,
        isVegetarian: true,
        imageUrl: "https://images.unsplash.com/photo-1593701461250-d7b22dfd3a77?auto=format&fit=crop&w=900&q=85",
      },
    ],
  },
  {
    name: "Pizza",
    slug: "pizza",
    items: [
      {
        name: "Truffle Mushroom Pizza",
        description: "Wild mushrooms, mozzarella, herbs and truffle oil.",
        price: 349,
        isVegetarian: true,
        imageUrl: "https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=900&q=85",
      },
      {
        name: "Margherita Pizza",
        description: "Tomato, mozzarella and fresh basil.",
        price: 299,
        isVegetarian: true,
        imageUrl: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=900&q=85",
      },
    ],
  },
  {
    name: "Burgers",
    slug: "burgers",
    items: [
      {
        name: "Classic Smash Burger",
        description: "Grilled beef patty, cheddar, lettuce and house sauce.",
        price: 329,
        isVegetarian: false,
        imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=85",
      },
      {
        name: "Crispy Veg Burger",
        description: "Crunchy vegetable patty with lettuce and tangy house sauce.",
        price: 229,
        isVegetarian: true,
        imageUrl: "https://images.unsplash.com/photo-1520072959219-c595dc870360?auto=format&fit=crop&w=900&q=85",
      },
    ],
  },
  {
    name: "Pasta",
    slug: "pasta",
    items: [
      {
        name: "Creamy Alfredo Pasta",
        description: "Creamy parmesan sauce with fresh herbs.",
        price: 289,
        isVegetarian: true,
        imageUrl: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=900&q=85",
      },
      {
        name: "Arrabbiata Pasta",
        description: "Penne tossed in a bold tomato, garlic and chilli sauce.",
        price: 269,
        isVegetarian: true,
        imageUrl: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=900&q=85",
      },
    ],
  },
  {
    name: "Asian",
    slug: "asian",
    items: [
      {
        name: "Vegetable Hakka Noodles",
        description: "Wok-tossed noodles with vegetables and savoury sauces.",
        price: 219,
        isVegetarian: true,
        imageUrl: "https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=900&q=85",
      },
      {
        name: "Steamed Veg Dumplings",
        description: "Delicate dumplings filled with vegetables and ginger.",
        price: 199,
        isVegetarian: true,
        imageUrl: "https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=900&q=85",
      },
      {
        name: "Chicken Ramen",
        description: "Noodles in a warming broth with chicken and spring onions.",
        price: 349,
        isVegetarian: false,
        imageUrl: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=85",
      },
    ],
  },
  {
    name: "Mexican",
    slug: "mexican",
    items: [
      {
        name: "Paneer Tacos",
        description: "Soft tortillas with spiced paneer, salsa and crunchy slaw.",
        price: 239,
        isVegetarian: true,
        imageUrl: "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&w=900&q=85",
      },
      {
        name: "Loaded Nachos",
        description: "Crispy nachos with cheese, salsa, beans and jalapeños.",
        price: 249,
        isVegetarian: true,
        imageUrl: "https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?auto=format&fit=crop&w=900&q=85",
      },
      {
        name: "Bean Burrito Bowl",
        description: "Rice, black beans, corn, salsa and creamy avocado.",
        price: 269,
        isVegetarian: true,
        imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=85",
      },
    ],
  },
  {
    name: "Healthy",
    slug: "healthy",
    items: [
      {
        name: "Garden Fresh Bowl",
        description: "Fresh greens, tomatoes and lemon dressing.",
        price: 249,
        isVegetarian: true,
        imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=85",
      },
      {
        name: "Grilled Chicken Bowl",
        description: "Grilled chicken, brown rice, greens and herb dressing.",
        price: 329,
        isVegetarian: false,
        imageUrl: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85",
      },
    ],
  },
  {
    name: "Desserts",
    slug: "desserts",
    items: [
      {
        name: "Chocolate Lava Cake",
        description: "Warm chocolate cake with a molten centre.",
        price: 179,
        isVegetarian: true,
        imageUrl: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=900&q=85",
      },
      {
        name: "Classic Tiramisu",
        description: "Coffee-soaked layers with a delicate mascarpone cream.",
        price: 219,
        isVegetarian: true,
        imageUrl: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=900&q=85",
      },
    ],
  },
  {
    name: "Drinks",
    slug: "drinks",
    items: [
      {
        name: "Mango Smoothie",
        description: "A chilled mango smoothie made with yoghurt.",
        price: 149,
        isVegetarian: true,
        imageUrl: "https://images.unsplash.com/photo-1505252585461-04db1eb84625?auto=format&fit=crop&w=900&q=85",
      },
      {
        name: "Fresh Lime Cooler",
        description: "Refreshing lime, mint and sparkling water.",
        price: 99,
        isVegetarian: true,
        imageUrl: "https://images.unsplash.com/photo-1507281549113-040fcfef650e?auto=format&fit=crop&w=900&q=85",
      },
    ],
  },
];

async function main() {
  let createdCount = 0;
  let updatedCount = 0;

  for (const categoryData of categories) {
    const category = await prisma.menuCategory.upsert({
      where: { slug: categoryData.slug },
      update: { name: categoryData.name },
      create: {
        name: categoryData.name,
        slug: categoryData.slug,
      },
    });

    for (const item of categoryData.items) {
      const existing = await prisma.menuItem.findFirst({
        where: {
          name: item.name,
          categoryId: category.id,
        },
      });

      const data = {
        name: item.name,
        description: item.description,
        price: item.price,
        imageUrl: item.imageUrl,
        isVegetarian: item.isVegetarian,
        categoryId: category.id,
        isAvailable: true,
      };

      if (existing) {
        await prisma.menuItem.update({
          where: { id: existing.id },
          data,
        });
        updatedCount++;
      } else {
        await prisma.menuItem.create({ data });
        createdCount++;
      }
    }
  }

  console.log("DineDesk multi-cuisine menu seed completed.");
  console.log(`New dishes created: ${createdCount}`);
  console.log(`Existing dishes updated: ${updatedCount}`);
}

main()
  .catch((error) => {
    console.error("Failed to seed the DineDesk menu:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
