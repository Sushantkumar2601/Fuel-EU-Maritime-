Fuel EU Maritime — Full Project (Frontend + Backend)

Quick start (backend):
  cd backend
  npm install
  npx prisma generate
  npx prisma migrate dev --name init
  npx ts-node prisma/seed.ts
  npm run dev

Quick start (frontend):
  cd frontend
  npm install
  npm run dev

Backend connects to PostgreSQL at DATABASE_URL in backend/.env
