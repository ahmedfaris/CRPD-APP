using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using TicketManagementSystem.Models;

namespace TicketManagementSystem.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        public DbSet<Ticket> Tickets { get; set; }
        public DbSet<TicketStage> TicketStages { get; set; }
        public DbSet<SLA> SLAs { get; set; }
        public DbSet<Team> Teams { get; set; }
        public DbSet<Comment> Comments { get; set; }
        public DbSet<Attachment> Attachments { get; set; }

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            // Value Converters for Trim & Lowercase
            var trimAndLowerConverter = new ValueConverter<string, string>(
                v => v.Trim().ToLowerInvariant(),
                v => v
            );

            // Fluent API Configurations
            builder.Entity<ApplicationUser>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Email).HasConversion(trimAndLowerConverter).HasMaxLength(256);
            });

            builder.Entity<Ticket>(entity =>
            {
                entity.HasIndex(e => e.TicketNo).IsUnique();
                entity.Property(e => e.RowVersion).IsRowVersion();
                entity.HasOne(e => e.AssignedTeam).WithMany().HasForeignKey(e => e.AssignedTeamId).OnDelete(DeleteBehavior.Restrict);
                entity.HasOne(e => e.Stage).WithMany().HasForeignKey(e => e.StageId).OnDelete(DeleteBehavior.Restrict);
                entity.HasOne(e => e.SLA).WithMany().HasForeignKey(e => e.SLAId).OnDelete(DeleteBehavior.Restrict);
            });

            // Global Query Filters for Soft Deletes & Shadow Properties configuration
            foreach (var entityType in builder.Model.GetEntityTypes())
            {
                if (typeof(AuditableEntity).IsAssignableFrom(entityType.ClrType))
                {
                    // Add Shadow Properties
                    builder.Entity(entityType.ClrType).Property<DateTime>("CreatedAt");
                    builder.Entity(entityType.ClrType).Property<string>("ModifiedBy");

                    // Soft Delete Query Filter
                    var parameter = System.Linq.Expressions.Expression.Parameter(entityType.ClrType, "e");
                    var propertyMethodInfo = typeof(EF).GetMethod("Property").MakeGenericMethod(typeof(bool));
                    var isDeletedProperty = System.Linq.Expressions.Expression.Call(propertyMethodInfo, parameter, System.Linq.Expressions.Expression.Constant("IsDeleted"));
                    var compareExpression = System.Linq.Expressions.Expression.MakeBinary(System.Linq.Expressions.ExpressionType.Equal, isDeletedProperty, System.Linq.Expressions.Expression.Constant(false));
                    var lambda = System.Linq.Expressions.Expression.Lambda(compareExpression, parameter);

                    builder.Entity(entityType.ClrType).HasQueryFilter(lambda);
                }
            }
        }

        public override int SaveChanges()
        {
            HandleAuditableEntities();
            return base.SaveChanges();
        }

        public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            HandleAuditableEntities();
            return base.SaveChangesAsync(cancellationToken);
        }

        private void HandleAuditableEntities()
        {
            // E.g., fetch from IHttpContextAccessor if injected
            var currentUser = "System"; 

            var entries = ChangeTracker.Entries<AuditableEntity>()
                .Where(e => e.State == EntityState.Added || e.State == EntityState.Modified || e.State == EntityState.Deleted);

            foreach (var entry in entries)
            {
                if (entry.State == EntityState.Added)
                {
                    entry.Property("CreatedAt").CurrentValue = DateTime.UtcNow;
                }
                
                entry.Property("ModifiedBy").CurrentValue = currentUser;

                if (entry.State == EntityState.Deleted)
                {
                    entry.State = EntityState.Modified;
                    entry.Entity.IsDeleted = true;
                }
            }
        }
    }
}
