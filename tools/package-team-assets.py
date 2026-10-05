"""Package unchanged generated PNGs plus source coordinate registries."""
from pathlib import Path
import json,shutil,zipfile
ROOT=Path(__file__).resolve().parents[1]
meta=json.loads((ROOT/'assets/metadata/team-v1.json').read_text(encoding='utf-8'))
out=ROOT/'output/team-assets-v1'
out.mkdir(parents=True,exist_ok=True)
shutil.copy2(ROOT/'docs/team-assets-v1.md',out/'README.md')
shutil.copy2(ROOT/'assets/metadata/team-v1.json',out/'team-v1.json')
for person,member in meta['members'].items():
    folder=out/person;folder.mkdir(exist_ok=True)
    for key in ['image','carryImage']:
        shutil.copy2(ROOT/'assets/characters/team/v1'/member[key],folder/member[key])
    (folder/'frames.json').write_text(json.dumps(member,ensure_ascii=False,indent=2),encoding='utf-8')
archive=ROOT/'output/team-assets-v1.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for p in sorted(out.rglob('*')):
        if p.is_file():z.write(p,p.relative_to(out))
print(archive,len(meta['members']),'members',meta['sourceFrameCount'],'source frames')
