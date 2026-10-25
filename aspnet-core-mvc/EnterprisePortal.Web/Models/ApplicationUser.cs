using System;
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

        /// <summary>
        /// Base32 secret key for RFC 6238 TOTP (Google Authenticator, Microsoft Authenticator)
        /// </summary>
        [MaxLength(64)]
        public string? TwoFactorSecret { get; set; }

        public bool MustChangePassword { get; set; } = false;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? LastLoginTime { get; set; }
    }
}
