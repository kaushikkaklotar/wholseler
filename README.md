# Wholesale Commerce System

MVP foundation for a Surat/Gujarat-focused B2B wholesale commerce platform.

## Current scope

- Wholesaler owner dashboard
- Staff management with subscription-based staff limits
- Module-wise staff permissions
- Product catalog overview
- Billing/invoice workspace mock
- Seller inquiry overview
- Prisma/PostgreSQL schema for the MVP data model

## Stack

- Next.js App Router
- React
- TypeScript
- Prisma ORM
- PostgreSQL
- CSS variables for a sober dashboard UI

## Setup

1. Copy `.env.example` to `.env`.
2. Update `DATABASE_URL`.
3. Install dependencies:

```bash
npm install
```

4. Generate Prisma client:

```bash
npm run db:generate
```

5. Run the development server:

```bash
npm run dev
```

## Notes

The first implementation uses demo data for UI flow clarity. The Prisma schema is ready for PostgreSQL migrations once the database connection is provided.
