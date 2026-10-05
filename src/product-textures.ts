import Phaser from 'phaser';
// Native pixel props: small silhouettes with the same dark outlines as the room.
// These textures are shared by vending previews, held items and table items.
export function registerProductTextures(scene: Phaser.Scene) {
  const patterns: Record<string, { colors: Record<string, number>; rows: string[] }> = {
    tea: {colors:{'#':0x34312e,T:0xd19b39,B:0x976722,R:0xc64b34,W:0xf4de9a},rows:['..###..','..#R#..','.#####.','#TTTTT#','#TWWTT#','#TRRRT#','#TWWTT#','#TTTTT#','#TBBBT#','#TBBBT#','#TBBBT#','#BBBBB#','.#####.']},
    bowl: {colors:{'#':0x28362c,G:0x90b542,g:0x5c853b,S:0xd3ceb4,B:0x8c603c},rows:['....B..B.....','....B..B.....','..#########..','.#SSSSSSSSS#.','#GGGGGGGGGGG#','#GGGGGGGGGGG#','.#GGGGGGGGG#.','..#ggggggg#..','...#######...','....#####....','.............']},
    noodles: {colors:{'#':0x28362c,G:0x91b543,g:0x5c853b,N:0xf4dc91,S:0xab813c,R:0xc96245,V:0x6e9b45,B:0x8c603c},rows:['....B...B.....','....B...B.....','..##########..','.#NNVNNNRNNN#.','#NNSSNNVNNSSN#','#GNNNRNNNNNNG#','#GGGGGGGGGGGG#','.#GGGGGGGGGG#.','..#gggggggg#..','...########...','....######....','..............']},
    'chicken-strips': {colors:{'#':0x513b29,Y:0xe3b252,y:0xc58b36,R:0xa94335,W:0xf0ddbb},rows:['..Y..Y..Y..','..Y.YY.YY..','.#YYyYyYY#.','.#YyYyYyY#.','.#YYYYYYY#.','###########','#RWWWWWWWR#','#RWWRRRWWR#','#RWWWWWWWR#','.#########.','..#######..','...........']},
    'fried-chicken': {colors:{'#':0x513b29,Y:0xe3b252,y:0xc58b36,W:0xf0ddbb,R:0xa94335},rows:['..####......','.#YYyY#.....','#YyYYYY#....','#YYYYyY#....','.#YYYy#WW...','..#yy#WWW...','###########.','#RWWWWWWWR#.','#RWWRRWWWR#.','.#########..','............']},
    vinegar: {colors:{'#':0x33302a,R:0x993632,B:0x765139,W:0xdbc997},rows:['..RRR..','..###..','..#B#..','.#####.','#BBBBB#','#BWWWB#','#BWWWB#','#BBBBB#','#BBBBB#','.#####.']},
    sesame: {colors:{'#':0x33302a,G:0x657f35,Y:0xcba64c,W:0xf1e1b1},rows:['..GGG..','..###..','..#Y#..','.#####.','#YYYYY#','#YWWWY#','#YWWWY#','#YYYYY#','#YYYYY#','.#####.']},
    macaron: { colors: { '#': 0x4b394c, P: 0xba83b0, p: 0xe3b0d3, W: 0xf3d8dc }, rows: ['..######..', '.#pppppp#.', '#ppPPPPpp#', '#PPPPPPPP#', '#WWWWWWWW#', '#PPPPPPPP#', '.#PPPPPP#.', '..######..'] },
    cake: { colors: { '#': 0x49302b, B: 0xbd8459, W: 0xf3dbc0, R: 0xc64848, w: 0xfff0d9 }, rows: ['....RR.....', '...#RR#....', '..########.', '.#wwwwwwwW#', '#WWWWWWWWW#', '#BBBBBBBBB#', '#WWWWWWWWW#', '#BBBBBBBBB#', '#BBBBBBBBB#', '.#########.'] },
    cola: { colors: { '#': 0x252329, R: 0xa73539, r: 0xd95246, S: 0xb7bdbe, W: 0xe8dfcb }, rows: ['.######.', '#SSSSSS#', '#RRRrrR#', '#RRRrrR#', '#RRRrrR#', '#RWWWWR#', '#RWrrWR#', '#RWWWWR#', '#RRRrrR#', '#RRRrrR#', '#SSSSSS#', '.######.'] },
    chips: { colors: { '#': 0x302524, R: 0xb64d37, r: 0xdb7151, Y: 0xe7c46b, y: 0xb98d46 }, rows: ['##########', '#RrRrRrRR#', '#RRRRrrRR#', '#RRRRrrRR#', '#RRYYYYRR#', '#RYYyyYYR#', '#RYyyyYYR#', '#RRYYYYRR#', '#RRRRrrRR#', '#RRRRrrRR#', '#RrRrRrRR#', '##########'] },
    bread: { colors: { '#': 0x42342b, B: 0xc69358, b: 0xe8bf7e, W: 0xf3dab0 }, rows: ['..#######..', '.#bbbbbbb#.', '#bbWWbbWWb#', '#bbbBbbBbb#', '#bbbbbbbbb#', '#bBBBBBBBb#', '#BBBBBBBBB#', '.#BBBBBBB#.', '..#######..'] },
    sausage: { colors: { '#': 0x3e2529, R: 0xb94c59, r: 0xd97473, Y: 0xd8c0a0 }, rows: ['..Y..', '.###.', '#RrR#', '#RrR#', '#RrR#', '#RYR#', '#RYR#', '#RrR#', '#RrR#', '#RrR#', '#RrR#', '.###.', '..Y..'] },
    spicy: { colors: { '#': 0x392627, R: 0xa7382c, r: 0xd25838, Y: 0xe5c476 }, rows: ['#########', '#RrRrRrR#', '#RRrrRRR#', '#RRrrRRR#', '#RYYYYYR#', '#RYRYRYR#', '#RYYYYYR#', '#RRrrRRR#', '#RYRYRYR#', '#RRrrRRR#', '#RrRrRrR#', '#########'] },
  };
  for (const [id, pattern] of Object.entries(patterns)) {
    const key = `product-${id}`;
    if (scene.textures.exists(key)) continue;
    const graphics = scene.make.graphics({ x: 0, y: 0 });
    pattern.rows.forEach((row, y) => [...row].forEach((color, x) => {
      if (color !== '.') graphics.fillStyle(pattern.colors[color]).fillRect(x, y, 1, 1);
    }));
    graphics.generateTexture(key, pattern.rows[0].length, pattern.rows.length);
    graphics.destroy();
  }
}
