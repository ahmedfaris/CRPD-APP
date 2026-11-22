// CRPD Archive scanning agent.
//
// Runs in the system tray on a registry-desk PC and lets the archive page in the browser start a
// TWAIN batch scan (automatic document feeder, duplex, resolution, colour mode, no driver dialog).
// Each scanned page is sent straight to the archive server with a one-time scan ticket that the
// page obtained for the signed-in clerk; the agent never sees a password or session.
//
// Local API (http://127.0.0.1:<Port>, only for the origins in agentsettings.json):
//   GET  /status  -> { version, scanners: [names], busy }
//   POST /scan    -> body { serverUrl, ticket, scanner, dpi, color: "bw"|"gray"|"color", duplex, feeder }
//                    returns { pages, batchId } when the batch is uploaded and queued for OCR.
using System.Drawing;
using System.Windows.Forms;
using System.Drawing.Imaging;
using System.Net;
using System.Net.Http.Headers;
using System.Reflection;
using System.Text;
using System.Text.Json;
using NTwain;
using NTwain.Data;

namespace CrpdScanAgent;

public sealed class AgentSettings
{
    public int Port { get; set; } = 47115;
    public List<string> AllowedOrigins { get; set; } = new();
    public int DefaultDpi { get; set; } = 300;

    public static AgentSettings Load()
    {
        var file = Path.Combine(AppContext.BaseDirectory, "agentsettings.json");
        if (!File.Exists(file)) return new AgentSettings();
        return JsonSerializer.Deserialize<AgentSettings>(File.ReadAllText(file), new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new AgentSettings();
    }

    /// <summary>Exact origin match (scheme://host:port), compared case-insensitively.</summary>
    public bool IsAllowed(string? origin) =>
        !string.IsNullOrEmpty(origin) && AllowedOrigins.Any(o => string.Equals(o.TrimEnd('/'), origin.TrimEnd('/'), StringComparison.OrdinalIgnoreCase));
}

public sealed record ScanRequest(string ServerUrl, string Ticket, string? Scanner, int? Dpi, string? Color, bool? Duplex, bool? Feeder);

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.SetHighDpiMode(HighDpiMode.SystemAware);
        using var mutex = new Mutex(true, "CrpdScanAgent.SingleInstance", out var first);
        if (!first) return; // already running
        Application.Run(new AgentForm(AgentSettings.Load()));
    }
}

/// <summary>Hidden window: owns the tray icon and the TWAIN message loop (TWAIN needs a window handle).</summary>
public sealed class AgentForm : Form
{
    private readonly AgentSettings _settings;
    private readonly NotifyIcon _tray;
    private readonly HttpClient _http = new() { Timeout = TimeSpan.FromMinutes(5) };
    private readonly SemaphoreSlim _scanLock = new(1, 1);
    private TwainSession? _twain;
    private HttpListener? _listener;

    public AgentForm(AgentSettings settings)
    {
        _settings = settings;
        ShowInTaskbar = false;
        WindowState = FormWindowState.Minimized;
        Opacity = 0;
        _tray = new NotifyIcon
        {
            Icon = SystemIcons.Application,
            Text = "CRPD scanning agent",
            Visible = true,
            ContextMenuStrip = new ContextMenuStrip(),
        };
        _tray.ContextMenuStrip.Items.Add("Exit / خروج", null, (_, _) => Close());
    }

    protected override void OnLoad(EventArgs e)
    {
        base.OnLoad(e);
        Hide();
        try
        {
            _twain = new TwainSession(TWIdentity.CreateFromAssembly(DataGroups.Image, Assembly.GetExecutingAssembly()));
            var rc = _twain.Open(new WindowsFormsMessageLoopHook(Handle));
            if (rc != ReturnCode.Success) Notify($"TWAIN could not start ({rc}). Check that the scanner driver is installed.");
        }
        catch (Exception ex) { Notify("TWAIN could not start: " + ex.Message); }

        _listener = new HttpListener();
        _listener.Prefixes.Add($"http://127.0.0.1:{_settings.Port}/");
        _listener.Start();
        _ = Task.Run(ListenLoop);
        Notify($"Scanning agent ready on port {_settings.Port}.");
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        _tray.Visible = false;
        try { _listener?.Stop(); } catch { /* closing */ }
        try { _twain?.Close(); } catch { /* closing */ }
        base.OnFormClosing(e);
    }

