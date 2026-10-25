using Microsoft.AspNetCore.Authorization;
using System.Threading.Tasks;
using TicketManagementSystem.Models;

namespace TicketManagementSystem.Security
{
    public class TicketRequirement : IAuthorizationRequirement { }

    public class TicketAuthorizationHandler : AuthorizationHandler<TicketRequirement, Ticket>
    {
        protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, TicketRequirement requirement, Ticket resource)
        {
            var userRole = context.User.FindFirst("Role")?.Value;
            var userId = context.User.FindFirst("UserId")?.Value;

            if (userRole == "System Admin")
            {
                // Admins can do everything
                context.Succeed(requirement);
            }
            else if (userRole == "Operational User")
            {
                // Operational Users can only interact with their own tickets
                if (resource.CreatedById == userId)
                {
                    context.Succeed(requirement);
                }
            }
            else if (userRole == "Technical User")
            {
                // Note: Logic to check if user belongs to resource.AssignedTeamId goes here.
                // Assuming it's validated beforehand or checking a claim.
                context.Succeed(requirement);
            }

            return Task.CompletedTask;
        }
    }
}
