import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { SETTINGS, BODIES, TOUR_KEYFRAMES } from './config.js'
import { createEarthMoonRig, sampleTour } from './hierarchy.js'

const $ = (id) => document.getElementById(id)
const canvas = $('scene')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
renderer.setSize(innerWidth, innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.12

const scene = new THREE.Scene()
scene.background = new THREE.Color('#03060d')
const camera = new THREE.PerspectiveCamera(43, innerWidth / innerHeight, .1, 1600)
camera.position.set(0, 88, 154)
const orthoCamera = new THREE.OrthographicCamera(-100, 100, 58, -58, .1, 1600)
orthoCamera.position.copy(camera.position)
let activeCamera = camera
let projectionMode = 'perspective'
const controls = new OrbitControls(activeCamera, canvas)
controls.enableDamping = true
controls.dampingFactor = .065
controls.rotateSpeed = .45
controls.zoomSpeed = .75
controls.minDistance = 3.4
controls.maxDistance = 360
controls.target.set(0, 0, 0)
controls.update()

const ambient = new THREE.HemisphereLight('#8ca4c2', '#11131c', .72)
ambient.name = '深空环境光'
const sunlight = new THREE.PointLight('#fff0d2', 4.1, 0, 0)
sunlight.name = '太阳点光源'
scene.add(ambient, sunlight)

const textureLoader = new THREE.TextureLoader()
const maxAnisotropy = renderer.capabilities.getMaxAnisotropy()
async function loadTexture(name, color = true) {
  const ext = name === 'saturn-rings' ? 'png' : 'jpg'
  const texture = await textureLoader.loadAsync(`./textures/${name}.${ext}`)
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace
  // Three.js 默认 flipY=true，使图像顶部对应 SphereGeometry 的 v=1（北极）。
  texture.flipY = true
  texture.anisotropy = Math.min(maxAnisotropy, 8)
  return texture
}

const textureNames = ['sun', 'moon', 'saturn-rings', ...BODIES.map(b => b.texture)]
const textures = Object.fromEntries(await Promise.all(textureNames.map(async name => [name, await loadTexture(name)])))
const sphereGeometry = new THREE.SphereGeometry(1, 56, 36)
const smallSphereGeometry = new THREE.SphereGeometry(1, 40, 28)
const clickable = []
const bodies = new Map()
const labels = new Map()
const orbitGroup = new THREE.Group()
orbitGroup.name = '行星轨道线'
scene.add(orbitGroup)

function makeMaterial(name, texture, options = {}) {
  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: .86, metalness: 0, ...options })
  material.name = name
  return material
}

