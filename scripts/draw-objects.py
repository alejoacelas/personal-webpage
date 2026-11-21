# /// script
# dependencies = ["resvg-py", "Pillow"]
# ///
"""Rebuild the transparent archive illustrations with uv run scripts/draw-objects.py."""
import io
import math
import random
import sys
from pathlib import Path

from PIL import Image
from resvg_py import svg_to_bytes

OUT = Path(__file__).resolve().parents[1] / "public" / "objects"
INK, DARK, SHADE = "#253c32", "#3f5443", "#9ca790"
PAPER, LIGHT, MID = "#eee9d1", "#fff9df", "#cbd0b5"
HATCH, FINE, DOTS = (f"url(#{name})" for name in ("hatch", "fine", "dots"))
DEFS = f"""
<defs>
<pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse">
<path d="M-1 1L1 -1M0 5L5 0M4 6L6 4" fill="none" stroke="{INK}" stroke-width=".75" opacity=".65"/></pattern>
<pattern id="fine" width="3" height="3" patternUnits="userSpaceOnUse">
<path d="M-1 2L2 -1M0 4L4 0" fill="none" stroke="{INK}" stroke-width=".45" opacity=".57"/></pattern>
<pattern id="dots" width="7" height="5" patternUnits="userSpaceOnUse">
<g fill="{INK}" opacity=".63"><circle cx="1" cy=".9" r=".47"/><circle cx="4.7" cy="3.5" r=".39"/></g></pattern>
</defs>"""


def shape(tag, geometry, fill="none", stroke=INK, sw=1.45):
    return f'<{tag} {geometry} fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'


def rect(x, y, w, h, fill=PAPER, radius=0, sw=1.45):
    return shape("rect", f'x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}"', fill, sw=sw)


def path(d, fill="none", sw=1.45, stroke=INK):
    return shape("path", f'd="{d}"', fill, stroke, sw)


def poly(points, fill, sw=1.45):
    return shape("polygon", 'points="' + " ".join(f"{x:.2f},{y:.2f}" for x, y in points) + '"', fill, sw=sw)


def ellipse(x, y, rx, ry, fill=PAPER, sw=1.45):
    return shape("ellipse", f'cx="{x}" cy="{y}" rx="{rx}" ry="{ry}"', fill, sw=sw)


def lines(points, sw=.8, stroke=INK):
    return path("M"+" L".join(f"{x:.2f} {y:.2f}" for x, y in points), sw=sw, stroke=stroke)


def group(transform, *items):
    return f'<g transform="{transform}">' + "".join(items) + '</g>'


def bolt(x, y, r=2.2):
    return ellipse(x, y, r, r, MID, .75) + lines([(x-r*.6,y+r*.35),(x+r*.6,y-r*.35)], .7)


def point(x, y, z):
    return .98*x+.65*y, .225*x-.49*y-z


def plane(origin, axes, art):
    x, y = point(*origin)
    return group(f"matrix({axes} {x} {y})", art)


def top(x, y, z, depth, art):
    return plane((x,y+depth,z), ".98 .225 -.65 .49", art)


def front(x, y, z, art):
    return plane((x,y,z), ".98 .225 0 1", art)


def side(x, y, z, art):
    return plane((x,y,z), ".65 -.49 0 1", art)


def block(x,y,z,w,d,h, lid=PAPER, face=MID, end=SHADE):
    a = front(x,y,z+h, rect(0,0,w,h,face))
    b = side(x+w,y,z+h, rect(0,0,d,h,end) + rect(0,0,d,h,HATCH,sw=0))
    return a+b+top(x,y,z+h,d,rect(0,0,w,d,lid))


def shadow(x, y, rx, ry, rotate=7):
    rng = random.Random(783)
    marks = []
    for _ in range(int(rx*ry*.22)):
        a = rng.random()*math.tau
        r = math.sqrt(rng.random())
        xx = rx*r*math.cos(a)
        yy = ry*r*math.sin(a)
        length = rng.uniform(.4,6)*(1-r*.72)
        marks.append(lines([(xx,yy),(xx+length,yy-.35*length)], rng.uniform(.25,.8)))
    return group(f"translate({x} {y}) rotate({rotate})", "".join(marks))


