# 使用BPMN 流程图

已生成本地可导入开发包，位于 `.notegen/package`；尚未进行应用内运行验证或发布。需要包含本次通用代码块 API 的 NoteGen 桌面开发宿主和本地 SDK/CLI。最低需要 NoteGen 0.38.3，以使用通用代码块渲染 API。

1. 导入 `.notegen/package`，启用插件并确认代码块渲染说明。
2. 将下列围栏代码块插入笔记：

````markdown
```bpmn
<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_1" targetNamespace="https://notegen.top/examples">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="Start_1" name="Start"/>
    <bpmn:task id="Task_1" name="Review"/>
    <bpmn:endEvent id="End_1" name="Done"/>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Task_1"/>
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="End_1"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_1">
    <bpmndi:BPMNPlane id="Plane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="Start_di" bpmnElement="Start_1"><dc:Bounds x="100" y="100" width="36" height="36"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_di" bpmnElement="Task_1"><dc:Bounds x="200" y="78" width="100" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_di" bpmnElement="End_1"><dc:Bounds x="364" y="100" width="36" height="36"/></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1"><di:waypoint x="136" y="118"/><di:waypoint x="200" y="118"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2"><di:waypoint x="300" y="118"/><di:waypoint x="364" y="118"/></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
```
````

仅读取匹配代码块，源码保持在原 Markdown 文档中。按需加载离线引擎，由宿主提供默认预览、源码切换、错误反馈与渲染器选择。源码最多 32 KiB、1,000 行；结果最多 2 MiB，且受宿主图像尺寸限制。仅做编辑器静态预览，不支持移动端或导出承诺。

使用 bpmn-js Viewer，只接受包含 BPMNDiagram/BPMNPlane、BPMNShape 坐标和 BPMNEdge 路径的 BPMN 2.0 XML；只有业务定义、没有 DI 布局的 XML 不会自动布局。最多 300 个形状、600 条连接。不执行流程、脚本或外部调用，不提供流程编辑。拒绝 XML DTD/实体。静态图片底部保留原始 bpmn.io 标识，输出字体/样式会在隔离环境中转为 SVG 属性，明暗主题提供默认配色。

使用“编辑源码”和“预览”切换；错误时保留源码，可修正后重试。禁用插件后恢复普通代码块。

## 手动验收建议（未执行）

- 示例、中文标签、明暗主题、窄窗口与长文档分节模式。
- 首次加载、重复预览、多张图表的内容与响应速度。
- 修改、撤销、保存和重开后源码不变。
- 无效语法、超限输入、外部资源与不支持功能的错误反馈。
- 禁用/重载插件或切换工作区后旧结果消失；重新启用后恢复。
- 对照上述格式限制逐项确认；不应产生外部资源请求。
