"""Public, read-only API. All personal progress stays on the device."""

import hashlib
import json
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from .stations import load_stations

ROOT = Path(__file__).parent
STATIC = ROOT / "static"
STATIONS = load_stations()
app = FastAPI(title="ЭкоТропа · Торфяное", docs_url=None, redoc_url=None)
app.mount("/static", StaticFiles(directory=STATIC), name="static")


@app.middleware("http")
async def response_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Cache-Control"] = "no-cache"
    # No frame restriction: Telegram Web embeds Mini Apps.
    return response


@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")


@app.get("/healthz")
def health():
    return {"status": "ok", "stations": len(STATIONS)}


@app.get("/api/route")
def route():
    return JSONResponse({"name": "ЭкоТропа · Торфяное", "stations": STATIONS})


@app.get("/sw.js")
def service_worker():
    # Hash all shipped assets AND content: adding a station updates offline cache.
    files = sorted(p for p in STATIC.rglob("*") if p.is_file() and p.name != "sw.js")
    digest = hashlib.sha256(json.dumps(STATIONS, ensure_ascii=False).encode())
    for path in files:
        digest.update(path.read_bytes())
    urls = ["/", "/api/route"] + [
        "/static/" + str(p.relative_to(STATIC)) for p in files
    ]
    prefix = f'const VERSION = "eco-{digest.hexdigest()[:16]}";\nconst ASSETS = {json.dumps(urls)};\n'
    return Response(
        prefix + (STATIC / "sw.js").read_text(),
        media_type="application/javascript",
        headers={"Service-Worker-Allowed": "/"},
    )
