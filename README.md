# 蜘蛛侠 · 3D 自由之城

在浏览器里探索 3D 城市，使用双手蛛丝摆荡、跳跃、攀墙，并随时挑战犀牛人、电光人和绿魔。

## 操作

- 手机：左摇杆移动，滑动画面转动镜头。按住左手或右手蛛丝挂住楼顶，松手飞出去。跳跃和攻击使用右侧按钮。
- 电脑：W / A / S / D 移动，拖动鼠标转镜头，空格跳跃，Q / E 分别发射两只手的蛛丝，F 发射攻击蛛丝，Esc 暂停。方向键也可转动镜头。
- 靠近墙壁按住跳跃可以攀墙。城市地图可直接前往 Boss 所在楼顶。
- 击败三个 Boss 后仍能自由探索。地图里可再次挑战已击败的 Boss。

## 用 GitHub Pages 部署

这是一个纯静态网站，不需要安装依赖或运行构建。

1. 在 GitHub 创建一个公开仓库，例如 `spider-free-city-3d`。
2. 将解压后的文件上传到仓库根目录。不要只上传 ZIP 文件，也不要把文件套在另一层文件夹里。
3. 仓库中应直接包含 `index.html`、`style.css`、`game3d.js`、`engine3d.js`、`world3d.js` 和 `favicon.svg`。保留 `.nojekyll` 文件。
4. 打开仓库的 **Settings → Pages**。
5. **Source** 选择 **Deploy from a branch**，分支选择 **main**，目录选择 **/(root)**，保存。
6. 等待部署成功，GitHub Pages 设置页会显示可以打开的游戏地址。

官方说明：https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## 本地运行

在解压目录中运行：

```sh
python3 -m http.server 8000
```

然后在浏览器中打开 `http://localhost:8000`。由于使用 JavaScript 模块，应通过 HTTP 服务运行，而不是双击 HTML 文件。

## 文件说明

- `engine3d.js`：WebGL 3D 渲染、网格、相机矩阵。
- `world3d.js`：城市生成、角色物理、蛛丝约束、碰撞和 Boss 战斗。
- `game3d.js`：手机与电脑操作、镜头跟随、界面和地图。
- `style.css`：适配手机和电脑的界面。

## 验证范围

已检查 JavaScript 语法、模型坐标和相机投影，并模拟验证屋顶碰撞、跳跃、双手蛛丝、松手惯性、攀墙、复活以及三个 Boss 的战斗。
当前尚未在真实手机浏览器中验证画面和触摸手感；这是可继续修改的第一版 3D 游戏。
