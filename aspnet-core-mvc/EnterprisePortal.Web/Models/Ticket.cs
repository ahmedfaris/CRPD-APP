using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace EnterprisePortal.Web.Models
{
    public enum TicketPriority
    {
        Low,
        Medium,
        High,
        Urgent,
        Critical
    }

    public enum TicketStatus
    {
        Open,
        InProgress,
        PendingUser,
        Resolved,
        Closed
    }

    public enum TicketCategory
    {
        TechnicalSupport,
        NetworkInfrastructure,
        HardwareFailure,
        SoftwareBug,
        AccessRequest,
        SecurityIncident,
        BillingInquiry
    }

    public class Ticket
    {
        [Key]
        public string Id { get; set; } = Guid.NewGuid().ToString("N");

        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [Required]
        public string Description { get; set; } = string.Empty;

        public TicketPriority Priority { get; set; } = TicketPriority.Medium;

        public TicketStatus Status { get; set; } = TicketStatus.Open;

        public TicketCategory Category { get; set; } = TicketCategory.TechnicalSupport;

        [MaxLength(100)]
        public string Department { get; set; } = "IT Support";

        [Required]
        [MaxLength(100)]
        public string RequesterName { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        [MaxLength(150)]
        public string RequesterEmail { get; set; } = string.Empty;

        public string? AssignedToUserId { get; set; }

        [ForeignKey("AssignedToUserId")]
        public virtual ApplicationUser? AssignedToUser { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? UpdatedAt { get; set; }

        public DateTime? ResolvedAt { get; set; }

        public int SlaHours { get; set; } = 24;

        public DateTime SlaDeadline { get; set; }

        public bool SlaBreached => Status != TicketStatus.Resolved && Status != TicketStatus.Closed && DateTime.UtcNow > SlaDeadline;

        public virtual ICollection<TicketComment> Comments { get; set; } = new List<TicketComment>();
        public virtual ICollection<TicketAuditLog> AuditLogs { get; set; } = new List<TicketAuditLog>();
    }

    public class TicketComment
    {
        [Key]
        public string Id { get; set; } = Guid.NewGuid().ToString("N");

        [Required]
        public string TicketId { get; set; } = string.Empty;

        [ForeignKey("TicketId")]
        public virtual Ticket? Ticket { get; set; }

        [Required]
        public string AuthorUserId { get; set; } = string.Empty;

        [ForeignKey("AuthorUserId")]
        public virtual ApplicationUser? AuthorUser { get; set; }

        [Required]
        public string Content { get; set; } = string.Empty;

        public bool IsInternalNote { get; set; } = false;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    public class TicketAuditLog
    {
        [Key]
        public string Id { get; set; } = Guid.NewGuid().ToString("N");

        [Required]
        public string TicketId { get; set; } = string.Empty;

        public string ActorEmail { get; set; } = string.Empty;

        public string Action { get; set; } = string.Empty;

        public string? OldValue { get; set; }
        public string? NewValue { get; set; }

        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }
}
