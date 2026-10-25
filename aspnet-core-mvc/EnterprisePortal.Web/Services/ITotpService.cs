using System;

namespace EnterprisePortal.Web.Services
{
    public interface ITotpService
    {
        string GenerateSecretKey();
        string GenerateOtpAuthUri(string email, string secretKey, string issuer = "EnterprisePortal");
        bool VerifyCode(string secretKey, string code, int toleranceSeconds = 60);
        string GetCurrentCode(string secretKey);
    }
}
