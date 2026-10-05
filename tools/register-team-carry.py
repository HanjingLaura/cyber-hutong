"""Register source rectangles and actual palms in the supplemental whole-body sheets."""
from pathlib import Path
import json
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
path=ROOT/'assets/metadata/team-v1.json'
data=json.loads(path.read_text(encoding='utf-8'))
loops={'suki':[7,8,9,10,11,8],'sid':[6,8,10,8,6,10],'jilly':list(range(6,12)),'laura':[6,7,8,10,11,7],'kay':[6,8,9,11,8,9],'franco':[6,8,9,11,8,9],'cora':list(range(6,12)),'amber':[6,9,10,9,6,10]}
right_front={'suki','jilly'}
def runs(values):
    result=[];start=None
    for i,hit in enumerate(values+[False]):
        if hit and start is None:start=i
        if not hit and start is not None:result.append([start,i]);start=None
    merged=[]
    for a,b in result:
        if merged and a-merged[-1][1]<=6:merged[-1][1]=b
        else:merged.append([a,b])
    return [r for r in merged if r[1]-r[0]>15]
for person,member in data['members'].items():
    source=ROOT/'assets/characters/team/v1'/f'{person}-carry-v1.png'
    im=Image.open(source).convert('RGBA')
    mask=im.getchannel('A').point(lambda a:255 if a>192 else 0)
    bands=runs([mask.crop((0,y,im.width,y+1)).getbbox() is not None for y in range(im.height)])
    assert len(bands)==4,(person,bands)
    frames=[]
    for row,(top,bottom) in enumerate(bands):
        columns=runs([mask.crop((x,top,x+1,bottom)).getbbox() is not None for x in range(im.width)])
        assert len(columns)==6,(person,row,columns)
        for col,(left,right) in enumerate(columns):
            x,y,x1,y1=mask.crop((left,top,right,bottom)).getbbox()
            x+=left;x1+=left;y+=top;y1+=top;w,h=x1-x,y1-y;i=row*6+col
            direction=('back' if col in (2,5) else 'left' if col==3 else 'front') if row==0 else ['','front','back','right'][row]
            side=1 if direction in ('back','right') or (direction=='front' and person in right_front and row>0) else -1
            if row==0 and col in (0,4):side=1 if person=='jilly' else -1
            candidates=[]
            for yy in range(round(h*.52),round(h*.84)):
                for xx in range(w):
                    r,g,b,a=im.getpixel((x+xx,y+yy))
                    if a>192 and r>165 and g>85 and r-g>28 and g-b>12:
                        if (xx>w*.53)==(side>0):candidates.append((xx,yy))
            target=(w*(.8 if side>0 else .2),h*.67)
            chosen=sorted(candidates,key=lambda pt:(pt[0]-target[0])**2+(pt[1]-target[1])**2)[:16]
            grip=[round(sum(pt[k] for pt in chosen)/len(chosen),2) for k in (0,1)] if chosen else list(target)
            if person=='sid' and direction=='back':grip=[round(w*.88,2),round(h*.72,2)]
            frames.append({'name':f'carry-{direction}-{i}','rect':[x,y,w,h],'floor':[w/2,h],'seat':[w/2,round(h*.72,2)],'direction':direction,'grip':grip,'gripSide':side,'index':i})
    member['carryImage']=source.name
    member['carryFrames']=frames
    member['carryReferenceHeight']=max(f['rect'][3] for f in frames[:4])
    member['carryFrontLoop']=loops[person]
    member['carryBackLoop']=[12,14,15,17,14,15] if person=='sid' else list(range(12,18))
    member['carryRightLoop']=list(range(18,24))
    member['reviewStatus']='candidate'
    print(person,len(frames),'carry frames; front loop',loops[person])
data['sourceFrameCount']=704
data['reviewStatus']='candidate; not installed as scene actors'
path.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