def keys(width=120, rows=4):
    s = rect(0,0,width,rows*10+5,DARK,2)
    for row in range(rows):
        x = 3
        caps = [1]*10
        if row==rows-1: caps = [1.6,1,4,1,1,1.4]
        if row==1: caps = [1.5]+[1]*8+[.5]
        for span in caps:
            w = (width-5)/10*span-1.3
            s += rect(x,row*10+3,w,8,MID,1,.7)
            s += rect(x+1,row*10+3.6,w-2,5.2,LIGHT,.8,.55)
            x += w+1.3
    return s


def crt():
    s = shadow(101,23,93,17)
    s += block(8,10,0,94,52,11)
    s += front(8,10,11,rect(4,3,49,2,DARK,1,.6)+ellipse(85,6,2,2,LIGHT,.6))
    s += block(22,21,11,65,30,7)
    s += block(11,12,18,87,52,71)
    s += side(98,12,89,"".join(rect(19+i*3.3,14,1.2,17,DARK,.5,.45) for i in range(8)))
    s += top(11,12,89,52,"".join(rect(9,7+i*2.9,57,1.1,DARK,.45,.4) for i in range(6)))
    screen = rect(4,5,79,55,SHADE,5) + rect(7,8,73,49,DARK,5)
    screen += path("M14 14 Q41 9 72 14 Q78 29 73 48 Q45 54 14 49 Q9 30 14 14Z",INK)
    for i in range(12):
        screen += path(f"M16 {16+i*2.7} Q43 {13+i*2.9} 71 {16+i*2.7}",sw=.35,stroke=SHADE)
    screen += path("M20 19l4 3-4 3M27 26h6",sw=1.3,stroke=LIGHT)
    screen += rect(7,63,27,2,SHADE,.5,.6)+bolt(76,65)
    s += front(11,12,89,screen)
    s += block(7,-39,0,106,33,4)
    return s+top(10,-36,4.2,27,group("scale(.86 .58)",keys()))


def folded_map():
    s=shadow(90,17,86,15)
    pts=[(0,-67),(46,-96),(87,-75),(130,-99)]
    for i in range(3):
        x,y=pts[i]; xx,yy=pts[i+1]
        a,b=(xx-x)/45,(yy-y)/45
        rng=random.Random(33+i)
        area=rect(0,0,45,100,[PAPER,LIGHT,MID][i])
        for yy0 in (13,34,66,90):
            for j in range(4):
                yy1=yy0+j*2.1
                area+=path(f"M0 {yy1} Q14 {yy1-8} 22 {yy1+1} T45 {yy1+2}",sw=.48)
        for j in range(8):
            px=rng.randint(4,40); py=rng.randint(7,89)
            area+=path(f"M{px} {py+2}l2 -4 2 4z",SHADE,.5)
        routes=["M0 60C16 44 8 32 24 39S37 62 45 50","M0 50Q12 43 17 48T32 39L45 30","M0 30Q22 24 23 38T45 54"]
        area+=path(routes[i],sw=3.7,stroke=DARK)+path(routes[i],sw=1.8,stroke=LIGHT)
        if i==1: area+=ellipse(19,47,2.4,2.4,INK)
        area+=rect(2,3,41,94,"none",sw=.5)
        s+=group(f"matrix({a} {b} .34 .89 {x} {y})",area)
    return s


def pencil():
    return (path("M0 0l5 -3 91 0 11 3-11 3H5z",MID)
            +path("M5 -3v6M10 -3v6M13 -3v6M91 -3v6L102 1 107 0",sw=.7)
            +path("M13 0h78",sw=.8)+path("M102 -1.5l5 1.5-5 1.5z",INK,.6))


def notebook():
    s=shadow(93,20,88,15)
    form=path("M0 6Q35 -2 67 10Q99 -3 144 5V111Q100 103 68 116Q37 103 0 113Z",DARK)
    for n in (4,2,0):
        form+=group(f"translate(0 {n})",path("M3 3Q36 -4 68 7Q98 -4 140 2V105Q99 99 68 111Q34 99 3 107Z",LIGHT,.9))
    form+=path("M68 7Q63 58 68 111M70 8Q66 62 70 107",sw=.8)
    for j in range(11):
        y=14+7*j
        form+=path(f"M10 {y}Q35 {y-4} 61 {y+3}M76 {y+3}Q101 {y-5} 131 {y-1}",sw=.38)
    for j,w in enumerate([40,29,34,18,31]):
        form+=path(f"M13 {22+j*7}q8 -2 {w} 0",sw=1.0)
    for x,y in ((91,33),(111,49),(91,70)):
        form+=ellipse(x,y,7,5,MID,.8)
    form+=path("M98 36l8 9m0 9-11 11M90 38v25",sw=.8)
    s+=group("matrix(.94 .24 -.48 .67 23 -69)",form)
    return s+group("translate(101 2) rotate(-56)",pencil())


