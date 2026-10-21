#!/usr/bin/env python3
"""Converts the Game8 map JSON into public/data/pins.json and downloads the icons.

Usage:
    python3 scripts/build_pins.py [path/to/json]

Without an argument it downloads the JSON straight from Game8.
"""
import hashlib
import json
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_URL = "https://game8.co/api/tool_structural_mappings/233.json"
HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Referer": "https://game8.co/games/Elden-Ring/archives/368933",
    "X-Requested-With": "XMLHttpRequest",
}
# Popup images go through the /game8-img proxy (next.config.ts) so the browser caches them.
IMAGE_PROXIES = {
    "https://img.game8.jp/": "game8-img/jp/",
    "https://img.game8.co/": "game8-img/co/",
}


def fetch(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as res:
        return res.read()


def to_latlng(coordinate):
    # Game8 uses "lat,lng" in a 0..256 space, the same as a map with 256px tiles.
    if not coordinate:
        return None
    return [float(v) for v in coordinate.split(",")]


def to_image_path(url):
    for host, proxy_path in IMAGE_PROXIES.items():
        if url and url.startswith(host):
            return proxy_path + url[len(host):]
    return url or ""


def download_icon(url, icons_dir):
    name = hashlib.sha1(url.encode()).hexdigest()[:12] + ".png"
    path = os.path.join(icons_dir, name)
    if not os.path.exists(path):
        with open(path, "wb") as f:
            f.write(fetch(url))
    return "icons/" + name


def main():
    if len(sys.argv) > 1:
        with open(sys.argv[1], encoding="utf-8") as f:
            source = json.load(f)
    else:
        source = json.loads(fetch(SOURCE_URL))

    icons_dir = os.path.join(ROOT, "public", "icons")
    os.makedirs(icons_dir, exist_ok=True)
    icons = {}

    pins = []
    for c in source["coordinateArraySchema"]["coordinates"]:
        icon_url = c.get("pinIcon")
        if icon_url and icon_url not in icons:
            icons[icon_url] = download_icon(icon_url, icons_dir)
        pins.append({
            "id": c["id"],
            "title": c["title"],
            "description": c.get("description") or "",
            "url": c.get("url") or "",
            "area": c.get("area") or "",
            "category": c["classification"],
            "region": c.get("regionKey") or "",
            "subtype": c.get("bosstypeKey") or c.get("npctypeKey") or "",
            "icon": icons.get(icon_url, ""),
            "image": to_image_path(c.get("popupImage")),
            "latlng": to_latlng(c.get("coordinate")),
        })

    maps = [
        {"title": m["title"], "dir": m["mapDirectoryName"]}
        for m in source["tileMaps"]
    ]
    out = {"maxZoom": source.get("maxZoom", 5), "maps": maps, "pins": pins}

    os.makedirs(os.path.join(ROOT, "public", "data"), exist_ok=True)
    with open(os.path.join(ROOT, "public", "data", "pins.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(pins)} pins, {len(icons)} icons, {len(maps)} maps")


if __name__ == "__main__":
    main()
