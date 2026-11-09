#!/bin/sh
# Renders public/icons/*.png: the Fraktur nameplate "R" (UnifrakturMaguntia) over a rule, black on white.
# Needs ImageMagick 7 (`magick`) and `npm install` (the font comes from @fontsource/unifrakturmaguntia).
set -e
FONT=node_modules/@fontsource/unifrakturmaguntia/files/unifrakturmaguntia-latin-400-normal.woff
OUT=public/icons
TMP=$(mktemp -d)

# icon SIZE GLYPH_WIDTH OUTFILE — glyph scaled to GLYPH_WIDTH of a 512 canvas, rule underneath, then resized.
icon() {
  magick -background none -fill black -font "$FONT" -pointsize 600 label:R -trim +repage \
    -resize "$2x" "$TMP/glyph.png"
  GH=$(magick identify -format %h "$TMP/glyph.png")
  RULE_W=$2; RULE_H=$(( $2 / 14 )); GAP=$(( $2 / 9 ))
  TOTAL=$(( GH + GAP + RULE_H ))
  TOP=$(( (512 - TOTAL) / 2 ))
  RX=$(( (512 - RULE_W) / 2 )); RY=$(( TOP + GH + GAP ))
  magick -size 512x512 xc:white \
    "$TMP/glyph.png" -gravity north -geometry +0+$TOP -composite \
    -gravity northwest -fill black -draw "rectangle $RX,$RY $(( RX + RULE_W )),$(( RY + RULE_H ))" \
    -resize "$1x$1" -strip "$OUT/$3"
}

icon 512 290 icon-512.png
icon 192 290 icon-192.png
icon 180 290 apple-touch-icon.png
icon 512 220 icon-maskable-512.png   # stays inside the maskable safe zone (inner 80% circle)
icon 32 340 favicon-32.png           # larger at 32 px so the glyph still reads
rm -rf "$TMP"
echo "icons written to $OUT"
