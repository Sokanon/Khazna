#!/usr/bin/env bash
# Regenerates the installed-app icons and iOS launch screens from public/logo-only.svg.
# Needs rsvg-convert and ImageMagick (brew install librsvg imagemagick).
set -euo pipefail

cd "$(dirname "$0")/.."

TILE="#18181b"
LIGHT_BG="#ffffff"
DARK_BG="#080808"
OUT="public/pwa"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$OUT/splash"

# The mark's paths, recoloured, as a nested <svg> sized and centred on a square or portrait canvas.
mark() {
	local color="$1" canvas_w="$2" canvas_h="$3" mark_w="$4"
	local mark_h x y
	mark_h=$(echo "$mark_w * 560 / 615" | bc -l)
	x=$(echo "($canvas_w - $mark_w) / 2" | bc -l)
	y=$(echo "($canvas_h - $mark_h) / 2" | bc -l)
	echo "<svg x=\"$x\" y=\"$y\" width=\"$mark_w\" height=\"$mark_h\" viewBox=\"0 0 615 560\">"
	sed -e '1d' -e '$d' -e "s/fill=\"white\"/fill=\"$color\"/g" public/logo-only.svg
	echo "</svg>"
}

render() {
	local svg="$1" out="$2" w="$3" h="$4"
	echo "$svg" >"$TMP/in.svg"
	rsvg-convert -w "$w" -h "$h" "$TMP/in.svg" -o "$TMP/out.png"
	# Strip timestamps so an unchanged image keeps the same bytes.
	magick "$TMP/out.png" -strip -define png:exclude-chunks=date,time "$out"
}

# "any" icons: a rounded tile that looks right wherever it is shown as is.
for size in 192 512; do
	render "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"512\" height=\"512\" viewBox=\"0 0 512 512\">
		<rect width=\"512\" height=\"512\" rx=\"112\" fill=\"$TILE\"/>$(mark white 512 512 340)</svg>" \
		"public/android-chrome-${size}x${size}.png" "$size" "$size"
done

# Maskable icons: full bleed, the mark inside the central safe circle.
for size in 192 512; do
	render "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"512\" height=\"512\" viewBox=\"0 0 512 512\">
		<rect width=\"512\" height=\"512\" fill=\"$TILE\"/>$(mark white 512 512 280)</svg>" \
		"$OUT/maskable-${size}x${size}.png" "$size" "$size"
done

# iOS rounds the corners itself, so the touch icon is full bleed.
render "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"180\" height=\"180\" viewBox=\"0 0 180 180\">
	<rect width=\"180\" height=\"180\" fill=\"$TILE\"/>$(mark white 180 180 118)</svg>" \
	"public/apple-touch-icon.png" 180 180

# Shortcut icons, drawn with the same Lucide glyphs the navbar uses.
shortcut() {
	local name="$1" glyph="$2"
	render "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"96\" height=\"96\" viewBox=\"0 0 96 96\">
		<rect width=\"96\" height=\"96\" rx=\"21\" fill=\"$TILE\"/>
		<g transform=\"translate(24 24) scale(2)\" fill=\"none\" stroke=\"white\" stroke-width=\"2\"
			stroke-linecap=\"round\" stroke-linejoin=\"round\">$glyph</g></svg>" \
		"$OUT/shortcut-$name.png" 96 96
}
shortcut logos '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>'
shortcut apps '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>'

# iOS launch screens: every current iPhone in portrait, light and dark.
# Keep in step with the apple-touch-startup-image links in index.html.
while read -r w h r; do
	pw=$((w * r))
	ph=$((h * r))
	render "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"$pw\" height=\"$ph\" viewBox=\"0 0 $pw $ph\">
		<rect width=\"$pw\" height=\"$ph\" fill=\"$LIGHT_BG\"/>$(mark "$TILE" "$pw" "$ph" $((pw * 36 / 100)))</svg>" \
		"$OUT/splash/launch-${pw}x${ph}-light.png" "$pw" "$ph"
	render "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"$pw\" height=\"$ph\" viewBox=\"0 0 $pw $ph\">
		<rect width=\"$pw\" height=\"$ph\" fill=\"$DARK_BG\"/>$(mark white "$pw" "$ph" $((pw * 36 / 100)))</svg>" \
		"$OUT/splash/launch-${pw}x${ph}-dark.png" "$pw" "$ph"
done <<'DEVICES'
440 956 3
420 912 3
402 874 3
430 932 3
393 852 3
390 844 3
428 926 3
375 812 3
414 896 3
414 896 2
375 667 2
414 736 3
DEVICES
