# Application Description for API Registration

## Short Version (for form field - ~200 characters)

**Property Portfolio Management System** - A web application for real estate agencies to manage rental apartments, track lease contracts, and automatically publish available listings to OLX/Otodom marketplaces via API integration.

---

## Medium Version (recommended - ~500 characters)

**Property Portfolio Management System (PMS)**

A professional web-based application designed for real estate agencies and property managers to efficiently manage their rental property portfolio. The application allows users to:

- Track apartment inventory with detailed information (location, price, area, photos, status)
- Manage lease contracts and monitor expiration dates
- Automatically publish available listings to OLX and Otodom marketplaces via API integration
- Synchronize listing status between internal database and external platforms
- Generate XML feeds for bulk listing exports

**API Usage:**
We require API access to enable automated listing publication, updates, and deletion on OLX/Otodom platforms. Each authenticated user will manage their own listings through OAuth 2.0 authorization, ensuring secure and personalized access to their property portfolio.

**Target Users:** Real estate agencies, property management companies, and individual property managers in Poland.

---

## Detailed Version (if more space available - ~1000 characters)

**Property Portfolio Management System (PMS) - Real Estate Management Platform**

**Overview:**
Property Portfolio Management System is a comprehensive web application built for real estate professionals to streamline their rental property management workflow. The platform combines internal property database management with seamless integration to major Polish real estate marketplaces.

**Core Features:**
1. **Property Management:** Complete CRUD operations for apartment listings with support for photos, pricing, location details, and status tracking (Available/Rented/Maintenance)
2. **Lease Management:** Track lease contracts with expiration dates and automated notifications
3. **Multi-Platform Publishing:** Automated synchronization of listings to OLX and Otodom marketplaces
4. **User Authentication:** Secure JWT-based authentication system supporting multiple users
5. **API Integration:** RESTful API for programmatic access and third-party integrations

**API Integration Purpose:**
We require API access to OLX and Otodom platforms to enable:
- **Automated Listing Publication:** When a property becomes available, automatically create listings on marketplaces
- **Real-time Updates:** Keep marketplace listings synchronized with internal database changes (price, description, photos)
- **Listing Management:** Allow users to update or remove listings directly from our platform
- **OAuth 2.0 Authentication:** Each user authenticates with their own OLX/Otodom account, ensuring they manage only their own listings

**Technical Architecture:**
- Frontend: React (Vite) with modern UI/UX
- Backend: Node.js (Express) with MongoDB
- Authentication: JWT tokens with OAuth 2.0 for marketplace integration
- API: RESTful endpoints following industry best practices

**Use Case:**
A property manager manages 50+ rental apartments. Instead of manually creating and updating listings on multiple platforms, they use our application to:
1. Add apartment details once in our system
2. Automatically publish to OLX and Otodom when status changes to "Available"
3. Update pricing or photos in one place, syncing changes across platforms
4. Remove listings automatically when apartments are rented

**Target Market:** Real estate agencies, property management companies, and professional property managers operating in Poland.

**Privacy & Security:**
- Each user's API credentials are stored securely
- OAuth 2.0 ensures users only access their own listings
- No sharing of user data between accounts
- GDPR-compliant data handling

---

## For OLX Developer Portal

**Application Name:** Property Portfolio Management System

**Description:**
Property management web application for real estate agencies to manage rental apartments and automatically publish listings to OLX marketplace. Users authenticate via OAuth 2.0 to manage their own property listings. The application enables bulk listing management, automated synchronization, and streamlined workflow for property managers.

**Use Case:**
Real estate professionals use the application to track their rental property portfolio and automatically publish available apartments to OLX, keeping listings synchronized with their internal database.

---

## For Otodom (OLX Group Developer Hub)

**Application Name:** Property Portfolio Management System

**Product:** Real Estate API

**Description:**
Professional property management system for real estate agencies in Poland. The application helps property managers track rental apartments, manage lease contracts, and automatically publish available listings to Otodom marketplace via API integration. Each user authenticates with their own Otodom account through OAuth 2.0, ensuring secure and personalized access to their property listings.

**Business Value:**
- Reduces manual work for property managers
- Ensures listings are always up-to-date across platforms
- Streamlines the rental property management workflow
- Supports multiple users with individual account access

**Technical Implementation:**
- OAuth 2.0 authentication for secure user access
- RESTful API integration for listing CRUD operations
- Automated synchronization between internal database and Otodom
- Support for bulk operations and real-time updates
