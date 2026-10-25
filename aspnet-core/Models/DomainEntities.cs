using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TicketManagementSystem.Models
{
    public abstract class AuditableEntity
    {
        public bool IsDeleted { get; set; }
        // Shadow properties CreatedAt, ModifiedBy will be handled in DbContext
    }

    public class Ticket : AuditableEntity
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }
        
        [Required]
        [StringLength(20)]
        public string TicketNo { get; set; } // e.g., TCK-2026-0001
        
        [Required]
        [StringLength(150)]
        public string Title { get; set; }
        
        [Required]
        public string Description { get; set; } // Rich text HTML
        
        public string CreatedById { get; set; }
        public ApplicationUser CreatedBy { get; set; }
        
        public DateTime CreationDate { get; set; }
        
        [Range(1, 3)]
        public int Priority { get; set; } // 1, 2, 3 stars
        
        public int? SLAId { get; set; }
        public SLA SLA { get; set; }
        
        public int? StageId { get; set; }
        public TicketStage Stage { get; set; }
        
        public int? AssignedTeamId { get; set; }
        public Team AssignedTeam { get; set; }
        
        public string TicketType { get; set; } // Hardware Maintenance, Information System Troubleshoot, User Request
        
        // Department Request Data
        public string DepartmentRequestNumber { get; set; }
        public DateTime? DepartmentRequestDate { get; set; }
        public byte[] DepartmentRequestDocument { get; set; } // PDF blob
        
        [Timestamp]
        public byte[] RowVersion { get; set; }

        public ICollection<Comment> Comments { get; set; } = new List<Comment>();
        public ICollection<Attachment> Attachments { get; set; } = new List<Attachment>();
    }

    public class TicketStage : AuditableEntity
    {
        public int Id { get; set; }
        [Required]
        [StringLength(50)]
        public string Name { get; set; }
    }

    public class SLA : AuditableEntity
    {
        public int Id { get; set; }
        [Required]
        [StringLength(100)]
        public string Name { get; set; }
        public int TargetResolutionHours { get; set; }
    }

    public class Team : AuditableEntity
    {
        public int Id { get; set; }
        [Required]
        [StringLength(100)]
        public string Name { get; set; }
        public string TeamCategory { get; set; } // Technical Teams, Database and Systems Admins, Security Teams
        
        public ICollection<ApplicationUser> Members { get; set; } = new List<ApplicationUser>();
    }

    public class Comment : AuditableEntity
    {
        public int Id { get; set; }
        public int TicketId { get; set; }
        public Ticket Ticket { get; set; }
        
        [Required]
        public string Text { get; set; }
        public string UserId { get; set; }
        public ApplicationUser User { get; set; }
    }

    public class Attachment : AuditableEntity
    {
        public int Id { get; set; }
        public int TicketId { get; set; }
        public Ticket Ticket { get; set; }
        
        public string FileName { get; set; }
        public string ContentType { get; set; } // jpeg, png
        public byte[] FileData { get; set; }
    }

    public class ApplicationUser 
    {
        public string Id { get; set; }
        public string Email { get; set; }
        public string FullName { get; set; }
        public string Role { get; set; } // Operational User, Technical User, System Admin
    }
}
