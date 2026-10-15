# 집 바닥·벽·기둥·정원 조각 프롬프트

조각마다 이미지 1에 `guides/<id>.png`(크기·구역 기준), 이미지 2에 지금 쓰는 가구 그림 하나(스타일 기준, 예: `images/furniture/display_pedestal.png`)를 붙이고 아래 프롬프트를 넣는다. 파일 이름은 `<id>.png`.

모든 조각은 정면 또는 위에서 내려다본 평평한 그림이다. 게임 각도로 기울이는 일은 코드가 한다. 비스듬하게 그려 오면 쓸 수 없다.
분홍(자홍) 막대가 있는 변은 이어 붙이는 변이라 끊김 없이 이어져야 한다. 크기가 조금 달라도 괜찮지만 가로세로 비율은 지켜야 한다.

## floor_slab_a (실내 바닥 돌판 1, 2×2칸)

```
Image 1 is a LAYOUT GUIDE only: a sheet of the exact output size. Grey lines are cell boundaries for scale.
Image 2 is STYLE ONLY: delicate irregular charcoal-brown ink contour, softly textured watercolor and gouache, cream ivory marble with faint lavender and pale gold veins, pale gold, sage green, dusty blue, muted lavender, tasteful antique Greek details. Match the line weight and paint texture of image 2.
Draw it perfectly FLAT and straight-on: no perspective, no isometric angle, no vanishing point, no depth, no cast shadows. Lighting is soft and even across the whole piece (the game adds shading later).
Seen from directly above. One single square polished cream marble floor slab filling the whole canvas. The pink border on the guide is a narrow beveled edge about 28 px wide with a thin darker grout line at the very outside, the same on all four sides. Inside, soft cream marble with gentle watercolor mottling and a few faint lavender veins running diagonally. Keep it calm and low contrast so furniture reads clearly on top.
Output: one 1024x1024 PNG, fully opaque, the artwork fills the entire canvas edge to edge. Remove the guide grid, colors and magenta bars completely. No text, letters, numbers, people, animals or sparkles.
```

## floor_slab_b (실내 바닥 돌판 2, 2×2칸)

```
Image 1 is a LAYOUT GUIDE only: a sheet of the exact output size. Grey lines are cell boundaries for scale.
Image 2 is STYLE ONLY: delicate irregular charcoal-brown ink contour, softly textured watercolor and gouache, cream ivory marble with faint lavender and pale gold veins, pale gold, sage green, dusty blue, muted lavender, tasteful antique Greek details. Match the line weight and paint texture of image 2.
Draw it perfectly FLAT and straight-on: no perspective, no isometric angle, no vanishing point, no depth, no cast shadows. Lighting is soft and even across the whole piece (the game adds shading later).
Seen from directly above. One single square polished cream marble floor slab filling the whole canvas. The pink border on the guide is a narrow beveled edge about 28 px wide with a thin darker grout line at the very outside, the same on all four sides. Inside, soft cream marble with gentle watercolor mottling and faint pale gold veins and a slightly warmer tone. Keep it calm and low contrast so furniture reads clearly on top.
Output: one 1024x1024 PNG, fully opaque, the artwork fills the entire canvas edge to edge. Remove the guide grid, colors and magenta bars completely. No text, letters, numbers, people, animals or sparkles.
```

## floor_slab_c (실내 바닥 돌판 3, 2×2칸)

```
Image 1 is a LAYOUT GUIDE only: a sheet of the exact output size. Grey lines are cell boundaries for scale.
Image 2 is STYLE ONLY: delicate irregular charcoal-brown ink contour, softly textured watercolor and gouache, cream ivory marble with faint lavender and pale gold veins, pale gold, sage green, dusty blue, muted lavender, tasteful antique Greek details. Match the line weight and paint texture of image 2.
Draw it perfectly FLAT and straight-on: no perspective, no isometric angle, no vanishing point, no depth, no cast shadows. Lighting is soft and even across the whole piece (the game adds shading later).
Seen from directly above. One single square polished cream marble floor slab filling the whole canvas. The pink border on the guide is a narrow beveled edge about 28 px wide with a thin darker grout line at the very outside, the same on all four sides. Inside, soft cream marble with gentle watercolor mottling and very faint dusty blue clouding, almost plain. Keep it calm and low contrast so furniture reads clearly on top.
Output: one 1024x1024 PNG, fully opaque, the artwork fills the entire canvas edge to edge. Remove the guide grid, colors and magenta bars completely. No text, letters, numbers, people, animals or sparkles.
```

