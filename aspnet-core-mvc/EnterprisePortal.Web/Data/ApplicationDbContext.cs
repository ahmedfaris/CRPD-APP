using EnterprisePortal.Web.Models;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace EnterprisePortal.Web.Data
{
    public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        public DbSet<Ticket> Tickets => Set<Ticket>();
        public DbSet<TicketComment> TicketComments => Set<TicketComment>();
        public DbSet<TicketAuditLog> TicketAuditLogs => Set<TicketAuditLog>();
        public DbSet<ArchivalDocument> ArchivalDocuments => Set<ArchivalDocument>();
        public DbSet<Employee> Employees => Set<Employee>();

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            // Configure Ticket relations
            builder.Entity<Ticket>()
                .HasOne(t => t.AssignedToUser)
                .WithMany()
                .HasForeignKey(t => t.AssignedToUserId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.Entity<TicketComment>()
                .HasOne(c => c.Ticket)
                .WithMany(t => t.Comments)
                .HasForeignKey(c => c.TicketId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<TicketComment>()
                .HasOne(c => c.AuthorUser)
                .WithMany()
                .HasForeignKey(c => c.AuthorUserId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.Entity<TicketAuditLog>()
                .HasIndex(a => a.TicketId);

            // Configure Document unique Barcode
            builder.Entity<ArchivalDocument>()
                .HasIndex(d => d.BarcodeNumber)
                .IsUnique();

            builder.Entity<ArchivalDocument>()
                .HasIndex(d => d.DocumentNumber)
                .IsUnique();

            // Configure Employee NationalId index
            builder.Entity<Employee>()
                .HasIndex(e => e.NationalId)
                .IsUnique();
        }
    }
}
