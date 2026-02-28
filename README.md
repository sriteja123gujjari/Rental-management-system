# Rental Management System

I built this app to solve a practical problem: keeping track of rent collection, shared expenses, and peer-to-peer debts across multiple family-owned properties. 

It's a web application built with React and Supabase, wrapped into a native Android APK using Capacitor.

## What it does

* **Smart Settlements:** At the end of the month, the app calculates the total pot (rent minus expenses), splits it equally, and figures out exactly who needs to pay whom to balance the books. 
* **Preserves History:** When you hit "Settle Up", it clears the active debts but keeps the underlying payment records intact so your "Total Revenue" history is never lost.
* **Arrears Tracking:** It looks at historical database records to automatically flag if a property missed rent in previous months.
* **Failsafe Data ("Ghost Shops"):** If a property is sold or deleted from the system, its historical payment records still render correctly in past months.
* **Modern UI:** Built with Tailwind CSS utilizing a frosted-glass (glassmorphism) design.
* **Export & Share:** Generates PDF reports that can be shared directly via WhatsApp.

## Tech Stack

* **Frontend:** React, TypeScript, Vite
* **Styling:** Tailwind CSS, Lucide Icons
* **Backend:** Supabase (PostgreSQL + Auth)
* **Mobile:** Capacitor (Android)

## Database Setup

The app relies on a Supabase PostgreSQL database with three main tables:
1. `shops`: Property details (`id`, `name`, `base_rent`, `family_id`, `month`).
2. `rent_records`: Income tracking (`id`, `shop_id`, `amount_paid`, `collected_by`, `is_settled`, `month`).
3. `expenses`: Shared costs (`id`, `description`, `amount`, `paid_by`, `is_settled`, `month`).

## Running it Locally

### 1. Clone & Install
```bash
git clone [https://github.com/yourusername/rental-management-system.git](https://github.com/yourusername/rental-management-system.git)
cd rental-management-system
npm install
