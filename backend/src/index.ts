import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './adapters/inbound/http/routes';
import prisma from './infra/prismaClient';
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use('/', routes);
app.get('/_health', (_req, res) => res.json({ ok: true }));
const PORT = process.env.PORT || 4000;
app.listen(PORT, async () => {
  try { await prisma.$connect(); console.log('Database connected successfully'); } catch (err) { console.error('DB connect error', err); }
  console.log(`Backend running on http://localhost:${PORT}`);
});
