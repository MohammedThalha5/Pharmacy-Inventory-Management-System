# Medstock · Pharmacy Inventory Management System

A complete pharmacy inventory and billing system.

- **Database:** MySQL 8.0.16+
- **Back end:** Node.js + Express REST API (`backend/`)
- **Front end:** responsive single-page app in plain HTML/CSS/JS (`frontend/`), served by the same Express server

## Features
- **Dashboard**: sales today/month, stock value, a "Needs attention" queue (expired, expiring soon, low stock), 7-day sales chart, best sellers, stock value by category
- **Inventory**: medicine catalogue with live stock gauges, search, category and status filters, add/edit/archive, CSV export
- **Batches & expiry**: every delivery tracked as a batch, expiry countdown, write-off of expired stock
- **New sale (POS)**: fast search, cart, GST, discount, Cash/UPI/Card, printable receipt. Stock is deducted **first-expiry-first-out**, and expired stock can never be sold
- **Sales history**: date-range filter, totals, receipts, CSV export
- **Purchases**: record supplier deliveries; each line creates or tops up a batch
- **Suppliers**: contact cards with purchase totals
- Login with roles (`admin`, `pharmacist`); only admins can remove records

## Setup (5 minutes)

1. **Install** Node.js 18+ and MySQL 8.0.16+.
2. **Create the database and sample data**
   ```bash
   mysql -u root -p < database/schema.sql
   mysql -u root -p pharmacy_db < database/seed.sql
   ```
   Skip `seed.sql` if you want to start with an empty system.
3. **Configure the server**
   ```bash
   cd backend
   cp .env.example .env      # then edit DB_PASSWORD and JWT_SECRET
   npm install
   npm start
   ```
4. Open **http://localhost:3000** and sign in with **admin** / **admin123**
   (the password comes from `ADMIN_PASSWORD` in `.env`, used the first time the server starts).

## Project layout
```
database/schema.sql     tables, keys, indexes, v_medicine_stock view
database/seed.sql       sample medicines, batches, suppliers, a week of sales
backend/server.js       all API routes (auth, medicines, batches, purchases, sales, dashboard)
backend/db.js           MySQL connection pool
frontend/               index.html, css/styles.css, js/*.js
```

## Notes
- Prices are in Indian rupees (₹) with per-medicine GST. Change `PHARMACY_NAME` and `PHARMACY_ADDRESS` at the top of `frontend/js/core.js` for receipts.
- Medicines and suppliers are archived (not deleted) so sales and purchase history stay intact.
- Sales and purchases run inside MySQL transactions with row locks, so stock never goes negative.
