# AP2 · 三维层级场景：太阳系

基于 **Three.js / WebGL 2.0 / 原生 JavaScript** 的交互式太阳系。包含全部 Baseline，并完成 **E1：八大行星、土星环与小行星带**。

> 场景采用压缩教学尺度，天体的半径、距离与周期不是现实比例。所有运行库和纹理均在项目内，无 CDN 依赖、无构建步骤。

## 1. 运行方式

**在线演示（公网 URL）：[https://yci3p37s75xqu.ok.kimi.link/](https://yci3p37s75xqu.ok.kimi.link/)**

已核验公网页面、矩阵模块与地球纹理可访问，并在浏览器中实际启动场景、测试投影切换。

### 本地静态服务器

在本目录打开终端，任选一种：

```bash
# Python
python -m http.server 8000

# 或 Node.js（无需安装项目依赖）
npx serve .
```

浏览器访问 `http://localhost:8000`。不要直接双击 `index.html`，浏览器会限制 `file://` 下的 ES Module。将整个目录放到 GitHub Pages、课程平台或任意静态网站服务也可直接运行。

## 2. 交互说明

| 操作 | 功能 |
|---|---|
| 左键拖拽 | 旋转视角，并立即接管自动漫游 |
| 滚轮 | 缩放视角，并立即接管自动漫游 |
| 点击天体 / 底部名称 | 查看天体信息 |
| `空格` | 暂停 / 继续天体运动与相机漫游 |
| `O` | 在相同相机位置切换透视 / 正交投影 |
| `T` | 继续 / 暂停自动漫游；拖拽也可接管 |
| `L` | 显示 / 隐藏轨道线 |
| `R` | 恢复全景视角 |
| `1 / 2 / 3` | 全景 / 地月系统 / 土星预设视角 |
| 参数滑条 | 实时调整公转速度、自转速度、地球轴倾角 |
| 开关 | 轨道线、天体标签、小行星带 |

## 3. 层级结构与手动矩阵

### 3.1 变换嵌套树

```text
太阳坐标系（世界原点）
└─ 地球公转 Ry(earthOrbit)
   └─ 地球轨道平移 T(21, 0, 0)
      ├─ 地球轴倾角 Rz(23.5°)
      │  └─ 地球自转 Ry(earthSpin)
      │     └─ 地球缩放 S(1)
      └─ 月球轨道面倾角 Rx(5.14°)
         └─ 月球公转 Ry(moonOrbit)
            └─ 地月距离平移 T(2.4, 0, 0)
               └─ 月球缩放 S(0.27)
```

核心代码：`js/hierarchy.js` 的 `createEarthMoonRig()`。

Three.js 使用列向量，矩阵右端的变换先作用于顶点：

```text
M_earth = Ry(earthOrbit) · T(21) · Rz(axialTilt) · Ry(earthSpin) · S(1)
```

因此地球先在自身模型矩阵中完成轴倾角和自转，再被放入公转轨道坐标系，符合“先转后挂”。轴倾角默认 **23.5°**，面板可调到 0–45°。

月球的地月参考系只继承地球的公转与轨道平移，不继承地球自转：

```text
M_earthFrame = Ry(earthOrbit) · T(21)
M_moon = M_earthFrame · Rx(5.14°) · Ry(moonOrbit) · T(2.4) · S(0.27)
```

这里没有使用 `OrbitControls` 或工具类来代为计算天体运动，而是直接调用 `Matrix4.makeRotationX/Y/Z()`、`makeTranslation()`、`makeScale()`，再用 `multiply()` 逐个组合。`matrixAutoUpdate=false`，每帧把手工结果写回地球和月球的 `matrix`。

## 4. 表面纹理与 UV 方向

- 太阳：`textures/sun.jpg`，原创程序化位图。
- 地球：`textures/earth.jpg`，NASA Blue Marble。
- 月球：`textures/moon.jpg`，NASA LROC。
- 其余行星与土星环也使用本地位图；小行星带使用 `InstancedMesh`。

`SphereGeometry` 自带 UV 坐标。纹理由 `TextureLoader` 加载，最终通过 Three.js 的 `gl.texImage2D` 上传到 GPU，片元着色器根据 UV 采样。

代码显式设置：

```js
texture.flipY = true
texture.colorSpace = THREE.SRGBColorSpace
```

位图文件的像素原点在左上，而 WebGL 纹理坐标原点在左下。`flipY=true` 对应 WebGL 的 `UNPACK_FLIP_Y_WEBGL`，使图像顶部映射到球体 `v=1` 的北极，避免地球南北颠倒。颜色纹理使用 sRGB，避免颜色被错误提亮或变暗。

土星环另外把 `RingGeometry` 的默认平面 UV 改为径向 UV：`u=(radius-innerRadius)/(outerRadius-innerRadius)`，从而正确显示同心环带。

## 5. 双投影对比

同一画面、相同相机位置与目标点，按 `O` 即可切换。

| 透视投影：近大远小 | 正交投影：尺寸不随深度缩小 |
|---|---|
| ![透视投影](https://yci3p37s75xqu.ok.kimi.link/screenshots/01-perspective.png) | ![正交投影](https://yci3p37s75xqu.ok.kimi.link/screenshots/02-orthographic.png) |

- **透视投影**：投影线在相机处汇聚，近处土星等天体显得更大，平行轨道在画面中产生透视收缩。
- **正交投影**：投影线彼此平行，没有近大远小，天体的投影尺寸不随相机深度改变，更适合观察几何关系。

## 6. 相机漫游与实现结构

漫游路径定义在 `js/config.js` 的 `TOUR_KEYFRAMES`。`js/hierarchy.js` 的 `sampleTour()` 在相邻关键帧间插值，并用 `u²(3−2u)` 平滑起止速度。`js/main.js` 每帧同步相机位置和目标点；`OrbitControls` 的 `start` 事件让鼠标操作立即接管。

```text
submission/
├─ index.html            页面与参数面板
├─ styles.css            响应式界面
├─ js/
│  ├─ config.js          天体半径、距离、周期与漫游关键帧（集中配置）
│  ├─ hierarchy.js       地月手动矩阵、关键帧插值
│  └─ main.js            场景、纹理、投影、交互、渲染
├─ textures/             全部本地位图
├─ vendor/               Three.js 与 OrbitControls（本地 MIT 运行库）
├─ screenshots/          验收截图
└─ media/solar-tour.webm 10 秒漫游录屏（1280×720）
```

## 7. 截图与录屏

### 地月层级与轴倾角

![地月系统](https://yci3p37s75xqu.ok.kimi.link/screenshots/03-earth-moon.png)

### 土星环与小行星带扩展

![土星](https://yci3p37s75xqu.ok.kimi.link/screenshots/04-saturn.png)

**10 秒漫游录屏：** [观看录屏](https://yci3p37s75xqu.ok.kimi.link/media/solar-tour.webm)

## 8. 验证记录

已在 Edge / WebGL 2.0 中实际运行并检查：

- 地月矩阵中心距离为 2.4 场景单位；轴倾角滑条实时改变模型矩阵。
- `O` 切换投影前后相机位置完全一致。
- 公转、自转、轴倾角、轨道线控件均生效。
- 空格暂停 / 继续，漫游持续推进，拖拽立即接管。
- 时间定位 `4s → 1s → 4s` 的地球矩阵一致。
- 浏览器控制台无运行错误。

## 9. 引用与许可

- **Three.js 0.186.0**：MIT License，见 `vendor/THREE-LICENSE.txt`。使用其渲染、几何、矩阵、纹理与 `OrbitControls`；地月层级组合、漫游插值、界面和交互逻辑为本项目撰写。
- **NASA Blue Marble（地球）**：<https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57730/land_ocean_ice_2048.png>。
- **NASA CGI Moon Kit / LROC（月球）**：<https://svs.gsfc.nasa.gov/4720/>，使用 `lroc_color_poles_2k.tif` 转为 JPEG。
- NASA 影像作为美国政府机构作品使用；页面不代表 NASA 对本项目的背书。
- 其余纹理由项目原创程序生成，未复制第三方教程场景代码。