## wall_section (실내 벽 4칸 폭 × 6칸 높이)

```
Image 1 is a LAYOUT GUIDE only: a sheet of the exact output size. Grey lines are cell boundaries for scale. Bands from top to bottom: gold = thin cream marble top molding (0-56 px); blue = a frieze band with a continuous pale gold running-wave (Vitruvian scroll) pattern on cream (56-256 px), the wave repeats exactly 4 times across the width; grey = plain wall (256-1408 px); green = low marble skirting board (1408-1536 px).
The magenta bars on the left and right edges mean the piece must tile horizontally WITHOUT A VISIBLE SEAM: everything that touches the left edge must continue exactly from the right edge.
Image 2 is STYLE ONLY: delicate irregular charcoal-brown ink contour, softly textured watercolor and gouache, cream ivory marble with faint lavender and pale gold veins, pale gold, sage green, dusty blue, muted lavender, tasteful antique Greek details. Match the line weight and paint texture of image 2.
Draw it perfectly FLAT and straight-on: no perspective, no isometric angle, no vanishing point, no depth, no cast shadows. Lighting is soft and even across the whole piece (the game adds shading later).
Seen straight from the front. An interior wall of a small Greek marble house: top molding, gold wave frieze, then a large plain wall of soft cream plaster with faint lavender and blue watercolor patches, then a simple marble skirting at the bottom. All bands are perfectly horizontal and run the full width.
Output: one 1024x1536 PNG, fully opaque, the artwork fills the entire canvas edge to edge. Remove the guide grid, colors and magenta bars completely. No text, letters, numbers, people, animals or sparkles.
```

## pillar_capital (기둥 머리, 1칸)

```
Image 1 is a LAYOUT GUIDE only: a sheet of the exact output size. Grey lines are cell boundaries for scale.
Image 2 is STYLE ONLY: delicate irregular charcoal-brown ink contour, softly textured watercolor and gouache, cream ivory marble with faint lavender and pale gold veins, pale gold, sage green, dusty blue, muted lavender, tasteful antique Greek details. Match the line weight and paint texture of image 2.
Draw it perfectly FLAT and straight-on: no perspective, no isometric angle, no vanishing point, no depth, no cast shadows. Lighting is soft and even across the whole piece (the game adds shading later).
The piece is one section of a square marble pilaster seen straight from the front, filling the full canvas width edge to edge with perfectly straight vertical sides (the pilaster is exactly as wide as the canvas). This is the TOP section: a simple Ionic-style capital with a flat square top slab, a small pale gold band and tiny volute hints. The bottom edge must join the shaft below (cream fluted marble).
Output: one 512x512 PNG, fully opaque, the artwork fills the entire canvas edge to edge. Remove the guide grid, colors and magenta bars completely. No text, letters, numbers, people, animals or sparkles.
```

## pillar_shaft (기둥 몸통, 이어 붙임)

```
Image 1 is a LAYOUT GUIDE only: a sheet of the exact output size. Grey lines are cell boundaries for scale.
The magenta bars on the top and bottom edges mean the piece must tile vertically WITHOUT A VISIBLE SEAM.
Image 2 is STYLE ONLY: delicate irregular charcoal-brown ink contour, softly textured watercolor and gouache, cream ivory marble with faint lavender and pale gold veins, pale gold, sage green, dusty blue, muted lavender, tasteful antique Greek details. Match the line weight and paint texture of image 2.
Draw it perfectly FLAT and straight-on: no perspective, no isometric angle, no vanishing point, no depth, no cast shadows. Lighting is soft and even across the whole piece (the game adds shading later).
The piece is one section of a square marble pilaster seen straight from the front, filling the full canvas width edge to edge with perfectly straight vertical sides (the pilaster is exactly as wide as the canvas). This is the MIDDLE shaft that repeats vertically: cream marble with 3 to 4 shallow vertical flutes and a thin pale gold inset line near each side.
Output: one 512x1024 PNG, fully opaque, the artwork fills the entire canvas edge to edge. Remove the guide grid, colors and magenta bars completely. No text, letters, numbers, people, animals or sparkles.
```

