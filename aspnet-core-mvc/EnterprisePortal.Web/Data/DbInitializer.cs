using System;
using System.Linq;
using System.Threading.Tasks;
using EnterprisePortal.Web.Models;
using Microsoft.AspNetCore.Identity;
using Serilog;

namespace EnterprisePortal.Web.Data
{
    public static class DbInitializer
    {
        public static async Task InitializeAsync(
            ApplicationDbContext context,
            UserManager<ApplicationUser> userManager,
            RoleManager<IdentityRole> roleManager)
        {
            // 1. Roles
            string[] roleNames = { "Admin", "Agent", "Employee", "Auditor" };
            foreach (var roleName in roleNames)
            {
                if (!await roleManager.RoleExistsAsync(roleName))
                {
                    await roleManager.CreateAsync(new IdentityRole(roleName));
                }
            }

            // 2. Default Administrator (Notice: 2FA disabled by default for immediate sign in, with full policy bypass)
            var adminEmail = "admin@system.local";
            var adminUser = await userManager.FindByEmailAsync(adminEmail);
            if (adminUser == null)
            {
                adminUser = new ApplicationUser
                {
                    UserName = "admin@system.local",
                    Email = adminEmail,
                    EmailConfirmed = true,
                    FullName = "Chief Technology Officer",
                    Department = "Executive Directorate & IT",
                    JobTitle = "Global System Administrator",
                    AvatarColor = "bg-purple-700",
                    TwoFactorEnabled = false, // Direct login policy
                    TwoFactorSecret = null,
                    MustChangePassword = false,
                    CreatedAt = DateTime.UtcNow.AddMonths(-6)
                };

                var result = await userManager.CreateAsync(adminUser, "Admin@2026!");
                if (result.Succeeded)
                {
                    await userManager.AddToRoleAsync(adminUser, "Admin");
                    Log.Information("Default Admin account seeded: {AdminEmail} with direct login policy (2FA Disabled).", adminEmail);
                }
            }

            // 3. Demo Users (Agent & Employee)
            var agentEmail = "sara.khalid@system.local";
            if (await userManager.FindByEmailAsync(agentEmail) == null)
            {
                var agent = new ApplicationUser
                {
                    UserName = agentEmail,
                    Email = agentEmail,
                    EmailConfirmed = true,
                    FullName = "Sara Al-Mansoor",
                    Department = "Cybersecurity Operations",
                    JobTitle = "Senior SOC Incident Responder",
                    AvatarColor = "bg-emerald-600",
                    TwoFactorEnabled = true,
                    TwoFactorSecret = "JBSWY3DPEHPK3PXP", // RFC 3548 Base32 test secret
                    MustChangePassword = false
                };
                var res = await userManager.CreateAsync(agent, "Agent@2026!");
                if (res.Succeeded)
                {
                    await userManager.AddToRoleAsync(agent, "Agent");
                }
            }

            var empEmail = "omar.farooq@system.local";
            if (await userManager.FindByEmailAsync(empEmail) == null)
            {
                var emp = new ApplicationUser
                {
                    UserName = empEmail,
                    Email = empEmail,
                    EmailConfirmed = true,
                    FullName = "Omar Al-Farooq",
                    Department = "Human Resources & Talent",
                    JobTitle = "Talent Acquisition Specialist",
                    AvatarColor = "bg-blue-600",
                    TwoFactorEnabled = true,
                    TwoFactorSecret = "KZXW6YTBOI======",
                    MustChangePassword = false
                };
                var res = await userManager.CreateAsync(emp, "User@2026!");
                if (res.Succeeded)
                {
                    await userManager.AddToRoleAsync(emp, "Employee");
                }
            }

            // 4. Seed Tickets
            if (!context.Tickets.Any())
            {
                var ticket1 = new Ticket
                {
                    Title = "Core Fiber Switch Fault in Data Center Sector 4",
                    Description = "Redundant power supply failure detected on Cisco Nexus 9300 core distribution switch. Immediate failover verified.",
                    Priority = TicketPriority.Urgent,
                    Status = TicketStatus.InProgress,
                    Category = TicketCategory.HardwareFailure,
                    Department = "Infrastructure",
                    RequesterName = "Zaid Al-Husseini",
                    RequesterEmail = "zaid.h@system.local",
                    AssignedToUserId = adminUser?.Id,
                    SlaHours = 4,
                    SlaDeadline = DateTime.UtcNow.AddHours(3)
                };

                var ticket2 = new Ticket
                {
                    Title = "ERP Oracle Database Replication Latency Alert",
                    Description = "Data replication delay between Primary DC and Disaster Recovery site exceeded 120 seconds threshold.",
                    Priority = TicketPriority.High,
                    Status = TicketStatus.Open,
                    Category = TicketCategory.SoftwareBug,
                    Department = "Database Systems",
                    RequesterName = "Noura Al-Sabah",
                    RequesterEmail = "noura.s@system.local",
                    SlaHours = 8,
                    SlaDeadline = DateTime.UtcNow.AddHours(7)
                };

                var ticket3 = new Ticket
                {
                    Title = "VPN Certificate Renewal & MFA Provisioning",
                    Description = "Requesting renewal of IPSec client SSL certificate for remote engineering division.",
                    Priority = TicketPriority.Medium,
                    Status = TicketStatus.Resolved,
                    Category = TicketCategory.AccessRequest,
                    Department = "Information Security",
                    RequesterName = "Tariq Aziz",
                    RequesterEmail = "tariq.a@system.local",
                    SlaHours = 24,
                    SlaDeadline = DateTime.UtcNow.AddHours(-2),
                    ResolvedAt = DateTime.UtcNow.AddHours(-1)
                };

                context.Tickets.AddRange(ticket1, ticket2, ticket3);
                await context.SaveChangesAsync();
            }

            // 5. Seed Archival Documents
            if (!context.ArchivalDocuments.Any())
            {
                var doc1 = new ArchivalDocument
                {
                    Title = "Executive Decree No. 408/2026 - Digital Transformation Strategy",
                    DocumentNumber = "DEC-2026-0408",
                    Category = DocumentCategory.ExecutiveDecrees,
                    Confidentiality = DocumentConfidentiality.Restricted,
                    PhysicalLocation = "Central Vault Alpha, Safe-04, Drawer 12",
                    BarcodeNumber = "DOC-BAR-88291039",
                    Summary = "Authorizing cloud migration and modern identity framework deployment across all regional offices.",
                    Tags = "Executive, Transformation, Strategy, 2026",
                    RetentionYears = 15,
                    FileSizeBytes = 4520000,
                    FileType = "PDF/A-2b",
                    IsDigitallySigned = true,
                    DigitalFingerprintSha256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                };

                var doc2 = new ArchivalDocument
                {
                    Title = "Annual Financial Audit & Compliance Statement 2025",
                    DocumentNumber = "FIN-2025-AUDIT",
                    Category = DocumentCategory.FinancialStatements,
                    Confidentiality = DocumentConfidentiality.Internal,
                    PhysicalLocation = "Vault B, Sector 2, Box 99",
                    BarcodeNumber = "DOC-BAR-44910281",
                    Summary = "Certified financial statement signed by certified external auditing consortium.",
                    Tags = "Finance, Audit, Compliance, Annual",
                    RetentionYears = 10,
                    FileSizeBytes = 12400000,
                    FileType = "PDF/A-1a",
                    IsDigitallySigned = true,
                    DigitalFingerprintSha256 = "c5d79679f29103bd868b36879e953835626992d9d1469e5d4a4ae9ff29d2983b"
                };

                context.ArchivalDocuments.AddRange(doc1, doc2);
                await context.SaveChangesAsync();
            }

            // 6. Seed Employees (HR Directory)
            if (!context.Employees.Any())
            {
                var emp1 = new Employee
                {
                    FullName = "Eng. Mustafa Al-Ahmad",
                    NationalId = "1098234891",
                    JobTitle = "Principal Cloud Architect",
                    Department = "Cloud Infrastructure",
                    Email = "mustafa.a@system.local",
                    Phone = "+966 50 123 4567",
                    HireDate = new DateTime(2021, 3, 15),
                    Salary = 85000m,
                    LeaveBalanceDays = 28,
                    PerformanceRating = 4.9,
                    Skills = "Azure, AWS, Kubernetes, Terraform, C#",
                    EmployeeBadgeId = "EMP-0001"
                };

                var emp2 = new Employee
                {
                    FullName = "Layla Al-Khatib",
                    NationalId = "1087263541",
                    JobTitle = "Senior Database Administrator",
                    Department = "Data Engineering",
                    Email = "layla.k@system.local",
                    Phone = "+966 55 987 6543",
                    HireDate = new DateTime(2022, 7, 1),
                    Salary = 72000m,
                    LeaveBalanceDays = 22,
                    PerformanceRating = 4.8,
                    Skills = "SQL Server, PostgreSQL, Redis, Performance Tuning",
                    EmployeeBadgeId = "EMP-0002"
                };

                context.Employees.AddRange(emp1, emp2);
                await context.SaveChangesAsync();
            }
        }
    }
}
