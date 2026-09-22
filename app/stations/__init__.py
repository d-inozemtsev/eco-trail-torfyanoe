"""Discover station files and validate content before serving it."""

import math
import re
from importlib import import_module
from pathlib import Path

BLOCK_TYPES = {
    "choice",
    "story",
    "observation",
    "visual_quiz",
    "profile_choice",
    "ship_builder",
    "checklist",
    "true_false",
}
TRAITS = {"guardian", "explorer", "observer", "strategist", "connector"}


def validate_station(station):
    required = {"id", "number", "title", "status", "coordinates"}
    if not required <= station.keys():
        raise ValueError(f"Missing station fields: {required - station.keys()}")
    if not re.fullmatch(r"[a-z][a-z0-9-]*", station["id"]):
        raise ValueError("Station ID must use lowercase letters, digits and hyphens")
    lat, lon = station["coordinates"]
    if not (
        math.isfinite(lat)
        and math.isfinite(lon)
        and -90 <= lat <= 90
        and -180 <= lon <= 180
    ):
        raise ValueError("Invalid coordinates")
    if not isinstance(station["number"], int) or station["number"] < 1:
        raise ValueError("Station number must be a positive integer")
    if station["status"] not in {"active", "locked"}:
        raise ValueError("Station status must be active or locked")
    if station["status"] == "locked":
        return
    blocks = station.get("blocks", [])
    ids = [b["id"] for b in blocks]
    if not blocks or len(ids) != len(set(ids)):
        raise ValueError(f"Empty or duplicate blocks: {station['id']}")
    for index, block in enumerate(blocks):
        if not re.fullmatch(r"[a-z][a-z0-9-]*", block["id"]):
            raise ValueError("Invalid block ID")
        if block["type"] not in BLOCK_TYPES:
            raise ValueError(f"Unknown block type: {block['type']}")
        if block.get("next_block_id") and block["next_block_id"] not in ids:
            raise ValueError(f"Broken block link: {block['id']}")
        if (
            index < len(blocks) - 1
            and block.get("next_block_id") != blocks[index + 1]["id"]
        ):
            raise ValueError("Blocks must form an ordered path using next_block_id")
        if index == len(blocks) - 1 and block.get("next_block_id"):
            raise ValueError("Final block must finish the station")
        options = block.get("options", [])
        option_ids = [o["id"] for o in options]
        if len(option_ids) != len(set(option_ids)):
            raise ValueError("Duplicate option IDs")
        if (
            block["type"] in {"choice", "profile_choice", "visual_quiz", "checklist"}
            and not options
        ):
            raise ValueError("This block requires options")
        for option in options:
            if not re.fullmatch(r"[a-z][a-z0-9-]*", option["id"]):
                raise ValueError("Invalid option ID")
            for trait, value in option.get("scores", {}).items():
                if (
                    trait not in TRAITS
                    or not isinstance(value, (int, float))
                    or not 0 <= value <= 10
                ):
                    raise ValueError(f"Invalid score: {trait}={value}")
        if block["type"] == "true_false" and not block.get("questions"):
            raise ValueError("Quiz requires questions")


def load_stations():
    stations = []
    for path in sorted(Path(__file__).parent.glob("station_*.py")):
        station = import_module(f"{__name__}.{path.stem}").STATION
        validate_station(station)
        stations.append(station)
    for key in ("id", "number"):
        values = [s[key] for s in stations]
        if len(values) != len(set(values)):
            raise ValueError(f"Duplicate station {key}")
    return sorted(stations, key=lambda s: s["number"])