function makeOrbit(radius, highlighted = false) {
  const points = []
  for (let i = 0; i < 256; i++) {
    const a = i / 256 * Math.PI * 2
    points.push(new THREE.Vector3(Math.cos(a) * radius, -.06, Math.sin(a) * radius))
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  const material = new THREE.LineBasicMaterial({ color: highlighted ? '#5797ac' : '#354354', transparent: true, opacity: highlighted ? .5 : .32, depthWrite: false })
  material.name = highlighted ? '地球轨道 · 青蓝' : '行星轨道 · 蓝灰'
  const line = new THREE.LineLoop(geometry, material)
  line.name = highlighted ? '地球轨道' : `轨道 ${radius}`
  orbitGroup.add(line)
}

function addLabel(id, text, extra = '') {
  const el = document.createElement('div')
  el.className = `body-label ${extra}`
  el.textContent = text
  $('labels').appendChild(el)
  labels.set(id, el)
}

function registerBody(data, object, mesh) {
  bodies.set(data.id, { ...data, object, mesh, angle: 0 })
  mesh.userData.bodyId = data.id
  clickable.push(mesh)
  addLabel(data.id, data.name, data.id === 'earth' ? 'earth' : '')
}

const sunMaterial = new THREE.MeshBasicMaterial({ map: textures.sun, color: '#fff2cd' })
sunMaterial.name = '太阳 · 程序化光球纹理'
const sun = new THREE.Mesh(new THREE.SphereGeometry(5, 64, 40), sunMaterial)
sun.name = '太阳'
sun.userData.bodyId = 'sun'
scene.add(sun)
clickable.push(sun)
bodies.set('sun', { id:'sun', name:'太阳', en:'SUN', radius:5, distance:0, period:0, color:'#f5b44b', object:sun, mesh:sun, info:'太阳系的中心恒星，为场景提供主要照明。' })
addLabel('sun', '太阳')

const coronaMaterial = new THREE.ShaderMaterial({
  name: '太阳 · Fresnel 日冕', transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
  uniforms: { glowColor: { value: new THREE.Color('#f6a43c') } },
  vertexShader: `varying vec3 vNormal; varying vec3 vView; void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);vView=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
  fragmentShader: `uniform vec3 glowColor;varying vec3 vNormal;varying vec3 vView;void main(){float rim=pow(1.-abs(dot(vNormal,vView)),2.2);gl_FragColor=vec4(glowColor,rim*.32);}`,
})
const corona = new THREE.Mesh(new THREE.SphereGeometry(6.3, 48, 32), coronaMaterial)
corona.name = '太阳日冕'
scene.add(corona)

for (const data of BODIES) {
  makeOrbit(data.distance, data.id === 'earth')
  if (data.id === 'earth' || data.id === 'moon') continue
  const pivot = new THREE.Group()
  pivot.name = `${data.name}公转坐标系`
  const axial = new THREE.Group()
  axial.name = `${data.name}天体坐标系`
  axial.position.x = data.distance
  if (data.id === 'saturn') axial.rotation.z = 26.7 * Math.PI / 180
  if (data.id === 'uranus') axial.rotation.z = 82 * Math.PI / 180
  const material = makeMaterial(`${data.name} · 表面位图`, textures[data.texture], { roughness: data.id === 'neptune' ? .72 : .9 })
  const mesh = new THREE.Mesh(sphereGeometry, material)
  mesh.name = data.name
  mesh.scale.setScalar(data.radius)
  axial.add(mesh)
  pivot.add(axial)
  scene.add(pivot)
  registerBody(data, axial, mesh)
  bodies.get(data.id).pivot = pivot
  bodies.get(data.id).axial = axial
  bodies.get(data.id).angle = BODIES.indexOf(data) * .77 + .35

  if (data.id === 'saturn') {
    const ringMaterial = new THREE.MeshStandardMaterial({ map: textures['saturn-rings'], transparent:true, opacity:.88, side:THREE.DoubleSide, depthWrite:false, roughness:.9, color:'#e5d5ae' })
    ringMaterial.name = '土星 · 冰尘环带'
    const ringGeometry = new THREE.RingGeometry(3.05, 5.3, 160, 1)
    // RingGeometry 默认 UV 是平面投影；改为径向 UV，才能正确读取环带位图。
    const pos = ringGeometry.attributes.position
    const uv = ringGeometry.attributes.uv
    for (let i = 0; i < pos.count; i++) {
      const radius = Math.hypot(pos.getX(i), pos.getY(i))
      uv.setXY(i, (radius - 3.05) / (5.3 - 3.05), .5)
    }
    uv.needsUpdate = true
    const ring = new THREE.Mesh(ringGeometry, ringMaterial)
    ring.name = '土星环'
    ring.rotation.x = -Math.PI / 2
    axial.add(ring)
    bodies.get(data.id).ring = ring
  }
}

const earthData = BODIES.find(b => b.id === 'earth')
const earthMaterial = makeMaterial('地球 · NASA Blue Marble', textures.earth, { roughness:.82 })
const earth = new THREE.Mesh(sphereGeometry, earthMaterial)
earth.name = '地球 · 手动层级矩阵'
scene.add(earth)
const earthEntry = { ...earthData, object:earth, mesh:earth, angle:.48 }
bodies.set('earth', earthEntry)
earth.userData.bodyId = 'earth'
clickable.push(earth)
addLabel('earth', '地球', 'earth')

const moonMaterial = makeMaterial('月球 · NASA LROC', textures.moon, { roughness:1 })
const moon = new THREE.Mesh(smallSphereGeometry, moonMaterial)
moon.name = '月球 · 手工轨道矩阵'
moon.userData.bodyId = 'moon'
scene.add(moon)
clickable.push(moon)
bodies.set('moon', { id:'moon', name:'月球', en:'MOON', radius:.27, distance:2.4, period:4, color:'#c8c8c2', object:moon, mesh:moon, info:'地球的天然卫星。其轨道面相对黄道面倾斜 5.14°。' })
addLabel('moon', '月球')
const updateEarthMoon = createEarthMoonRig(earth, moon)

// 地月局部轨道单独随地球移动，体现父坐标系传递。
const moonOrbitGeometry = new THREE.BufferGeometry().setFromPoints(Array.from({length:129},(_,i)=>{
  const a=i/128*Math.PI*2
  return new THREE.Vector3(Math.cos(a)*2.4,0,Math.sin(a)*2.4)
}))
const moonOrbitMaterial = new THREE.LineBasicMaterial({color:'#7294a4',transparent:true,opacity:.42,depthWrite:false})
moonOrbitMaterial.name = '月球轨道 · 灰蓝'
const moonOrbitLine = new THREE.Line(moonOrbitGeometry,moonOrbitMaterial)
moonOrbitLine.name = '月球轨道'
scene.add(moonOrbitLine)

function mulberry32(seed) {
  return function() { let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296 }
}
const random = mulberry32(20261026)

function createStars(count, minRadius, maxRadius, size, opacity) {
  const positions = new Float32Array(count*3)
  const colors = new Float32Array(count*3)
  const color = new THREE.Color()
  for(let i=0;i<count;i++){
    const u=random()*2-1, a=random()*Math.PI*2, r=minRadius+random()*(maxRadius-minRadius), s=Math.sqrt(1-u*u)
    positions[i*3]=r*s*Math.cos(a);positions[i*3+1]=r*u;positions[i*3+2]=r*s*Math.sin(a)
    color.set(random()>.86?'#adc8e2':random()>.76?'#e4cfad':'#8191a7')
    const intensity=.45+random()*.55
    colors[i*3]=color.r*intensity;colors[i*3+1]=color.g*intensity;colors[i*3+2]=color.b*intensity
  }
  const geometry=new THREE.BufferGeometry()
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3))
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3))
  const material=new THREE.PointsMaterial({size,vertexColors:true,transparent:true,opacity,sizeAttenuation:true,depthWrite:false})
  material.name='深空星点'
  const stars=new THREE.Points(geometry,material)
  stars.name='固定种子星空'
  scene.add(stars)
}
createStars(2400,230,700,1.15,.72)
createStars(650,180,400,1.8,.55)

const asteroidGeometry = new THREE.DodecahedronGeometry(.075,0)
const asteroidMaterial = new THREE.MeshStandardMaterial({color:'#514d47',roughness:1})
asteroidMaterial.name='小行星带 · 岩屑'
const asteroids = new THREE.InstancedMesh(asteroidGeometry,asteroidMaterial,1400)
asteroids.name='小行星带 · 1400 实例'
const dummy = new THREE.Object3D()
for(let i=0;i<1400;i++){
  const a=random()*Math.PI*2,r=33+random()*4.7
  dummy.position.set(Math.cos(a)*r,(random()-.5)*1.4,Math.sin(a)*r)
  dummy.rotation.set(random()*3,random()*3,random()*3)
  dummy.scale.setScalar(.35+random()*1.25)
  dummy.updateMatrix();asteroids.setMatrixAt(i,dummy.matrix)
}
asteroids.instanceMatrix.needsUpdate=true
scene.add(asteroids)

let running = true
let tourActive = true
let elapsed = 0
let tourTime = 0
let selectedId = 'earth'
let cameraTween = null
const tourPosition = new THREE.Vector3()
const tourTarget = new THREE.Vector3()
const worldPosition = new THREE.Vector3()
const projected = new THREE.Vector3()
const clock = new THREE.Clock()

function updateBodies(dt) {
  if (running) elapsed += dt
  const t = elapsed
  sun.rotation.y = t * .025 * SETTINGS.spinSpeed
  for (const data of BODIES) {
    if (data.id === 'earth') continue
    const body = bodies.get(data.id)
    body.pivot.rotation.y = body.angle + t / data.period * Math.PI * 2 * SETTINGS.orbitSpeed
    body.mesh.rotation.y = t / data.spin * Math.PI * 2 * SETTINGS.spinSpeed
  }
  updateEarthMoon({
    earthAngle: earthEntry.angle + t / earthData.period * Math.PI * 2 * SETTINGS.orbitSpeed,
    earthSpin: t / earthData.spin * Math.PI * 2 * SETTINGS.spinSpeed,
    moonAngle: .8 + t / 4 * Math.PI * 2 * SETTINGS.orbitSpeed,
    axialTilt: SETTINGS.axialTilt,
  })
  earth.updateMatrixWorld(true)
  moon.updateMatrixWorld(true)
  earth.getWorldPosition(worldPosition)
  moonOrbitLine.position.copy(worldPosition)
  moonOrbitLine.rotation.set(5.14*Math.PI/180,earthEntry.angle + t / earthData.period * Math.PI * 2 * SETTINGS.orbitSpeed,0)
  asteroids.rotation.y = t * .008 * SETTINGS.orbitSpeed
}

function updateLabels() {
  const width=innerWidth,height=innerHeight
  for (const [id, el] of labels) {
    const body=bodies.get(id)
    if(!body || !SETTINGS.showLabels){el.style.display='none';continue}
    body.object.getWorldPosition(worldPosition)
    projected.copy(worldPosition).project(activeCamera)
    const visible=projected.z>-1&&projected.z<1&&Math.abs(projected.x)<1.05&&Math.abs(projected.y)<1.05
    el.style.display=visible?'block':'none'
    if(visible){
      el.style.left=`${(projected.x*.5+.5)*width}px`
      el.style.top=`${(-projected.y*.5+.5)*height-10-body.radius*2}px`
      el.style.opacity = id==='moon' && activeCamera.position.distanceTo(worldPosition)>45 ? '0' : '1'
    }
  }
}

function updateProjectionFrustum() {
  const aspect=innerWidth/innerHeight
  const halfHeight=58
  orthoCamera.left=-halfHeight*aspect;orthoCamera.right=halfHeight*aspect
  orthoCamera.top=halfHeight;orthoCamera.bottom=-halfHeight
  orthoCamera.updateProjectionMatrix()
}

function syncCameraFrom(oldCamera, newCamera) {
  newCamera.position.copy(oldCamera.position)
  newCamera.quaternion.copy(oldCamera.quaternion)
  newCamera.up.copy(oldCamera.up)
  activeCamera=newCamera
  controls.object=newCamera
  controls.update()
}

function setProjection(mode) {
  if(mode===projectionMode)return
  const previous=activeCamera
  projectionMode=mode
  if(mode==='orthographic'){
    updateProjectionFrustum();syncCameraFrom(previous,orthoCamera)
  }else syncCameraFrom(previous,camera)
  $('projection-label').textContent=mode==='perspective'?'透视投影':'正交投影'
  $('projection-icon').textContent=mode==='perspective'?'◈':'▣'
}

function setTour(active) {
  tourActive=active
  cameraTween=null
  $('tour').classList.toggle('active',active)
  $('tour-label').textContent=active?'漫游进行中':'继续相机漫游'
  if(active) running=true
  updatePlayUI()
}

function updatePlayUI(){
  $('play-icon').textContent=running?'Ⅱ':'▶'
  $('play-label').textContent=running?'暂停模拟':'继续模拟'
  $('status').textContent=running?'LIVE':'PAUSED'
  document.querySelector('.live-dot').style.background=running?'#6bb49d':'#a68a64'
}

function toggleRunning(){running=!running;updatePlayUI()}

function setView(view) {
  setTour(false)
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view))
  let position=new THREE.Vector3(0,88,154),target=new THREE.Vector3()
  if(view==='earth'){
    earth.getWorldPosition(target)
    // 从朝向太阳的一侧观察，避免近景只剩背光剪影。
    position.copy(target).addScaledVector(target.clone().normalize(),-10).add(new THREE.Vector3(0,4,0))
  }else if(view==='saturn'){
    const saturn=bodies.get('saturn');saturn.object.getWorldPosition(target)
    position.copy(target).addScaledVector(target.clone().normalize(),-17).add(new THREE.Vector3(0,9,0))
  }
  cameraTween={start:performance.now(),from:activeCamera.position.clone(),to:position,fromTarget:controls.target.clone(),toTarget:target.clone()}
}

function focusSelected(){
  if(selectedId==='earth'||selectedId==='moon'){setView('earth');return}
  if(selectedId==='saturn'){setView('saturn');return}
  const body=bodies.get(selectedId)
  if(!body)return
  setTour(false)
  body.object.getWorldPosition(worldPosition)
  const distance=Math.max(body.radius*5,7)
  cameraTween={start:performance.now(),from:activeCamera.position.clone(),to:worldPosition.clone().add(new THREE.Vector3(distance*.7,distance*.45,distance)),fromTarget:controls.target.clone(),toTarget:worldPosition.clone()}
}

function selectBody(id){
  const body=bodies.get(id);if(!body)return
  selectedId=id
  $('body-index').textContent=id==='sun'?'00':id==='moon'?'03·1':String(BODIES.findIndex(b=>b.id===id)+1).padStart(2,'0')
  $('body-name').textContent=body.name;$('body-en').textContent=body.en
  $('body-description').textContent=body.info
  $('body-radius').textContent=`${body.radius.toFixed(2)} u`
  $('body-distance').textContent=`${body.distance.toFixed(1)} u`
  $('body-period').textContent=body.period?`${body.period} s`:'—'
  $('body-dot').style.background=`radial-gradient(circle at 35% 30%,#ffffff55,${body.color} 48%,#101722)`
  document.querySelectorAll('[data-body]').forEach(b=>b.classList.toggle('selected',b.dataset.body===id))
}

controls.addEventListener('start',()=>{setTour(false);cameraTween=null;document.querySelectorAll('[data-view]').forEach(b=>b.classList.remove('active'))})
$('play').addEventListener('click',toggleRunning)
$('tour').addEventListener('click',()=>setTour(!tourActive))
$('projection').addEventListener('click',()=>setProjection(projectionMode==='perspective'?'orthographic':'perspective'))
$('focus-body').addEventListener('click',focusSelected)
document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();setView('overview')})
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)))
document.querySelectorAll('[data-body]').forEach(b=>b.addEventListener('click',()=>selectBody(b.dataset.body)))

