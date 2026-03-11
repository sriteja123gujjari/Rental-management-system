# 🏠 Rental Management System

> Built to solve a real family problem — managing rent collection 
> and shared expenses across multiple shops without errors.

🌐 **Live Demo:** https://rental-management-system-five.vercel.app  
📱 **Android APK:** [Download v1.0](link-to-your-apk-in-releases)

---

## The Problem
My family owns multiple rented shops. We tracked everything manually 
in notebooks — leading to calculation errors when splitting income 
and expenses between 3 members. I built this to fix that.

## What It Does
- **Auto-split** — Rent and expenses divided equally among members
- **Smart settlements** — Calculates exactly who pays whom at month end
- **Arrears tracking** — Flags shops that missed rent in previous months
- **Ghost Shops** — Deleted shops still show correctly in past records
- **PDF export** — Monthly report shareable directly via WhatsApp
- **Glassmorphism UI** — Clean frosted-glass design with Tailwind CSS

## Tech Stack
React • TypeScript • Vite • Tailwind CSS • Supabase • Capacitor

## Platforms
✅ Web — deployed on Vercel  
✅ Android APK — built with Capacitor

## Database (Supabase PostgreSQL)
- `shops` — property details with family_id and base_rent
- `rent_records` — monthly income with settlement tracking  
- `expenses` — shared costs with paid_by and category

## Screenshots
