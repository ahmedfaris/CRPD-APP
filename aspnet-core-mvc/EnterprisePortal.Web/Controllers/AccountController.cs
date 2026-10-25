using System;
using System.Threading.Tasks;
using EnterprisePortal.Web.Models;
using EnterprisePortal.Web.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
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
        [AllowAnonymous]
        public IActionResult Login(string? returnUrl = null)
        {
            if (User.Identity?.IsAuthenticated == true)
            {
                return RedirectToAction("Index", "Metro");
            }

            ViewData["ReturnUrl"] = returnUrl;
            return View(new LoginViewModel { ReturnUrl = returnUrl });
        }

        [HttpPost]
        [AllowAnonymous]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Login(LoginViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return View(model);
            }

            // Find user by Email or Username
            var user = await _userManager.FindByEmailAsync(model.EmailOrUsername)
                       ?? await _userManager.FindByNameAsync(model.EmailOrUsername);

            if (user == null)
            {
                Log.Warning("FailedLogin: User {Username} does not exist", model.EmailOrUsername);
                ModelState.AddModelError(string.Empty, "Invalid login credentials provided.");
                return View(model);
            }

            // Check if locked out
            if (await _userManager.IsLockedOutAsync(user))
            {
                Log.Warning("SecurityPolicy: User {UserEmail} attempted login while locked out.", user.Email);
                ModelState.AddModelError(string.Empty, "This account is currently locked out due to multiple failed attempts. Contact an administrator.");
                return View(model);
            }

            // Verify password
            var passwordCheck = await _userManager.CheckPasswordAsync(user, model.Password);
            if (!passwordCheck)
            {
                await _userManager.AccessFailedAsync(user);
                int attemptsLeft = 5 - await _userManager.GetAccessFailedCountAsync(user);
                Log.Warning("FailedLogin: Invalid password for {UserEmail}. Attempts remaining: {AttemptsLeft}", user.Email, Math.Max(0, attemptsLeft));
                
                if (await _userManager.IsLockedOutAsync(user))
                {
                    Log.Error("AccountLockout: User {UserEmail} reached max failed attempts and is now locked out.", user.Email);
                    ModelState.AddModelError(string.Empty, "Account locked due to 5 consecutive failed attempts.");
                }
                else
                {
                    ModelState.AddModelError(string.Empty, $"Invalid password. {attemptsLeft} attempts remaining before lockout.");
                }
                return View(model);
            }

            // Reset failed count on successful password
            await _userManager.ResetAccessFailedCountAsync(user);

            // Determine if 2FA is required
            bool global2FA = _configuration.GetValue<bool>("SecurityPolicy:Global2FAEnforced", false);
            bool requires2FA = global2FA || user.TwoFactorEnabled;

            // SPECIAL POLICY: Default Admin (admin@system.local) without 2FA logs in directly!
            if (!requires2FA)
            {
                await _signInManager.SignInAsync(user, model.RememberMe);
                user.LastLoginTime = DateTime.UtcNow;
                await _userManager.UpdateAsync(user);

                Log.Information("SecurityPolicy: DirectLogin (No 2FA Required) succeeded for {UserEmail} ({Role})", user.Email, user.JobTitle);

                if (user.MustChangePassword)
                {
                    return RedirectToAction("ChangePassword");
                }

                return LocalRedirect(model.ReturnUrl ?? Url.Action("Index", "Metro")!);
            }

            // Requires 2FA: Redirect to TOTP verification step
            Log.Information("SecurityPolicy: Password validated for {UserEmail}. Initiating TOTP 2FA challenge.", user.Email);

            bool isFirstTime = string.IsNullOrEmpty(user.TwoFactorSecret);
            string secret = user.TwoFactorSecret ?? _totpService.GenerateSecretKey();

            if (isFirstTime)
            {
                user.TwoFactorSecret = secret;
                await _userManager.UpdateAsync(user);
                Log.Information("SecurityPolicy: Generated new TOTP registration secret for first-time setup for {UserEmail}.", user.Email);
            }

            string uri = _totpService.GenerateOtpAuthUri(user.Email!, secret, "EnterprisePortal");
            string qrBase64 = _qrCodeService.GeneratePngBase64(uri);

            var verifyModel = new Verify2FAViewModel
            {
                UserId = user.Id,
                RememberMe = model.RememberMe,
                ReturnUrl = model.ReturnUrl,
                IsFirstTimeSetup = isFirstTime,
                SecretKey = secret,
                AuthenticatorUri = uri,
                QrCodeBase64 = qrBase64
            };

            return View("Verify2FA", verifyModel);
        }

        [HttpPost]
        [AllowAnonymous]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Verify2FA(Verify2FAViewModel model)
        {
            var user = await _userManager.FindByIdAsync(model.UserId);
            if (user == null)
            {
                return RedirectToAction("Login");
            }

            int toleranceSeconds = _configuration.GetValue<int>("SecurityPolicy:ServerToleranceSeconds", 60);
            string secret = user.TwoFactorSecret ?? string.Empty;

            bool isValid = _totpService.VerifyCode(secret, model.Code, toleranceSeconds);

            if (!isValid)
            {
                Log.Warning("SecurityPolicy: Invalid 2FA TOTP code {Code} entered for {UserEmail}. Tolerance: ±{ToleranceSec}s", 
                    model.Code, user.Email, toleranceSeconds);
                
                ModelState.AddModelError(nameof(model.Code), $"Invalid 6-digit TOTP code. Ensure your device time is synchronized (±{toleranceSeconds}s tolerance).");

                // Re-hydrate QR if needed
                string uri = _totpService.GenerateOtpAuthUri(user.Email!, secret, "EnterprisePortal");
                model.QrCodeBase64 = _qrCodeService.GeneratePngBase64(uri);
                model.SecretKey = secret;
                model.AuthenticatorUri = uri;

                return View(model);
            }

            // Valid code! Sign in
            user.TwoFactorEnabled = true;
            user.LastLoginTime = DateTime.UtcNow;
            await _userManager.UpdateAsync(user);

            await _signInManager.SignInAsync(user, model.RememberMe);

            Log.Information("SecurityPolicy: TwoFactor TOTP validation succeeded for {UserEmail}. Tolerance: ±{Tolerance}s.", 
                user.Email, toleranceSeconds);

            if (user.MustChangePassword)
            {
                return RedirectToAction("ChangePassword");
            }

            return LocalRedirect(model.ReturnUrl ?? Url.Action("Index", "Metro")!);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Logout()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user != null)
            {
                Log.Information("SessionTerminated: User {UserEmail} logged out.", user.Email);
            }
            await _signInManager.SignOutAsync();
            return RedirectToAction("Login");
        }

        [HttpGet]
        [Authorize]
        public IActionResult ChangePassword()
        {
            return View(new ChangePasswordViewModel());
        }

        [HttpPost]
        [Authorize]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ChangePassword(ChangePasswordViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return View(model);
            }

            var user = await _userManager.GetUserAsync(User);
            if (user == null)
            {
                return RedirectToAction("Login");
            }

            var changeResult = await _userManager.ChangePasswordAsync(user, model.CurrentPassword, model.NewPassword);
            if (!changeResult.Succeeded)
            {
                foreach (var err in changeResult.Errors)
                {
                    ModelState.AddModelError(string.Empty, err.Description);
                }
                return View(model);
            }

            user.MustChangePassword = false;
            await _userManager.UpdateAsync(user);

            Log.Information("SecurityPolicy: Password successfully updated by user {UserEmail}.", user.Email);
            TempData["SuccessMessage"] = "Password successfully changed.";

            return RedirectToAction("Index", "Metro");
        }

        [HttpGet]
        public IActionResult AccessDenied()
        {
            return View();
        }
    }
}
