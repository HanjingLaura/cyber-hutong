"""Read-only registration of existing black-shirt poses; never rewrites PNGs."""
from pathlib import Path
from PIL import Image
import json

root=Path('assets/drafts')
result={}
for filename,key,columns,rows,cuts in [
    ('owner-carry-empty-v1.png','rest-hold',4,5,([0,.32,.51,.70,1],[0,.207,.412,.609,.808,1])),
    ('owner-seated-hold-empty-v1.png','rest-seated-hold',3,1,None),
]:
    image=Image.open(root/filename).convert('RGBA'); width,height=image.size; pixels=image.load(); frames=[]
    for row in range(rows):
        for col in range(columns):
            x0=round((cuts[0][col] if cuts else col/columns)*width);x1=round((cuts[0][col+1] if cuts else (col+1)/columns)*width)
            y0=round((cuts[1][row] if cuts else row/rows)*height);y1=round((cuts[1][row+1] if cuts else (row+1)/rows)*height)
            points={(x,y) for y in range(y0,y1) for x in range(x0,x1) if pixels[x,y][3]>192}
            largest=[]
            while points:
                start=points.pop();component=[start]
                for x,y in component:
                    for dx in [-1,0,1]:
                        for dy in [-1,0,1]:
                            point=(x+dx,y+dy)
                            if point in points:points.remove(point);component.append(point)
                if len(component)>len(largest):largest=component
            left=min(x for x,y in largest);right=max(x for x,y in largest)+1;top=min(y for x,y in largest);bottom=max(y for x,y in largest)+1
            head=[x for x,y in largest if y<round(top+(bottom-top)*.4)]
            pivot=sum(head)/len(head)
            frames.append({'name':f'cell-{len(frames)}','rect':[left,top,right-left,bottom-top],'pivot':pivot})
    reference=max(f['rect'][3] for f in frames)
    slots={}
    for frame in frames:
        left,top,w,h=frame['rect'];seated=key=='rest-seated-hold'
        index=int(frame['name'].split('-')[1])
        back_pose=key=='rest-hold' and (index==2 or 12<=index<=15)
        skin={(x,y) for y in range(top+int(h*(.50 if back_pose else .52 if seated else .56)),top+int(h*(.66 if seated else .70))+1) for x in range(left,left+w)
              if (lambda p:p[3]>192 and p[0]>160 and 65<p[1]<210 and p[2]<160 and p[0]>p[1]*1.15 and p[1]>p[2]*1.05)(pixels[x,y])}
        largest=[]
        while skin:
            component=[skin.pop()]
            for x,y in component:
                for dx in [-1,0,1]:
                    for dy in [-1,0,1]:
                        point=(x+dx,y+dy)
                        if point in skin:skin.remove(point);component.append(point)
            correct_side=not back_pose or sum(x for x,y in component)/len(component)>frame['pivot']
            if correct_side and len(component)>len(largest):largest=component
        assert largest,frame['name']
        l=min(x for x,y in largest);r=max(x for x,y in largest);t=min(y for x,y in largest);b=max(y for x,y in largest)
        # The palm overlay uses the original hand artwork at exactly its body position.
        hand_rect=[l-2,t-2,r-l+5,b-t+5]
        slots[frame['name']]={'x':((l+r)/2-frame['pivot'])/reference,'y':((t+b)/2-top-h)/reference,'side':-1 if (l+r)/2<frame['pivot'] else 1,
            'handRect':hand_rect,'handOffset':[(l-2-frame['pivot'])/reference,(t-2-top-h)/reference]}
    result[key]={'source':filename,'referenceHeight':reference,'slots':slots}
Path('assets/metadata').mkdir(exist_ok=True)
Path('assets/metadata/owner-grips.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps({key:{'poses':len(v['slots']),'slots':v['slots']} for key,v in result.items()}))