def cassette():
    s=shadow(73,27,85,13)
    body=rect(0,4,147,86,SHADE,7)+rect(0,0,147,86,MID,7)
    body+=rect(5,5,137,75,DOTS,5,.7)
    body+=rect(10,10,127,52,PAPER,4)+rect(14,14,119,8,LIGHT,2,.7)
    body+=rect(18,26,111,26,DARK,12)
    body+=rect(54,31,39,15,PAPER,2,.75)+rect(58,33,3,11,SHADE,sw=.5)+rect(87,33,3,11,SHADE,sw=.5)
    for x in (37,110):
        body+=ellipse(x,39,12,12,LIGHT,1.3)+ellipse(x,39,7,7,DARK,1)
        for j in range(8):
            body+=group(f"rotate({j*45} {x} 39)",rect(x-1.25,30.8,2.5,4,MID,.5,.4))
    body+=path("M24 85L32 67H113L122 85Z",PAPER)
    body+=path("M31 82L36 70H110L115 82",sw=.7)
    for x in [43,55,90,103]: body+=ellipse(x,79,2.6,2.6,DARK,.7)
    for x,y in ((6,7),(140,7),(7,78),(139,78)): body+=bolt(x,y,2.2)
    return s+group("matrix(1 .19 -.24 .92 8 -86)",body)


def microphone():
    s=shadow(59,14,48,10)
    s+=ellipse(54,8,39,10,SHADE)+ellipse(54,5,39,10,MID)+ellipse(54,4,31,6,HATCH,.7)
    s+=path("M50 5v-22q0 -7 9 -10l5 4q-6 2 -6 8V5Z",MID)+path("M56 -15v18",sw=.65)
    s+=group("rotate(-12 53 -59)",
        path("M28 -66v18q0 25 25 25t25 -25v-18h-6v18q0 19-19 19t-19 -19v-18Z",SHADE),
        rect(33,-112,41,72,MID,20),rect(36,-111,34,66,PAPER,16),
        rect(38,-107,30,59,HATCH,14,.7),
        "".join(rect(37,-98+j*6,33,2.4,DARK,1.2,.6) for j in range(7)),
        rect(49,-108,5,60,MID,2,.8),
        bolt(31,-60,4),bolt(75,-60,4))
    return s


def magnifier():
    s=shadow(68,19,87,11)
    body=path("M64 53l10 -9 43 41q3 6-5 11t-12 -2Z",SHADE)
    body+=path("M78 56l5 -6 32 33q4 5-3 9t-10 -3Z",DARK)
    for j in range(9): body+=path(f"M{83+2.9*j} {56+2.9*j}l-5 5",sw=.65,stroke=MID)
    body+=ellipse(40,28,38,35,DARK)+ellipse(39,25,38,35,MID)+ellipse(39,25,34,31,HATCH,.9)+ellipse(39,25,30,28,LIGHT)
    body+=path("M14 26Q16 6 38 3M20 23Q23 11 32 8M48 47Q60 42 63 30",sw=.9)
    body+=path("M23 35Q33 26 47 32T62 32M24 38Q34 30 46 36T59 37",sw=.55)
    return s+group("translate(12 -78) rotate(-10 39 25)",body)


def binder():
    s=shadow(86,16,80,13)
    # A ledger with a cloth-covered spine, page block and thumb tab.
    s+=block(7,7,0,95,105,4, DARK,DARK,DARK)
    s+=block(9,8,4,91,102,12, LIGHT,LIGHT,PAPER)
    s+=front(9,8,16,"".join(lines([(0,2+j*1.6),(90,2+j*1.6)],.45) for j in range(6)))
    s+=block(7,7,16,95,105,3, MID,SHADE,DARK)
    surface=rect(0,0,14,105,HATCH,sw=.6)+rect(14,0,2,105,SHADE,sw=.6)
    surface+=rect(31,28,47,33,PAPER,1)+rect(34,31,41,27,"none",sw=.65)
    surface+=lines([(40,41),(69,41)],1.1)+lines([(45,47),(64,47)],.6)
    for y in (19,83): surface+=ellipse(7,y,2.6,3,PAPER,.7)
    return s+top(7,7,19,105,surface)