function bindRange(id,key,output,format){
  $(id).addEventListener('input',e=>{SETTINGS[key]=Number(e.target.value);$(output).textContent=format(SETTINGS[key])})
}
bindRange('orbit-speed','orbitSpeed','orbit-value',v=>`${v.toFixed(2)}×`)
bindRange('spin-speed','spinSpeed','spin-value',v=>`${v.toFixed(2)}×`)
bindRange('axial-tilt','axialTilt','tilt-value',v=>`${v.toFixed(1)}°`)
$('show-orbits').addEventListener('change',e=>{SETTINGS.showOrbits=e.target.checked;orbitGroup.visible=SETTINGS.showOrbits;moonOrbitLine.visible=SETTINGS.showOrbits})
$('show-labels').addEventListener('change',e=>SETTINGS.showLabels=e.target.checked)
$('show-asteroids').addEventListener('change',e=>{SETTINGS.showAsteroids=e.target.checked;asteroids.visible=SETTINGS.showAsteroids})

const help=$('help')
$('help-button').addEventListener('click',()=>help.showModal())
$('close-help').addEventListener('click',()=>help.close())
help.addEventListener('click',e=>{if(e.target===help)help.close()})
window.addEventListener('keydown',e=>{
  if(e.target.matches('input')||help.open)return
  if(e.code==='Space'){e.preventDefault();toggleRunning()}
  else if(e.key.toLowerCase()==='o')setProjection(projectionMode==='perspective'?'orthographic':'perspective')
  else if(e.key.toLowerCase()==='t')setTour(!tourActive)
  else if(e.key.toLowerCase()==='r')setView('overview')
  else if(e.key.toLowerCase()==='l'){$('show-orbits').checked=!$('show-orbits').checked;$('show-orbits').dispatchEvent(new Event('change'))}
  else if(e.key==='1')setView('overview')
  else if(e.key==='2')setView('earth')
  else if(e.key==='3')setView('saturn')
})

