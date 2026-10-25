using System.Linq;
using System.Threading.Tasks;
using EnterprisePortal.Web.Data;
using EnterprisePortal.Web.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Serilog;

namespace EnterprisePortal.Web.Controllers
{
    [Authorize]
    public class MetroController : Controller
    {
        private readonly ApplicationDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IConfiguration _configuration;

        public MetroController(
            ApplicationDbContext context,
            UserManager<ApplicationUser> userManager,
            IConfiguration configuration)
        {
            _context = context;
            _userManager = userManager;
            _configuration = configuration;
        }

        [HttpGet]
        public async Task<IActionResult> Index()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null)
            {
                return RedirectToAction("Login", "Account");
            }

            if (user.MustChangePassword)
            {
                return RedirectToAction("ChangePassword", "Account");
            }

            int activeTickets = await _context.Tickets.CountAsync(t => t.Status != TicketStatus.Closed && t.Status != TicketStatus.Resolved);
            int archivedDocs = await _context.ArchivalDocuments.CountAsync();
            int totalEmployees = await _context.Employees.CountAsync();
            int totalUsers = await _userManager.Users.CountAsync();
            int usersWith2FA = await _userManager.Users.CountAsync(u => u.TwoFactorEnabled);

            bool global2FA = _configuration.GetValue<bool>("SecurityPolicy:Global2FAEnforced", false);
            int toleranceSec = _configuration.GetValue<int>("SecurityPolicy:ServerToleranceSeconds", 60);

            var model = new MetroHubViewModel
            {
                ActiveTicketsCount = activeTickets,
                ArchivedDocumentsCount = archivedDocs,
                EmployeesCount = totalEmployees,
                UsersCount = totalUsers,
                UsersWith2FACount = usersWith2FA,
                Global2FAEnforced = global2FA,
                ServerToleranceSeconds = toleranceSec,
                CurrentUser = user
            };

            Log.Information("User {UserEmail} accessed Metro Operations Hub. Identity: {Role}", user.Email, user.JobTitle);

            return View(model);
        }
    }
}
