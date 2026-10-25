using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace EnterprisePortal.Web.Models
{
    public class LoginViewModel
    {
        [Required(ErrorMessage = "Email or Username is required")]
        public string EmailOrUsername { get; set; } = string.Empty;

        [Required(ErrorMessage = "Password is required")]
        [DataType(DataType.Password)]
        public string Password { get; set; } = string.Empty;

        [Display(Name = "Remember Me")]
        public bool RememberMe { get; set; } = false;

        public string? ReturnUrl { get; set; }
    }

    public class Verify2FAViewModel
    {
        [Required]
        public string UserId { get; set; } = string.Empty;

        [Required(ErrorMessage = "Please enter the 6-digit TOTP authentication code")]
        [StringLength(6, MinimumLength = 6, ErrorMessage = "Code must be exactly 6 digits")]
        [RegularExpression("^[0-9]{6}$", ErrorMessage = "Only numeric digits are allowed")]
        public string Code { get; set; } = string.Empty;

        public bool RememberMe { get; set; }
        public string? ReturnUrl { get; set; }

        public bool IsFirstTimeSetup { get; set; } = false;
        public string? QrCodeBase64 { get; set; }
        public string? SecretKey { get; set; }
        public string? AuthenticatorUri { get; set; }
    }

    public class MetroHubViewModel
    {
        public int ActiveTicketsCount { get; set; }
        public int ArchivedDocumentsCount { get; set; }
        public int EmployeesCount { get; set; }
        public int UsersCount { get; set; }
        public int UsersWith2FACount { get; set; }
        public bool Global2FAEnforced { get; set; }
        public int ServerToleranceSeconds { get; set; }
        public ApplicationUser CurrentUser { get; set; } = null!;
    }

    public class UserPolicyViewModel
    {
        public List<ApplicationUser> Users { get; set; } = new List<ApplicationUser>();
        public bool Global2FAEnforced { get; set; }
        public int ServerToleranceSeconds { get; set; }
        public int TotalUsersCount { get; set; }
        public int TwoFactorActiveCount { get; set; }
        public int TwoFactorDisabledCount { get; set; }
        public int LockedUsersCount { get; set; }
    }

    public class ChangePasswordViewModel
    {
        [Required]
        [DataType(DataType.Password)]
        public string CurrentPassword { get; set; } = string.Empty;

        [Required]
        [StringLength(100, MinimumLength = 8, ErrorMessage = "Password must be at least 8 characters long.")]
        [RegularExpression(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$", ErrorMessage = "Password requires uppercase, lowercase, digit, and special character.")]
        [DataType(DataType.Password)]
        public string NewPassword { get; set; } = string.Empty;

        [DataType(DataType.Password)]
        [Compare("NewPassword", ErrorMessage = "The passwords do not match.")]
        public string ConfirmPassword { get; set; } = string.Empty;
    }
}
