using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using TicketManagementSystem.Data;
using TicketManagementSystem.Models;
using System.Linq;
using System;
using Microsoft.AspNetCore.SignalR;
using TicketManagementSystem.Hubs;
using System.IO;
using System.Collections.Generic;

namespace TicketManagementSystem.Controllers
{
    [Authorize]
    public class TicketsController : Controller
    {
        private readonly ApplicationDbContext _context;
        private readonly IAuthorizationService _authorizationService;
        private readonly IHubContext<TicketHub> _hubContext;

        public TicketsController(ApplicationDbContext context, IAuthorizationService authorizationService, IHubContext<TicketHub> hubContext)
        {
            _context = context;
            _authorizationService = authorizationService;
            _hubContext = hubContext;
        }

        public async Task<IActionResult> Index()
        {
            var userRole = User.FindFirst("Role")?.Value;
            var userId = User.FindFirst("UserId")?.Value;

            IQueryable<Ticket> ticketsQuery = _context.Tickets
                .Include(t => t.AssignedTeam)
                .Include(t => t.Stage);

            if (userRole == "Operational User")
            {
                ticketsQuery = ticketsQuery.Where(t => t.CreatedById == userId);
            }
            else if (userRole == "Technical User")
            {
                // Note: Get team IDs user belongs to
                // ticketsQuery = ticketsQuery.Where(t => userTeamIds.Contains(t.AssignedTeamId.Value));
            }

            var tickets = await ticketsQuery.ToListAsync();
            return View(tickets);
        }

        [Authorize(Roles = "Operational User,System Admin")]
        [HttpGet]
        public IActionResult Create()
        {
            return View();
        }

        [Authorize(Roles = "Operational User,System Admin")]
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(Ticket ticket)
        {
            if (ModelState.IsValid)
            {
                // Ticket Number Generation
                ticket.TicketNo = $"TCK-{DateTime.Now.Year}-{new Random().Next(1000, 9999)}";
                ticket.CreationDate = DateTime.UtcNow;
                ticket.CreatedById = User.FindFirst("UserId")?.Value;

                // Routing Rules (Step 3 & Step 7)
                string targetTeamCategory = ticket.TicketType switch
                {
                    "Hardware Maintenance" => "Technical Teams",
                    "Information System Troubleshoot" => "Database and Systems Admins",
                    "User Request" => "Security Teams",
                    _ => "Technical Teams"
                };
                
                var team = await _context.Teams.FirstOrDefaultAsync(t => t.TeamCategory == targetTeamCategory);
                if (team != null)
                {
                    ticket.AssignedTeamId = team.Id;
                }

                // Add PDF attachment handling logic here
                // Request.Form.Files ...

                try
                {
                    _context.Tickets.Add(ticket);
                    await _context.SaveChangesAsync();

                    // Real-Time Push Notification via SignalR
                    if (team != null)
                    {
                        await _hubContext.Clients.Group(team.Name)
                            .SendAsync("ReceiveTicketNotification", $"New ticket {ticket.TicketNo} assigned to your team.");
                    }

                    return RedirectToAction(nameof(Index));
                }
                catch (DbUpdateConcurrencyException)
                {
                    ModelState.AddModelError("", "A concurrency error occurred.");
                }
            }
            return View(ticket);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> AddComment(int ticketId, string text)
        {
            var ticket = await _context.Tickets.FindAsync(ticketId);
            if (ticket == null) return NotFound();

            var authResult = await _authorizationService.AuthorizeAsync(User, ticket, new TicketRequirement());
            if (!authResult.Succeeded)
            {
                return Forbid();
            }

            var comment = new Comment
            {
                TicketId = ticketId,
                Text = text,
                UserId = User.FindFirst("UserId")?.Value
            };

            _context.Comments.Add(comment);
            await _context.SaveChangesAsync();

            // Notify via SignalR
            await _hubContext.Clients.All.SendAsync("ReceiveCommentNotification", ticketId, text);

            return RedirectToAction(nameof(Index)); // Or redirect to details
        }
    }
}
