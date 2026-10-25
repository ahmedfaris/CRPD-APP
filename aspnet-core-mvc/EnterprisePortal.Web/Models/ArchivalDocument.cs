using System;
using System.ComponentModel.DataAnnotations;

namespace EnterprisePortal.Web.Models
{
    public enum DocumentConfidentiality
    {
        Public,
        Internal,
        Restricted,
        TopSecret
    }

    public enum DocumentCategory
    {
        AdministrativeDecisions,
        ExecutiveDecrees,
        ProcurementContracts,
        FinancialStatements,
        LegalAgreements,
        PersonnelFiles,
        AuditReports,
        TechnicalSpecs
    }

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

        [MaxLength(200)]
        public string Tags { get; set; } = string.Empty;

        public DateTime ArchivedDate { get; set; } = DateTime.UtcNow;

        public DateTime? ExpiryDate { get; set; }

        public int RetentionYears { get; set; } = 10;

        public long FileSizeBytes { get; set; } = 1024 * 1024 * 2; // 2 MB default

        [MaxLength(20)]
        public string FileType { get; set; } = "PDF/A-1b";

        public string CreatedByUserId { get; set; } = string.Empty;

        public bool IsDigitallySigned { get; set; } = true;

        [MaxLength(64)]
        public string DigitalFingerprintSha256 { get; set; } = string.Empty;
    }
}
