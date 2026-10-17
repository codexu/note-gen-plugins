# Using BPMN Preview

The local importable development package is available in `.notegen/package`; in-app behavior is not verified and nothing is published. Requires the desktop development host with the generic code-block API and the local SDK/CLI. Requires NoteGen 0.38.3 or later for the generic code-block renderer API.

1. Import `.notegen/package`, enable the plugin and review the rendering disclosure.
2. Insert this fenced block into a note:

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

Reads matching blocks only and preserves Markdown source. Offline engines load on demand; the host provides preview by default, source switching, errors and renderer selection. Input: 32 KiB / 1,000 lines; output: 2 MiB plus host dimension limits. Static editor preview only, with no mobile support or export guarantee.

Uses bpmn-js Viewer for BPMN 2.0 XML containing BPMNDiagram/BPMNPlane, BPMNShape coordinates and BPMNEdge waypoints. XML with semantic definitions but no DI layout is not automatically laid out. Limits: 300 shapes and 600 connections. Does not execute processes, scripts or external calls, and does not edit models. XML DTDs/entities are rejected. The original bpmn.io watermark remains visible in the static-image footer. Styles are flattened into SVG attributes in isolation; light/dark defaults are provided.

Use **Edit source** and **Preview** to switch. Errors preserve source for correction/retry. Disabling restores ordinary code blocks.

## Suggested manual acceptance (not performed)

- Example, Chinese labels, light/dark, narrow windows and sectioned long documents.
- Cold initialization, repeated previews, multiple diagrams and responsiveness.
- Edit, undo, save/reopen source preservation.
- Invalid syntax, oversized input, external resources and unsupported features.
- Disable/reload and workspace switches clear stale output; re-enabling restores previews.
- Verify the format-specific limitations above and absence of external resource requests.