def keyboard():
    s=shadow(113,23,114,15)
    s+=path("M132 -20q21 -21 40 -14t28 -11q3 -8 14 -5",sw=3)+path("M132 -20q21 -21 40 -14t28 -11q3 -8 14 -5",sw=1,stroke=MID)
    s+=block(5,0,0,170,67,9)
    art=group("translate(6 13) scale(1 .94)",keys())
    art+=rect(132,12,32,42,DARK,2)
    for i in range(3):
        for j in range(4):
            art+=rect(134+i*10,14+j*9.8,8,7.8,LIGHT,1,.75)
    for j in range(3):
        art+=ellipse(137+8*j,7,1.7,1.7,[DARK,MID,DARK][j],.55)
    for j in range(10): art+=rect(7+j*11.9,3,10,6,MID,1,.6)
    return s+top(5,0,9,67,art)


def chain():
    s=shadow(83,11,83,11)
    def link(x,y,angle,h):
        d=f"M-15 {-h}h30a{h} {h} 0 0 1 0 {2*h}h-30a{h} {h} 0 0 1 0 {-2*h}z"
        return group(f"translate({x} {y}) rotate({angle})",path(d,sw=10),path(d,sw=6.8,stroke=SHADE),path(d,sw=1.1,stroke=LIGHT))
    for x,y,angle,h in [(134,-24,-36,11),(107,-16,18,6),(79,-23,-36,12),(51,-15,18,6),(24,-22,-36,11)]:
        s+=link(x,y,angle,h)
    return s


def inbox():
    s=shadow(92,17,89,16)
    s+=block(0,0,0,110,91,4)
    s+=block(0,87,4,110,4,23)
    s+=block(0,1,4,3,86,23)
    for i in range(10):
        s+=top(7+i%3,9+(i*3)%8,6+i*.95,66,rect(0,0,92-i%4,66,PAPER if i%3 else LIGHT,sw=.75))
    s+=top(8,13,15,66,lines([(14,13),(69,13)],1.8)+lines([(14,19),(46,19)],.8)
        +"".join(lines([(14,30+i*4),(73-i%2*12,30+i*4)],.55) for i in range(6)))
    s+=block(107,1,4,3,86,23)
    rim="M0 0H29Q33 0 36 9Q39 13 45 13H69Q73 13 76 7L80 0H110V23H0Z"
    s+=front(0,0,27,path(rim,MID)+path(rim,HATCH,sw=.4))
    s+=front(0,-1,27,path("M2 1H29Q33 2 36 10Q39 15 45 15H69Q76 15 81 1H109",sw=1.1,stroke=LIGHT))
    return s


def rolodex():
    s=shadow(79,19,78,12)
    s+=block(6,1,0,95,63,4)
    s+=side(98,4,50,path("M0 45L14 4Q19 -6 26 7L49 45Z",MID))
    s+=front(5,8,44,rect(0,0,110,7,DARK,2))
    for j in range(24):
        # The cards fan around a single horizontal axle.
        angle=math.radians(53-j*4.5)
        depth=math.sin(angle)
        rise=math.cos(angle)
        midx,midy=point(8,31,35)
        card=path("M0 1Q0 -2 3 -2H60l2 -5h13l1 5h8q3 0 3 3v54H0Z",
                  [PAPER,MID,LIGHT,PAPER][j%4],.9)
        if j>=22:
            for k in range(5): card+=lines([(9,11+k*6),(71-k%3*9,11+k*6)],.55)
        s+=group(f"matrix(.98 .225 {-depth*.64} {rise+depth*.42} {midx+depth*28} {midy-rise*39-depth*13})",card)
    s+=side(103,4,50,path("M0 45L14 4Q19 -6 26 7L49 45Z",MID)+path("M3 44L17 8Q20 2 23 9L45 44Z",HATCH,sw=.6))
    xx,yy=point(106,24,42)
    knob=ellipse(0,0,9,11,DARK)+ellipse(2,-1,8,10,MID)+ellipse(2,-1,4,5,HATCH)
    return s+group(f"translate({xx} {yy})",knob)


