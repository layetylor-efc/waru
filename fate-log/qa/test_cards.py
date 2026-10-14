#!/usr/bin/env python3
"""FATE LOG character-card regression tests, run on localhost with Chromium."""
from __future__ import annotations

import re
import subprocess
import sys
import time
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[2]
PAGE = "http://127.0.0.1:8841/fate-log/"
ASSETS = ROOT / "fate-log" / "assets" / "cards"
NAMES = [
    "01-rei", "02-kagerei", "03-mirai", "04-mobius", "05-chrono",
    "06-kanade", "07-sora", "08-noah", "09-rei-mirai", "10-mobius-kagerei"
]


def run() -> None:
    print("QA: verifying ten local WebP files")
    assert len(list(ASSETS.glob("*.webp"))) == 10
    for stem in NAMES:
        path = ASSETS / (stem + ".webp")
        with Image.open(path) as im:
            assert im.format == "WEBP", f"{stem} not WebP"
            assert im.size == (756, 1008), f"{stem} unexpected dimensions {im.size}"
            im.verify()
        print(" PASS", stem, path.stat().st_size, "bytes")

    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", "8841", "--bind", "127.0.0.1", "--directory", str(ROOT)],
        stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT
    )
    try:
        time.sleep(1.5)
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True, args=["--no-sandbox"])
            desktop = browser.new_context(viewport={"width": 1280, "height": 900})
            page = desktop.new_page()
            page.goto(PAGE, wait_until="domcontentloaded", timeout=30000)

            assert page.locator(".card-tile").count() == 10, "wrong number of cards"
            assert page.locator(".card-image-fallback").count() == 10
            assert page.locator("#characters").inner_text().find("初期構想") >= 0
            assert "上の「初期構想の4人」" in page.locator("#character-cards").inner_text()
            for key in ["v2.09", "v2.08", "v2.07", "白澄レイ", "黒崎ハルト", "橘ミオ", "九条カイト"]:
                assert key in page.locator("body").inner_text(), f"original content lost: {key}"
            ids = page.locator("[id]").evaluate_all("(es)=>es.map(e=>e.id)")
            assert len(ids) == len(set(ids)), "duplicate IDs"
            print(" PASS gallery/legacy content/unique IDs")

            for i in range(10):
                card = page.locator(".card-tile").nth(i)
                preview = card.locator("img")
                card.scroll_into_view_if_needed()
                expect(preview).to_have_js_property("naturalWidth", 756, timeout=12000)
                card.click()
                dialog = page.locator("#card-lightbox")
                expect(dialog).to_be_visible()
                expect(page.locator("#card-lightbox-image")).to_have_js_property("naturalWidth", 756, timeout=10000)
                assert page.locator("#card-lightbox-link").get_attribute("href").endswith(NAMES[i] + ".webp")
                if i % 2 == 0:
                    page.locator("#card-lightbox-close").click()
                else:
                    page.keyboard.press("Escape")
                expect(dialog).not_to_be_visible()
                assert card.evaluate("(el)=>document.activeElement===el"), "focus not restored"
            print(" PASS every card loads, opens, closes, restores focus, download links")

            first = page.locator(".card-tile").first
            first.scroll_into_view_if_needed()
            first.focus()
            page.keyboard.press("Enter")
            expect(page.locator("#card-lightbox")).to_be_visible()
            page.keyboard.press("Escape")
            expect(page.locator("#card-lightbox")).not_to_be_visible()
            print(" PASS keyboard Enter/Escape")

            # Modal image error: UI should never silently show an empty panel.
            first.click()
            page.locator("#card-lightbox-image").evaluate("(im)=>{im.src='/not-a-real-card.webp'}")
            expect(page.locator("#card-lightbox-error")).to_be_visible(timeout=6000)
            page.locator("#card-lightbox-close").click()
            print(" PASS modal image-failure message")

            # Thumbnail failure: tile becomes a visible fallback and anchor still points to full image.
            page.route("**/assets/cards/01-rei.webp", lambda route: route.abort())
            page.reload(wait_until="domcontentloaded")
            bad_card = page.locator(".card-tile").first
            bad_card.scroll_into_view_if_needed()
            expect(bad_card).to_have_class(re.compile("is-image-error"), timeout=6000)
            expect(bad_card.locator(".card-image-fallback")).to_be_visible()
            print(" PASS thumbnail image-failure fallback")
            desktop.close()

            for width, expected_columns in [
                (320, 2), (375, 2), (430, 2), (560, 2), (768, 3), (1280, 5)
            ]:
                context = browser.new_context(
                    viewport={"width": width, "height": 844 if width <= 560 else 960},
                    device_scale_factor=2,
                    is_mobile=width <= 560,
                    has_touch=width <= 560
                )
                p = context.new_page()
                p.goto(PAGE, wait_until="domcontentloaded", timeout=30000)
                info = p.evaluate("""() => {
                  const gallery=document.querySelector('.card-gallery');
                  const cols=getComputedStyle(gallery).gridTemplateColumns.split(' ').length;
                  return {cols, pageWidth:document.documentElement.scrollWidth, viewWidth:innerWidth};
                }""")
                assert info["cols"] == expected_columns, f"{width}px grid {info}"
                assert info["pageWidth"] <= info["viewWidth"] + 1, f"{width}px horizontal overflow {info}"
                target = p.locator(".card-tile").first
                target.scroll_into_view_if_needed()
                expect(target.locator("img")).to_have_js_property("naturalWidth", 756, timeout=10000)
                target.click()
                expect(p.locator("#card-lightbox")).to_be_visible()
                dialog_rect = p.locator("#card-lightbox").bounding_box()
                assert dialog_rect and dialog_rect["x"] >= -1, f"{width}px dialog off left"
                assert dialog_rect["x"] + dialog_rect["width"] <= width + 1, f"{width}px dialog off right"
                p.locator("#card-lightbox-close").click()
                expect(p.locator("#card-lightbox")).not_to_be_visible()
                print(f" PASS viewport={width}px grid={expected_columns}, no overflow, modal works")
                context.close()

            no_js = browser.new_context(java_script_enabled=False, viewport={"width": 390, "height": 844})
            no_js_page = no_js.new_page()
            no_js_page.goto(PAGE, wait_until="domcontentloaded", timeout=30000)
            assert no_js_page.locator(".card-tile").count() == 10
            assert no_js_page.locator(".card-tile").first.get_attribute("href").endswith("01-rei.webp")
            print(" PASS no-JS image links retained")
            no_js.close()

            browser.close()
        print("ALL FATE LOG CARD QA CHECKS PASSED")
    finally:
        server.terminate()
        server.wait(timeout=10)


if __name__ == "__main__":
    run()
