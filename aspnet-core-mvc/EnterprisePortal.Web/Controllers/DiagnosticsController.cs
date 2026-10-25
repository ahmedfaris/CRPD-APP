using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EnterprisePortal.Web.Controllers
{
    [Authorize(Roles = "Admin")]
    public class DiagnosticsController : Controller
    {
        [HttpGet]
        public IActionResult Serilog()
        {
            var logLines = new List<string>();
            try
            {
                var logDir = Path.Combine(Directory.GetCurrentDirectory(), "Logs");
                if (Directory.Exists(logDir))
                {
                    var files = Directory.GetFiles(logDir, "*.txt").OrderByDescending(f => f);
                    var latest = files.FirstOrDefault();
                    if (latest != null)
                    {
                        using var fs = new FileStream(latest, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
                        using var reader = new StreamReader(fs);
                        string? line;
                        while ((line = reader.ReadLine()) != null)
                        {
                            logLines.Add(line);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                logLines.Add($"[Error reading Serilog sink]: {ex.Message}");
            }

            ViewBag.LogLines = logLines.TakeLast(200).Reverse().ToList();
            return View();
        }
    }
}
