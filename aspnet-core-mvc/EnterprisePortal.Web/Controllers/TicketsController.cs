using System;
using System.Linq;
using System.Threading.Tasks;
using EnterprisePortal.Web.Data;
using EnterprisePortal.Web.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace EnterprisePortal.Web.Controllers
{
    [Authorize]
    public class TicketsController : Controller
    {
        private readonly ApplicationDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;

        public TicketsController(ApplicationDbContext context, UserManager<ApplicationUser> userManager)
        {
            _context = context;
            _userManager = userManager;
        }

        [HttpGet]
        public async Task<IActionResult> Index(string? status, string? priority, string? search)
        {
            var query = _context.Tickets
                .Include(t => t.AssignedToUser)
                .AsQueryable();

            if (!string.IsNullOrEmpty(status) && Enum.TryParse<TicketStatus>(status, true, out var parsedStatus))
            {
                query = query.Where(t => t.Status == parsedStatus);
            }

            if (!string.IsNullOrEmpty(priority) && Enum.TryParse<TicketPriority>(priority, true, out var parsedPriority))
            {
                query = query.Where(t => t.Priority == parsedPriority);
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLower();
                query = query.Where(t => t.Title.ToLower().Contains(term) ||
                                         t.RequesterName.ToLower().Contains(term) ||
                                         t.Department.ToLower().Contains(term));
            }

            var tickets = await query.OrderByDescending(t => t.CreatedAt).ToListAsync();
            ViewBag.CurrentSearch = search;
            ViewBag.CurrentStatus = status;
            ViewBag.CurrentPriority = priority;

            return View(tickets);
        }

        [HttpGet]
        public async Task<IActionResult> Details(string id)
        {
            var ticket = await _context.Tickets
                .Include(t => t.AssignedToUser)
                .Include(t => t.Comments)
                    .ThenInclude(c => c.AuthorUser)
                .Include(t => t.AuditLogs)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (ticket == null)
            {
                return NotFound();
            }

            return View(ticket);
        }

        [HttpGet]
        public IActionResult Create()
        {
            return View(new Ticket());
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(Ticket ticket)
        {
            var currentUser = await _userManager.GetUserAsync(User);
            ticket.CreatedAt = DateTime.UtcNow;
            ticket.SlaDeadline = DateTime.UtcNow.AddHours(ticket.SlaHours > 0 ? ticket.SlaHours : 24);

            if (string.IsNullOrWhiteSpace(ticket.RequesterEmail) && currentUser != null)
            {
                ticket.RequesterEmail = currentUser.Email!;
                ticket.RequesterName = currentUser.FullName;
            }

            _context.Tickets.Add(ticket);

            // Audit
            _context.TicketAuditLogs.Add(new TicketAuditLog
            {
                TicketId = ticket.Id,
                ActorEmail = currentUser?.Email ?? "system",
                Action = "Created",
                NewValue = $"Ticket '{ticket.Title}' logged with priority {ticket.Priority}"
            });

            await _context.SaveChangesAsync();

            Log.Information("TicketCreated: Ticket {TicketId} ('{Title}') logged by {RequesterEmail}. SLA: {SlaHours}h",
                ticket.Id, ticket.Title, ticket.RequesterEmail, ticket.SlaHours);

            TempData["SuccessMessage"] = $"Ticket #{ticket.Id[..8]} successfully opened.";
            return RedirectToAction(nameof(Details), new { id = ticket.Id });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> UpdateStatus(string id, TicketStatus status)
        {
            var ticket = await _context.Tickets.FindAsync(id);
            if (ticket == null) return NotFound();

            var oldStatus = ticket.Status;
            ticket.Status = status;
            ticket.UpdatedAt = DateTime.UtcNow;

            if (status == TicketStatus.Resolved || status == TicketStatus.Closed)
            {
                ticket.ResolvedAt = DateTime.UtcNow;
            }

            var user = await _userManager.GetUserAsync(User);
            _context.TicketAuditLogs.Add(new TicketAuditLog
            {
                TicketId = ticket.Id,
                ActorEmail = user?.Email ?? "system",
                Action = "StatusChanged",
                OldValue = oldStatus.ToString(),
                NewValue = status.ToString()
            });

            await _context.SaveChangesAsync();

            Log.Information("TicketStatusChanged: Ticket {TicketId} changed from {OldStatus} to {NewStatus} by {ActorEmail}",
                ticket.Id, oldStatus, status, user?.Email);

            return RedirectToAction(nameof(Details), new { id = ticket.Id });
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> AddComment(string ticketId, string content, bool isInternalNote)
        {
            if (string.IsNullOrWhiteSpace(content))
                return RedirectToAction(nameof(Details), new { id = ticketId });

            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var comment = new TicketComment
            {
                TicketId = ticketId,
                AuthorUserId = user.Id,
                Content = content.Trim(),
                IsInternalNote = isInternalNote,
                CreatedAt = DateTime.UtcNow
            };

            _context.TicketComments.Add(comment);
            await _context.SaveChangesAsync();

            Log.Information("TicketCommentAdded: New note on Ticket {TicketId} by {AuthorEmail} (Internal: {IsInternal})",
                ticketId, user.Email, isInternalNote);

            return RedirectToAction(nameof(Details), new { id = ticketId });
        }
    }
}
