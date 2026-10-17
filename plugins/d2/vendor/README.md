# Pinned D2 layout resources

`dagre.js.br` and `setup.txt` are unchanged copies of `d2layouts/d2dagrelayout/dagre.js.br` and `setup.js` from D2 commit `581c91096b62d644fb5168313142c836b7e68e74`:

https://github.com/d2lang/d2/tree/581c91096b62d644fb5168313142c836b7e68e74/d2layouts/d2dagrelayout

The build checks that both resources occur verbatim in the pinned npm WASM. It decompresses Dagre at build time and bundles it as static JavaScript. The Worker recognizes only the fixed upstream layout command templates and calls Dagre directly. It never executes incoming strings as JavaScript. Review the bridge and resources together before upgrading D2.

Dagre attribution and MIT license: `../notices/dagre.txt`. D2 license: `../notices/d2.txt`.