## pillar_base (기둥 밑동, 1칸)

```
Image 1 is a LAYOUT GUIDE only: a sheet of the exact output size. Grey lines are cell boundaries for scale.
Image 2 is STYLE ONLY: delicate irregular charcoal-brown ink contour, softly textured watercolor and gouache, cream ivory marble with faint lavender and pale gold veins, pale gold, sage green, dusty blue, muted lavender, tasteful antique Greek details. Match the line weight and paint texture of image 2.
Draw it perfectly FLAT and straight-on: no perspective, no isometric angle, no vanishing point, no depth, no cast shadows. Lighting is soft and even across the whole piece (the game adds shading later).
The piece is one section of a square marble pilaster seen straight from the front, filling the full canvas width edge to edge with perfectly straight vertical sides (the pilaster is exactly as wide as the canvas). This is the BOTTOM section: a stepped marble base with two simple moldings. The top edge must join the shaft above (cream fluted marble).
Output: one 512x512 PNG, fully opaque, the artwork fills the entire canvas edge to edge. Remove the guide grid, colors and magenta bars completely. No text, letters, numbers, people, animals or sparkles.
```

## floor_edge (실내 바닥 앞쪽 두께(턱), 4칸 폭 × 1칸 높이)

```
Image 1 is a LAYOUT GUIDE only: a sheet of the exact output size. Grey lines are cell boundaries for scale. The pink vertical stripe at x=1024 marks the joint between two large stone blocks.
The magenta bars on the left and right edges mean the piece must tile horizontally WITHOUT A VISIBLE SEAM: everything that touches the left edge must continue exactly from the right edge.
Image 2 is STYLE ONLY: delicate irregular charcoal-brown ink contour, softly textured watercolor and gouache, cream ivory marble with faint lavender and pale gold veins, pale gold, sage green, dusty blue, muted lavender, tasteful antique Greek details. Match the line weight and paint texture of image 2.
Draw it perfectly FLAT and straight-on: no perspective, no isometric angle, no vanishing point, no depth, no cast shadows. Lighting is soft and even across the whole piece (the game adds shading later).
Seen straight from the front. The visible front side of the raised marble floor platform: two large rectangular cream marble blocks side by side, each 1024 px wide, with a thin grout joint between them and at the edges, a slightly rounded top edge, faint watercolor mottling.
Output: one 2048x512 PNG, fully opaque, the artwork fills the entire canvas edge to edge. Remove the guide grid, colors and magenta bars completely. No text, letters, numbers, people, animals or sparkles.
```

## grass (정원 잔디, 2×2칸)

```
Image 1 is a LAYOUT GUIDE only: a sheet of the exact output size. Grey lines are cell boundaries for scale.
The magenta bars on the left and right edges mean the piece must tile horizontally WITHOUT A VISIBLE SEAM: everything that touches the left edge must continue exactly from the right edge.
The magenta bars on the top and bottom edges mean the piece must tile vertically WITHOUT A VISIBLE SEAM.
Image 2 is STYLE ONLY: delicate irregular charcoal-brown ink contour, softly textured watercolor and gouache, cream ivory marble with faint lavender and pale gold veins, pale gold, sage green, dusty blue, muted lavender, tasteful antique Greek details. Match the line weight and paint texture of image 2.
Draw it perfectly FLAT and straight-on: no perspective, no isometric angle, no vanishing point, no depth, no cast shadows. Lighting is soft and even across the whole piece (the game adds shading later).
Seen from directly above. Soft sage-green lawn painted in watercolor with tiny clover patches, a few tiny white and pale lavender flowers sprinkled sparsely and evenly, no paths, no stones, no large features. Calm, even, low contrast so furniture reads clearly on top.
Output: one 1024x1024 PNG, fully opaque, the artwork fills the entire canvas edge to edge. Remove the guide grid, colors and magenta bars completely. No text, letters, numbers, people, animals or sparkles.
```

