# CRPD scanning agent (Windows)

A small tray program for registry-desk PCs. It lets the archive page start a **TWAIN batch scan**
(document feeder, duplex, resolution, colour mode, without the driver dialog) and sends every page
straight to the archive server, where it is split by separator sheets, OCR'd in Arabic and English,
deskewed, despeckled and stored as PDF/A.

The agent never holds a password or a session: for every scan the archive page asks the server for
a one-time **scan ticket** (valid 30 minutes, tied to the clerk and the registry unit) and passes it
to the agent.

## Requirements

- Windows 10/11, [.NET 8 Desktop Runtime (x86)](https://dotnet.microsoft.com/download/dotnet/8.0)
- The scanner's **TWAIN** driver (32-bit drivers are the most common; the agent is built x86 for them)

**ISIS-only scanners:** ISIS drivers need the vendor's licensed SDK, so the agent does not talk to
them. Use the vendor capture program (for example PaperStream Capture, Kodak Capture Pro or
Kofax Express, which support ISIS and TWAIN) and set it to save PDF or TIFF files into a
**hot folder** configured in *Archive → Administration → Capture*. Network MFPs use hot folders the
same way (scan-to-folder / SMB).

## Build

```bash
dotnet publish tools/scan-agent/ScanAgent.csproj -c Release -o publish/scan-agent
```

## Install on a registry PC

1. Copy the `publish/scan-agent` folder to the PC, for example `C:\Program Files\CRPD Scan Agent`.
2. Edit `agentsettings.json`: put the archive's address in `AllowedOrigins`, exactly as users open
   it in the browser (scheme, host and port), for example `"http://archive-server:3000"`.
   Only pages from these addresses can use the agent, and pages are only uploaded to them.
3. Start `CrpdScanAgent.exe`. To start it at sign-in, put a shortcut in
   `shell:startup`. TWAIN needs the signed-in user's session, so it does not run as a Windows service.
4. In the archive, open *Capture*: the scanner list appears when the agent is running.

The agent listens only on `127.0.0.1:47115` (change `Port` in `agentsettings.json` and in the
archive settings if that port is taken).

## Local API

| Method | Path | Body / result |
|---|---|---|
| GET | `/status` | `{ version, scanners: [...], busy }` |
| POST | `/scan` | `{ serverUrl, ticket, scanner, dpi, color: "bw"\|"gray"\|"color", duplex, feeder }` → `{ pages, batchId }` |

Pages are uploaded as PNG to `POST /api/las-agent/pages` and finished with
`POST /api/las-agent/complete`, both with the header `X-Capture-Ticket`.

## Status

The agent compiles against NTwain 3.7.5, but it has **not been run against a real scanner** yet:
test it on one registry PC with your scanner model before rolling it out.
