# 🏪 Sama Storefront

A full-featured, modern storefront web application built with **Node.js**, **Express**, and **SQLite**. Customers can browse products, manage a cart, rate items, like favourites, and place orders with a smooth checkout flow.

---

## ✨ Features

- **Product Catalogue** — Browse products by category with live search
- **Product Detail Modal** — Full product info, images, and interactive star ratings
- **Shopping Cart** — Add/remove items, quantity controls, and real-time totals
- **Checkout Flow** — Multi-step checkout: cart review → shipping info → payment → receipt
- **M-Pesa Payment** — Call-to-order integration with number **0726064668**
- **Star Ratings** — Click any star to set an individual rating (1–5); click again to unrate
- **Like / Unlike** — Simple heart icon (🤍 → ❤️) per product
- **Order Receipt** — Printable invoice generated after successful order placement
- **Toast Notifications** — Animated feedback for all user actions
- **Responsive Design** — Clean, premium UI with glassmorphism and micro-animations

---

## 🛠️ Tech Stack

| Layer      | Technology          |
|------------|---------------------|
| Backend    | Node.js + Express   |
| Database   | SQLite (via better-sqlite3) |
| Frontend   | Vanilla HTML/CSS/JS |
| Dev Server | Nodemon             |

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/KasandraRudeboy/sama-storefront.git
cd sama-storefront

# Install dependencies
npm install

# Start the development server
npx nodemon server.js
```

The app will be available at **http://localhost:3000**

---

## 📁 Project Structure

```
sama-storefront/
├── public/
│   ├── index.html      # Storefront page
│   ├── style.css       # All styles
│   └── app.js          # Client-side logic
├── server.js           # Express API server
├── package.json
└── .gitignore
```

---

## 📞 Contact / Order

To place an order, call: **0726064668**

---

## 📄 License

MIT © 2026 Sama Storefront
