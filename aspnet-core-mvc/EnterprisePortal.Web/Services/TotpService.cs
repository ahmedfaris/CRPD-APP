using System;
using System.Security.Cryptography;
using System.Text;

namespace EnterprisePortal.Web.Services
{
    public class TotpService : ITotpService
    {
        private const int StepSeconds = 30;
        private const int Digits = 6;
        private static readonly string Base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

        public string GenerateSecretKey()
        {
            byte[] bytes = new byte[20];
            using (var rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(bytes);
            }
            return ToBase32(bytes);
        }

        public string GenerateOtpAuthUri(string email, string secretKey, string issuer = "EnterprisePortal")
        {
            var cleanEmail = Uri.EscapeDataString(email);
            var cleanIssuer = Uri.EscapeDataString(issuer);
            return $"otpauth://totp/{cleanIssuer}:{cleanEmail}?secret={secretKey}&issuer={cleanIssuer}&algorithm=SHA1&digits={Digits}&period={StepSeconds}";
        }

        public bool VerifyCode(string secretKey, string code, int toleranceSeconds = 60)
        {
            if (string.IsNullOrWhiteSpace(secretKey) || string.IsNullOrWhiteSpace(code) || code.Length != Digits)
            {
                return false;
            }

            try
            {
                byte[] key = FromBase32(secretKey);
                long currentUnixSeconds = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                long currentStep = currentUnixSeconds / StepSeconds;

                int stepTolerance = Math.Max(1, toleranceSeconds / StepSeconds);

                for (int i = -stepTolerance; i <= stepTolerance; i++)
                {
                    long step = currentStep + i;
                    string generated = ComputeTotp(key, step);
                    if (generated.Equals(code.Trim(), StringComparison.Ordinal))
                    {
                        return true;
                    }
                }
            }
            catch
            {
                return false;
            }

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
            if (BitConverter.IsLittleEndian)
            {
                Array.Reverse(stepBytes);
            }

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
            StringBuilder sb = new StringBuilder();
            byte curByte = 0, nextByte = 0;
            int bitsLeft = 8;
            int curIndex = 0;

            while (curIndex < data.Length)
            {
                curByte = data[curIndex++];
                while (bitsLeft > 0)
                {
                    int val;
                    if (bitsLeft >= 5)
                    {
                        val = (curByte >> (bitsLeft - 5)) & 0x1F;
                        bitsLeft -= 5;
                    }
                    else
                    {
                        val = (curByte & ((1 << bitsLeft) - 1)) << (5 - bitsLeft);
                        if (curIndex < data.Length)
                        {
                            nextByte = data[curIndex++];
                            val |= (nextByte >> (8 - (5 - bitsLeft))) & 0x1F;
                            curByte = nextByte;
                            bitsLeft = 8 - (5 - bitsLeft);
                        }
                        else
                        {
                            bitsLeft = 0;
                        }
                    }
                    sb.Append(Base32Alphabet[val]);
                }
                bitsLeft = 8;
            }

            return sb.ToString();
        }

        private static byte[] FromBase32(string base32)
        {
            string clean = base32.Trim().TrimEnd('=').ToUpperInvariant();
            byte[] bytes = new byte[clean.Length * 5 / 8];
            int bitBuffer = 0;
            int bitsInBuffer = 0;
            int byteIndex = 0;

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
}
