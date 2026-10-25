export interface AspNetProjectFile {
  path: string;
  name: string;
  category: 'solution' | 'project' | 'controller' | 'model' | 'service' | 'data' | 'view' | 'config' | 'doc';
  content: string;
}

export const ASPNET_PROJECT_FILES: AspNetProjectFile[] = [
  {
    path: 'EnterprisePortal.sln',
    name: 'EnterprisePortal.sln',
    category: 'solution',
    content: `Microsoft Visual Studio Solution File, Format Version 12.00
# Visual Studio Version 17
VisualStudioVersion = 17.8.34330.188
MinimumVisualStudioVersion = 10.0.40219.1
Project("{9A19103F-16F7-4668-BE54-9A1E7A4F7556}") = "EnterprisePortal.Web", "EnterprisePortal.Web\\EnterprisePortal.Web.csproj", "{B8D56A1F-2391-499B-A089-98A6F4CE45B1}"
EndProject
Global
	GlobalSection(SolutionConfigurationPlatforms) = preSolution
		Debug|Any CPU = Debug|Any CPU
		Release|Any CPU = Release|Any CPU
	EndGlobalSection
	GlobalSection(ProjectConfigurationPlatforms) = postSolution
		{B8D56A1F-2391-499B-A089-98A6F4CE45B1}.Debug|Any CPU.ActiveCfg = Debug|Any CPU
		{B8D56A1F-2391-499B-A089-98A6F4CE45B1}.Debug|Any CPU.Build.0 = Debug|Any CPU
		{B8D56A1F-2391-499B-A089-98A6F4CE45B1}.Release|Any CPU.ActiveCfg = Release|Any CPU
		{B8D56A1F-2391-499B-A089-98A6F4CE45B1}.Release|Any CPU.Build.0 = Release|Any CPU
	EndGlobalSection
	GlobalSection(SolutionProperties) = preSolution
		HideSolutionNode = FALSE
	EndGlobalSection
	GlobalSection(ExtensibilityGlobals) = postSolution
		SolutionGuid = {23BC9801-4475-4C3D-88F9-2A21F53DE0E1}
	EndGlobalSection
EndGlobal`
  },
  {
    path: 'EnterprisePortal.Web/EnterprisePortal.Web.csproj',
    name: 'EnterprisePortal.Web.csproj',
    category: 'project',
    content: `<Project Sdk="Microsoft.NET.Sdk.Web">

  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <UserSecretsId>enterprise-portal-identity-totp</UserSecretsId>
    <RootNamespace>EnterprisePortal.Web</RootNamespace>
    <AssemblyName>EnterprisePortal.Web</AssemblyName>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.Identity.EntityFrameworkCore" Version="8.0.8" />
    <PackageReference Include="Microsoft.AspNetCore.Identity.UI" Version="8.0.8" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" Version="8.0.8" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.Sqlite" Version="8.0.8" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.Tools" Version="8.0.8">
      <PrivateAssets>all</PrivateAssets>
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
    </PackageReference>
    <PackageReference Include="QRCoder" Version="1.6.0" />
    <PackageReference Include="Serilog.AspNetCore" Version="8.0.2" />
    <PackageReference Include="Serilog.Sinks.Console" Version="6.0.0" />
    <PackageReference Include="Serilog.Sinks.File" Version="6.0.0" />
    <PackageReference Include="Otp.NET" Version="1.4.0" />
  </ItemGroup>

  <ItemGroup>
    <Folder Include="Logs\\" />
    <Folder Include="wwwroot\\uploads\\" />
  </ItemGroup>

</Project>`
  },
  {
    path: 'EnterprisePortal.Web/appsettings.json',
    name: 'appsettings.json',
    category: 'config',
    content: `{
  "ConnectionStrings": {
    "DefaultConnection": "Data Source=enterprise_portal.db;Cache=Shared",
    "SqlServerConnection": "Server=(localdb)\\\\mssqllocaldb;Database=EnterprisePortalDb;Trusted_Connection=True;MultipleActiveResultSets=true"
  },
  "DatabaseProvider": "Sqlite",
  "Serilog": {
    "MinimumLevel": {
      "Default": "Information",
      "Override": {
        "Microsoft": "Warning",
        "Microsoft.Hosting.Lifetime": "Information",
        "Microsoft.EntityFrameworkCore": "Warning"
      }
    }
  },
  "SecurityPolicy": {
    "Global2FAEnforced": false,
    "ServerToleranceSeconds": 60,
    "Lockout": {
      "MaxFailedAccessAttempts": 5,
      "DefaultLockoutTimeSpanMinutes": 15
    },
    "Password": {
      "RequireDigit": true,
      "RequireLowercase": true,
      "RequireNonAlphanumeric": true,
      "RequireUppercase": true,
      "RequiredLength": 8
    }
  },
  "AllowedHosts": "*"
}`
  },
  {
    path: 'EnterprisePortal.Web/Program.cs',
    name: 'Program.cs',
    category: 'project',
    content: `using System.Text;
using EnterprisePortal.Web.Data;
using EnterprisePortal.Web.Models;
using EnterprisePortal.Web.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Serilog;
using Serilog.Events;

// 1. Initialize Serilog bootstrap logger
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj} {Properties:j}{NewLine}{Exception}")
    .WriteTo.File("Logs/enterprise_audit-.txt", rollingInterval: RollingInterval.Day)
    .CreateBootstrapLogger();

try
{
    Log.Information("Starting Enterprise Portal ASP.NET Core Application...");
    var builder = WebApplication.CreateBuilder(args);

    // 2. Configure Host with Serilog
    builder.Host.UseSerilog((context, services, configuration) => configuration
        .ReadFrom.Configuration(context.Configuration)
        .ReadFrom.Services(services)
        .Enrich.FromLogContext()
        .WriteTo.Console()
        .WriteTo.File("Logs/enterprise_audit-.txt", rollingInterval: RollingInterval.Day));

    // 3. Database Provider (Sqlite default, SqlServer ready)
    var dbProvider = builder.Configuration["DatabaseProvider"] ?? "Sqlite";
    builder.Services.AddDbContext<ApplicationDbContext>(options =>
    {
        if (dbProvider.Equals("SqlServer", StringComparison.OrdinalIgnoreCase))
        {
            options.UseSqlServer(builder.Configuration.GetConnectionString("SqlServerConnection"));
        }
        else
        {
            options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection"));
        }
    });

    // 4. ASP.NET Core Identity & Security Policies
    var secConfig = builder.Configuration.GetSection("SecurityPolicy");
    builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
    {
        options.Password.RequireDigit = secConfig.GetValue<bool>("Password:RequireDigit", true);
        options.Password.RequireLowercase = secConfig.GetValue<bool>("Password:RequireLowercase", true);
        options.Password.RequireNonAlphanumeric = secConfig.GetValue<bool>("Password:RequireNonAlphanumeric", true);
        options.Password.RequireUppercase = secConfig.GetValue<bool>("Password:RequireUppercase", true);
        options.Password.RequiredLength = secConfig.GetValue<int>("Password:RequiredLength", 8);

        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(secConfig.GetValue<int>("Lockout:DefaultLockoutTimeSpanMinutes", 15));
        options.Lockout.MaxFailedAccessAttempts = secConfig.GetValue<int>("Lockout:MaxFailedAccessAttempts", 5);
        options.Lockout.AllowedForNewUsers = true;
    })
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddDefaultTokenProviders();

    builder.Services.ConfigureApplicationCookie(options =>
    {
        options.Cookie.HttpOnly = true;
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
        options.LoginPath = "/Account/Login";
        options.SlidingExpiration = true;
    });

    // 5. Register Services
    builder.Services.AddScoped<ITotpService, TotpService>();
    builder.Services.AddScoped<IQrCodeService, QrCodeService>();

    builder.Services.AddControllersWithViews();

    var app = builder.Build();

    // 6. Seed Initial Data
    using (var scope = app.Services.CreateScope())
    {
        var services = scope.ServiceProvider;
        var context = services.GetRequiredService<ApplicationDbContext>();
        var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();
        var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();
        
        await context.Database.EnsureCreatedAsync();
        await DbInitializer.InitializeAsync(context, userManager, roleManager);
    }

    if (!app.Environment.IsDevelopment())
    {
        app.UseExceptionHandler("/Home/Error");
        app.UseHsts();
    }

    app.UseHttpsRedirection();
    app.UseStaticFiles();
    app.UseSerilogRequestLogging();
    app.UseRouting();
    app.UseAuthentication();
    app.UseAuthorization();

    app.MapControllerRoute(
        name: "default",
        pattern: "{controller=Metro}/{action=Index}/{id?}");

    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}`
  },
  {
    path: 'EnterprisePortal.Web/Models/ApplicationUser.cs',
    name: 'ApplicationUser.cs',
    category: 'model',
    content: `using System;
using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Identity;

namespace EnterprisePortal.Web.Models
{
    public class ApplicationUser : IdentityUser
    {
        [Required]
        [MaxLength(100)]
        public string FullName { get; set; } = string.Empty;

        [MaxLength(100)]
        public string Department { get; set; } = "Information Technology";

        [MaxLength(100)]
        public string JobTitle { get; set; } = "System Operator";

        [MaxLength(30)]
        public string AvatarColor { get; set; } = "bg-blue-600";

        [MaxLength(64)]
        public string? TwoFactorSecret { get; set; }

        public bool MustChangePassword { get; set; } = false;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? LastLoginTime { get; set; }
    }
}`
  },
  {
    path: 'EnterprisePortal.Web/Models/Ticket.cs',
    name: 'Ticket.cs',
    category: 'model',
    content: `using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace EnterprisePortal.Web.Models
{
    public enum TicketPriority { Low, Medium, High, Urgent, Critical }
    public enum TicketStatus { Open, InProgress, PendingUser, Resolved, Closed }
    public enum TicketCategory { TechnicalSupport, NetworkInfrastructure, HardwareFailure, SoftwareBug, AccessRequest, SecurityIncident, BillingInquiry }

    public class Ticket
    {
        [Key]
        public string Id { get; set; } = Guid.NewGuid().ToString("N");

        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [Required]
        public string Description { get; set; } = string.Empty;

        public TicketPriority Priority { get; set; } = TicketPriority.Medium;
        public TicketStatus Status { get; set; } = TicketStatus.Open;
        public TicketCategory Category { get; set; } = TicketCategory.TechnicalSupport;

        [MaxLength(100)]
        public string Department { get; set; } = "IT Support";

        [Required]
        [MaxLength(100)]
        public string RequesterName { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        [MaxLength(150)]
        public string RequesterEmail { get; set; } = string.Empty;

        public string? AssignedToUserId { get; set; }

        [ForeignKey("AssignedToUserId")]
        public virtual ApplicationUser? AssignedToUser { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
        public DateTime? ResolvedAt { get; set; }

        public int SlaHours { get; set; } = 24;
        public DateTime SlaDeadline { get; set; }

        public bool SlaBreached => Status != TicketStatus.Resolved && Status != TicketStatus.Closed && DateTime.UtcNow > SlaDeadline;

        public virtual ICollection<TicketComment> Comments { get; set; } = new List<TicketComment>();
        public virtual ICollection<TicketAuditLog> AuditLogs { get; set; } = new List<TicketAuditLog>();
    }

    public class TicketComment
    {
        [Key]
        public string Id { get; set; } = Guid.NewGuid().ToString("N");
        public string TicketId { get; set; } = string.Empty;
        public string AuthorUserId { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public bool IsInternalNote { get; set; } = false;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class TicketAuditLog
    {
        [Key]
        public string Id { get; set; } = Guid.NewGuid().ToString("N");
        public string TicketId { get; set; } = string.Empty;
        public string ActorEmail { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty;
        public string? OldValue { get; set; }
        public string? NewValue { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }
}`
  },
  {
    path: 'EnterprisePortal.Web/Models/ArchivalDocument.cs',
    name: 'ArchivalDocument.cs',
    category: 'model',
    content: `using System;
using System.ComponentModel.DataAnnotations;

namespace EnterprisePortal.Web.Models
{
    public enum DocumentConfidentiality { Public, Internal, Restricted, TopSecret }
    public enum DocumentCategory { AdministrativeDecisions, ExecutiveDecrees, ProcurementContracts, FinancialStatements, LegalAgreements, PersonnelFiles, AuditReports, TechnicalSpecs }

    public class ArchivalDocument
    {
        [Key]
        public string Id { get; set; } = Guid.NewGuid().ToString("N");

        [Required]
        [MaxLength(250)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string DocumentNumber { get; set; } = string.Empty;

        public DocumentCategory Category { get; set; } = DocumentCategory.AdministrativeDecisions;
        public DocumentConfidentiality Confidentiality { get; set; } = DocumentConfidentiality.Internal;

        [MaxLength(150)]
        public string PhysicalLocation { get; set; } = "Vault A - Sector 3 - Shelf 12";

        [Required]
        [MaxLength(64)]
        public string BarcodeNumber { get; set; } = string.Empty;

        public string? Summary { get; set; }
        public string Tags { get; set; } = string.Empty;

        public DateTime ArchivedDate { get; set; } = DateTime.UtcNow;
        public DateTime? ExpiryDate { get; set; }
        public int RetentionYears { get; set; } = 10;
        public long FileSizeBytes { get; set; } = 1024 * 1024 * 2;
        public string FileType { get; set; } = "PDF/A-1b";

        public string CreatedByUserId { get; set; } = string.Empty;
        public bool IsDigitallySigned { get; set; } = true;
        public string DigitalFingerprintSha256 { get; set; } = string.Empty;
    }
}`
  },
  {
    path: 'EnterprisePortal.Web/Models/Employee.cs',
    name: 'Employee.cs',
    category: 'model',
    content: `using System;
using System.ComponentModel.DataAnnotations;

namespace EnterprisePortal.Web.Models
{
    public enum EmployeeStatus { Active, OnLeave, Probation, Transferred, Resigned }

    public class Employee
    {
        [Key]
        public string Id { get; set; } = Guid.NewGuid().ToString("N");

        [Required]
        [MaxLength(100)]
        public string FullName { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string NationalId { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string JobTitle { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string Department { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        [MaxLength(150)]
        public string Email { get; set; } = string.Empty;

        [Phone]
        [MaxLength(30)]
        public string Phone { get; set; } = string.Empty;

        public DateTime HireDate { get; set; } = DateTime.UtcNow.AddYears(-2);
        public EmployeeStatus Status { get; set; } = EmployeeStatus.Active;
        public decimal Salary { get; set; } = 45000m;
        public int LeaveBalanceDays { get; set; } = 25;
        public double PerformanceRating { get; set; } = 4.8;
        public string Skills { get; set; } = "C#, ASP.NET Core, SQL Server, Docker, ITIL";
        public string EmployeeBadgeId { get; set; } = "EMP-0010";
    }
}`
  },
  {
    path: 'EnterprisePortal.Web/Services/TotpService.cs',
    name: 'TotpService.cs',
    category: 'service',
    content: `using System;
using System.Security.Cryptography;
using System.Text;

namespace EnterprisePortal.Web.Services
{
    public interface ITotpService
    {
        string GenerateSecretKey();
        string GenerateOtpAuthUri(string email, string secretKey, string issuer = "EnterprisePortal");
        bool VerifyCode(string secretKey, string code, int toleranceSeconds = 60);
        string GetCurrentCode(string secretKey);
    }

    public class TotpService : ITotpService
    {
        private const int StepSeconds = 30;
        private const int Digits = 6;
        private static readonly string Base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

        public string GenerateSecretKey()
        {
            byte[] bytes = new byte[20];
            using var rng = RandomNumberGenerator.Create();
            rng.GetBytes(bytes);
            return ToBase32(bytes);
        }

        public string GenerateOtpAuthUri(string email, string secretKey, string issuer = "EnterprisePortal")
        {
            return $"otpauth://totp/{Uri.EscapeDataString(issuer)}:{Uri.EscapeDataString(email)}?secret={secretKey}&issuer={Uri.EscapeDataString(issuer)}&digits=6&period=30";
        }

        public bool VerifyCode(string secretKey, string code, int toleranceSeconds = 60)
        {
            if (string.IsNullOrWhiteSpace(secretKey) || string.IsNullOrWhiteSpace(code) || code.Length != Digits)
                return false;

            try
            {
                byte[] key = FromBase32(secretKey);
                long currentStep = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / StepSeconds;
                int stepTolerance = Math.Max(1, toleranceSeconds / StepSeconds);

                for (int i = -stepTolerance; i <= stepTolerance; i++)
                {
                    if (ComputeTotp(key, currentStep + i).Equals(code.Trim(), StringComparison.Ordinal))
                        return true;
                }
            }
            catch { return false; }
            return false;
        }

        public string GetCurrentCode(string secretKey)
        {
            byte[] key = FromBase32(secretKey);
            long step = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / StepSeconds;
            return ComputeTotp(key, step);
        }

        private static string ComputeTotp(byte[] key, long step)
        {
            byte[] stepBytes = BitConverter.GetBytes(step);
            if (BitConverter.IsLittleEndian) Array.Reverse(stepBytes);

            using var hmac = new HMACSHA1(key);
            byte[] hash = hmac.ComputeHash(stepBytes);

            int offset = hash[^1] & 0x0F;
            int binaryCode = ((hash[offset] & 0x7F) << 24)
                           | ((hash[offset + 1] & 0xFF) << 16)
                           | ((hash[offset + 2] & 0xFF) << 8)
                           | (hash[offset + 3] & 0xFF);

            int otp = binaryCode % (int)Math.Pow(10, Digits);
            return otp.ToString(new string('0', Digits));
        }

        private static string ToBase32(byte[] data)
        {
            var sb = new StringBuilder();
            byte curByte = 0, nextByte = 0;
            int bitsLeft = 8, curIndex = 0;

            while (curIndex < data.Length)
            {
                curByte = data[curIndex++];
                while (bitsLeft > 0)
                {
                    if (bitsLeft >= 5)
                    {
                        sb.Append(Base32Alphabet[(curByte >> (bitsLeft - 5)) & 0x1F]);
                        bitsLeft -= 5;
                    }
                    else
                    {
                        int val = (curByte & ((1 << bitsLeft) - 1)) << (5 - bitsLeft);
                        if (curIndex < data.Length)
                        {
                            nextByte = data[curIndex++];
                            val |= (nextByte >> (8 - (5 - bitsLeft))) & 0x1F;
                            curByte = nextByte;
                            bitsLeft = 8 - (5 - bitsLeft);
                        }
                        else bitsLeft = 0;
                        sb.Append(Base32Alphabet[val]);
                    }
                }
                bitsLeft = 8;
            }
            return sb.ToString();
        }

        private static byte[] FromBase32(string base32)
        {
            string clean = base32.Trim().TrimEnd('=').ToUpperInvariant();
            byte[] bytes = new byte[clean.Length * 5 / 8];
            int bitBuffer = 0, bitsInBuffer = 0, byteIndex = 0;

            foreach (char c in clean)
            {
                int val = Base32Alphabet.IndexOf(c);
                if (val < 0) continue;
                bitBuffer = (bitBuffer << 5) | val;
                bitsInBuffer += 5;
                if (bitsInBuffer >= 8)
                {
                    bytes[byteIndex++] = (byte)((bitBuffer >> (bitsInBuffer - 8)) & 0xFF);
                    bitsInBuffer -= 8;
                }
            }
            return bytes;
        }
    }
}`
  },
  {
    path: 'EnterprisePortal.Web/Controllers/AccountController.cs',
    name: 'AccountController.cs',
    category: 'controller',
    content: `using System;
using System.Threading.Tasks;
using EnterprisePortal.Web.Models;
using EnterprisePortal.Web.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Serilog;

namespace EnterprisePortal.Web.Controllers
{
    public class AccountController : Controller
    {
        private readonly SignInManager<ApplicationUser> _signInManager;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly ITotpService _totpService;
        private readonly IQrCodeService _qrCodeService;
        private readonly IConfiguration _configuration;

        public AccountController(
            SignInManager<ApplicationUser> signInManager,
            UserManager<ApplicationUser> userManager,
            ITotpService totpService,
            IQrCodeService qrCodeService,
            IConfiguration configuration)
        {
            _signInManager = signInManager;
            _userManager = userManager;
            _totpService = totpService;
            _qrCodeService = qrCodeService;
            _configuration = configuration;
        }

        [HttpGet]
        public IActionResult Login(string? returnUrl = null) => View(new LoginViewModel { ReturnUrl = returnUrl });

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Login(LoginViewModel model)
        {
            if (!ModelState.IsValid) return View(model);

            var user = await _userManager.FindByEmailAsync(model.EmailOrUsername)
                       ?? await _userManager.FindByNameAsync(model.EmailOrUsername);

            if (user == null)
            {
                ModelState.AddModelError("", "Invalid credentials");
                return View(model);
            }

            if (await _userManager.IsLockedOutAsync(user))
            {
                ModelState.AddModelError("", "Account is locked out. Contact administrator.");
                return View(model);
            }

            if (!await _userManager.CheckPasswordAsync(user, model.Password))
            {
                await _userManager.AccessFailedAsync(user);
                ModelState.AddModelError("", "Invalid password.");
                return View(model);
            }

            await _userManager.ResetAccessFailedCountAsync(user);

            bool global2FA = _configuration.GetValue<bool>("SecurityPolicy:Global2FAEnforced", false);
            bool requires2FA = global2FA || user.TwoFactorEnabled;

            // Direct login for default admin without 2FA
            if (!requires2FA)
            {
                await _signInManager.SignInAsync(user, model.RememberMe);
                user.LastLoginTime = DateTime.UtcNow;
                await _userManager.UpdateAsync(user);
                Log.Information("Direct login successful for {Email}", user.Email);
                return RedirectToAction("Index", "Metro");
            }

            // TOTP challenge
            bool isFirstTime = string.IsNullOrEmpty(user.TwoFactorSecret);
            string secret = user.TwoFactorSecret ?? _totpService.GenerateSecretKey();
            if (isFirstTime)
            {
                user.TwoFactorSecret = secret;
                await _userManager.UpdateAsync(user);
            }

            string uri = _totpService.GenerateOtpAuthUri(user.Email!, secret);
            return View("Verify2FA", new Verify2FAViewModel
            {
                UserId = user.Id,
                RememberMe = model.RememberMe,
                ReturnUrl = model.ReturnUrl,
                IsFirstTimeSetup = isFirstTime,
                SecretKey = secret,
                QrCodeBase64 = _qrCodeService.GeneratePngBase64(uri)
            });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Verify2FA(Verify2FAViewModel model)
        {
            var user = await _userManager.FindByIdAsync(model.UserId);
            if (user == null) return RedirectToAction("Login");

            int tolerance = _configuration.GetValue<int>("SecurityPolicy:ServerToleranceSeconds", 60);
            if (!_totpService.VerifyCode(user.TwoFactorSecret ?? "", model.Code, tolerance))
            {
                ModelState.AddModelError("Code", $"Invalid TOTP code (±{tolerance}s tolerance).");
                return View(model);
            }

            user.TwoFactorEnabled = true;
            user.LastLoginTime = DateTime.UtcNow;
            await _userManager.UpdateAsync(user);
            await _signInManager.SignInAsync(user, model.RememberMe);

            Log.Information("2FA validation succeeded for {Email}", user.Email);
            return RedirectToAction("Index", "Metro");
        }

        [HttpPost]
        public async Task<IActionResult> Logout()
        {
            await _signInManager.SignOutAsync();
            return RedirectToAction("Login");
        }
    }
}`
  },
  {
    path: 'EnterprisePortal.Web/Controllers/UserPolicyController.cs',
    name: 'UserPolicyController.cs',
    category: 'controller',
    content: `using System.Threading.Tasks;
using EnterprisePortal.Web.Models;
using EnterprisePortal.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Serilog;

namespace EnterprisePortal.Web.Controllers
{
    [Authorize(Roles = "Admin")]
    public class UserPolicyController : Controller
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly ITotpService _totpService;

        public UserPolicyController(UserManager<ApplicationUser> userManager, ITotpService totpService)
        {
            _userManager = userManager;
            _totpService = totpService;
        }

        public async Task<IActionResult> Index()
        {
            var users = await _userManager.Users.ToListAsync();
            return View(new UserPolicyViewModel
            {
                Users = users,
                TotalUsersCount = users.Count,
                TwoFactorActiveCount = users.Count(u => u.TwoFactorEnabled),
                TwoFactorDisabledCount = users.Count(u => !u.TwoFactorEnabled)
            });
        }

        [HttpPost]
        public async Task<IActionResult> ToggleUser2FA(string userId)
        {
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return NotFound();

            user.TwoFactorEnabled = !user.TwoFactorEnabled;
            if (user.TwoFactorEnabled && string.IsNullOrEmpty(user.TwoFactorSecret))
            {
                user.TwoFactorSecret = _totpService.GenerateSecretKey();
            }

            await _userManager.UpdateAsync(user);
            Log.Information("Toggled 2FA for {User} to {Status}", user.Email, user.TwoFactorEnabled);
            return RedirectToAction(nameof(Index));
        }

        [HttpPost]
        public async Task<IActionResult> ResetUser2FASecret(string userId)
        {
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return NotFound();

            user.TwoFactorSecret = _totpService.GenerateSecretKey();
            await _userManager.UpdateAsync(user);
            Log.Information("Regenerated 2FA secret for {User}", user.Email);
            return RedirectToAction(nameof(Index));
        }

        [HttpPost]
        public async Task<IActionResult> UnlockUser(string userId)
        {
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return NotFound();

            await _userManager.SetLockoutEndDateAsync(user, null);
            await _userManager.ResetAccessFailedCountAsync(user);
            return RedirectToAction(nameof(Index));
        }
    }
}`
  },
  {
    path: 'README.md',
    name: 'README.md',
    category: 'doc',
    content: `# Enterprise Operations Portal — ASP.NET Core MVC 8.0

Full Visual Studio Solution with Entity Framework Core, ASP.NET Core Identity, RFC 6238 TOTP, and Serilog.

## How to Run:
1. Open \`EnterprisePortal.sln\` in Visual Studio 2022, or run \`dotnet run\` inside \`EnterprisePortal.Web/\`.
2. Seed accounts:
   - Admin (Direct Login, No 2FA): \`admin@system.local\` / \`Admin@2026!\`
   - Agent (2FA Enabled): \`sara.khalid@system.local\` / \`Agent@2026!\`
`
  }
];
