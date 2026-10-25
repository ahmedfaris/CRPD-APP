using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;

namespace TicketManagementSystem.Hubs
{
    public class TicketHub : Hub
    {
        public async Task JoinTeamGroup(string teamName)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, teamName);
        }

        public async Task LeaveTeamGroup(string teamName)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, teamName);
        }

        // Methods to push notifications
        // 1. Incoming ticket assignment
        // 2. SLA threshold warning
        // 3. New collaborative comments
    }
}
