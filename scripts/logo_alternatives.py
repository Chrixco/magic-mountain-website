# Alternative Magic Mountain mark: the hexagon and the mountain, drawn in the style of the Kumbre logo
# (bold solid shards separated by straight white cuts of constant width), with every proportion taken from φ.
# Writes SVGs to Final Design/Logo/Alternatives.
# Run: python3 scripts/logo_alternatives.py   (then node scripts/logo-alt-png.mjs for PNGs and the sheet)
import math, os

PHI = (1 + 5 ** 0.5) / 2
FOREST, PAPER, GOLD = '#2e5b3e', '#fdfdfb', '#c8842b'
LIT, SHADE = '#5e8f44', '#3f7e76'          # elevation green and teal

# Flat-top hexagon, like the tiles, in a 100 × 100 box.
R = 48.0
H = R * math.sqrt(3)
W = 2 * R
left, top = 50 - R, 50 - H / 2
hexagon = [(50 + R * math.cos(math.pi / 3 * k), 50 + R * math.sin(math.pi / 3 * k)) for k in range(6)]
pts = lambda ps: ' '.join(f'{x:.2f},{y:.2f}' for x, y in ps)

CUT = W / PHI ** 4                          # width of the ridge cut; the shade cut is CUT / φ

# The ridge: one cut that zigzags across the hexagon and draws the mountain.
base_y = top + H / PHI                      # meets the hexagon's sides at the golden section of its height
peak = (left + W / PHI, top + H / PHI ** 3) # main peak: 1/φ across, 1/φ³ down
rise = base_y - peak[1]
second = (left + W / PHI ** 3, base_y - rise / PHI)       # second peak: 1/φ³ across, φ lower
valley = (left + W / PHI ** 2, base_y - rise / PHI ** 3)  # valley: 1/φ² across, shallow
side = lambda sign: (50 + sign * (R - abs(base_y - 50) / math.sqrt(3)), base_y)  # hexagon side at base height
# carry the cut on past the sides so it leaves the hexagon cleanly
beyond = lambda p, q: (q[0] + (q[0] - p[0]) * 0.5, q[1] + (q[1] - p[1]) * 0.5)
ridge = [beyond(second, side(-1)), second, valley, peak, beyond(peak, side(1))]

# The shade cut: from the peak down to the foot, leaning slightly left (slope 1/φ³), so the shaded face is the larger one.
lean = -1 / PHI ** 3
shade_end = (peak[0] + lean * 80, peak[1] + 80)

# Regions: sky above the ridge, mountain below; the shade cut splits the mountain into a lit and a shaded face.
sky = [(-10, -10), (110, -10), (110, ridge[-1][1]), *reversed(ridge), (-10, ridge[0][1])]
lit = [*ridge[:4], shade_end, (-10, 110), (-10, ridge[0][1])]
shaded = [peak, ridge[4], (110, ridge[4][1]), (110, 110), shade_end]

# Summit: a gold hexagon just above the peak's cut, radius = cut width / φ³.
sr = CUT / PHI ** 3
sc = (peak[0], peak[1] - CUT / 2 - sr * PHI)
summit = [(sc[0] + sr * math.cos(math.pi / 3 * k), sc[1] + sr * math.sin(math.pi / 3 * k)) for k in range(6)]


def mark(sky_c, lit_c, shade_c, summit_c):
    cuts = (f'<polyline points="{pts(ridge)}" fill="none" stroke="{PAPER}" stroke-width="{CUT:.2f}" stroke-linejoin="miter" stroke-miterlimit="10"/>'
            f'<line x1="{peak[0]:.2f}" y1="{peak[1]:.2f}" x2="{shade_end[0]:.2f}" y2="{shade_end[1]:.2f}" stroke="{PAPER}" stroke-width="{CUT / PHI:.2f}"/>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
            f'<defs><clipPath id="hex"><polygon points="{pts(hexagon)}"/></clipPath></defs>'
            f'<g clip-path="url(#hex)">'
            f'<polygon points="{pts(sky)}" fill="{sky_c}"/>'
            f'<polygon points="{pts(lit)}" fill="{lit_c}"/>'
            f'<polygon points="{pts(shaded)}" fill="{shade_c}"/>'
            f'{cuts}'
            f'<polygon points="{pts(summit)}" fill="{summit_c}"/>'
            f'</g></svg>\n')


out = os.path.join(os.path.dirname(__file__), '..', '..', 'Final Design', 'Logo', 'Alternatives')
os.makedirs(out, exist_ok=True)
versions = {
    'Shards': mark(FOREST, LIT, SHADE, GOLD),
    'Shards_Mono': mark(FOREST, FOREST, FOREST, PAPER),
}
for name, s in versions.items():
    open(os.path.join(out, f'MagicMountain_Logo_Alt_{name}.svg'), 'w').write(s)
print('written to', os.path.abspath(out))
