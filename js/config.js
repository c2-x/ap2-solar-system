export const SETTINGS = {
  orbitSpeed: 1,
  spinSpeed: 1,
  axialTilt: 23.5,
  showOrbits: true,
  showLabels: true,
  showAsteroids: true,
}

export const BODIES = [
  { id:'mercury', name:'水星', en:'MERCURY', radius:.55, distance:10, period:8, spin:5, color:'#aaa49b', texture:'mercury', info:'最靠近太阳的岩石行星，表面布满撞击坑。' },
  { id:'venus', name:'金星', en:'VENUS', radius:.9, distance:15, period:14, spin:7, color:'#d8b36d', texture:'venus', info:'浓厚的云层包裹着炽热的表面。' },
  { id:'earth', name:'地球', en:'EARTH', radius:1, distance:21, period:20, spin:2.5, color:'#62a8d8', texture:'earth', info:'我们的家园。自转轴倾斜 23.5°，并拥有一颗天然卫星。' },
  { id:'mars', name:'火星', en:'MARS', radius:.7, distance:28, period:30, spin:2.7, color:'#c56f4b', texture:'mars', info:'氧化铁让这颗岩石行星呈现标志性的红色。' },
  { id:'jupiter', name:'木星', en:'JUPITER', radius:2.7, distance:42, period:70, spin:1.5, color:'#d9b892', texture:'jupiter', info:'太阳系最大的行星，可见条纹与大红斑。' },
  { id:'saturn', name:'土星', en:'SATURN', radius:2.3, distance:57, period:100, spin:1.8, color:'#dbc78e', texture:'saturn', info:'由无数冰粒与岩屑构成的宽阔环系。' },
  { id:'uranus', name:'天王星', en:'URANUS', radius:1.5, distance:72, period:140, spin:3, color:'#93d4d5', texture:'uranus', info:'淡青色冰巨星，自转轴几乎躺在轨道面上。' },
  { id:'neptune', name:'海王星', en:'NEPTUNE', radius:1.45, distance:85, period:180, spin:3.2, color:'#527fd5', texture:'neptune', info:'遥远的深蓝色冰巨星，以高速风暴闻名。' },
]

export const TOUR_KEYFRAMES = [
  { t:0,  p:[0,88,154],   q:[0,0,0] },
  { t:8,  p:[138,68,52],  q:[0,0,0] },
  { t:16, p:[74,50,-148], q:[0,0,0] },
  { t:24, p:[-128,82,-76],q:[0,0,0] },
  { t:32, p:[-96,64,136], q:[0,0,0] },
  { t:36, p:[0,88,154],   q:[0,0,0] },
]
