"""Register generated source rectangles without changing the sprite pixels."""
from PIL import Image
from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
im=Image.open(root/'assets/npcs/celine-v1.png').convert('RGBA')
mask=im.getchannel('A').point(lambda a:255 if a>192 else 0)
def runs(values):
    out=[];start=None
    for i,hit in enumerate(values+[False]):
        if hit and start is None:start=i
        if not hit and start is not None:out.append((start,i));start=None
    return [(a,b) for a,b in out if b-a>15]
rows=runs([mask.crop((0,y,im.width,y+1)).getbbox() is not None for y in range(im.height)])
assert len(rows)==3,rows
names=['idle-front','idle-back','idle-right','idle-left','walk-right-0','walk-right-1','walk-front-0','walk-front-1','walk-back-0','walk-back-1','sit-front','sit-back']
frames=[]
for top,bottom in rows:
    cols=runs([mask.crop((x,top,x+1,bottom)).getbbox() is not None for x in range(im.width)])
    assert len(cols)==4,cols
    for left,right in cols:
        x,y,x1,y1=mask.crop((left,top,right,bottom)).getbbox()
        frames.append({'name':names[len(frames)],'rect':[x+left,y+top,x1-x,y1-y]})
(root/'assets/metadata/celine-v1.json').write_text(json.dumps({'image':'celine-v1.png','referenceHeight':max(f['rect'][3] for f in frames[:4]),'frames':frames},indent=2),encoding='utf-8')
print(len(frames),'frames',im.size)
