"""Read generated originals and register actual frames; never redraw atlas pixels."""
from pathlib import Path
import json
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
IDS=['suki','sid','jilly','laura','kay','franco','cora','amber']
SEATS={'jilly':('ttc-1','R1'),'cora':('ttc-2','R2'),'amber':('ttc-3','R3'),'franco':('ttc-4','R4'),'sid':('opposite-1','L1'),'suki':('opposite-2','L2'),'laura':('opposite-3','L3'),'kay':('opposite-4','L4')}
NAMES=['idle-front','idle-right','idle-back','idle-left','sit-front','sit-back','piano-rest','piano-play']
NAMES += [f'walk-front-{i}' for i in range(6)]+['sit-down-front','stand-up-front']
NAMES += [f'walk-back-{i}' for i in range(6)]+['sit-down-back','stand-up-back']
NAMES += [f'walk-right-{i}' for i in range(6)]+['curl-rest','curl-lift']
NAMES += ['hold-front','hold-right','hold-back','hold-left','sit-hold-front','sit-hold-back','sit-hold-right','sit-right']
NAMES += [f'hold-walk-front-{i}' for i in range(6)]+['dance-front-left','dance-front-right']
NAMES += [f'hold-walk-back-{i}' for i in range(6)]+['dance-back-left','dance-back-right']
NAMES += [f'hold-walk-right-{i}' for i in range(6)]+['run-right-0','run-right-1']
assert len(NAMES)==64
result={'version':1,'worldHeight':61.44,'logicalHeight':48,'grid':[8,8],'members':{}}
for person in IDS:
    base=ROOT/'assets/characters/team/v1'
    path=base/(person+'.png')
    im=Image.open(path).convert('RGBA')
    mask=im.getchannel('A').point(lambda a:255 if a>192 else 0)
    bands=[]; start=None
    for y in range(im.height):
        hit=mask.crop((0,y,im.width,y+1)).getbbox() is not None
        if hit and start is None:start=y
        if not hit and start is not None:bands.append((start,y));start=None
    if start is not None:bands.append((start,im.height))
    assert len(bands)==8,(person,'Expected 8 isolated pose rows',bands)
    frames=[]
    def runs(mask_part):
        found=[];begin=None
        for xx in range(mask_part.width):
            hit=mask_part.crop((xx,0,xx+1,mask_part.height)).getbbox() is not None
            if hit and begin is None:begin=xx
            if not hit and begin is not None:found.append([begin,xx]);begin=None
        if begin is not None:found.append([begin,mask_part.width])
        merged=[]
        for a,b in found:
            if merged and a-merged[-1][1]<=6:merged[-1][1]=b
            else:merged.append([a,b])
        return [pair for pair in merged if pair[1]-pair[0]>15]
    for row,(top,bottom) in enumerate(bands):
        columns=runs(mask.crop((0,top,im.width,bottom)))
        assert len(columns)==8,(person,row,columns)
        for col in range(8):
            left,right=columns[col]
            box=mask.crop((left,top,right,bottom)).getbbox()
            assert box,(person,row,col,'empty cell')
            x,y,x1,y1=box;x+=left;x1+=left;y+=top;y1+=top
            w,h=x1-x,y1-y
            index=row*8+col;name=NAMES[index]
            # Explicit pose-specific grip offsets, registered against the source rect.
            # No runtime face/skin guessing, and no detached sleeve composition.
            holding=name.startswith('hold') or name.startswith('sit-hold')
            direction='back' if 'back' in name or 'piano' in name else 'right' if 'right' in name else 'left' if 'left' in name and 'dance' not in name else 'front'
            side=1 if direction in ('back','right') else -1
            if person=='laura' and index in (32,36):side=1
            grip=[round(w*(.9 if side>0 else .1),2),round(h*.64,2)]
            if name.startswith('hold-walk'):
                grip=[round(w*(.81 if side>0 else .2),2),round(h*.67,2)]
            if name.startswith('sit-hold'):
                grip=[round(w*(.9 if side>0 else .1),2),round(h*.68,2)]
            if holding:
                candidates=[];seen=set()
                for yy in range(round(h*(.3 if direction=='back' else .52)),round(h*.86)):
                    for xx in range(w):
                        r,g,b,a=im.getpixel((x+xx,y+yy))
                        if a>192 and r>165 and g>85 and r-g>28 and g-b>12 and (direction!='back' or xx>w*.55):candidates.append((xx,yy))
                # Proposal comes from actual palm pixels within a pose-specific ROI,
                # then the registered coordinates are checked in the live preview.
                if candidates:
                    target_x=w*(.85 if side>0 else .15)
                    chosen=sorted(candidates,key=lambda pt:(pt[0]-target_x)**2+(pt[1]-h*.66)**2)[:max(3,min(16,len(candidates)))]
                    grip=[round(sum(pt[0] for pt in chosen)/len(chosen),2),round(sum(pt[1] for pt in chosen)/len(chosen),2)]
            frames.append({'name':name,'rect':[x,y,w,h],'floor':[round(w/2,2),h],'seat':[round(w/2,2),round(h*.72,2)],'direction':direction,'grip':grip if holding else None,'gripSide':side,'index':index})
    reference=max(f['rect'][3] for f in frames[:4])
    seat,seat_now=SEATS[person]
    result['members'][person]={'image':path.name,'sourceSize':list(im.size),'referenceHeight':reference,'oldSeat':seat,'seat':seat_now,'frames':frames}
    print(person,len(frames),path.name,seat_now,'height',reference)
out=ROOT/'assets/metadata/team-v1.json'
out.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
