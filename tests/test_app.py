from copy import deepcopy

import pytest
from fastapi.testclient import TestClient

from app.main import STATIONS, app
from app.stations import validate_station

client = TestClient(app)


def test_route_and_assets():
    assert client.get("/healthz").json()["status"] == "ok"
    assert client.get("/").status_code == 200
    route = client.get("/api/route").json()
    assert [s["number"] for s in route["stations"] if s["status"] == "active"] == [
        1,
        3,
        5,
        8,
        10,
    ]
    assert "const VERSION" in client.get("/sw.js").text
    for path in (
        "app.js",
        "core.js",
        "styles.css",
        "manifest.json",
        "media/landscape.svg",
    ):
        assert client.get("/static/" + path).status_code == 200


def test_duplicate_block_rejected():
    station = deepcopy(STATIONS[0])
    station["blocks"].append(station["blocks"][0])
    with pytest.raises(ValueError):
        validate_station(station)


def test_broken_transition_rejected():
    station = deepcopy(STATIONS[0])
    station["blocks"][0]["next_block_id"] = "missing"
    with pytest.raises(ValueError):
        validate_station(station)


def test_bad_profile_scores_rejected():
    station = deepcopy(STATIONS[0])
    station["blocks"][0]["options"][0]["scores"] = {"invented": 100}
    with pytest.raises(ValueError):
        validate_station(station)


def test_future_station_uses_same_contract():
    station = deepcopy(STATIONS[4])
    station["id"] = "future-station"
    station["number"] = 11
    validate_station(station)
