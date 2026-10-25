namespace EnterprisePortal.Web.Services
{
    public interface IQrCodeService
    {
        string GeneratePngBase64(string textPayload, int pixelsPerModule = 10);
    }
}
