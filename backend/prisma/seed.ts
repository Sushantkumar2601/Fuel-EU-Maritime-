import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.route.deleteMany();
  await prisma.route.createMany({
    data: [
      { routeId: 'R001', vesselType: 'Container', fuelType: 'HFO', year: 2024, ghgIntensity: 91.0, fuelConsumptionT: 5000, distanceKm: 12000, totalEmissionsT: 4500, isBaseline: true},
      { routeId: 'R002', vesselType: 'BulkCarrier', fuelType: 'LNG', year: 2024, ghgIntensity: 88.0, fuelConsumptionT: 4800, distanceKm: 11500, totalEmissionsT: 4200},
      { routeId: 'R003', vesselType: 'Tanker', fuelType: 'MGO', year: 2024, ghgIntensity: 93.5, fuelConsumptionT: 5100, distanceKm: 12500, totalEmissionsT: 4700},
      { routeId: 'R004', vesselType: 'RoRo', fuelType: 'HFO', year: 2025, ghgIntensity: 89.2, fuelConsumptionT: 4900, distanceKm: 11800, totalEmissionsT: 4300},
      { routeId: 'R005', vesselType: 'Container', fuelType: 'LNG', year: 2025, ghgIntensity: 90.5, fuelConsumptionT: 4950, distanceKm: 11900, totalEmissionsT: 4400}
    ]
  });
  console.log('Seed complete');
}
main().catch(e=>{ console.error(e); process.exit(1); }).finally(async()=>{ await prisma.$disconnect(); });