## garden_edge (정원 땅 앞쪽 두께, 4칸 폭 × 1칸 높이)

```
Image 1 is a LAYOUT GUIDE only: a sheet of the exact output size. Grey lines are cell boundaries for scale. The green band at the top (0-72 px) is a thin grass lip hanging over the edge.
The magenta bars on the left and right edges mean the piece must tile horizontally WITHOUT A VISIBLE SEAM: everything that touches the left edge must continue exactly from the right edge.
Image 2 is STYLE ONLY: delicate irregular charcoal-brown ink contour, softly textured watercolor and gouache, cream ivory marble with faint lavender and pale gold veins, pale gold, sage green, dusty blue, muted lavender, tasteful antique Greek details. Match the line weight and paint texture of image 2.
Draw it perfectly FLAT and straight-on: no perspective, no isometric angle, no vanishing point, no depth, no cast shadows. Lighting is soft and even across the whole piece (the game adds shading later).
Seen straight from the front. The cut side of a raised garden bed: a thin grass lip on top, then warm earthy soil layers with a few small pebbles and roots, finished with a low row of cream stone blocks along the bottom.
Output: one 2048x512 PNG, fully opaque, the artwork fills the entire canvas edge to edge. Remove the guide grid, colors and magenta bars completely. No text, letters, numbers, people, animals or sparkles.
```

## garden_fence (정원 울타리, 4칸 폭 × 2칸 높이)

```
Image 1 is a LAYOUT GUIDE only: a sheet of the exact output size. Grey lines are cell boundaries for scale. Gold bands = the top rail (y 200-260) and the bottom plinth (bottom 140 px). Blue = two square posts centered at x=512 and x=1536.
The magenta bars on the left and right edges mean the piece must tile horizontally WITHOUT A VISIBLE SEAM: everything that touches the left edge must continue exactly from the right edge.
Image 2 is STYLE ONLY: delicate irregular charcoal-brown ink contour, softly textured watercolor and gouache, cream ivory marble with faint lavender and pale gold veins, pale gold, sage green, dusty blue, muted lavender, tasteful antique Greek details. Match the line weight and paint texture of image 2.
Draw it perfectly FLAT and straight-on: no perspective, no isometric angle, no vanishing point, no depth, no cast shadows. Lighting is soft and even across the whole piece (the game adds shading later).
Seen straight from the front. A low cream marble balustrade fence for a Greek garden: top rail and bottom plinth running the full width, two square posts with small gold caps, small turned balusters between them, a little laurel vine winding along the top rail.
Output: one 2048x1024 PNG, fully transparent background around the object. Remove the guide grid, colors and magenta bars completely. No text, letters, numbers, people, animals or sparkles.
```

## resume_card (스도쿠 '이어서 풀기' 카드, 가로로 늘려 씀)

```
Image 1 is a LAYOUT GUIDE only: a sheet of the exact output size. Gold = a wooden frame border about 40 px thick on all four sides. Blue = the left end area (0-240 px) where the only decoration sits. The rest of the inside must stay completely plain so it can be stretched horizontally and text can sit on it.
Image 2 is STYLE ONLY: delicate irregular charcoal-brown ink contour, softly textured watercolor and gouache, cream ivory, pale gold, sage green, dusty blue, muted lavender, tasteful antique Greek details. Match the line weight and paint texture of image 2.
Draw it perfectly FLAT and straight-on: no perspective, no isometric angle, no vanishing point, no depth, no cast shadow outside the object. Soft even light.
Seen straight from the front. One horizontal ancient Greek writing tablet: a warm honey-colored wooden frame with tiny pale gold corner caps, the inner surface smooth pale lavender-cream wax. At the left end only: a slim bronze stylus lying vertically and a short sage-green ribbon bookmark hanging down over the frame. The frame edges are straight and even along the top and bottom so the middle can be stretched.
Output: one 1536x384 PNG with a fully transparent background around the tablet. Remove the guide colors and grid completely. No writing on the wax, no text, letters, numbers, people or animals.
```
