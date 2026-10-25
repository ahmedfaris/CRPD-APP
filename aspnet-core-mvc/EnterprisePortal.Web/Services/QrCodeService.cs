using System;
using QRCoder;

namespace EnterprisePortal.Web.Services
{
    public class QrCodeService : IQrCodeService
    {
        public string GeneratePngBase64(string textPayload, int pixelsPerModule = 10)
        {
            if (string.IsNullOrWhiteSpace(textPayload))
                return string.Empty;

            using var qrGenerator = new QRCodeGenerator();
            using var qrCodeData = qrGenerator.CreateQrCode(textPayload, QRCodeGenerator.ECCLevel.Q);
            using var pngByteQrCode = new PngByteQRCode(qrCodeData);
            
            byte[] qrCodeBytes = pngByteQrCode.GetGraphic(pixelsPerModule);
            return Convert.ToBase64String(qrCodeBytes);
        }
    }
}
