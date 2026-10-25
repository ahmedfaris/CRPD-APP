# Enterprise Operations Portal — ASP.NET Core MVC 8.0 Solution

Production-ready enterprise ASP.NET Core MVC architecture with Entity Framework Core, ASP.NET Core Identity, RFC 6238 TOTP Multi-Factor Authentication, and Serilog structured logging.

---

## Solution Structure

```text
EnterprisePortal.sln
└── EnterprisePortal.Web/
    ├── EnterprisePortal.Web.csproj
    ├── Program.cs                         # Serilog pipeline, Identity, EF Core, TOTP service, and MVC routes
    ├── appsettings.json                   # DB provider (Sqlite/SqlServer), Serilog sinks, SecurityPolicy
    ├── Data/
    │   ├── ApplicationDbContext.cs        # IdentityDbContext with Tickets, Documents, Employees, Logs
    │   └── DbInitializer.cs               # Seed roles, Admin (2FA disabled), sample tickets & archives
    ├── Models/
    │   ├── ApplicationUser.cs             # IdentityUser with 2FA secret, Department, JobTitle
    │   ├── Ticket.cs                      # Incident ticket entity with SLA calculation and audit
    │   ├── ArchivalDocument.cs            # Legal archive records, SHA-256 seal, QRCoder barcode
    │   ├── Employee.cs                    # HR staff directory entity
    │   └── ViewModels.cs                  # Login, 2FA, UserPolicy, MetroHub view models
    ├── Services/
    │   ├── ITotpService.cs & TotpService.cs   # RFC 6238 TOTP engine with ±60s clock drift tolerance
    │   └── IQrCodeService.cs & QrCodeService.cs # QRCoder barcode and authenticator QR generator
    ├── Controllers/
    │   ├── MetroController.cs             # Metro Hub main navigation & operational metrics
    │   ├── AccountController.cs           # Login (Admin bypasses 2FA), TOTP validation, lockout
    │   ├── TicketsController.cs           # Tickets CRUD, SLA status, Serilog audit
    │   ├── ArchivingController.cs         # Document vault, barcode verification, categorization
    │   ├── EmployeesController.cs         # HR directory, staff profiles
    │   ├── UserPolicyController.cs        # Selective 2FA toggles, secret regeneration, clock drift
    │   └── DiagnosticsController.cs       # Real-time Serilog sink file viewer
    └── Views/
        ├── Shared/_Layout.cshtml          # Metro & Tailwind CSS responsive layout
        ├── Metro/Index.cshtml             # High-contrast interactive Metro tile dashboard
        ├── Account/Login.cshtml           # Security login
        ├── Account/Verify2FA.cshtml       # TOTP QR scan and 6-digit code entry
        ├── Tickets/Index.cshtml           # Incident management table
        ├── Archiving/Index.cshtml         # Digital archive cards
        ├── Employees/Index.cshtml         # Personnel directory
        ├── UserPolicy/Index.cshtml        # Security policy & 2FA administration
        └── Diagnostics/Serilog.cshtml     # Log file sink terminal viewer
```

---

## Quick Start (.NET 8.0 or .NET 9.0 SDK)

### Option 1: .NET CLI

1. Navigate to the web project directory:
   ```bash
   cd EnterprisePortal.Web
   ```

2. Restore NuGet dependencies:
   ```bash
   dotnet restore
   ```

3. Run the application:
   ```bash
   dotnet run
   ```

4. Open your browser at:
   `https://localhost:7001` or `http://localhost:5000`

> **Note:** On first startup, `DbInitializer` automatically creates the database (`enterprise_portal.db`) and seeds all default administrative accounts, demo incident tickets, legal archives, and employee records.

---

### Option 2: Visual Studio 2022

1. Open `EnterprisePortal.sln` in Visual Studio 2022.
2. Ensure `EnterprisePortal.Web` is set as the **Startup Project**.
3. Press **F5** (or click **https** debug button) to build and run.

---

## Pre-Configured Seed Credentials

| Account Role | Email / Username | Password | 2FA Policy |
| :--- | :--- | :--- | :--- |
| **Global Admin** | `admin@system.local` | `Admin@2026!` | **Direct Password Sign-in (2FA Bypassed)** |
| **Cyber Incident Responder** | `sara.khalid@system.local` | `Agent@2026!` | **2FA Enforced (TOTP RFC 6238)** |
| **HR Talent Specialist** | `omar.farooq@system.local` | `User@2026!` | **2FA Enforced (TOTP RFC 6238)** |

---

## Database Configuration

By default, the solution uses **SQLite** (`enterprise_portal.db`) for instant zero-configuration development. To switch to **Microsoft SQL Server**:

1. In `appsettings.json`, set `"DatabaseProvider": "SqlServer"`.
2. Update `"SqlServerConnection"` with your server details.
3. Run `dotnet ef migrations add InitialCreate` and `dotnet ef database update`.

---

## Features Implemented

1. **Metro UI Dashboard**: High-contrast, responsive tile layout with real-time operational badges.
2. **Flexible 2FA Policy Engine**:
   - Default Administrator bypasses 2FA for direct password sign-in.
   - Per-user 2FA toggle button in the **Policy & 2FA Control** page.
   - Secret key regeneration forces a new QR barcode re-scan on next login.
   - Server clock drift tolerance selector (±30s, ±60s standard 1-minute, ±90s extended).
3. **Incident Ticket Management**: Automated SLA tracking with breach alert, priority classification, internal comments, and audit logging.
4. **Digital Archival Vault**: QRCoder barcode generation, legal retention metadata, and SHA-256 cryptographic fingerprints.
5. **Staff Directory**: Human resources registry with contact information, performance ratings, and department categorizations.
6. **Serilog Sinks**: Colored console sink and daily rolling file sink (`Logs/enterprise_audit-yyyyMMdd.txt`).