let pointerStart={x:0,y:0}
canvas.addEventListener('pointerdown',e=>pointerStart={x:e.clientX,y:e.clientY})
canvas.addEventListener('pointerup',e=>{
  if(Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>5)return
  const rect=canvas.getBoundingClientRect()
  const pointer=new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1)
  const raycaster=new THREE.Raycaster();raycaster.setFromCamera(pointer,activeCamera)
  const hit=raycaster.intersectObjects(clickable,false)[0]
  if(hit)selectBody(hit.object.userData.bodyId)
})

function resize(){
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();updateProjectionFrustum()
  renderer.setSize(innerWidth,innerHeight)
}
window.addEventListener('resize',resize)

function animate(){
  requestAnimationFrame(animate)
  const dt=Math.min(clock.getDelta(),.05)
  if(running&&tourActive)tourTime+=dt
  updateBodies(dt)
  if(tourActive){
    sampleTour(TOUR_KEYFRAMES,tourTime,tourPosition,tourTarget)
    activeCamera.position.copy(tourPosition);controls.target.copy(tourTarget);activeCamera.lookAt(tourTarget)
  }else if(cameraTween){
    const raw=Math.min((performance.now()-cameraTween.start)/1100,1)
    const u=raw*raw*(3-2*raw)
    activeCamera.position.lerpVectors(cameraTween.from,cameraTween.to,u)
    controls.target.lerpVectors(cameraTween.fromTarget,cameraTween.toTarget,u)
    if(raw===1)cameraTween=null
  }
  controls.update();updateLabels();renderer.render(scene,activeCamera)
}

selectBody('earth')
updateBodies(0)
animate()
requestAnimationFrame(()=>{$('loading').classList.add('hidden');setTimeout(()=>$('loading').remove(),700)})

// 只读状态与确定性操作入口，便于课程验收和自动化检查。
window.__solarQA={
  ready:true,
  settings:SETTINGS,
  setProjection,
  setView,
  setTour,
  setRunning(value){running=value;updatePlayUI()},
  setTime(value){elapsed=value;tourTime=value;updateBodies(0)},
  getState(){return{running,tourActive,projectionMode,elapsed,tourTime,selectedId,earthMatrix:earth.matrix.elements.slice(),moonMatrix:moon.matrix.elements.slice(),camera:activeCamera.position.toArray(),target:controls.target.toArray(),meshCount:scene.children.length,materialNames:[...new Set([...bodies.values()].map(b=>b.mesh.material.name))]}},
  get renderer(){return renderer},
  get scene(){return scene},
  get camera(){return activeCamera},
}