    private void Notify(string text) => _tray.ShowBalloonTip(4000, "CRPD Scan", text, ToolTipIcon.Info);

    // ---- local HTTP API ----------------------------------------------------------------------
    private async Task ListenLoop()
    {
        while (_listener is { IsListening: true })
        {
            HttpListenerContext ctx;
            try { ctx = await _listener.GetContextAsync(); } catch { break; }
            _ = Task.Run(() => HandleRequest(ctx));
        }
    }

    private async Task HandleRequest(HttpListenerContext ctx)
    {
        var req = ctx.Request; var res = ctx.Response;
        var origin = req.Headers["Origin"];
        try
        {
            // Only the archive's own pages may use the agent.
            if (!_settings.IsAllowed(origin)) { await Json(res, 403, new { error = "This page is not allowed to use the scanning agent." }); return; }
            res.AddHeader("Access-Control-Allow-Origin", origin!);
            res.AddHeader("Vary", "Origin");
            if (req.HttpMethod == "OPTIONS")
            {
                res.AddHeader("Access-Control-Allow-Methods", "GET, POST");
                res.AddHeader("Access-Control-Allow-Headers", "Content-Type");
                res.AddHeader("Access-Control-Allow-Private-Network", "true"); // Chrome private network access
                res.StatusCode = 204; res.Close(); return;
            }
            var route = req.Url?.AbsolutePath.TrimEnd('/') ?? "";
            if (req.HttpMethod == "GET" && route == "/status")
            {
                var scanners = OnUi(() => _twain?.GetSources().Select(s => s.Name).ToList() ?? new List<string>());
                await Json(res, 200, new { version = "1.0.0", scanners, busy = _scanLock.CurrentCount == 0 });
                return;
            }
            if (req.HttpMethod == "POST" && route == "/scan")
            {
                using var reader = new StreamReader(req.InputStream, Encoding.UTF8);
                var body = JsonSerializer.Deserialize<ScanRequest>(await reader.ReadToEndAsync(), new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                if (body is null || string.IsNullOrWhiteSpace(body.Ticket) || string.IsNullOrWhiteSpace(body.ServerUrl)) { await Json(res, 400, new { error = "Missing ticket or server address." }); return; }
                // Pages go only to the archive server the page came from.
                if (!_settings.IsAllowed(new Uri(body.ServerUrl).GetLeftPart(UriPartial.Authority))) { await Json(res, 403, new { error = "Unknown archive server." }); return; }
                if (!await _scanLock.WaitAsync(0)) { await Json(res, 409, new { error = "The scanner is busy with another batch." }); return; }
                try
                {
                    var result = await ScanAndUpload(body);
                    await Json(res, 200, result);
                }
                finally { _scanLock.Release(); }
                return;
            }
            await Json(res, 404, new { error = "Not found" });
        }
        catch (Exception ex)
        {
            try { await Json(res, 500, new { error = ex.Message }); } catch { /* client gone */ }
        }
    }

    private static async Task Json(HttpListenerResponse res, int status, object body)
    {
        var bytes = JsonSerializer.SerializeToUtf8Bytes(body, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        res.StatusCode = status;
        res.ContentType = "application/json; charset=utf-8";
        res.ContentLength64 = bytes.Length;
        await res.OutputStream.WriteAsync(bytes);
        res.Close();
    }

    private T OnUi<T>(Func<T> f) => InvokeRequired ? (T)Invoke(f) : f();

    // ---- scanning ------------------------------------------------------------------------------
    private async Task<object> ScanAndUpload(ScanRequest r)
    {
        var pages = await ScanPages(r);
        if (pages.Count == 0) throw new InvalidOperationException("No pages were scanned. Check that paper is in the feeder.");
        var server = r.ServerUrl.TrimEnd('/');
        int? batchId = null;
        foreach (var png in pages)
        {
            using var content = new ByteArrayContent(png);
            content.Headers.ContentType = new MediaTypeHeaderValue("image/png");
            using var msg = new HttpRequestMessage(HttpMethod.Post, $"{server}/api/las-agent/pages") { Content = content };
            msg.Headers.Add("X-Capture-Ticket", r.Ticket);
            msg.Headers.Add("X-Scanner-Name", r.Scanner ?? "TWAIN");
            using var up = await _http.SendAsync(msg);
            var text = await up.Content.ReadAsStringAsync();
            if (!up.IsSuccessStatusCode) throw new InvalidOperationException($"Upload failed ({(int)up.StatusCode}): {text}");
            batchId = JsonDocument.Parse(text).RootElement.GetProperty("data").GetProperty("batchId").GetInt32();
        }
        using var done = new HttpRequestMessage(HttpMethod.Post, $"{server}/api/las-agent/complete");
        done.Headers.Add("X-Capture-Ticket", r.Ticket);
        using var fin = await _http.SendAsync(done);
        if (!fin.IsSuccessStatusCode) throw new InvalidOperationException("The batch could not be completed: " + await fin.Content.ReadAsStringAsync());
        return new { pages = pages.Count, batchId };
    }

    /// <summary>Scan every sheet in the feeder (or one flatbed page) without showing the driver dialog.</summary>
    private Task<List<byte[]>> ScanPages(ScanRequest r)
    {
        var done = new TaskCompletionSource<List<byte[]>>(TaskCreationOptions.RunContinuationsAsynchronously);
        var pages = new List<byte[]>();
        BeginInvoke(() =>
        {
            var session = _twain ?? throw new InvalidOperationException("TWAIN is not available on this PC.");
            DataSource? src = string.IsNullOrWhiteSpace(r.Scanner)
                ? session.GetSources().FirstOrDefault()
                : session.GetSources().FirstOrDefault(s => s.Name == r.Scanner);
            if (src is null) { done.TrySetException(new InvalidOperationException("Scanner not found.")); return; }

            EventHandler<DataTransferredEventArgs>? onData = null;
            EventHandler<TransferErrorEventArgs>? onError = null;
            EventHandler? onDisabled = null;
            void Cleanup()
            {
                session.DataTransferred -= onData; session.TransferError -= onError; session.SourceDisabled -= onDisabled;
                try { src.Close(); } catch { /* already closed */ }
            }
            onData = (_, e) =>
            {
                if (e.NativeData == IntPtr.Zero) return;
                using var stream = e.GetNativeImageStream();
                if (stream is null) return;
                using var bmp = new Bitmap(stream);
                using var ms = new MemoryStream();
                bmp.Save(ms, ImageFormat.Png); // lossless: best input for OCR and PDF/A
                pages.Add(ms.ToArray());
            };
            onError = (_, e) => { Cleanup(); done.TrySetException(e.Exception ?? new InvalidOperationException($"Scanner error: {e.ReturnCode}")); };
            onDisabled = (_, _) => { Cleanup(); done.TrySetResult(pages); };
            session.DataTransferred += onData; session.TransferError += onError; session.SourceDisabled += onDisabled;

            if (src.Open() != ReturnCode.Success) { Cleanup(); done.TrySetException(new InvalidOperationException("The scanner could not be opened. Is it switched on and not used by another program?")); return; }
            var caps = src.Capabilities;
            var dpi = r.Dpi is >= 100 and <= 1200 ? r.Dpi.Value : _settings.DefaultDpi;
            // Each setting is optional for a driver: ignore ones it does not support.
            TrySet(() => caps.ICapXferMech.SetValue(XferMech.Native));
            TrySet(() => caps.ICapPixelType.SetValue(r.Color switch { "color" => PixelType.RGB, "bw" => PixelType.BlackWhite, _ => PixelType.Gray }));
            TrySet(() => caps.ICapXResolution.SetValue(dpi));
            TrySet(() => caps.ICapYResolution.SetValue(dpi));
            if (r.Feeder != false)
            {
                TrySet(() => caps.CapFeederEnabled.SetValue(BoolType.True));
                TrySet(() => caps.CapAutoFeed.SetValue(BoolType.True));
            }
            TrySet(() => caps.CapDuplexEnabled.SetValue(r.Duplex == true ? BoolType.True : BoolType.False));
            TrySet(() => caps.CapXferCount.SetValue(-1)); // all sheets in the feeder
            TrySet(() => caps.CapIndicators.SetValue(BoolType.False));

            var rc = src.Enable(SourceEnableMode.NoUI, false, Handle);
            if (rc != ReturnCode.Success) { Cleanup(); done.TrySetException(new InvalidOperationException($"The scan could not start ({rc}).")); }
        });
        return done.Task;
    }

    private static void TrySet(Func<ReturnCode> set) { try { set(); } catch { /* capability not supported by this driver */ } }
}
