# 使用Excalidraw 草图预览

已生成本地可导入开发包，位于 `.notegen/package`；尚未进行应用内运行验证或发布。需要包含本次通用代码块 API 的 NoteGen 桌面开发宿主和本地 SDK/CLI。最低需要 NoteGen 0.38.3，以使用通用代码块渲染 API。

1. 导入 `.notegen/package`，启用插件并确认代码块渲染说明。
2. 将下列围栏代码块插入笔记：

````markdown
```excalidraw
{
  "type": "excalidraw",
  "version": 2,
  "source": "https://excalidraw.com",
  "elements": [
    {
      "id": "box-a",
      "type": "rectangle",
      "x": 0,
      "y": 0,
      "width": 180,
      "height": 100,
      "angle": 0,
      "strokeColor": "#1e1e1e",
      "backgroundColor": "#a5d8ff",
      "fillStyle": "solid",
      "strokeWidth": 2,
      "strokeStyle": "solid",
      "roughness": 1,
      "opacity": 100,
      "groupIds": [],
      "frameId": null,
      "roundness": {
        "type": 3
      },
      "seed": 12345,
      "version": 1,
      "versionNonce": 12345,
      "isDeleted": false,
      "boundElements": [],
      "updated": 1,
      "link": null,
      "locked": false
    }
  ],
  "appState": {
    "viewBackgroundColor": "#ffffff"
  },
  "files": {}
}
```
````

仅读取匹配代码块，源码保持在原 Markdown 文档中。按需加载离线引擎，由宿主提供默认预览、源码切换、错误反馈与渲染器选择。源码最多 32 KiB、1,000 行；结果最多 2 MiB，且受宿主图像尺寸限制。仅做编辑器静态预览，不支持移动端或导出承诺。

使用官方 @excalidraw/utils 导出完整 Excalidraw JSON 场景，只预览矩形、椭圆、菱形、线、箭头、自由笔画和文字。不提供画布编辑、图片/附件、嵌入内容、链接、框架或场景迁移。最多 400 个元素、每个点数组最多 5,000 项；输入仍受 32 KiB 限制。导出场景需含完整元素属性与 seed。文字统一使用系统无衬线字体，手写字体和换行效果可能与官方编辑器不同。上游导出模块较大，构建时压缩成四个资源分片，首次使用时解压加载；需要支持 DecompressionStream 的现代桌面 WebView。开发包约 13.3 MiB，解压后的引擎脚本约 19 MiB；首次加载成本与运行内存尚未在应用内实测。

使用“编辑源码”和“预览”切换；错误时保留源码，可修正后重试。禁用插件后恢复普通代码块。

## 手动验收建议（未执行）

- 示例、中文标签、明暗主题、窄窗口与长文档分节模式。
- 首次加载、重复预览、多张图表的内容与响应速度。
- 修改、撤销、保存和重开后源码不变。
- 无效语法、超限输入、外部资源与不支持功能的错误反馈。
- 禁用/重载插件或切换工作区后旧结果消失；重新启用后恢复。
- 对照上述格式限制逐项确认；不应产生外部资源请求。
