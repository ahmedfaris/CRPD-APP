using System;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using EnterprisePortal.Web.Data;
using EnterprisePortal.Web.Models;
using EnterprisePortal.Web.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace EnterprisePortal.Web.Controllers
{
    [Authorize]
    public class ArchivingController : Controller
    {
        private readonly ApplicationDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IQrCodeService _qrCodeService;

        public ArchivingController(
            ApplicationDbContext context,
            UserManager<ApplicationUser> userManager,
            IQrCodeService qrCodeService)
        {
            _context = context;
            _userManager = userManager;
            _qrCodeService = qrCodeService;
        }

        [HttpGet]
        public async Task<IActionResult> Index(string? category, string? confidentiality, string? search)
        {
            var query = _context.ArchivalDocuments.AsQueryable();

            if (!string.IsNullOrEmpty(category) && Enum.TryParse<DocumentCategory>(category, true, out var parsedCat))
            {
                query = query.Where(d => d.Category == parsedCat);
            }

            if (!string.IsNullOrEmpty(confidentiality) && Enum.TryParse<DocumentConfidentiality>(confidentiality, true, out var parsedConf))
            {
                query = query.Where(d => d.Confidentiality == parsedConf);
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var term = search.Trim().ToLower();
                query = query.Where(d => d.Title.ToLower().Contains(term) ||
                                         d.DocumentNumber.ToLower().Contains(term) ||
                                         d.BarcodeNumber.ToLower().Contains(term) ||
                                         d.Tags.ToLower().Contains(term));
            }

            var docs = await query.OrderByDescending(d => d.ArchivedDate).ToListAsync();
            ViewBag.CurrentCategory = category;
            ViewBag.CurrentConfidentiality = confidentiality;
            ViewBag.CurrentSearch = search;

            return View(docs);
        }

        [HttpGet]
        public async Task<IActionResult> Details(string id)
        {
            var doc = await _context.ArchivalDocuments.FindAsync(id);
            if (doc == null) return NotFound();

            // Generate barcode QR image
            string qrPayload = $"DOC:{doc.DocumentNumber}|BAR:{doc.BarcodeNumber}|SHA:{doc.DigitalFingerprintSha256[..16]}|CONF:{doc.Confidentiality}";
            ViewBag.BarcodeQrBase64 = _qrCodeService.GeneratePngBase64(qrPayload, 8);

            return View(doc);
        }

        [HttpGet]
        public IActionResult Create()
        {
            var doc = new ArchivalDocument
            {
                DocumentNumber = $"DOC-{DateTime.UtcNow.Year}-{Random.Shared.Next(1000, 9999)}",
                BarcodeNumber = $"BAR-{DateTime.UtcNow:yyyyMMdd}-{Random.Shared.Next(100000, 999999)}"
            };
            return View(doc);
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Create(ArchivalDocument doc)
        {
            var user = await _userManager.GetUserAsync(User);
            doc.CreatedByUserId = user?.Id ?? "system";
            doc.ArchivedDate = DateTime.UtcNow;
            doc.ExpiryDate = DateTime.UtcNow.AddYears(doc.RetentionYears);

            // Compute SHA-256 fingerprint
            using var sha = SHA256.Create();
            byte[] hash = sha.ComputeHash(Encoding.UTF8.GetBytes($"{doc.DocumentNumber}:{doc.Title}:{DateTime.UtcNow.Ticks}"));
            doc.DigitalFingerprintSha256 = Convert.ToHexString(hash).ToLowerInvariant();

            _context.ArchivalDocuments.Add(doc);
            await _context.SaveChangesAsync();

            Log.Information("DocumentArchived: New record {DocNum} ('{Title}') deposited in {PhysicalLocation}. Fingerprint: {Fingerprint}",
                doc.DocumentNumber, doc.Title, doc.PhysicalLocation, doc.DigitalFingerprintSha256);

            TempData["SuccessMessage"] = $"Document {doc.DocumentNumber} archived and digitally sealed.";
            return RedirectToAction(nameof(Details), new { id = doc.Id });
        }
    }
}
