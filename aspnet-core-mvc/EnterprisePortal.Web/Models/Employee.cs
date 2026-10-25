using System;
using System.ComponentModel.DataAnnotations;

namespace EnterprisePortal.Web.Models
{
    public enum EmployeeStatus
    {
        Active,
        OnLeave,
        Probation,
        Transferred,
        Resigned
    }

    public class Employee
    {
        [Key]
        public string Id { get; set; } = Guid.NewGuid().ToString("N");

        [Required]
        [MaxLength(100)]
        public string FullName { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string NationalId { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string JobTitle { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string Department { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        [MaxLength(150)]
        public string Email { get; set; } = string.Empty;

        [Phone]
        [MaxLength(30)]
        public string Phone { get; set; } = string.Empty;

        public DateTime HireDate { get; set; } = DateTime.UtcNow.AddYears(-2);

        public EmployeeStatus Status { get; set; } = EmployeeStatus.Active;

        public decimal Salary { get; set; } = 45000m;

        public int LeaveBalanceDays { get; set; } = 25;

        public double PerformanceRating { get; set; } = 4.8;

        [MaxLength(300)]
        public string Skills { get; set; } = "C#, ASP.NET Core, SQL Server, Docker, ITIL";

        [MaxLength(100)]
        public string EmergencyContact { get; set; } = "Family Member (+1 555-0199)";

        [MaxLength(50)]
        public string EmployeeBadgeId { get; set; } = "EMP-0010";
    }
}
