"""Optional: download licensed reference photos and switch UI to local paths.
Run once before Docker build. Original files are retained without image edits.
The app also works with hosted photographs and offline SVG fallbacks.
"""

import re
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app/static/app.js"
text = APP.read_text()
pattern = re.compile(
    r'(pine|spruce|fir|juniper):\s*"(https://upload\.wikimedia\.org/[^"\s]+)"'
)
failed = []
for name, url in pattern.findall(text):
    try:
        with urlopen(
            Request(url, headers={"User-Agent": "EcoTrailReferencePhotos/1.0"}),
            timeout=30,
        ) as response:
            data = response.read(10 * 1024 * 1024)
        if not data.startswith(b"\xff\xd8"):
            raise ValueError("Response is not a JPEG")
        (ROOT / f"app/static/media/{name}.jpg").write_bytes(data)
        text = text.replace(url, f"/static/media/{name}.jpg")
        print(f"{name}: saved")
    except (OSError, ValueError) as error:
        failed.append(name)
        print(f"{name}: left online ({type(error).__name__})")
APP.write_text(text)
if failed:
    raise SystemExit("Not downloaded: " + ", ".join(failed))
