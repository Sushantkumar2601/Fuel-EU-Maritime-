import { Router } from 'express';
import prisma from '../../../infra/prismaClient';
import { computeCB } from '../../../core/application/computeCB';
const router = Router();
const TARGET_2025 = 89.3368;
router.get('/routes', async (_req, res) => {
  const routes = await prisma.route.findMany();
  res.json(routes);
});
router.post('/routes/:routeId/baseline', async (req, res) => {
  const { routeId } = req.params;
  const route = await prisma.route.findUnique({ where: { routeId } });
  if (!route) return res.status(404).json({ error: 'not found' });
  await prisma.route.updateMany({ where: { year: route.year }, data: { isBaseline: false } });
  const updated = await prisma.route.update({ where: { routeId }, data: { isBaseline: true } });
  res.json(updated);
});
router.get('/routes/comparison', async (_req, res) => {
  const baseline = await prisma.route.findFirst({ where: { isBaseline: true } });
  if (!baseline) return res.status(400).json({ error: 'no baseline' });
  const others = await prisma.route.findMany({ where: { NOT: { routeId: baseline.routeId } } });
  const comparisons = others.map(r => {
    const percentDiff = ((r.ghgIntensity / baseline.ghgIntensity) - 1) * 100;
    const compliant = r.ghgIntensity <= TARGET_2025;
    return { routeId: r.routeId, ghgIntensity: r.ghgIntensity, percentDiff, compliant };
  });
  res.json({ baseline: { routeId: baseline.routeId, ghgIntensity: baseline.ghgIntensity }, comparisons });
});
router.get('/compliance/cb', async (req, res) => {
  const shipId = String(req.query.shipId || '');
  const year = Number(req.query.year || 0);
  if (!shipId || !year) return res.status(400).json({ error: 'shipId & year required' });
  const route = await prisma.route.findUnique({ where: { routeId: shipId } });
  if (!route) return res.status(404).json({ error: 'Route not found' });
  const { energyMJ, cbG, cbTonnes } = computeCB(TARGET_2025, route.ghgIntensity, route.fuelConsumptionT);
  const snapshot = await prisma.shipCompliance.create({ data: { shipId, year, cbGco2eq: cbG } });
  res.json({ shipId, year, energyMJ, cbG, cbTonnes, snapshotId: snapshot.id });
});
router.get('/compliance/adjusted-cb', async (req, res) => {
  const shipId = String(req.query.shipId || '');
  const year = Number(req.query.year || 0);
  if (!shipId || !year) return res.status(400).json({ error: 'shipId & year required' });
  const route = await prisma.route.findUnique({ where: { routeId: shipId } });
  if (!route) return res.status(404).json({ error: 'Route not found' });
  const { cbG } = computeCB(TARGET_2025, route.ghgIntensity, route.fuelConsumptionT);
  const bankEntries = await prisma.bankEntry.findMany({ where: { shipId, year } });
  const bankedTotal = bankEntries.reduce((s, e) => s + e.amountGco2eq, 0);
  const adjustedG = cbG + bankedTotal;
  res.json({ shipId, year, cbG, bankedTotal, adjustedG, adjustedTonnes: adjustedG / 1e6 });
});
router.get('/banking/records', async (req, res) => {
  const shipId = String(req.query.shipId || '');
  const year = Number(req.query.year || 0);
  if (!shipId || !year) return res.status(400).json({ error: 'shipId & year required' });
  const entries = await prisma.bankEntry.findMany({ where: { shipId, year } });
  const total = entries.reduce((s, e) => s + e.amountGco2eq, 0);
  res.json({ entries, total });
});
router.post('/banking/bank', async (req, res) => {
  const { shipId, year, amountGco2eq } = req.body;
  if (!shipId || !year || typeof amountGco2eq !== 'number') return res.status(400).json({ error: 'invalid' });
  const route = await prisma.route.findUnique({ where: { routeId: shipId } });
  if (!route) return res.status(404).json({ error: 'route not found' });
  const { cbG } = computeCB(TARGET_2025, route.ghgIntensity, route.fuelConsumptionT);
  if (cbG <= 0) return res.status(400).json({ error: 'no positive cb to bank' });
  if (amountGco2eq > cbG) return res.status(400).json({ error: 'amount exceeds cb' });
  const entry = await prisma.bankEntry.create({ data: { shipId, year, amountGco2eq } });
  res.json({ entry });
});
router.post('/banking/apply', async (req, res) => {
  const { shipId, year, amountGco2eq } = req.body;
  if (!shipId || !year || typeof amountGco2eq !== 'number') return res.status(400).json({ error: 'invalid' });
  const entries = await prisma.bankEntry.findMany({ where: { shipId, year } });
  const available = entries.reduce((s, e) => s + e.amountGco2eq, 0);
  if (amountGco2eq > available) return res.status(400).json({ error: 'insufficient' });
  const applied = await prisma.bankEntry.create({ data: { shipId, year, amountGco2eq: -Math.abs(amountGco2eq) } });
  res.json({ applied, availableBefore: available, availableAfter: available - amountGco2eq });
});
router.post('/pools', async (req, res) => {
  const { year, members } = req.body;
  if (!year || !Array.isArray(members)) return res.status(400).json({ error: 'invalid body' });
  const sum = members.reduce((s, m) => s + Number(m.cbBefore), 0);
  if (sum < 0) return res.status(400).json({ error: 'pool sum negative' });
  const allocated = members.map(m => ({ shipId: m.shipId, cbBefore: Number(m.cbBefore), cbAfter: Number(m.cbBefore) }));
  const surplusList = allocated.filter(m => m.cbAfter > 0).sort((a,b) => b.cbAfter - a.cbAfter);
  const deficitList = allocated.filter(m => m.cbAfter < 0).sort((a,b) => a.cbAfter - b.cbAfter);
  for (const s of surplusList) {
    if (!deficitList.length) break;
    for (const d of deficitList) {
      if (s.cbAfter <= 0) break;
      if (d.cbAfter >= 0) continue;
      const transfer = Math.min(s.cbAfter, Math.abs(d.cbAfter));
      s.cbAfter -= transfer;
      d.cbAfter += transfer;
    }
    while (deficitList.length && deficitList[0].cbAfter >= 0) deficitList.shift();
  }
  const pool = await prisma.pool.create({ data: { year } });
  for (const m of allocated) {
    await prisma.poolMember.create({ data: { poolId: pool.id, shipId: m.shipId, cbBefore: m.cbBefore, cbAfter: m.cbAfter } });
  }
  res.json({ poolId: pool.id, members: allocated, poolSum: sum });
});
export default router;
