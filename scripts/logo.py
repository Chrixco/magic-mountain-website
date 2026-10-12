# Magic Mountain logo mark, built on golden-ratio geometry. Writes the SVG mark, a construction sheet,
# and the website favicon. Run: python3 scripts/logo.py
import math, os
PHI = (1 + 5 ** 0.5) / 2
FOREST, PAPER, SNOW, GOLD, INK = '#2e5b3e', '#fdfdfb', '#d6e1e8', '#c8842b', '#5b3a24'

# Flat-top hexagon, like the game tiles, in a 100 × 100 box.
R = 48.0
H = R * math.sqrt(3)                      # hexagon height
top, bottom = 50 - H / 2, 50 + H / 2
hexagon = [(50 + R * math.cos(math.pi / 3 * k), 50 + R * math.sin(math.pi / 3 * k)) for k in range(6)]

# The mountain in golden ratio to the hexagon:
#   width  = hexagon width ÷ φ, centred
#   height = mountain width ÷ φ (its outline is a golden rectangle)
#   base   = at the golden section of the hexagon's height (61.8% down)
W = 2 * R
B = W / PHI
x0, x1 = 50 - B / 2, 50 + B / 2
yb = top + H / PHI

main_h = B / PHI                           # main peak: height = mountain width / φ
main = (x0 + B / PHI, yb - main_h)         # … standing at the golden section of the base
second_h = main_h / PHI                    # second peak: φ smaller, at 1/φ³ of the base
second = (x0 + B / PHI ** 3, yb - second_h)
valley = (x0 + B / PHI ** 2, yb - main_h / PHI ** 3)   # valley at 1/φ², low by 1/φ³
ridge_foot = (main[0] + (x1 - main[0]) / PHI ** 2, yb)  # shaded face splits the right slope at 1/φ²

# Summit: a small gold hexagon above the peak, radius = peak height / φ⁵.
sr = main_h / PHI ** 5
summit_c = (main[0], main[1] - sr * PHI ** 2)
summit = [(summit_c[0] + sr * math.cos(math.pi / 3 * k), summit_c[1] + sr * math.sin(math.pi / 3 * k)) for k in range(6)]

pts = lambda ps: ' '.join(f'{x:.2f},{y:.2f}' for x, y in ps)
mountain = [(x0, yb), second, valley, main, (x1, yb)]
shade = [main, (x1, yb), ridge_foot]

def mark(size=None):
    wh = f' width="{size}" height="{size}"' if size else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"{wh}>'
            f'<polygon points="{pts(hexagon)}" fill="{FOREST}"/>'
            f'<polygon points="{pts(mountain)}" fill="{PAPER}"/>'
            f'<polygon points="{pts(shade)}" fill="{SNOW}"/>'
            f'<polygon points="{pts(summit)}" fill="{GOLD}"/>'
            '</svg>\n')

def construction():
    g = []
    line = lambda a, b, dash=True: g.append(f'<line x1="{a[0]:.2f}" y1="{a[1]:.2f}" x2="{b[0]:.2f}" y2="{b[1]:.2f}" stroke="{GOLD}" stroke-width=".35"{" stroke-dasharray=\"1.2 1\"" if dash else ""}/>')
    label = lambda x, y, t, anchor='start': g.append(f'<text x="{x:.2f}" y="{y:.2f}" font-size="2.6" fill="{INK}" font-family="Helvetica, Arial" text-anchor="{anchor}">{t}</text>')
    # horizontal guides
    line((0, yb), (100, yb)); label(101, yb + 1, 'base: golden section, 61.8%')
    line((0, main[1]), (100, main[1])); label(101, main[1] + 1, 'mountain height = width ÷ φ')
    line((0, second[1]), (100, second[1])); label(101, second[1] + 1, 'second peak: peak ÷ φ')
    # vertical guides
    for x, t in [(main[0], '1/φ'), (valley[0], '1/φ²'), (second[0], '1/φ³')]:
        line((x, top - 4), (x, bottom + 4)); label(x, bottom + 8, t, 'middle')
    line((x0, bottom + 12), (x1, bottom + 12), False); label(50, bottom + 16, 'mountain width = hexagon width ÷ φ', 'middle')
    line((2, bottom + 20), (98, bottom + 20), False); label(50, bottom + 24, 'hexagon width', 'middle')
    for x in (x0, x1): line((x, yb), (x, bottom + 12))
    line((-3, top), (-3, bottom), False); line((-3, yb), (-1, yb), False)
    label(-4, (top + yb) / 2, '1/φ', 'end'); label(-4, (yb + bottom) / 2, '1/φ²', 'end')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-14 -4 160 136" width="1600" height="1360">'
            f'<rect x="-14" y="-4" width="160" height="136" fill="#fff"/>'
            + mark().replace('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">', '<g>').replace('</svg>\n', '</g>')
            + ''.join(g) + '</svg>\n')

out = os.path.join(os.path.dirname(__file__), '..', '..', 'Final Design', 'Logo')
open(os.path.join(out, 'MagicMountain_Logo_Mark.svg'), 'w').write(mark())
open(os.path.join(out, 'MagicMountain_Logo_Construction.svg'), 'w').write(construction())
open(os.path.join(os.path.dirname(__file__), '..', 'public', 'favicon.svg'), 'w').write(mark())
print('base', round(yb, 2), 'B', round(B, 2), 'main', [round(v, 2) for v in main], 'second', [round(v, 2) for v in second], 'valley', [round(v, 2) for v in valley])
print('mountain', pts(mountain)); print('shade', pts(shade)); print('summit', pts(summit))
