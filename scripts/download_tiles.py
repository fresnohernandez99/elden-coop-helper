#!/usr/bin/env python3
"""Downloads the map tiles into public/map-tiles so the site works without Game8.

Usage:
    python3 scripts/download_tiles.py [max_zoom]

Then set in .env: TILE_URL=/map-tiles/{map}/{z}_{x}_{y}.jpg
"""
import json
import os
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://assets.game8.co/tools/map/{map}/{z}_{x}_{y}.jpg"


def tiles(map_dir, max_zoom):
    # In CRS.Simple the map tiles have x in [0, 2^z) and y in [-2^z, 0).
    for z in range(max_zoom + 1):
        n = 2 ** z
        for x in range(n):
            for y in range(-n, 0):
                yield map_dir, z, x, y


def download(job):
    map_dir, z, x, y = job
    path = os.path.join(ROOT, "public", "map-tiles", map_dir, f"{z}_{x}_{y}.jpg")
    if os.path.exists(path):
        return "skipped"
    try:
        req = urllib.request.Request(
            BASE.format(map=map_dir, z=z, x=x, y=y),
            headers={"User-Agent": "Mozilla/5.0"},
        )
        with urllib.request.urlopen(req, timeout=30) as res:
            data = res.read()
    except urllib.error.HTTPError:
        return "missing"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)
    return "ok"


def main():
    with open(os.path.join(ROOT, "public", "data", "pins.json"), encoding="utf-8") as f:
        meta = json.load(f)
    max_zoom = int(sys.argv[1]) if len(sys.argv) > 1 else meta["maxZoom"]
    jobs = [t for m in meta["maps"] for t in tiles(m["dir"], max_zoom)]
    counts = {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        for i, result in enumerate(pool.map(download, jobs), 1):
            counts[result] = counts.get(result, 0) + 1
            if i % 200 == 0:
                print(f"{i}/{len(jobs)}", counts)
    print("done", counts)


if __name__ == "__main__":
    main()
