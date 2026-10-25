using System.Linq;
using System.Threading.Tasks;
using EnterprisePortal.Web.Data;
using EnterprisePortal.Web.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace EnterprisePortal.Web.Controllers
{
    [Authorize]
    public class EmployeesController : Controller
    {
        private readonly ApplicationDbContext _context;

        public EmployeesController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> Index(string? department, string? status, string? search)
        {
            var query = _context.Employees.AsQueryable();

            if (!string.IsNullOrEmpty(department))
            {
                query = query.Where(e => e.Department == department);
            }

            if (!string.IsNullOrEmpty(status) && System.Enum.TryParse<EmployeeStatus>(status, true, out var parsedStatus))
            {
                query = query.Where(e => e.Status == parsedStatus);
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLower();
                query = query.Where(e => e.FullName.ToLower().Contains(term) ||
                                         e.NationalId.Contains(term) ||
                                         e.Email.ToLower().Contains(term) ||
                                         e.JobTitle.ToLower().Contains(term));
            }

            var employees = await query.OrderBy(e => e.FullName).ToListAsync();
            ViewBag.Departments = await _context.Employees.Select(e => e.Department).Distinct().ToListAsync();
            ViewBag.CurrentDepartment = department;
            ViewBag.CurrentSearch = search;

            return View(employees);
        }

        [HttpGet]
        public async Task<IActionResult> Details(string id)
        {
            var emp = await _context.Employees.FindAsync(id);
            if (emp == null) return NotFound();

            return View(emp);
        }

        [HttpGet]
        public IActionResult Create()
        {
            return View(new Employee());
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(Employee employee)
        {
            if (!ModelState.IsValid)
            {
                return View(employee);
            }

            _context.Employees.Add(employee);
            await _context.SaveChangesAsync();

            Log.Information("EmployeeCreated: New staff profile registered {EmpName} ({JobTitle}) in {Dept}",
                employee.FullName, employee.JobTitle, employee.Department);

            TempData["SuccessMessage"] = $"Staff profile for {employee.FullName} created.";
            return RedirectToAction(nameof(Index));
        }
    }
}
