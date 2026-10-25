using System.Text;
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
    .WriteTo.File("Logs/enterprise_audit-.txt", rollingInterval: RollingInterval.Day,
        outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {Message:lj} {Properties:j}{NewLine}{Exception}")
    .CreateBootstrapLogger();

try
{
    Log.Information("Starting Enterprise Portal ASP.NET Core Application...");

    var builder = WebApplication.CreateBuilder(args);

    // 2. Configure Host to use full Serilog pipeline
    builder.Host.UseSerilog((context, services, configuration) => configuration
        .ReadFrom.Configuration(context.Configuration)
        .ReadFrom.Services(services)
        .Enrich.FromLogContext()
        .WriteTo.Console()
        .WriteTo.File("Logs/enterprise_audit-.txt", rollingInterval: RollingInterval.Day));

    // 3. Database Provider (Sqlite by default for instant out-of-the-box run, easily switchable to SqlServer)
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

    // 4. Configure ASP.NET Core Identity & Security Policies
    var secConfig = builder.Configuration.GetSection("SecurityPolicy");
    builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
    {
        // Password Complexity Policy
        options.Password.RequireDigit = secConfig.GetValue<bool>("Password:RequireDigit", true);
        options.Password.RequireLowercase = secConfig.GetValue<bool>("Password:RequireLowercase", true);
        options.Password.RequireNonAlphanumeric = secConfig.GetValue<bool>("Password:RequireNonAlphanumeric", true);
        options.Password.RequireUppercase = secConfig.GetValue<bool>("Password:RequireUppercase", true);
        options.Password.RequiredLength = secConfig.GetValue<int>("Password:RequiredLength", 8);

        // Account Lockout Policy (5 failed attempts = 15 min lock)
        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(secConfig.GetValue<int>("Lockout:DefaultLockoutTimeSpanMinutes", 15));
        options.Lockout.MaxFailedAccessAttempts = secConfig.GetValue<int>("Lockout:MaxFailedAccessAttempts", 5);
        options.Lockout.AllowedForNewUsers = true;

        // User Requirements
        options.User.RequireUniqueEmail = true;
        options.SignIn.RequireConfirmedAccount = false;
    })
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddDefaultTokenProviders();

    // Cookie configuration
    builder.Services.ConfigureApplicationCookie(options =>
    {
        options.Cookie.HttpOnly = true;
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
        options.LoginPath = "/Account/Login";
        options.AccessDeniedPath = "/Account/AccessDenied";
        options.SlidingExpiration = true;
    });

    // 5. Register Custom Application Services
    builder.Services.AddScoped<ITotpService, TotpService>();
    builder.Services.AddScoped<IQrCodeService, QrCodeService>();

    // 6. Add MVC & Razor Views
    builder.Services.AddControllersWithViews();
    builder.Services.AddHttpContextAccessor();

    var app = builder.Build();

    // 7. Seed Database and Initial Administrative Accounts
    using (var scope = app.Services.CreateScope())
    {
        var services = scope.ServiceProvider;
        try
        {
            var context = services.GetRequiredService<ApplicationDbContext>();
            var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();
            var roleManager = services.GetRequiredService<RoleManager<IdentityRole>>();
            
            // Ensures DB is created (or migrations applied)
            await context.Database.EnsureCreatedAsync();
            
            // Seed roles, default admin (2FA disabled by default), demo users, tickets, archives, employees
            await DbInitializer.InitializeAsync(context, userManager, roleManager);
            
            Log.Information("Database and Seed Data successfully verified.");
        }
        catch (Exception ex)
        {
            Log.Fatal(ex, "An error occurred while seeding the database.");
        }
    }

    // 8. Configure HTTP Request Pipeline
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
}