def steps():
    s=shadow(85,18,88,15)
    for j in range(4):
        s+=block(j*27,0,0,27,61,12+14*j)
        for k in range(2):
            x,y=point(j*27,0,12+14*j)
            s+=group(f"translate({x} {y})",path(f"M1 {4+k*2}q14 3 24 5",sw=.46))
        s+=top(j*27,0,12+14*j,61,lines([(2,3),(25,3)],.65)+lines([(2,58),(25,58)],.65))
    return s


def compass():
    s=shadow(74,17,61,12)
    s+=group("rotate(-14 70 -36)",
        ellipse(69,-87,10,12,PAPER),ellipse(69,-87,6,8,DARK),rect(61,-80,16,9,MID,2),
        ellipse(70,-33,49,45,DARK),ellipse(70,-36,49,45,SHADE),ellipse(70,-39,49,45,MID),
        ellipse(70,-39,45,41,HATCH,.8),ellipse(70,-39,41.5,37.5,PAPER),
        ellipse(70,-39,31.5,29,"none",.55),
        "".join(group(f"rotate({i*7.5} 70 -39)",lines([(70,-74),(70,-69 if i%6==0 else -72)],.9 if i%6==0 else .55)) for i in range(48)),
        path("M42 -38l25 -6 5 -23 4 23 21 5-22 5-5 21-5-21Z",MID,.7),
        path("M48 -17l17 -27 29 -22-18 31Z",INK),
        path("M48 -17l22 -22 24 -27-29 22Z",LIGHT,.95),ellipse(70,-39,3.2,3.2,MID))
    return s


def speech():
    s=shadow(83,13,78,11)
    rear="M7 0H75Q82 0 82 7V40Q82 47 75 47H68L72 62L52 47H7Q0 47 0 40V7Q0 0 7 0Z"
    frontplate="M8 0H83Q91 0 91 8V49Q91 57 83 57H33L14 73L18 57H8Q0 57 0 49V8Q0 0 8 0Z"
    s+=group("matrix(.98 .15 -.12 .97 72 -83)",group("translate(3 4)",path(rear,DARK)),path(rear,MID),path(rear,HATCH,sw=.55),
        lines([(13,15),(66,15)],1),lines([(13,22),(62,22)],.75),lines([(13,29),(47,29)],.75))
    s+=group("matrix(.97 -.12 .06 1 7 -56)",group("translate(3 4)",path(frontplate,DARK)),path(frontplate,PAPER),
        lines([(11,9),(78,9)],.45),lines([(12,49),(74,49)],.45),
        "".join(ellipse(x,28,4.1,4.1,DARK,.8)+ellipse(x-.6,27.2,1.2,1.1,MID,.35) for x in (29,45,61)))
    return s


def lamp():
    s=shadow(77,19,72,10)
    s+=path("M73 9q22 7 35 0t29 -2",sw=2.5)+path("M73 9q22 7 35 0t29 -2",sw=.75,stroke=MID)
    s+=ellipse(67,11,31,8,DARK)+path("M36 10q1 -12 31 -12t31 12q-31 14 -62 0Z",MID)+ellipse(67,4,23,5,HATCH,.6)
    for ax,ay,bx,by in ((66,4,39,-43),(39,-43,83,-88)):
        s+=lines([(ax-3,ay),(bx-3,by)],5)+lines([(ax-3,ay),(bx-3,by)],2.7,stroke=MID)
        s+=lines([(ax+3,ay),(bx+3,by)],4)+lines([(ax+3,ay),(bx+3,by)],2.1,stroke=PAPER)
    s+=path("M44 -40L62 -62l-2 -4-3 8-2 -3-2 8-2 -3-3 8-2 -3-2 7",sw=.8)
    s+=bolt(39,-43,4.5)+bolt(66,4,4.3)+bolt(83,-88,4.5)
    s+=path("M84 -88q10 -9 17 0l5 7",sw=5)+path("M84 -88q10 -9 17 0l5 7",sw=2.5,stroke=MID)
    s+=group("rotate(-33 111 -71)",rect(107,-90,8,10,MID,2),
        path("M104 -80q-7 3-9 13t-14 20q27 9 60 0-13 -9-16 -20t-10 -13Z",PAPER),
        path("M113 -79q3 19 21 31l5 1q-14 -10-17 -23l-5 -8Z",HATCH,.5),
        ellipse(111,-47,30,4.6,DARK),ellipse(111,-46,24,2.2,LIGHT,.65))
    return s


