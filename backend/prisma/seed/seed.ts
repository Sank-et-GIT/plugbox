import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.charger.create({
    data: {
      name: "PlugBox Charger #1",
      lat: 18.5204,
      lng: 73.8567,
      status: "ONLINE",
    },
  });

  console.log("Seeded 1 charger");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
