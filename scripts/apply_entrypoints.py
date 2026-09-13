#!/usr/bin/env python3
"""One-time entrypoint cleanup after overlaying the universal Studio files."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Existing demos already link to /cafe/studio.html. Point them directly at the
# universal Studio while preserving the compatibility redirect for old URLs.
for slug in ("cafe", "florist", "barber", "fitness", "trades"):
    path = ROOT / slug / "index.html"
    if not path.exists():
        continue
    text = path.read_text(encoding="utf-8")
    text = text.replace('/cafe/studio.html', f'/studio/?template={slug}')
    path.write_text(text, encoding="utf-8")

# Rebrand the current root Cafe Studio CTA into the universal Studio CTA
# without rewriting the rest of the generated landing page.
index = ROOT / "index.html"
if index.exists():
    text = index.read_text(encoding="utf-8")
    replacements = {
        'href="/cafe/studio.html#auth"': 'href="/studio/"',
        'Build your real cafe here.': 'Build any Nightshift template here.',
        '<h3>Cafe Studio</h3>': '<h3>Nightshift Studio</h3>',
        'Sign in and launch your own cafe site — save drafts, publish, manage everything from one studio.':
            'Choose any template, edit it live, save drafts, and publish from one universal studio.',
        '<span class="card-swatch-pill">Your content, not a demo</span>':
            '<span class="card-swatch-pill">All 5 templates editable</span>',
        '<a class="go" href="/cafe/studio.html" style="color:#fbbf24">Open Studio <span>→</span></a>':
            '<a class="go" href="/studio/?template=cafe" style="color:#fbbf24">Customize <span>→</span></a>',
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    index.write_text(text, encoding="utf-8")