def documents():
    s=shadow(91,20,87,14)
    def sheet(offset,angle,diagram):
        leaf=path("M0 0H76L91 15V109H0Z",PAPER)
        leaf+=path("M76 0v15h15Z",MID)
        leaf+=rect(7,7,4,20,DARK,sw=.65)
        leaf+=lines([(15,13),(55,13)],1.8)+lines([(15,20),(44,20)],.8)
        for j in range(5):
            leaf+=lines([(9,33+j*5),(72-j%3*10,33+j*5)],.77)
        if diagram:
            leaf+=rect(9,62,70,31,LIGHT,sw=.68)
            for j in range(4): leaf+=lines([(12,68+j*6),(76,68+j*6)],.36)
            leaf+=path("M13 87l9 -5 6 3 12 -12 9 4 8 -6 6 1 9 -8",sw=1.25)
        else:
            for j in range(6): leaf+=lines([(9,64+j*4.5),(70-j%2*14,64+j*4.5)],.62)
        return group(f"translate({offset} 0) rotate({angle})",leaf)
    return s+group("matrix(.97 .22 -.41 .67 34 -81)",sheet(10,-13,False),sheet(35,7,True))


def clock():
    s=shadow(74,15,62,11)
    art=path("M30 -16l-7 13q0 4 5 4l9 -10M98 -16l8 12q1 5 -4 5l-12 -11",DARK)
    art+=path("M46 -89q5 -24 22 -24t22 24",sw=4.2)+path("M46 -89q5 -24 22 -24t22 24",sw=1.9,stroke=MID)
    art+=ellipse(69,-53,49,49,DARK)+ellipse(65,-54,49,49,MID)+ellipse(65,-54,45.5,45.5,HATCH,.7)+ellipse(65,-54,42,42,LIGHT)
    art+=ellipse(65,-54,32,32,"none",.55)
    for i in range(60):
        major=i%5==0
        art+=group(f"rotate({i*6} 65 -54)",lines([(65,-93),(65,-87 if major else -91)],1.4 if major else .55))
    art+=path("M64 -52l-14 -15 2 -2 15 14z",DARK,.9)
    art+=path("M64 -55l22 -23-19 25Z",INK)
    art+=path("M59 -47l22 -32",sw=.65)+ellipse(65,-54,3,3,MID,.8)
    return s+group("matrix(.97 -.08 .05 .97 5 4)",art)


def switchboard():
    s=shadow(89,18,80,13)
    s+=block(3,0,0,115,66,12)
    for row in range(3):
        for col in range(6):
            x=11+17.7*col; y=10+18*row
            art=ellipse(x,y,4.4,5.3,MID,.8)+ellipse(x,y,2.6,3.5,DARK,.7)
            s+=top(3,0,12,66,art)
    for xx,yy,dx,dy,height in [(20,15,100,49,32),(55,12,36,48,25),(88,12,70,30,35)]:
        start=point(xx,yy,12); end=point(dx,dy,12)
        x,y=start; xx,yy=end
        cord=f"M{x} {y}C{x-5} {y-height} {xx-10} {yy-height} {xx} {yy}"
        s+=path(cord,sw=4.5)+path(cord,sw=2,stroke=SHADE)
        for x,y in (start,end): s+=group(f"translate({x} {y}) rotate(-10)",rect(-2,-5,4,6,MID,1,.7))
    return s


OBJECTS = {
    "crt": crt, "folded-map": folded_map, "notebook": notebook, "cassette": cassette,
    "microphone": microphone, "magnifier": magnifier, "binder": binder, "keyboard": keyboard,
    "chain": chain, "inbox": inbox, "rolodex": rolodex, "steps": steps, "compass": compass,
    "speech": speech, "lamp": lamp, "documents": documents, "clock": clock, "switchboard": switchboard,
}


def render(name):
    art = OBJECTS[name]()
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="360" height="230" viewBox="-50 -155 360 230">'
           + DEFS + '<g stroke-linejoin="round" stroke-linecap="round">' + art + '</g></svg>')
    img = Image.open(io.BytesIO(svg_to_bytes(svg_string=svg, zoom=5))).convert("RGBA")
    img = img.crop(img.getbbox())
    img.thumbnail((603, 350), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (760,440))
    canvas.alpha_composite(img, ((760-img.width)//2, (440-img.height)//2))
    canvas.save(OUT / f"{name}.png", optimize=True)


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True, parents=True)
    for name in sys.argv[1:] or OBJECTS:
        render(name)
