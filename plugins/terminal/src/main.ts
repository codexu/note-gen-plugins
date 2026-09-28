import { registerView, type PluginActivate } from '@notegen/plugin-api'

export const activate: PluginActivate = context => {
  const viewId = `${context.plugin.id}.panel`
  registerView(context, {
    id: viewId,
    render: () => ({ blocks: [{ type: 'embedded-view', id: 'shell' }] }),
  })
  context.commands.handle(`${context.plugin.id}.open`, async () => {
    await context.ui.views.open(viewId)
  })
}
