using System;
using System.Linq;
using System.Threading.Tasks;
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
        private readonly IConfiguration _configuration;

        // In-memory or appsettings overrides for runtime policy demonstration
        private static bool? _runtimeGlobal2FA = null;
        private static int? _runtimeToleranceSeconds = null;

        public UserPolicyController(
            UserManager<ApplicationUser> userManager,
            ITotpService totpService,
            IConfiguration configuration)
        {
            _userManager = userManager;
            _totpService = totpService;
            _configuration = configuration;
        }

        [HttpGet]
        public async Task<IActionResult> Index()
        {
            var users = await _userManager.Users.OrderBy(u => u.Email).ToListAsync();

            bool global2FA = _runtimeGlobal2FA ?? _configuration.GetValue<bool>("SecurityPolicy:Global2FAEnforced", false);
            int tolerance = _runtimeToleranceSeconds ?? _configuration.GetValue<int>("SecurityPolicy:ServerToleranceSeconds", 60);

            var vm = new UserPolicyViewModel
            {
                Users = users,
                Global2FAEnforced = global2FA,
                ServerToleranceSeconds = tolerance,
                TotalUsersCount = users.Count,
                TwoFactorActiveCount = users.Count(u => global2FA || u.TwoFactorEnabled),
                TwoFactorDisabledCount = users.Count(u => !global2FA && !u.TwoFactorEnabled),
                LockedUsersCount = users.Count(u => u.LockoutEnd.HasValue && u.LockoutEnd.Value > DateTimeOffset.UtcNow)
            };

            return View(vm);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
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

            Log.Information("SecurityPolicy: Admin {AdminUser} toggled 2FA for {TargetUser} to {State}",
                User.Identity?.Name, user.Email, user.TwoFactorEnabled ? "ENABLED" : "DISABLED");

            TempData["SuccessMessage"] = $"2FA has been {(user.TwoFactorEnabled ? "Enabled" : "Disabled")} for {user.Email}.";
            return RedirectToAction(nameof(Index));
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ResetUser2FASecret(string userId)
        {
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return NotFound();

            user.TwoFactorSecret = _totpService.GenerateSecretKey();
            await _userManager.UpdateAsync(user);

            Log.Information("SecurityPolicy: Admin {AdminUser} regenerated 2FA secret for {TargetUser}. New barcode will be required.",
                User.Identity?.Name, user.Email);

            TempData["SuccessMessage"] = $"2FA Secret regenerated for {user.Email}. The user must re-scan the QR code on their next login.";
            return RedirectToAction(nameof(Index));
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> UnlockUser(string userId)
        {
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return NotFound();

            await _userManager.SetLockoutEndDateAsync(user, null);
            await _userManager.ResetAccessFailedCountAsync(user);

            Log.Information("SecurityPolicy: Admin {AdminUser} cleared lockout state and reset failed counters for {TargetUser}",
                User.Identity?.Name, user.Email);

            TempData["SuccessMessage"] = $"Account {user.Email} has been unlocked.";
            return RedirectToAction(nameof(Index));
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public IActionResult SetTolerance(int seconds)
        {
            _runtimeToleranceSeconds = seconds;
            Log.Information("SecurityPolicy: TOTP server clock drift tolerance updated to ±{Seconds}s by {AdminUser}",
                seconds, User.Identity?.Name);

            TempData["SuccessMessage"] = $"Clock tolerance set to ±{seconds} seconds.";
            return RedirectToAction(nameof(Index));
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public IActionResult ToggleGlobal2FA()
        {
            bool current = _runtimeGlobal2FA ?? _configuration.GetValue<bool>("SecurityPolicy:Global2FAEnforced", false);
            _runtimeGlobal2FA = !current;

            Log.Warning("SecurityPolicy: Global 2FA enforcement set to {State} by {AdminUser}",
                _runtimeGlobal2FA.Value ? "STRICT_ENFORCEMENT" : "SELECTIVE_PER_USER", User.Identity?.Name);

            TempData["SuccessMessage"] = $"Global 2FA enforcement changed to {(_runtimeGlobal2FA.Value ? "STRICT (All users required)" : "SELECTIVE (Per-user toggle)")}.";
            return RedirectToAction(nameof(Index));
        }
    }
}
